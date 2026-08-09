<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CompteBancaire;
use App\Services\AccessScopeService;
use App\Services\PermissionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CompteBancaireController extends Controller
{
    public function __construct(private AccessScopeService $scope, private PermissionService $permissions) {}

    public function index(): JsonResponse
    {
        return response()->json($this->scope->scopeAssociation(CompteBancaire::query())->get());
    }

    public function store(Request $request): JsonResponse
    {
        if (! $this->permissions->peut($request->user(), 'caisses', 'create')) {
            return response()->json(['message' => 'Action non autorisée.'], 403);
        }

        $data = $request->validate([
            'banque' => ['required', 'string', 'max:150'],
            'agence' => ['nullable', 'string', 'max:150'],
            'numero_compte' => ['required', 'string', 'max:50'],
            'iban' => ['nullable', 'string', 'max:50'],
            'titulaire' => ['required', 'string', 'max:200'],
        ]);
        $data['association_id'] = $this->scope->associationId();
        $data['actif'] = true;

        $compte = CompteBancaire::create($data);

        return response()->json($compte, 201);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $compte = $this->scope->scopeAssociation(CompteBancaire::query())->findOrFail($id);
        if (! $this->permissions->peut($request->user(), 'caisses', 'update')) {
            return response()->json(['message' => 'Action non autorisée.'], 403);
        }

        $compte->update($request->validate([
            'banque' => ['sometimes', 'string', 'max:150'],
            'agence' => ['sometimes', 'nullable', 'string', 'max:150'],
            'titulaire' => ['sometimes', 'string', 'max:200'],
            'actif' => ['sometimes', 'boolean'],
        ]));

        return response()->json($compte);
    }
}
