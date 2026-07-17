<?php

namespace App\Http\Controllers\Api;

use App\Models\EvenementSocial;
use App\Models\Membre;
use App\Models\TypeAideSociale;
use App\Services\AccessScopeService;
use App\Services\CaisseService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use App\Http\Controllers\Controller;
use RuntimeException;

class AideSocialeController extends Controller
{
    public function __construct(private AccessScopeService $scope, private CaisseService $caisseService) {}

    public function index(Request $request): JsonResponse
    {
        $query = $this->scope->scopeAssociation(EvenementSocial::query())->with('membre', 'typeAide', 'transaction');
        if ($request->filled('statut')) {
            $query->where('statut', $request->statut);
        }

        return response()->json($query->latest()->paginate($request->integer('per_page', 25)));
    }

    /**
     * Déclaration d'un événement social — vérifie la limite annuelle par catégorie (RG-SOC-010).
     */
    public function store(Request $request): JsonResponse
    {
        $this->authorize('create', EvenementSocial::class);
        $data = $request->validate([
            'membre_id' => ['required', 'uuid'],
            'type_aide_id' => ['required', 'uuid'],
            'description' => ['nullable', 'string'],
            'date_evenement' => ['required', 'date'],
            'montant_demande' => ['nullable', 'numeric', 'min:0'],
            'pieces_jointes' => ['required', 'array', 'min:1'],
        ]);

        $membre = Membre::where('association_id', $this->scope->associationId())->findOrFail($data['membre_id']);
        $type = TypeAideSociale::where('association_id', $this->scope->associationId())->findOrFail($data['type_aide_id']);

        $dejaAccorde = EvenementSocial::where('membre_id', $membre->id)
            ->where('type_aide_id', $type->id)
            ->whereYear('date_declaration', now()->year)
            ->count();

        if ($dejaAccorde >= ($type->nb_max_par_an ?? 3)) {
            return response()->json(['message' => "Limite de {$type->nb_max_par_an} aide(s)/an atteinte pour cette catégorie."], 422);
        }

        if ($type->justificatif_requis && empty($data['pieces_jointes'])) {
            return response()->json(['message' => 'Justificatif obligatoire pour cette catégorie d\'aide.'], 422);
        }

        $evenement = EvenementSocial::create([
            'association_id' => $this->scope->associationId(),
            'membre_id' => $membre->id,
            'type_aide_id' => $type->id,
            'description' => $data['description'] ?? null,
            'date_evenement' => $data['date_evenement'],
            'date_declaration' => now()->toDateString(),
            'montant_demande' => $data['montant_demande'] ?? $type->montant_fixe,
            'statut' => 'en_attente',
            'pieces_jointes' => $data['pieces_jointes'],
        ]);

        return response()->json($evenement->load('typeAide'), 201);
    }

    public function show(string $id): JsonResponse
    {
        return response()->json($this->scope->scopeAssociation(EvenementSocial::query())->with('membre', 'typeAide')->findOrFail($id));
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $evenement = $this->scope->scopeAssociation(EvenementSocial::query())->findOrFail($id);
        $evenement->update($request->validate(['description' => ['sometimes', 'nullable', 'string']]));

        return response()->json($evenement);
    }

    public function valider(Request $request, string $id): JsonResponse
    {
        $evenement = $this->scope->scopeAssociation(EvenementSocial::query())->findOrFail($id);
        $this->authorize('update', $evenement);
        if ($evenement->statut !== 'en_attente') {
            return response()->json(['message' => 'Cette demande a déjà été traitée.'], 422);
        }

        $data = $request->validate(['montant_accorde' => ['required', 'numeric', 'min:0']]);

        $evenement->update([
            'statut' => 'approuvee',
            'montant_accorde' => $data['montant_accorde'],
            'approuve_par' => $request->user()->id,
            'approuve_at' => now(),
        ]);

        return response()->json($evenement);
    }

    public function refuser(Request $request, string $id): JsonResponse
    {
        $evenement = $this->scope->scopeAssociation(EvenementSocial::query())->findOrFail($id);
        $this->authorize('update', $evenement);
        if ($evenement->statut !== 'en_attente') {
            return response()->json(['message' => 'Cette demande a déjà été traitée.'], 422);
        }

        $data = $request->validate(['motif' => ['nullable', 'string']]);

        $evenement->update([
            'statut' => 'refusee',
            'refuse_par' => $request->user()->id,
            'motif_refus' => $data['motif'] ?? null,
        ]);

        return response()->json($evenement);
    }

    /**
     * Versement effectif — sortie de la caisse source de l'aide.
     */
    public function verser(Request $request, string $id): JsonResponse
    {
        $evenement = $this->scope->scopeAssociation(EvenementSocial::query())->with('typeAide.caisseSource', 'membre')->findOrFail($id);
        if ($evenement->statut !== 'approuvee') {
            return response()->json(['message' => 'L\'aide doit être approuvée avant versement.'], 422);
        }

        $data = $request->validate([
            'mode_paiement' => ['sometimes', 'nullable', 'string'],
            'details_paiement' => ['sometimes', 'nullable', 'string'],
        ]);

        $caisse = $evenement->typeAide->caisseSource;
        if (! $caisse) {
            return response()->json(['message' => 'Aucune caisse source configurée pour cette catégorie d\'aide.'], 422);
        }

        try {
            $transaction = $this->caisseService->sortie(
                $caisse,
                (float) $evenement->montant_accorde,
                "Aide sociale — {$evenement->membre->nom} {$evenement->membre->prenom}",
                [
                    'reference_type' => 'evenement_social', 'reference_id' => $evenement->id,
                    'created_by' => $request->user()->id, 'valide_par' => $request->user()->id,
                    'mode_paiement' => $data['mode_paiement'] ?? null,
                    'cheque_numero' => $data['details_paiement'] ?? null,
                ]
            );
        } catch (RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        $evenement->update(['statut' => 'versee', 'transaction_id' => $transaction->id, 'date_versement' => now()]);

        return response()->json($evenement);
    }
}
