<?php

namespace App\Http\Controllers\Api;

use App\Models\Membre;
use App\Models\SanctionMembre;
use App\Models\TypeSanction;
use App\Services\AccessScopeService;
use App\Services\CaisseService;
use App\Services\SanctionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use App\Http\Controllers\Controller;

class SanctionController extends Controller
{
    public function __construct(
        private AccessScopeService $scope,
        private SanctionService $service,
        private CaisseService $caisseService,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $this->authorize('viewAny', SanctionMembre::class);
        $query = $this->scope->scopeAssociation(SanctionMembre::query())->with('membre', 'type');
        if ($request->filled('statut')) {
            $query->where('statut', $request->statut);
        }
        if ($request->filled('membre_id')) {
            $query->where('membre_id', $request->membre_id);
        }

        return response()->json($query->latest()->paginate($request->integer('per_page', 25)));
    }

    public function store(Request $request): JsonResponse
    {
        $this->authorize('create', SanctionMembre::class);
        $data = $request->validate([
            'membre_id' => ['required', 'uuid'],
            'type_sanction_id' => ['required', 'uuid'],
            'motif' => ['required', 'string'],
            'reunion_id' => ['nullable', 'uuid'],
        ]);

        $membre = Membre::where('association_id', $this->scope->associationId())->findOrFail($data['membre_id']);
        $type = TypeSanction::where('association_id', $this->scope->associationId())->findOrFail($data['type_sanction_id']);
        $reunion = $data['reunion_id'] ?? null ? \App\Models\Reunion::findOrFail($data['reunion_id']) : null;

        $sanction = $this->service->appliquerManuelle($membre, $type, $data['motif'], $request->user(), $reunion);

        return response()->json($sanction->load('type'), 201);
    }

    public function show(string $id): JsonResponse
    {
        return response()->json($this->scope->scopeAssociation(SanctionMembre::query())->with('membre', 'type')->findOrFail($id));
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $sanction = $this->scope->scopeAssociation(SanctionMembre::query())->findOrFail($id);

        if (in_array($sanction->statut, ['payee', 'annulee'], true)) {
            return response()->json(['message' => 'Sanction déjà clôturée.'], 422);
        }

        $data = $request->validate(['statut' => ['sometimes', 'in:annulee'], 'motif_annulation' => ['required_if:statut,annulee', 'string']]);
        if (($data['statut'] ?? null) === 'annulee') {
            $sanction->update([
                'statut' => 'annulee',
                'annulee_par' => $request->user()->id,
                'annulee_at' => now(),
                'motif_annulation' => $data['motif_annulation'],
            ]);
        }

        return response()->json($sanction);
    }

    /**
     * Paiement direct de la sanction (hors retenue sur gain) — encaissement en caisse.
     */
    public function payer(Request $request, string $id): JsonResponse
    {
        $sanction = $this->scope->scopeAssociation(SanctionMembre::query())->findOrFail($id);
        $this->authorize('update', $sanction);
        if ($sanction->statut !== 'due') {
            return response()->json(['message' => 'Cette sanction n\'est pas due.'], 422);
        }

        $data = $request->validate([
            'caisse_id' => ['sometimes', 'nullable', 'uuid'],
            'mode_paiement' => ['sometimes', 'nullable', 'string'],
            'details_paiement' => ['sometimes', 'nullable', 'string'],
        ]);
        $caisse = !empty($data['caisse_id'])
            ? \App\Models\Caisse::findOrFail($data['caisse_id'])
            : \App\Models\Caisse::where('association_id', $this->scope->associationId())->orderBy('created_at')->firstOrFail();

        $transaction = $this->caisseService->entree($caisse, (float) $sanction->montant, "Paiement sanction — {$sanction->motif}", [
            'reference_type' => 'sanction_membre', 'reference_id' => $sanction->id, 'created_by' => $request->user()->id, 'valide_par' => $request->user()->id,
            'mode_paiement' => $data['mode_paiement'] ?? null, 'cheque_numero' => $data['details_paiement'] ?? null,
        ]);

        $sanction->update(['statut' => 'payee', 'payee_at' => now(), 'transaction_id' => $transaction->id]);

        return response()->json($sanction);
    }
}
