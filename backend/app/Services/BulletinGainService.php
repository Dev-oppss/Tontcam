<?php

namespace App\Services;

use App\Models\BulletinGain;
use App\Models\Caisse;
use App\Models\CycleTontine;
use App\Models\Pret;
use App\Models\RetenueBulletin;
use App\Models\SanctionMembre;
use App\Models\SeanceTransaction;
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
            // Une retenue ne peut jamais excéder le gain disponible. Le reliquat
            // d'une dette reste ouvert et sera repris lors d'un prochain gain.
            $disponible = $brut;
            foreach ($retenues as $retenue) {
                $montantRetenu = min((float) $retenue->montant, max(0, $disponible));
                if ($montantRetenu <= 0) {
                    $retenue->delete();
                    continue;
                }
                $retenue->update(['montant' => round($montantRetenu, 2)]);
                $disponible -= $montantRetenu;
            }
            $retenues = array_values(array_filter($retenues, fn ($retenue) => $retenue->exists));
            $totalRetenues = collect($retenues)->sum('montant');
            $net = $this->calculerNet($brut, $totalRetenues);

            $bulletin->update([
                'total_retenues' => $totalRetenues,
                'montant_net' => $net,
                'statut' => 'genere',
            ]);

            return $bulletin->fresh(['retenues', 'cycle']);
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
    public function ajouterRetenueManuelle(BulletinGain $bulletin, Caisse $caisse, string $libelle, float $montant, Utilisateur $auteur): BulletinGain
    {
        if ($montant <= 0) {
            throw new \RuntimeException('Le montant de la retenue doit être positif.');
        }
        if ($bulletin->signe_tresorier_at || $bulletin->signe_president_at || $bulletin->signe_beneficiaire_at) {
            throw new \RuntimeException('Impossible de modifier un bulletin déjà signé — au moins une signature existe.');
        }

        if ($caisse->association_id !== $bulletin->cycle->tontine->association_id || ! $caisse->actif) {
            throw new \RuntimeException('La caisse sélectionnée est invalide ou inactive pour cette association.');
        }

        return DB::transaction(function () use ($bulletin, $caisse, $libelle, $montant, $auteur) {
            $prochainePriorite = (int) $bulletin->retenues()->max('priorite') + 1;

            $retenue = RetenueBulletin::create([
                'bulletin_id' => $bulletin->id,
                'type_retenue' => 'autre',
                'libelle' => $libelle,
                'montant' => round($montant, 2),
                'priorite' => max($prochainePriorite, 5),
                'reference_id' => $auteur->id,
                'reference_type' => 'saisie_manuelle',
                'caisse_id' => $caisse->id,
            ]);

            $totalRetenues = (float) $bulletin->retenues()->sum('montant');
            if ($totalRetenues > (float) $bulletin->montant_brut) {
                $retenue->delete();
                throw new \RuntimeException('Le total des retenues ne peut pas dépasser le montant brut du gain.');
            }
            $net = $this->calculerNet((float) $bulletin->montant_brut, $totalRetenues);

            $bulletin->update([
                'total_retenues' => $totalRetenues,
                'montant_net' => $net,
            ]);

            return $bulletin->fresh('retenues.caisse');
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

    /** Décaisse le net et impute les retenues sans compter deux fois le pot. */
    public function verser(BulletinGain $bulletin, string $modePaiement, ?string $reference, Utilisateur $auteur): BulletinGain
    {
        $bulletin->loadMissing('cycle.tontine.caisse', 'retenues.caisse');
        if ($bulletin->statut === 'paye') throw new \RuntimeException('Ce bulletin est déjà versé.');
        if ((float) $bulletin->montant_net < 0) throw new \RuntimeException('Le bulletin contient un montant net invalide.');
        if ((float) $bulletin->montant_net === 0.0 && $bulletin->retenues->isEmpty()) throw new \RuntimeException('Aucun montant à verser ou à imputer.');
        $caisse = $bulletin->cycle->tontine->caisse;
        if (! $caisse || ! $caisse->actif) throw new \RuntimeException('La caisse de la tontine est absente ou inactive.');

        return DB::transaction(function () use ($bulletin, $caisse, $modePaiement, $reference, $auteur) {
            $caisseService = app(CaisseService::class);
            $transaction = (float) $bulletin->montant_net > 0
                ? $caisseService->sortie($caisse, (float) $bulletin->montant_net, "Versement gain — {$bulletin->numero_bulletin}", [
                    'reference_type' => 'bulletin_gain', 'reference_id' => $bulletin->id,
                    'mode_paiement' => $modePaiement, 'cheque_numero' => $reference,
                    'created_by' => $auteur->id, 'valide_par' => $auteur->id,
                ])
                : null;
            if ($transaction) {
                SeanceTransaction::create([
                    'reunion_id' => $bulletin->cycle->reunion_id, 'type' => 'attribution_tour',
                    'membre_id' => $bulletin->gagnant_membre_id, 'montant' => $bulletin->montant_net,
                    'libelle' => "Versement net du bulletin {$bulletin->numero_bulletin}",
                    'caisse_id' => $caisse->id, 'note' => 'Transaction '.$transaction->id, 'created_by' => $auteur->id,
                ]);
            }
            foreach ($bulletin->retenues as $retenue) {
                $destination = $retenue->caisse ?: $caisse;
                if ($retenue->type_retenue === 'pret' && $retenue->reference_id) {
                    $pret = Pret::with('caisse')->find($retenue->reference_id);
                    if ($pret?->caisse) {
                        $destination = $pret->caisse;
                        app(PretService::class)->rembourserLibre($pret, (float) $retenue->montant, $auteur, false);
                    }
                }
                if ($destination->id !== $caisse->id) {
                    $transfert = $caisseService->transfert($caisse, $destination, (float) $retenue->montant,
                        "Retenue bulletin {$bulletin->numero_bulletin} — {$retenue->libelle}", $auteur);
                    $retenue->update(['transaction_id' => $transfert['transaction_destination']->id]);
                }
                if ($retenue->type_retenue === 'sanction' && $retenue->reference_id) {
                    SanctionMembre::where('id', $retenue->reference_id)->update(['statut' => 'payee', 'payee_at' => now()]);
                }
                SeanceTransaction::create([
                    'reunion_id' => $bulletin->cycle->reunion_id,
                    'type' => match ($retenue->type_retenue) { 'pret' => 'remboursement_pret', 'sanction' => 'paiement_sanction', default => 'divers_entree' },
                    'membre_id' => $bulletin->gagnant_membre_id, 'montant' => $retenue->montant,
                    'libelle' => "Retenue bulletin {$bulletin->numero_bulletin} — {$retenue->libelle}",
                    'reference_pret_id' => $retenue->type_retenue === 'pret' ? $retenue->reference_id : null,
                    'reference_sanction_id' => $retenue->type_retenue === 'sanction' ? $retenue->reference_id : null,
                    'caisse_id' => $destination->id, 'note' => 'Imputation sur gain (sans nouvel encaissement)', 'created_by' => $auteur->id,
                ]);
            }
            $bulletin->update(['statut' => 'paye', 'mode_versement' => $modePaiement, 'reference_versement' => $reference ?: $transaction?->id, 'date_versement' => now()]);
            return $bulletin->fresh(['retenues', 'cycle']);
        });
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
