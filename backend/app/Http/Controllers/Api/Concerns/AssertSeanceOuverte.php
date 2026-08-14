<?php

namespace App\Http\Controllers\Api\Concerns;

use App\Models\Reunion;

/**
 * RG-SEA-001 : comme pour les cotisations de tontine, tout mouvement d'argent
 * ou décision (prêt décaissé, sanction appliquée, décision d'AG, aide sociale
 * versée) ne peut être fait que pendant une séance ouverte. Séance non ouverte
 * (planifiée) ou déjà clôturée => rien n'est faisable/modifiable.
 */
trait AssertSeanceOuverte
{
    protected function assertSeanceOuverte(Reunion $reunion): void
    {
        if ($reunion->statut !== 'ouverte') {
            throw new \RuntimeException(
                "Cette opération n'est possible que pendant une séance ouverte (réunion n°{$reunion->numero} : {$reunion->statut})."
            );
        }
    }
}
