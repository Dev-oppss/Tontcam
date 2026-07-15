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
    public function planifier(array $data, Utilisateur $createur): Reunion
    {
        return DB::transaction(function () use ($data, $createur) {
            $dernierNumero = Reunion::where('association_id', $data['association_id'])->max('numero') ?? 0;

            $reunion = Reunion::create([
                ...$data,
                'numero' => $dernierNumero + 1,
                'statut' => 'planifiee',
                'created_by' => $createur->id,
            ]);

            // Ordre du jour : rubriques système + rubriques par défaut de l'association
            $rubriques = \App\Models\OrdreDuJourRubrique::where('association_id', $reunion->association_id)
                ->where('actif', true)
                ->orderBy('ordre_defaut')
                ->get();

            foreach ($rubriques as $rubrique) {
                OrdreDuJourItem::create([
                    'reunion_id' => $reunion->id,
                    'rubrique_id' => $rubrique->id,
                    'ordre' => $rubrique->ordre_defaut,
                ]);
            }

            app(NotificationService::class)->preparerEnvoi($reunion);

            return $reunion;
        });
    }

    public function enregistrerPresence(Reunion $reunion, Membre $membre, string $statut, ?string $heureArrivee = null, ?string $motifAbsence = null, ?Utilisateur $saisiPar = null): Presence
    {
        if ($reunion->statut === 'cloturee') {
            throw new RuntimeException('Réunion clôturée : présences non modifiables.');
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
