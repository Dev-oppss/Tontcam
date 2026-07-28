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

    /**
     * Import historique (super_admin uniquement) : applique une sanction avec sa vraie date
     * passée (created_at forcé), au lieu de la date du jour comme le ferait appliquerManuelle().
     * Si la sanction était déjà payée dans la réalité, rejoue aussi l'entrée en caisse
     * correspondante à sa date historique.
     */
    public function importerHistorique(Membre $membre, TypeSanction $type, string $motif, string $dateApplication, Utilisateur $superAdmin, ?Reunion $reunion = null, ?array $paiement = null): SanctionMembre
    {
        if ($superAdmin->role !== 'super_admin') {
            throw new RuntimeException("L'import historique de sanctions est réservé au super_admin.");
        }

        $sanction = SanctionMembre::create([
            'association_id' => $membre->association_id,
            'membre_id' => $membre->id,
            'type_sanction_id' => $type->id,
            'reunion_id' => $reunion?->id,
            'montant' => $this->calculerMontant($type),
            'motif' => trim($motif . ' [Importé — historique pré-app]'),
            'statut' => $paiement ? 'payee' : 'due',
            'est_automatique' => false,
            'appliquee_par' => $superAdmin->id,
            'payee_at' => $paiement ? ($paiement['date'] ?? $dateApplication) : null,
        ]);

        // created_at n'est pas mass-assignable par défaut : on le force explicitement
        // pour que la sanction apparaisse à sa vraie date dans l'historique, pas à aujourd'hui.
        $sanction->timestamps = false;
        $sanction->created_at = $dateApplication;
        $sanction->updated_at = $paiement['date'] ?? $dateApplication;
        $sanction->save();

        if ($paiement && ! empty($paiement['caisse_id'])) {
            $transaction = app(CaisseService::class)->entree(
                \App\Models\Caisse::findOrFail($paiement['caisse_id']),
                (float) $sanction->montant,
                "Paiement sanction (import historique) — {$membre->nom} {$membre->prenom}",
                ['reference_type' => 'sanction', 'reference_id' => $sanction->id, 'created_by' => $superAdmin->id, 'valide_par' => $superAdmin->id, 'date' => $paiement['date'] ?? $dateApplication]
            );
            $sanction->update(['transaction_id' => $transaction->id]);
        }

        return $sanction;
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
