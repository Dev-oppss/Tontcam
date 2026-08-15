<?php

namespace App\Services;

use App\Models\Membre;
use App\Models\OrdreDuJourItem;
use App\Models\Presence;
use App\Models\Reunion;
use App\Models\ReunionSignataire;
use App\Models\Utilisateur;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class ReunionService
{
    public function planifier(array $data, Utilisateur $createur, string $statutInitial = 'planifiee'): Reunion
    {
        return DB::transaction(function () use ($data, $createur, $statutInitial) {
            $dernierNumero = Reunion::where('association_id', $data['association_id'])->max('numero') ?? 0;

            $reunion = Reunion::create([
                ...$data,
                'numero' => $dernierNumero + 1,
                'statut' => $statutInitial,
                'created_by' => $createur->id,
            ]);

            // Ordre du jour : rubriques système + rubriques par défaut de l'association
            $rubriques = \App\Models\OrdreDuJourRubrique::where('association_id', $reunion->association_id)
                ->where('actif', true)
                ->where('est_obligatoire', true)
                ->orderBy('ordre_defaut')
                ->get();

            foreach ($rubriques as $rubrique) {
                OrdreDuJourItem::create([
                    'reunion_id' => $reunion->id,
                    'rubrique_id' => $rubrique->id,
                    'ordre' => $rubrique->ordre_defaut,
                ]);
            }

            // Une réunion importée pour l'historique a déjà eu lieu : pas de notification
            // à envoyer aux membres, ils n'ont rien à préparer pour un événement passé.
            if ($statutInitial === 'planifiee') {
                app(NotificationService::class)->preparerEnvoi($reunion);
            }

            return $reunion;
        });
    }

    public function enregistrerPresence(Reunion $reunion, Membre $membre, string $statut, ?string $heureArrivee = null, ?string $motifAbsence = null, ?Utilisateur $saisiPar = null): Presence
    {
        if ($reunion->statut === 'cloturee') {
            throw new RuntimeException('Réunion clôturée : présences non modifiables.');
        }
        // RG-SEA-001 : comme pour les cotisations, un membre ne peut être marqué présent
        // ou absent que pendant que la séance est réellement ouverte — avant l'ouverture,
        // il n'y a rien à constater. Exception : import historique, qui démarre directement
        // en 'tenue' (réunion passée, jamais réellement "ouverte" dans l'app).
        if (! in_array($reunion->statut, ['ouverte', 'tenue'], true)) {
            throw new RuntimeException("La présence ne peut être enregistrée que pendant une séance ouverte (réunion actuellement : {$reunion->statut}).");
        }

        // RG-REU-017 : "en retard" n'est jamais pris tel quel du client — recalculé serveur
        // à partir de l'heure d'arrivée réelle comparée à l'heure d'OUVERTURE RÉELLE de la
        // séance (+ 15 minutes), pas l'heure planifiée. Un président peut ouvrir bien après
        // l'heure prévue (quorum, retard du président…) ; comparer à l'heure planifiée
        // marquerait à tort "en retard" des membres arrivés avant même que la séance ouvre.
        if ($statut === 'present' || $statut === 'en_retard') {
            if ($heureArrivee) {
                // Import historique : jamais passé par ouvrir(), pas de vraie heure
                // d'ouverture — on retombe sur l'heure planifiée dans ce seul cas.
                $reference = $reunion->heure_ouverture_reelle ?? $reunion->heure_debut;
                $date = $reunion->date_reunion->format('Y-m-d');
                $refCourte = substr((string) $reference, 0, 5);
                $arriveeSaisie = substr($heureArrivee, 0, 5);
                $limite = \Carbon\Carbon::createFromFormat('Y-m-d H:i', "{$date} {$refCourte}")->addMinutes(15);
                $arrivee = \Carbon\Carbon::createFromFormat('Y-m-d H:i', "{$date} {$arriveeSaisie}");
                $statut = $arrivee->gt($limite) ? 'en_retard' : 'present';
            } else {
                $statut = 'present';
            }
        }

        $presence = Presence::updateOrCreate(
            ['reunion_id' => $reunion->id, 'membre_id' => $membre->id],
            [
                'statut' => $statut,
                'heure_arrivee' => $heureArrivee,
                'motif_absence' => $motifAbsence,
                'saisie_par' => $saisiPar?->id,
            ]
        );

        // Sanction automatique pour absence non excusée (RG-SAN déclencheur)
        if ($statut === 'absent') {
            app(SanctionService::class)->absenceNonExcusee($membre, $reunion);
        }

        $this->recalculerQuorum($reunion);

        return $presence;
    }

    public function ajouterRapport(OrdreDuJourItem $item, string $contenu, array $piecesJointes = []): OrdreDuJourItem
    {
        $item->update([
            'contenu_rapport' => $contenu,
            'pieces_jointes' => $piecesJointes,
            'rapport_valide' => true,
        ]);

        return $item;
    }

    /**
     * Ajoute une signature électronique (RG-REU-021 à 025).
     * Verrouille automatiquement le PV dès que nb_signataires_pv est atteint.
     */
    public function signerPv(Reunion $reunion, Membre $membre, string $roleSignature): ReunionSignataire
    {
        $rapportsIncomplets = $reunion->ordreDuJour()
            ->whereHas('rubrique', fn ($q) => $q->where('est_obligatoire', true))
            ->where('rapport_valide', false)
            ->exists();

        if ($rapportsIncomplets) {
            throw new RuntimeException('Tous les rapports obligatoires doivent être saisis avant signature (RG-REU-021).');
        }

        $existe = ReunionSignataire::where('reunion_id', $reunion->id)->where('membre_id', $membre->id)->exists();
        if ($existe) {
            throw new RuntimeException('Ce membre a déjà signé ce PV.');
        }

        $ordre = ReunionSignataire::where('reunion_id', $reunion->id)->max('ordre_signature') + 1;

        $signature = ReunionSignataire::create([
            'reunion_id' => $reunion->id,
            'membre_id' => $membre->id,
            'ordre_signature' => $ordre,
            'role_signature' => $roleSignature,
            'signed_at' => now(),
        ]);

        $requis = $reunion->association->nb_signataires_pv ?? 3;
        if ($reunion->signataires()->whereNotNull('signed_at')->count() >= $requis) {
            $this->verrouillerPv($reunion);
        }

        return $signature;
    }

    public function verrouillerPv(Reunion $reunion): Reunion
    {
        $reunion->update(['statut' => 'cloturee', 'heure_fin_reelle' => $reunion->heure_fin_reelle ?? now()->format('H:i:s')]);

        return $reunion;
    }

    private function recalculerQuorum(Reunion $reunion): void
    {
        $presents = Presence::where('reunion_id', $reunion->id)->where('statut', 'present')->count();
        $reunion->update(['quorum_atteint' => $reunion->quorum_requis > 0 ? $presents >= $reunion->quorum_requis : null]);
    }
}
