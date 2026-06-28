<?php

namespace App\Services;

use App\Models\Association;
use App\Models\CotisationTontine;
use App\Models\EcheancePret;
use App\Models\Membre;
use App\Models\Presence;
use App\Models\SanctionMembre;
use App\Models\TypeSanction;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class SanctionService
{
    public function __construct(
        private readonly NotificationService $notificationService,
    ) {}

    public function appliquer(
        string $associationId,
        string $membreId,
        TypeSanction $type,
        string $motif,
        array $data = []
    ): SanctionMembre {
        return DB::transaction(function () use ($associationId, $membreId, $type, $motif, $data) {
            if (! empty($data['reference_type']) && ! empty($data['reference_id'])) {
                $exists = SanctionMembre::where('membre_id', $membreId)
                    ->where('type_sanction_id', $type->id)
                    ->where('reference_type', $data['reference_type'])
                    ->where('reference_id', $data['reference_id'])
                    ->where('statut', '!=', 'annulee')
                    ->exists();

                if ($exists) {
                    throw new RuntimeException('Sanction déjà existante pour cette référence.');
                }
            }

            $montant = $this->calculerMontant($type, $data);

            $sanction = SanctionMembre::create([
                'association_id'   => $associationId,
                'membre_id'        => $membreId,
                'type_sanction_id' => $type->id,
                'reunion_id'       => $data['reunion_id'] ?? null,
                'montant'          => $montant,
                'motif'            => $motif,
                'statut'           => 'due',
                'est_automatique'  => (bool) ($data['est_automatique'] ?? $type->est_automatique),
                'reference_type'   => $data['reference_type'] ?? null,
                'reference_id'     => $data['reference_id'] ?? null,
                'appliquee_par'    => $data['appliquee_par'] ?? null,
            ]);

            $this->notificationService->notifierSanction(
                $associationId,
                $membreId,
                $type->libelle,
                (float) $montant,
                $sanction->id
            );

            $this->recalculerStatutMembre($associationId, $membreId);

            return $sanction->refresh();
        });
    }

    public function sanctionnerRetardCotisation(CotisationTontine $cotisation): ?SanctionMembre
    {
        $association = $cotisation->cycle->tontine->association;
        $type = $association->typesSanctions()
            ->where('est_automatique', true)
            ->where('declencheur', 'retard_cotisation')
            ->where('actif', true)
            ->first();

        if (! $type) {
            return null;
        }

        return $this->appliquer(
            $association->id,
            $cotisation->membre_id,
            $type,
            'Retard de cotisation',
            [
                'est_automatique' => true,
                'reference_type' => CotisationTontine::class,
                'reference_id' => $cotisation->id,
                'montant_reference' => (float) $cotisation->montant_du,
            ]
        );
    }

    public function sanctionnerRetardEcheancePret(EcheancePret $echeance): ?SanctionMembre
    {
        $pret = $echeance->pret;
        $association = $pret->caisse->association;
        $type = $association->typesSanctions()
            ->where('est_automatique', true)
            ->where('declencheur', 'retard_remboursement_pret')
            ->where('actif', true)
            ->first();

        if (! $type) {
            return null;
        }

        return $this->appliquer(
            $association->id,
            $pret->emprunteur_id,
            $type,
            'Retard de remboursement de prêt',
            [
                'est_automatique' => true,
                'reference_type' => EcheancePret::class,
                'reference_id' => $echeance->id,
                'montant_reference' => (float) $echeance->montant_total,
            ]
        );
    }

    public function sanctionnerAbsenceNonExcusee(Presence $presence): ?SanctionMembre
    {
        $reunion = $presence->reunion;
        $association = $reunion->association;
        $type = $association->typesSanctions()
            ->where('est_automatique', true)
            ->where('declencheur', 'absence_non_excusee')
            ->where('actif', true)
            ->first();

        if (! $type) {
            return null;
        }

        return $this->appliquer(
            $association->id,
            $presence->membre_id,
            $type,
            'Absence non excusée',
            [
                'est_automatique' => true,
                'reference_type' => Presence::class,
                'reference_id' => $presence->id,
                'reunion_id' => $reunion->id,
            ]
        );
    }

    public function payer(SanctionMembre $sanction, CaisseService $caisseService, ?string $userId = null): SanctionMembre
    {
        if ($sanction->statut === 'payee') {
            throw new RuntimeException('Cette sanction est déjà payée.');
        }

        if ($sanction->statut === 'annulee') {
            throw new RuntimeException('Impossible de payer une sanction annulée.');
        }

        return DB::transaction(function () use ($sanction, $caisseService, $userId) {
            $caisse = \App\Models\Caisse::where('association_id', $sanction->association_id)
                ->where('type', 'tontine')
                ->firstOrFail();

            $tx = $caisseService->entree(
                $caisse,
                (float) $sanction->montant,
                'Paiement sanction',
                [
                    'reference_type' => SanctionMembre::class,
                    'reference_id' => $sanction->id,
                    'created_by' => $userId,
                ]
            );

            $sanction->forceFill([
                'statut' => 'payee',
                'payee_at' => now(),
                'transaction_id' => $tx->id,
            ])->save();

            $this->recalculerStatutMembre($sanction->association_id, $sanction->membre_id);

            return $sanction->refresh();
        });
    }

    public function annuler(SanctionMembre $sanction, string $motif, ?string $userId = null): SanctionMembre
    {
        if ($sanction->statut === 'payee') {
            throw new RuntimeException('Impossible d\'annuler une sanction déjà payée.');
        }

        $sanction->forceFill([
            'statut' => 'annulee',
            'motif_annulation' => $motif,
            'annulee_par' => $userId,
            'annulee_at' => now(),
        ])->save();

        $this->recalculerStatutMembre($sanction->association_id, $sanction->membre_id, true);

        return $sanction->refresh();
    }

    private function calculerMontant(TypeSanction $type, array $data): float
    {
        if (isset($data['montant_ajuste'])) {
            return (float) $data['montant_ajuste'];
        }

        return match ($type->mode_calcul) {
            'fixe' => (float) ($type->montant_fixe ?? 0),
            'pourcentage' => round((float) ($data['montant_reference'] ?? 0) * (float) ($type->montant_pct ?? 0), 2),
            'journalier' => round((float) ($type->montant_journalier ?? 0) * max(1, (int) ($data['nb_jours'] ?? 1)), 2),
            default => (float) ($type->montant_fixe ?? 0),
        };
    }

    private function recalculerStatutMembre(string $associationId, string $membreId, bool $annulation = false): void
    {
        $association = Association::find($associationId);
        $membre = Membre::find($membreId);
        if (! $association || ! $membre) {
            return;
        }

        $seuil = (int) ($association->config['seuil_sanctions_suspension'] ?? 3);
        $nb = SanctionMembre::where('association_id', $associationId)
            ->where('membre_id', $membreId)
            ->where('statut', 'due')
            ->count();

        if (! $annulation && $nb >= $seuil && $membre->statut === 'actif') {
            $membre->forceFill(['statut' => 'suspendu', 'motif_suspension' => 'Seuil de sanctions atteint.'])->save();
        }

        if ($annulation && $nb < $seuil && $membre->statut === 'suspendu') {
            $membre->forceFill(['statut' => 'actif', 'motif_suspension' => null])->save();
        }
    }
}
