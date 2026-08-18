<?php

namespace App\Http\Controllers\Api;

use App\Models\Tontine;
use App\Models\TontinePart;
use App\Models\Membre;
use App\Models\Caisse;
use App\Services\AccessScopeService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use App\Http\Controllers\Controller;

class TontineController extends Controller
{
    public function __construct(private AccessScopeService $scope) {}

    public function index(Request $request): JsonResponse
    {
        $this->authorize('viewAny', Tontine::class);
        $query = $this->scope->scopeAssociation(Tontine::query())->withCount('parts');

        // Optimisation N+1 (RG-PERF-001) : le bootstrap de l'app chargeait avant
        // parts+cycles via UNE requête GET /tontines/{id} PAR tontine. Avec ?with_details=1
        // tout est chargé ici en une seule requête (même eager-loading que show()).
        if ($request->boolean('with_details')) {
            $query->with([
                'parts.membre', 'parts.avaliste',
                'cycles' => fn ($q) => $q->orderByDesc('numero_cycle'),
                'cycles.encherites.membre', 'cycles.gagnant.membre', 'cycles.bulletin',
            ]);
        }

        return response()->json($query->get());
    }

    public function store(Request $request): JsonResponse
    {
        $this->authorize('create', Tontine::class);
        $data = $request->validate([
            'libelle' => ['required', 'string', 'max:200'],
            'description' => ['nullable', 'string'],
            'montant_part' => ['required', 'numeric', 'min:1'],
            'mode_attribution' => ['required', 'in:rotation,tirage_sort,enchere,calendrier'],
            'nb_parts_total' => ['required', 'integer', 'min:1'],
            'exige_avaliste' => ['sometimes', 'boolean'],
            'pret_autorise' => ['sometimes', 'boolean'],
            'mise_min_enchere' => ['required_if:mode_attribution,enchere', 'nullable', 'numeric'],
            'option_surplus' => ['sometimes', 'in:redistribution,mise_en_caisse'],
            'date_debut' => ['nullable', 'date'],
            'caisse_id' => ['required', 'uuid'],
            'config' => ['sometimes', 'array'],
            'config.periode' => ['sometimes', 'in:hebdomadaire,mensuel,bimestriel,trimestriel'],
            'config.duree_seances' => ['sometimes', 'integer', 'min:1'],
        ]);
        $caisse = $this->validerCaisseTontine($data['caisse_id']);
        $data = $this->preparerPlan($data, (int) $data['nb_parts_total']);
        $data['association_id'] = $this->scope->associationId();
        $data['statut'] = 'active';
        $data['created_by'] = $request->user()->id;

        $tontine = DB::transaction(function () use ($data, $caisse) {
            $tontine = Tontine::create($data);
            $caisse->update(['tontine_id' => $tontine->id]);

            return $tontine;
        });

        return response()->json($tontine, 201);
    }

    public function show(string $id): JsonResponse
    {
        $tontine = $this->scope->scopeAssociation(Tontine::query())
            ->with([
                'parts.membre', 'parts.avaliste',
                // Sans tri explicite, l'ordre des cycles chargés n'est pas garanti (dépend
                // du plan d'exécution SQL) : on force le même ordre que GET /tontines/{id}/cycles.
                'cycles' => fn ($q) => $q->orderByDesc('numero_cycle'),
                'cycles.encherites.membre', 'cycles.gagnant.membre', 'cycles.bulletin',
            ])
            ->findOrFail($id);

        return response()->json($tontine);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $tontine = $this->scope->scopeAssociation(Tontine::query())->findOrFail($id);
        $this->authorize('update', $tontine);

        $data = $request->validate([
            'libelle' => ['sometimes', 'string', 'max:200'],
            'description' => ['sometimes', 'nullable', 'string'],
            'statut' => ['sometimes', 'in:en_preparation,active,suspendue,cloturee'],
            'montant_part' => ['sometimes', 'numeric', 'min:1'],
            'mode_attribution' => ['sometimes', 'in:rotation,tirage_sort,enchere,calendrier'],
            'nb_parts_total' => ['sometimes', 'integer', 'min:1'],
            'exige_avaliste' => ['sometimes', 'boolean'],
            'pret_autorise' => ['sometimes', 'boolean'],
            'mise_min_enchere' => ['sometimes', 'nullable', 'numeric'],
            'option_surplus' => ['sometimes', 'in:redistribution,mise_en_caisse'],
            'date_debut' => ['sometimes', 'nullable', 'date'],
            'caisse_id' => ['sometimes', 'uuid'],
            'config' => ['sometimes', 'array'],
            'config.periode' => ['sometimes', 'in:hebdomadaire,mensuel,bimestriel,trimestriel'],
            'config.duree_seances' => ['sometimes', 'integer', 'min:1'],
        ]);

        // Le mode définit les règles de désignation, le calcul du gain et les
        // traces des cycles. Dès le premier cycle ouvert, le modifier rendrait
        // l'historique incohérent (ex. enchère devenue rotation).
        if (array_key_exists('mode_attribution', $data)
            && $data['mode_attribution'] !== $tontine->mode_attribution
            && $tontine->cycles()->exists()) {
            return response()->json(['message' => 'Le type d’attribution ne peut plus être modifié après le démarrage de la tontine.'], 422);
        }

        if ($tontine->cycles()->exists() && (array_key_exists('nb_parts_total', $data)
            || array_key_exists('config', $data) || array_key_exists('date_debut', $data)
            || array_key_exists('caisse_id', $data))) {
            return response()->json(['message' => 'Le nombre de parts, la durée, la fréquence et la caisse ne peuvent plus être modifiés après le démarrage de la tontine.'], 422);
        }

        $caisse = null;
        if (array_key_exists('caisse_id', $data)) {
            $caisse = $this->validerCaisseTontine($data['caisse_id'], $tontine->id);
        }
        if (array_key_exists('nb_parts_total', $data) && $data['nb_parts_total'] < $tontine->parts()->count()) {
            return response()->json(['message' => 'Le nombre de parts prévues ne peut pas être inférieur aux parts déjà inscrites.'], 422);
        }
        if (array_key_exists('nb_parts_total', $data) || array_key_exists('config', $data) || array_key_exists('date_debut', $data)) {
            $data['config'] = array_replace((array) $tontine->config, (array) ($data['config'] ?? []));
            $data = $this->preparerPlan($data, (int) ($data['nb_parts_total'] ?? $tontine->nb_parts_total));
        }

        DB::transaction(function () use ($tontine, $data, $caisse) {
            if ($caisse && $caisse->id !== $tontine->caisse_id) {
                Caisse::where('tontine_id', $tontine->id)->update(['tontine_id' => null]);
                $caisse->update(['tontine_id' => $tontine->id]);
            }
            $tontine->update($data);
        });

        return response()->json($tontine);
    }

    /**
     * Inscription d'une part sur la tontine, avec avaliste si exigé (RG-TON-006/011/012).
     */
    public function ajouterPart(Request $request, string $id): JsonResponse
    {
        $tontine = $this->scope->scopeAssociation(Tontine::query())->findOrFail($id);
        $this->authorize('update', $tontine);

        $data = $request->validate([
            'membre_id' => ['required', 'uuid'],
            'numero_part' => ['required', 'integer', 'min:1'],
            'ordre_rotation' => ['nullable', 'integer'],
            'date_gain_calendrier' => ['nullable', 'date'],
            'avaliste_id' => [$tontine->exige_avaliste ? 'required' : 'nullable', 'uuid', 'different:membre_id'],
        ]);

        // RG-MBR-003/011 : seuls les membres ACTIF peuvent recevoir une nouvelle part
        // (un membre suspendu conserve ses parts existantes mais n'en acquiert pas).
        $membre = $this->scope->scopeAssociation(Membre::query())->find($data['membre_id']);
        if (! $membre || $membre->statut !== 'actif') {
            return response()->json(['message' => "Seul un membre au statut ACTIF peut recevoir une nouvelle part (RG-MBR-003/011)."], 422);
        }

        // RG-TON-008 : une fois le premier cycle ouvert, la liste des parts est figée —
        // ajouter une part en cours de rotation fausserait l'équité entre bénéficiaires
        // (un membre arrivé tard profiterait des tours restants sans avoir cotisé aux précédents).
        if ($tontine->cycles()->exists()) {
            return response()->json(['message' => "Impossible d'ajouter une part : un cycle a déjà été ouvert sur cette tontine. Une nouvelle part ne peut être créée qu'avant le premier cycle, ou via une décision d'AG dédiée."], 422);
        }

        $data['tontine_id'] = $tontine->id;
        $data['statut'] = 'disponible';

        $part = TontinePart::create($data);

        // nb_parts_total est la "capacité cible" déclarée à la création de la tontine
        // (RG-TON), utilisée par le frontend pour calculer les tours restants. Si le
        // nombre réel de parts dépasse cette cible (ex: des membres ajoutés après coup),
        // elle doit suivre — sinon "Restants" tombe en dessous de "Planifiés" (valeur
        // aberrante, ex: 12 restants pour 14 tours déjà planifiés).
        $nbPartsReelles = $tontine->parts()->count();
        if ($nbPartsReelles > $tontine->nb_parts_total) {
            $plan = $this->preparerPlan(['config' => (array) $tontine->config, 'date_debut' => $tontine->date_debut], $nbPartsReelles);
            $tontine->update(['nb_parts_total' => $nbPartsReelles, ...$plan]);
        }

        return response()->json($part->load('membre', 'avaliste'), 201);
    }

    public function destroy(string $id): JsonResponse
    {
        $tontine = $this->scope->scopeAssociation(Tontine::query())->findOrFail($id);
        if ($tontine->cycles()->exists()) {
            return response()->json(['message' => 'Suppression impossible : des cycles existent déjà.'], 422);
        }
        $tontine->delete();

        return response()->json(['deleted' => true]);
    }

    /**
     * Modification d'une part (avaliste, ordre de rotation) — bloquée si des cotisations existent déjà.
     */
    public function modifierPart(Request $request, string $tontineId, string $partId): JsonResponse
    {
        $tontine = $this->scope->scopeAssociation(Tontine::query())->findOrFail($tontineId);
        $part = $tontine->parts()->findOrFail($partId);

        $data = $request->validate([
            'ordre_rotation' => ['sometimes', 'integer'],
            'date_gain_calendrier' => ['sometimes', 'nullable', 'date'],
            'avaliste_id' => ['sometimes', 'nullable', 'uuid', 'different:membre_id'],
        ]);

        $part->update($data);

        return response()->json($part->load('membre', 'avaliste'));
    }

    /**
     * Retrait d'une part — bloqué si des cotisations ont déjà été enregistrées dessus.
     */
    public function retirerPart(string $tontineId, string $partId): JsonResponse
    {
        $tontine = $this->scope->scopeAssociation(Tontine::query())->findOrFail($tontineId);
        $part = $tontine->parts()->findOrFail($partId);

        if ($part->cotisations()->exists() || $part->statut === 'gagnee') {
            return response()->json(['message' => 'Impossible de retirer cette part : des cotisations ou un gain existent déjà.'], 422);
        }

        $part->delete();

        return response()->json(['deleted' => true]);
    }

    /** RG-CAI-003 : une tontine utilise une caisse TONTINE active, exclusive et de la même association. */
    private function validerCaisseTontine(string $caisseId, ?string $tontineId = null): Caisse
    {
        $caisse = $this->scope->scopeAssociation(Caisse::query())->findOrFail($caisseId);
        if (! $caisse->actif || $caisse->type !== 'tontine') {
            abort(422, 'La caisse liée doit être une caisse Tontine active (RG-CAI-003).');
        }
        if ($caisse->tontine_id && $caisse->tontine_id !== $tontineId) {
            abort(422, 'Cette caisse Tontine est déjà liée à une autre tontine (RG-CAI-003).');
        }

        return $caisse;
    }

    /** Les tours sont les parts ; la durée cible détermine seulement la répartition des cycles par séance. */
    private function preparerPlan(array $data, int $nbParts): array
    {
        $config = (array) ($data['config'] ?? []);
        $duree = max(1, (int) ($config['duree_seances'] ?? $nbParts));
        $config['duree_seances'] = $duree;
        $config['periode'] = $config['periode'] ?? 'mensuel';
        $data['config'] = $config;
        $data['max_cycles_par_reunion'] = (int) ceil($nbParts / $duree);

        if (! empty($data['date_debut'])) {
            $fin = Carbon::parse($data['date_debut']);
            $pas = max(0, $duree - 1);
            $data['date_fin_prevue'] = match ($config['periode']) {
                'hebdomadaire' => $fin->addWeeks($pas)->toDateString(),
                'bimestriel' => $fin->addMonthsNoOverflow($pas * 2)->toDateString(),
                'trimestriel' => $fin->addMonthsNoOverflow($pas * 3)->toDateString(),
                default => $fin->addMonthsNoOverflow($pas)->toDateString(),
            };
        }

        return $data;
    }
}
