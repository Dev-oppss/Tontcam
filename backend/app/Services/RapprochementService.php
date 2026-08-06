<?php

namespace App\Services;

use App\Models\Caisse;
use App\Models\CompteBancaire;
use App\Models\RapprochementBancaire;
use App\Models\Utilisateur;
use App\Models\Membre;
use Illuminate\Support\Carbon;
use RuntimeException;

class RapprochementService
{
    /**
     * Compare le solde logiciel (caisse) au solde du relevé bancaire importé (RG-CAI-017/018).
     */
    public function comparer(CompteBancaire $compte, Caisse $caisse, float $soldeBanque, string $periodeDebut, string $periodeFin): RapprochementBancaire
    {
        if ($caisse->compte_bancaire_id !== $compte->id) {
            throw new RuntimeException('Cette caisse n\'est pas rattachée à ce compte bancaire.');
        }

        return RapprochementBancaire::create([
            'compte_bancaire_id' => $compte->id,
            'caisse_id' => $caisse->id,
            'periode_debut' => $periodeDebut,
            'periode_fin' => $periodeFin,
            'solde_banque' => $soldeBanque,
            'solde_logiciel' => (float) $caisse->solde_actuel,
        ]);
    }

    public function ecart(RapprochementBancaire $rapprochement): float
    {
        return round((float) $rapprochement->solde_banque - (float) $rapprochement->solde_logiciel, 2);
    }

    /**
     * Justification de l'écart par le Trésorier (RG-CAI-018), avec ajustement optionnel
     * du solde logiciel via CaisseService::corriger() si l'écart est confirmé réel.
     */
    public function justifier(RapprochementBancaire $rapprochement, string $motif, Utilisateur $tresorier, bool $ajusterSolde = false): RapprochementBancaire
    {
        if (Carbon::parse($rapprochement->periode_fin)->addDays(30)->isPast()) {
            throw new RuntimeException('Le délai de 30 jours pour justifier cet écart est dépassé.');
        }
        $ecart = $this->ecart($rapprochement);

        if ($ajusterSolde && $ecart !== 0.0) {
            app(CaisseService::class)->corriger($rapprochement->caisse, $ecart, $motif, $tresorier);
        }

        $rapprochement->update([
            'justification' => $motif,
            'valide_par' => $tresorier->id,
            'valide_at' => now(),
        ]);

        return $rapprochement;
    }

    /**
     * Écarts non justifiés depuis plus de 30 jours → alerte Président (RG-CAI-019).
     */
    public function ecartsEnRetard(string $associationId): \Illuminate\Support\Collection
    {
        return RapprochementBancaire::whereHas('caisse', fn ($q) => $q->where('association_id', $associationId))
            ->whereNull('valide_at')
            ->get()
            ->filter(fn ($r) => $this->ecart($r) !== 0.0 && now()->diffInDays($r->periode_fin) > 30);
    }

    /** Crée une alerte in-app unique pour chaque écart dépassant le délai. */
    public function notifierEcartsEnRetard(string $associationId): int
    {
        $presidents = Membre::where('association_id', $associationId)
            ->whereHas('utilisateur', fn ($q) => $q->where('role', 'president')->where('actif', true))
            ->get();
        $notifier = app(NotificationService::class);
        $nombre = 0;

        foreach ($this->ecartsEnRetard($associationId)->whereNull('alerte_envoyee_at') as $rapprochement) {
            if ($presidents->isEmpty()) continue;
            foreach ($presidents as $president) {
                $notifier->journaliser(
                    $associationId, $president, 'push', 'ecart_rapprochement_retard',
                    "Écart bancaire non justifié depuis plus de 30 jours pour la caisse {$rapprochement->caisse->libelle}.",
                    now(), 'Alerte rapprochement bancaire'
                );
            }
            $rapprochement->update(['alerte_envoyee_at' => now()]);
            $nombre++;
        }

        return $nombre;
    }
}
