<?php

namespace App\Http\Controllers\Api;

use App\Models\Membre;
use App\Services\DocumentSignatureService;
use App\Services\SimplePdfService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

/**
 * Gestion des membres de l'association.
 *
 * Règles couvertes :
 *   RG-MBR-001 : Champs obligatoires à la création (nom, prénom, contact).
 *   RG-MBR-002 : Unicité du numéro de téléphone par association.
 *   RG-MBR-003 : Statuts valides : actif, suspendu, exclu, en_attente.
 *   RG-MBR-006 : Suppression interdite si transactions/parts existent → géré par CrudController::destroy().
 *   RG-MBR-007 : Date d'adhésion ≤ date du jour.
 *   RG-SEC-006 : Un MEMBRE ne consulte que ses propres données (géré par middleware/policy).
 */
class MembreController extends CrudController
{
    protected string $model = Membre::class;

    /** Filtres autorisés sur l'index */
    protected array $filterable = ['association_id', 'statut'];

    public function importCsv(Request $request): JsonResponse
    {
        Gate::authorize('create', Membre::class);
        $request->validate(['file' => ['required', 'file', 'mimes:csv,txt']]);
        $path = $request->file('file')->getRealPath();
        $rows = array_map('str_getcsv', file($path));
        $header = array_map('trim', array_shift($rows) ?: []);
        $count = 0;
        foreach ($rows as $row) {
            $data = array_combine($header, $row);
            if (! $data) continue;
            Membre::create($data);
            $count++;
        }
        return response()->json(['imported' => $count]);
    }

    public function relevePdf(Request $request, string $id): JsonResponse
    {
        $membre = Membre::findOrFail($id);
        Gate::authorize('view', $membre);
        $pdf = app(SimplePdfService::class)->render([
            $membre->nom.' '.$membre->prenom,
            'Statut: '.$membre->statut,
            'Telephone: '.$membre->telephone,
        ], 'Releve membre');
        $path = storage_path('app/public/releves/'.$membre->id.'.pdf');
        if (! is_dir(dirname($path))) mkdir(dirname($path), 0777, true);
        file_put_contents($path, $pdf);
        app(DocumentSignatureService::class)->sign($path, [
            'type' => 'releve_membre',
            'membre_id' => $membre->id,
        ]);
        return response()->json(['pdf_url' => 'storage/releves/'.$membre->id.'.pdf']);
    }

    /**
     * RG-MBR-001, RG-MBR-002, RG-MBR-007
     */
    public function store(Request $request): JsonResponse
    {
        Gate::authorize('create', Membre::class);
        $data = $request->validate([
            'association_id'  => ['required', 'uuid'],
            'nom'             => ['required', 'string', 'max:100'],
            'prenom'          => ['required', 'string', 'max:100'],
            'telephone'       => ['required', 'string', 'max:30'],
            'email'           => ['nullable', 'email', 'max:150'],
            'date_adhesion'   => ['required', 'date', 'before_or_equal:today'],
            'statut'          => ['sometimes', 'in:actif,suspendu,exclu,en_attente'],
        ]);

        // RG-MBR-002 : unicité du téléphone dans l'association
        if (! empty($data['telephone'])) {
            $exists = Membre::where('association_id', $data['association_id'])
                ->where('telephone', $data['telephone'])
                ->exists();

            if ($exists) {
                return response()->json([
                    'message' => 'Ce numéro de téléphone est déjà utilisé dans cette association.',
                ], 422);
            }
        }

        $membre = Membre::create($data);
        return response()->json($membre, 201);
    }

    /**
     * RG-MBR-003, RG-MBR-004, RG-MBR-005
     * Empêche de modifier le statut vers EXCLU directement via update —
     * l'exclusion doit passer par une route dédiée (/membres/{id}/exclure).
     */
    public function update(Request $request, string $id): JsonResponse
    {
        $membre = Membre::findOrFail($id);
        Gate::authorize('update', $membre);

        // RG-MBR-005 : le statut exclu est irréversible
        if ($membre->statut === 'exclu') {
            return response()->json([
                'message' => 'Un membre exclu ne peut plus être modifié.',
            ], 422);
        }

        $data = $request->validate([
            'nom'           => ['sometimes', 'string', 'max:100'],
            'prenom'        => ['sometimes', 'string', 'max:100'],
            'telephone'     => ['sometimes', 'string', 'max:30'],
            'email'         => ['sometimes', 'nullable', 'email', 'max:150'],
            'date_adhesion' => ['sometimes', 'date', 'before_or_equal:today'],
            'statut'        => ['sometimes', 'in:actif,suspendu,en_attente'],
        ]);

        $membre->fill($data)->save();
        return response()->json($membre->refresh());
    }

    /**
     * RG-MBR-005 : L'exclusion est irréversible.
     * Endpoint dédié : PUT /membres/{id}/exclure
     */
    public function exclure(Request $request, string $id): JsonResponse
    {
        $data = $request->validate(['motif' => ['required', 'string']]);

        $membre = Membre::findOrFail($id);
        Gate::authorize('delete', $membre);

        if ($membre->statut === 'exclu') {
            return response()->json(['message' => 'Ce membre est déjà exclu.'], 422);
        }

        $membre->forceFill([
            'statut'           => 'exclu',
            'motif_exclusion'   => $data['motif'],
        ])->save();

        return response()->json($membre->refresh());
    }
}
