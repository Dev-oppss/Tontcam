<?php

namespace App\Services;

use App\Models\BulletinGain;
use App\Models\CycleTontine;
use App\Models\Pret;
use App\Models\RetenueBulletin;
use App\Models\SanctionMembre;
use App\Models\Utilisateur;
use Illuminate\Support\Facades\DB;

/**
 * Fonctionne comme un bulletin de salaire (cahier des charges 5.1) :
 * Montant_Brut = Σ(cotisations versées par toutes les parts actives du cycle)
 * Montant_Net  = Montant_Brut − Σ(retenues)
 * Retenues     = Prêt_dû + Sanctions_dues + Cotis_Mutuelle + Assurance + Autres
 */
class BulletinGainService
{
    public function genererDepuisCycle(CycleTontine $cycle, Utilisateur $auteur): BulletinGain
    {
        $part = $cycle->gagnant;
        $membre = $part->membre;

        return DB::transaction(function () use ($cycle, $part, $membre, $auteur) {
            $brut = $this->calculerBrut($cycle);

            $numero = 'BG-'.now()->format('Y').'-'.str_pad((string) (BulletinGain::whereYear('created_at', now()->year)->count() + 1), 3, '0', STR_PAD_LEFT);

            // NB : total_retenues=0 à ce stade, donc montant_net doit valoir $brut
            // (et non 0) pour respecter la contrainte CHECK montant_net = montant_brut - total_retenues
            // dès cet INSERT initial, avant le calcul détaillé des retenues.
            $bulletin = BulletinGain::create([
                'cycle_id' => $cycle->id,
                'gagnant_membre_id' => $membre->id,
                'gagnant_part_id' => $part->id,
                'numero_bulletin' => $numero,
                'montant_brut' => $brut,
                'total_retenues' => 0,
                'montant_net' => $brut,
                'statut' => 'brouillon',
                'genere_par' => $auteur->id,
            ]);

            $retenues = $this->calculerRetenues($membre, $bulletin);
            $totalRetenues = collect($retenues)->sum('montant');
            $net = $this->calculerNet($brut, $totalRetenues);

            // La contrainte CHECK bulletins_montant_net_ck impose montant_net = montant_brut - total_retenues
            // (égalité stricte) : on ne doit donc jamais "clamper" montant_net à 0 ici, sous peine
            // de violer la contrainte dès que les retenues dépassent le brut. Le cas négatif est
            // géré séparément ci-dessous (report de dette).
            $bulletin->update([
                'total_retenues' => $totalRetenues,
                'montant_net' => $net,
                'statut' => 'genere',
            ]);

            if ($net < 0) {
                // RG : versement suspendu, différence retenue sur le prochain gain du membre
                RetenueBulletin::create([
                    'bulletin_id' => $bulletin->id,
                    'type_retenue' => 'autre',
                    'libelle' => 'Report de dette sur prochain gain',
                    'montant' => abs($net),
                    'priorite' => 99,
                ]);
            }

            return $bulletin->fresh('retenues');
        });
    }

    /**
     * Priorité 5 du cahier des charges — « autres obligations » (frais d'organisation
     * de réunion, décision d'AG, etc.). Rien dans l'app ne génère ça automatiquement
     * (contrairement au prêt/sanction/mutuelle/assurance) : c'est au trésorier ou au
     * président de la saisir à la main avant signature, quand elle s'applique.
     * Interdit dès qu'une signature existe — modifier un bulletin déjà engagé
     * romprait la valeur probante du document (voir hash_integrite).
     */
    public function ajouterRetenueManuelle(BulletinGain $bulletin, string $libelle, float $montant, Utilisateur $auteur): BulletinGain
    {
        if ($montant <= 0) {
            throw new \RuntimeException('Le montant de la retenue doit être positif.');
        }
        if ($bulletin->signe_tresorier_at || $bulletin->signe_president_at || $bulletin->signe_beneficiaire_at) {
            throw new \RuntimeException('Impossible de modifier un bulletin déjà signé — au moins une signature existe.');
        }

        return DB::transaction(function () use ($bulletin, $libelle, $montant, $auteur) {
            $prochainePriorite = (int) $bulletin->retenues()->max('priorite') + 1;

            RetenueBulletin::create([
                'bulletin_id' => $bulletin->id,
                'type_retenue' => 'autre',
                'libelle' => $libelle,
                'montant' => round($montant, 2),
                'priorite' => max($prochainePriorite, 5),
                'reference_id' => $auteur->id,
                'reference_type' => 'saisie_manuelle',
            ]);

            $totalRetenues = (float) $bulletin->retenues()->sum('montant');
            $net = $this->calculerNet((float) $bulletin->montant_brut, $totalRetenues);

            $bulletin->update([
                'total_retenues' => $totalRetenues,
                'montant_net' => $net,
            ]);

            return $bulletin->fresh('retenues');
        });
    }

    public function calculerBrut(CycleTontine $cycle): float
    {
        // Cahier des charges — cas enchère : le gain brut n'est pas la somme des
        // cotisations standard, mais le montant de l'enchère gagnante.
        if ($cycle->tontine->mode_attribution === 'enchere' && $cycle->montant_enchere !== null) {
            return (float) $cycle->montant_enchere;
        }

        return (float) $cycle->cotisations()->sum('montant_verse');
    }

    /**
     * Ordre de priorité des retenues : prêt(1) > sanction(2) > cotisation_mutuelle(3) > assurance(4) > autre(5).
     */
    public function calculerRetenues(\App\Models\Membre $membre, BulletinGain $bulletin): array
    {
        $lignes = [];
        $priorite = 1;

        // 1. Prêts dus (échéances impayées/en retard de ce membre)
        $pretsEnCours = Pret::where('emprunteur_id', $membre->id)->whereIn('statut', ['en_cours', 'en_retard'])->get();
        foreach ($pretsEnCours as $pret) {
            $du = (float) $pret->echeances()->whereIn('statut', ['due', 'en_retard', 'partielle', 'penalisee'])->sum(DB::raw('montant_total - montant_verse'));
            if ($du > 0) {
                $lignes[] = RetenueBulletin::create([
                    'bulletin_id' => $bulletin->id,
                    'type_retenue' => 'pret',
                    'libelle' => "Remboursement prêt en cours",
                    'montant' => round($du, 2),
                    'priorite' => $priorite++,
                    'reference_id' => $pret->id,
                    'reference_type' => 'pret',
                ]);
            }
        }

        // 2. Sanctions dues
        $sanctionsDues = SanctionMembre::where('membre_id', $membre->id)->where('statut', 'due')->get();
        foreach ($sanctionsDues as $sanction) {
            $lignes[] = RetenueBulletin::create([
                'bulletin_id' => $bulletin->id,
                'type_retenue' => 'sanction',
                'libelle' => $sanction->motif,
                'montant' => (float) $sanction->montant,
                'priorite' => $priorite++,
                'reference_id' => $sanction->id,
                'reference_type' => 'sanction_membre',
            ]);
            $sanction->update(['statut' => 'retenue_sur_gain', 'bulletin_id' => $bulletin->id]);
        }

        // 3. Cotisation mutuelle (assurance sociale active)
        $assurance = $membre->assurances()->where('actif', true)->where('type_assurance', 'mutuelle')->first();
        if ($assurance && $assurance->prime_mensuelle) {
            $lignes[] = RetenueBulletin::create([
                'bulletin_id' => $bulletin->id,
                'type_retenue' => 'cotisation_mutuelle',
                'libelle' => 'Cotisation mutuelle mensuelle',
                'montant' => (float) $assurance->prime_mensuelle,
                'priorite' => $priorite++,
                'reference_id' => $assurance->id,
                'reference_type' => 'assurance_membre',
            ]);
        }

        // 4. Assurance individuelle
        $assurancesAutres = $membre->assurances()->where('actif', true)->where('type_assurance', '!=', 'mutuelle')->get();
        foreach ($assurancesAutres as $ass) {
            if ($ass->prime_mensuelle) {
                $lignes[] = RetenueBulletin::create([
                    'bulletin_id' => $bulletin->id,
                    'type_retenue' => 'assurance',
                    'libelle' => "Prime {$ass->type_assurance}",
                    'montant' => (float) $ass->prime_mensuelle,
                    'priorite' => $priorite++,
                    'reference_id' => $ass->id,
                    'reference_type' => 'assurance_membre',
                ]);
            }
        }

        return $lignes;
    }

    public function calculerNet(float $brut, float $totalRetenues): float
    {
        return round($brut - $totalRetenues, 2);
    }

    /**
     * Génération du PDF officiel (en-tête, retenues, signatures).
     * Nécessite : composer require barryvdh/laravel-dompdf
     */
    public function genererPdf(BulletinGain $bulletin): string
    {
        $bulletin->loadMissing('retenues', 'gagnant', 'part', 'cycle.tontine.association');

        $pdf = \Barryvdh\DomPDF\Facade\Pdf::loadView('pdf.bulletin-gain', ['bulletin' => $bulletin]);
        $chemin = "bulletins/{$bulletin->numero_bulletin}.pdf";
        \Illuminate\Support\Facades\Storage::disk('public')->put($chemin, $pdf->output());

        $bulletin->update(['pdf_url' => \Illuminate\Support\Facades\Storage::url($chemin)]);

        return $bulletin->pdf_url;
    }
}
