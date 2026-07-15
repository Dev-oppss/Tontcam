<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ReglementInterieur;
use App\Services\AccessScopeService;
use App\Services\ReglementService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ReglementInterieurController extends Controller
{
    public function __construct(private AccessScopeService $scope, private ReglementService $service) {}

    public function index(): JsonResponse
    {
        return response()->json(
            $this->scope->scopeAssociation(ReglementInterieur::query())->orderByDesc('date_adoption')->get()
        );
    }

    public function actif(): JsonResponse
    {
        $version = $this->service->versionActive($this->scope->associationId());

        return response()->json($version);
    }

    public function store(Request $request): JsonResponse
    {
        $this->authorize('create', ReglementInterieur::class);
        $data = $request->validate([
            'version' => ['required', 'string', 'max:20'],
            'titre' => ['nullable', 'string'],
            'contenu_html' => ['nullable', 'string'],
            'fichier_url' => ['required', 'string'],
            'date_adoption' => ['required', 'date'],
            'numero_decision_ag' => ['required', 'string'],
            'signataires' => ['nullable', 'array'],
        ]);

        try {
            $reglement = $this->service->publier($this->scope->associationId(), $data);
        } catch (\RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return response()->json($reglement, 201);
    }

    public function show(string $id): JsonResponse
    {
        return response()->json($this->scope->scopeAssociation(ReglementInterieur::query())->findOrFail($id));
    }
}
