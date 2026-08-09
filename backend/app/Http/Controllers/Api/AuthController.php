<?php

namespace App\Http\Controllers\Api;

use App\Models\Association;
use App\Models\Membre;
use App\Models\Utilisateur;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use App\Http\Controllers\Controller;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class AuthController extends Controller
{
    private const MAX_TENTATIVES = 5;

    /**
     * Inscription : crée en une seule transaction l'association (fiche minimale,
     * à compléter ensuite), le membre fondateur et son compte utilisateur, puis
     * connecte immédiatement la personne (RG : un utilisateur est toujours rattaché
     * à un membre, lui-même toujours rattaché à une association — aucune des trois
     * ne peut exister seule).
     */
    public function register(Request $request): JsonResponse
    {
        $data = $request->validate([
            'nom' => ['required', 'string', 'max:100'],
            'prenom' => ['required', 'string', 'max:100'],
            'telephone' => ['required', 'string', 'max:30'],
            'email' => ['required', 'email', 'max:200', 'unique:utilisateurs,email'],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
        ]);

        $utilisateur = DB::transaction(function () use ($data) {
            // Aucune information d'association n'est demandée à l'inscription : une fiche
            // vide est ouverte automatiquement, à compléter ensuite sur /setup.
            $association = Association::create([
                'nom' => trim($data['prenom'].' '.$data['nom']).' — association à compléter ('.strtoupper(Str::random(4)).')',
                'date_creation' => now()->toDateString(),
                'profil_complete' => false,
            ]);

            // La fiche membre est protégée par des politiques RLS (isolation multi-tenant) :
            // ces réglages, valables le temps de la transaction, autorisent l'écriture initiale
            // exactement comme le ferait le middleware SetAssociationContext pour une requête authentifiée.
            DB::statement("select set_config('tontine.current_association_id', ?, true)", [$association->id]);
            DB::statement("select set_config('tontine.current_role', 'super_admin', true)");

            $membre = Membre::create([
                'association_id' => $association->id,
                'nom' => $data['nom'],
                'prenom' => $data['prenom'],
                'telephone' => $data['telephone'],
                'email' => $data['email'],
                'date_adhesion' => now()->toDateString(),
                'statut' => 'actif',
            ]);

            return Utilisateur::create([
                'membre_id' => $membre->id,
                'email' => $data['email'],
                'password_hash' => Hash::make($data['password']),
                'role' => 'super_admin',
                'actif' => true,
            ]);
        });

        $utilisateur->load('membre.association');

        return response()->json([
            'user' => $utilisateur,
            'token' => $utilisateur->createToken('api')->plainTextToken,
            'must_change_password' => false,
        ], 201);
    }

    public function login(Request $request): JsonResponse
    {
        $data = $request->validate(['email' => ['required', 'email'], 'password' => ['required', 'string']]);

        $user = Utilisateur::with('membre.association')->where('email', $data['email'])->first();

        if (! $user || ! $user->actif) {
            return response()->json(['message' => 'Identifiants invalides'], 422);
        }

        if ($user->verrouille_jusqua && $user->verrouille_jusqua->isFuture()) {
            return response()->json(['message' => 'Compte temporairement verrouillé, réessayez plus tard.'], 423);
        }

        if (! Hash::check($data['password'], $user->password_hash)) {
            $tentatives = $user->tentatives_echec + 1;
            $user->update([
                'tentatives_echec' => $tentatives,
                'verrouille_jusqua' => $tentatives >= self::MAX_TENTATIVES ? now()->addMinutes(15) : null,
            ]);

            return response()->json(['message' => 'Identifiants invalides'], 422);
        }

        $user->update(['tentatives_echec' => 0, 'verrouille_jusqua' => null, 'derniere_connexion' => now()]);

        $mustChangePassword = (bool) ($user->preferences['must_change_password'] ?? false);

        return response()->json([
            'user' => $user,
            'token' => $user->createToken('api')->plainTextToken,
            'must_change_password' => $mustChangePassword,
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()?->currentAccessToken()?->delete();

        return response()->json(['ok' => true]);
    }

    public function me(Request $request): JsonResponse
    {
        return response()->json($request->user()?->loadMissing('membre.association'));
    }

    /**
     * Permet à l'utilisateur connecté de modifier ses propres informations
     * (email de connexion + coordonnées de sa fiche membre). Utile en particulier
     * après une création de compte par un admin avec mot de passe provisoire :
     * la personne peut ensuite corriger son email/nom/téléphone elle-même.
     */
    public function updateMe(Request $request): JsonResponse
    {
        $user = $request->user();
        $membre = $user->membre;

        $data = $request->validate([
            'email' => ['sometimes', 'email', 'max:200', 'unique:utilisateurs,email,' . $user->id],
            'nom' => ['sometimes', 'string', 'max:100'],
            'prenom' => ['sometimes', 'string', 'max:100'],
            'telephone' => ['sometimes', 'string', 'max:30'],
            'telephone2' => ['sometimes', 'nullable', 'string', 'max:30'],
            'adresse' => ['sometimes', 'nullable', 'string'],
            'ville' => ['sometimes', 'nullable', 'string', 'max:100'],
            'profession' => ['sometimes', 'nullable', 'string', 'max:150'],
        ]);

        DB::transaction(function () use ($data, $user, $membre) {
            if (isset($data['email'])) {
                $user->update(['email' => $data['email']]);
            }
            $membreData = array_intersect_key($data, array_flip([
                'nom', 'prenom', 'telephone', 'telephone2', 'adresse', 'ville', 'profession',
            ]));
            // L'email de la fiche membre reste aligné sur l'email de connexion pour cohérence.
            if (isset($data['email'])) {
                $membreData['email'] = $data['email'];
            }
            if ($membreData) {
                $membre->update($membreData);
            }
        });

        return response()->json($user->fresh()->loadMissing('membre.association'));
    }

    public function forgotPassword(Request $request): JsonResponse
    {
        $request->validate(['email' => ['required', 'email']]);

        $user = Utilisateur::where('email', $request->email)->first();
        // Réponse volontairement neutre pour ne pas divulguer l'existence du compte
        if ($user) {
            $user->update([
                'token_reset_mdp' => Str::random(64),
                'token_reset_exp' => now()->addHours(2),
            ]);
            // Le job d'envoi SMS/email réel se branche ici via NotificationService.
        }

        return response()->json(['message' => 'Si ce compte existe, un lien de réinitialisation a été envoyé.']);
    }

    public function resetPassword(Request $request): JsonResponse
    {
        $request->validate([
            'email' => ['required', 'email'],
            'token' => ['required', 'string'],
            'password' => ['required', 'confirmed', 'min:8'],
        ]);

        $user = Utilisateur::where('email', $request->email)
            ->where('token_reset_mdp', $request->token)
            ->where('token_reset_exp', '>', now())
            ->first();

        if (! $user) {
            return response()->json(['message' => 'Lien de réinitialisation invalide ou expiré.'], 422);
        }

        $user->update([
            'password_hash' => Hash::make($request->password),
            'token_reset_mdp' => null,
            'token_reset_exp' => null,
            'tentatives_echec' => 0,
            'verrouille_jusqua' => null,
            'preferences' => array_merge($user->preferences ?? [], ['must_change_password' => false]),
        ]);

        return response()->json(['ok' => true]);
    }

    public function changePassword(Request $request): JsonResponse
    {
        $request->validate([
            'current_password' => ['required', 'string'],
            'password' => ['required', 'confirmed', 'min:8'],
        ]);

        $user = $request->user();

        if (! Hash::check($request->current_password, $user->password_hash)) {
            return response()->json(['message' => 'Mot de passe actuel incorrect.'], 422);
        }

        $user->update([
            'password_hash' => Hash::make($request->password),
            'preferences' => array_merge($user->preferences ?? [], ['must_change_password' => false]),
        ]);

        return response()->json(['ok' => true]);
    }
}
