<?php

namespace App\Http\Controllers\Api;

use App\Models\Caisse;
use App\Models\Pret;
use App\Services\CaisseService;
use App\Services\PretService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Gestion du cycle de vie des prêts.
 *
 * Règles couvertes :
 *   RG-PRT-001 : Pas de nouveau prêt si prêt en retard ou défaut existant.
 *   RG-PRT-002 : Membre SUSPENDU/EXCLU bloqué.
 *   RG-PRT-003 : Solde caisse ≥ montant au décaissement.
 *   RG-PRT-004 : Défaut doit être soldé avant nouveau prêt.
 *   RG-PRT-005 : Taux figé à la création.
 *   RG-PRT-006 : Durée ≤ max caisse.
 *   RG-PRT-007–008 : Seuil d'approbation (Trésorier seul / Président requis).
 *   RG-PRT-009 : Prêt approuvé non décaissé sous 7 jours → EXPIRE.
 *   RG-PRT-010 : Refus avec motif obligatoire.
 *   RG-PRT-011 : Tableau d'amortissement linéaire automatique.
 *   RG-PRT-015–016 : Remboursement anticipé / partiel → recalcul échéances.
 *   RG-PRT-017 : Passage automatique à SOLDE.
 *   RG-PRT-019–020 : Pénalité de retard.
 *   RG-PRT-021–022 : Passage en DEFAUT après 90 jours, blocage membre.
 *   RG-PRT-023 : Sortie de DEFAUT → décision AG + 50% arriéré.
 */
class PretController extends CrudController
{
    protected string $model = Pret::class;
    protected array $filterable = ['caisse_id', 'emprunteur_id', 'statut'];

    /**
     * Demande de prêt.
     * RG-PRT-001, 002, 004, 005, 006
     */
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'caisse_id'         => ['required', 'uuid'],
            'emprunteur_id'     => ['required', 'uuid'],
            'montant_principal' => ['required', 'numeric', 'min:1'],
            'nb_echeances'      => ['required', 'integer', 'min:1'],
            'taux_mensuel'      => ['nullable', 'numeric', 'min:0'],
        ]);

        $caisse     = Caisse::findOrFail($data['caisse_id']);
        $emprunteur = \App\Models\Membre::findOrFail($data['emprunteur_id']);

        // RG-PRT-002 : membre actif requis
        if (in_array($emprunteur->statut, ['suspendu', 'exclu'])) {
            return response()->json([
                'message' => 'Un membre suspendu ou exclu ne peut pas contracter de prêt.',
            ], 422);
        }

        // RG-PRT-001 & 004 : pas de prêt en retard ou en défaut
        $pretActifProblematique = Pret::where('emprunteur_id', $data['emprunteur_id'])
            ->whereIn('statut', ['en_retard', 'defaut'])
            ->exists();

        if ($pretActifProblematique) {
            return response()->json([
                'message' => 'Ce membre a un prêt en retard ou en défaut. Régularisation requise avant tout nouveau prêt.',
            ], 422);
        }

        // RG-CAI-005 : caisse autorisée aux prêts
        if (! ($caisse->pret_autorise ?? true)) {
            return response()->json([
                'message' => 'Cette caisse n\'est pas autorisée à accorder des prêts.',
            ], 422);
        }

        // RG-PRT-006 : durée ≤ max caisse
        $dureeMax = $caisse->duree_max_pret ?? PHP_INT_MAX;
        if ($data['nb_echeances'] > $dureeMax) {
            return response()->json([
                'message' => "La durée demandée dépasse la durée maximale autorisée ({$dureeMax} mois).",
            ], 422);
        }

        $pret = app(PretService::class)->demander(
            $caisse,
            $data['emprunteur_id'],
            (float) $data['montant_principal'],
            (int) $data['nb_echeances'],
            $request->except(['caisse_id', 'emprunteur_id', 'montant_principal', 'nb_echeances'])
        );

        return response()->json($pret, 201);
    }

    /**
     * Actions sur le cycle de vie du prêt.
     */
    public function update(Request $request, string $id): JsonResponse
    {
        $pret    = Pret::findOrFail($id);
        $service = app(PretService::class);
        $path    = $request->path();

        // ── Approbation ───────────────────────────────────────────────────
        // RG-PRT-007–008 : Trésorier seul si < seuil, sinon Président requis
        if (str_ends_with($path, 'approuver') || str_ends_with($path, 'valider')) {
            if (! in_array($pret->statut, ['demande', 'en_attente_validation'])) {
                return response()->json(['message' => 'Ce prêt ne peut pas être approuvé dans son état actuel.'], 422);
            }

            return response()->json($service->approuver($pret, $request->user()?->id));
        }

        // ── Décaissement ──────────────────────────────────────────────────
        // RG-PRT-003 : solde caisse ≥ montant, RG-PRT-009 : non expiré
        if (str_ends_with($path, 'decaisser')) {
            if ($pret->statut !== 'approuve') {
                return response()->json(['message' => 'Seul un prêt approuvé peut être décaissé.'], 422);
            }

            // RG-PRT-009 : expiration après 7 jours
            if ($pret->date_approbation && \Carbon\Carbon::parse($pret->date_approbation)->diffInDays(now()) > 7) {
                $pret->forceFill(['statut' => 'expire'])->save();
                return response()->json(['message' => 'Ce prêt a expiré (plus de 7 jours sans décaissement).'], 422);
            }

            // RG-PRT-003 : vérifier solde caisse
            $caisse = $pret->caisse;
            if ($caisse->solde_actuel < $pret->montant_principal) {
                return response()->json([
                    'message' => 'Solde insuffisant dans la caisse pour décaisser ce prêt.',
                ], 422);
            }

            return response()->json($service->decaisser($pret, app(CaisseService::class), $request->user()?->id));
        }

        // ── Remboursement ─────────────────────────────────────────────────
        // RG-PRT-014–017 : affectation à des échéances, recalcul si partiel, SOLDE automatique
        if (str_ends_with($path, 'rembourser')) {
            $data = $request->validate([
                'montant'      => ['required', 'numeric', 'min:1'],
                'echeance_ids' => ['nullable', 'array'],
                'echeance_ids.*' => ['uuid'],
            ]);

            if (! in_array($pret->statut, ['en_cours', 'en_retard'])) {
                return response()->json(['message' => 'Ce prêt ne peut pas recevoir de remboursement dans son état actuel.'], 422);
            }

            return response()->json(
                $service->rembourser(
                    $pret,
                    (float) $data['montant'],
                    app(CaisseService::class),
                    $request->user()?->id
                )
            );
        }

        // ── Refus ─────────────────────────────────────────────────────────
        // RG-PRT-010 : motif obligatoire
        if (str_ends_with($path, 'refuser')) {
            $data = $request->validate(['motif_refus' => ['required', 'string']]);

            $pret->forceFill([
                'statut'     => 'refuse',
                'refuse_par' => $request->user()?->id,
                'motif_refus'=> $data['motif_refus'],
                'refuse_at'  => now(),
            ])->save();

            return response()->json($pret->refresh());
        }

        // ── Sortie de défaut ──────────────────────────────────────────────
        // RG-PRT-023 : décision AG + 50% arriéré minimum
        if (str_ends_with($path, 'lever-defaut')) {
            if ($pret->statut !== 'defaut') {
                return response()->json(['message' => 'Ce prêt n\'est pas en statut defaut.'], 422);
            }

            $data = $request->validate([
                'decision_ag_id'    => ['required', 'uuid'],
                'montant_regularise' => ['required', 'numeric', 'min:1'],
            ]);

            // Vérifier que le montant représente au moins 50% de l'arriéré
            $arriere = $pret->montant_arriere ?? 0;
            if ($arriere > 0 && $data['montant_regularise'] < ($arriere * 0.5)) {
                return response()->json([
                    'message' => 'Le montant régularisé doit représenter au moins 50% de l\'arriéré.',
                ], 422);
            }

            if (method_exists($service, 'leverDefaut')) {
                return response()->json($service->leverDefaut($pret, $data, $request->user()?->id));
            }

            $pret->forceFill(['statut' => 'en_cours'])->save();
            return response()->json($pret->refresh());
        }

        return parent::update($request, $id);
    }
}
