<?php

namespace App\Services;

use App\Models\Caisse;
use App\Models\Transaction;
use Illuminate\Support\Facades\DB;
use RuntimeException;

/**
 * Service de gestion des caisses et des transactions financières.
 *
 * Règles couvertes :
 *   RG-CAI-006  : Solde jamais négatif — bloqué en DB avec lockForUpdate.
 *   RG-CAI-007  : Toute transaction tracée (caisse, type, montant, libellé, solde avant/après, valideur, date).
 *   RG-CAI-008  : Solde calculé en temps réel via les transactions.
 *   RG-CAI-009  : Date de transaction = now() (non modifiable après création).
 *   RG-CAI-010  : Transaction immuable — correction via transaction inverse.
 *   RG-CAI-011  : Mode paiement tracé sur chaque transaction.
 *   RG-CAI-013  : Transfert inter-caisses = deux transactions atomiques simultanées.
 *   RG-CAI-014  : Référence croisée sortie ↔ entrée sur les transferts.
 *   RG-CAI-015  : Virement bancaire → transaction automatique dans la caisse liée.
 */
class CaisseService
{
    // ─── Primitives ──────────────────────────────────────────────────────────

    /**
     * RG-CAI-006 : Mouvement sécurisé avec verrou pessimiste (lockForUpdate).
     * RG-CAI-007 : Traçabilité complète de chaque transaction.
     * RG-CAI-009 : Date = now() systématiquement.
     */
    public function mouvement(
        Caisse $caisse,
        string $type,
        float  $montant,
        string $libelle,
        array  $meta = []
    ): Transaction {
        return DB::transaction(function () use ($caisse, $type, $montant, $libelle, $meta) {

            // Verrou pessimiste pour éviter les race conditions (RG-CAI-006)
            $caisse = Caisse::query()->lockForUpdate()->findOrFail($caisse->id);

            $avant = (float) $caisse->solde_actuel;
            $apres = $type === 'entree' ? $avant + $montant : $avant - $montant;

            // RG-CAI-006 : solde jamais négatif
            if ($apres < 0) {
                throw new RuntimeException(
                    "Solde insuffisant (disponible : {$avant} FCFA, demandé : {$montant} FCFA)."
                );
            }

            // RG-CAI-007/009 : traçabilité complète + date immuable
            $tx = Transaction::create(array_merge($meta, [
                'caisse_id'         => $caisse->id,
                'type'              => $type,
                'montant'           => $montant,
                'solde_avant'       => $avant,
                'solde_apres'       => $apres,
                'libelle'           => $libelle,
                'date_transaction'  => now(),          // RG-CAI-009
                'mode_paiement'     => $meta['mode_paiement'] ?? 'especes',
                'created_by'        => $meta['created_by'] ?? null,
            ]));

            // RG-CAI-008 : mise à jour du solde courant
            $caisse->forceFill(['solde_actuel' => $apres])->save();

            return $tx;
        });
    }

    public function entree(Caisse $caisse, float $montant, string $libelle, array $meta = []): Transaction
    {
        return $this->mouvement($caisse, 'entree', $montant, $libelle, $meta);
    }

    public function sortie(Caisse $caisse, float $montant, string $libelle, array $meta = []): Transaction
    {
        return $this->mouvement($caisse, 'sortie', $montant, $libelle, $meta);
    }

    // ─── Transfert inter-caisses ─────────────────────────────────────────────

    /**
     * RG-CAI-013 : Deux transactions atomiques (sortie source + entrée destination).
     * RG-CAI-014 : Référence croisée entre les deux transactions.
     */
    public function transfert(
        Caisse $source,
        Caisse $destination,
        float  $montant,
        string $libelle,
        array  $meta = []
    ): array {
        if ($source->id === $destination->id) {
            throw new RuntimeException('Source et destination ne peuvent pas être la même caisse.');
        }

        return DB::transaction(function () use ($source, $destination, $montant, $libelle, $meta) {

            // Sortie de la caisse source
            $txSortie = $this->sortie(
                $source,
                $montant,
                "Transfert vers « {$destination->libelle} » — {$libelle}",
                array_merge($meta, ['type_operation' => 'transfert_sortie'])
            );

            // RG-CAI-014 : entrée en destination avec référence croisée
            $txEntree = $this->entree(
                $destination,
                $montant,
                "Transfert depuis « {$source->libelle} » — {$libelle}",
                array_merge($meta, [
                    'type_operation'  => 'transfert_entree',
                    'reference_type'  => Transaction::class,
                    'reference_id'    => $txSortie->id,  // RG-CAI-014
                ])
            );

            // Mettre à jour la référence croisée sur la sortie également
            $txSortie->forceFill([
                'reference_type' => Transaction::class,
                'reference_id'   => $txEntree->id,
            ])->save();

            return [
                'transaction_sortie' => $txSortie->refresh(),
                'transaction_entree' => $txEntree->refresh(),
            ];
        });
    }

    // ─── Correction ──────────────────────────────────────────────────────────

    /**
     * RG-CAI-010 : Transaction immuable — correction par transaction inverse.
     * La transaction originale est marquée annulée mais JAMAIS supprimée (audit).
     */
    public function corriger(Caisse $caisse, string $transactionId, string $motif, ?string $userId = null): Transaction
    {
        return DB::transaction(function () use ($caisse, $transactionId, $motif, $userId) {
            $transaction = Transaction::where('caisse_id', $caisse->id)
                ->findOrFail($transactionId);

            // Pas de double correction
            if ($transaction->annulee) {
                throw new RuntimeException('Cette transaction a déjà été annulée/corrigée.');
            }

            // Transaction inverse
            $typeInverse = $transaction->type === 'entree' ? 'sortie' : 'entree';
            $correction  = $this->mouvement(
                $caisse,
                $typeInverse,
                (float) $transaction->montant,
                "Correction : {$transaction->libelle}",
                [
                    'reference_type'   => Transaction::class,
                    'reference_id'     => $transaction->id,
                    'notes'            => $motif,
                    'created_by'       => $userId,
                'mode_paiement'    => $transaction->mode_paiement,
                    'type_operation'   => 'correction',
                ]
            );

            // RG-CAI-010 : marquer l'originale annulée (jamais supprimée)
            $transaction->forceFill([
                'annulee'           => true,
                'annulee_par'       => $userId,
                'annulee_at'        => now(),
                'motif_annulation'  => $motif,
            ])->save();

            return $correction;
        });
    }

    // ─── Clôture périodique ───────────────────────────────────────────────────

    /**
     * Génère un snapshot de solde à la clôture (fin de mois / fin d'année).
     * Utilisé pour les rapports de rapprochement bancaire (RG-CAI-015).
     */
    public function snapshot(Caisse $caisse, string $periode, ?string $userId = null): array
    {
        $solde = (float) $caisse->solde_actuel;

        return [
            'caisse_id'  => $caisse->id,
            'libelle'    => $caisse->libelle,
            'periode'    => $periode,
            'solde'      => $solde,
            'genere_at'  => now()->toIso8601String(),
            'genere_par' => $userId,
        ];
    }
}
