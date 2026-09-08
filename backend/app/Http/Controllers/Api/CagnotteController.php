<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\RemiseGain;
use App\Models\Tontine;
use App\Services\AccessScopeService;
use App\Services\RemiseGainService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Mode "cagnotte" (RG-TON) : remise de gains à un nombre libre de
 * bénéficiaires (0, 1, N), indépendante des cycles — voir RemiseGainService.
 */
class CagnotteController extends Controller
{
    public function __construct(private AccessScopeService $scope, private RemiseGainService $service) {}

    /** GET /tontines/{id}/cagnotte/proposition — parts au solde > 0, montant proposé, dettes informatives. */
    public function proposition(string $tontineId): JsonResponse
    {
        $tontine = $this->scope->scopeAssociation(Tontine::query())->findOrFail($tontineId);
        $this->authorize('view', $tontine);

        return response()->json($this->service->proposition($tontine));
    }

    /** GET /tontines/{id}/remises-gain — historique des remises déjà effectuées. */
    public function index(string $tontineId): JsonResponse
    {
        $tontine = $this->scope->scopeAssociation(Tontine::query())->findOrFail($tontineId);
        $this->authorize('view', $tontine);

        $remises = RemiseGain::where('tontine_id', $tontine->id)
            ->with('lignes.part.membre')
            ->latest('date_remise')
            ->get();

        return response()->json($remises);
    }

    /** POST /tontines/{id}/remises-gain */
    public function store(Request $request, string $tontineId): JsonResponse
    {
        $tontine = $this->scope->scopeAssociation(Tontine::query())->findOrFail($tontineId);
        $this->authorize('update', $tontine);

        $data = $request->validate([
            'reunion_id' => ['nullable', 'uuid'],
            'notes' => ['nullable', 'string'],
            'lignes' => ['required', 'array', 'min:1'],
            'lignes.*.tontine_part_id' => ['required', 'uuid'],
            'lignes.*.montant' => ['required', 'numeric', 'min:0.01'],
            'lignes.*.notes' => ['nullable', 'string'],
        ]);

        try {
            $remise = $this->service->creerRemise($tontine, $data['lignes'], $data['reunion_id'] ?? null, $data['notes'] ?? null, $request->user());
        } catch (\RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return response()->json($remise, 201);
    }
}
