<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureRole
{
    public function handle(Request $request, Closure $next, string ...$roles): Response
    {
        $userRole = $request->user()?->role;
        if (! $userRole || ! in_array($userRole, $roles, true)) {
            return response()->json(['message' => 'Accès interdit.'], 403);
        }

        return $next($request);
    }
}
