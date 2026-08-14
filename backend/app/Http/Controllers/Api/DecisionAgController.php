<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\DecisionAg;
use App\Models\Reunion;
use App\Services\AccessScopeService;
use App\Services\DecisionAgService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use App\Http\Controllers\Api\Concerns\AssertSeanceOuverte;

class DecisionAgController extends Controller
{
    use AssertSeanceOuverte;

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

        try {
            $this->assertSeanceOuverte($reunion);
        } catch (\RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        $decision = $this->service->enregistrer($reunion, $data);

        return response()->json($decision, 201);
    }

    public function show(string $id): JsonResponse
    {
        return response()->json($this->scope->scopeAssociation(DecisionAg::query())->with('reunion')->findOrFail($id));
    }

    /** Reprise immuable des décisions prises avant l'application. */
    public function importHistorique(Request $request): JsonResponse
    {
        if ($request->user()->role !== 'super_admin') {
            return response()->json(['message' => 'Réservé au super_admin.'], 403);
        }
        $data = $request->validate([
            'decisions' => ['required', 'array', 'min:1', 'max:500'],
            'decisions.*.reunion_id' => ['required', 'uuid'],
            'decisions.*.numero_decision' => ['required', 'string', 'max:100'],
            'decisions.*.type' => ['required', 'in:financier,statutaire,disciplinaire,organisationnel,autre'],
            'decisions.*.objet' => ['required', 'string', 'max:400'],
            'decisions.*.description' => ['nullable', 'string'],
            'decisions.*.quorum_present' => ['required', 'integer', 'min:0'],
            'decisions.*.votes_pour' => ['required', 'integer', 'min:0'],
            'decisions.*.votes_contre' => ['required', 'integer', 'min:0'],
            'decisions.*.votes_abstention' => ['nullable', 'integer', 'min:0'],
            'decisions.*.statut' => ['required', 'in:adopte,rejete'],
            'decisions.*.date_effet' => ['nullable', 'date'],
            'decisions.*.notes' => ['nullable', 'string'],
        ]);
        $decisions = \Illuminate\Support\Facades\DB::transaction(function () use ($data) {
            return collect($data['decisions'])->map(function (array $ligne) {
                Reunion::where('association_id', $this->scope->associationId())->findOrFail($ligne['reunion_id']);
                return DecisionAg::create(['association_id' => $this->scope->associationId(), ...$ligne]);
            })->values();
        });
        return response()->json($decisions, 201);
    }

    // Aucune mise à jour ni suppression : le registre des décisions d'AG est immuable (RG-SOC-014).
}
