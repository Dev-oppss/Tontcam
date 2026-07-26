<?php

namespace App\Http\Controllers\Api;

use App\Models\Membre;
use App\Models\OrdreDuJourItem;
use App\Models\Reunion;
use App\Services\AccessScopeService;
use App\Services\ReunionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use App\Http\Controllers\Controller;

class ReunionController extends Controller
{
    public function __construct(private AccessScopeService $scope, private ReunionService $service) {}

    public function index(Request $request): JsonResponse
    {
        $this->authorize('viewAny', Reunion::class);
        return response()->json(
            $this->scope->scopeAssociation(Reunion::query())
                ->with('hote')
                ->orderByDesc('date_reunion')
                ->paginate($request->integer('per_page', 25))
        );
    }

    public function store(Request $request): JsonResponse
    {
        $this->authorize('create', Reunion::class);
        $data = $request->validate([
            'type' => ['required', 'in:ordinaire,extraordinaire,ag,conseil_bureau'],
            'date_reunion' => ['required', 'date'],
            'heure_debut' => ['required'],
            'heure_fin_prevue' => ['nullable'],
            'lieu' => ['required', 'string'],
            'est_domicile_membre' => ['sometimes', 'boolean'],
            'hote_membre_id' => ['nullable', 'uuid'],
            'quorum_requis' => ['nullable', 'integer', 'min:0'],
        ]);
        $data['association_id'] = $this->scope->associationId();

        $reunion = $this->service->planifier($data, $request->user());

        return response()->json($reunion->load('ordreDuJour'), 201);
    }

    public function show(string $id): JsonResponse
    {
        $reunion = $this->scope->scopeAssociation(Reunion::query())
            ->with(['ordreDuJour.rubrique', 'ordreDuJour.rapporteur', 'presences.membre', 'signataires.membre'])
            ->findOrFail($id);

        return response()->json($reunion);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $reunion = $this->scope->scopeAssociation(Reunion::query())->findOrFail($id);

        $reunion->update($request->validate([
            'date_reunion' => ['sometimes', 'date'],
            'heure_debut' => ['sometimes'],
            'lieu' => ['sometimes', 'string'],
            'statut' => ['sometimes', 'in:planifiee,ouverte,tenue,cloturee,annulee'],
            'notes' => ['sometimes', 'nullable', 'string'],
        ]));
        $reunion->load(['ordreDuJour.rubrique', 'ordreDuJour.rapporteur', 'presences.membre', 'signataires.membre']);

        return response()->json($reunion);
    }

    public function ouvrir(string $id): JsonResponse
    {
        $reunion = $this->scope->scopeAssociation(Reunion::query())->findOrFail($id);
        $this->authorize('update', $reunion);
        $reunion->update(['statut' => 'ouverte']);
        $reunion->load(['ordreDuJour.rubrique', 'ordreDuJour.rapporteur', 'presences.membre', 'signataires.membre']);

        return response()->json($reunion);
    }

    /**
     * Saisie groupée des présences : [{ membre_id, statut, heure_arrivee?, motif_absence? }]
     */
    public function presences(Request $request, string $id): JsonResponse
    {
        $reunion = $this->scope->scopeAssociation(Reunion::query())->findOrFail($id);
        $this->authorize('update', $reunion);
        $data = $request->validate([
            'presences' => ['required', 'array'],
            'presences.*.membre_id' => ['required', 'uuid'],
            'presences.*.statut' => ['required', 'in:present,absent_excuse,absent,en_retard'],
            'presences.*.heure_arrivee' => ['nullable'],
            'presences.*.motif_absence' => ['nullable', 'string'],
        ]);

        $resultats = [];
        foreach ($data['presences'] as $p) {
            $membre = Membre::findOrFail($p['membre_id']);
            $resultats[] = $this->service->enregistrerPresence(
                $reunion, $membre, $p['statut'], $p['heure_arrivee'] ?? null, $p['motif_absence'] ?? null, $request->user()
            );
        }

        return response()->json($resultats);
    }

    public function ajouterRapport(Request $request, string $id): JsonResponse
    {
        $item = OrdreDuJourItem::where('reunion_id', $id)->findOrFail($request->input('item_id'));
        $data = $request->validate(['contenu' => ['required', 'string'], 'pieces_jointes' => ['sometimes', 'array']]);

        $item = $this->service->ajouterRapport($item, $data['contenu'], $data['pieces_jointes'] ?? []);

        return response()->json($item);
    }

    /**
     * Ajoute un point libre à l'ordre du jour (hors catalogue de rubriques) — RG-REU.
     */
    public function ajouterPoint(Request $request, string $id): JsonResponse
    {
        $reunion = $this->scope->scopeAssociation(Reunion::query())->findOrFail($id);
        $data = $request->validate([
            'titre' => ['required', 'string', 'max:200'],
            'type' => ['nullable', 'string', 'max:50'],
            'description' => ['nullable', 'string'],
            'acteur_role' => ['nullable', 'string', 'max:50'],
        ]);

        $ordre = OrdreDuJourItem::where('reunion_id', $reunion->id)->max('ordre') + 1;

        $item = OrdreDuJourItem::create([
            'reunion_id' => $reunion->id,
            'libelle_libre' => $data['titre'],
            'type' => $data['type'] ?? null,
            'acteur_role' => $data['acteur_role'] ?? null,
            'ordre' => $ordre,
            'contenu_rapport' => $data['description'] ?? null,
        ]);

        return response()->json($item, 201);
    }

    public function modifierPoint(Request $request, string $id, string $pointId): JsonResponse
    {
        $item = OrdreDuJourItem::whereHas('reunion', fn ($q) => $this->scope->scopeAssociation($q))
            ->where('reunion_id', $id)->findOrFail($pointId);

        $data = $request->validate([
            'titre' => ['sometimes', 'string', 'max:200'],
            'description' => ['sometimes', 'nullable', 'string'],
            'ordre' => ['sometimes', 'integer', 'min:1'],
            'type' => ['sometimes', 'nullable', 'string', 'max:50'],
            'acteur_role' => ['sometimes', 'nullable', 'string', 'max:50'],
            'statut' => ['sometimes', 'string', 'in:prevu,en_cours,traite'],
        ]);

        if (array_key_exists('statut', $data)) {
            $data['rapport_valide'] = $data['statut'] === 'traite';
            unset($data['statut']);
        }

        $item->update($data + array_filter(['libelle_libre' => $request->input('titre'), 'contenu_rapport' => $request->input('description')]));

        return response()->json($item);
    }

    public function supprimerPoint(string $id, string $pointId): JsonResponse
    {
        $item = OrdreDuJourItem::whereHas('reunion', fn ($q) => $this->scope->scopeAssociation($q))
            ->where('reunion_id', $id)->findOrFail($pointId);
        $item->delete();

        return response()->json(['deleted' => true]);
    }

    public function signer(Request $request, string $id): JsonResponse
    {
        $reunion = $this->scope->scopeAssociation(Reunion::query())->findOrFail($id);
        $data = $request->validate(['membre_id' => ['required', 'uuid'], 'role_signature' => ['required', 'string']]);

        $membre = Membre::findOrFail($data['membre_id']);

        try {
            $signature = $this->service->signerPv($reunion, $membre, $data['role_signature']);
        } catch (\RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return response()->json($signature->load('membre'));
    }

    public function destroy(string $id): JsonResponse
    {
        $reunion = $this->scope->scopeAssociation(Reunion::query())->findOrFail($id);
        $this->authorize('delete', $reunion);
        if ($reunion->statut === 'cloturee') {
            return response()->json(['message' => 'Une réunion clôturée ne peut être supprimée.'], 422);
        }
        $reunion->delete();

        return response()->json(['deleted' => true]);
    }
}
