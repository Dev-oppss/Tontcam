<?php

namespace App\Services;

use App\Models\Membre;
use App\Models\MembrePoste;
use App\Models\Poste;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class PosteService
{
    /**
     * Attribue un poste à un membre. Clôture automatiquement le mandat précédent
     * s'il existe, et vérifie le plafond de cumul (RG-ORG-010).
     */
    public function attribuer(Poste $poste, Membre $membre, string $dateDebut, ?int $plafondCumul = 2): MembrePoste
    {
        if ($membre->association_id !== $poste->association_id) {
            throw new RuntimeException('Le membre et le poste n\'appartiennent pas à la même association.');
        }

        $nbPostesActifs = MembrePoste::where('membre_id', $membre->id)->whereNull('date_fin')->count();
        if ($nbPostesActifs >= $plafondCumul) {
            throw new RuntimeException("Plafond de cumul atteint ({$plafondCumul} poste(s) simultané(s) max).");
        }

        return DB::transaction(function () use ($poste, $membre, $dateDebut) {
            // Clôture le mandat en cours sur ce poste, s'il existe
            MembrePoste::where('poste_id', $poste->id)->whereNull('date_fin')->update(['date_fin' => $dateDebut]);

            return MembrePoste::create([
                'membre_id' => $membre->id,
                'poste_id' => $poste->id,
                'date_debut' => $dateDebut,
            ]);
        });
    }

    public function cloturer(MembrePoste $mandat, string $dateFin): MembrePoste
    {
        if ($mandat->date_fin) {
            throw new RuntimeException('Ce mandat est déjà clôturé.');
        }

        $mandat->update(['date_fin' => $dateFin, 'est_actif' => false]);

        return $mandat;
    }

    /**
     * Vérifie que les postes obligatoires (Président, SG, Trésorier) ont un titulaire actif.
     */
    public function verifierPostesObligatoiresPourvus(string $associationId): array
    {
        $obligatoires = Poste::where('association_id', $associationId)->where('est_obligatoire', true)->get();
        $vacants = [];

        foreach ($obligatoires as $poste) {
            $pourvu = MembrePoste::where('poste_id', $poste->id)->whereNull('date_fin')->exists();
            if (! $pourvu) {
                $vacants[] = $poste->libelle;
            }
        }

        return $vacants;
    }
}
