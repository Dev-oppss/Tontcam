<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class UploadController extends Controller
{
    /**
     * Upload générique (pièces jointes sanctions/aides sociales, justificatifs...).
     * Retourne l'URL publique du fichier stocké, à réutiliser dans les autres endpoints
     * (ex : pieces_jointes des aides sociales n'accepte que des chaînes, pas des fichiers).
     */
    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'fichier' => ['required', 'file', 'mimes:pdf,jpg,jpeg,png', 'max:10240'],
        ]);

        $chemin = $request->file('fichier')->store('pieces-jointes', 'public');

        return response()->json([
            'url' => Storage::url($chemin),
            'nom' => $request->file('fichier')->getClientOriginalName(),
        ], 201);
    }
}
