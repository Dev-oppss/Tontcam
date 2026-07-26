<?php

namespace App\Http\Controllers\Api;

use App\Models\Caisse;
use App\Services\AccessScopeService;
use App\Services\CaisseService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use App\Http\Controllers\Controller;

class CaisseController extends Controller
{
    public function __construct(private AccessScopeService $scope, private CaisseService $service) {}

    public function index(Request $request): JsonResponse
    {
        $this->authorize('viewAny', Caisse::class);
        return response()->json($this->scope->scopeAssociation(Caisse::query())->get());
    }

    public function store(Request $request): JsonResponse
    {
        $this->authorize('create', Caisse::class);
        $data = $request->validate([
            'libelle' => ['required', 'string', 'max:200'],
            'description' => ['nullable', 'string'],
            'type' => ['required', 'in:tontine,mutuelle,scolaire,evenement,annuelle,banque,autre'],
            'solde_initial' => ['sometimes', 'numeric', 'min:0'],
            'compte_bancaire_id' => ['nullable', 'uuid'],
            'pret_autorise' => ['sometimes', 'boolean'],
            'taux_interet_mensuel' => ['sometimes', 'numeric', 'min:0'],
            'seuil_alerte_bas' => ['nullable', 'numeric'],
        ]);
        $data['association_id'] = $this->scope->associationId();
        $data['solde_actuel'] = $data['solde_initial'] ?? 0;
        // Sans ceci, 'actif' n'est jamais passé à Caisse::create() : la colonne prend bien
        // sa valeur DEFAULT TRUE côté SQL, mais l'instance Eloquent en mémoire (renvoyée
        // immédiatement dans la réponse JSON) ne reflète pas ce défaut — elle reste "actif:
        // null". Le frontend traduit alors ça en statut "inactive" dès la création, avant
        // même un rechargement de page, ce qui fait disparaître la caisse des sélecteurs
        // qui filtrent sur statut actif (ex: assignation d'une caisse à une tontine).
        $data['actif'] = true;

        $caisse = Caisse::create($data);

        return response()->json($caisse, 201);
    }

    public function show(string $id): JsonResponse
    {
        return response()->json($this->scope->scopeAssociation(Caisse::query())->findOrFail($id));
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $caisse = $this->scope->scopeAssociation(Caisse::query())->findOrFail($id);

        $caisse->update($request->validate([
            'libelle' => ['sometimes', 'string', 'max:200'],
            'pret_autorise' => ['sometimes', 'boolean'],
            'taux_interet_mensuel' => ['sometimes', 'numeric'],
            'taux_penalite_mensuel' => ['sometimes', 'numeric'],
            'seuil_alerte_bas' => ['sometimes', 'nullable', 'numeric'],
            'actif' => ['sometimes', 'boolean'],
            'compte_bancaire_id' => ['sometimes', 'nullable', 'uuid'],
        ]));

        return response()->json($caisse);
    }

    /**
     * POST /caisses/{id}/transactions — entrée ou sortie manuelle.
     */
    public function transaction(Request $request, string $id): JsonResponse
    {
        $caisse = $this->scope->scopeAssociation(Caisse::query())->findOrFail($id);
        $this->authorize('update', $caisse);
        $data = $request->validate([
            'sens' => ['required', 'in:entree,sortie'],
            'montant' => ['required', 'numeric', 'min:0.01'],
            'libelle' => ['required', 'string', 'max:400'],
            'mode_paiement' => ['nullable', 'in:especes,cheque,virement,mobile_money,carte_bancaire'],
            'cheque_numero' => ['required_if:mode_paiement,cheque', 'nullable', 'string'],
        ]);

        try {
            $transaction = $data['sens'] === 'entree'
                ? $this->service->entree($caisse, $data['montant'], $data['libelle'], [...$data, 'created_by' => $request->user()->id, 'valide_par' => $request->user()->id])
                : $this->service->sortie($caisse, $data['montant'], $data['libelle'], [...$data, 'created_by' => $request->user()->id, 'valide_par' => $request->user()->id]);
        } catch (\RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return response()->json($transaction, 201);
    }

    public function transferts(Request $request): JsonResponse
    {
        $transferts = \App\Models\TransfertCaisse::whereHas('caisseSource', fn ($q) => $this->scope->scopeAssociation($q))
            ->with('caisseSource', 'caisseDestination')
            ->latest()
            ->get();

        return response()->json($transferts);
    }

    public function transfert(Request $request): JsonResponse
    {
        $data = $request->validate([
            'caisse_source_id' => ['required', 'uuid'],
            'caisse_destination_id' => ['required', 'uuid', 'different:caisse_source_id'],
            'montant' => ['required', 'numeric', 'min:0.01'],
            'motif' => ['required', 'string'],
        ]);

        $source = $this->scope->scopeAssociation(Caisse::query())->findOrFail($data['caisse_source_id']);
        $destination = $this->scope->scopeAssociation(Caisse::query())->findOrFail($data['caisse_destination_id']);

        try {
            $result = $this->service->transfert($source, $destination, $data['montant'], $data['motif'], $request->user());
        } catch (\RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return response()->json($result, 201);
    }

    public function journal(Request $request, string $id): JsonResponse
    {
        $caisse = $this->scope->scopeAssociation(Caisse::query())->findOrFail($id);

        $query = $caisse->transactions()->orderByDesc('date_transaction');
        if ($request->filled('type')) {
            $query->where('type', $request->type);
        }
        if ($request->filled('du') && $request->filled('au')) {
            $query->whereBetween('date_transaction', [$request->du, $request->au]);
        }

        return response()->json($query->paginate($request->integer('per_page', 50)));
    }
}
