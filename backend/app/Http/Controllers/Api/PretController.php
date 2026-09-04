<?php

namespace App\Http\Controllers\Api;

use App\Models\Caisse;
use App\Models\Membre;
use App\Models\Pret;
use App\Models\Reunion;
use App\Services\AccessScopeService;
use App\Services\PretService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use App\Http\Controllers\Controller;
use App\Http\Controllers\Api\Concerns\AssertSeanceOuverte;

class PretController extends Controller
{
    use AssertSeanceOuverte;
    use \App\Http\Controllers\Api\Concerns\FormateErreurImport;

    public function __construct(private AccessScopeService $scope, private PretService $service) {}

    public function index(Request $request): JsonResponse
    {
        $this->authorize('viewAny', Pret::class);
        $query = Pret::whereHas('caisse', fn ($q) => $this->scope->scopeAssociation($q))->with('emprunteur', 'caisse', 'avaliste');
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
     * Import via fichier CSV/XLSX. Une ligne = une échéance ; les colonnes du
     * prêt (caisse_id, emprunteur_id, montant_principal, ...) sont répétées
     * sur chaque ligne d'un même prêt et regroupées via la colonne
     * "pret_ref" (identifiant libre choisi par l'utilisateur, propre au
     * fichier — pas stocké en base, juste utilisé pour reconstituer les
     * groupes de lignes appartenant au même prêt avant import).
     * Colonnes échéance : numero_echeance, date_echeance, montant_capital,
     * montant_interet, statut_echeance, montant_verse (optionnel),
     * date_versement_reel (optionnel).
     */
    public function importHistoriqueFichier(Request $request, \App\Services\Import\TabularFileReader $reader, \App\Services\Import\ImportResolver $resolveur): JsonResponse
    {
        if ($request->user()->role !== 'super_admin') {
            return response()->json(['message' => "Réservé au super_admin."], 403);
        }
        $request->validate(['fichier' => ['required', 'file', 'mimes:csv,txt,xlsx', 'max:5120']]);

        try {
            $lignes = $reader->lire($request->file('fichier'));
        } catch (\RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        $groupes = [];
        foreach ($lignes as $i => $ligne) {
            $ref = trim((string) ($ligne['pret_ref'] ?? ''));
            if ($ref === '') {
                $ref = "__ligne_seule_{$i}"; // pas de regroupement voulu : 1 ligne = 1 pret a 1 seule echeance
            }
            $groupes[$ref]['lignes_source'][] = $i + 2;
            $groupes[$ref]['pret'] ??= $ligne; // les infos du pret viennent de la 1ere ligne du groupe
            $groupes[$ref]['echeances'][] = $ligne;
        }

        $crees = 0;
        $erreurs = [];
        foreach ($groupes as $ref => $groupe) {
            try {
                $pretLigne = $groupe['pret'];
                // Noms/dates lisibles acceptés en plus des UUID/ISO stricts.
                foreach (['caisse_id', 'emprunteur_id', 'avaliste_id'] as $champ) {
                    if (! empty($pretLigne[$champ])) {
                        $pretLigne[$champ] = $champ === 'caisse_id' ? $resolveur->caisse($pretLigne[$champ]) : $resolveur->membre($pretLigne[$champ]);
                    }
                }
                foreach (['date_demande', 'date_debut'] as $champ) {
                    if (! empty($pretLigne[$champ])) {
                        $pretLigne[$champ] = $resolveur->date($pretLigne[$champ]);
                    }
                }
                $data = \Illuminate\Support\Facades\Validator::make($pretLigne, [
                    'caisse_id' => ['required', 'uuid'],
                    'emprunteur_id' => ['required', 'uuid'],
                    'montant_principal' => ['required', 'numeric', 'min:1'],
                    'taux_interet_mensuel' => ['required', 'numeric', 'min:0'],
                    'taux_penalite_mensuel' => ['nullable', 'numeric', 'min:0'],
                    'statut' => ['required', 'in:en_cours,en_retard,defaut,solde'],
                    'date_demande' => ['required', 'date'],
                    'date_debut' => ['nullable', 'date'],
                    'avaliste_id' => ['nullable', 'uuid'],
                    'notes' => ['nullable', 'string'],
                ])->validate();

                $echeances = collect($groupe['echeances'])->map(function ($e) use ($resolveur) {
                    foreach (['date_echeance', 'date_versement_reel'] as $champ) {
                        if (! empty($e[$champ])) {
                            $e[$champ] = $resolveur->date($e[$champ]);
                        }
                    }
                    return \Illuminate\Support\Facades\Validator::make($e, [
                        'numero_echeance' => ['required', 'integer', 'min:1'],
                        'date_echeance' => ['required', 'date'],
                        'montant_capital' => ['required', 'numeric', 'min:0'],
                        'montant_interet' => ['required', 'numeric', 'min:0'],
                        'statut_echeance' => ['required', 'in:a_venir,payee,partielle,en_retard,penalisee'],
                        'montant_verse' => ['nullable', 'numeric', 'min:0'],
                        'date_versement_reel' => ['nullable', 'date'],
                    ])->validate();
                })->map(fn ($e) => [
                    'numero_echeance' => (int) $e['numero_echeance'],
                    'date_echeance' => $e['date_echeance'],
                    'montant_capital' => (float) $e['montant_capital'],
                    'montant_interet' => (float) $e['montant_interet'],
                    'statut' => $e['statut_echeance'],
                    'montant_verse' => (($e['montant_verse'] ?? '') !== '') ? (float) $e['montant_verse'] : 0,
                    'date_versement_reel' => (($e['date_versement_reel'] ?? '') !== '') ? $e['date_versement_reel'] : null,
                ])->values()->all();

                $caisse = Caisse::whereHas('association', fn ($q) => $this->scope->scopeAssociation($q))->findOrFail($data['caisse_id']);
                $data['caisse_id'] = $caisse->id;
                $data['echeances'] = $echeances;

                $this->service->importerHistorique($data, $request->user());
                $crees++;
            } catch (\Throwable $e) {
                $erreurs[] = ['pret_ref' => $ref, 'lignes' => $groupe['lignes_source'], 'erreur' => $this->messageLisible($e)];
            }
        }

        return response()->json(['crees' => $crees, 'erreurs' => $erreurs]);
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
            'garantie_type' => ['nullable', 'in:caution_membre,blocage_epargne,retenue_tontine,aucune'],
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

        $data = $request->validate(['reunion_id' => ['required', 'uuid']]);
        $reunion = Reunion::where('association_id', $this->scope->associationId())->findOrFail($data['reunion_id']);

        return $this->wrap(function () use ($pret, $reunion, $request) {
            $this->assertSeanceOuverte($reunion);

            return $this->service->decaisser($pret, $request->user(), $reunion);
        });
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

    /**
     * Remboursement « libre » : le trésorier saisit un montant global (ex : solder
     * le prêt en une fois alors qu'il reste plusieurs mensualités). Contrairement à
     * rembourser() qui n'impute qu'une seule échéance précise, ce montant est réparti
     * sur les échéances impayées les plus anciennes d'abord (capital + intérêt de
     * chacune) — voir PretService::rembourserLibre(). Corrige le bug où un paiement
     * couvrant plusieurs mensualités n'en soldait qu'une seule, laissant les
     * suivantes affichées comme dues alors que l'argent avait déjà été encaissé.
     */
    public function rembourserLibre(Request $request, string $id): JsonResponse
    {
        $pret = $this->pretScope($id);
        $data = $request->validate([
            'montant' => ['required', 'numeric', 'min:0.01'],
            'mode_paiement' => ['nullable', 'in:especes,cheque,virement,mobile_money,carte_bancaire'],
            'reference_paiement' => ['nullable', 'string', 'max:100'],
        ]);

        return $this->wrap(fn () => [
            'echeances' => $this->service->rembourserLibre(
                $pret, (float) $data['montant'], $request->user(), true,
                ['mode_paiement' => $data['mode_paiement'] ?? null, 'reference_paiement' => $data['reference_paiement'] ?? null]
            ),
            'pret' => $pret->fresh('echeances'),
        ]);
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
