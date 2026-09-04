<?php

namespace App\Services;

use App\Models\Caisse;
use App\Models\EpargneMouvement;
use App\Models\Membre;
use App\Models\Pret;
use App\Models\PretEpargneSnapshot;
use App\Models\Utilisateur;
use Illuminate\Support\Facades\DB;
use RuntimeException;

/**
 * Module épargne (RG-EPA) : caisse "tirelire commune" — chaque membre
 * dépose ce qu'il veut, quand il veut. Solde calculé à la volée, jamais
 * stocké (même principe que RemiseGainService pour la cagnotte tontine).
 * Voir la migration add_epargne_module pour le détail des règles.
 */
class EpargneService
{
    public function soldeMembre(Caisse $caisse, string $membreId): float
    {
        $mouvements = EpargneMouvement::where('caisse_id', $caisse->id)->where('membre_id', $membreId)
            ->selectRaw("type, SUM(montant) as total")->groupBy('type')->pluck('total', 'type');

        $solde = (float) ($mouvements['depot'] ?? 0) + (float) ($mouvements['interet'] ?? 0)
            - (float) ($mouvements['retrait'] ?? 0) - (float) ($mouvements['retrait_garantie'] ?? 0);

        return round($solde, 2);
    }

    /** Tous les membres ayant un solde > 0 dans cette caisse épargne. */
    public function soldes(Caisse $caisse): array
    {
        $membreIds = EpargneMouvement::where('caisse_id', $caisse->id)->distinct()->pluck('membre_id');

        return $membreIds->map(fn ($id) => ['membre_id' => $id, 'solde' => $this->soldeMembre($caisse, $id)])
            ->filter(fn ($l) => $l['solde'] > 0)
            ->map(function ($l) {
                $membre = Membre::find($l['membre_id']);
                return ['membre_id' => $l['membre_id'], 'membre_nom' => $membre ? "{$membre->nom} {$membre->prenom}" : null, 'solde' => $l['solde']];
            })->values()->all();
    }

    public function deposer(Caisse $caisse, string $membreId, float $montant, ?string $modePaiement, Utilisateur $auteur): EpargneMouvement
    {
        if (! $caisse->suivi_epargne) {
            throw new RuntimeException('Le suivi épargne n’est pas activé sur cette caisse.');
        }
        if ($montant <= 0) {
            throw new RuntimeException('Le montant du dépôt doit être positif.');
        }

        return DB::transaction(function () use ($caisse, $membreId, $montant, $modePaiement, $auteur) {
            $membre = Membre::findOrFail($membreId);
            $transaction = app(CaisseService::class)->entree($caisse, $montant, "Dépôt épargne — {$membre->nom} {$membre->prenom}", [
                'mode_paiement' => $modePaiement ?? 'especes',
                'reference_type' => 'epargne_depot',
                'created_by' => $auteur->id, 'valide_par' => $auteur->id,
            ]);

            return EpargneMouvement::create([
                'caisse_id' => $caisse->id, 'membre_id' => $membreId, 'type' => 'depot',
                'montant' => $montant, 'transaction_id' => $transaction->id, 'created_by' => $auteur->id,
            ]);
        });
    }

    /**
     * Cassation générale : rembourse CHAQUE membre de la totalité de son
     * solde, en une fois — pas une sélection de bénéficiaires (contrairement
     * à la remise de gains cagnotte). Ramène tous les soldes à 0.
     */
    public function cassationGenerale(Caisse $caisse, Utilisateur $auteur): array
    {
        if (! $caisse->suivi_epargne) {
            throw new RuntimeException('Le suivi épargne n’est pas activé sur cette caisse.');
        }

        return DB::transaction(function () use ($caisse, $auteur) {
            $caisseService = app(CaisseService::class);
            $mouvements = [];

            foreach ($this->soldes($caisse) as $ligne) {
                $membre = Membre::find($ligne['membre_id']);
                $transaction = $caisseService->sortie($caisse, $ligne['solde'], "Cassation générale épargne — {$membre->nom} {$membre->prenom}", [
                    'reference_type' => 'epargne_cassation', 'created_by' => $auteur->id, 'valide_par' => $auteur->id,
                ]);
                $mouvements[] = EpargneMouvement::create([
                    'caisse_id' => $caisse->id, 'membre_id' => $ligne['membre_id'], 'type' => 'retrait',
                    'montant' => $ligne['solde'], 'transaction_id' => $transaction->id, 'created_by' => $auteur->id,
                ]);
            }

            return $mouvements;
        });
    }

    /**
     * Photo figée des soldes de tous les membres au moment du décaissement
     * d'un prêt financé par une caisse épargne — sert de base au partage de
     * l'intérêt plus tard, quel que soit le mouvement des soldes entre-temps
     * (demande client explicite : "ça se calcule au moment où l'argent a été
     * prêté, c'est évident").
     */
    public function snapshotPourPret(Pret $pret): void
    {
        if (! $pret->caisse?->suivi_epargne) {
            return;
        }
        foreach ($this->soldes($pret->caisse) as $ligne) {
            PretEpargneSnapshot::updateOrCreate(
                ['pret_id' => $pret->id, 'membre_id' => $ligne['membre_id']],
                ['solde_snapshot' => $ligne['solde']]
            );
        }
    }

    /**
     * Partage l'intérêt perçu sur une échéance de prêt entre les membres, au
     * prorata de leur solde snapshotté au décaissement. L'intérêt reste EN
     * caisse (il a déjà été encaissé via le remboursement normal du prêt) —
     * on crédite seulement le compte de chaque membre, sans nouveau
     * mouvement de caisse.
     */
    public function distribuerInteret(Pret $pret, float $montantInteret): void
    {
        if ($montantInteret <= 0) {
            return;
        }
        $snapshots = PretEpargneSnapshot::where('pret_id', $pret->id)->get();
        $total = (float) $snapshots->sum('solde_snapshot');
        if ($total <= 0) {
            return;
        }

        foreach ($snapshots as $s) {
            $part = round($montantInteret * ((float) $s->solde_snapshot / $total), 2);
            if ($part <= 0) {
                continue;
            }
            EpargneMouvement::create([
                'caisse_id' => $pret->caisse_id, 'membre_id' => $s->membre_id, 'type' => 'interet',
                'montant' => $part, 'pret_id' => $pret->id,
                'motif' => "Part d'intérêt — prêt {$pret->emprunteur?->nom} {$pret->emprunteur?->prenom}",
            ]);
        }
    }

    /**
     * Coupe manuellement sur le solde épargne d'un membre pour couvrir une
     * garantie de prêt (garantie_type = blocage_epargne) — décision du
     * trésorier au cas par cas, jamais automatique au constat de défaut.
     */
    public function couperGarantie(Caisse $caisse, string $membreId, float $montant, ?string $motif, ?Pret $pret, Utilisateur $auteur): EpargneMouvement
    {
        $solde = $this->soldeMembre($caisse, $membreId);
        if ($montant <= 0 || $montant > $solde + 0.01) {
            throw new RuntimeException("Montant demandé ({$montant}) supérieur au solde épargne disponible ({$solde}).");
        }

        return EpargneMouvement::create([
            'caisse_id' => $caisse->id, 'membre_id' => $membreId, 'type' => 'retrait_garantie',
            'montant' => $montant, 'pret_id' => $pret?->id, 'motif' => $motif ?? 'Garantie de prêt', 'created_by' => $auteur->id,
        ]);
    }
}
