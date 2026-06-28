<?php

namespace App\Http\Controllers\Api;

use App\Models\CycleTontine;
use App\Models\Tontine;
use App\Services\BulletinGainService;
use App\Services\TontineCycleService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Gestion des cycles de tontine (session par réunion).
 *
 * Règles couvertes :
 *   RG-TON-028 : Cycle ouvert uniquement si réunion ouverte.
 *   RG-TON-029 : Un seul cycle actif par tontine et par réunion.
 *   RG-TON-030–032 : Saisie des cotisations, cotisation non saisie → IMPAYEE.
 *   RG-TON-033 : Cycle clôturé → aucune modification des cotisations.
 *   RG-TON-034–041 : Bulletin de gain : gain brut, retenues ordonnées, montant net, signatures.
 *   RG-TON-013–027 : Modes d'attribution (rotation, tirage_sort, enchere, calendrier).
 *   RG-TON-010 : Part gagnée → statut GAGNEE, continue de cotiser.
 *   RG-TON-006 / RG-TON-011 : Avaliste requis avant versement si paramétré.
 *   RG-TON-021–025 : Surplus enchère → redistribution ou caisse.
 */
class CycleTontineController extends CrudController
{
    protected string $model = CycleTontine::class;
    protected array $filterable = ['tontine_id', 'statut'];

    public function bulletinPdf(Request $request, string $id): JsonResponse
    {
        $cycle = CycleTontine::findOrFail($id);
        $bulletin = $cycle->bulletin;
        if (! $bulletin) {
            return response()->json(['message' => 'Aucun bulletin disponible.'], 404);
        }

        $pdfUrl = app(BulletinGainService::class)->genererPdf($bulletin);
        return response()->json(['pdf_url' => $pdfUrl]);
    }

    /**
     * Ouverture d'un nouveau cycle.
     * RG-TON-028 : réunion doit être OUVERTE.
     * RG-TON-029 : un seul cycle actif par tontine.
     */
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'reunion_id' => ['required', 'uuid'],
            'tontine_id' => ['nullable', 'uuid'],
        ]);

        $tontineId = $request->route('id') ?? $data['tontine_id'] ?? null;

        if (! $tontineId) {
            return response()->json(['message' => 'L\'identifiant de la tontine est requis.'], 422);
        }

        $tontine = Tontine::findOrFail($tontineId);

        // RG-TON-028 : vérifier que la réunion est ouverte
        $reunion = \App\Models\Reunion::findOrFail($data['reunion_id']);
        if ($reunion->statut !== 'ouverte') {
            return response()->json([
                'message' => 'Un cycle ne peut être ouvert que dans le cadre d\'une réunion ouverte.',
            ], 422);
        }

        // RG-TON-029 : pas deux cycles actifs simultanément pour la même tontine
        $cycleActif = CycleTontine::where('tontine_id', $tontine->id)
            ->where('statut', 'en_cours')
            ->exists();

        if ($cycleActif) {
            return response()->json([
                'message' => 'Cette tontine a déjà un cycle en cours. Clôturez-le avant d\'en ouvrir un nouveau.',
            ], 422);
        }

        // RG-TON-029 : un seul cycle par réunion par tontine
        $dejaOuvert = CycleTontine::where('tontine_id', $tontine->id)
            ->where('reunion_id', $data['reunion_id'])
            ->exists();

        if ($dejaOuvert) {
            return response()->json([
                'message' => 'Un cycle a déjà été ouvert pour cette tontine lors de cette réunion.',
            ], 422);
        }

        $cycle = app(TontineCycleService::class)->ouvrirCycle($tontine, $data['reunion_id']);
        return response()->json($cycle, 201);
    }

    /**
     * Actions sur un cycle en cours.
     */
    public function update(Request $request, string $id): JsonResponse
    {
        $cycle   = CycleTontine::findOrFail($id);
        $service = app(TontineCycleService::class);
        $path    = $request->path();

        // ── Saisie de cotisation ──────────────────────────────────────────
        // RG-TON-030, RG-TON-033 : impossible si cycle clôturé
        if (str_ends_with($path, 'cotisations')) {
            if ($cycle->statut === 'clos') {
                return response()->json([
                    'message' => 'Impossible de modifier les cotisations d\'un cycle clôturé.',
                ], 422);
            }

            $data = $request->validate([
                'tontine_part_id' => ['required', 'uuid'],
                'montant'         => ['required', 'numeric', 'min:0'],
            ]);

            return response()->json(
                $service->saisirCotisation($cycle, $data['tontine_part_id'], (float) $data['montant'])
            );
        }

        // ── Désignation du gagnant ────────────────────────────────────────
        // RG-TON-013–027 : selon le mode d'attribution de la tontine
        if (str_ends_with($path, 'designer-gagnant')) {
            if ($cycle->statut === 'clos') {
                return response()->json([
                    'message' => 'Ce cycle est déjà clôturé.',
                ], 422);
            }

            $tontine = $cycle->tontine;

            // Mode ENCHERE : offre obligatoire
            if ($tontine->mode_attribution === 'enchere') {
                $data = $request->validate([
                    'tontine_part_id' => ['required', 'uuid'],
                    'montant_offre'   => ['required', 'numeric', 'min:1'],
                ]);

                // RG-TON-019 : offre ≥ montant collecté standard
                $montantStandard = $tontine->montant_part * $tontine->parts()->where('statut', 'disponible')->count();
                if ($data['montant_offre'] < $montantStandard) {
                    return response()->json([
                        'message' => "L'offre doit être au moins égale au montant collecté standard ({$montantStandard}).",
                    ], 422);
                }

                return response()->json(
                    $service->designerGagnant($cycle, $data['tontine_part_id'], ['montant_offre' => $data['montant_offre']])
                );
            }

            // Mode ROTATION / TIRAGE_SORT / CALENDRIER
            $tontinePartId = $request->input('tontine_part_id');

            // Mode TIRAGE_SORT : le système tire au sort (RG-TON-015–016)
            if ($tontine->mode_attribution === 'tirage_sort' && ! $tontinePartId) {
                return response()->json($service->designerGagnant($cycle, null));
            }

            // RG-TON-006 : avaliste requis avant désignation du gagnant
            if ($tontine->avaliste_requis && $tontinePartId) {
                $part = \App\Models\TontinePart::findOrFail($tontinePartId);
                if (empty($part->avaliste_id)) {
                    return response()->json([
                        'message' => 'Un avaliste valide est requis pour cette part avant de désigner le gagnant.',
                    ], 422);
                }
            }

            return response()->json($service->designerGagnant($cycle, $tontinePartId));
        }

        // ── Clôture du cycle ─────────────────────────────────────────────
        // RG-TON-032 : clôture possible même si cotisations impayées
        if (str_ends_with($path, 'cloturer')) {
            if ($cycle->statut === 'clos') {
                return response()->json(['message' => 'Ce cycle est déjà clôturé.'], 422);
            }

            // RG-TON-030 : marquer non saisies comme IMPAYEES avant clôture
            if (method_exists($service, 'marquerImpayes')) {
                $service->marquerImpayes($cycle);
            }

            return response()->json($service->cloturerCycle($cycle));
        }

        // ── Génération du bulletin de gain ────────────────────────────────
        // RG-TON-034–040 : gain brut, retenues ordonnées (RG-TON-036), net, signatures
        if (str_ends_with($path, 'bulletin')) {
            if (! $cycle->gagnant_part_id) {
                return response()->json([
                    'message' => 'Aucun gagnant désigné pour ce cycle. Désignez le gagnant avant de générer le bulletin.',
                ], 422);
            }

            // RG-TON-006 : vérifier avaliste si requis
            if ($cycle->tontine->avaliste_requis) {
                $partGagnante = $cycle->tontine->parts()->find($cycle->gagnant_part_id);
                if ($partGagnante && empty($partGagnante->avaliste_id)) {
                    return response()->json([
                        'message' => 'Un avaliste valide est requis avant de générer le bulletin de gain.',
                    ], 422);
                }
            }

            $retenues = $request->input('retenues', []);

            $bulletin = app(BulletinGainService::class)->generer(
                $cycle,
                $retenues,
                $request->user()?->id
            );

            // RG-TON-037 : gain net < 0 → versement suspendu
            if (isset($bulletin['gain_net']) && $bulletin['gain_net'] < 0) {
                return response()->json(array_merge($bulletin->toArray(), [
                    'alerte' => 'Le gain net est négatif. Le versement est suspendu. La différence est enregistrée comme dette.',
                ]), 201);
            }

            // RG-TON-038 : gain net = 0 → bulletin généré, rien à verser
            if (isset($bulletin['gain_net']) && $bulletin['gain_net'] == 0) {
                return response()->json(array_merge($bulletin->toArray(), [
                    'info' => 'Le gain net est nul. Les obligations du membre sont soldées mais aucun versement n\'est effectué.',
                ]), 201);
            }

            return response()->json($bulletin, 201);
        }

        return parent::update($request, $id);
    }
}
