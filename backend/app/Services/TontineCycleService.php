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
    public function ouvrirCycle(Tontine $tontine, Reunion $reunion, ?Utilisateur $actingUser = null): CycleTontine
    {
        $this->assertReunionEligiblePourTirage($tontine, $reunion, $actingUser);

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
     * Import historique (super_admin uniquement) : crée un cycle de tontine déjà joué
     * (tirage déjà fait, cotisations déjà versées) avec ses vraies dates passées, sans
     * repasser par le tirage au sort / les enchères en temps réel. Réutilise
     * BulletinGainService::genererDepuisCycle() pour rester cohérent avec le flux normal
     * (mêmes retenues prêts/sanctions, même contrat de données).
     *
     * $data attend :
     *   reunion_id (déjà importée en statut 'tenue'/'cloturee'),
     *   gagnant_part_id (part gagnante, doit être actuellement 'disponible'),
     *   date_ouverture, date_cloture (réelles),
     *   cotisations: [{tontine_part_id, montant_verse, date_versement (nullable)}]
     *     — les parts non listées sont considérées non payées (impayee, montant_verse=0).
     *   montant_enchere, surplus_enchere (uniquement si tontine.mode_attribution == 'enchere')
     */
    public function importerHistorique(Tontine $tontine, array $data, Utilisateur $superAdmin): CycleTontine
    {
        if ($superAdmin->role !== 'super_admin') {
            throw new RuntimeException("L'import historique de cycles de tontine est réservé au super_admin.");
        }

        $reunion = Reunion::findOrFail($data['reunion_id']);
        if ($reunion->association_id !== $tontine->association_id) {
            throw new RuntimeException("Cette réunion n'appartient pas à l'association de la tontine.");
        }

        $dejaUtilisee = CycleTontine::where('tontine_id', $tontine->id)->where('reunion_id', $reunion->id)->exists();
        if ($dejaUtilisee) {
            throw new RuntimeException('Un cycle existe déjà pour cette réunion et cette tontine.');
        }

        $part = $tontine->parts()->where('statut', 'disponible')->find($data['gagnant_part_id']);
        if (! $part) {
            throw new RuntimeException("Cette part n'est pas disponible pour être désignée gagnante (déjà attribuée ou introuvable).");
        }

        $numero = ($tontine->cycles()->max('numero_cycle') ?? 0) + 1;
        $montantPrevu = (float) $tontine->montant_part * max(1, $tontine->parts()->count());
        $cotisationsData = $data['cotisations'] ?? [];

        return DB::transaction(function () use ($tontine, $reunion, $numero, $montantPrevu, $part, $data, $cotisationsData, $superAdmin) {
            $cycle = CycleTontine::create([
                'tontine_id' => $tontine->id,
                'reunion_id' => $reunion->id,
                'numero_cycle' => $numero,
                'statut' => 'clos',
                'montant_collecte_prevu' => $montantPrevu,
                'montant_enchere' => $data['montant_enchere'] ?? null,
                'surplus_enchere' => $data['surplus_enchere'] ?? null,
                'date_ouverture' => $data['date_ouverture'],
                'date_cloture' => $data['date_cloture'],
                'gagnant_part_id' => $part->id,
            ]);

            $montantCollecteReel = 0;
            foreach ($tontine->parts as $p) {
                $ligne = collect($cotisationsData)->firstWhere('tontine_part_id', $p->id);
                $montantVerse = (float) ($ligne['montant_verse'] ?? 0);
                $deficit = (float) $tontine->montant_part - $montantVerse;
                $statut = match (true) {
                    $montantVerse <= 0 => 'impayee',
                    $deficit > 0 => 'partielle',
                    default => 'payee',
                };

                CotisationTontine::create([
                    'cycle_id' => $cycle->id,
                    'tontine_part_id' => $p->id,
                    'membre_id' => $p->membre_id,
                    'montant_du' => $tontine->montant_part,
                    'montant_verse' => $montantVerse,
                    'statut' => $statut,
                    'date_versement' => $ligne['date_versement'] ?? null,
                ]);
                $montantCollecteReel += $montantVerse;
            }
            $cycle->update(['montant_collecte_reel' => $montantCollecteReel]);

            $part->update(['statut' => 'gagnee', 'date_attribution' => $data['date_cloture']]);

            // Surplus d'enchère (le cas échéant) rejoué en caisse à sa date historique.
            if (($data['surplus_enchere'] ?? 0) > 0) {
                $optionSurplus = $tontine->option_surplus;
                if ($optionSurplus !== 'redistribution') {
                    app(CaisseService::class)->entree(
                        $tontine->caisse,
                        (float) $data['surplus_enchere'],
                        "Surplus enchère cycle n°{$cycle->numero_cycle} (import historique)",
                        ['created_by' => $superAdmin->id, 'valide_par' => $superAdmin->id, 'date' => $data['date_cloture']]
                    );
                    $cycle->update(['surplus_mis_en_caisse' => $data['surplus_enchere']]);
                } else {
                    $cycle->update(['surplus_redistribue' => $data['surplus_enchere']]);
                }
            }

            // Même bulletin de gain que pour un cycle clôturé en direct (retenues prêts/
            // sanctions calculées sur l'état courant du membre, comme le fait cloturerCycle()).
            app(BulletinGainService::class)->genererDepuisCycle($cycle, $superAdmin);

            return $cycle;
        });
    }

    /**
     * Un tirage (ou toute désignation de bénéficiaire) ne peut se faire QUE pour la
     * séance réellement programmée qui vient dans l'ordre chronologique, jamais pour
     * une date choisie librement — sinon le gagnant est désigné pour une réunion
     * "fantôme" qui n'a jamais lieu, et la vraie séance suivante se retrouve bloquée
     * (contrainte unique tontine_id+reunion_id, ou tirage déjà "consommé" à tort).
     *
     * Règles :
     *  - la réunion doit appartenir à l'association de la tontine ;
     *  - elle ne doit pas être annulée ;
     *  - aucun cycle ne doit déjà exister pour ce couple (tontine, réunion) ;
     *  - il ne doit rester des parts disponibles à tirer (sinon la tontine est épuisée) ;
     *  - c'est la PROCHAINE réunion chronologique de l'association pas encore utilisée
     *    par cette tontine — on ne peut pas "sauter" une séance ni en piocher une au hasard.
     */
    private function assertReunionEligiblePourTirage(Tontine $tontine, Reunion $reunion, ?Utilisateur $actingUser = null): void
    {
        if ($reunion->association_id !== $tontine->association_id) {
            throw new RuntimeException("Cette réunion n'appartient pas à l'association de la tontine.");
        }

        if ($reunion->statut === 'annulee') {
            throw new RuntimeException('Impossible de désigner un bénéficiaire pour une réunion annulée.');
        }

        $dejaUtilisee = CycleTontine::where('tontine_id', $tontine->id)
            ->where('reunion_id', $reunion->id)
            ->exists();
        if ($dejaUtilisee) {
            throw new RuntimeException('Un tirage a déjà été effectué pour cette réunion et cette tontine.');
        }

        $partsRestantes = $tontine->parts()->where('statut', 'disponible')->count();
        if ($partsRestantes === 0) {
            throw new RuntimeException('Toutes les parts de cette tontine ont déjà été attribuées : aucun tirage supplémentaire n\'est possible.');
        }

        // Le super_admin peut bypasser la contrainte de sequence chronologique
        // stricte : cas de donnees seedees/importees ou une reunion passee
        // (ex. reunion n°1) n'a jamais eu de tirage reellement effectue et ne
        // sera jamais rattrapee retroactivement -> il ne faut pas bloquer tout
        // tirage futur indefiniment. A utiliser avec prudence : ca laisse un
        // trou definitif dans la rotation pour la reunion sautee.
        if ($actingUser?->role === 'super_admin') {
            return;
        }

        $prochaineReunionEligible = Reunion::where('association_id', $tontine->association_id)
            ->where('statut', '!=', 'annulee')
            ->whereDoesntHave('cyclesTontine', fn ($q) => $q->where('tontine_id', $tontine->id))
            ->orderBy('date_reunion')
            ->orderBy('numero')
            ->first();

        if (! $prochaineReunionEligible || $prochaineReunionEligible->id !== $reunion->id) {
            if (! $prochaineReunionEligible) {
                throw new RuntimeException("Aucune réunion programmée n'est disponible pour effectuer ce tirage. Planifiez d'abord la prochaine séance.");
            }

            $date = $prochaineReunionEligible->date_reunion instanceof \DateTimeInterface
                ? $prochaineReunionEligible->date_reunion->format('d/m/Y')
                : (string) $prochaineReunionEligible->date_reunion;

            throw new RuntimeException("Le tirage doit se faire pour la prochaine séance programmée de la tontine (réunion n°{$prochaineReunionEligible->numero} du {$date}), pas une date choisie librement.");
        }
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
            $part = $cycle->tontine->parts()->where('statut', 'disponible')->find($partIdForcee);
            if (! $part) {
                throw new RuntimeException("Ce membre n'a pas de part disponible pour ce tirage (déjà gagnée ou introuvable).");
            }
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
        $part = $tontine->parts()->where('statut', 'disponible')->orderBy('ordre_rotation')->first();
        if (! $part) {
            throw new RuntimeException('Aucune part disponible : toutes les parts de cette tontine ont déjà été attribuées.');
        }
        $this->attribuerPart($cycle, $part);

        return $part;
    }

    private function designerParTirage(CycleTontine $cycle, Tontine $tontine): TontinePart
    {
        $part = $tontine->parts()->where('statut', 'disponible')->inRandomOrder()->first();
        if (! $part) {
            throw new RuntimeException('Aucune part disponible : toutes les parts de cette tontine ont déjà été attribuées.');
        }
        $this->attribuerPart($cycle, $part);

        return $part;
    }

    /**
     * Clôture les enchères : la part va au plus offrant.
     * Surplus = Montant_enchère_gagnante − (nb_parts × montant_par_part) (cahier des charges 5.2).
     */
    private function designerParEnchere(CycleTontine $cycle, Tontine $tontine): TontinePart
    {
        // RG-TON-020 : en cas d'égalité entre plusieurs offres au montant maximal,
        // la première soumise (created_at le plus ancien) l'emporte.
        $meilleure = Encherite::where('cycle_id', $cycle->id)
            ->orderByDesc('montant_offre')
            ->orderBy('created_at')
            ->first();
        if (! $meilleure) {
            throw new RuntimeException('Aucune enchère reçue pour ce cycle.');
        }
        if ($tontine->mise_min_enchere && (float) $meilleure->montant_offre < (float) $tontine->mise_min_enchere) {
            throw new RuntimeException('La meilleure enchère est sous la mise minimale.');
        }

        $meilleure->update(['est_gagnante' => true]);
        $part = TontinePart::find($meilleure->tontine_part_id);
        if (! $part) {
            throw new RuntimeException("La part correspondant à l'enchère gagnante est introuvable.");
        }

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
            ->first();
        if (! $part) {
            throw new RuntimeException("Aucune part n'atteint sa date de gain calendaire pour l'instant.");
        }
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

        // RG-TON-030 : toute cotisation du cycle non réglée à la clôture passe IMPAYEE.
        $cycle->cotisations()->whereIn('statut', ['due', 'en_retard'])->update(['statut' => 'impayee']);

        $cycle->update(['statut' => 'clos', 'date_cloture' => now()]);

        app(BulletinGainService::class)->genererDepuisCycle($cycle, $auteur);

        return $cycle;
    }
}
