<?php

namespace App\Services;

use App\Models\DecisionAg;
use App\Models\Reunion;

class DecisionAgService
{
    public function enregistrer(Reunion $reunion, array $data): DecisionAg
    {
        $annee = now()->year;
        $numero = 'AG-'.$annee.'-'.str_pad(
            (string) (DecisionAg::where('association_id', $reunion->association_id)->whereYear('created_at', $annee)->count() + 1),
            3, '0', STR_PAD_LEFT
        );

        $votesPour = (int) ($data['votes_pour'] ?? 0);
        $votesContre = (int) ($data['votes_contre'] ?? 0);

        return DecisionAg::create([
            'association_id' => $reunion->association_id,
            'reunion_id' => $reunion->id,
            'numero_decision' => $numero,
            'type' => $data['type'],
            'objet' => $data['objet'],
            'description' => $data['description'] ?? null,
            'quorum_present' => $data['quorum_present'] ?? 0,
            'votes_pour' => $votesPour,
            'votes_contre' => $votesContre,
            'votes_abstention' => $data['votes_abstention'] ?? 0,
            'statut' => $votesPour > $votesContre ? 'adopte' : 'rejete',
            'date_effet' => $data['date_effet'] ?? null,
            'notes' => $data['notes'] ?? null,
        ]);
    }
}
