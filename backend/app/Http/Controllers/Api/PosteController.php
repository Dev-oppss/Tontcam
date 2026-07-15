<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Membre;
use App\Models\MembrePoste;
use App\Models\Poste;
use App\Services\AccessScopeService;
use App\Services\PosteService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PosteController extends Controller
{
    public function __construct(private AccessScopeService $scope, private PosteService $service) {}

    public function index(): JsonResponse
    {
        $this->authorize('viewAny', Poste::class);
        $associationId = $this->scope->associationId();

        if (! Poste::where('association_id', $associationId)->exists()) {
            foreach ([
                ['libelle' => 'Président', 'code' => 'PRESIDENT', 'niveau_hierarchie' => 1, 'est_bureau' => true, 'est_obligatoire' => true],
                ['libelle' => 'Secrétaire Général', 'code' => 'SECRETAIRE_GENERAL', 'niveau_hierarchie' => 2, 'est_bureau' => true, 'est_obligatoire' => true],
                ['libelle' => 'Trésorier Général', 'code' => 'TRESORIER_GENERAL', 'niveau_hierarchie' => 2, 'est_bureau' => true, 'est_obligatoire' => true],
            ] as $p) {
                Poste::create($p + ['association_id' => $associationId]);
            }
        }

        $postes = $this->scope->scopeAssociation(Poste::query())
            ->with(['mandats' => fn ($q) => $q->whereNull('date_fin')->with('membre')])
            ->orderByDesc('est_obligatoire')->orderBy('niveau_hierarchie')
            ->get();

        return response()->json($postes);
    }

    public function store(Request $request): JsonResponse
    {
        $this->authorize('create', Poste::class);
        $data = $request->validate([
            'libelle' => ['required', 'string', 'max:150'],
            'code' => ['required', 'string', 'max:50'],
            'niveau_hierarchie' => ['nullable', 'integer'],
            'est_bureau' => ['sometimes', 'boolean'],
            'est_obligatoire' => ['sometimes', 'boolean'],
            'pouvoirs' => ['nullable', 'string'],
            'obligations' => ['nullable', 'string'],
        ]);
        $data['association_id'] = $this->scope->associationId();

        $poste = Poste::create($data);

        return response()->json($poste, 201);
    }

    public function mandats(string $posteId): JsonResponse
    {
        $poste = $this->scope->scopeAssociation(Poste::query())->findOrFail($posteId);

        return response()->json($poste->mandats()->with('membre')->orderByDesc('date_debut')->get());
    }

    /**
     * Attribution d'un poste — clôture auto du mandat précédent + contrôle plafond de cumul.
     */
    public function attribuer(Request $request, string $posteId): JsonResponse
    {
        $poste = $this->scope->scopeAssociation(Poste::query())->findOrFail($posteId);
        $this->authorize('update', $poste);
        $data = $request->validate([
            'membre_id' => ['required', 'uuid'],
            'date_debut' => ['required', 'date'],
        ]);
        $membre = Membre::where('association_id', $this->scope->associationId())->findOrFail($data['membre_id']);

        $plafond = (int) app(\App\Services\ParametreService::class)->obtenir($this->scope->associationId(), 'plafond_cumul_postes', 2);

        try {
            $mandat = $this->service->attribuer($poste, $membre, $data['date_debut'], $plafond);
        } catch (\RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return response()->json($mandat->load('membre', 'poste'), 201);
    }

    public function cloturerMandat(Request $request, string $mandatId): JsonResponse
    {
        $mandat = MembrePoste::whereHas('poste', fn ($q) => $this->scope->scopeAssociation($q))->findOrFail($mandatId);
        $data = $request->validate(['date_fin' => ['required', 'date']]);

        $mandat = $this->service->cloturer($mandat, $data['date_fin']);

        return response()->json($mandat);
    }
}
