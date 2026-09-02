<?php

namespace App\Http\Controllers\Api\Concerns;

use Illuminate\Validation\ValidationException;
use Throwable;

/**
 * Traduit les erreurs d'import historique (validation Laravel ou
 * RuntimeException levée par ImportResolver) en phrases lisibles pour un
 * utilisateur non technique, sans jargon ("field required", noms de colonnes
 * bruts...). Utilisé par tous les endpoints import-historique/fichier.
 */
trait FormateErreurImport
{
    private const LIBELLES_CHAMPS = [
        'caisse_id' => 'la caisse', 'caisse_source_id' => 'la caisse source', 'caisse_destination_id' => 'la caisse destination',
        'membre_id' => 'le membre', 'emprunteur_id' => "l'emprunteur", 'avaliste_id' => "l'avaliste",
        'reunion_id' => 'la réunion', 'type_sanction_id' => 'le type de sanction', 'gagnant_part_id' => 'le gagnant',
        'cotisation_tontine_part_id' => 'le membre (cotisation)', 'montant' => 'le montant',
        'montant_principal' => 'le montant du prêt', 'montant_verse' => 'le montant versé',
        'date_transaction' => 'la date', 'date_demande' => 'la date de demande', 'date_application' => 'la date',
        'date_effet' => "la date d'effet", 'date_ouverture' => "la date d'ouverture", 'date_cloture' => 'la date de clôture',
        'motif' => 'le motif', 'libelle' => 'le libellé', 'objet' => "l'objet", 'statut' => 'le statut',
    ];

    private function messageLisible(Throwable $e): string
    {
        if ($e instanceof ValidationException) {
            $phrases = [];
            foreach ($e->validator->errors()->messages() as $champ => $messages) {
                $champCourt = preg_replace('/\.\d+\./', '.', $champ);
                $nom = self::LIBELLES_CHAMPS[$champCourt] ?? self::LIBELLES_CHAMPS[$champ] ?? "\"$champ\"";
                $phrases[] = ucfirst($nom) . ' : ' . lcfirst(str_replace($champ, $nom, $messages[0]));
            }
            return implode(' — ', $phrases);
        }

        return $e->getMessage();
    }
}
