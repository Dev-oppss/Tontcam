<?php

namespace App\Http\Controllers\Api;

use App\Models\Association;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Gestion des associations (module Organisation & Paramétrage).
 *
 * Règles couvertes :
 *   RG-ORG-001 : Champs obligatoires : nom, siège, date création, au moins un administrateur.
 *   RG-ORG-002 : Nom unique dans le système.
 *   RG-ORG-003 : Devise par défaut XAF, non modifiable après première transaction.
 *   RG-ORG-007 : 3 postes obligatoires (Président, Secrétaire, Trésorier) — validés à l'activation.
 *   RG-ORG-012 : Seuil d'approbation des prêts configurable.
 *   RG-ORG-013 : Nombre de signataires PV paramétrable (2–5, défaut 3).
 *   RG-ORG-014 : Délais de rappel réunion configurables.
 *   RG-ORG-015 : Isolation des données — chaque association dans son propre espace.
 */
class AssociationController extends CrudController
{
    protected string $model = Association::class;

    /**
     * RG-ORG-001, RG-ORG-002, RG-ORG-003
     */
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'nom'            => ['required', 'string', 'max:200'],
            'siege_social'   => ['required', 'string', 'max:255'],
            'date_creation'  => ['required', 'date', 'before_or_equal:today'],
            'devise'         => ['sometimes', 'string', 'size:3'],
            'email'          => ['nullable', 'email', 'max:150'],
            'telephone'      => ['nullable', 'string', 'max:20'],
            // Paramètres globaux (RG-ORG-012, 013, 014)
            'seuil_approbation_pret'       => ['nullable', 'numeric', 'min:0'],
            'seuil_approbation_transfert'  => ['nullable', 'numeric', 'min:0'],
            'nb_signataires_pv'            => ['sometimes', 'integer', 'min:2', 'max:5'],
            'delai_rappel_j7'              => ['sometimes', 'boolean'],
            'delai_rappel_j3'              => ['sometimes', 'boolean'],
            'delai_rappel_j1'              => ['sometimes', 'boolean'],
            'config'                       => ['sometimes', 'array'],
        ]);

        // RG-ORG-002 : nom unique dans le système
        if (Association::where('nom', $data['nom'])->exists()) {
            return response()->json([
                'message' => 'Une association avec ce nom existe déjà dans le système.',
            ], 422);
        }

        // RG-ORG-003 : devise par défaut XAF
        $data['devise'] = $data['devise'] ?? 'XAF';

        // RG-ORG-013 : nb_signataires_pv par défaut 3
        $data['nb_signataires_pv'] = $data['nb_signataires_pv'] ?? 3;
        if (isset($data['seuil_approbation_transfert'])) {
            $config = $data['config'] ?? [];
            $config['seuil_approbation_transfert'] = $data['seuil_approbation_transfert'];
            $data['config'] = $config;
            unset($data['seuil_approbation_transfert']);
        }

        $association = Association::create($data);
        return response()->json($association, 201);
    }

    /**
     * RG-ORG-003 : Devise non modifiable après première transaction.
     */
    public function update(Request $request, string $id): JsonResponse
    {
        $association = Association::findOrFail($id);
        $path        = $request->path();

        // ── Activation de l'association ───────────────────────────────────
        // RG-ORG-001 : vérifier les 3 postes obligatoires avant activation
        if (str_ends_with($path, 'activer')) {
            $postes = $association->postes()->whereIn('code', ['PRESIDENT', 'SECRETAIRE', 'TRESORIER'])->count();

            if ($postes < 3) {
                return response()->json([
                    'message' => 'L\'association doit avoir au minimum 3 postes (Président, Secrétaire, Trésorier) avant activation.',
                ], 422);
            }

            $association->forceFill(['actif' => true])->save();

            return response()->json($association->refresh());
        }

        // Paramètres modifiables
        $rules = [
            'nom'                         => ['sometimes', 'string', 'max:200'],
            'siege_social'                => ['sometimes', 'string', 'max:255'],
            'email'                       => ['sometimes', 'nullable', 'email'],
            'telephone'                   => ['sometimes', 'nullable', 'string', 'max:20'],
            'seuil_approbation_pret'      => ['sometimes', 'numeric', 'min:0'],
            'seuil_approbation_transfert' => ['sometimes', 'numeric', 'min:0'],
            'nb_signataires_pv'           => ['sometimes', 'integer', 'min:2', 'max:5'],
            'delai_rappel_j7'             => ['sometimes', 'boolean'],
            'delai_rappel_j3'             => ['sometimes', 'boolean'],
            'delai_rappel_j1'             => ['sometimes', 'boolean'],
            'config'                      => ['sometimes', 'array'],
        ];

        // RG-ORG-003 : devise figée après première transaction
        if ($request->has('devise')) {
            $aTransactions = $association->transactions()->exists();
            if ($aTransactions) {
                return response()->json([
                    'message' => 'La devise ne peut plus être modifiée après la première transaction.',
                ], 422);
            }
            $rules['devise'] = ['required', 'string', 'size:3'];
        }

        // RG-ORG-002 : unicité du nom si modifié
        if ($request->has('nom') && $request->nom !== $association->nom) {
            if (Association::where('nom', $request->nom)->where('id', '!=', $id)->exists()) {
                return response()->json([
                    'message' => 'Une association avec ce nom existe déjà dans le système.',
                ], 422);
            }
        }

        $data = $request->validate($rules);
        if (isset($data['seuil_approbation_transfert'])) {
            $config = $association->config ?? [];
            $config['seuil_approbation_transfert'] = $data['seuil_approbation_transfert'];
            $data['config'] = array_merge($config, $data['config'] ?? []);
            unset($data['seuil_approbation_transfert']);
        }
        $association->fill($data)->save();
        return response()->json($association->refresh());
    }
}
