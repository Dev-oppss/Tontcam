<?php

namespace App\Services;

use App\Models\Notification;

class NotificationService
{
    public function journaliser(array $data): Notification
    {
        return Notification::create(array_merge([
            'statut' => 'en_attente',
            'programmee_a' => now(),
            'nb_tentatives' => 0,
        ], $data));
    }

    public function envoyer(Notification $notification): Notification
    {
        try {
            match ($notification->canal) {
                'sms' => $this->envoyerSms($notification),
                'email' => $this->envoyerEmail($notification),
                'push' => $this->envoyerPush($notification),
                default => throw new \RuntimeException("Canal inconnu : {$notification->canal}"),
            };

            $notification->forceFill([
                'statut' => 'envoyee',
                'envoyee_a' => now(),
                'nb_tentatives' => $notification->nb_tentatives + 1,
            ])->save();
        } catch (\Throwable $e) {
            $notification->forceFill([
                'statut' => 'echec',
                'erreur' => $e->getMessage(),
                'nb_tentatives' => $notification->nb_tentatives + 1,
            ])->save();

            if ($notification->canal === 'sms' && $notification->nb_tentatives < 3) {
                $this->planifierRetentative($notification);
            }
        }

        return $notification->refresh();
    }

    public function planifierRetentative(Notification $notification): void
    {
        $this->journaliser([
            'association_id' => $notification->association_id,
            'membre_id' => $notification->membre_id,
            'reunion_id' => $notification->reunion_id,
            'canal' => 'sms',
            'type_evenement' => $notification->type_evenement,
            'sujet' => $notification->sujet,
            'contenu' => $notification->contenu,
            'programmee_a' => now()->addMinutes(30),
            'nb_tentatives' => $notification->nb_tentatives,
        ]);
    }

    public function notifierReunion(string $associationId, string $membreId, array $reunionData, string $canal = 'sms'): Notification
    {
        return $this->journaliser([
            'association_id' => $associationId,
            'membre_id' => $membreId,
            'reunion_id' => $reunionData['id'] ?? null,
            'canal' => $canal,
            'type_evenement' => 'rappel_reunion',
            'sujet' => 'Rappel de reunion',
            'contenu' => "Reunion {$reunionData['type']} le {$reunionData['date']} a {$reunionData['heure']} - {$reunionData['lieu']}.",
        ]);
    }

    public function notifierReunionReportee(string $associationId, string $membreId, array $reunionData, string $canal = 'sms'): Notification
    {
        return $this->journaliser([
            'association_id' => $associationId,
            'membre_id' => $membreId,
            'reunion_id' => $reunionData['id'] ?? null,
            'canal' => $canal,
            'type_evenement' => 'reunion_reportee',
            'sujet' => 'Réunion reportée',
            'contenu' => "Réunion {$reunionData['type']} reportée au {$reunionData['date']} à {$reunionData['heure']} - {$reunionData['lieu']}.",
        ]);
    }

    public function notifierEcheanceRetard(string $associationId, string $membreId, string $pretId, string $dateEcheance, float $montant): Notification
    {
        return $this->journaliser([
            'association_id' => $associationId,
            'membre_id' => $membreId,
            'canal' => 'sms',
            'type_evenement' => 'echeance_retard',
            'sujet' => 'Echeance pret en retard',
            'contenu' => "Votre echeance de pret du {$dateEcheance} ({$montant} FCFA) est en retard.",
        ]);
    }

    public function notifierDefautPret(string $associationId, string $membreId, string $pretId, ?string $presidentId = null): void
    {
        $this->journaliser([
            'association_id' => $associationId,
            'membre_id' => $membreId,
            'canal' => 'sms',
            'type_evenement' => 'pret_defaut',
            'sujet' => 'Pret en defaut',
            'contenu' => 'Votre pret est en situation de defaut.',
        ]);

        if ($presidentId) {
            $this->journaliser([
                'association_id' => $associationId,
                'membre_id' => $presidentId,
                'canal' => 'email',
                'type_evenement' => 'pret_defaut_president',
                'sujet' => 'Alerte pret en defaut',
                'contenu' => "ALERTE : un pret est en defaut (ref: {$pretId}).",
            ]);
        }
    }

    public function notifierSanction(string $associationId, string $membreId, string $typeSanction, float $montant, string $sanctionId): Notification
    {
        return $this->journaliser([
            'association_id' => $associationId,
            'membre_id' => $membreId,
            'canal' => 'sms',
            'type_evenement' => 'sanction_appliquee',
            'sujet' => 'Sanction appliquee',
            'contenu' => "Une sanction ({$typeSanction}) de {$montant} FCFA vous a ete appliquee.",
        ]);
    }

    public function notifierBulletinGain(string $associationId, string $membreId, float $montantNet, string $bulletinId): Notification
    {
        return $this->journaliser([
            'association_id' => $associationId,
            'membre_id' => $membreId,
            'canal' => 'sms',
            'type_evenement' => 'bulletin_gain',
            'sujet' => 'Bulletin de gain disponible',
            'contenu' => "Votre bulletin de gain est disponible. Montant net : {$montantNet} FCFA.",
        ]);
    }

    public function notifierPretApprouve(string $associationId, string $membreId, string $pretId, float $montant): Notification
    {
        return $this->journaliser([
            'association_id' => $associationId,
            'membre_id' => $membreId,
            'canal' => 'sms',
            'type_evenement' => 'pret_approuve',
            'sujet' => 'Pret approuve',
            'contenu' => "Votre demande de pret de {$montant} FCFA a ete approuvee.",
        ]);
    }

    public function notifierSignaturePv(string $associationId, string $membreId, string $reunionId): Notification
    {
        return $this->journaliser([
            'association_id' => $associationId,
            'membre_id' => $membreId,
            'reunion_id' => $reunionId,
            'canal' => 'email',
            'type_evenement' => 'signature_pv_requise',
            'sujet' => 'Signature PV requise',
            'contenu' => 'Un proces-verbal est en attente de votre signature electronique.',
        ]);
    }

    public function notifierMotDePasseOublie(string $associationId, ?string $membreId, string $email): Notification
    {
        return $this->journaliser([
            'association_id' => $associationId,
            'membre_id' => $membreId,
            'canal' => 'email',
            'type_evenement' => 'reset_password',
            'sujet' => 'Réinitialisation du mot de passe',
            'contenu' => "Une demande de réinitialisation a été générée pour {$email}.",
        ]);
    }

    private function envoyerSms(Notification $notification): void {}
    private function envoyerEmail(Notification $notification): void {}
    private function envoyerPush(Notification $notification): void {}
}
