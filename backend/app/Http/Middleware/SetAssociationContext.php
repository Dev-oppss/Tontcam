<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\Response;

class SetAssociationContext
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();
        $associationId = $user?->membre?->association_id ?? $user?->association_id;
        $role = $user?->role ?? '';
        $membreId = $user?->membre_id ?? $user?->membre?->id ?? '';
        $userId = $user?->id ?? '';
        if ($associationId) {
            DB::statement("select set_config('tontine.current_association_id', ?, true)", [$associationId]);
        }
        DB::statement("select set_config('tontine.current_role', ?, true)", [$role]);
        DB::statement("select set_config('tontine.current_membre_id', ?, true)", [$membreId]);
        DB::statement("select set_config('tontine.current_user_id', ?, true)", [$userId]);

        return $next($request);
    }
}
