<?php

namespace App\Http\Controllers\Api;

use App\Models\Tontine;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Gestion des tontines.
 *
 * Règles couvertes :
 *   RG-TON-001 : Champs obligatoires : libellé, montant/part, mode d'attribution, caisse.
 *   RG-TON-002 : Montant/part immuable après premier cycle.
 *   RG-TON-003 : Nb de parts = nb de cycles.
 *   RG-TON-004 : Modes valides : rotation, tirage_sort, enchere, calendrier.
 *   RG-TON-005 : Suppression interdite si ≥ 1 cycle lancé → clôture uniquement.
 *   RG-TON-006 : Paramètre avaliste configurable par tontine.
 *   RG-CAI-003 : Chaque tontine liée à exactement une caisse TONTINE (immuable).
 */
class TontineController extends CrudController
{
    protected string $model = Tontine::class;
    protected array $filterable = ['association_id', 'statut', 'mode_attribution'];

    /**
     * RG-TON-001, RG-TON-004, RG-TON-006, RG-CAI-003
     */
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'association_id'   => ['required', 'uuid'],
            'libelle'          => ['required', 'string', 'max:150'],
            'montant_part'     => ['required', 'numeric', 'min:1'],
            'mode_attribution' => ['required', 'in:rotation,tirage_sort,enchere,calendrier'],
            'caisse_id'        => ['required', 'uuid'],
            'avaliste_requis'  => ['sometimes', 'boolean'],
            'nb_parts_max_par_membre' => ['nullable', 'integer', 'min:1'],
        ]);

        // RG-CAI-003 : vérifier que la caisse est de type TONTINE
        $caisse = \App\Models\Caisse::findOrFail($data['caisse_id']);
        if ($caisse->type !== 'TONTINE') {
            return response()->json([
                'message' => 'La caisse associée doit être de type TONTINE.',
            ], 422);
        }

        // RG-CAI-003 : une caisse TONTINE ne peut être liée qu'à une seule tontine
        $dejaLiee = Tontine::where('caisse_id', $data['caisse_id'])->exists();
        if ($dejaLiee) {
            return response()->json([
                'message' => 'Cette caisse est déjà associée à une tontine.',
            ], 422);
        }

        $tontine = Tontine::create($data);
        return response()->json($tontine, 201);
    }

    /**
     * RG-TON-002 : Montant/part immuable après le premier cycle.
     * RG-TON-005 : Suppression interdite → clôture.
     */
    public function update(Request $request, string $id): JsonResponse
    {
        $tontine = Tontine::findOrFail($id);
        $path    = $request->path();

        // ── Clôture (RG-TON-005) ─────────────────────────────────────────
        if (str_ends_with($path, 'cloturer')) {
            if ($tontine->statut === 'cloturee') {
                return response()->json(['message' => 'Cette tontine est déjà clôturée.'], 422);
            }

            $tontine->forceFill([
                'statut'       => 'cloturee',
                'date_cloture' => now(),
            ])->save();

            return response()->json($tontine->refresh());
        }

        // RG-TON-002 : blocage montant_part si cycles lancés
        if ($request->has('montant_part')) {
            $aCycles = $tontine->cycles()->exists();
            if ($aCycles) {
                return response()->json([
                    'message' => 'Le montant par part est immuable après le démarrage du premier cycle.',
                ], 422);
            }
        }

        // RG-CAI-003 : caisse_id immuable
        if ($request->has('caisse_id')) {
            return response()->json([
                'message' => 'L\'association caisse-tontine est immuable.',
            ], 422);
        }

        $data = $request->validate([
            'libelle'                  => ['sometimes', 'string', 'max:150'],
            'mode_attribution'         => ['sometimes', 'in:rotation,tirage_sort,enchere,calendrier'],
            'avaliste_requis'          => ['sometimes', 'boolean'],
            'nb_parts_max_par_membre'  => ['sometimes', 'nullable', 'integer', 'min:1'],
            'statut'                   => ['sometimes', 'in:en_preparation,active,suspendue,cloturee'],
        ]);

        $tontine->fill($data)->save();
        return response()->json($tontine->refresh());
    }

    /**
     * RG-TON-005 : Pas de suppression si cycles existent.
     */
    public function destroy(Request $request, string $id): JsonResponse
    {
        $tontine = Tontine::findOrFail($id);

        if ($tontine->cycles()->exists()) {
            return response()->json([
                'message' => 'Impossible de supprimer une tontine ayant des cycles lancés. Utilisez la clôture.',
            ], 422);
        }

        $tontine->delete();
        return response()->json(['deleted' => true]);
    }
}
