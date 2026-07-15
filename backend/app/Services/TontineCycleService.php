<?php

namespace App\Services;

use App\Models\CotisationTontine;
use App\Models\CycleTontine;
use App\Models\Encherite;
use App\Models\Reunion;
use App\Models\Tontine;
use App\Models\TontinePart;
use App\Models\Utilisateur;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class TontineCycleService
{
    public function ouvrirCycle(Tontine $tontine, Reunion $reunion): CycleTontine
    {
        $numero = ($tontine->cycles()->max('numero_cycle') ?? 0) + 1;

        $partsActives = $tontine->parts()->where('statut', 'disponible')->count();
        $montantPrevu = (float) $tontine->montant_part * max(1, $tontine->parts()->count());

        return DB::transaction(function () use ($tontine, $reunion, $numero, $montantPrevu) {
            $cycle = CycleTontine::create([
                'tontine_id' => $tontine->id,
                'reunion_id' => $reunion->id,
                'numero_cycle' => $numero,
                'statut' => 'ouvert',
                'montant_collecte_prevu' => $montantPrevu,
                'date_ouverture' => now(),
            ]);

            // Génère une ligne de cotisation "due" pour chaque part de la tontine (RG-TON règle parts multiples)
            foreach ($tontine->parts as $part) {
                CotisationTontine::create([
                    'cycle_id' => $cycle->id,
                    'tontine_part_id' => $part->id,
                    'membre_id' => $part->membre_id,
                    'montant_du' => $tontine->montant_part,
                    'montant_verse' => 0,
                    'statut' => 'due',
                ]);
            }

            return $cycle;
        });
    }

    /**
     * Saisie ligne par ligne des cotisations, montant partiel autorisé.
     */
    public function saisirCotisations(CycleTontine $cycle, CotisationTontine $cotisation, float $montantVerse, Utilisateur $saisiPar, array $options = []): CotisationTontine
    {
        if ($cycle->statut === 'clos') {
            throw new RuntimeException('Cycle clôturé : cotisations non modifiables.');
        }

        $deficit = (float) $cotisation->montant_du - $montantVerse;
        $statut = match (true) {
            $montantVerse <= 0 => 'impayee',
            $deficit > 0 => 'partielle',
            default => 'payee',
        };

        $cotisation->update([
            'montant_verse' => $montantVerse,
            'statut' => $statut,
            'date_versement' => $montantVerse > 0 ? now() : null,
            'mode_paiement' => $options['mode_paiement'] ?? null,
            'reference_paiement' => $options['reference_paiement'] ?? null,
            'saisie_par' => $saisiPar->id,
        ]);

        if ($statut !== 'payee') {
            app(SanctionService::class)->retardCotisation($cotisation->membre, $cotisation->fresh());
        }

        $totalCollecte = (float) $cycle->cotisations()->sum('montant_verse');
        $cycle->update(['montant_collecte_reel' => $totalCollecte]);

        return $cotisation;
    }

    /**
     * Désigne le gagnant selon le mode d'attribution de la tontine (RG-TON).
     */
    public function designerGagnant(CycleTontine $cycle, ?string $partIdForcee = null): TontinePart
    {
        if ($partIdForcee) {
            $part = $cycle->tontine->parts()->where('statut', 'disponible')->findOrFail($partIdForcee);
            $this->attribuerPart($cycle, $part);

            return $part;
        }

        $tontine = $cycle->tontine;

        return match ($tontine->mode_attribution) {
            'rotation' => $this->designerParRotation($cycle, $tontine),
            'tirage_sort' => $this->designerParTirage($cycle, $tontine),
            'enchere' => $this->designerParEnchere($cycle, $tontine),
            'calendrier' => $this->designerParCalendrier($cycle, $tontine),
            default => throw new RuntimeException('Mode d\'attribution inconnu.'),
        };
    }

    private function designerParRotation(CycleTontine $cycle, Tontine $tontine): TontinePart
    {
        $part = $tontine->parts()->where('statut', 'disponible')->orderBy('ordre_rotation')->firstOrFail();
        $this->attribuerPart($cycle, $part);

        return $part;
    }

    private function designerParTirage(CycleTontine $cycle, Tontine $tontine): TontinePart
    {
        $part = $tontine->parts()->where('statut', 'disponible')->inRandomOrder()->firstOrFail();
        $this->attribuerPart($cycle, $part);

        return $part;
    }

    /**
     * Clôture les enchères : la part va au plus offrant.
     * Surplus = Montant_enchère_gagnante − (nb_parts × montant_par_part) (cahier des charges 5.2).
     */
    private function designerParEnchere(CycleTontine $cycle, Tontine $tontine): TontinePart
    {
        $meilleure = Encherite::where('cycle_id', $cycle->id)->orderByDesc('montant_offre')->first();
        if (! $meilleure) {
            throw new RuntimeException('Aucune enchère reçue pour ce cycle.');
        }
        if ($tontine->mise_min_enchere && (float) $meilleure->montant_offre < (float) $tontine->mise_min_enchere) {
            throw new RuntimeException('La meilleure enchère est sous la mise minimale.');
        }

        $meilleure->update(['est_gagnante' => true]);
        $part = TontinePart::findOrFail($meilleure->tontine_part_id);

        $nbParts = $tontine->parts()->count();
        $surplus = max(0, (float) $meilleure->montant_offre - ($nbParts * (float) $tontine->montant_part));

        $surplusRedistribue = 0;
        $surplusCaisse = 0;
        if ($surplus > 0) {
            if ($tontine->option_surplus === 'redistribution') {
                $surplusRedistribue = $surplus;
            } else {
                $surplusCaisse = $surplus;
                app(CaisseService::class)->entree($tontine->caisse, $surplus, "Surplus enchère cycle n°{$cycle->numero_cycle}");
            }
        }

        $cycle->update([
            'montant_enchere' => $meilleure->montant_offre,
            'surplus_enchere' => $surplus,
            'surplus_redistribue' => $surplusRedistribue,
            'surplus_mis_en_caisse' => $surplusCaisse,
        ]);

        $this->attribuerPart($cycle, $part);

        return $part;
    }

    private function designerParCalendrier(CycleTontine $cycle, Tontine $tontine): TontinePart
    {
        $part = $tontine->parts()
            ->where('statut', 'disponible')
            ->whereDate('date_gain_calendrier', '<=', now())
            ->orderBy('date_gain_calendrier')
            ->firstOrFail();
        $this->attribuerPart($cycle, $part);

        return $part;
    }

    private function attribuerPart(CycleTontine $cycle, TontinePart $part): void
    {
        $part->update(['statut' => 'gagnee', 'date_attribution' => now()]);
        $cycle->update(['gagnant_part_id' => $part->id]);
    }

    public function cloturerCycle(CycleTontine $cycle, Utilisateur $auteur): CycleTontine
    {
        if (! $cycle->gagnant_part_id) {
            throw new RuntimeException('Impossible de clôturer : aucun gagnant désigné.');
        }

        $cycle->update(['statut' => 'clos', 'date_cloture' => now()]);

        app(BulletinGainService::class)->genererDepuisCycle($cycle, $auteur);

        return $cycle;
    }
}
