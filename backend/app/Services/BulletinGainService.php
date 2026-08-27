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
        // Idempotence : aucune contrainte UNIQUE en base sur bulletins_gain.cycle_id
        // (seul numero_bulletin l'est), donc un double-clic ou un retry sur la
        // clôture/désignation avant la protection anti-double-clic pouvait créer
        // DEUX bulletins pour le même cycle. Résultat concret : annuler le cycle
        // ensuite échouait en 422 (violation de clé étrangère bulletins_gain_cycle_id_fkey)
        // car seul le premier bulletin (relation hasOne) était supprimé, laissant le
        // second orphelin bloquer le DELETE sur cycles_tontine. On retourne donc le
        // bulletin déjà généré au lieu d'en recréer un second.
        $existant = BulletinGain::where('cycle_id', $cycle->id)->first();
        if ($existant) {
            return $existant->fresh(['retenues', 'cycle']);
        }

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

            $this->appliquerRetenues($bulletin, $membre, $brut);
            $bulletin->update(['statut' => 'genere']);

            return $bulletin->fresh(['retenues', 'cycle']);
        });
    }

    /**
     * Recalcule un bulletin non payé (RG-TON) après correction d'une ou plusieurs
     * cotisations d'un cycle déjà clos : le brut change, donc les retenues (qui
     * dépendent du brut disponible) doivent être régénérées à l'identique de
     * genererDepuisCycle(), sans changer le numéro de bulletin ni son historique
     * de dates. Interdit si le bulletin est payé ou déjà signé (voir
     * TontineCycleService::assertCotisationCorrigeable, qui filtre ces cas en amont).
     */
    public function recalculerDepuisCotisations(BulletinGain $bulletin, Utilisateur $auteur): BulletinGain
    {
        $bulletin->loadMissing('cycle', 'retenues');
        if ($bulletin->statut === 'paye') {
            throw new \RuntimeException('Ce bulletin est déjà versé, il ne peut plus être recalculé automatiquement.');
        }
        if ($bulletin->signe_tresorier_at || $bulletin->signe_president_at || $bulletin->signe_beneficiaire_at) {
            throw new \RuntimeException('Impossible de recalculer : le bulletin porte déjà au moins une signature.');
        }

        return DB::transaction(function () use ($bulletin, $auteur) {
            $membre = \App\Models\Membre::find($bulletin->gagnant_membre_id);
            $brut = $this->calculerBrut($bulletin->cycle);

            $bulletin->retenues()->delete();
            $bulletin->update(['montant_brut' => $brut, 'total_retenues' => 0, 'montant_net' => $brut]);

            $this->appliquerRetenues($bulletin, $membre, $brut);

            return $bulletin->fresh(['retenues', 'cycle']);
        });
    }

    /**
     * Calcule et enregistre les retenues d'un bulletin pour un brut donné (extrait
     * de genererDepuisCycle pour être réutilisé par recalculerDepuisCotisations).
     */
    private function appliquerRetenues(BulletinGain $bulletin, \App\Models\Membre $membre, float $brut): void
    {
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
        ]);
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
        return (float) $cycle->cotisations()->sum('montant_verse');
    }

    /**
     * Ordre de priorité des retenues : prêt(1) > sanction(2) > cotisation_mutuelle(3) > assurance(4) > autre(5).
     */
    public function calculerRetenues(\App\Models\Membre $membre, BulletinGain $bulletin): array
    {
        $lignes = [];
        $priorite = 1;

        // L'enchère gagnante est une retenue sur le pot, jamais le pot lui-même.
        // Elle est versée dans la caisse choisie lors de l'offre et apparaîtra au PV
        // au même titre que toute autre imputation lors du versement du bulletin.
        $cycle = $bulletin->cycle()->with('caisseEnchere')->first();
        if ($cycle?->montant_enchere > 0 && $cycle->caisse_enchere_id) {
            $lignes[] = RetenueBulletin::create([
                'bulletin_id' => $bulletin->id, 'type_retenue' => 'autre',
                'libelle' => 'Enchère gagnante — versement en caisse',
                'montant' => (float) $cycle->montant_enchere, 'priorite' => 0,
                'reference_id' => $cycle->id, 'reference_type' => 'enchere_gagnante',
                'caisse_id' => $cycle->caisse_enchere_id,
            ]);
        }

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
    public function verser(BulletinGain $bulletin, string $modePaiement, ?string $reference, Utilisateur $auteur, ?string $dateVersement = null): BulletinGain
    {
        $bulletin->loadMissing('cycle.tontine.caisse', 'retenues.caisse');
        if ($bulletin->statut === 'paye') throw new \RuntimeException('Ce bulletin est déjà versé.');
        if ((float) $bulletin->montant_net < 0) throw new \RuntimeException('Le bulletin contient un montant net invalide.');
        if ((float) $bulletin->montant_net === 0.0 && $bulletin->retenues->isEmpty()) throw new \RuntimeException('Aucun montant à verser ou à imputer.');
        $caisse = $bulletin->cycle->tontine->caisse;
        if (! $caisse || ! $caisse->actif) throw new \RuntimeException('La caisse de la tontine est absente ou inactive.');

        return DB::transaction(function () use ($bulletin, $caisse, $modePaiement, $reference, $auteur, $dateVersement) {
            $caisseService = app(CaisseService::class);
            $transaction = (float) $bulletin->montant_net > 0
                ? $caisseService->sortie($caisse, (float) $bulletin->montant_net, "Versement gain — {$bulletin->numero_bulletin}", [
                    'reference_type' => 'bulletin_gain', 'reference_id' => $bulletin->id,
                    'mode_paiement' => $modePaiement, 'cheque_numero' => $reference,
                    'created_by' => $auteur->id, 'valide_par' => $auteur->id, 'date' => $dateVersement ?? now(),
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
            $bulletin->update(['statut' => 'paye', 'mode_versement' => $modePaiement, 'reference_versement' => $reference ?: $transaction?->id, 'date_versement' => $dateVersement ?? now()]);
            return $bulletin->fresh(['retenues', 'cycle']);
        });
    }

    /**
     * Retour des fonds : contre-passation complète d'un bulletin déjà versé
     * (RG-TON — préalable obligatoire à TontineCycleService::annulerCycleAvantVersement
     * lorsque le bulletin du cycle est au statut « paye »). Défait, dans l'ordre inverse
     * de verser() : l'imputation des retenues (prêt, transferts inter-caisses, sanctions),
     * puis la sortie nette vers le bénéficiaire — en ne laissant aucune écriture de caisse
     * orpheline (toute contre-passation passe par CaisseService::annuler, qui journalise
     * une nouvelle transaction plutôt que d'altérer l'historique existant).
     */
    public function annulerVersement(BulletinGain $bulletin, Utilisateur $auteur, ?string $motif = null): BulletinGain
    {
        $bulletin->loadMissing('cycle.tontine.caisse', 'retenues.caisse');
        if ($bulletin->statut !== 'paye') {
            throw new \RuntimeException('Ce bulletin n’a pas encore été versé, rien à annuler.');
        }

        $caisse = $bulletin->cycle->tontine->caisse;
        $motif = $motif ?: "Retour des fonds — bulletin {$bulletin->numero_bulletin}";

        return DB::transaction(function () use ($bulletin, $caisse, $auteur, $motif) {
            $caisseService = app(CaisseService::class);
            $pretService = app(PretService::class);

            foreach ($bulletin->retenues as $retenue) {
                if ($retenue->type_retenue === 'pret' && $retenue->reference_id) {
                    $pret = Pret::find($retenue->reference_id);
                    if ($pret) {
                        $pretService->annulerImputationBulletin($pret, (float) $retenue->montant, $auteur);
                    }
                }

                if ($retenue->transaction_id) {
                    $transfert = \App\Models\TransfertCaisse::where('transaction_dest_id', $retenue->transaction_id)->first();
                    if ($transfert) {
                        if ($transfert->transaction_dest_id) {
                            $txDest = \App\Models\Transaction::find($transfert->transaction_dest_id);
                            if ($txDest && ! $txDest->annulee) {
                                $caisseService->annuler($txDest, $auteur, $motif);
                            }
                        }
                        if ($transfert->transaction_source_id) {
                            $txSource = \App\Models\Transaction::find($transfert->transaction_source_id);
                            if ($txSource && ! $txSource->annulee) {
                                $caisseService->annuler($txSource, $auteur, $motif);
                            }
                        }
                    }
                }

                if ($retenue->type_retenue === 'sanction' && $retenue->reference_id) {
                    SanctionMembre::where('id', $retenue->reference_id)->update(['statut' => 'due', 'payee_at' => null]);
                }
            }

            if ((float) $bulletin->montant_net > 0) {
                $sortie = \App\Models\Transaction::where('reference_type', 'bulletin_gain')
                    ->where('reference_id', $bulletin->id)
                    ->where('caisse_id', $caisse->id)
                    ->where('annulee', false)
                    ->latest('created_at')
                    ->first();
                if ($sortie) {
                    $caisseService->annuler($sortie, $auteur, $motif);
                }
            }

            SeanceTransaction::where('reunion_id', $bulletin->cycle->reunion_id)
                ->where('libelle', 'like', "%{$bulletin->numero_bulletin}%")
                ->delete();

            $bulletin->update([
                'statut' => 'genere',
                'mode_versement' => null,
                'reference_versement' => null,
                'date_versement' => null,
            ]);

            return $bulletin->fresh(['retenues', 'cycle']);
        });
    }

    /**
     * Annulation d'un bulletin non encore versé (statut brouillon/genere), tant que
     * le bénéficiaire n'a pas signé. Le paiement déjà effectué doit d'abord être
     * retourné via annulerVersement() (statut 'paye' non accepté ici).
     */
    public function annulerBulletin(BulletinGain $bulletin, Utilisateur $auteur, ?string $motif = null): BulletinGain
    {
        if ($bulletin->statut === 'paye') {
            throw new \RuntimeException('Ce bulletin est déjà versé : utilisez d’abord le retour des fonds.');
        }
        if ($bulletin->statut === 'annule') {
            throw new \RuntimeException('Ce bulletin est déjà annulé.');
        }
        if ($bulletin->signe_beneficiaire_at) {
            throw new \RuntimeException('Ce bulletin a déjà été signé par le bénéficiaire, annulation impossible.');
        }

        $bulletin->update([
            'statut' => 'annule',
            'annule_par' => $auteur->id,
            'annule_at' => now(),
            'motif_annulation' => $motif ?: "Annulation bulletin {$bulletin->numero_bulletin}",
        ]);

        return $bulletin->fresh();
    }

    /**
     * Génération du PDF officiel (en-tête, retenues, signatures).
     * Nécessite : composer require barryvdh/laravel-dompdf
     */
    public function genererPdf(BulletinGain $bulletin): string
    {
        $bulletin->loadMissing('retenues', 'gagnant', 'part', 'cycle.tontine.association');

        $chemin = "bulletins/{$bulletin->numero_bulletin}.pdf";
        $disk = \Illuminate\Support\Facades\Storage::disk('public');

        // Le PDF (DomPDF) est coûteux à générer (plusieurs secondes) et cette
        // méthode était appelée à CHAQUE clic sur « Bulletin », même quand rien
        // n'avait changé depuis le dernier rendu — d'où la lenteur perçue.
        // On ne régénère que si le bulletin a été modifié (retenue ajoutée,
        // signature, versement, annulation...) depuis le dernier rendu, ou si
        // le fichier n'existe plus sur le disque.
        $dejaGenere = $bulletin->pdf_genere_at
            && $bulletin->pdf_genere_at->gte($bulletin->updated_at)
            && $disk->exists($chemin);

        if ($dejaGenere) {
            return $bulletin->pdf_url;
        }

        $pdf = \Barryvdh\DomPDF\Facade\Pdf::loadView('pdf.bulletin-gain', ['bulletin' => $bulletin]);
        $disk->put($chemin, $pdf->output());

        $bulletin->update(['pdf_url' => \Illuminate\Support\Facades\Storage::url($chemin), 'pdf_genere_at' => now()]);

        return $bulletin->pdf_url;
    }
}
