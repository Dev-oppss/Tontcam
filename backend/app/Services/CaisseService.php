<?php

namespace App\Services;

use App\Models\Caisse;
use App\Models\Transaction;
use App\Models\Utilisateur;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Auth;
use RuntimeException;

/**
 * Toute écriture financière passe par ce service : jamais de modification
 * directe de caisses.solde_actuel en dehors d'une Transaction journalisée.
 */
class CaisseService
{
    private function optionsTransaction(array $options, string $type): array
    {
        $valide = $options['valide'] ?? true;
        $validePar = $options['valide_par'] ?? Auth::id();
        if ($valide && ! $validePar) {
            throw new RuntimeException('Une transaction validée doit avoir un valideur.');
        }

        return [
            'type' => $options['type'] ?? $type,
            'mode_paiement' => $options['mode_paiement'] ?? 'especes',
            'valide' => $valide,
            'valide_par' => $validePar,
        ];
    }

    public function entree(Caisse $caisse, float $montant, string $libelle, array $options = []): Transaction
    {
        if ($montant <= 0) {
            throw new RuntimeException('Le montant doit être positif.');
        }

        return DB::transaction(function () use ($caisse, $montant, $libelle, $options) {
            $meta = $this->optionsTransaction($options, 'entree');
            $caisse = Caisse::query()->lockForUpdate()->findOrFail($caisse->id);
            $soldeAvant = (float) $caisse->solde_actuel;
            $soldeApres = $soldeAvant + $montant;

            $transaction = Transaction::create([
                'caisse_id' => $caisse->id,
                'type' => $meta['type'],
                'montant' => $montant,
                'solde_avant' => $soldeAvant,
                'solde_apres' => $soldeApres,
                'libelle' => $libelle,
                'date_transaction' => $options['date'] ?? now(),
                'mode_paiement' => $meta['mode_paiement'],
                'cheque_numero' => $options['cheque_numero'] ?? null,
                'reference_externe' => $options['reference_externe'] ?? null,
                'reference_type' => $options['reference_type'] ?? null,
                'reference_id' => $options['reference_id'] ?? null,
                'valide' => $meta['valide'],
                'valide_par' => $meta['valide_par'],
                'valide_at' => $meta['valide'] ? now() : null,
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
            $meta = $this->optionsTransaction($options, 'sortie');
            $caisse = Caisse::query()->lockForUpdate()->findOrFail($caisse->id);
            $soldeAvant = (float) $caisse->solde_actuel;
            $soldeApres = $soldeAvant - $montant;

            // Contrainte DB caisses_solde_positif_ck : jamais de solde négatif
            if ($soldeApres < 0) {
                throw new RuntimeException("Solde insuffisant dans la caisse « {$caisse->libelle} » (disponible : {$soldeAvant}).");
            }

            $transaction = Transaction::create([
                'caisse_id' => $caisse->id,
                'type' => $meta['type'],
                'montant' => $montant,
                'solde_avant' => $soldeAvant,
                'solde_apres' => $soldeApres,
                'libelle' => $libelle,
                'date_transaction' => $options['date'] ?? now(),
                'mode_paiement' => $meta['mode_paiement'],
                'cheque_numero' => $options['cheque_numero'] ?? null,
                'reference_externe' => $options['reference_externe'] ?? null,
                'reference_type' => $options['reference_type'] ?? null,
                'reference_id' => $options['reference_id'] ?? null,
                'valide' => $meta['valide'],
                'valide_par' => $meta['valide_par'],
                'valide_at' => $meta['valide'] ? now() : null,
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
    public function transfert(Caisse $source, Caisse $destination, float $montant, string $motif, ?Utilisateur $approbateur = null, array $options = []): array
    {
        if ($source->id === $destination->id) {
            throw new RuntimeException('Caisse source et destination identiques.');
        }
        if ($source->association_id !== $destination->association_id) {
            throw new RuntimeException('Transfert impossible entre deux associations différentes.');
        }

        return DB::transaction(function () use ($source, $destination, $montant, $motif, $approbateur, $options) {
            $txSource = $this->sortie($source, $montant, "Transfert vers {$destination->libelle} — {$motif}", [
                'type' => 'transfert_sortant', 'reference_type' => 'transfert_caisse', 'created_by' => $options['created_by'] ?? $approbateur?->id, 'valide_par' => $options['valide_par'] ?? $approbateur?->id, 'date' => $options['date'] ?? now(),
            ]);

            $txDest = $this->entree($destination, $montant, "Transfert depuis {$source->libelle} — {$motif}", [
                'type' => 'transfert_entrant', 'reference_type' => 'transfert_caisse', 'created_by' => $options['created_by'] ?? $approbateur?->id, 'valide_par' => $options['valide_par'] ?? $approbateur?->id, 'date' => $options['date'] ?? now(),
            ]);

            $transfert = $options['transfert'] ?? \App\Models\TransfertCaisse::create([
                'caisse_source_id' => $source->id,
                'caisse_destination_id' => $destination->id,
                'montant' => $montant,
                'motif' => $motif,
                'statut' => 'execute',
                'demande_par' => $options['demande_par'] ?? $approbateur?->id,
                'demande_at' => $options['demande_at'] ?? now(),
                'approuve_par' => $approbateur?->id,
                'approuve_at' => now(),
                'transaction_source_id' => $txSource->id,
                'transaction_dest_id' => $txDest->id,
            ]);
            if ($options['transfert'] ?? false) {
                $transfert->update([
                    'statut' => 'execute', 'transaction_source_id' => $txSource->id,
                    'transaction_dest_id' => $txDest->id, 'approuve_par' => $approbateur?->id,
                    'approuve_at' => now(),
                ]);
            }

            return ['transfert' => $transfert, 'transaction_source' => $txSource, 'transaction_destination' => $txDest];
        });
    }

    /**
     * Ajustement manuel (écart justifié suite à rapprochement bancaire — RG-CAI-018).
     */
    public function corriger(Caisse $caisse, float $ecart, string $motif, ?Utilisateur $auteur = null): Transaction
    {
        if ($ecart === 0.0) throw new RuntimeException('Aucun écart à corriger.');

        $options = [
            'reference_type' => 'ajustement_rapprochement',
            'created_by' => $auteur?->id,
            'valide_par' => $auteur?->id,
            'notes' => $motif,
        ];
        $libelle = "Écriture corrective de rapprochement : {$motif}";

        return $ecart > 0
            ? $this->entree($caisse, $ecart, $libelle, $options)
            : $this->sortie($caisse, abs($ecart), $libelle, $options);
    }
}
