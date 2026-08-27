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

        // RG-REU-002 (import historique) : seul le super_admin peut créer une réunion
        // à une date passée ou aujourd'hui, pour permettre l'import de l'historique des
        // associations qui utilisaient déjà un système (papier, etc.) avant l'app.
        // Tous les autres rôles restent soumis à la règle normale (24h de préavis).
        $estImportHistorique = $request->user()->role === 'super_admin';

        $data = $request->validate([
            'type' => ['required', 'in:ordinaire,extraordinaire,ag,conseil_bureau'],
            'date_reunion' => $estImportHistorique
                ? ['required', 'date']
                : ['required', 'date', 'after_or_equal:' . now()->addDay()->format('Y-m-d')],
            'heure_debut' => ['required'],
            'heure_fin_prevue' => ['nullable'],
            'lieu' => ['required', 'string'],
            'est_domicile_membre' => ['sometimes', 'boolean'],
            // RG-REU-003 : un hôte est obligatoire si la réunion se tient au domicile d'un membre.
            'hote_membre_id' => ['nullable', 'uuid', 'required_if:est_domicile_membre,true'],
            'quorum_requis' => ['nullable', 'integer', 'min:0'],
        ]);
        $data['association_id'] = $this->scope->associationId();

        // RG-REU-005 : pas deux réunions (non annulées) le même jour pour l'association.
        $dejaPlanifiee = Reunion::where('association_id', $data['association_id'])
            ->where('date_reunion', $data['date_reunion'])
            ->where('statut', '!=', 'annulee')
            ->exists();
        if ($dejaPlanifiee) {
            return response()->json(['message' => 'Une réunion est déjà planifiée à cette date pour cette association.'], 422);
        }

        // Une réunion importée pour une date passée n'a plus de sens en statut "planifiee" :
        // elle a déjà eu lieu. Le super_admin pourra ensuite y saisir présences/décisions
        // et la clôturer normalement depuis l'UI.
        $estDatePassee = \Illuminate\Support\Carbon::parse($data['date_reunion'])->isPast()
            && ! \Illuminate\Support\Carbon::parse($data['date_reunion'])->isToday();
        $statutInitial = ($estImportHistorique && $estDatePassee) ? 'tenue' : 'planifiee';

        $reunion = $this->service->planifier($data, $request->user(), $statutInitial);

        return response()->json($reunion->load('ordreDuJour'), 201);
    }

    public function show(string $id): JsonResponse
    {
        $reunion = $this->scope->scopeAssociation(Reunion::query())
            ->with(['ordreDuJour.rubrique', 'ordreDuJour.rapporteur', 'presences.membre', 'signataires.membre'])
            ->findOrFail($id);

        return response()->json($reunion);
    }

    /**
     * GET /reunions/{id}/pv-pdf — procès-verbal horodaté en PDF (RG-REU-025).
     */
    public function pvPdf(string $id): JsonResponse
    {
        $reunion = $this->scope->scopeAssociation(Reunion::query())
            ->with(['association', 'hote', 'ordreDuJour.rubrique', 'presences.membre', 'signataires.membre', 'seanceTransactions.membre', 'seanceTransactions.caisse'])
            ->findOrFail($id);

        $pdf = \Barryvdh\DomPDF\Facade\Pdf::loadView('pdf.proces-verbal', ['reunion' => $reunion]);
        $chemin = "proces-verbaux/reunion-{$reunion->id}.pdf";
        \Illuminate\Support\Facades\Storage::disk('public')->put($chemin, $pdf->output());

        return response()->json(['pdf_url' => \Illuminate\Support\Facades\Storage::url($chemin)]);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $reunion = $this->scope->scopeAssociation(Reunion::query())->findOrFail($id);

        $data = $request->validate([
            'date_reunion' => ['sometimes', 'date'],
            'heure_debut' => ['sometimes'],
            'lieu' => ['sometimes', 'string'],
            'statut' => ['sometimes', 'in:planifiee,ouverte,tenue,cloturee,annulee'],
            'notes' => ['sometimes', 'nullable', 'string'],
        ]);

        // RG-REU-006 : un report n'est possible que si la réunion actuelle est encore à plus
        // de 24h — sinon les membres n'ont pas le temps d'être valablement renotifiés.
        $dateChangee = array_key_exists('date_reunion', $data) && $data['date_reunion'] !== $reunion->date_reunion->format('Y-m-d');
        if ($dateChangee) {
            if ($reunion->date_reunion->isFuture() && now()->diffInHours($reunion->date_reunion) < 24) {
                return response()->json(['message' => 'Report impossible : la réunion a lieu dans moins de 24h.'], 422);
            }
            if (\Carbon\Carbon::parse($data['date_reunion'])->startOfDay()->lt(now()->addDay()->startOfDay())) {
                return response()->json(['message' => 'La nouvelle date doit être à au moins 24h de maintenant.'], 422);
            }
        }

        $reunion->update($data);

        if ($dateChangee) {
            // Renotification automatique des membres suite au report (RG-REU-006).
            app(\App\Services\NotificationService::class)->preparerEnvoi($reunion->fresh());
        }

        $reunion->load(['ordreDuJour.rubrique', 'ordreDuJour.rapporteur', 'presences.membre', 'signataires.membre']);

        return response()->json($reunion);
    }

    public function ouvrir(Request $request, string $id): JsonResponse
    {
        $reunion = $this->scope->scopeAssociation(Reunion::query())->findOrFail($id);
        $this->authorize('update', $reunion);

        $data = $request->validate([
            'heure_ouverture_reelle' => ['nullable', 'date_format:H:i,H:i:s'],
            'president_seance' => ['nullable', 'string', 'max:255'],
            'secretaire_seance' => ['nullable', 'string', 'max:255'],
            'mot_ouverture' => ['nullable', 'string'],
        ]);

        $reunion->update([
            'statut' => 'ouverte',
            'heure_ouverture_reelle' => $data['heure_ouverture_reelle'] ?? now()->format('H:i:s'),
            'president_seance' => $data['president_seance'] ?? null,
            'secretaire_seance' => $data['secretaire_seance'] ?? null,
            'mot_ouverture' => $data['mot_ouverture'] ?? null,
        ]);
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
            'presences.*.heure_arrivee' => ['nullable', 'date_format:H:i,H:i:s'],
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
            'titre' => ['nullable', 'string', 'max:200', 'required_without:rubrique_id'],
            'rubrique_id' => ['nullable', 'uuid'],
            'type' => ['nullable', 'string', 'max:50'],
            'description' => ['nullable', 'string'],
            'acteur_role' => ['nullable', 'string', 'max:50'],
        ]);

        $rubrique = !empty($data['rubrique_id'])
            ? $this->scope->scopeAssociation(\App\Models\OrdreDuJourRubrique::query())
                ->where('actif', true)
                ->findOrFail($data['rubrique_id'])
            : null;

        $ordre = OrdreDuJourItem::where('reunion_id', $reunion->id)->max('ordre') + 1;

        $item = OrdreDuJourItem::create([
            'reunion_id' => $reunion->id,
            'rubrique_id' => $rubrique?->id,
            'libelle_libre' => $rubrique ? null : $data['titre'],
            'type' => $data['type'] ?? null,
            'acteur_role' => $data['acteur_role'] ?? null,
            'ordre' => $ordre,
            'contenu_rapport' => $data['description'] ?? null,
        ]);

        return response()->json($item->load('rubrique'), 201);
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

        if (in_array($item->reunion->statut, ['cloturee', 'annulee'], true)) {
            return response()->json(['message' => 'Impossible de modifier l\'ordre du jour d\'une réunion clôturée ou annulée.'], 422);
        }

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

    public function destroy(Request $request, string $id): JsonResponse
    {
        $reunion = $this->scope->scopeAssociation(Reunion::query())->findOrFail($id);
        $this->authorize('delete', $reunion);

        if ($reunion->statut === 'cloturee') {
            return response()->json(['message' => 'Une réunion clôturée ne peut être supprimée.'], 422);
        }

        // RG-REU-026 : on ne supprime pas une réunion qui a déjà un impact financier ou
        // décisionnel tracé (cycle de tontine, transaction de séance, décision d'AG) — dans
        // ce cas seule une annulation motivée est possible, pas une suppression.
        $aDesLiensSensibles = $reunion->cyclesTontine()->exists()
            || $reunion->seanceTransactions()->exists()
            || $reunion->decisionsAg()->exists()
            || \App\Models\SanctionMembre::where('reunion_id', $reunion->id)->exists();

        $data = $request->validate(['motif' => ['nullable', 'string']]);

        if ($aDesLiensSensibles) {
            $reunion->update([
                'statut' => 'annulee',
                'notes' => trim(($reunion->notes ? $reunion->notes."\n" : '')
                    . 'Annulée le '.now()->format('d/m/Y H:i').' : '.($data['motif'] ?? 'motif non précisé')),
            ]);

            return response()->json(['deleted' => false, 'annulee' => true, 'reunion' => $reunion]);
        }

        $reunion->delete();

        return response()->json(['deleted' => true]);
    }
}
