<?php

namespace App\Http\Controllers\Api;

use App\Models\Caisse;
use App\Models\EvenementSocial;
use App\Models\TypeAideSociale;
use App\Services\CaisseService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AideSocialeController extends CrudController
{
    protected string $model = EvenementSocial::class;
    protected array $filterable = ['association_id', 'membre_id', 'type_aide_id', 'statut'];

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'association_id' => ['required', 'uuid'],
            'membre_id' => ['required', 'uuid'],
            'type_aide_id' => ['required', 'uuid'],
            'description' => ['required', 'string'],
            'date_evenement' => ['required', 'date', 'before_or_equal:today'],
            'montant_demande' => ['nullable', 'numeric', 'min:0'],
            'pieces_jointes' => ['nullable', 'array'],
            'document_justificatif' => ['nullable', 'string'],
            'notes' => ['nullable', 'string'],
        ]);

        $type = TypeAideSociale::where('id', $data['type_aide_id'])
            ->where('association_id', $data['association_id'])
            ->firstOrFail();

        $nbAides = EvenementSocial::where('membre_id', $data['membre_id'])
            ->where('type_aide_id', $type->id)
            ->where('statut', 'versee')
            ->whereYear('date_evenement', now()->year)
            ->count();

        if ($nbAides >= (int) ($type->nb_max_par_an ?? 3)) {
            return response()->json(['message' => 'Limite annuelle atteinte pour ce type d\'aide.'], 422);
        }

        $pieces = $data['pieces_jointes'] ?? [];
        if (! empty($data['document_justificatif'])) {
            $pieces[] = $data['document_justificatif'];
        }

        $event = EvenementSocial::create([
            'association_id' => $data['association_id'],
            'membre_id' => $data['membre_id'],
            'type_aide_id' => $type->id,
            'description' => $data['description'],
            'date_evenement' => $data['date_evenement'],
            'montant_demande' => $data['montant_demande'] ?? $type->montant_fixe ?? $type->montant_min,
            'statut' => 'demandee',
            'pieces_jointes' => array_values($pieces),
            'notes' => $data['notes'] ?? null,
        ]);

        return response()->json($event, 201);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $event = EvenementSocial::findOrFail($id);
        $path = $request->path();

        if (str_ends_with($path, 'valider')) {
            if ($event->statut !== 'demandee') {
                return response()->json(['message' => 'Cette demande ne peut plus être validée.'], 422);
            }

            $data = $request->validate([
                'montant_accorde' => ['nullable', 'numeric', 'min:0'],
            ]);

            $event->forceFill([
                'statut' => 'approuvee',
                'montant_accorde' => $data['montant_accorde'] ?? $event->montant_demande,
                'approuve_par' => $request->user()?->id,
                'approuve_at' => now(),
            ])->save();

            return response()->json($event->refresh());
        }

        if (str_ends_with($path, 'verser')) {
            if ($event->statut === 'versee') {
                return response()->json(['message' => 'Cette aide est déjà versée.'], 422);
            }

            if ($event->statut !== 'approuvee') {
                return response()->json(['message' => 'Cette aide doit être approuvée avant versement.'], 422);
            }

            $type = $event->typeAide;
            $caisse = $type->caisse_source_id
                ? Caisse::findOrFail($type->caisse_source_id)
                : Caisse::where('association_id', $event->association_id)->where('type', 'tontine')->firstOrFail();

            $montant = (float) ($event->montant_accorde ?? $event->montant_demande ?? $type->montant_fixe ?? 0);

            if ($caisse->solde_actuel < $montant) {
                return response()->json(['message' => 'Solde insuffisant dans la caisse.'], 422);
            }

            $tx = app(CaisseService::class)->sortie(
                $caisse,
                $montant,
                "Aide sociale — {$type->libelle}",
                [
                    'reference_type' => EvenementSocial::class,
                    'reference_id' => $event->id,
                    'created_by' => $request->user()?->id,
                ]
            );

            $event->forceFill([
                'statut' => 'versee',
                'transaction_id' => $tx->id,
                'date_versement' => now(),
            ])->save();

            return response()->json($event->refresh());
        }

        if (str_ends_with($path, 'rejeter')) {
            $data = $request->validate(['motif_refus' => ['required', 'string']]);

            if ($event->statut === 'versee') {
                return response()->json(['message' => 'Impossible de rejeter une aide déjà versée.'], 422);
            }

            $event->forceFill([
                'statut' => 'refusee',
                'refuse_par' => $request->user()?->id,
                'motif_refus' => $data['motif_refus'],
            ])->save();

            return response()->json($event->refresh());
        }

        return parent::update($request, $id);
    }
}
