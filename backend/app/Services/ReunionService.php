<?php

namespace App\Services;

use App\Models\Presence;
use App\Models\Reunion;
use App\Models\ReunionSignataire;
use App\Services\DocumentSignatureService;
use App\Services\SimplePdfService;
use RuntimeException;

/**
 * Service de gestion des réunions.
 *
 * Règles couvertes :
 *   RG-REU-016  : Statuts de présence : present, absent_excuse, absent, en_retard.
 *   RG-REU-017  : Retard si arrivée > 15 min après l'heure officielle (configurable).
 *   RG-REU-018  : Absence excusée = motif saisi obligatoirement.
 *   RG-REU-019  : Absence non excusée → déclenchement automatique de sanction si configuré.
 *   RG-REU-020  : Quorum vérifié avant ouverture (nb_présents ≥ quorum).
 *   RG-REU-021  : Clôture PV = TOUS les rapports obligatoires saisis.
 *   RG-REU-022  : N signatures requises (paramètre association, défaut 3).
 *   RG-REU-023  : Chaque signataire est unique (pas de double signature).
 *   RG-REU-024  : Après N signatures → PV verrouillé définitivement.
 *   RG-REU-025  : PDF horodaté généré à la clôture.
 *   RG-REU-026  : Annulation autorisée uniquement si aucune transaction financière.
 */
class ReunionService
{
    public function __construct(
        private readonly NotificationService  $notificationService,
        private readonly SanctionService      $sanctionService,
        private readonly SimplePdfService     $pdfService,
        private readonly DocumentSignatureService $signatureService,
    ) {}

    // ─── Ouverture ────────────────────────────────────────────────────────────

    /**
     * RG-REU-020 : Vérification du quorum avant ouverture de la séance.
     */
    public function ouvrir(Reunion $reunion): Reunion
    {
        if ($reunion->statut === 'ouverte') {
            throw new RuntimeException('La réunion est déjà ouverte.');
        }

        // RG-REU-020 : quorum défini dans le règlement intérieur
        $quorum         = (int) ($reunion->quorum_requis ?? 0);
        $nbPresentsActuels = $reunion->presences()->where('statut', 'present')->count();

        if ($quorum > 0 && $nbPresentsActuels < $quorum) {
            throw new RuntimeException(
                "Quorum insuffisant ({$nbPresentsActuels} présent(s), {$quorum} requis)."
            );
        }

        $reunion->forceFill([
            'statut'         => 'ouverte',
            'quorum_atteint'  => $quorum === 0 ? null : ($nbPresentsActuels >= $quorum),
        ])->save();

        return $reunion->refresh();
    }

    // ─── Présences ────────────────────────────────────────────────────────────

    /**
     * RG-REU-016–019 : Enregistrement des présences avec statut valide,
     * détection retard (RG-REU-017), motif si excusé (RG-REU-018),
     * et déclenchement de sanction si absent non excusé (RG-REU-019).
     */
    public function enregistrerPresence(
        Reunion $reunion,
        string  $membreId,
        string  $statut,
        array   $data = []
    ): Presence {
        // RG-REU-018 : motif obligatoire si ABSENT_EXCUSE
        if ($statut === 'absent_excuse' && empty($data['motif_absence'])) {
            throw new RuntimeException('Un motif est obligatoire pour une absence excusée.');
        }

        // RG-REU-017 : détection du retard (> 15 min, configurable)
        $enRetard    = false;
        $heureArrivee = $data['heure_arrivee'] ?? null;
        if (in_array($statut, ['present', 'en_retard'], true) && $heureArrivee && $reunion->heure_debut) {
            $seuilRetardMin = $reunion->association->config['seuil_retard_minutes'] ?? 15;
            $debut          = \Carbon\Carbon::parse($reunion->date_reunion->toDateString() . ' ' . $reunion->heure_debut);
            $arrivee        = \Carbon\Carbon::parse($reunion->date_reunion->toDateString() . ' ' . $heureArrivee);
            $enRetard       = $arrivee->diffInMinutes($debut) > $seuilRetardMin && $arrivee->gt($debut);
            if ($enRetard) {
                $statut = 'en_retard';
            }
        }

        $presence = Presence::updateOrCreate(
            ['reunion_id' => $reunion->id, 'membre_id' => $membreId],
            array_merge($data, [
                'statut'       => $statut,
                'motif_absence'=> $data['motif_absence'] ?? null,
                'heure_arrivee' => $heureArrivee,
                'saisie_par'    => $data['saisie_par'] ?? null,
            ])
        );

        // RG-REU-019 : sanction automatique si ABSENT (non excusé)
        if ($statut === 'absent') {
            $typeSanction = $reunion->association
                ->typesSanctions()
                ->where('declencheur', 'absence_non_excusee')
                ->where('actif', true)
                ->first();

            if ($typeSanction) {
                $this->sanctionService->appliquer(
                    $reunion->association_id,
                    $membreId,
                    $typeSanction,
                    "Absence non excusée — réunion du {$reunion->date_reunion->format('d/m/Y')}",
                    ['est_automatique' => true, 'reference_type' => Presence::class, 'reference_id' => $presence->id, 'reunion_id' => $reunion->id]
                );
            }
        }

        return $presence->refresh();
    }

    // ─── Signature PV ────────────────────────────────────────────────────────

    /**
     * RG-REU-022–024 : Signature électronique du PV.
     * Après N signatures → verrouillage automatique + génération PDF.
     */
    public function signerPv(Reunion $reunion, string $membreId, string $role): ReunionSignataire
    {
        // RG-REU-024 : PV déjà verrouillé → aucune modification possible
        if ($reunion->statut === 'cloturee') {
            throw new RuntimeException('Le PV est définitivement verrouillé. Aucune modification possible.');
        }

        // RG-REU-023 : un membre ne peut pas signer deux fois
        $dejaSigné = ReunionSignataire::where('reunion_id', $reunion->id)
            ->where('membre_id', $membreId)
            ->exists();

        if ($dejaSigné) {
            throw new RuntimeException('Ce membre a déjà signé ce PV.');
        }

        $signature = ReunionSignataire::create([
            'reunion_id'      => $reunion->id,
            'membre_id'       => $membreId,
            'ordre_signature' => (int) ReunionSignataire::where('reunion_id', $reunion->id)->max('ordre_signature') + 1,
            'role_signature'  => $role,
            'signed_at'       => now(),
        ]);

        // RG-REU-022 : vérifier si le nombre de signatures requis est atteint
        $nbSignatures = ReunionSignataire::where('reunion_id', $reunion->id)->count();
        $nbRequis     = $reunion->association->nb_signataires_pv ?? 3;

        if ($nbSignatures >= $nbRequis) {
            // RG-REU-024 : verrouillage définitif
            $this->verrouillerPv($reunion);
        }

        return $signature->refresh();
    }

    // ─── Clôture PV ──────────────────────────────────────────────────────────

    /**
     * RG-REU-021 : Tous les rapports obligatoires doivent être saisis avant soumission.
     */
    public function verifierRapportsObligatoires(Reunion $reunion): void
    {
        $rubriquesObligatoires = \App\Models\OrdreDuJourRubrique::where('association_id', $reunion->association_id)
            ->where('est_obligatoire', true)
            ->pluck('id');

        $rapportsManquants = $rubriquesObligatoires->filter(function ($rubriqueId) use ($reunion) {
            return ! \App\Models\OrdreDuJourItem::where('reunion_id', $reunion->id)
                ->where('rubrique_id', $rubriqueId)
                ->where(function ($q) {
                    $q->whereNotNull('contenu_rapport')->orWhereRaw("pieces_jointes <> '[]'::jsonb");
                })
                ->exists();
        });

        if ($rapportsManquants->isNotEmpty()) {
            throw new RuntimeException(
                'Impossible de soumettre le PV : ' . $rapportsManquants->count() .
                ' rapport(s) obligatoire(s) manquant(s).'
            );
        }
    }

    /**
     * RG-REU-024 : Verrouillage définitif après N signatures.
     * RG-REU-025 : Génère le PDF horodaté.
     */
    public function verrouillerPv(Reunion $reunion): Reunion
    {
        $reunion->forceFill([
            'statut'          => 'cloturee',
            'heure_fin_reelle' => now()->format('H:i:s'),
        ])->save();

        $this->genererPdf($reunion);

        // Notifier les signataires que le PV est archivé
        // (implémentation selon le canal configuré)

        return $reunion->refresh();
    }

    public function genererPdf(Reunion $reunion): string
    {
        $path = storage_path('app/public/pv/'.$reunion->id.'.pdf');
        if (! is_dir(dirname($path))) {
            mkdir(dirname($path), 0777, true);
        }
        $lines = [
            'Reunion: '.$reunion->numero,
            'Date: '.$reunion->date_reunion,
            'Lieu: '.$reunion->lieu,
            'Statut: '.$reunion->statut,
            'Genere: '.now()->toDateTimeString(),
        ];
        file_put_contents($path, $this->pdfService->render($lines, 'Proces-verbal'));
        $this->signatureService->sign($path, [
            'type' => 'pv_reunion',
            'reunion_id' => $reunion->id,
            'numero' => $reunion->numero,
        ]);
        return 'storage/pv/'.$reunion->id.'.pdf';
    }

    /**
     * RG-REU-026 : Annulation uniquement si aucune transaction financière liée.
     * L'annulation est tracée dans l'audit log.
     */
    public function annuler(Reunion $reunion, string $motif, ?string $userId = null): Reunion
    {
        // RG-REU-026 : vérifier qu'aucune transaction n'a été saisie dans cette réunion
        $aTransactions = \App\Models\Transaction::where('reference_type', Reunion::class)
                ->where('reference_id', $reunion->id)
                ->exists()
            || \App\Models\CycleTontine::where('reunion_id', $reunion->id)
                ->whereIn('statut', ['en_cours', 'clos'])
                ->exists();

        if ($aTransactions) {
            throw new RuntimeException(
                'Impossible d\'annuler cette réunion : des transactions financières ont déjà été saisies.'
            );
        }

        $reunion->forceFill([
            'statut'            => 'annulee',
            'notes'             => trim(($reunion->notes ? $reunion->notes."\n" : '')."Annulation: ".$motif),
        ])->save();

        // Audit log automatique via Observer Eloquent (ReunionObserver)
        return $reunion->refresh();
    }
}
