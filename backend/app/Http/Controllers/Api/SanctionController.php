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
use App\Http\Controllers\Api\Concerns\AssertSeanceOuverte;

class SanctionController extends Controller
{
    use AssertSeanceOuverte;
    use \App\Http\Controllers\Api\Concerns\FormateErreurImport;

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
            'reunion_id' => ['required', 'uuid'],
        ]);

        $membre = Membre::where('association_id', $this->scope->associationId())->findOrFail($data['membre_id']);
        $type = TypeSanction::where('association_id', $this->scope->associationId())->findOrFail($data['type_sanction_id']);
        $reunion = \App\Models\Reunion::where('association_id', $this->scope->associationId())->findOrFail($data['reunion_id']);

        try {
            $this->assertSeanceOuverte($reunion);
        } catch (\RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        $sanction = $this->service->appliquerManuelle($membre, $type, $data['motif'], $request->user(), $reunion);

        return response()->json($sanction->load('type'), 201);
    }

    /**
     * POST /sanctions/import-historique — réservé super_admin (onboarding d'une association
     * qui a déjà appliqué des sanctions avant d'utiliser l'app).
     */
    public function importHistorique(Request $request): JsonResponse
    {
        if ($request->user()->role !== 'super_admin') {
            return response()->json(['message' => "Réservé au super_admin."], 403);
        }

        $data = $request->validate([
            'membre_id' => ['required', 'uuid'],
            'type_sanction_id' => ['required', 'uuid'],
            'motif' => ['required', 'string'],
            'date_application' => ['required', 'date'],
            'reunion_id' => ['nullable', 'uuid'],
            'paiement' => ['nullable', 'array'],
            'paiement.caisse_id' => ['required_with:paiement', 'uuid'],
            'paiement.date' => ['nullable', 'date'],
        ]);

        $membre = Membre::where('association_id', $this->scope->associationId())->findOrFail($data['membre_id']);
        $type = TypeSanction::where('association_id', $this->scope->associationId())->findOrFail($data['type_sanction_id']);
        $reunion = !empty($data['reunion_id']) ? \App\Models\Reunion::findOrFail($data['reunion_id']) : null;

        $sanction = $this->service->importerHistorique(
            $membre, $type, $data['motif'], $data['date_application'], $request->user(), $reunion, $data['paiement'] ?? null
        );

        return response()->json($sanction->load('type'), 201);
    }

    /**
     * Import via fichier CSV/XLSX, une ligne par sanction. Colonnes attendues :
     * membre_id, type_sanction_id, motif, date_application, reunion_id
     * (optionnel), paiement_caisse_id (optionnel - marque la sanction payee
     * immediatement si renseigne), paiement_date (optionnel).
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

        $crees = 0;
        $erreurs = [];
        foreach ($lignes as $i => $ligne) {
            try {
                if (! empty($ligne['membre_id'])) { $ligne['membre_id'] = $resolveur->membre($ligne['membre_id']); }
                if (! empty($ligne['type_sanction_id'])) { $ligne['type_sanction_id'] = $resolveur->typeSanction($ligne['type_sanction_id']); }
                if (! empty($ligne['reunion_id'])) { $ligne['reunion_id'] = $resolveur->reunion($ligne['reunion_id']); }
                if (! empty($ligne['paiement_caisse_id'])) { $ligne['paiement_caisse_id'] = $resolveur->caisse($ligne['paiement_caisse_id']); }
                if (! empty($ligne['date_application'])) { $ligne['date_application'] = $resolveur->date($ligne['date_application']); }
                if (! empty($ligne['paiement_date'])) { $ligne['paiement_date'] = $resolveur->date($ligne['paiement_date']); }
                $validee = \Illuminate\Support\Facades\Validator::make($ligne, [
                    'membre_id' => ['required', 'uuid'],
                    'type_sanction_id' => ['required', 'uuid'],
                    'motif' => ['required', 'string'],
                    'date_application' => ['required', 'date'],
                    'reunion_id' => ['nullable', 'uuid'],
                    'paiement_caisse_id' => ['nullable', 'uuid'],
                    'paiement_date' => ['nullable', 'date'],
                ])->validate();

                $m = Membre::where('association_id', $this->scope->associationId())->findOrFail($validee['membre_id']);
                $t = TypeSanction::where('association_id', $this->scope->associationId())->findOrFail($validee['type_sanction_id']);
                $r = ! empty($validee['reunion_id']) ? \App\Models\Reunion::findOrFail($validee['reunion_id']) : null;
                $paiement = ! empty($validee['paiement_caisse_id'])
                    ? ['caisse_id' => $validee['paiement_caisse_id'], 'date' => $validee['paiement_date'] ?? null]
                    : null;

                $this->service->importerHistorique($m, $t, $validee['motif'], $validee['date_application'], $request->user(), $r, $paiement);
                $crees++;
            } catch (\Throwable $e) {
                $erreurs[] = ['ligne' => $i + 2, 'donnees' => $ligne, 'erreur' => $this->messageLisible($e)];
            }
        }

        return response()->json(['crees' => $crees, 'erreurs' => $erreurs]);
    }

    public function show(string $id): JsonResponse
    {
        return response()->json($this->scope->scopeAssociation(SanctionMembre::query())->with('membre', 'type')->findOrFail($id));
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $sanction = $this->scope->scopeAssociation(SanctionMembre::query())->findOrFail($id);
        $this->authorize('update', $sanction);

        if (in_array($sanction->statut, ['payee', 'annulee'], true)) {
            return response()->json(['message' => 'Sanction déjà clôturée.'], 422);
        }

        $data = $request->validate(['statut' => ['sometimes', 'in:annulee'], 'motif_annulation' => ['required_if:statut,annulee', 'string']]);
        if (($data['statut'] ?? null) === 'annulee') {
            if (! in_array($request->user()->role, ['president', 'super_admin'], true)) {
                return response()->json(['message' => "Seul le président peut annuler une sanction."], 403);
            }
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
