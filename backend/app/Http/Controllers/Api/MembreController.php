<?php

namespace App\Http\Controllers\Api;

use App\Models\Membre;
use App\Services\AccessScopeService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use App\Http\Controllers\Controller;

class MembreController extends Controller
{
    public function __construct(private AccessScopeService $scope) {}

    public function index(Request $request): JsonResponse
    {
        $this->authorize('viewAny', Membre::class);
        $query = $this->scope->scopeAssociation(Membre::query());

        if ($request->filled('statut')) {
            $query->where('statut', $request->statut);
        }
        if ($request->filled('q')) {
            $q = $request->q;
            $query->where(fn ($w) => $w->where('nom', 'ilike', "%{$q}%")->orWhere('prenom', 'ilike', "%{$q}%")->orWhere('telephone', 'ilike', "%{$q}%"));
        }

        return response()->json($query->orderBy('nom')->paginate($request->integer('per_page', 25)));
    }

    public function store(Request $request): JsonResponse
    {
        $this->authorize('create', Membre::class);
        $data = $request->validate([
            'nom' => ['required', 'string', 'max:100'],
            'prenom' => ['required', 'string', 'max:100'],
            'date_naissance' => ['nullable', 'date'],
            'sexe' => ['nullable', 'in:M,F,A'],
            'telephone' => ['required', 'string', 'max:30'],
            'email' => ['nullable', 'email'],
            'adresse' => ['nullable', 'string'],
            'ville' => ['nullable', 'string', 'max:100'],
            'profession' => ['nullable', 'string', 'max:150'],
            'date_adhesion' => ['nullable', 'date', 'before_or_equal:today'],
        ]);

        $data['association_id'] = $this->scope->associationId();
        $data['statut'] = 'en_attente';

        $membre = Membre::create($data);

        return response()->json($membre, 201);
    }

    /**
     * Import CSV en masse (RG-MBR — colonnes attendues : nom,prenom,telephone,email,date_adhesion).
     */
    public function importCsv(Request $request): JsonResponse
    {
        $request->validate(['fichier' => ['required', 'file', 'mimes:csv,txt']]);

        $associationId = $this->scope->associationId();
        $handle = fopen($request->file('fichier')->getRealPath(), 'r');
        $headers = fgetcsv($handle);
        $crees = 0;
        $erreurs = [];

        while (($row = fgetcsv($handle)) !== false) {
            $ligne = array_combine($headers, $row);
            try {
                Membre::create([
                    'association_id' => $associationId,
                    'nom' => $ligne['nom'],
                    'prenom' => $ligne['prenom'],
                    'telephone' => $ligne['telephone'],
                    'email' => $ligne['email'] ?? null,
                    'date_adhesion' => $ligne['date_adhesion'] ?? now()->toDateString(),
                    'statut' => 'en_attente',
                ]);
                $crees++;
            } catch (\Throwable $e) {
                $erreurs[] = ['ligne' => $ligne, 'erreur' => $e->getMessage()];
            }
        }
        fclose($handle);

        return response()->json(['crees' => $crees, 'erreurs' => $erreurs], 201);
    }

    public function show(string $id): JsonResponse
    {
        $membre = $this->scope->scopeAssociation(Membre::query())
            ->with(['mandats.poste', 'parts.tontine', 'prets', 'sanctions.type', 'assurances'])
            ->findOrFail($id);
        $this->authorize('view', $membre);

        return response()->json($membre);
    }

    /**
     * Situation financière complète du membre (RG-MBR-016).
     */
    public function situation(string $id): JsonResponse
    {
        $membre = $this->scope->scopeAssociation(Membre::query())->findOrFail($id);

        return response()->json([
            'membre' => $membre,
            'cotisations' => \App\Models\CotisationTontine::where('membre_id', $membre->id)->latest()->limit(50)->get(),
            'prets' => $membre->prets()->with('echeances')->get(),
            'sanctions' => $membre->sanctions()->with('type')->get(),
            'gains' => \App\Models\BulletinGain::where('gagnant_membre_id', $membre->id)->get(),
            'score' => $this->calculerScore($membre),
        ]);
    }

    /**
     * Score_membre = (Taux_participation × 0.4) + (Taux_régularité × 0.6) (cahier des charges 5.4).
     */
    private function calculerScore(Membre $membre): array
    {
        $reunionsTenues = \App\Models\Presence::where('membre_id', $membre->id)->count();
        $reunionsPresent = \App\Models\Presence::where('membre_id', $membre->id)->where('statut', 'present')->count();
        $tauxParticipation = $reunionsTenues > 0 ? round(($reunionsPresent / $reunionsTenues) * 100, 1) : 0;

        $cotisationsDues = \App\Models\CotisationTontine::where('membre_id', $membre->id)->count();
        $cotisationsATemps = \App\Models\CotisationTontine::where('membre_id', $membre->id)->where('statut', 'payee')->count();
        $tauxRegularite = $cotisationsDues > 0 ? round(($cotisationsATemps / $cotisationsDues) * 100, 1) : 0;

        return [
            'taux_participation' => $tauxParticipation,
            'taux_regularite' => $tauxRegularite,
            'score' => round(($tauxParticipation * 0.4) + ($tauxRegularite * 0.6), 1),
        ];
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $membre = $this->scope->scopeAssociation(Membre::query())->findOrFail($id);
        $this->authorize('update', $membre);

        $membre->update($request->validate([
            'nom' => ['sometimes', 'string', 'max:100'],
            'prenom' => ['sometimes', 'string', 'max:100'],
            'telephone' => ['sometimes', 'string', 'max:30'],
            'email' => ['sometimes', 'nullable', 'email'],
            'adresse' => ['sometimes', 'nullable', 'string'],
            'profession' => ['sometimes', 'nullable', 'string', 'max:150'],
            'statut' => ['sometimes', 'in:actif,suspendu,exclu,en_attente'],
            'motif_suspension' => ['sometimes', 'nullable', 'string'],
            'motif_exclusion' => ['sometimes', 'nullable', 'string'],
        ]));

        return response()->json($membre);
    }

    public function destroy(string $id): JsonResponse
    {
        $membre = $this->scope->scopeAssociation(Membre::query())->findOrFail($id);
        $this->authorize('delete', $membre);

        // RG-MBR-006 : suppression bloquée si des transactions existent déjà
        $aDesTransactions = $membre->prets()->exists() || $membre->sanctions()->exists() || $membre->parts()->exists();
        if ($aDesTransactions) {
            return response()->json(['message' => 'Suppression impossible : ce membre a un historique financier. Utilisez le statut « exclu ».'], 422);
        }

        $membre->delete();

        return response()->json(['deleted' => true]);
    }
}
