<?php

namespace App\Services;

use App\Models\Membre;
use App\Models\Utilisateur;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use RuntimeException;

class UtilisateurService
{
    /**
     * Création d'un compte utilisateur lié à un membre, mot de passe provisoire généré,
     * changement obligatoire à la première connexion.
     */
    public function creerCompte(Membre $membre, string $email, string $role, ?Utilisateur $createur = null): array
    {
        if (Utilisateur::where('membre_id', $membre->id)->exists()) {
            throw new RuntimeException('Ce membre possède déjà un compte utilisateur.');
        }

        $motDePasseProvisoire = Str::password(12);

        $utilisateur = Utilisateur::create([
            'membre_id' => $membre->id,
            'email' => $email,
            'password_hash' => Hash::make($motDePasseProvisoire),
            'role' => $role,
            'actif' => true,
            'preferences' => ['must_change_password' => true],
        ]);

        return ['utilisateur' => $utilisateur, 'mot_de_passe_provisoire' => $motDePasseProvisoire];
    }

    public function desactiver(Utilisateur $utilisateur): Utilisateur
    {
        $utilisateur->update(['actif' => false]);
        $utilisateur->tokens()->delete();

        return $utilisateur;
    }

    public function activer(Utilisateur $utilisateur): Utilisateur
    {
        $utilisateur->update(['actif' => true, 'tentatives_echec' => 0, 'verrouille_jusqua' => null]);

        return $utilisateur;
    }

    public function changerRole(Utilisateur $utilisateur, string $nouveauRole, Utilisateur $auteur): Utilisateur
    {
        if ($utilisateur->id === $auteur->id) {
            throw new RuntimeException('Impossible de modifier son propre rôle.');
        }

        $utilisateur->update(['role' => $nouveauRole]);

        return $utilisateur;
    }
}
