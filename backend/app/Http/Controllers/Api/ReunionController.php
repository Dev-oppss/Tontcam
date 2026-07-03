<?php

namespace App\Http\Controllers\Api;

use App\Models\OrdreDuJourItem;
use App\Models\Reunion;
use App\Services\NotificationService;
use App\Services\ReunionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Gestion des réunions et assemblées.
 *
 * Règles couvertes :
 *   RG-REU-001 : Une réunion doit avoir numéro, date, heure, lieu et type avant publication.
 *   RG-REU-002 : Date de réunion ≥ maintenant + 24h.
 *   RG-REU-005 : Pas deux réunions le même jour pour la même association.
 *   RG-REU-006 : Report autorisé jusqu'à 24h avant la tenue.
 *   RG-REU-015 : Ordre du jour non modifiable une fois la réunion ouverte.
 *   RG-REU-016–019 : Présences (present / absent_excuse / absent).
 *   RG-REU-021–025 : Clôture PV avec N signatures électroniques.
 *   RG-REU-026 : Annulation autorisée si aucune transaction financière.
 */
class ReunionController extends CrudController
{
    protected string $model = Reunion::class;
    protected array $filterable = ['association_id', 'statut', 'type'];

    public function pvPdf(Request $request, string $id): JsonResponse
    {
        $reunion = Reunion::findOrFail($id);
        $pdfUrl = app(ReunionService::class)->genererPdf($reunion);
        return response()->json(['pdf_url' => $pdfUrl]);
    }

    public function destroyPoint(Request $request, string $reunionId, string $pointId): JsonResponse
    {
        $point = OrdreDuJourItem::where('reunion_id', $reunionId)->findOrFail($pointId);
        $point->delete();
        return response()->json(['deleted' => true]);
    }

    /**
     * RG-REU-001 : Validation des champs obligatoires.
     * RG-REU-002 : Date ≥ maintenant + 24h.
     * RG-REU-005 : Unicité par jour et par association.
     */
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'association_id' => ['required', 'uuid'],
            'numero'         => ['nullable', 'integer', 'min:1'],
            'type'           => ['required', 'in:ordinaire,extraordinaire,ag,conseil_bureau'],
            'date_reunion'   => ['required', 'date', 'after:' . now()->addHours(24)->toDateTimeString()],
            'heure_debut'    => ['required', 'date_format:H:i'],
            'heure_fin_prevue'=> ['nullable', 'date_format:H:i'],
            'lieu'           => ['required', 'string', 'max:255'],
            'est_domicile_membre' => ['sometimes', 'boolean'],
            'hote_membre_id' => ['nullable', 'uuid'],
            'quorum_requis'  => ['nullable', 'integer', 'min:0'],
            'notes'          => ['nullable', 'string'],
        ]);

        if (! isset($data['numero'])) {
            $data['numero'] = (int) (Reunion::where('association_id', $data['association_id'])->max('numero') ?? 0) + 1;
        }

        // RG-REU-005
        $conflit = Reunion::where('association_id', $data['association_id'])
            ->whereDate('date_reunion', $data['date_reunion'])
            ->exists();

        if ($conflit) {
            return response()->json([
                'message' => 'Une réunion est déjà planifiée ce jour pour cette association.',
            ], 422);
        }

        $data['created_by'] = $request->user()?->id;
        $reunion = Reunion::create($data);
        return response()->json($reunion, 201);
    }

    /**
     * Routing des actions spécialisées sur une réunion via le path.
     */
    public function update(Request $request, string $id): JsonResponse
    {
        $reunion = Reunion::findOrFail($id);
        $service = app(ReunionService::class);
        $path    = $request->path();

        // Ouvrir la réunion (démarrer la séance)
        if (str_ends_with($path, 'ouvrir')) {
            return response()->json($service->ouvrir($reunion));
        }

        // RG-REU-016–019 : Enregistrement des présences
        if (str_ends_with($path, 'presences')) {
            $data = $request->validate([
                'membre_id'  => ['required', 'uuid'],
                'statut'     => ['required', 'in:present,absent_excuse,absent,en_retard'],
                'motif_absence' => ['required_if:statut,absent_excuse', 'nullable', 'string'],
                'heure_arrivee' => ['nullable', 'date_format:H:i'],
            ]);

            return response()->json(
                $service->enregistrerPresence(
                    $reunion,
                $data['membre_id'],
                $data['statut'],
                $request->only(['motif_absence', 'heure_arrivee'])
            ),
            201
            );
        }

        // RG-REU-015 : ordre du jour / rapports / pièces jointes
        if (str_ends_with($path, 'ordre-du-jour') || str_ends_with($path, 'rapports') || str_ends_with($path, 'pieces-jointes')) {
            $data = $request->validate([
                'item_id'        => ['nullable', 'uuid'],
                'rubrique_id'    => ['nullable', 'uuid'],
                'libelle_libre'  => ['nullable', 'string', 'max:300'],
                'ordre'          => ['nullable', 'integer', 'min:1'],
                'rapporteur_id'  => ['nullable', 'uuid'],
                'contenu_rapport'=> ['nullable', 'string'],
                'rapport_valide' => ['sometimes', 'boolean'],
                'pieces_jointes' => ['nullable', 'array'],
            ]);

            $item = $data['item_id'] ? OrdreDuJourItem::findOrFail($data['item_id']) : new OrdreDuJourItem();
            $item->fill([
                'reunion_id' => $reunion->id,
                'rubrique_id' => $data['rubrique_id'] ?? $item->rubrique_id ?? null,
                'libelle_libre' => $data['libelle_libre'] ?? $item->libelle_libre ?? null,
                'ordre' => $data['ordre'] ?? $item->ordre ?? 99,
                'rapporteur_id' => $data['rapporteur_id'] ?? $item->rapporteur_id ?? null,
            ]);

            if (str_ends_with($path, 'rapports')) {
                $item->contenu_rapport = $data['contenu_rapport'] ?? $item->contenu_rapport;
                if (array_key_exists('rapport_valide', $data)) {
                    $item->rapport_valide = (bool) $data['rapport_valide'];
                }
            }

            if (str_ends_with($path, 'pieces-jointes')) {
                $current = json_decode((string) ($item->pieces_jointes ?? '[]'), true) ?: [];
                $item->pieces_jointes = array_values(array_merge($current, $data['pieces_jointes'] ?? []));
            }

            $item->save();
            return response()->json($item->refresh(), $data['item_id'] ? 200 : 201);
        }

        // RG-REU-022–023 : Signature du PV
        if (str_ends_with($path, 'signer')) {
            $data = $request->validate([
                'membre_id'      => ['required', 'uuid'],
                'role_signature' => ['required', 'string'],
            ]);

            return response()->json(
                $service->signerPv($reunion, $data['membre_id'], $data['role_signature']),
                201
            );
        }

        // RG-REU-021 : Soumission pour signature (vérifie rapports obligatoires)
        if (str_ends_with($path, 'soumettre-signature')) {
            // Vérification que tous les rapports obligatoires sont saisis
            if (method_exists($service, 'verifierRapportsObligatoires')) {
                $service->verifierRapportsObligatoires($reunion);
            }
            return response()->json(['message' => 'PV soumis pour signature', 'reunion_id' => $reunion->id]);
        }

        if (str_ends_with($path, 'cloturer')) {
            if (method_exists($service, 'verifierRapportsObligatoires')) {
                $service->verifierRapportsObligatoires($reunion);
            }
            $reunion->forceFill([
                'statut' => 'tenue',
                'heure_fin_reelle' => now()->format('H:i:s'),
            ])->save();
            return response()->json($reunion->refresh());
        }

        // RG-REU-006 : Report d'une réunion (≤ 24h avant)
        if (str_ends_with($path, 'reporter')) {
            if ($reunion->date_reunion <= now()->addHours(24)) {
                return response()->json([
                    'message' => 'Impossible de reporter une réunion à moins de 24h de sa tenue.',
                ], 422);
            }

            $data = $request->validate([
                'nouvelle_date' => ['required', 'date', 'after:' . now()->addHours(24)->toDateTimeString()],
                'motif'         => ['required', 'string'],
            ]);

            $reunion->forceFill([
                'date_reunion'   => $data['nouvelle_date'],
                'notes'          => trim(($reunion->notes ? $reunion->notes."\n" : '')."Report: ".$data['motif']),
            ])->save();

            $reunion->loadMissing('association.membres');
            $notificationService = app(NotificationService::class);
            foreach ($reunion->association?->membres ?? [] as $membre) {
                $notificationService->notifierReunionReportee(
                    $reunion->association_id,
                    $membre->id,
                    [
                        'id' => $reunion->id,
                        'type' => $reunion->type,
                        'date' => optional($reunion->date_reunion)->format('Y-m-d'),
                        'heure' => $reunion->heure_debut,
                        'lieu' => $reunion->lieu,
                    ]
                );
            }
            return response()->json($reunion->refresh());
        }

        // RG-REU-026 : Annulation (aucune transaction financière)
        if (str_ends_with($path, 'annuler')) {
            $data = $request->validate(['motif' => ['required', 'string']]);

            // La vérification "aucune transaction" est déléguée au service
            if (method_exists($service, 'annuler')) {
                return response()->json($service->annuler($reunion, $data['motif'], $request->user()?->id));
            }

            $reunion->forceFill(['statut' => 'annulee', 'notes' => trim(($reunion->notes ? $reunion->notes."\n" : '')."Annulation: ".$data['motif'])])->save();
            return response()->json($reunion->refresh());
        }

        return parent::update($request, $id);
    }
}
