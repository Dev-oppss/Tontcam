<?php

namespace App\Http\Controllers\Api;

use App\Models\Caisse;
use App\Models\Membre;
use App\Models\Pret;
use App\Services\AccessScopeService;
use App\Services\PretService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use App\Http\Controllers\Controller;

class PretController extends Controller
{
    public function __construct(private AccessScopeService $scope, private PretService $service) {}

    public function index(Request $request): JsonResponse
    {
        $this->authorize('viewAny', Pret::class);
        $query = Pret::whereHas('caisse', fn ($q) => $this->scope->scopeAssociation($q))->with('emprunteur', 'caisse');
        if ($request->filled('statut')) {
            $query->where('statut', $request->statut);
        }
        if ($request->filled('membre_id')) {
            $query->where('emprunteur_id', $request->membre_id);
        }

        return response()->json($query->latest()->paginate($request->integer('per_page', 25)));
    }

    /**
     * POST /prets/import-historique — réservé super_admin (onboarding d'une association
     * qui a déjà des prêts en cours avant d'utiliser l'app).
     */
    public function importHistorique(Request $request): JsonResponse
    {
        if ($request->user()->role !== 'super_admin') {
            return response()->json(['message' => "Réservé au super_admin."], 403);
        }

        $data = $request->validate([
            'caisse_id' => ['required', 'uuid'],
            'emprunteur_id' => ['required', 'uuid'],
            'montant_principal' => ['required', 'numeric', 'min:1'],
            'taux_interet_mensuel' => ['required', 'numeric', 'min:0'],
            'taux_penalite_mensuel' => ['nullable', 'numeric', 'min:0'],
            'methode_amortissement' => ['nullable', 'in:lineaire'],
            'statut' => ['required', 'in:en_cours,en_retard,defaut,solde'],
            'date_demande' => ['required', 'date'],
            'date_approbation' => ['nullable', 'date'],
            'date_debut' => ['nullable', 'date'],
            'date_fin_prevue' => ['nullable', 'date'],
            'date_solde' => ['nullable', 'date'],
            'avaliste_id' => ['nullable', 'uuid'],
            'notes' => ['nullable', 'string'],
            'echeances' => ['required', 'array', 'min:1'],
            'echeances.*.numero_echeance' => ['required', 'integer', 'min:1'],
            'echeances.*.date_echeance' => ['required', 'date'],
            'echeances.*.montant_capital' => ['required', 'numeric', 'min:0'],
            'echeances.*.montant_interet' => ['required', 'numeric', 'min:0'],
            'echeances.*.statut' => ['required', 'in:a_venir,payee,partielle,en_retard,penalisee'],
            'echeances.*.montant_verse' => ['nullable', 'numeric', 'min:0'],
            'echeances.*.date_versement_reel' => ['nullable', 'date'],
        ]);

        $caisse = Caisse::whereHas('association', fn ($q) => $this->scope->scopeAssociation($q))->findOrFail($data['caisse_id']);
        $data['caisse_id'] = $caisse->id;

        $pret = $this->service->importerHistorique($data, $request->user());

        return response()->json($pret->load('emprunteur', 'echeances'), 201);
    }

    /**
     * Dépôt d'une demande de prêt.
     */
    public function store(Request $request): JsonResponse
    {
        $this->authorize('create', Pret::class);
        $data = $request->validate([
            'caisse_id' => ['required', 'uuid'],
            'emprunteur_id' => ['required', 'uuid'],
            'montant_principal' => ['required', 'numeric', 'min:1'],
            'nb_echeances' => ['required', 'integer', 'min:1'],
            'avaliste_id' => ['nullable', 'uuid', 'different:emprunteur_id'],
            'notes' => ['nullable', 'string'],
        ]);

        $caisse = $this->scope->scopeAssociation(Caisse::query())->findOrFail($data['caisse_id']);
        $emprunteur = Membre::where('association_id', $this->scope->associationId())->findOrFail($data['emprunteur_id']);

        try {
            $pret = $this->service->demander($caisse, $emprunteur, $data['montant_principal'], $data['nb_echeances'], [
                ...$data,
                'created_by' => $request->user()->id,
            ]);
        } catch (\RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return response()->json($pret->load('echeances'), 201);
    }

    public function show(string $id): JsonResponse
    {
        $pret = $this->pretScope($id)->load('echeances', 'historique', 'emprunteur', 'avaliste', 'caisse');
        $this->authorize('view', $pret);

        return response()->json($pret);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $pret = $this->pretScope($id);
        $pret->update($request->validate(['notes' => ['sometimes', 'nullable', 'string']]));

        return response()->json($pret);
    }

    public function valider(Request $request, string $id): JsonResponse
    {
        return $this->wrap(fn () => $this->service->valider($this->pretScope($id), $request->user()));
    }

    public function approuver(Request $request, string $id): JsonResponse
    {
        $pret = $this->pretScope($id);
        $this->authorize('approve', $pret);

        return $this->wrap(fn () => $this->service->approuver($pret, $request->user()));
    }

    public function refuser(Request $request, string $id): JsonResponse
    {
        $data = $request->validate(['motif' => ['required', 'string']]);

        return $this->wrap(fn () => $this->service->refuser($this->pretScope($id), $data['motif'], $request->user()));
    }

    public function decaisser(Request $request, string $id): JsonResponse
    {
        $pret = $this->pretScope($id);
        $this->authorize('update', $pret);

        return $this->wrap(fn () => $this->service->decaisser($pret, $request->user()));
    }

    public function rembourser(Request $request, string $id): JsonResponse
    {
        $pret = $this->pretScope($id);
        $data = $request->validate([
            'echeance_id' => ['required', 'uuid'],
            'montant_verse' => ['required', 'numeric', 'min:0.01'],
        ]);
        $echeance = $pret->echeances()->findOrFail($data['echeance_id']);

        return $this->wrap(fn () => $this->service->rembourser($pret, $echeance, $data['montant_verse'], $request->user()));
    }

    public function echeances(string $id): JsonResponse
    {
        $pret = $this->pretScope($id);

        return response()->json($pret->echeances()->orderBy('numero_echeance')->get());
    }

    private function pretScope(string $id): Pret
    {
        return Pret::whereHas('caisse', fn ($q) => $this->scope->scopeAssociation($q))->findOrFail($id);
    }

    private function wrap(callable $fn): JsonResponse
    {
        try {
            return response()->json($fn());
        } catch (\RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }
    }
}
