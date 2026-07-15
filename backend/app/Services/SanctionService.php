<?php

namespace App\Services;

use App\Models\EcheancePret;
use App\Models\Membre;
use App\Models\Pret;
use App\Models\Reunion;
use App\Models\SanctionMembre;
use App\Models\TypeSanction;
use App\Models\Utilisateur;
use RuntimeException;

class SanctionService
{
    public function appliquerManuelle(Membre $membre, TypeSanction $type, string $motif, Utilisateur $appliquePar, ?Reunion $reunion = null): SanctionMembre
    {
        return SanctionMembre::create([
            'association_id' => $membre->association_id,
            'membre_id' => $membre->id,
            'type_sanction_id' => $type->id,
            'reunion_id' => $reunion?->id,
            'montant' => $this->calculerMontant($type),
            'motif' => $motif,
            'statut' => 'due',
            'est_automatique' => false,
            'appliquee_par' => $appliquePar->id,
        ]);
    }

    /**
     * Déclenchement auto lors d'une absence non excusée en réunion.
     */
    public function absenceNonExcusee(Membre $membre, Reunion $reunion): ?SanctionMembre
    {
        $type = TypeSanction::where('association_id', $membre->association_id)
            ->where('declencheur', 'absence_non_excusee')
            ->where('est_automatique', true)
            ->first();

        if (! $type) {
            return null;
        }

        // Évite le doublon si la sanction existe déjà pour cette réunion
        $existe = SanctionMembre::where('membre_id', $membre->id)
            ->where('reunion_id', $reunion->id)
            ->where('type_sanction_id', $type->id)
            ->exists();
        if ($existe) {
            return null;
        }

        return SanctionMembre::create([
            'association_id' => $membre->association_id,
            'membre_id' => $membre->id,
            'type_sanction_id' => $type->id,
            'reunion_id' => $reunion->id,
            'montant' => $this->calculerMontant($type),
            'motif' => "Absence non excusée — réunion n°{$reunion->numero}",
            'statut' => 'due',
            'est_automatique' => true,
        ]);
    }

    /**
     * Déclenchement auto sur cotisation en retard (à appeler à la clôture d'un cycle).
     */
    public function retardCotisation(Membre $membre, \App\Models\CotisationTontine $cotisation): ?SanctionMembre
    {
        $type = TypeSanction::where('association_id', $membre->association_id)
            ->where('declencheur', 'retard_cotisation')
            ->where('est_automatique', true)
            ->first();

        if (! $type) {
            return null;
        }

        $montant = $type->mode_calcul === 'journalier'
            ? (float) $type->montant_journalier * max(1, now()->diffInDays($cotisation->cycle->date_ouverture ?? now()))
            : $this->calculerMontant($type);

        return SanctionMembre::create([
            'association_id' => $membre->association_id,
            'membre_id' => $membre->id,
            'type_sanction_id' => $type->id,
            'montant' => $montant,
            'motif' => 'Retard de cotisation',
            'statut' => 'due',
            'est_automatique' => true,
            'reference_type' => 'cotisation_tontine',
            'reference_id' => $cotisation->id,
        ]);
    }

    /**
     * Déclenchement auto sur échéance de prêt en retard (RG-PRT-020).
     */
    public function retardPret(Pret $pret, EcheancePret $echeance): ?SanctionMembre
    {
        $type = TypeSanction::where('association_id', $pret->caisse->association_id)
            ->where('declencheur', 'retard_pret')
            ->where('est_automatique', true)
            ->first();

        $membre = $pret->emprunteur;

        // Pénalité de retard = Capital_restant × taux_pénalité_mensuel × nb_mois_retard
        $moisRetard = max(1, now()->diffInMonths($echeance->date_echeance) + 1);
        $penalite = round((float) $pret->capital_restant * (float) $pret->taux_penalite_mensuel * $moisRetard, 2);

        $echeance->update([
            'statut' => 'penalisee',
            'montant_penalite' => $penalite,
        ]);

        if (! $type) {
            return null;
        }

        return SanctionMembre::create([
            'association_id' => $membre->association_id,
            'membre_id' => $membre->id,
            'type_sanction_id' => $type->id,
            'montant' => $penalite,
            'motif' => "Retard échéance n°{$echeance->numero_echeance} du prêt",
            'statut' => 'due',
            'est_automatique' => true,
            'reference_type' => 'echeance_pret',
            'reference_id' => $echeance->id,
        ]);
    }

    private function calculerMontant(TypeSanction $type): float
    {
        return match ($type->mode_calcul) {
            'fixe' => (float) $type->montant_fixe,
            'journalier' => (float) $type->montant_journalier,
            'pourcentage' => throw new RuntimeException('Le mode pourcentage nécessite une base de calcul explicite.'),
            default => 0.0,
        };
    }
}
