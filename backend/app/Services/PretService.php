<?php

namespace App\Services;

use App\Models\Caisse;
use App\Models\EcheancePret;
use App\Models\Pret;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class PretService
{
    public function __construct(
        private readonly NotificationService $notificationService
    ) {}

    public function demander(Caisse $caisse, string $membreId, float $montant, int $nbEcheances, array $data = []): Pret
    {
        $taux = (float) ($data['taux_interet_mensuel'] ?? $caisse->taux_interet_mensuel ?? 0.05);
        $tauxPenalite = (float) ($data['taux_penalite_mensuel'] ?? $caisse->taux_penalite_mensuel ?? 0.02);
        $interet = round($montant * $taux * $nbEcheances, 2);
        $total = round($montant + $interet, 2);

        return Pret::create(array_merge($data, [
            'caisse_id' => $caisse->id,
            'emprunteur_id' => $membreId,
            'montant_principal' => $montant,
            'taux_interet_mensuel' => $taux,
            'taux_penalite_mensuel' => $tauxPenalite,
            'methode_amortissement' => $data['methode_amortissement'] ?? 'lineaire',
            'nb_echeances' => $nbEcheances,
            'montant_echeance' => round($total / $nbEcheances, 2),
            'interet_total' => $interet,
            'montant_total_du' => $total,
            'montant_rembourse' => 0,
            'capital_restant' => $total,
            'statut' => 'demande',
            'date_demande' => now()->toDateString(),
        ]));
    }

    public function approuver(Pret $pret, ?string $userId = null): Pret
    {
        if (! in_array($pret->statut, ['demande', 'en_attente_validation'])) {
            throw new RuntimeException('Ce pret ne peut pas etre approuve dans son etat actuel.');
        }

        $pret->forceFill([
            'statut' => 'approuve',
            'approuve_par' => $userId,
            'date_approbation' => now()->toDateString(),
        ])->save();

        $this->notificationService->notifierPretApprouve(
            $pret->caisse->association_id,
            $pret->emprunteur_id,
            $pret->id,
            (float) $pret->montant_principal
        );

        return $pret->refresh();
    }

    public function decaisser(Pret $pret, CaisseService $caisseService, ?string $userId = null): Pret
    {
        if ($pret->date_approbation && Carbon::parse($pret->date_approbation)->diffInDays(now()) > 7) {
            $pret->forceFill(['statut' => 'expire'])->save();
            throw new RuntimeException('Ce pret a expire (plus de 7 jours sans decaissement).');
        }

        if ($pret->statut !== 'approuve') {
            throw new RuntimeException('Seul un pret approuve peut etre decaisse.');
        }

        return DB::transaction(function () use ($pret, $caisseService, $userId) {
            $tx = $caisseService->sortie(
                $pret->caisse,
                (float) $pret->montant_principal,
                'Decaissement pret',
                [
                    'reference_type' => Pret::class,
                    'reference_id' => $pret->id,
                    'created_by' => $userId,
                ]
            );

            $pret->forceFill([
                'statut' => 'en_cours',
                'date_debut' => now()->toDateString(),
                'transaction_decaissement_id' => $tx->id,
            ])->save();

            $this->genererAmortissement($pret->refresh());

            return $pret->load('echeances');
        });
    }

    public function rembourser(Pret $pret, float $montant, CaisseService $caisseService, ?string $userId = null): Pret
    {
        if (! in_array($pret->statut, ['en_cours', 'en_retard'])) {
            throw new RuntimeException('Ce pret ne peut pas recevoir de remboursement dans son etat actuel.');
        }

        return DB::transaction(function () use ($pret, $montant, $caisseService, $userId) {
            $caisseService->entree(
                $pret->caisse,
                $montant,
                'Remboursement pret',
                [
                    'reference_type' => Pret::class,
                    'reference_id' => $pret->id,
                    'created_by' => $userId,
                ]
            );

            $reste = $montant;
            $echeances = $pret->echeances()->whereIn('statut', ['due', 'partielle', 'en_retard'])->orderBy('numero_echeance')->get();

            foreach ($echeances as $echeance) {
                if ($reste <= 0) break;
                $manquant = (float) $echeance->montant_total - (float) $echeance->montant_verse;
                $verse = min($reste, $manquant);
                $reste -= $verse;

                $echeance->forceFill([
                    'montant_verse' => (float) $echeance->montant_verse + $verse,
                    'date_versement_reel' => now()->toDateString(),
                    'statut' => ((float) $echeance->montant_verse + $verse) >= (float) $echeance->montant_total ? 'payee' : 'partielle',
                ])->save();
            }

            $totalVerse = (float) $pret->echeances()->sum('montant_verse');
            $capitalRestant = max(0, (float) $pret->montant_total_du - $totalVerse);

            $pret->forceFill([
                'montant_rembourse' => $totalVerse,
                'capital_restant' => $capitalRestant,
                'statut' => $capitalRestant <= 0 ? 'solde' : $pret->statut,
                'date_solde' => $capitalRestant <= 0 ? now()->toDateString() : null,
            ])->save();

            if ($capitalRestant > 0 && $montant > (float) $pret->montant_echeance) {
                $this->recalculerEcheancesFutures($pret->refresh());
            }

            return $pret->refresh()->load('echeances');
        });
    }

    public function verifierEtPasserEnDefaut(Pret $pret, ?string $presidentId = null): Pret
    {
        if ($pret->statut !== 'en_retard') {
            return $pret;
        }

        $dernierVersement = $pret->echeances()->whereNotNull('date_versement_reel')->max('date_versement_reel');
        $referenceDate = $dernierVersement ? Carbon::parse($dernierVersement) : Carbon::parse($pret->date_debut ?? $pret->date_demande);
        $jours = $referenceDate->diffInDays(now());
        $seuil = (int) ($pret->caisse->association->seuil_defaut_jours ?? 90);

        if ($jours >= $seuil) {
            $pret->forceFill(['statut' => 'defaut'])->save();
            $pret->emprunteur->forceFill([
                'statut' => 'suspendu',
                'motif_suspension' => 'Pret en defaut',
            ])->save();

            $this->notificationService->notifierDefautPret(
                $pret->caisse->association_id,
                $pret->emprunteur_id,
                $pret->id,
                $presidentId
            );
        }

        return $pret->refresh();
    }

    public function leverDefaut(Pret $pret, array $data, ?string $userId = null): Pret
    {
        if ($pret->statut !== 'defaut') {
            throw new RuntimeException('Ce pret n\'est pas en statut defaut.');
        }

        $arriere = (float) $pret->capital_restant;
        $regularise = (float) ($data['montant_regularise'] ?? 0);

        if ($arriere > 0 && $regularise < ($arriere * 0.5)) {
            throw new RuntimeException('Le montant regularise doit representer au moins 50% de l\'arrearre.');
        }

        $pret->forceFill(['statut' => 'en_cours'])->save();
        $pret->emprunteur->forceFill([
            'statut' => 'actif',
            'motif_suspension' => null,
        ])->save();

        return $pret->refresh();
    }

    public function appliquerPenalites(Pret $pret): void
    {
        if (! in_array($pret->statut, ['en_cours', 'en_retard'])) {
            return;
        }

        $taux = (float) ($pret->taux_penalite_mensuel ?? $pret->caisse->taux_penalite_mensuel ?? 0.02);
        $notif = false;

        foreach ($pret->echeances()->whereIn('statut', ['due', 'partielle', 'en_retard'])->get() as $echeance) {
            $date = Carbon::parse($echeance->date_echeance);
            if ($date->isPast() && $date->diffInHours(now()) > 24) {
                if ($echeance->statut !== 'en_retard') {
                    $echeance->forceFill(['statut' => 'en_retard'])->save();
                }

                $jours = $date->diffInDays(now());
                $penalite = round((float) $pret->capital_restant * $taux * ($jours / 30), 2);
                $echeance->forceFill(['montant_penalite' => $penalite])->save();

                if (! $notif) {
                    $this->notificationService->notifierEcheanceRetard(
                        $pret->caisse->association_id,
                        $pret->emprunteur_id,
                        $pret->id,
                        $echeance->date_echeance,
                        (float) $echeance->montant_total
                    );
                    $notif = true;
                }
            }
        }

        if ($pret->echeances()->where('statut', 'en_retard')->exists() && $pret->statut === 'en_cours') {
            $pret->forceFill(['statut' => 'en_retard'])->save();
        }
    }

    public function genererAmortissement(Pret $pret): void
    {
        if ($pret->echeances()->exists()) {
            return;
        }

        $capital = round((float) $pret->montant_principal / (int) $pret->nb_echeances, 2);
        $interet = round((float) $pret->interet_total / (int) $pret->nb_echeances, 2);
        $restant = (float) $pret->montant_total_du;
        $dateDebut = Carbon::parse($pret->date_debut ?? $pret->date_approbation ?? now());

        for ($i = 1; $i <= (int) $pret->nb_echeances; $i++) {
            $total = round($capital + $interet, 2);
            $restant = max(0, round($restant - $total, 2));

            EcheancePret::create([
                'pret_id' => $pret->id,
                'numero_echeance' => $i,
                'date_echeance' => $dateDebut->copy()->addMonths($i)->toDateString(),
                'montant_capital' => $capital,
                'montant_interet' => $interet,
                'montant_total' => $total,
                'montant_verse' => 0,
                'montant_penalite' => 0,
                'capital_restant_apres' => $restant,
                'statut' => 'due',
            ]);
        }
    }

    private function recalculerEcheancesFutures(Pret $pret): void
    {
        $reste = $pret->echeances()->whereIn('statut', ['due', 'partielle', 'en_retard'])->orderBy('numero_echeance')->get();
        $nb = $reste->count();
        if ($nb === 0) {
            return;
        }

        $capital = (float) $pret->capital_restant;
        $taux = (float) $pret->taux_interet_mensuel;
        $interet = round($capital * $taux * $nb, 2);
        $total = round($capital + $interet, 2);
        $mensualite = round($total / $nb, 2);
        $restant = $total;

        foreach ($reste as $echeance) {
            $restant = max(0, round($restant - $mensualite, 2));
            $echeance->forceFill([
                'montant_capital' => round($capital / $nb, 2),
                'montant_interet' => round($interet / $nb, 2),
                'montant_total' => $mensualite,
                'capital_restant_apres' => $restant,
            ])->save();
        }
    }
}
