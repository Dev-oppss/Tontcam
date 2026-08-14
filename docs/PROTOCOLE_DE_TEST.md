# Protocole de test — Résumé et cas

## TC-24 — Notification dédiée à l'hôte de réunion

But
- Vérifier que l'hôte d'une réunion reçoive une notification dédiée lors de la planification et lorsqu'il est désigné/modifié.
- Vérifier que le système applique la sanction automatique d'absence lors de la saisie des présences, et que cette sanction est immédiatement visible dans:
  - l'onglet "Sanction" de la fiche réunion
  - la page globale "Sanctions" (barre latérale)

Préconditions
- Une association contient au moins deux membres dont l'un peut être désigné hôte.
- Le type/paramétrage de sanctions contient un type avec `declencheur = 'absence_non_excusee'` et `est_automatique = true`.
- L'utilisateur test a les droits nécessaires (secrétaire/president/tresorier) pour saisir des présences.

Scénario A — Notification à la création de réunion
1. Connexion en tant qu'administrateur (ou rôle autorisé).
2. Créer une réunion pour une date future en désignant `Membre A` comme hôte (champ `hote_membre_id`).
3. Observer que le backend retourne la réunion créée.
4. Vérifier côté notification (logs / tableau de bord notifications) qu'une notification spécifique a été préparée et adressée à `Membre A` (contenu du message, lien vers réunion).

Résultat attendu A
- `Membre A` reçoit une notification dédiée indiquant qu'il est l'hôte, distincte des rappels de réunion généraux.

Scénario B — Notification lors du changement d'hôte (TC-24)
1. Ouvrir une réunion existante qui n'a pas encore eu lieu.
2. Modifier la réunion et changer `hote_membre_id` pour `Membre B`.
3. Vérifier que le backend appelle la routine de notification d'hôte (endpoint / logique attendue) et qu'une notification est envoyée à `Membre B`.

Résultat attendu B
- `Membre B` reçoit une notification dédiée l'informant qu'il a été désigné hôte.

Scénario C — Sanction automatique d'absence et visibilité
1. Ouvrir la réunion et saisir les présences en déclarant `Membre X` comme `absent` (statut `absent`).
   - API: POST `/reunions/{id}/presences` body `{ presences: [{ membre_id: ..., statut: 'absent' }] }`
2. Vérifier la réponse de l'API : elle doit contenir les présences enregistrées ET la liste des sanctions créées pour la réunion (champ `sanctions`).
3. Côté frontend : ouvrir la fiche réunion -> onglet `Sanctions` (ou le panneau rubrique Sanction) et vérifier la présence d'une ligne indiquant que la sanction a été appliquée automatiquement pour l'absence de `Membre X` avec le motif attendu et le montant configuré.
4. Ouvrir la page globale `Sanctions` et vérifier que la sanction apparaît dans la liste, marquée `Automatique` et rattachée à la réunion.

Résultat attendu C
- Une sanction de type `absence_non_excusee` est créée et liée à la réunion.
- L'API de présences retourne `{ presences: [...], sanctions: [...] }`.
- Le frontend affiche immédiatement la sanction dans l'onglet réunion et la page globale `Sanctions` sans nécessiter un rechargement complet.

Notes d'implémentation (pour QA/dev)
- Le backend a été adapté pour retourner les sanctions liées à la réunion après la saisie groupée des présences.
- Le frontend met à jour son état global `sanctions` lorsqu'une réponse de présences contient des sanctions, afin d'afficher immédiatement les sanctions automatiques.

Critères de réussite
- Les trois scénarios A, B et C passent en environnement de test.
- Aucun doublon de sanction pour une même réunion et même membre n'est créé (contrainte déjà gérée côté backend).

---
Fichier généré automatiquement — TC-24 ajouté selon la demande utilisateur.
