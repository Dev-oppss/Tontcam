<?php

namespace App\Http\Controllers\Api;

use App\Models\Caisse;
use App\Services\DocumentSignatureService;
use App\Services\CaisseService;
use App\Services\SimplePdfService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Gestion des caisses et mouvements financiers.
 *
 * Règles couvertes :
 *   RG-CAI-001 : Libellé unique, type valide, solde initial.
 *   RG-CAI-002 : Types valides : TONTINE, MUTUELLE, SCOLAIRE, EVENEMENT, ANNUELLE, BANQUE, AUTRE.
 *   RG-CAI-006 : Solde jamais négatif — bloqué avant toute sortie.
 *   RG-CAI-007–008 : Toute transaction tracée avec date, libellé, type, mode, valideur.
 *   RG-CAI-010 : Transactions immuables — correction par transaction inverse.
 *   RG-CAI-011 : Modes de paiement : ESPECES, CHEQUE, VIREMENT, MOBILE_MONEY, CARTE_BANCAIRE.
 *   RG-CAI-012 : Numéro de chèque obligatoire et unique par compte bancaire.
 *   RG-CAI-013–014 : Transfert inter-caisses atomique (deux transactions simultanées).
 *   RG-CAI-016 : Transfert > seuil → validation Président requise.
 */
class CaisseController extends CrudController
{
    protected string $model = Caisse::class;
    protected array $filterable = ['association_id', 'type'];

    public function journalPdf(Request $request, string $id): JsonResponse
    {
        $caisse = Caisse::findOrFail($id);
        $lines = [
            'Caisse: '.$caisse->libelle,
            'Solde actuel: '.$caisse->solde_actuel,
            'Date: '.now()->toDateTimeString(),
        ];
        $path = storage_path('app/public/journaux/'.$caisse->id.'.pdf');
        if (! is_dir(dirname($path))) mkdir(dirname($path), 0777, true);
        file_put_contents($path, app(SimplePdfService::class)->render($lines, 'Journal de caisse'));
        app(DocumentSignatureService::class)->sign($path, [
            'type' => 'journal_caisse',
            'caisse_id' => $caisse->id,
        ]);
        return response()->json(['pdf_url' => 'storage/journaux/'.$caisse->id.'.pdf']);
    }

    /**
     * RG-CAI-001, RG-CAI-002 : Création d'une caisse.
     */
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'association_id' => ['required', 'uuid'],
            'libelle'        => ['required', 'string', 'max:150'],
            'type'           => ['required', 'in:tontine,mutuelle,scolaire,evenement,annuelle,banque,autre'],
            'solde_initial'  => ['sometimes', 'numeric', 'min:0'],
            'pret_autorise'  => ['sometimes', 'boolean'],
            'compte_bancaire_id'=> ['nullable', 'uuid'],
        ]);

        // RG-CAI-001 : libellé unique par association
        $exists = Caisse::where('association_id', $data['association_id'])
            ->where('libelle', $data['libelle'])
            ->exists();

        if ($exists) {
            return response()->json([
                'message' => 'Une caisse avec ce libellé existe déjà dans cette association.',
            ], 422);
        }

        $caisse = Caisse::create($data);
        return response()->json($caisse, 201);
    }

    /**
     * Routing des actions financières sur une caisse.
     */
    public function update(Request $request, string $id): JsonResponse
    {
        $path   = $request->path();
        $caisse = Caisse::findOrFail($id);

        // ── Mouvement simple (entrée / sortie) ─────────────────────────────
        if (str_ends_with($path, 'transactions')) {
            $data = $request->validate([
                'type'         => ['required', 'in:entree,sortie'],
                'montant'      => ['required', 'numeric', 'min:1'],
                'libelle'      => ['required', 'string', 'max:255'],
                'mode_paiement'=> ['required', 'in:especes,cheque,virement,mobile_money,carte_bancaire'],
                'cheque_numero'=> ['required_if:mode_paiement,cheque', 'nullable', 'string', 'max:50'],
            ]);

            // RG-CAI-012 : unicité numéro de chèque
            if ($data['mode_paiement'] === 'cheque' && ! empty($data['cheque_numero'])) {
                $doublon = \App\Models\Transaction::where('cheque_numero', $data['cheque_numero'])
                    ->where('caisse_id', $caisse->id)
                    ->exists();

                if ($doublon) {
                    return response()->json([
                        'message' => 'Ce numéro de chèque est déjà utilisé sur cette caisse.',
                    ], 422);
                }
            }

            // RG-CAI-006 : solde jamais négatif
            if ($data['type'] === 'sortie' && $caisse->solde_actuel < $data['montant']) {
                return response()->json([
                    'message' => 'Solde insuffisant. Cette opération entraînerait un solde négatif.',
                ], 422);
            }

            $tx = app(CaisseService::class)->mouvement(
                $caisse,
                $data['type'],
                    (float) $data['montant'],
                    $data['libelle'],
                    [
                        'mode_paiement' => $data['mode_paiement'],
                        'cheque_numero' => $data['cheque_numero'] ?? null,
                        'created_by'    => $request->user()?->id,
                    ]
                );

            return response()->json($tx, 201);
        }

        // ── Transfert inter-caisses ────────────────────────────────────────
        // RG-CAI-013–014 : atomique (double transaction), RG-CAI-016 : seuil Président
        if (str_ends_with($path, 'transfert')) {
            $data = $request->validate([
                'caisse_destination_id' => ['required', 'uuid', 'different:' . $id],
                'montant'               => ['required', 'numeric', 'min:1'],
                'libelle'               => ['required', 'string', 'max:255'],
                'mode_paiement'         => ['required', 'in:especes,cheque,virement,mobile_money,carte_bancaire'],
            ]);

            // RG-CAI-006
            if ($caisse->solde_actuel < $data['montant']) {
                return response()->json([
                    'message' => 'Solde insuffisant pour effectuer ce transfert.',
                ], 422);
            }

            // RG-CAI-016 : vérifier seuil d'approbation (configurable par association)
            $seuilApprobation = $caisse->association->config['seuil_approbation_transfert'] ?? PHP_INT_MAX;
            if ($data['montant'] >= $seuilApprobation) {
                return response()->json([
                    'message'    => 'Ce transfert dépasse le seuil d\'approbation. Validation du Président requise.',
                    'en_attente' => true,
                ], 202);
            }

            $caisseDestination = Caisse::findOrFail($data['caisse_destination_id']);

            $result = app(CaisseService::class)->transfert(
                $caisse,
                $caisseDestination,
                (float) $data['montant'],
                $data['libelle'],
                [
                    'mode_paiement' => $data['mode_paiement'],
                    'created_by'    => $request->user()?->id,
                ]
            );

            return response()->json($result, 201);
        }

        // ── Transaction corrective (RG-CAI-010) ──────────────────────────
        if (str_ends_with($path, 'corriger')) {
            $data = $request->validate([
                'transaction_id' => ['required', 'uuid'],
                'motif'          => ['required', 'string'],
            ]);

            $result = app(CaisseService::class)->corriger(
                $caisse,
                $data['transaction_id'],
                $data['motif'],
                $request->user()?->id
            );

            return response()->json($result, 201);
        }

        return parent::update($request, $id);
    }
}
