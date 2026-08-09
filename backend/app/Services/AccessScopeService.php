<?php

namespace App\Services;

use App\Models\Utilisateur;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\Auth;
use RuntimeException;

/**
 * Isolation stricte multi-tenant (RG-ORG-015 / RG-SEC-007/008).
 * Toute requête sur un modèle métier doit être scopée à l'association
 * de l'utilisateur connecté — jamais de fuite entre associations,
 * même pour le Super Admin.
 */
class AccessScopeService
{
    /**
     * Retourne l'association_id de l'utilisateur actuellement authentifié.
     * Accepte indifféremment un Utilisateur, une Request (dont on tire ->user()), ou rien (Auth::user()).
     */
    public function associationId(mixed $source = null): string
    {
        $utilisateur = match (true) {
            $source instanceof Utilisateur => $source,
            $source instanceof \Illuminate\Http\Request => $source->user(),
            default => Auth::user(),
        };

        if (! $utilisateur) {
            throw new RuntimeException('Aucun utilisateur authentifié.');
        }

        $utilisateur->loadMissing('membre');
        $associationId = $utilisateur->membre?->association_id;

        if (! $associationId) {
            throw new RuntimeException("Impossible de déterminer l'association de l'utilisateur.");
        }

        return $associationId;
    }

    /**
     * Applique le scope association_id = X sur une requête Eloquent.
     * Cas particulier : sur le modèle Association lui-même, la colonne pertinente est `id`, pas `association_id`.
     */
    public function scopeAssociation(Builder $query, ?Utilisateur $utilisateur = null): Builder
    {
        $table = $query->getModel()->getTable();
        $column = str_ends_with($table, 'associations') ? 'id' : 'association_id';

        return $query->where("$table.$column", $this->associationId($utilisateur));
    }

    /**
     * Isolation portail membre (RG-SEC-006) : un membre ne voit QUE ses propres données,
     * même à l'intérieur de sa propre association.
     */
    public function scopeMembre(Builder $query, ?Utilisateur $utilisateur = null): Builder
    {
        $utilisateur = $utilisateur ?? Auth::user();

        if (! $utilisateur || ! $utilisateur->membre_id) {
            throw new RuntimeException('Utilisateur non lié à une fiche membre.');
        }

        $column = $query->getModel()->getTable() === 'membres' ? 'id' : 'membre_id';

        return $query->where($column, $utilisateur->membre_id);
    }

    /**
     * True si le rôle a un accès global en lecture (audit log, contrôleur).
     */
    public function estRoleGlobalLecture(?Utilisateur $utilisateur = null): bool
    {
        $role = ($utilisateur ?? Auth::user())?->role;

        return in_array($role, ['super_admin', 'controleur'], true);
    }
}
