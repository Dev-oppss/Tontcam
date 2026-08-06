<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Caisse;
use App\Models\CompteBancaire;
use App\Models\RapprochementBancaire;
use App\Services\AccessScopeService;
use App\Services\RapprochementService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class RapprochementBancaireController extends Controller
{
    public function __construct(private AccessScopeService $scope, private RapprochementService $service) {}

    public function index(): JsonResponse
    {
        $this->authorize('viewAny', RapprochementBancaire::class);
        $rapprochements = RapprochementBancaire::whereHas('caisse', fn ($q) => $this->scope->scopeAssociation($q))
            ->with('caisse', 'compteBancaire')
            ->latest('periode_fin')
            ->get()
            ->map(function ($r) {
                $r->ecart = $this->service->ecart($r);

                return $r;
            });

        return response()->json($rapprochements);
    }

    public function store(Request $request): JsonResponse
    {
        $this->authorize('create', RapprochementBancaire::class);
        $data = $request->validate([
            'compte_bancaire_id' => ['required', 'uuid'],
            'caisse_id' => ['required', 'uuid'],
            'solde_banque' => ['required', 'numeric'],
            'periode_debut' => ['required', 'date'],
            'periode_fin' => ['required', 'date', 'after_or_equal:periode_debut'],
        ]);

        $compte = CompteBancaire::where('association_id', $this->scope->associationId())->findOrFail($data['compte_bancaire_id']);
        $caisse = $this->scope->scopeAssociation(Caisse::query())->findOrFail($data['caisse_id']);

        try {
            $rapprochement = $this->service->comparer($compte, $caisse, $data['solde_banque'], $data['periode_debut'], $data['periode_fin']);
        } catch (\RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        $rapprochement->ecart = $this->service->ecart($rapprochement);

        return response()->json($rapprochement, 201);
    }

    public function justifier(Request $request, string $id): JsonResponse
    {
        if (! in_array($request->user()->role, ['tresorier', 'super_admin'], true)) abort(403);
        $rapprochement = RapprochementBancaire::whereHas('caisse', fn ($q) => $this->scope->scopeAssociation($q))->findOrFail($id);
        $this->authorize('update', $rapprochement);
        $data = $request->validate(['motif' => ['required', 'string'], 'ajuster_solde' => ['sometimes', 'boolean']]);

        try {
            $rapprochement = $this->service->justifier($rapprochement, $data['motif'], $request->user(), $data['ajuster_solde'] ?? false);
        } catch (\RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return response()->json($rapprochement);
    }

    public function enRetard(): JsonResponse
    {
        $this->authorize('viewAny', RapprochementBancaire::class);
        return response()->json($this->service->ecartsEnRetard($this->scope->associationId())->values());
    }
}
