<?php

namespace App\Http\Controllers\Api;

use App\Models\Utilisateur;
use App\Services\NotificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class AuthController extends Controller
{
    /**
     * RG-SEC-001 : Authentification email/mot de passe.
     * RG-SEC-004 : Verrouillage du compte après 5 tentatives échouées (15 min).
     */
    public function login(Request $request): JsonResponse
    {
        $data = $request->validate([
            'email'    => ['required', 'email'],
            'password' => ['required', 'string'],
        ]);

        // RG-SEC-004 : vérifier le verrou avant tout
        $lockKey = 'login_attempts:' . $request->ip() . ':' . $data['email'];
        $attempts = Cache::get($lockKey, 0);

        if ($attempts >= 5) {
            return response()->json([
                'message' => 'Compte temporairement verrouillé. Réessayez dans 15 minutes.',
            ], 429);
        }

        $user = Utilisateur::query()->where('email', $data['email'])->first();

        if (! $user || ! Hash::check($data['password'], $user->password_hash)) {
            // Incrémenter le compteur d'échecs (TTL 15 min)
            Cache::put($lockKey, $attempts + 1, now()->addMinutes(15));
            return response()->json(['message' => 'Identifiants invalides'], 422);
        }

        // Réinitialiser le compteur en cas de succès
        Cache::forget($lockKey);

        return response()->json([
            'user'                 => $user,
            'token'                => $user->createToken('api')->plainTextToken,
            'must_change_password' => (bool) ($user->must_change_password ?? false),
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()?->currentAccessToken()?->delete();
        return response()->json(['ok' => true]);
    }

    public function me(Request $request): JsonResponse
    {
        return response()->json($request->user());
    }

    /**
     * RG-SEC-005 : Réinitialisation par lien SMS/email — validité 30 minutes.
     * NOTE : L'envoi réel du lien doit être déclenché ici via un Job/Notification.
     */
    public function forgotPassword(Request $request): JsonResponse
    {
        $request->validate(['email' => ['required', 'email']]);

        $user = Utilisateur::query()->where('email', $request->email)->first();

        if ($user) {
            // Générer un token sécurisé valide 30 minutes (RG-SEC-005)
            $token = Str::random(64);
            Cache::put('pwd_reset:' . $token, $user->id, now()->addMinutes(30));

            app(NotificationService::class)->notifierMotDePasseOublie(
                $user->membre?->association_id ?? $user->association_id ?? '',
                $user->membre_id ?? null,
                $user->email
            );
        }

        // Réponse générique pour ne pas révéler l'existence du compte
        return response()->json([
            'message' => 'Si cet email existe, un lien de réinitialisation a été envoyé.',
        ]);
    }

    /**
     * RG-SEC-005 : Vérification du token avant réinitialisation.
     * RG-SEC-003 : Contraintes de complexité du mot de passe.
     */
    public function resetPassword(Request $request): JsonResponse
    {
        $request->validate([
            'token'    => ['required', 'string'],
            'password' => ['required', 'confirmed', 'min:8', 'regex:/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).+$/'],
        ]);

        $userId = Cache::pull('pwd_reset:' . $request->token);

        if (! $userId) {
            return response()->json(['message' => 'Token invalide ou expiré.'], 422);
        }

        $user = Utilisateur::findOrFail($userId);
        $user->forceFill([
            'password_hash'        => Hash::make($request->password),
            'must_change_password' => false,
        ])->save();

        return response()->json(['ok' => true]);
    }

    /**
     * RG-SEC-002 : Changement obligatoire du mot de passe à la première connexion.
     * RG-SEC-003 : Contraintes de complexité.
     */
    public function changePassword(Request $request): JsonResponse
    {
        $request->validate([
            'password' => ['required', 'confirmed', 'min:8', 'regex:/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).+$/'],
        ]);

        $request->user()->forceFill([
            'password_hash'        => Hash::make($request->password),
            'must_change_password' => false,
        ])->save();

        return response()->json(['ok' => true]);
    }
}
