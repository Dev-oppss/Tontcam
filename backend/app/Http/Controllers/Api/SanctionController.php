<?php

namespace App\Http\Controllers\Api;

use App\Models\Caisse;
use App\Models\Membre;
use App\Models\SanctionMembre;
use App\Models\TypeSanction;
use App\Services\CaisseService;
use App\Services\SanctionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Gestion des sanctions.
 *
 * Règles couvertes :
 *   RG-SAN-001–005 : Catalogue des sanctions (modes fixe, pourcentage, journalier).
 *   RG-SAN-007–009 : Application manuelle avec ajustement ±50%.
 *   RG-SAN-010–011 : Annulation avant paiement, avec motif obligatoire.
 *   RG-SAN-012–014 : Règlement des sanctions (bulletin de gain ou versement direct).
 */
class SanctionController extends CrudController
{
    protected string $model = SanctionMembre::class;
    protected array $filterable = ['association_id', 'membre_id', 'statut'];

    /**
     * Application d'une sanction.
     * RG-SAN-008 : champs obligatoires membre_sanctionné, type, date, motif, montant, saisie_par.
     * RG-SAN-009 : ajustement du montant autorisé ±50% par le Président.
     */
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'association_id'    => ['required', 'uuid'],
            'membre_id'         => ['required', 'uuid'],
            'type_sanction_id'  => ['required', 'uuid'],
            'motif'             => ['required', 'string'],
            'montant_ajuste'    => ['nullable', 'numeric', 'min:0'],
        ]);

        $typeSanction = TypeSanction::findOrFail($data['type_sanction_id']);

        // RG-SAN-009 : vérifier que l'ajustement est dans la limite ±50%
        if (isset($data['montant_ajuste'])) {
            $montantTheorique = (float) ($typeSanction->montant_fixe ?? 0);
            $limite           = $montantTheorique * 0.5;
            $diff             = abs($data['montant_ajuste'] - $montantTheorique);

            if ($montantTheorique > 0 && $diff > $limite) {
                return response()->json([
                    'message' => 'Le montant ajusté ne peut pas dépasser ±50% du montant théorique.',
                ], 422);
            }
        }

        $sanction = app(SanctionService::class)->appliquer(
            $data['association_id'],
            $data['membre_id'],
            $typeSanction,
            $data['motif'],
            array_merge(
                $request->except(['association_id', 'membre_id', 'type_sanction_id', 'motif']),
                ['saisie_par' => $request->user()?->id]
            )
        );

        return response()->json($sanction, 201);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $path = $request->path();

        // RG-SAN-012–014 : Paiement de la sanction via caisse
        if (str_ends_with($path, 'payer')) {
            $data     = $request->validate(['caisse_id' => ['nullable', 'uuid']]);
            $sanction = SanctionMembre::findOrFail($id);

            if ($sanction->statut === 'payee') {
                return response()->json(['message' => 'Cette sanction est déjà payée.'], 422);
            }

            $caisse = isset($data['caisse_id'])
                ? Caisse::findOrFail($data['caisse_id'])
                : Caisse::where('association_id', $sanction->association_id)->firstOrFail();

            $tx = app(CaisseService::class)->entree(
                $caisse,
                (float) $sanction->montant,
                'Paiement sanction',
                [
                    'reference_type' => SanctionMembre::class,
                    'reference_id'   => $sanction->id,
                    'created_by'     => $request->user()?->id,
                ]
            );

            $sanction->forceFill([
                'statut'         => 'payee',
                'payee_at'       => now(),
                'transaction_id' => $tx->id,
            ])->save();

            return response()->json($sanction->refresh());
        }

        // RG-SAN-010–011 : Annulation avant paiement, motif obligatoire
        if (str_ends_with($path, 'annuler')) {
            $data     = $request->validate(['motif_annulation' => ['required', 'string']]);
            $sanction = SanctionMembre::findOrFail($id);

            if ($sanction->statut === 'payee') {
                return response()->json([
                    'message' => 'Impossible d\'annuler une sanction déjà payée.',
                ], 422);
            }

            $sanction->forceFill([
                'statut'           => 'annulee',
                'motif_annulation' => $data['motif_annulation'],
                'annulee_par'      => $request->user()?->id,
                'annulee_at'       => now(),
            ])->save();

            return response()->json($sanction->refresh());
        }

        return parent::update($request, $id);
    }
}
