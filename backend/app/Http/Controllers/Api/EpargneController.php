<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Caisse;
use App\Models\Pret;
use App\Services\AccessScopeService;
use App\Services\EpargneService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Module épargne (RG-EPA) : caisse "tirelire commune", voir EpargneService.
 */
class EpargneController extends Controller
{
    public function __construct(private AccessScopeService $scope, private EpargneService $service) {}

    /** POST /caisses/{id}/activer-epargne — activable à tout moment, irréversible. */
    public function activer(string $caisseId): JsonResponse
    {
        $caisse = $this->scope->scopeAssociation(Caisse::query())->findOrFail($caisseId);
        $this->authorize('update', $caisse);

        if ($caisse->suivi_epargne) {
            return response()->json(['message' => 'Le suivi épargne est déjà actif sur cette caisse.'], 422);
        }
        $caisse->update(['suivi_epargne' => true]);

        return response()->json($caisse);
    }

    /** GET /caisses/{id}/epargne/soldes */
    public function soldes(string $caisseId): JsonResponse
    {
        $caisse = $this->scope->scopeAssociation(Caisse::query())->findOrFail($caisseId);
        $this->authorize('view', $caisse);

        return response()->json($this->service->soldes($caisse));
    }

    /**
     * GET /caisses/{id}/epargne/membres — membres déjà suivis dans cette
     * caisse épargne (au moins un mouvement), utilisé pour restreindre les
     * sélecteurs "membre connu de cette caisse" ailleurs dans l'app.
     */
    public function membres(string $caisseId): JsonResponse
    {
        $caisse = $this->scope->scopeAssociation(Caisse::query())->findOrFail($caisseId);
        $this->authorize('view', $caisse);

        return response()->json($this->service->membresSuivis($caisse));
    }

    /** POST /caisses/{id}/epargne/depots */
    public function deposer(Request $request, string $caisseId): JsonResponse
    {
        $caisse = $this->scope->scopeAssociation(Caisse::query())->findOrFail($caisseId);
        $this->authorize('update', $caisse);

        $data = $request->validate([
            'membre_id' => ['required', 'uuid'],
            'montant' => ['required', 'numeric', 'min:0.01'],
            'mode_paiement' => ['nullable', 'string'],
        ]);

        try {
            $mouvement = $this->service->deposer($caisse, $data['membre_id'], (float) $data['montant'], $data['mode_paiement'] ?? null, $request->user());
        } catch (\RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return response()->json($mouvement, 201);
    }

    /** POST /caisses/{id}/epargne/cassation — rembourse tout le monde d'un coup. */
    public function cassation(Request $request, string $caisseId): JsonResponse
    {
        $caisse = $this->scope->scopeAssociation(Caisse::query())->findOrFail($caisseId);
        $this->authorize('update', $caisse);

        try {
            $mouvements = $this->service->cassationGenerale($caisse, $request->user());
        } catch (\RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return response()->json(['mouvements' => $mouvements]);
    }

    /** POST /caisses/{id}/epargne/couper-garantie — décision manuelle du trésorier. */
    public function couperGarantie(Request $request, string $caisseId): JsonResponse
    {
        $caisse = $this->scope->scopeAssociation(Caisse::query())->findOrFail($caisseId);
        $this->authorize('update', $caisse);

        $data = $request->validate([
            'membre_id' => ['required', 'uuid'],
            'montant' => ['required', 'numeric', 'min:0.01'],
            'motif' => ['nullable', 'string'],
            'pret_id' => ['nullable', 'uuid'],
        ]);

        $pret = ! empty($data['pret_id']) ? Pret::find($data['pret_id']) : null;

        try {
            $mouvement = $this->service->couperGarantie($caisse, $data['membre_id'], (float) $data['montant'], $data['motif'] ?? null, $pret, $request->user());
        } catch (\RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return response()->json($mouvement, 201);
    }
}
