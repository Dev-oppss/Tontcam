<?php

namespace App\Services;

use App\Models\CotisationTontine;
use App\Models\CycleTontine;
use App\Models\Encherite;
use App\Models\PlanningTour;
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
                $cotisation = CotisationTontine::create([
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

        $cyclesDansReunion = CycleTontine::where('tontine_id', $tontine->id)->where('reunion_id', $reunion->id)->count();
        if ($cyclesDansReunion >= (int) $tontine->max_cycles_par_reunion) {
            throw new RuntimeException('La limite de tours autorisés pour cette réunion est atteinte.');
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

                $cotisation = CotisationTontine::create([
                    'cycle_id' => $cycle->id,
                    'tontine_part_id' => $p->id,
                    'membre_id' => $p->membre_id,
                    'montant_du' => $tontine->montant_part,
                    'montant_verse' => $montantVerse,
                    'statut' => $statut,
                    'date_versement' => $ligne['date_versement'] ?? null,
                ]);
                // Un import doit reconstruire le livre de caisse, pas seulement
                // l'historique métier : chaque cotisation réellement versée est
                // donc rejouée à sa date d'origine.
                if ($montantVerse > 0) {
                    app(CaisseService::class)->entree(
                        $tontine->caisse,
                        $montantVerse,
                        "Cotisation tontine cycle n°{$numero} (import historique)",
                        ['reference_type' => 'cotisation_tontine', 'reference_id' => $cotisation->id, 'created_by' => $superAdmin->id, 'valide_par' => $superAdmin->id, 'date' => $ligne['date_versement'] ?? $data['date_cloture']]
                    );
                }
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
            $bulletin = app(BulletinGainService::class)->genererDepuisCycle($cycle, $superAdmin);
            if ($data['gain_verse']) {
                app(BulletinGainService::class)->verser(
                    $bulletin,
                    $data['mode_versement'] ?? 'especes',
                    $data['reference_versement'] ?? null,
                    $superAdmin,
                    $data['date_cloture']
                );
            }

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

        $reunionsPlan = $this->reunionsDuPlan($tontine);
        $cyclesParReunion = CycleTontine::where('tontine_id', $tontine->id)
            ->selectRaw('reunion_id, COUNT(*) as total')->groupBy('reunion_id')->pluck('total', 'reunion_id');
        $cyclesDansReunion = (int) ($cyclesParReunion[$reunion->id] ?? 0);
        $capacite = $this->capacitePourSeance($tontine, $reunion, $reunionsPlan);
        if ($cyclesDansReunion >= $capacite) {
            throw new RuntimeException("Cette séance comporte déjà le nombre de tours prévu ({$capacite}) pour la durée configurée.");
        }

        $statutsEligibles = $tontine->mode_attribution === 'rotation'
            ? ['disponible', 'reservee']
            : ['disponible'];
        $partsRestantes = $tontine->parts()->whereIn('statut', $statutsEligibles)->count();
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

        $prochaineReunionEligible = $reunionsPlan->first(fn (Reunion $candidate) =>
            (int) ($cyclesParReunion[$candidate->id] ?? 0) < $this->capacitePourSeance($tontine, $candidate, $reunionsPlan)
        );

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

    private function reunionsDuPlan(Tontine $tontine)
    {
        return Reunion::where('association_id', $tontine->association_id)
            ->where('statut', '!=', 'annulee')
            ->when($tontine->date_debut, fn ($query) => $query->whereDate('date_reunion', '>=', $tontine->date_debut))
            ->orderBy('date_reunion')->orderBy('numero')->get();
    }

    /** Répartit les tours supplémentaires sur les séances de la durée cible : 14 parts / 12 séances => 1,1,1,1,1,2,...,2. */
    private function capacitePourSeance(Tontine $tontine, Reunion $reunion, $reunionsPlan): int
    {
        $position = $reunionsPlan->search(fn (Reunion $item) => $item->id === $reunion->id);
        if ($position === false) {
            return max(1, (int) $tontine->max_cycles_par_reunion);
        }
        $position++;
        $parts = max((int) $tontine->nb_parts_total, $tontine->parts()->count());
        $duree = max(1, (int) (($tontine->config['duree_seances'] ?? null) ?: $parts));
        if ($position > $duree) {
            return 1; // rattrapage si une séance prévue a été annulée ou manquée
        }

        return max(1, (int) floor($position * $parts / $duree) - (int) floor(($position - 1) * $parts / $duree));
    }

    /**
     * Saisie ligne par ligne des cotisations, montant partiel autorisé.
     */
    public function saisirCotisations(CycleTontine $cycle, CotisationTontine $cotisation, float $montantVerse, Utilisateur $saisiPar, array $options = []): CotisationTontine
    {
        $cycle->loadMissing('reunion', 'bulletin');

        if ($cycle->statut === 'clos') {
            $this->assertCotisationCorrigeable($cycle);
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

        // Une correction après clôture change le brut du bulletin : on le
        // recalcule pour rester cohérent avec les cotisations réellement saisies.
        if ($cycle->statut === 'clos' && $cycle->bulletin) {
            app(BulletinGainService::class)->recalculerDepuisCotisations($cycle->bulletin->fresh(), $saisiPar);
        }

        return $cotisation;
    }

    /**
     * Autorise la correction d'une cotisation même après la clôture du cycle
     * (RG-TON — erreur de saisie fréquente : membre coché « cotisé » à tort ou
     * inversement). Reste bloqué dès qu'un mouvement de caisse ou une signature
     * rendrait la correction risquée ; dans ces cas, il faut d'abord passer par
     * le retour des fonds (BulletinGainService::annulerVersement) ou, en dernier
     * recours, l'annulation complète du cycle.
     */
    private function assertCotisationCorrigeable(CycleTontine $cycle): void
    {
        if (in_array($cycle->reunion->statut, ['cloturee', 'annulee'], true)) {
            throw new RuntimeException('Une réunion clôturée ou annulée ne peut plus être modifiée.');
        }

        $bulletin = $cycle->bulletin;
        if (! $bulletin) {
            return;
        }
        if ($bulletin->statut === 'paye') {
            throw new RuntimeException('Le gain a déjà été versé : enregistrez d’abord le retour des fonds (bulletin) avant de corriger une cotisation de ce cycle.');
        }
        if ($bulletin->signe_tresorier_at || $bulletin->signe_president_at || $bulletin->signe_beneficiaire_at) {
            throw new RuntimeException('Impossible de corriger : le bulletin de ce cycle porte déjà au moins une signature.');
        }
    }

    /**
     * Désigne le gagnant selon le mode d'attribution de la tontine (RG-TON).
     */
    public function designerGagnant(CycleTontine $cycle, ?string $partIdForcee = null): TontinePart
    {
        $tontine = $cycle->tontine;

        // En mode enchère, une désignation manuelle reste possible mais doit
        // obligatoirement correspondre à une offre réelle. Ainsi le bulletin,
        // les surplus et l'historique restent cohérents avec le choix effectué.
        if ($tontine->mode_attribution === 'enchere') {
            return $this->designerParEnchere($cycle, $tontine, $partIdForcee);
        }

        if ($tontine->mode_attribution === 'rotation') {
            return $this->designerParRotation($cycle, $tontine, $partIdForcee);
        }

        if ($partIdForcee) {
            $part = $tontine->parts()->where('statut', 'disponible')->find($partIdForcee);
            if (! $part) {
                throw new RuntimeException("Ce membre n'a pas de part disponible pour ce tirage (déjà gagnée ou introuvable).");
            }
            $this->attribuerPart($cycle, $part);

            return $part;
        }

        return match ($tontine->mode_attribution) {
            'rotation' => $this->designerParRotation($cycle, $tontine),
            'tirage_sort' => $this->designerParTirage($cycle, $tontine),
            'enchere' => $this->designerParEnchere($cycle, $tontine),
            'calendrier' => $this->designerParCalendrier($cycle, $tontine),
            default => throw new RuntimeException('Mode d\'attribution inconnu.'),
        };
    }

    private function designerParRotation(CycleTontine $cycle, Tontine $tontine, ?string $partIdForcee = null): TontinePart
    {
        // Lorsqu'un ordre est planifié, la réunion applique strictement le tour
        // correspondant au numéro du cycle. Une part réservée reste donc éligible
        // uniquement pour son propre tour, jamais pour un autre.
        $tour = PlanningTour::where('tontine_id', $tontine->id)
            ->where('numero_tour', $cycle->numero_cycle)
            ->where('statut', 'planifie')
            ->first();
        if ($tour) {
            if ($partIdForcee && $partIdForcee !== $tour->tontine_part_id) {
                throw new RuntimeException('Le bénéficiaire sélectionné ne correspond pas à l’ordre de rotation planifié.');
            }
            $part = $tontine->parts()->whereKey($tour->tontine_part_id)->where('statut', 'reservee')->first();
        } elseif ($partIdForcee) {
            $part = $tontine->parts()->whereKey($partIdForcee)->where('statut', 'disponible')->first();
        } else {
            $part = $tontine->parts()->where('statut', 'disponible')->orderBy('ordre_rotation')->first();
        }
        if (! $part) {
            throw new RuntimeException('Aucune part disponible pour ce tour de rotation.');
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
    private function designerParEnchere(CycleTontine $cycle, Tontine $tontine, ?string $partIdForcee = null): TontinePart
    {
        // RG-TON-020 : en cas d'égalité entre plusieurs offres au montant maximal,
        // la première soumise (created_at le plus ancien) l'emporte.
        $offres = Encherite::where('cycle_id', $cycle->id);
        if ($partIdForcee) {
            $offres->where('tontine_part_id', $partIdForcee);
        }
        $meilleure = $offres
            ->orderByDesc('montant_offre')
            ->orderBy('created_at')
            ->first();
        if (! $meilleure) {
            throw new RuntimeException('Aucune enchère reçue pour ce cycle.');
        }
        if ($tontine->mise_min_enchere && (float) $meilleure->montant_offre < (float) $tontine->mise_min_enchere) {
            throw new RuntimeException('La meilleure enchère est sous la mise minimale.');
        }

        $pot = (float) ($cycle->montant_collecte_reel > 0
            ? $cycle->montant_collecte_reel
            : $cycle->montant_collecte_prevu);
        if ((float) $meilleure->montant_offre > $pot) {
            throw new RuntimeException("L'enchère gagnante dépasse le pot disponible ({$pot} FCFA).");
        }

        Encherite::where('cycle_id', $cycle->id)->update(['est_gagnante' => false]);
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
            'caisse_enchere_id' => $meilleure->caisse_id,
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

        // Le planning est une préparation. Il devient encaissé uniquement après
        // l'attribution réelle du cycle, avec son bulletin et ses cotisations.
        PlanningTour::where('tontine_id', $cycle->tontine_id)
            ->where('tontine_part_id', $cycle->gagnant_part_id)
            ->where('statut', 'planifie')
            ->update(['statut' => 'encaisse']);

        app(BulletinGainService::class)->genererDepuisCycle($cycle, $auteur);

        return $cycle;
    }

    /**
     * Retour contrôlé avant la clôture de séance. Un bulletin non payé ne porte
     * encore aucun décaissement : on peut donc défaire le bénéficiaire et les
     * cotisations du cycle sans altérer le livre de caisse.
     */
    public function annulerCycleAvantVersement(CycleTontine $cycle): void
    {
        $cycle->loadMissing('reunion', 'bulletin.retenues', 'gagnant');
        if (in_array($cycle->reunion->statut, ['cloturee', 'annulee'], true)) {
            throw new RuntimeException('Une réunion clôturée ou annulée ne peut plus être modifiée.');
        }
        if ($cycle->bulletin?->statut === 'paye') {
            throw new RuntimeException('Le gain a déjà été versé : enregistrez d’abord le retour des fonds avant d’annuler le cycle.');
        }

        DB::transaction(function () use ($cycle) {
            if ($cycle->gagnant) {
                $cycle->gagnant->update(['statut' => 'disponible', 'date_attribution' => null]);
            }
            if ($cycle->gagnant_part_id) {
                PlanningTour::where('tontine_id', $cycle->tontine_id)
                    ->where('tontine_part_id', $cycle->gagnant_part_id)
                    ->where('statut', 'encaisse')->update(['statut' => 'planifie']);
            }
            $cycle->bulletin?->retenues()->delete();
            $cycle->bulletin?->delete();
            $cycle->encherites()->delete();
            $cycle->cotisations()->delete();
            $cycle->delete();
        });
    }
}
