<?php

namespace App\Http\Controllers\Api;

use App\Models\Association;
use App\Services\AccessScopeService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use App\Http\Controllers\Controller;

class AssociationController extends Controller
{
    public function __construct(private AccessScopeService $scope) {}

    public function index(Request $request): JsonResponse
    {
        return response()->json($this->scope->scopeAssociation(Association::query())->get());
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'nom' => ['required', 'string', 'max:200', 'unique:associations,nom'],
            'nom_abrege' => ['nullable', 'string', 'max:50'],
            'siege_social' => ['nullable', 'string'],
            'ville' => ['nullable', 'string', 'max:100'],
            'pays' => ['nullable', 'string', 'max:100'],
            'telephone' => ['nullable', 'string', 'max:30'],
            'email' => ['nullable', 'email', 'max:200'],
            'date_creation' => ['required', 'date'],
            'devise' => ['nullable', 'string', 'size:3'],
        ]);

        $association = Association::create($data);

        return response()->json($association, 201);
    }

    public function show(string $id): JsonResponse
    {
        return response()->json($this->scope->scopeAssociation(Association::query())->findOrFail($id));
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $association = $this->scope->scopeAssociation(Association::query())->findOrFail($id);
        $this->authorize('update', $association);

        // La devise est verrouillée dès qu'une transaction existe (RG-ORG-003)
        if ($request->has('devise') && $request->devise !== $association->devise) {
            $existeTransaction = \App\Models\Transaction::whereHas('caisse', fn ($q) => $q->where('association_id', $association->id))->exists();
            if ($existeTransaction) {
                return response()->json(['message' => 'La devise ne peut plus être modifiée : des transactions existent déjà.'], 422);
            }
        }

        $association->update($request->validate([
            'nom' => ['sometimes', 'string', 'max:200'],
            'nom_abrege' => ['sometimes', 'nullable', 'string', 'max:50'],
            'siege_social' => ['sometimes', 'nullable', 'string'],
            'ville' => ['sometimes', 'nullable', 'string', 'max:100'],
            'pays' => ['sometimes', 'nullable', 'string', 'max:100'],
            'telephone' => ['sometimes', 'nullable', 'string', 'max:30'],
            'email' => ['sometimes', 'nullable', 'email', 'max:200'],
            'devise' => ['sometimes', 'string', 'size:3'],
            'seuil_approbation_pret' => ['sometimes', 'numeric', 'min:0'],
            'nb_signataires_pv' => ['sometimes', 'integer', 'between:2,7'],
            'delai_rappel_j7' => ['sometimes', 'boolean'],
            'delai_rappel_j3' => ['sometimes', 'boolean'],
            'delai_rappel_j1' => ['sometimes', 'boolean'],
            'logo_url' => ['sometimes', 'nullable', 'string'],
            'profil_complete' => ['sometimes', 'boolean'],
        ]));

        return response()->json($association);
    }

    public function uploadStatuts(Request $request, string $id): JsonResponse
    {
        $association = $this->scope->scopeAssociation(Association::query())->findOrFail($id);
        $this->authorize('update', $association);
        $data = $request->validate([
            'fichier' => ['required', 'file', 'mimes:pdf', 'max:10240'],
            'version' => ['required', 'string', 'max:20'],
            'date_adoption' => ['required', 'date'],
            'signataires' => ['sometimes', 'array'],
        ]);

        $chemin = $request->file('fichier')->store('statuts', 'public');
        $url = \Illuminate\Support\Facades\Storage::url($chemin);

        \Illuminate\Support\Facades\DB::transaction(function () use ($association, $data, $url, $request) {
            \App\Models\StatutAssociation::where('association_id', $association->id)->update(['est_actif' => false]);
            \App\Models\StatutAssociation::create([
                'association_id' => $association->id,
                'version' => $data['version'],
                'fichier_url' => $url,
                'date_adoption' => $data['date_adoption'],
                'signataires' => $data['signataires'] ?? [],
                'uploaded_by' => $request->user()->id,
                'est_actif' => true,
            ]);
            $association->update(['statuts_url' => $url]);
        });

        return response()->json($association->fresh());
    }

    public function historiqueStatuts(string $id): JsonResponse
    {
        $association = $this->scope->scopeAssociation(Association::query())->findOrFail($id);

        return response()->json(
            \App\Models\StatutAssociation::where('association_id', $association->id)
                ->orderByDesc('date_adoption')
                ->get()
        );
    }

    public function destroy(string $id): JsonResponse
    {
        $association = $this->scope->scopeAssociation(Association::query())->findOrFail($id);
        $this->authorize('delete', $association);
        $association->delete();

        return response()->json(['deleted' => true]);
    }
}
