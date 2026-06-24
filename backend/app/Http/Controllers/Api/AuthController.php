<?php

namespace App\Http\Controllers\Api;

use App\Models\Utilisateur;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class AuthController extends Controller
{
    public function login(Request $request): JsonResponse
    {
        $data = $request->validate(['email' => ['required','email'], 'password' => ['required','string']]);
        $user = Utilisateur::query()->where('email', $data['email'])->first();
        if (! $user || ! Hash::check($data['password'], $user->password_hash)) {
            return response()->json(['message' => 'Identifiants invalides'], 422);
        }
        return response()->json(['user' => $user, 'token' => $user->createToken('api')->plainTextToken, 'must_change_password' => (bool)($user->must_change_password ?? false)]);
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

    public function forgotPassword(Request $request): JsonResponse
    {
        $request->validate(['email' => ['required','email']]);
        return response()->json(['message' => 'Reset token pret pour notification future.']);
    }

    public function resetPassword(Request $request): JsonResponse
    {
        $request->validate(['email' => ['required','email'], 'password' => ['required','confirmed','min:8']]);
        $user = Utilisateur::query()->where('email', $request->email)->firstOrFail();
        $user->forceFill(['password_hash' => Hash::make($request->password), 'must_change_password' => false])->save();
        return response()->json(['ok' => true]);
    }

    public function changePassword(Request $request): JsonResponse
    {
        $request->validate(['password' => ['required','confirmed','min:8']]);
        $request->user()->forceFill(['password_hash' => Hash::make($request->password), 'must_change_password' => false])->save();
        return response()->json(['ok' => true]);
    }
}
