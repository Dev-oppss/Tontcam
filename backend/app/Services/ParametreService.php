<?php

namespace App\Services;

use App\Models\Association;
use App\Models\ParametreAssociation;
use App\Models\Utilisateur;

/**
 * Stockage clé/valeur (table parametres_association) en complément des colonnes
 * typées déjà présentes sur associations (seuil_approbation_pret, nb_signataires_pv...).
 * Utile pour les paramètres additionnels non prévus dans le schéma de base
 * (barème social, seuils sanctions, etc.) sans migration supplémentaire.
 */
class ParametreService
{
    public function tous(string $associationId): array
    {
        return ParametreAssociation::where('association_id', $associationId)
            ->get()
            ->mapWithKeys(fn ($p) => [$p->cle => $p->valeur_json ?? $p->valeur])
            ->toArray();
    }

    public function obtenir(string $associationId, string $cle, mixed $defaut = null): mixed
    {
        $param = ParametreAssociation::where('association_id', $associationId)->where('cle', $cle)->first();
        if (! $param) {
            return $defaut;
        }

        return $param->valeur_json ?? $param->valeur ?? $defaut;
    }

    public function definir(string $associationId, string $cle, mixed $valeur, ?Utilisateur $auteur = null, ?string $description = null): ParametreAssociation
    {
        $estJson = is_array($valeur) || is_bool($valeur);

        return ParametreAssociation::updateOrCreate(
            ['association_id' => $associationId, 'cle' => $cle],
            [
                'valeur' => $estJson ? null : (string) $valeur,
                'valeur_json' => $estJson ? $valeur : null,
                'description' => $description,
                'updated_by' => $auteur?->id,
            ]
        );
    }

    /**
     * Met à jour en lot les paramètres "cœur" stockés directement sur associations
     * (RG-ORG / Paramètres → onglets Général/Financier/Réunions du frontend).
     */
    public function definirCoeur(Association $association, array $data): Association
    {
        $association->update(array_intersect_key($data, array_flip([
            'seuil_approbation_pret', 'nb_signataires_pv', 'delai_rappel_j7', 'delai_rappel_j3', 'delai_rappel_j1', 'devise',
        ])));

        return $association;
    }
}
