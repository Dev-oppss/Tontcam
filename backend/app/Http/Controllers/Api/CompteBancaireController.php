<?php

namespace App\Http\Controllers\Api;

use App\Models\CompteBancaire;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CompteBancaireController extends CrudController
{
    protected string $model = CompteBancaire::class;
    protected array $filterable = ['association_id', 'actif', 'banque'];

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'association_id' => ['required', 'uuid'],
            'banque' => ['nullable', 'string', 'max:150'],
            'agence' => ['nullable', 'string', 'max:150'],
            'numero_compte' => ['nullable', 'string', 'max:100'],
            'iban' => ['nullable', 'string', 'max:100'],
            'titulaire' => ['required', 'string', 'max:150'],
            'solde_dernier_releve' => ['nullable', 'numeric'],
            'date_dernier_releve' => ['nullable', 'date'],
            'actif' => ['sometimes', 'boolean'],
            'notes' => ['nullable'],
        ]);

        if (is_array($data['notes'] ?? null)) {
            $data['notes'] = $data['notes'];
        } elseif (is_string($data['notes'] ?? null)) {
            $decoded = json_decode($data['notes'], true);
            if (json_last_error() === JSON_ERROR_NONE) {
                $data['notes'] = $decoded;
            }
        }

        return response()->json(CompteBancaire::create($data), 201);
    }
}
