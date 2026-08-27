<?php

namespace App\Http\Controllers\Api;

use App\Models\Caisse;
use App\Models\Transaction;
use App\Services\AccessScopeService;
use App\Services\CaisseService;
use App\Services\Import\TabularFileReader;
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
        $soldeInitial = (float) ($data['solde_initial'] ?? 0);
        $data['solde_actuel'] = 0;
        // Sans ceci, 'actif' n'est jamais passé à Caisse::create() : la colonne prend bien
        // sa valeur DEFAULT TRUE côté SQL, mais l'instance Eloquent en mémoire (renvoyée
        // immédiatement dans la réponse JSON) ne reflète pas ce défaut — elle reste "actif:
        // null". Le frontend traduit alors ça en statut "inactive" dès la création, avant
        // même un rechargement de page, ce qui fait disparaître la caisse des sélecteurs
        // qui filtrent sur statut actif (ex: assignation d'une caisse à une tontine).
        $data['actif'] = true;

        $caisse = Caisse::create($data);
        if ($soldeInitial > 0) {
            $this->service->entree($caisse, $soldeInitial, 'Solde initial de la caisse', [
                'reference_type' => 'solde_initial',
                'created_by' => $request->user()->id,
                'valide_par' => $request->user()->id,
                'date' => $caisse->date_ouverture,
            ]);
            $caisse->refresh();
        }

        return response()->json($caisse, 201);
    }

    public function show(string $id): JsonResponse
    {
        $caisse = $this->scope->scopeAssociation(Caisse::query())->findOrFail($id);
        $this->authorize('view', $caisse);
        return response()->json($caisse);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $caisse = $this->scope->scopeAssociation(Caisse::query())->findOrFail($id);
        $this->authorize('update', $caisse);

        $data = $request->validate([
            'libelle' => ['sometimes', 'string', 'max:200'],
            'description' => ['sometimes', 'nullable', 'string'],
            'type' => ['sometimes', 'in:tontine,mutuelle,scolaire,evenement,annuelle,banque,autre'],
            'pret_autorise' => ['sometimes', 'boolean'],
            'taux_interet_mensuel' => ['sometimes', 'numeric'],
            'taux_penalite_mensuel' => ['sometimes', 'numeric'],
            'seuil_alerte_bas' => ['sometimes', 'nullable', 'numeric'],
            'actif' => ['sometimes', 'boolean'],
            'compte_bancaire_id' => ['sometimes', 'nullable', 'uuid'],
        ]);

        // RG-CAI : une caisse n'est modifiable que tant qu'aucune transaction
        // réelle n'y a été enregistrée. 'actif' reste toujours modifiable
        // (fermeture/réouverture d'une caisse déjà en service).
        if ($caisse->has_transactions) {
            $champsInterdits = array_diff(array_keys($data), ['actif']);
            if (! empty($champsInterdits)) {
                return response()->json([
                    'message' => "Cette caisse a déjà enregistré des transactions, elle n'est plus modifiable (sauf activation/désactivation).",
                ], 422);
            }
        }

        $caisse->update($data);

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
            'mode_paiement' => ['required', 'in:especes,cheque,virement,mobile_money,carte_bancaire'],
            'cheque_numero' => ['required_if:mode_paiement,cheque', 'nullable', 'string'],
        ]);

        if (! empty($data['cheque_numero']) && $caisse->transactions()->where('cheque_numero', $data['cheque_numero'])->exists()) {
            return response()->json(['message' => "Le chèque n°{$data['cheque_numero']} a déjà été saisi sur cette caisse."], 422);
        }

        try {
            $transaction = $data['sens'] === 'entree'
                ? $this->service->entree($caisse, $data['montant'], $data['libelle'], [...$data, 'created_by' => $request->user()->id, 'valide_par' => $request->user()->id])
                : $this->service->sortie($caisse, $data['montant'], $data['libelle'], [...$data, 'created_by' => $request->user()->id, 'valide_par' => $request->user()->id]);
        } catch (\RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return response()->json($transaction, 201);
    }

    /**
     * Reprise du journal existant avant l'adoption de TONTIX. Les écritures
     * sont créées via CaisseService afin de préserver soldes, audit et règles
     * d'interdiction de solde négatif.
     */
    /**
     * Import historique caisses via fichier CSV/XLSX, en plus du JSON existant
     * (importHistorique ci-dessus). Colonnes attendues (insensibles à la casse
     * et aux accents) :
     *   type (entree|sortie|transfert), caisse_id (ou caisse_source_id pour un
     *   transfert), caisse_destination_id (transfert uniquement), montant,
     *   libelle (ou motif pour un transfert), date_transaction, mode_paiement
     *   (entree/sortie uniquement), reference_externe (optionnel), notes (optionnel)
     *
     * Contrairement à importHistorique() (tout ou rien dans une transaction),
     * chaque ligne est traitée indépendamment avec son propre rapport
     * créée/erreur — un fichier importé à la main contient plus souvent des
     * erreurs de saisie ponctuelles qu'un payload JSON généré par un script,
     * bloquer tout le fichier pour une seule ligne fautive serait pénible.
     */
    public function importHistoriqueFichier(Request $request, TabularFileReader $reader): JsonResponse
    {
        if ($request->user()->role !== 'super_admin') {
            return response()->json(['message' => 'Réservé au super_admin.'], 403);
        }
        $request->validate(['fichier' => ['required', 'file', 'mimes:csv,txt,xlsx', 'max:5120']]);

        try {
            $lignes = $reader->lire($request->file('fichier'));
        } catch (\RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        $crees = 0;
        $erreurs = [];
        foreach ($lignes as $i => $ligne) {
            try {
                \Illuminate\Support\Facades\DB::transaction(function () use ($ligne, $request) {
                    $type = strtolower(trim((string) ($ligne['type'] ?? 'entree')));
                    if ($type === 'transfert') {
                        $source = $this->scope->scopeAssociation(Caisse::query())
                            ->findOrFail($ligne['caisse_source_id'] ?? $ligne['caisse_id'] ?? null);
                        $destination = $this->scope->scopeAssociation(Caisse::query())
                            ->findOrFail($ligne['caisse_destination_id'] ?? null);
                        $this->service->transfert($source, $destination, (float) $ligne['montant'], $ligne['libelle'] ?? $ligne['motif'] ?? 'Import historique', $request->user(), [
                            'date' => $ligne['date_transaction'] ?? null, 'created_by' => $request->user()->id, 'valide_par' => $request->user()->id,
                        ]);
                        return;
                    }
                    if (! in_array($type, ['entree', 'sortie'], true)) {
                        throw new \RuntimeException("type invalide : \"{$type}\" (attendu entree, sortie ou transfert).");
                    }
                    $caisse = $this->scope->scopeAssociation(Caisse::query())->findOrFail($ligne['caisse_id'] ?? null);
                    $this->service->{$type}($caisse, (float) ($ligne['montant'] ?? 0), (string) ($ligne['libelle'] ?? 'Import historique'), [
                        'date' => $ligne['date_transaction'] ?? null,
                        'mode_paiement' => $ligne['mode_paiement'] ?? 'especes',
                        'reference_type' => 'import_historique',
                        'reference_externe' => $ligne['reference_externe'] ?? null,
                        'notes' => $ligne['notes'] ?? null,
                        'created_by' => $request->user()->id, 'valide_par' => $request->user()->id,
                    ]);
                });
                $crees++;
            } catch (\Throwable $e) {
                $erreurs[] = ['ligne' => $i + 2, 'donnees' => $ligne, 'erreur' => $e->getMessage()];
            }
        }

        return response()->json(['crees' => $crees, 'erreurs' => $erreurs]);
    }

    public function importHistorique(Request $request): JsonResponse
    {
        if ($request->user()->role !== 'super_admin') {
            return response()->json(['message' => 'Réservé au super_admin.'], 403);
        }
        $data = $request->validate([
            'lignes' => ['required', 'array', 'min:1', 'max:1000'],
            'lignes.*.caisse_id' => ['required', 'uuid'],
            'lignes.*.sens' => ['required', 'in:entree,sortie'],
            'lignes.*.montant' => ['required', 'numeric', 'min:0.01'],
            'lignes.*.libelle' => ['required', 'string', 'max:400'],
            'lignes.*.date_transaction' => ['required', 'date'],
            'lignes.*.mode_paiement' => ['required', 'in:especes,cheque,virement,mobile_money,carte_bancaire'],
            'lignes.*.reference_externe' => ['nullable', 'string', 'max:200'],
            'lignes.*.notes' => ['nullable', 'string'],
            'transferts' => ['sometimes', 'array', 'max:500'],
            'transferts.*.caisse_source_id' => ['required', 'uuid'],
            'transferts.*.caisse_destination_id' => ['required', 'uuid', 'different:transferts.*.caisse_source_id'],
            'transferts.*.montant' => ['required', 'numeric', 'min:0.01'],
            'transferts.*.motif' => ['required', 'string'],
            'transferts.*.date_transaction' => ['required', 'date'],
        ]);

        $resultat = \Illuminate\Support\Facades\DB::transaction(function () use ($data, $request) {
            $transactions = collect($data['lignes'])->sortBy('date_transaction')->map(function (array $ligne) use ($request) {
                $caisse = $this->scope->scopeAssociation(Caisse::query())->findOrFail($ligne['caisse_id']);
                return $this->service->{$ligne['sens']}($caisse, (float) $ligne['montant'], $ligne['libelle'], [
                    'date' => $ligne['date_transaction'], 'mode_paiement' => $ligne['mode_paiement'],
                    'reference_type' => 'import_historique', 'reference_externe' => $ligne['reference_externe'] ?? null,
                    'notes' => $ligne['notes'] ?? null, 'created_by' => $request->user()->id, 'valide_par' => $request->user()->id,
                ]);
            })->values();
            $transferts = collect($data['transferts'] ?? [])->sortBy('date_transaction')->map(function (array $ligne) use ($request) {
                $source = $this->scope->scopeAssociation(Caisse::query())->findOrFail($ligne['caisse_source_id']);
                $destination = $this->scope->scopeAssociation(Caisse::query())->findOrFail($ligne['caisse_destination_id']);
                return $this->service->transfert($source, $destination, (float) $ligne['montant'], $ligne['motif'], $request->user(), [
                    'date' => $ligne['date_transaction'], 'created_by' => $request->user()->id, 'valide_par' => $request->user()->id,
                ])['transfert'];
            })->values();
            return compact('transactions', 'transferts');
        });

        return response()->json($resultat, 201);
    }

    public function transferts(Request $request): JsonResponse
    {
        $this->authorize('viewAny', Caisse::class);
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
        $this->authorize('update', $source);
        $this->authorize('update', $destination);

        // RG-CAI-016 : au-delà du seuil, aucune écriture ne part en caisse avant
        // l'approbation explicite du Président.
        $seuil = (float) ($source->association->seuil_approbation_caisse ?? PHP_INT_MAX);
        if ((float) $data['montant'] > $seuil) {
            $transfert = \App\Models\TransfertCaisse::create([
                'caisse_source_id' => $source->id, 'caisse_destination_id' => $destination->id,
                'montant' => $data['montant'], 'motif' => $data['motif'], 'statut' => 'en_attente',
                'demande_par' => $request->user()->id, 'demande_at' => now(),
            ]);
            return response()->json($transfert, 202);
        }

        try {
            $result = $this->service->transfert($source, $destination, $data['montant'], $data['motif'], $request->user());
        } catch (\RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return response()->json($result, 201);
    }

    public function approuverTransfert(Request $request, string $id): JsonResponse
    {
        if (! in_array($request->user()->role, ['president', 'super_admin'], true)) abort(403);
        $transfert = \App\Models\TransfertCaisse::whereHas('caisseSource', fn ($q) => $this->scope->scopeAssociation($q))->findOrFail($id);
        if ($transfert->statut !== 'en_attente') return response()->json(['message' => 'Ce transfert n’est plus en attente.'], 422);

        try {
            $resultat = $this->service->transfert($transfert->caisseSource, $transfert->caisseDestination, (float) $transfert->montant, $transfert->motif, $request->user(), ['transfert' => $transfert]);
        } catch (\RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }
        return response()->json($resultat);
    }

    public function journal(Request $request, string $id): JsonResponse
    {
        $caisse = $this->scope->scopeAssociation(Caisse::query())->findOrFail($id);
        $this->authorize('view', $caisse);

        $query = $caisse->transactions()->orderByDesc('date_transaction');
        if ($request->filled('type')) {
            $query->where('type', $request->type);
        }
        if ($request->filled('du') && $request->filled('au')) {
            $query->whereBetween('date_transaction', [$request->du, $request->au]);
        }

        return response()->json($query->paginate($request->integer('per_page', 50)));
    }

    /** Journal consolidé de toutes les caisses de l'association. */
    public function journalGlobal(Request $request): JsonResponse
    {
        $this->authorize('viewAny', Caisse::class);

        $query = Transaction::query()
            ->whereHas('caisse', fn ($q) => $this->scope->scopeAssociation($q))
            ->with('caisse:id,libelle')
            ->orderByDesc('date_transaction')
            ->orderByDesc('id');

        if ($request->filled('caisse_id')) $query->where('caisse_id', $request->caisse_id);
        if ($request->filled('type')) $query->where('type', $request->type);
        if ($request->filled('du') && $request->filled('au')) $query->whereBetween('date_transaction', [$request->du, $request->au]);

        return response()->json($query->paginate(min($request->integer('per_page', 100), 500)));
    }
}
