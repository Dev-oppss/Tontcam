<?php

namespace App\Services;

use App\Models\Caisse;
use App\Models\Transaction;
use App\Models\Utilisateur;
use Illuminate\Support\Facades\DB;
use RuntimeException;

/**
 * Toute écriture financière passe par ce service : jamais de modification
 * directe de caisses.solde_actuel en dehors d'une Transaction journalisée.
 */
class CaisseService
{
    public function entree(Caisse $caisse, float $montant, string $libelle, array $options = []): Transaction
    {
        if ($montant <= 0) {
            throw new RuntimeException('Le montant doit être positif.');
        }

        return DB::transaction(function () use ($caisse, $montant, $libelle, $options) {
            $caisse->refresh();
            $soldeAvant = (float) $caisse->solde_actuel;
            $soldeApres = $soldeAvant + $montant;

            $transaction = Transaction::create([
                'caisse_id' => $caisse->id,
                'type' => 'entree',
                'montant' => $montant,
                'solde_avant' => $soldeAvant,
                'solde_apres' => $soldeApres,
                'libelle' => $libelle,
                'date_transaction' => $options['date'] ?? now(),
                'mode_paiement' => $options['mode_paiement'] ?? null,
                'cheque_numero' => $options['cheque_numero'] ?? null,
                'reference_type' => $options['reference_type'] ?? null,
                'reference_id' => $options['reference_id'] ?? null,
                'valide' => $options['valide'] ?? true,
                'valide_par' => $options['valide_par'] ?? null,
                'valide_at' => ($options['valide'] ?? true) ? now() : null,
                'notes' => $options['notes'] ?? null,
                'created_by' => $options['created_by'] ?? null,
            ]);

            $caisse->update(['solde_actuel' => $soldeApres]);

            return $transaction;
        });
    }

    public function sortie(Caisse $caisse, float $montant, string $libelle, array $options = []): Transaction
    {
        if ($montant <= 0) {
            throw new RuntimeException('Le montant doit être positif.');
        }

        return DB::transaction(function () use ($caisse, $montant, $libelle, $options) {
            $caisse->refresh();
            $soldeAvant = (float) $caisse->solde_actuel;
            $soldeApres = $soldeAvant - $montant;

            // Contrainte DB caisses_solde_positif_ck : jamais de solde négatif
            if ($soldeApres < 0) {
                throw new RuntimeException("Solde insuffisant dans la caisse « {$caisse->libelle} » (disponible : {$soldeAvant}).");
            }

            $transaction = Transaction::create([
                'caisse_id' => $caisse->id,
                'type' => 'sortie',
                'montant' => $montant,
                'solde_avant' => $soldeAvant,
                'solde_apres' => $soldeApres,
                'libelle' => $libelle,
                'date_transaction' => $options['date'] ?? now(),
                'mode_paiement' => $options['mode_paiement'] ?? null,
                'cheque_numero' => $options['cheque_numero'] ?? null,
                'reference_type' => $options['reference_type'] ?? null,
                'reference_id' => $options['reference_id'] ?? null,
                'valide' => $options['valide'] ?? true,
                'valide_par' => $options['valide_par'] ?? null,
                'valide_at' => ($options['valide'] ?? true) ? now() : null,
                'notes' => $options['notes'] ?? null,
                'created_by' => $options['created_by'] ?? null,
            ]);

            $caisse->update(['solde_actuel' => $soldeApres]);

            return $transaction;
        });
    }

    /**
     * Transfert atomique entre deux caisses de la même association.
     */
    public function transfert(Caisse $source, Caisse $destination, float $montant, string $motif, ?Utilisateur $approbateur = null): array
    {
        if ($source->id === $destination->id) {
            throw new RuntimeException('Caisse source et destination identiques.');
        }
        if ($source->association_id !== $destination->association_id) {
            throw new RuntimeException('Transfert impossible entre deux associations différentes.');
        }

        return DB::transaction(function () use ($source, $destination, $montant, $motif, $approbateur) {
            $txSource = $this->sortie($source, $montant, "Transfert vers {$destination->libelle} — {$motif}", [
                'reference_type' => 'transfert_caisse',
            ]);
            $txSource->update(['type' => 'transfert_sortant']);

            $txDest = $this->entree($destination, $montant, "Transfert depuis {$source->libelle} — {$motif}", [
                'reference_type' => 'transfert_caisse',
            ]);
            $txDest->update(['type' => 'transfert_entrant']);

            $transfert = \App\Models\TransfertCaisse::create([
                'caisse_source_id' => $source->id,
                'caisse_destination_id' => $destination->id,
                'montant' => $montant,
                'transaction_source_id' => $txSource->id,
                'transaction_dest_id' => $txDest->id,
                'motif' => $motif,
                'approuve_par' => $approbateur?->id,
            ]);

            return ['transfert' => $transfert, 'transaction_source' => $txSource, 'transaction_destination' => $txDest];
        });
    }

    /**
     * Ajustement manuel (écart justifié suite à rapprochement bancaire — RG-CAI-018).
     */
    public function corriger(Caisse $caisse, float $ecart, string $motif, ?Utilisateur $auteur = null): Transaction
    {
        return DB::transaction(function () use ($caisse, $ecart, $motif, $auteur) {
            $caisse->refresh();
            $soldeAvant = (float) $caisse->solde_actuel;
            $soldeApres = $soldeAvant + $ecart;

            if ($soldeApres < 0) {
                throw new RuntimeException('Cet ajustement rendrait le solde négatif.');
            }

            $transaction = Transaction::create([
                'caisse_id' => $caisse->id,
                'type' => 'ajustement',
                'montant' => abs($ecart),
                'solde_avant' => $soldeAvant,
                'solde_apres' => $soldeApres,
                'libelle' => "Ajustement rapprochement bancaire : {$motif}",
                'date_transaction' => now(),
                'valide' => true,
                'valide_par' => $auteur?->id,
                'valide_at' => now(),
                'created_by' => $auteur?->id,
            ]);

            $caisse->update(['solde_actuel' => $soldeApres]);

            return $transaction;
        });
    }
}
