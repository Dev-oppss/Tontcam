<?php

namespace App\Services;

use App\Models\Membre;
use App\Models\Notification;
use App\Models\Reunion;

/**
 * Envoi de rappels SMS/email/WhatsApp/push (RG-REU-007).
 * L'envoi réel est délégué à des Jobs en queue ; ce service se limite
 * à préparer et journaliser les notifications.
 */
class NotificationService
{
    public function journaliser(
        string $associationId,
        ?Membre $membre,
        string $canal,
        string $typeEvenement,
        string $contenu,
        \DateTimeInterface $programmeeA,
        ?string $sujet = null,
        ?Reunion $reunion = null
    ): Notification {
        return Notification::create([
            'association_id' => $associationId,
            'reunion_id' => $reunion?->id,
            'membre_id' => $membre?->id,
            'canal' => $canal,
            'type_evenement' => $typeEvenement,
            'sujet' => $sujet,
            'contenu' => $contenu,
            'statut' => 'en_attente',
            'programmee_a' => $programmeeA,
        ]);
    }

    /**
     * Prépare les rappels J-7/J-3/J-1 pour une réunion selon les paramètres
     * activés au niveau de l'association (delai_rappel_j7/j3/j1).
     */
    public function preparerEnvoi(Reunion $reunion): array
    {
        $association = $reunion->association;
        $membres = Membre::where('association_id', $association->id)->where('statut', 'actif')->get();

        $paliers = [
            'j7' => ['jours' => 7, 'actif' => $association->delai_rappel_j7],
            'j3' => ['jours' => 3, 'actif' => $association->delai_rappel_j3],
            'j1' => ['jours' => 1, 'actif' => $association->delai_rappel_j1],
        ];

        $created = [];
        foreach ($paliers as $code => $palier) {
            if (! $palier['actif']) {
                continue;
            }
            $programmeeA = \Illuminate\Support\Carbon::parse($reunion->date_reunion)->subDays($palier['jours'])->setTimeFromTimeString('08:00');

            foreach ($membres as $membre) {
                $created[] = $this->journaliser(
                    $association->id,
                    $membre,
                    'sms',
                    "rappel_reunion_{$code}",
                    "Rappel : réunion du {$reunion->date_reunion->format('d/m/Y')} à {$reunion->heure_debut} — {$reunion->lieu}.",
                    $programmeeA,
                    'Rappel de réunion',
                    $reunion
                );
            }
        }

        return $created;
    }

    /**
     * Notification spéciale à l'hôte d'une réunion tenue à son domicile
     * (RG-REU-003 / TC-24). Distincte des rappels ordinaires J-7/J-3/J-1 :
     * programmée immédiatement, avec un contenu et un sujet dédiés.
     */
    public function notifierHote(Reunion $reunion): ?Notification
    {
        if (! $reunion->est_domicile_membre || ! $reunion->hote_membre_id) {
            return null;
        }

        $hote = $reunion->hote ?? Membre::find($reunion->hote_membre_id);
        if (! $hote) {
            return null;
        }

        return $this->journaliser(
            $reunion->association_id,
            $hote,
            'sms',
            'reunion_domicile_hote',
            "Vous accueillez la réunion n°{$reunion->numero} du {$reunion->date_reunion->format('d/m/Y')} à {$reunion->heure_debut} chez vous. Merci de préparer l'accueil des membres.",
            now(),
            'Réunion à votre domicile',
            $reunion
        );
    }

    /**
     * Marque une notification comme échouée et incrémente le compteur de tentatives.
     * Après 2 échecs, la notification n'est plus retentée (à orchestrer via un Job scheduler).
     */
    public function marquerEchec(Notification $notification, string $erreur): Notification
    {
        $notification->update([
            'statut' => $notification->nb_tentatives >= 1 ? 'echec' : 'en_attente',
            'nb_tentatives' => $notification->nb_tentatives + 1,
            'erreur' => $erreur,
        ]);

        return $notification;
    }

    public function marquerEnvoyee(Notification $notification): Notification
    {
        $notification->update(['statut' => 'envoyee', 'envoyee_a' => now()]);

        return $notification;
    }
}
