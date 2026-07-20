<?php

namespace App\Http\Controllers\Api;

use App\Models\BulletinGain;
use App\Models\Notification;
use App\Services\AccessScopeService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use App\Http\Controllers\Controller;
use Illuminate\Support\Facades\Gate;

class PortalController extends Controller
{
    public function __construct(private readonly AccessScopeService $scope) {}

    public function show(Request $request): JsonResponse
    {
        $user = $request->user();
        $membre = $user?->membre;

        if (! $membre) {
            return response()->json(['message' => 'Portail membre indisponible.'], 403);
        }

        Gate::authorize('view', $membre);

        $membre->loadMissing(['association', 'parts.tontine', 'prets', 'sanctions', 'presences']);

        return response()->json([
            'membre' => $membre,
            'resume' => [
                'parts' => $membre->parts()->count(),
                'prets_en_cours' => $membre->prets()->whereIn('statut', ['en_cours', 'en_retard', 'defaut'])->count(),
                'sanctions_impayees' => $membre->sanctions()->where('statut', 'due')->count(),
                'bulletins' => BulletinGain::query()->where('gagnant_membre_id', $membre->id)->count(),
            ],
            'prets' => $membre->prets()->latest()->limit(10)->get(),
            'sanctions' => $membre->sanctions()->latest()->limit(10)->get(),
            'bulletins' => BulletinGain::query()->where('gagnant_membre_id', $membre->id)->latest()->limit(10)->get(),
            'notifications' => Notification::query()->where('membre_id', $membre->id)->latest()->limit(10)->get(),
            'presences' => $membre->presences()->latest()->limit(10)->get(),
            'association_id' => $this->scope->associationId($request),
        ]);
    }
}
