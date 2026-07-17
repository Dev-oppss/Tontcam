<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PlanningTour;
use App\Models\Tontine;
use App\Models\TontinePart;
use App\Services\AccessScopeService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PlanningTourController extends Controller
{
    public function __construct(private AccessScopeService $scope) {}

    public function index(string $tontineId): JsonResponse
    {
        $tontine = $this->scope->scopeAssociation(Tontine::query())->findOrFail($tontineId);

        return response()->json($tontine->planningTours()->with('beneficiaire', 'part')->orderBy('numero_tour')->get());
    }

    public function store(Request $request, string $tontineId): JsonResponse
    {
        $tontine = $this->scope->scopeAssociation(Tontine::query())->findOrFail($tontineId);

        $data = $request->validate([
            'numero_tour' => ['required', 'integer', 'min:1'],
            // RG-TON : le bénéficiaire d'un tour est toujours une part précise, jamais un
            // membre en tant que tel (un membre avec plusieurs parts occupe plusieurs tours).
            'tontine_part_id' => ['required', 'uuid'],
            'montant_prevu' => ['required', 'numeric', 'min:0'],
            'date_prevue' => ['nullable', 'date'],
            'notes' => ['nullable', 'string'],
        ]);

        $part = TontinePart::where('tontine_id', $tontine->id)->findOrFail($data['tontine_part_id']);

        if (PlanningTour::where('tontine_part_id', $part->id)->exists()) {
            return response()->json(['message' => 'Cette part est déjà planifiée sur un tour.'], 422);
        }
        if ($part->statut === 'gagnee') {
            return response()->json(['message' => 'Cette part a déjà gagné un tour précédent.'], 422);
        }

        $tour = PlanningTour::create([
            'tontine_id' => $tontine->id,
            'numero_tour' => $data['numero_tour'],
            'tontine_part_id' => $part->id,
            'beneficiaire_membre_id' => $part->membre_id,
            'montant_prevu' => $data['montant_prevu'],
            'date_prevue' => $data['date_prevue'] ?? null,
            'notes' => $data['notes'] ?? null,
            'statut' => 'planifie',
        ]);

        $part->update(['statut' => 'reservee', 'ordre_rotation' => $data['numero_tour']]);

        return response()->json($tour->load('beneficiaire', 'part'), 201);
    }

    public function marquerEncaisse(string $tontineId, string $id): JsonResponse
    {
        $tour = PlanningTour::whereHas('tontine', fn ($q) => $this->scope->scopeAssociation($q))
            ->where('tontine_id', $tontineId)->findOrFail($id);
        $tour->update(['statut' => 'encaisse']);
        // La part gagne définitivement ce tour (RG-TON : chaque part a son propre cycle de gain).
        $tour->part()?->update(['statut' => 'gagnee']);

        return response()->json($tour->load('beneficiaire', 'part'));
    }

    public function destroy(string $tontineId, string $id): JsonResponse
    {
        $tour = PlanningTour::whereHas('tontine', fn ($q) => $this->scope->scopeAssociation($q))
            ->where('tontine_id', $tontineId)->findOrFail($id);

        if ($tour->statut === 'encaisse') {
            return response()->json(['message' => 'Impossible de retirer un tour déjà encaissé.'], 422);
        }
        $tour->part()?->update(['statut' => 'disponible', 'ordre_rotation' => null]);
        $tour->delete();

        return response()->json(['deleted' => true]);
    }
}
