<?php

namespace App\Services;

use App\Models\Caisse;
use App\Models\EcheancePret;
use App\Models\HistoriquePret;
use App\Models\Membre;
use App\Models\Pret;
use App\Models\Utilisateur;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class PretService
{
    /**
     * Dépôt d'une demande de prêt (RG-PRT-001 à 004).
     */
    public function demander(Caisse $caisse, Membre $emprunteur, float $montant, int $nbEcheances, array $options = []): Pret
    {
        if (! $caisse->pret_autorise) {
            throw new RuntimeException("La caisse « {$caisse->libelle} » n'autorise pas les prêts.");
        }
        if ($montant > (float) $caisse->solde_actuel) {
            throw new RuntimeException('Montant demandé supérieur au solde disponible de la caisse.');
        }
        $dureeMax = $caisse->duree_max_pret_mois ?? 12;
        if ($nbEcheances > $dureeMax) {
            throw new RuntimeException("Durée maximale autorisée : {$dureeMax} mois.");
        }

        $tauxInteret = $options['taux_interet_mensuel'] ?? $caisse->taux_interet_mensuel;
        $methode = $options['methode_amortissement'] ?? $caisse->methode_amortissement ?? 'lineaire';

        $calcul = $this->calculerAmortissementLineaire($montant, (float) $tauxInteret, $nbEcheances);

        return DB::transaction(function () use ($caisse, $emprunteur, $montant, $nbEcheances, $tauxInteret, $methode, $calcul, $options) {
            $pret = Pret::create([
                'caisse_id' => $caisse->id,
                'emprunteur_id' => $emprunteur->id,
                'montant_principal' => $montant,
                'taux_interet_mensuel' => $tauxInteret,
                'taux_penalite_mensuel' => $options['taux_penalite_mensuel'] ?? $caisse->taux_penalite_mensuel,
                'methode_amortissement' => $methode,
                'nb_echeances' => $nbEcheances,
                'montant_echeance' => $calcul['echeance_mensuelle'],
                'interet_total' => $calcul['interet_total'],
                'montant_total_du' => $montant + $calcul['interet_total'],
                'montant_rembourse' => 0,
                'capital_restant' => $montant,
                'statut' => 'demande',
                'avaliste_id' => $options['avaliste_id'] ?? null,
                'notes' => $options['notes'] ?? null,
                'created_by' => $options['created_by'] ?? null,
            ]);

            $this->genererAmortissement($pret);

            $this->loguerStatut($pret, null, 'demande', 'Demande initiale');

            return $pret;
        });
    }

    /**
     * Vérification Trésorier avant transmission au Président (RG-ORG-012).
     */
    public function valider(Pret $pret, Utilisateur $tresorier): Pret
    {
        if ($pret->statut !== 'demande') {
            throw new RuntimeException('Seule une demande peut être mise en validation.');
        }

        $pret->update(['statut' => 'en_attente_validation']);
        $this->loguerStatut($pret, 'demande', 'en_attente_validation', 'Revue Trésorier', $tresorier);

        return $pret;
    }

    /**
     * Approbation Président si montant > seuil_approbation_pret de l'association.
     */
    public function approuver(Pret $pret, Utilisateur $approbateur): Pret
    {
        if ($pret->statut !== 'en_attente_validation') {
            throw new RuntimeException('Ce prêt n\'est pas en attente de validation.');
        }

        $seuil = (float) ($pret->caisse->association->seuil_approbation_pret ?? PHP_INT_MAX);
        if ((float) $pret->montant_principal > $seuil && ! in_array($approbateur->role, ['president', 'super_admin'], true)) {
            throw new RuntimeException("Ce montant dépasse le seuil et requiert l'approbation du Président.");
        }

        $pret->update([
            'statut' => 'approuve',
            'date_approbation' => now()->toDateString(),
            'approuve_par' => $approbateur->id,
        ]);
        $this->loguerStatut($pret, 'en_attente_validation', 'approuve', 'Approuvé', $approbateur);

        return $pret;
    }

    public function refuser(Pret $pret, string $motif, Utilisateur $refuseur): Pret
    {
        $pret->update(['statut' => 'refuse', 'motif_refus' => $motif, 'refuse_par' => $refuseur->id]);
        $this->loguerStatut($pret, $pret->getOriginal('statut'), 'refuse', $motif, $refuseur);

        return $pret;
    }

    /**
     * Décaissement effectif : sortie de caisse + passage EN_COURS.
     */
    public function decaisser(Pret $pret, Utilisateur $tresorier): Pret
    {
        if ($pret->statut !== 'approuve') {
            throw new RuntimeException('Seul un prêt approuvé peut être décaissé.');
        }

        return DB::transaction(function () use ($pret, $tresorier) {
            $transaction = app(CaisseService::class)->sortie(
                $pret->caisse,
                (float) $pret->montant_principal,
                "Décaissement prêt — {$pret->emprunteur->nom} {$pret->emprunteur->prenom}",
                ['reference_type' => 'pret', 'reference_id' => $pret->id, 'created_by' => $tresorier->id, 'valide_par' => $tresorier->id]
            );

            $pret->update([
                'statut' => 'en_cours',
                'date_debut' => now()->toDateString(),
                'date_fin_prevue' => now()->addMonths($pret->nb_echeances)->toDateString(),
                'transaction_decaissement_id' => $transaction->id,
            ]);

            $this->loguerStatut($pret, 'approuve', 'en_cours', 'Décaissé', $tresorier);

            return $pret;
        });
    }

    /**
     * Remboursement (RG-PRT — recalcul après remboursement partiel).
     */
    public function rembourser(Pret $pret, EcheancePret $echeance, float $montantVerse, Utilisateur $tresorier, bool $encaisserEnCaisse = true): EcheancePret
    {
        return DB::transaction(function () use ($pret, $echeance, $montantVerse, $tresorier, $encaisserEnCaisse) {
            $transaction = $encaisserEnCaisse ? app(CaisseService::class)->entree(
                $pret->caisse,
                $montantVerse,
                "Remboursement prêt — échéance n°{$echeance->numero_echeance}",
                ['reference_type' => 'echeance_pret', 'reference_id' => $echeance->id, 'created_by' => $tresorier->id, 'valide_par' => $tresorier->id]
            ) : null;

            $totalVerseAvant = (float) $echeance->montant_verse;
            $nouveauVerse = $totalVerseAvant + $montantVerse;
            $deficit = (float) $echeance->montant_total - $nouveauVerse;

            $echeance->update([
                'montant_verse' => $nouveauVerse,
                'statut' => $deficit <= 0 ? 'payee' : 'partielle',
                'date_versement_reel' => now()->toDateString(),
                'transaction_id' => $transaction?->id,
            ]);

            $capitalRembourseReel = min($montantVerse, (float) $echeance->montant_capital);
            $pret->update([
                'montant_rembourse' => (float) $pret->montant_rembourse + $montantVerse,
                'capital_restant' => max(0, (float) $pret->capital_restant - $capitalRembourseReel),
            ]);

            // Si toutes les échéances sont soldées → prêt SOLDE
            $resteAPayer = $pret->echeances()->whereNotIn('statut', ['payee'])->count();
            if ($resteAPayer === 0) {
                $pret->update(['statut' => 'solde', 'date_solde' => now()->toDateString(), 'capital_restant' => 0]);
                $this->loguerStatut($pret, 'en_cours', 'solde', 'Prêt intégralement remboursé', $tresorier);
            }

            return $echeance;
        });
    }

    /**
     * Remboursement « libre » : le trésorier saisit un montant global (pas une échéance
     * précise) — typiquement depuis le journal de séance de réunion. On répartit ce
     * montant sur les échéances impayées dans l'ordre chronologique (la plus ancienne
     * d'abord), en réutilisant rembourser() échéance par échéance pour ne jamais
     * dupliquer la logique de mise à jour (montant_verse, capital_restant, clôture
     * automatique si le prêt est intégralement soldé). Si le montant excède le reste dû,
     * on refuse plutôt que de laisser un trop-perçu invisible.
     */
    public function rembourserLibre(Pret $pret, float $montant, Utilisateur $tresorier, bool $encaisserEnCaisse = true): array
    {
        if ($montant <= 0) {
            throw new RuntimeException('Le montant du remboursement doit être positif.');
        }

        return DB::transaction(function () use ($pret, $montant, $tresorier) {
            $restant = $montant;
            $echeancesTouchees = [];

            $echeances = $pret->echeances()
                ->whereIn('statut', ['a_venir', 'due', 'partielle', 'en_retard', 'penalisee'])
                ->orderBy('numero_echeance')
                ->get();

            foreach ($echeances as $echeance) {
                if ($restant <= 0) {
                    break;
                }
                $du = (float) $echeance->montant_total - (float) $echeance->montant_verse;
                if ($du <= 0) {
                    continue;
                }
                $aAppliquer = min($restant, $du);
                $echeancesTouchees[] = $this->rembourser($pret->fresh(), $echeance, $aAppliquer, $tresorier, $encaisserEnCaisse);
                $restant -= $aAppliquer;
            }

            if ($restant > 0.01) {
                throw new RuntimeException(
                    'Le montant saisi dépasse le reste à payer du prêt de ' . number_format($restant, 0, ',', ' ') . ' FCFA.'
                );
            }

            return $echeancesTouchees;
        });
    }

    /**
     * Tableau d'amortissement — méthode linéaire (RG-PRT / cahier des charges 5.3).
     */
    public function genererAmortissement(Pret $pret): array
    {
        $pret->echeances()->delete();

        $principal = (float) $pret->montant_principal;
        $taux = (float) $pret->taux_interet_mensuel;
        $n = (int) $pret->nb_echeances;
        $capitalParEcheance = round($principal / $n, 2);
        $capitalRestant = $principal;

        $echeances = [];
        for ($i = 1; $i <= $n; $i++) {
            $interet = round($capitalRestant * $taux, 2);
            $isLast = $i === $n;
            $capital = $isLast ? round($capitalRestant, 2) : $capitalParEcheance;
            $capitalRestant = max(0, round($capitalRestant - $capital, 2));

            $echeances[] = EcheancePret::create([
                'pret_id' => $pret->id,
                'numero_echeance' => $i,
                'date_echeance' => now()->addMonths($i)->toDateString(),
                'montant_capital' => $capital,
                'montant_interet' => $interet,
                'montant_total' => $capital + $interet,
                'montant_verse' => 0,
                'capital_restant_apres' => $capitalRestant,
                'statut' => 'a_venir',
            ]);
        }

        return $echeances;
    }

    private function calculerAmortissementLineaire(float $principal, float $tauxMensuel, int $nbMois): array
    {
        $interetTotal = round($principal * $tauxMensuel * $nbMois, 2);
        $echeanceMensuelle = round(($principal / $nbMois) + ($principal * $tauxMensuel), 2);

        return ['interet_total' => $interetTotal, 'echeance_mensuelle' => $echeanceMensuelle];
    }

    /**
     * Passage EN_RETARD → DEFAUT après 90 jours sans régularisation (à appeler via scheduler quotidien).
     */
    public function verifierDefauts(): int
    {
        $count = 0;
        Pret::where('statut', 'en_retard')->chunk(100, function ($prets) use (&$count) {
            foreach ($prets as $pret) {
                $plusAncienneEcheanceImpayee = $pret->echeances()->whereIn('statut', ['en_retard', 'penalisee'])->orderBy('date_echeance')->first();
                if ($plusAncienneEcheanceImpayee && now()->diffInDays($plusAncienneEcheanceImpayee->date_echeance) >= 90) {
                    $pret->update(['statut' => 'defaut']);
                    $this->loguerStatut($pret, 'en_retard', 'defaut', 'Non-paiement prolongé (90j+)');
                    $count++;
                }
            }
        });

        return $count;
    }

    /**
     * Import historique (super_admin uniquement) : crée un prêt directement dans son état
     * final connu (en_cours, solde, en_retard, defaut...), avec ses vraies dates passées,
     * sans repasser par le cycle demande→validation→approbation→décaissement en temps réel.
     * Rejoue aussi les mouvements de caisse réels (décaissement + remboursements déjà faits)
     * avec leur date historique, pour que le solde de caisse reflète la réalité.
     *
     * $data attend :
     *   caisse_id, emprunteur_id, montant_principal, taux_interet_mensuel, nb_echeances,
     *   statut (statut FINAL connu : en_cours|en_retard|defaut|solde),
     *   date_demande, date_approbation, date_debut, date_fin_prevue (nullable), date_solde (nullable),
     *   avaliste_id (nullable), notes (nullable),
     *   echeances: [{numero_echeance, date_echeance, montant_capital, montant_interet,
     *               statut (a_venir|payee|partielle|en_retard), montant_verse, date_versement_reel (nullable)}]
     */
    public function importerHistorique(array $data, Utilisateur $superAdmin): Pret
    {
        if ($superAdmin->role !== 'super_admin') {
            throw new RuntimeException("L'import historique de prêts est réservé au super_admin.");
        }

        $caisse = Caisse::findOrFail($data['caisse_id']);
        $echeancesData = array_map(fn ($e) => $e + ['montant_verse' => 0, 'date_versement_reel' => null], $data['echeances']);
        $montantTotalDu = (float) $data['montant_principal'] + array_sum(array_column($echeancesData, 'montant_interet'));
        $montantRembourse = array_sum(array_column($echeancesData, 'montant_verse'));

        return DB::transaction(function () use ($data, $caisse, $echeancesData, $montantTotalDu, $montantRembourse, $superAdmin) {
            $pret = Pret::create([
                'caisse_id' => $caisse->id,
                'emprunteur_id' => $data['emprunteur_id'],
                'montant_principal' => $data['montant_principal'],
                'taux_interet_mensuel' => $data['taux_interet_mensuel'],
                'taux_penalite_mensuel' => $data['taux_penalite_mensuel'] ?? $caisse->taux_penalite_mensuel,
                'methode_amortissement' => $data['methode_amortissement'] ?? 'lineaire',
                'nb_echeances' => count($echeancesData),
                'montant_echeance' => $echeancesData[0]['montant_capital'] + $echeancesData[0]['montant_interet'],
                'interet_total' => array_sum(array_column($echeancesData, 'montant_interet')),
                'montant_total_du' => $montantTotalDu,
                'montant_rembourse' => $montantRembourse,
                'capital_restant' => max(0, (float) $data['montant_principal'] - array_sum(array_map(
                    fn ($e) => min($e['montant_verse'] ?? 0, $e['montant_capital']), $echeancesData
                ))),
                'statut' => $data['statut'],
                'date_demande' => $data['date_demande'],
                'date_approbation' => $data['date_approbation'] ?? null,
                'date_debut' => $data['date_debut'] ?? null,
                'date_fin_prevue' => $data['date_fin_prevue'] ?? null,
                'date_solde' => $data['date_solde'] ?? null,
                'approuve_par' => $superAdmin->id,
                'avaliste_id' => $data['avaliste_id'] ?? null,
                'notes' => trim(($data['notes'] ?? '') . ' [Importé — historique pré-app]'),
                'created_by' => $superAdmin->id,
            ]);

            // Le trigger SQL trg_prets_amortissement génère automatiquement un échéancier
            // standard dès que le statut inséré est 'en_cours' (fn_generer_amortissement) —
            // il ne sait pas qu'il s'agit d'un import historique avec de vraies échéances déjà
            // connues. On supprime ce qu'il a généré avant d'insérer les vraies échéances,
            // sinon la contrainte d'unicité (pret_id, numero_echeance) entre en collision.
            EcheancePret::where('pret_id', $pret->id)->delete();

            // Rejoue le décaissement réel à sa date historique.
            if (! empty($data['date_debut'])) {
                $transactionDecaissement = app(CaisseService::class)->sortie(
                    $caisse,
                    (float) $data['montant_principal'],
                    "Décaissement prêt (import historique) — {$pret->emprunteur->nom} {$pret->emprunteur->prenom}",
                    ['reference_type' => 'pret', 'reference_id' => $pret->id, 'created_by' => $superAdmin->id, 'valide_par' => $superAdmin->id, 'date' => $data['date_debut']]
                );
                $pret->update(['transaction_decaissement_id' => $transactionDecaissement->id]);
            }

            // Le trigger DB trg_prets_amortissement génère automatiquement un échéancier
            // (calculé, pas historique) dès l'insertion du prêt en statut 'en_cours'.
            // On le purge avant d'insérer le véritable échéancier historique fourni.
            $pret->echeances()->delete();

            foreach ($echeancesData as $e) {
                $echeance = EcheancePret::create([
                    'pret_id' => $pret->id,
                    'numero_echeance' => $e['numero_echeance'],
                    'date_echeance' => $e['date_echeance'],
                    'montant_capital' => $e['montant_capital'],
                    'montant_interet' => $e['montant_interet'],
                    'montant_total' => $e['montant_capital'] + $e['montant_interet'],
                    'montant_verse' => $e['montant_verse'] ?? 0,
                    'capital_restant_apres' => $e['capital_restant_apres'] ?? 0,
                    'statut' => $e['statut'],
                    'date_versement_reel' => $e['date_versement_reel'] ?? null,
                ]);

                // Rejoue le remboursement réel à sa date historique.
                if (($e['montant_verse'] ?? 0) > 0 && ! empty($e['date_versement_reel'])) {
                    $transactionRemb = app(CaisseService::class)->entree(
                        $caisse,
                        (float) $e['montant_verse'],
                        "Remboursement prêt (import historique) — échéance n°{$e['numero_echeance']}",
                        ['reference_type' => 'echeance_pret', 'reference_id' => $echeance->id, 'created_by' => $superAdmin->id, 'valide_par' => $superAdmin->id, 'date' => $e['date_versement_reel']]
                    );
                    $echeance->update(['transaction_id' => $transactionRemb->id]);
                }
            }

            $this->loguerStatut($pret, null, $data['statut'], 'Importé — historique pré-app', $superAdmin);

            return $pret;
        });
    }

    private function loguerStatut(Pret $pret, ?string $avant, string $apres, ?string $commentaire = null, ?Utilisateur $auteur = null): void
    {
        HistoriquePret::create([
            'pret_id' => $pret->id,
            'statut_avant' => $avant,
            'statut_apres' => $apres,
            'commentaire' => $commentaire,
            'fait_par' => $auteur?->id,
        ]);
    }
}
