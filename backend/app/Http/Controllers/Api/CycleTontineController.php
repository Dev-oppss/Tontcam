<?php

namespace App\Http\Controllers\Api;

use App\Models\CotisationTontine;
use App\Models\CycleTontine;
use App\Models\Reunion;
use App\Models\Tontine;
use App\Services\AccessScopeService;
use App\Services\BulletinGainService;
use App\Services\TontineCycleService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use App\Http\Controllers\Controller;

class CycleTontineController extends Controller
{
    public function __construct(
        private AccessScopeService $scope,
        private TontineCycleService $service,
        private BulletinGainService $bulletinService,
    ) {}

    /**
     * GET /tontines/{id}/cycles — liste des cycles d'une tontine, du plus récent au plus ancien.
     */
    public function index(string $tontineId): JsonResponse
    {
        $tontine = $this->scope->scopeAssociation(Tontine::query())->findOrFail($tontineId);

        $cycles = $tontine->cycles()
            ->with(['gagnant.membre', 'bulletin'])
            ->orderByDesc('numero_cycle')
            ->get();

        return response()->json($cycles);
    }

    /**
     * POST /tontines/{id}/cycles/ouvrir
     */
    public function ouvrir(Request $request, string $tontineId): JsonResponse
    {
        $tontine = $this->scope->scopeAssociation(Tontine::query())->findOrFail($tontineId);
        $data = $request->validate(['reunion_id' => ['required', 'uuid']]);
        $reunion = Reunion::findOrFail($data['reunion_id']);

        try {
            $cycle = $this->service->ouvrirCycle($tontine, $reunion);
        } catch (\Throwable $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return response()->json($cycle->load('cotisations'), 201);
    }

    public function show(string $id): JsonResponse
    {
        $cycle = CycleTontine::with(['tontine', 'cotisations.membre', 'encherites.membre', 'gagnant.membre', 'bulletin.retenues'])
            ->whereHas('tontine', fn ($q) => $this->scope->scopeAssociation($q))
            ->findOrFail($id);

        return response()->json($cycle);
    }

    /**
     * POST /cycles/{id}/cotisations — saisie ligne par ligne, montant partiel autorisé.
     */
    public function saisirCotisations(Request $request, string $id): JsonResponse
    {
        $cycle = $this->cycleScope($id);
        $data = $request->validate([
            'cotisation_id' => ['required', 'uuid'],
            'montant_verse' => ['required', 'numeric', 'min:0'],
            'mode_paiement' => ['nullable', 'in:especes,cheque,virement,mobile_money,carte_bancaire'],
            'reference_paiement' => ['nullable', 'string'],
        ]);

        $cotisation = CotisationTontine::where('cycle_id', $cycle->id)->findOrFail($data['cotisation_id']);

        try {
            $cotisation = $this->service->saisirCotisations($cycle, $cotisation, $data['montant_verse'], $request->user(), $data);
        } catch (\RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return response()->json($cotisation);
    }

    public function designerGagnant(Request $request, string $id): JsonResponse
    {
        $cycle = $this->cycleScope($id);
        $partIdForcee = $request->input('part_id');

        try {
            $part = $this->service->designerGagnant($cycle, $partIdForcee);
        } catch (\RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return response()->json($cycle->fresh()->load('gagnant.membre'));
    }

    /**
     * Raccourci pour l'écran de réunion : ouvre le cycle si besoin, désigne le
     * bénéficiaire (choisi ou automatique) et clôture — en un seul appel.
     */
    public function enregistrerBeneficiaire(Request $request, string $tontineId): JsonResponse
    {
        $tontine = $this->scope->scopeAssociation(\App\Models\Tontine::query())->findOrFail($tontineId);

        $data = $request->validate([
            'reunion_id' => ['required', 'uuid'],
            'membre_id' => ['nullable', 'uuid'],
        ]);

        $cycle = \App\Models\CycleTontine::where('tontine_id', $tontine->id)
            ->where('statut', '!=', 'clos')
            ->latest('numero_cycle')
            ->first();

        if (! $cycle) {
            $reunion = \App\Models\Reunion::findOrFail($data['reunion_id']);
            $cycle = $this->service->ouvrirCycle($tontine, $reunion);
        }

        $partIdForcee = null;
        if (!empty($data['membre_id'])) {
            $partIdForcee = $tontine->parts()->where('membre_id', $data['membre_id'])->where('statut', 'disponible')->value('id');
        }

        try {
            $this->service->designerGagnant($cycle, $partIdForcee);
            $cycle = $this->service->cloturerCycle($cycle, $request->user());
        } catch (\RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return response()->json($cycle->load('bulletin.retenues', 'gagnant.membre'));
    }

    public function cloturer(Request $request, string $id): JsonResponse
    {
        $cycle = $this->cycleScope($id);

        try {
            $cycle = $this->service->cloturerCycle($cycle, $request->user());
        } catch (\RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return response()->json($cycle->load('bulletin.retenues'));
    }

    public function bulletin(string $id): JsonResponse
    {
        $cycle = $this->cycleScope($id);
        $bulletin = $cycle->bulletin()->with('retenues', 'gagnant', 'part')->firstOrFail();

        return response()->json($bulletin);
    }

    public function bulletinPdf(string $bulletinId): JsonResponse
    {
        $bulletin = \App\Models\BulletinGain::with('cycle.tontine')
            ->whereHas('cycle.tontine', fn ($q) => $this->scope->scopeAssociation($q))
            ->findOrFail($bulletinId);

        $url = $this->bulletinService->genererPdf($bulletin);

        return response()->json(['pdf_url' => $url]);
    }

    /**
     * POST /cycles/{id}/encheres — soumission d'une offre par un membre.
     */
    public function placerEnchere(Request $request, string $id): JsonResponse
    {
        $cycle = $this->cycleScope($id);
        if ($cycle->statut === 'clos') {
            return response()->json(['message' => 'Ce cycle est déjà clôturé.'], 422);
        }

        $data = $request->validate([
            'tontine_part_id' => ['required', 'uuid'],
            'membre_id' => ['required', 'uuid'],
            'montant_offre' => ['required', 'numeric', 'min:0'],
        ]);

        $miseMin = (float) ($cycle->tontine->mise_min_enchere ?? 0);
        if ($miseMin && $data['montant_offre'] < $miseMin) {
            return response()->json(['message' => "L'offre doit être supérieure ou égale à la mise minimale ({$miseMin})."], 422);
        }

        $enchere = \App\Models\Encherite::updateOrCreate(
            ['cycle_id' => $cycle->id, 'membre_id' => $data['membre_id']],
            ['tontine_part_id' => $data['tontine_part_id'], 'montant_offre' => $data['montant_offre']]
        );

        return response()->json($enchere->load('membre'), 201);
    }

    /**
     * Annule toutes les enchères non gagnantes d'un cycle (avant clôture uniquement).
     */
    public function annulerEncheres(string $id): JsonResponse
    {
        $cycle = $this->cycleScope($id);

        if ($cycle->statut === 'clos') {
            return response()->json(['message' => 'Impossible d\'annuler : ce cycle est déjà clôturé.'], 422);
        }

        $cycle->encherites()->delete();
        $cycle->update(['montant_enchere' => null, 'surplus_enchere' => 0]);

        return response()->json($cycle->fresh('encherites'));
    }

    private function cycleScope(string $id): CycleTontine
    {
        return CycleTontine::whereHas('tontine', fn ($q) => $this->scope->scopeAssociation($q))->findOrFail($id);
    }
}
