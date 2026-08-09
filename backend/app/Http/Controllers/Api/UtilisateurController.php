<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Membre;
use App\Models\Utilisateur;
use App\Services\AccessScopeService;
use App\Services\UtilisateurService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class UtilisateurController extends Controller
{
    public function __construct(private AccessScopeService $scope, private UtilisateurService $service) {}

    public function index(): JsonResponse
    {
        $this->authorize('viewAny', Utilisateur::class);

        $utilisateurs = Utilisateur::whereHas('membre', fn ($q) => $this->scope->scopeAssociation($q))
            ->with('membre')
            ->get();

        return response()->json($utilisateurs);
    }

    public function store(Request $request): JsonResponse
    {
        $this->authorize('create', Utilisateur::class);

        $data = $request->validate([
            'membre_id' => ['required', 'uuid'],
            'email' => ['required', 'email', 'unique:utilisateurs,email'],
            'role' => ['required', 'in:super_admin,president,vice_president,tresorier,secretaire,controleur,membre'],
        ]);

        $membre = Membre::where('association_id', $this->scope->associationId())->findOrFail($data['membre_id']);

        try {
            $result = $this->service->creerCompte($membre, $data['email'], $data['role'], $request->user());
        } catch (\RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return response()->json($result, 201);
    }

    public function show(string $id): JsonResponse
    {
        $utilisateur = Utilisateur::whereHas('membre', fn ($q) => $this->scope->scopeAssociation($q))->with('membre')->findOrFail($id);
        $this->authorize('view', $utilisateur);

        return response()->json($utilisateur);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $utilisateur = Utilisateur::whereHas('membre', fn ($q) => $this->scope->scopeAssociation($q))->findOrFail($id);
        $this->authorize('update', $utilisateur);

        $data = $request->validate(['role' => ['sometimes', 'in:super_admin,president,vice_president,tresorier,secretaire,controleur,membre']]);
        if (isset($data['role'])) {
            try {
                $this->service->changerRole($utilisateur, $data['role'], $request->user());
            } catch (\RuntimeException $e) {
                return response()->json(['message' => $e->getMessage()], 422);
            }
        }

        return response()->json($utilisateur->fresh());
    }

    public function activer(string $id): JsonResponse
    {
        $utilisateur = Utilisateur::whereHas('membre', fn ($q) => $this->scope->scopeAssociation($q))->findOrFail($id);
        $this->authorize('update', $utilisateur);

        return response()->json($this->service->activer($utilisateur));
    }

    public function desactiver(string $id): JsonResponse
    {
        $utilisateur = Utilisateur::whereHas('membre', fn ($q) => $this->scope->scopeAssociation($q))->findOrFail($id);
        $this->authorize('update', $utilisateur);

        return response()->json($this->service->desactiver($utilisateur));
    }
}
