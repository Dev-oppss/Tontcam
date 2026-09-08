<?php

namespace App\Http\Controllers\Api;

use App\Models\CotisationTontine;
use App\Models\Caisse;
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
    use \App\Http\Controllers\Api\Concerns\FormateErreurImport;

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
     * POST /tontines/{id}/cycles/import-historique — réservé super_admin (onboarding
     * d'une tontine dont plusieurs tours ont déjà été joués avant l'app).
     */
    public function importHistorique(Request $request, string $tontineId): JsonResponse
    {
        if ($request->user()->role !== 'super_admin') {
            return response()->json(['message' => "Réservé au super_admin."], 403);
        }

        $tontine = $this->scope->scopeAssociation(Tontine::query())->findOrFail($tontineId);

        $data = $request->validate([
            'reunion_id' => ['required', 'uuid'],
            'gagnant_part_id' => ['required', 'uuid'],
            'date_ouverture' => ['required', 'date'],
            'date_cloture' => ['required', 'date'],
            'montant_enchere' => ['nullable', 'numeric', 'min:0'],
            'surplus_enchere' => ['nullable', 'numeric', 'min:0'],
            'gain_verse' => ['sometimes', 'boolean'],
            'mode_versement' => ['sometimes', 'in:especes,cheque,virement,mobile_money,carte_bancaire'],
            'reference_versement' => ['nullable', 'string', 'max:200'],
            'cotisations' => ['nullable', 'array'],
            'cotisations.*.tontine_part_id' => ['required', 'uuid'],
            'cotisations.*.montant_verse' => ['required', 'numeric', 'min:0'],
            'cotisations.*.date_versement' => ['nullable', 'date'],
        ]);

        $data['gain_verse'] = $data['gain_verse'] ?? true;

        $cycle = $this->service->importerHistorique($tontine, $data, $request->user());

        return response()->json($cycle->load('gagnant.membre', 'cotisations', 'bulletin'), 201);
    }

    /**
     * Import via fichier CSV/XLSX. Une ligne = une cotisation ; les colonnes
     * du cycle (reunion_id, gagnant_part_id, dates...) sont répétées sur
     * chaque ligne d'un même cycle et regroupées via la colonne "cycle_ref"
     * (identifiant libre choisi par l'utilisateur, pas stocké en base).
     * Un cycle sans aucune cotisation peut être importé avec une seule ligne
     * où les colonnes cotisation_tontine_part_id/cotisation_montant_verse
     * sont laissées vides.
     */
    public function importHistoriqueFichier(Request $request, string $tontineId, \App\Services\Import\TabularFileReader $reader, \App\Services\Import\ImportResolver $resolveur): JsonResponse
    {
        if ($request->user()->role !== 'super_admin') {
            return response()->json(['message' => "Réservé au super_admin."], 403);
        }
        $tontine = $this->scope->scopeAssociation(Tontine::query())->findOrFail($tontineId);
        $request->validate(['fichier' => ['required', 'file', 'mimes:csv,txt,xlsx', 'max:5120']]);

        try {
            $lignes = $reader->lire($request->file('fichier'));
        } catch (\RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        $groupes = [];
        foreach ($lignes as $i => $ligne) {
            $ref = trim((string) ($ligne['cycle_ref'] ?? ''));
            if ($ref === '') {
                $ref = "__ligne_seule_{$i}";
            }
            $groupes[$ref]['lignes_source'][] = $i + 2;
            $groupes[$ref]['cycle'] ??= $ligne;
            if (! empty($ligne['cotisation_tontine_part_id'])) {
                $groupes[$ref]['cotisations'][] = $ligne;
            }
        }

        $crees = 0;
        $erreurs = [];
        foreach ($groupes as $ref => $groupe) {
            try {
                $cycleLigne = $groupe['cycle'];
                // Noms/dates lisibles : réunion par date, gagnant par nom du membre.
                if (! empty($cycleLigne['reunion_id'])) { $cycleLigne['reunion_id'] = $resolveur->reunion($cycleLigne['reunion_id']); }
                if (! empty($cycleLigne['gagnant_part_id'])) { $cycleLigne['gagnant_part_id'] = $resolveur->partTontine($cycleLigne['gagnant_part_id'], $tontineId); }
                foreach (['date_ouverture', 'date_cloture'] as $champ) {
                    if (! empty($cycleLigne[$champ])) { $cycleLigne[$champ] = $resolveur->date($cycleLigne[$champ]); }
                }
                $data = \Illuminate\Support\Facades\Validator::make($cycleLigne, [
                    'reunion_id' => ['required', 'uuid'],
                    'gagnant_part_id' => ['required', 'uuid'],
                    'date_ouverture' => ['required', 'date'],
                    'date_cloture' => ['required', 'date'],
                    'montant_enchere' => ['nullable', 'numeric', 'min:0'],
                    'surplus_enchere' => ['nullable', 'numeric', 'min:0'],
                    'gain_verse' => ['nullable', 'boolean'],
                    'mode_versement' => ['nullable', 'in:especes,cheque,virement,mobile_money,carte_bancaire'],
                    'reference_versement' => ['nullable', 'string', 'max:200'],
                ])->validate();
                $data['gain_verse'] = $data['gain_verse'] ?? true;

                $data['cotisations'] = collect($groupe['cotisations'] ?? [])->map(function ($c) use ($resolveur, $tontineId) {
                    if (! empty($c['cotisation_tontine_part_id'])) {
                        $c['cotisation_tontine_part_id'] = $resolveur->partTontine($c['cotisation_tontine_part_id'], $tontineId);
                    }
                    if (! empty($c['cotisation_date_versement'])) {
                        $c['cotisation_date_versement'] = $resolveur->date($c['cotisation_date_versement']);
                    }
                    return \Illuminate\Support\Facades\Validator::make($c, [
                        'cotisation_tontine_part_id' => ['required', 'uuid'],
                        'cotisation_montant_verse' => ['required', 'numeric', 'min:0'],
                        'cotisation_date_versement' => ['nullable', 'date'],
                    ])->validate();
                })->map(fn ($c) => [
                    'tontine_part_id' => $c['cotisation_tontine_part_id'],
                    'montant_verse' => (float) $c['cotisation_montant_verse'],
                    'date_versement' => $c['cotisation_date_versement'] ?? null,
                ])->values()->all();

                $this->service->importerHistorique($tontine, $data, $request->user());
                $crees++;
            } catch (\Throwable $e) {
                $erreurs[] = ['cycle_ref' => $ref, 'lignes' => $groupe['lignes_source'], 'erreur' => $this->messageLisible($e)];
            }
        }

        return response()->json(['crees' => $crees, 'erreurs' => $erreurs]);
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
            $cycle = $this->service->ouvrirCycle($tontine, $reunion, $request->user());
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

        // On cherche d'abord un cycle déjà lié à CETTE réunion précise (peu importe son statut),
        // car la contrainte unique (tontine_id, reunion_id) interdit d'en recréer un second.
        $cyclesReunion = \App\Models\CycleTontine::where('tontine_id', $tontine->id)
            ->where('reunion_id', $data['reunion_id'])
            ->latest('numero_cycle');
        if ($cyclesReunion->count() >= (int) $tontine->max_cycles_par_reunion) {
            return response()->json(['message' => 'La limite de tours autorisés pour cette réunion est atteinte.'], 422);
        }
        $cycle = (clone $cyclesReunion)->where('statut', '!=', 'clos')->first();

        try {
            $cycle = \Illuminate\Support\Facades\DB::transaction(function () use ($tontine, $data, $cycle, $request) {
                if (! $cycle) {
                    $reunion = \App\Models\Reunion::findOrFail($data['reunion_id']);
                    $cycle = $this->service->ouvrirCycle($tontine, $reunion, $request->user());
                }

                $partIdForcee = null;
                if (!empty($data['membre_id'])) {
                    $partIdForcee = $tontine->parts()->where('membre_id', $data['membre_id'])->where('statut', 'disponible')->value('id');
                }

                // Toute la séquence est transactionnelle : si la désignation du gagnant
                // échoue (plus aucune part disponible, mode d'attribution mal configuré...),
                // le cycle qu'on vient d'ouvrir est annulé au lieu de rester en base comme
                // un cycle "fantôme" ouvert sans gagnant (ligne vide "En attente" dans
                // l'historique des rotations).
                $this->service->designerGagnant($cycle, $partIdForcee);

                return $this->service->cloturerCycle($cycle, $request->user());
            });
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

    /** Annule un bénéficiaire/cycle non payé avant la clôture de la réunion. */
    public function annulerCycle(Request $request, string $id): JsonResponse
    {
        $cycle = $this->cycleScope($id);
        try {
            $this->service->annulerCycleAvantVersement($cycle, $request->user());
        } catch (\RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return response()->json(['annulee' => true]);
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
     * RG-RPT-008 : signature numérique du bulletin. Chaque signataire (Trésorier,
     * Président, Bénéficiaire) horodate sa propre signature avec son compte
     * authentifié — impossible de signer à la place de quelqu'un d'autre.
     * Une fois les 3 signatures réunies, un hash SHA-256 d'intégrité (numéro,
     * montants, identités, 3 horodatages) est calculé et exposé sur le PDF :
     * toute modification a posteriori du bulletin ou de ses signatures invalide le hash.
     */
    public function signer(Request $request, string $bulletinId): JsonResponse
    {
        $bulletin = \App\Models\BulletinGain::with('cycle.tontine', 'gagnant')
            ->whereHas('cycle.tontine', fn ($q) => $this->scope->scopeAssociation($q))
            ->findOrFail($bulletinId);

        $user = $request->user();
        $role = $user->role;

        $champ = match (true) {
            in_array($role, ['tresorier', 'super_admin'], true) => 'signe_tresorier_at',
            in_array($role, ['president', 'super_admin'], true) => 'signe_president_at',
            $user->membre_id === $bulletin->gagnant_membre_id => 'signe_beneficiaire_at',
            default => null,
        };

        if (! $champ) {
            return response()->json(['message' => "Vous n'êtes pas habilité à signer ce bulletin (Trésorier, Président ou bénéficiaire uniquement)."], 403);
        }
        if ($bulletin->{$champ}) {
            return response()->json(['message' => 'Déjà signé par vous.'], 422);
        }

        $updates = [$champ => now()];

        // Le trésorier (celui qui remet l'argent) précise le mode de versement.
        if ($champ === 'signe_tresorier_at') {
            $data = $request->validate([
                'mode_versement' => ['sometimes', 'nullable', 'in:especes,cheque,virement,mobile_money'],
                'reference_versement' => ['sometimes', 'nullable', 'string', 'max:100'],
                'date_versement' => ['sometimes', 'nullable', 'date'],
            ]);
            $updates += array_filter($data, fn ($v) => $v !== null);
        }

        $bulletin->update($updates);
        $bulletin->refresh();

        if ($bulletin->signe_tresorier_at && $bulletin->signe_president_at && $bulletin->signe_beneficiaire_at) {
            $bulletin->update(['statut' => 'signe']);
        }

        return response()->json($bulletin->fresh());
    }

    /**
     * POST /bulletins/{id}/retenues — ajout d'une retenue manuelle (priorité 5 :
     * frais d'organisation, décision d'AG...). Réservé trésorier/président/super_admin,
     * et seulement tant qu'aucune signature n'existe sur le bulletin.
     */
    public function ajouterRetenue(Request $request, string $bulletinId): JsonResponse
    {
        $bulletin = \App\Models\BulletinGain::with('cycle.tontine')
            ->whereHas('cycle.tontine', fn ($q) => $this->scope->scopeAssociation($q))
            ->findOrFail($bulletinId);

        if (! in_array($request->user()->role, ['tresorier', 'president', 'super_admin'], true)) {
            return response()->json(['message' => "Réservé au trésorier, au président ou au super_admin."], 403);
        }

        $data = $request->validate([
            'libelle' => ['required', 'string', 'max:200'],
            'montant' => ['required', 'numeric', 'min:0.01'],
            'caisse_id' => ['required', 'uuid'],
        ]);

        $caisse = $this->scope->scopeAssociation(Caisse::query())
            ->where('actif', true)
            ->findOrFail($data['caisse_id']);

        try {
            $bulletin = $this->bulletinService->ajouterRetenueManuelle(
                $bulletin, $caisse, $data['libelle'], (float) $data['montant'], $request->user()
            );
        } catch (\RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return response()->json($bulletin);
    }

    public function payerBulletin(Request $request, string $bulletinId): JsonResponse
    {
        if (! in_array($request->user()->role, ['tresorier', 'president', 'super_admin'], true)) {
            return response()->json(['message' => 'Réservé au trésorier, au président ou au super_admin.'], 403);
        }
        $bulletin = \App\Models\BulletinGain::with('cycle.tontine.caisse')
            ->whereHas('cycle.tontine', fn ($q) => $this->scope->scopeAssociation($q))->findOrFail($bulletinId);
        $data = $request->validate([
            'mode_paiement' => ['required', 'in:especes,cheque,virement,mobile_money,carte_bancaire'],
            'reference_versement' => ['nullable', 'string', 'max:100'],
        ]);
        try { $bulletin = $this->bulletinService->verser($bulletin, $data['mode_paiement'], $data['reference_versement'] ?? null, $request->user()); }
        catch (\RuntimeException $e) { return response()->json(['message' => $e->getMessage()], 422); }
        return response()->json($bulletin);
    }

    /**
     * POST /bulletins/{id}/annuler-versement — retour des fonds. Préalable obligatoire
     * pour pouvoir ensuite annuler un cycle dont le bulletin était déjà payé
     * (voir TontineCycleService::annulerCycleAvantVersement).
     */
    public function annulerVersementBulletin(Request $request, string $bulletinId): JsonResponse
    {
        if (! in_array($request->user()->role, ['tresorier', 'president', 'super_admin'], true)) {
            return response()->json(['message' => 'Réservé au trésorier, au président ou au super_admin.'], 403);
        }
        $bulletin = \App\Models\BulletinGain::with('cycle.tontine.caisse')
            ->whereHas('cycle.tontine', fn ($q) => $this->scope->scopeAssociation($q))->findOrFail($bulletinId);

        $data = $request->validate([
            'motif' => ['nullable', 'string', 'max:200'],
        ]);

        try {
            $bulletin = $this->bulletinService->annulerVersement($bulletin, $request->user(), $data['motif'] ?? null);
        } catch (\RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return response()->json($bulletin);
    }

    /**
     * POST /bulletins/{id}/annuler — annule un bulletin non versé (brouillon/genere),
     * bloqué dès que le bénéficiaire a signé (voir BulletinGainService::annulerBulletin).
     */
    public function annulerBulletin(Request $request, string $bulletinId): JsonResponse
    {
        if (! in_array($request->user()->role, ['tresorier', 'president', 'super_admin'], true)) {
            return response()->json(['message' => 'Réservé au trésorier, au président ou au super_admin.'], 403);
        }
        $bulletin = \App\Models\BulletinGain::with('cycle.tontine')
            ->whereHas('cycle.tontine', fn ($q) => $this->scope->scopeAssociation($q))->findOrFail($bulletinId);

        $data = $request->validate([
            'motif' => ['nullable', 'string', 'max:200'],
        ]);

        try {
            $bulletin = $this->bulletinService->annulerBulletin($bulletin, $request->user(), $data['motif'] ?? null);
        } catch (\RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return response()->json($bulletin);
    }


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
            'caisse_id' => ['required', 'uuid'],
        ]);

        $caisse = $this->scope->scopeAssociation(Caisse::query())->where('actif', true)->findOrFail($data['caisse_id']);

        $miseMin = (float) ($cycle->tontine->mise_min_enchere ?? 0);
        $pot = (float) ($cycle->montant_collecte_reel > 0
            ? $cycle->montant_collecte_reel
            : $cycle->montant_collecte_prevu);
        if ($data['montant_offre'] > $pot) {
            return response()->json(['message' => "L'offre ne peut pas dépasser le pot disponible ({$pot} FCFA)."], 422);
        }
        // RG : la mise minimum (si définie sur la tontine) est indicative,
        // elle n'est plus bloquante — une offre inférieure reste acceptée.
        // (pt.7 du rapport de test : "l'offre n'est pas obligatoirement
        // supérieure au montant de la part — à supprimer")

        // La part soumise doit appartenir à la tontine de ce cycle et au membre
        // qui fait l'offre. Cette vérification évite toute attribution croisée
        // lorsqu'un membre possède des parts dans plusieurs tontines.
        $partValide = $cycle->tontine->parts()
            ->whereKey($data['tontine_part_id'])
            ->where('membre_id', $data['membre_id'])
            ->where('statut', 'disponible')
            ->exists();
        if (! $partValide) {
            return response()->json(['message' => 'La part proposée est invalide ou n’est plus disponible pour ce membre.'], 422);
        }

        $enchere = \App\Models\Encherite::updateOrCreate(
            ['cycle_id' => $cycle->id, 'membre_id' => $data['membre_id']],
            ['tontine_part_id' => $data['tontine_part_id'], 'montant_offre' => $data['montant_offre'], 'caisse_id' => $caisse->id]
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
