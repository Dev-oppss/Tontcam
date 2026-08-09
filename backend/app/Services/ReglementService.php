<?php

namespace App\Services;

use App\Models\DecisionAg;
use App\Models\ReglementInterieur;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class ReglementService
{
    /**
     * Publie une nouvelle version du règlement intérieur.
     * Requiert une décision d'AG de type "reglement" adoptée (RG-ORG-006).
     */
    public function publier(string $associationId, array $data): ReglementInterieur
    {
        $decision = DecisionAg::where('association_id', $associationId)
            ->where('numero_decision', $data['numero_decision_ag'])
            ->where('type', 'statutaire')
            ->where('statut', 'adopte')
            ->first();

        if (! $decision) {
            throw new RuntimeException("Aucune décision d'AG adoptée (type « règlement ») trouvée pour cette référence.");
        }

        return DB::transaction(function () use ($associationId, $data) {
            // La nouvelle version devient la seule active
            ReglementInterieur::where('association_id', $associationId)->update(['est_actif' => false]);

            return ReglementInterieur::create([
                'association_id' => $associationId,
                'version' => $data['version'],
                'titre' => $data['titre'] ?? 'Règlement intérieur',
                'contenu_html' => $data['contenu_html'] ?? null,
                'fichier_url' => $data['fichier_url'],
                'date_adoption' => $data['date_adoption'],
                'est_actif' => true,
                'signataires' => $data['signataires'] ?? [],
            ]);
        });
    }

    public function versionActive(string $associationId): ?ReglementInterieur
    {
        return ReglementInterieur::where('association_id', $associationId)->where('est_actif', true)->first();
    }
}
