<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\DecisionAg;
use App\Models\Reunion;
use App\Services\AccessScopeService;
use App\Services\DecisionAgService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DecisionAgController extends Controller
{
    public function __construct(private AccessScopeService $scope, private DecisionAgService $service) {}

    public function index(Request $request): JsonResponse
    {
        $this->authorize('viewAny', DecisionAg::class);
        $query = $this->scope->scopeAssociation(DecisionAg::query())->with('reunion');
        if ($request->filled('type')) {
            $query->where('type', $request->type);
        }

        return response()->json($query->latest('date_effet')->paginate($request->integer('per_page', 25)));
    }

    public function store(Request $request): JsonResponse
    {
        $this->authorize('create', DecisionAg::class);
        $data = $request->validate([
            'reunion_id' => ['required', 'uuid'],
            'type' => ['required', 'in:financier,statutaire,disciplinaire,organisationnel,autre'],
            'objet' => ['required', 'string'],
            'description' => ['nullable', 'string'],
            'quorum_present' => ['required', 'integer', 'min:0'],
            'votes_pour' => ['required', 'integer', 'min:0'],
            'votes_contre' => ['required', 'integer', 'min:0'],
            'votes_abstention' => ['sometimes', 'integer', 'min:0'],
            'date_effet' => ['nullable', 'date'],
            'notes' => ['nullable', 'string'],
        ]);

        $reunion = Reunion::where('association_id', $this->scope->associationId())->findOrFail($data['reunion_id']);

        $decision = $this->service->enregistrer($reunion, $data);

        return response()->json($decision, 201);
    }

    public function show(string $id): JsonResponse
    {
        return response()->json($this->scope->scopeAssociation(DecisionAg::query())->with('reunion')->findOrFail($id));
    }

    // Aucune mise à jour ni suppression : le registre des décisions d'AG est immuable (RG-SOC-014).
}
