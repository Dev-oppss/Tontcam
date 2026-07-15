<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PlanningTour;
use App\Models\Tontine;
use App\Services\AccessScopeService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PlanningTourController extends Controller
{
    public function __construct(private AccessScopeService $scope) {}

    public function index(string $tontineId): JsonResponse
    {
        $tontine = $this->scope->scopeAssociation(Tontine::query())->findOrFail($tontineId);

        return response()->json($tontine->planningTours()->with('beneficiaire')->orderBy('numero_tour')->get());
    }

    public function store(Request $request, string $tontineId): JsonResponse
    {
        $tontine = $this->scope->scopeAssociation(Tontine::query())->findOrFail($tontineId);

        $data = $request->validate([
            'numero_tour' => ['required', 'integer', 'min:1'],
            'beneficiaire_membre_id' => ['nullable', 'uuid'],
            'montant_prevu' => ['required', 'numeric', 'min:0'],
            'date_prevue' => ['nullable', 'date'],
            'notes' => ['nullable', 'string'],
        ]);
        $data['tontine_id'] = $tontine->id;
        $data['statut'] = 'planifie';

        $tour = PlanningTour::create($data);

        return response()->json($tour->load('beneficiaire'), 201);
    }

    public function marquerEncaisse(string $tontineId, string $id): JsonResponse
    {
        $tour = PlanningTour::whereHas('tontine', fn ($q) => $this->scope->scopeAssociation($q))
            ->where('tontine_id', $tontineId)->findOrFail($id);
        $tour->update(['statut' => 'encaisse']);

        return response()->json($tour);
    }

    public function destroy(string $tontineId, string $id): JsonResponse
    {
        $tour = PlanningTour::whereHas('tontine', fn ($q) => $this->scope->scopeAssociation($q))
            ->where('tontine_id', $tontineId)->findOrFail($id);

        if ($tour->statut === 'encaisse') {
            return response()->json(['message' => 'Impossible de retirer un tour déjà encaissé.'], 422);
        }
        $tour->delete();

        return response()->json(['deleted' => true]);
    }
}
