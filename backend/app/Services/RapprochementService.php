<?php

namespace App\Services;

use App\Models\Caisse;
use App\Models\CompteBancaire;
use App\Models\RapprochementBancaire;
use App\Models\Utilisateur;
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
}
