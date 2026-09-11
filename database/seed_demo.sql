-- ============================================================================
-- DONNÉES DE DÉMARRAGE (SEED) — "Tontine Excellence Bassa"
-- ============================================================================
-- Jeu de données complet pour tester TOUS les écrans et TOUS les états
-- métier de l'application manuellement, de A à Z, sans avoir à cliquer
-- pendant des heures pour amener les données dans un état intéressant.
--
-- Couverture volontaire de CHAQUE valeur d'ENUM au moins une fois :
-- membres (actif/suspendu/exclu/en_attente), réunions (les 5 statuts, les
-- 4 types), présences (les 4 statuts), tontines (rotation/enchère/
-- calendrier + mode cagnotte), cycles (ouvert/en_cours/clos), cotisations
-- (payée/partielle/impayée/due), prêts (demande → refusé/en_cours/
-- en_retard/défaut/soldé, les 4 types de garantie), sanctions (fixe/
-- pourcentage/journalier/paliers, tous déclencheurs auto + manuelles),
-- aides sociales (les 5 statuts), décisions AG, épargne, rapprochement
-- bancaire avec écart, transfert de caisse en attente d'approbation, etc.
--
-- Comptes de connexion (mot de passe identique pour tous : Demo@2026!) :
--   admin@tontix.cm        super_admin      (compte système, sans poste)
--   president@tontix.cm    president        (NGONO Paul)
--   vp@tontix.cm            vice_president   (EKANI Sylvie)
--   secretaire@tontix.cm    secretaire       (FOUDA Bernard)
--   tresorier@tontix.cm     tresorier        (MBALLA Odette)
--   controleur@tontix.cm    controleur       (TCHOUA Innocent)
--   membre@tontix.cm        membre           (DIALLO Aminata)
--
-- Points de test notables à essayer en priorité :
--   • Prêt "P5" (emprunteur DIALLO Aminata) a une échéance déjà en retard
--     mais PAS ENCORE traitée — lancez `php artisan prets:detecter-retards`
--     puis rafraîchissez la fiche prêt pour voir la pénalité et la
--     sanction automatique apparaître en direct.
--   • Réunion "R4" (2026-05-02) n'a que 2 signatures sur 3 requises — le
--     PV doit rester déverrouillable/modifiable (RG-ORG-013/RG-REU-022).
--   • Rapprochement bancaire du compte Afriland affiche un écart de
--     50 000 FCFA volontairement non justifié — teste l'alerte.
--   • Un transfert de caisse est en statut 'en_attente' — teste le
--     workflow d'approbation.
--   • Une transaction est encore 'valide = false' — teste la validation.
--   • Cycle 4 de la Tontine Mensuelle est encore 'en_cours' (réunion R5
--     'tenue' mais pas clôturée) — teste la clôture de cycle en direct.
--
-- ⚠️ Ce fichier n'a PAS pu être exécuté contre une base PostgreSQL réelle
-- (aucun serveur Postgres disponible dans l'environnement où il a été
-- généré) : testez-le d'abord sur une base de dev jetable, pas en prod.
-- Si une contrainte échoue, copiez-moi le message d'erreur et je corrige.
--
-- Usage : php artisan db:seed --class="Database\Seeders\DemoDataSeeder"
-- (refuse de tourner si APP_ENV=production — voir DemoDataSeeder.php)
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. ASSOCIATION
-- ============================================================================
INSERT INTO associations (
    id, nom, nom_abrege, siege_social, ville, pays, telephone, email,
    date_creation, devise, seuil_approbation_pret, seuil_approbation_caisse,
    nb_signataires_pv, delai_rappel_j7, delai_rappel_j3, delai_rappel_j1,
    profil_complete, actif
) VALUES (
    'a0000000-0000-0000-0000-000000000001',
    'Tontine Excellence Bassa', 'TEB', 'Carrefour Ndokoti, Akwa', 'Douala', 'Cameroun',
    '+237 691 000 000', 'contact@teb-tontine.cm',
    '2019-03-01', 'XAF', 200000, 500000,
    3, TRUE, TRUE, TRUE,
    TRUE, TRUE
);

-- ============================================================================
-- 2. POSTES (role_utilisateur aligné sur l'ENUM role_utilisateur pour que le
--    calcul automatique de rôle depuis le poste, s'il existe, fonctionne)
-- ============================================================================
INSERT INTO postes (id, association_id, libelle, code, role_utilisateur, niveau_hierarchie, est_bureau, est_obligatoire, pouvoirs) VALUES
('a1000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000001','Président','PRESIDENT','president',1,TRUE,TRUE,'Signature des PV, validation des prêts au-delà du seuil, représentation légale'),
('a1000000-0000-0000-0000-000000000002','a0000000-0000-0000-0000-000000000001','Vice-Président','VICE_PRESIDENT','vice_president',2,TRUE,FALSE,'Supplée le Président en son absence'),
('a1000000-0000-0000-0000-000000000003','a0000000-0000-0000-0000-000000000001','Secrétaire Général','SECRETAIRE_GENERAL','secretaire',3,TRUE,TRUE,'Rédaction et signature des PV, tenue du registre des membres'),
('a1000000-0000-0000-0000-000000000004','a0000000-0000-0000-0000-000000000001','Trésorier Général','TRESORIER_GENERAL','tresorier',3,TRUE,TRUE,'Tenue des caisses, décaissement des prêts, saisie des cotisations'),
('a1000000-0000-0000-0000-000000000005','a0000000-0000-0000-0000-000000000001','Contrôleur Financier','CONTROLEUR','controleur',4,FALSE,FALSE,'Contrôle des comptes et rapprochements bancaires'),
('a1000000-0000-0000-0000-000000000006','a0000000-0000-0000-0000-000000000001','Membre','MEMBRE',NULL,9,FALSE,FALSE,NULL);

-- ============================================================================
-- 3. MEMBRES (13 : 5 bureau + 4 membres actifs + 1 suspendu + 1 exclu +
--    1 en_attente + 1 compte "Administration" système sans poste)
-- ============================================================================
INSERT INTO membres (id, association_id, matricule, nom, prenom, date_naissance, sexe, telephone, email, ville, profession, date_adhesion, statut, motif_suspension, motif_exclusion, est_assure, date_debut_assurance) VALUES
('a2000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000001','TEB-001','NGONO','Paul','1975-04-12','M','+237 691 100 001','president@tontix.cm','Douala','Ingénieur retraité','2019-03-01','actif',NULL,NULL,TRUE,'2020-01-01'),
('a2000000-0000-0000-0000-000000000002','a0000000-0000-0000-0000-000000000001','TEB-002','EKANI','Sylvie','1980-09-23','F','+237 691 100 002','vp@tontix.cm','Douala','Commerçante','2019-03-01','actif',NULL,NULL,FALSE,NULL),
('a2000000-0000-0000-0000-000000000003','a0000000-0000-0000-0000-000000000001','TEB-003','FOUDA','Bernard','1985-01-30','M','+237 691 100 003','secretaire@tontix.cm','Douala','Enseignant','2019-03-01','actif',NULL,NULL,FALSE,NULL),
('a2000000-0000-0000-0000-000000000004','a0000000-0000-0000-0000-000000000001','TEB-004','MBALLA','Odette','1978-06-17','F','+237 691 100 004','tresorier@tontix.cm','Douala','Comptable','2019-03-01','actif',NULL,NULL,TRUE,'2020-01-01'),
('a2000000-0000-0000-0000-000000000005','a0000000-0000-0000-0000-000000000001','TEB-005','TCHOUA','Innocent','1982-11-05','M','+237 691 100 005','controleur@tontix.cm','Douala','Auditeur','2020-02-10','actif',NULL,NULL,FALSE,NULL),
('a2000000-0000-0000-0000-000000000006','a0000000-0000-0000-0000-000000000001','TEB-006','DIALLO','Aminata','1990-03-14','F','+237 677 100 006','membre@tontix.cm','Douala','Infirmière','2020-06-01','actif',NULL,NULL,TRUE,'2021-01-01'),
('a2000000-0000-0000-0000-000000000007','a0000000-0000-0000-0000-000000000001','TEB-007','KAMDEM','Martin','1988-07-21','M','+237 691 234 567','martin.k@teb-tontine.cm','Douala','Mécanicien','2021-03-10','actif',NULL,NULL,FALSE,NULL),
('a2000000-0000-0000-0000-000000000008','a0000000-0000-0000-0000-000000000001','TEB-008','NGO','Christelle','1993-12-02','F','+237 699 456 789','christelle.n@teb-tontine.cm','Douala','Coiffeuse','2023-04-05','actif',NULL,NULL,FALSE,NULL),
('a2000000-0000-0000-0000-000000000009','a0000000-0000-0000-0000-000000000001','TEB-009','MVONDO','Pierre','1979-05-19','M','+237 688 654 321','pierre.m@teb-tontine.cm','Douala','Chauffeur','2021-07-15','actif',NULL,NULL,FALSE,NULL),
('a2000000-0000-0000-0000-000000000010','a0000000-0000-0000-0000-000000000001','TEB-010','ESSAMA','Robert','1983-08-08','M','+237 655 321 456','robert.e@teb-tontine.cm','Douala','Électricien','2022-01-20','suspendu','3 cotisations impayées consécutives (RG-SAN-015)',NULL,FALSE,NULL),
('a2000000-0000-0000-0000-000000000011','a0000000-0000-0000-0000-000000000001','TEB-011','BALDE','Fatou','1986-02-27','F','+237 677 111 222','fatou.b@teb-tontine.cm','Douala','Couturière','2020-09-01','exclu',NULL,'Insultes répétées envers le bureau lors de l''AG du 04/04/2026',FALSE,NULL),
('a2000000-0000-0000-0000-000000000012','a0000000-0000-0000-0000-000000000001','TEB-012','NJOYA','Isabelle','1995-10-11','F','+237 699 888 777','isabelle.n@teb-tontine.cm','Douala','Étudiante','2026-08-20','en_attente',NULL,NULL,FALSE,NULL),
('a2000000-0000-0000-0000-000000000013','a0000000-0000-0000-0000-000000000001','TEB-ADMIN','Administration','Système',NULL,'A','+237 691 999 999','admin@tontix.cm','Douala',NULL,'2019-03-01','actif',NULL,NULL,FALSE,NULL);

-- ============================================================================
-- 4. UTILISATEURS (mot de passe identique : Demo@2026!)
-- ============================================================================
INSERT INTO utilisateurs (id, membre_id, email, password_hash, role, actif) VALUES
('a3000000-0000-0000-0000-000000000001','a2000000-0000-0000-0000-000000000013','admin@tontix.cm',      crypt('Demo@2026!',gen_salt('bf')),'super_admin',TRUE),
('a3000000-0000-0000-0000-000000000002','a2000000-0000-0000-0000-000000000001','president@tontix.cm',  crypt('Demo@2026!',gen_salt('bf')),'president',TRUE),
('a3000000-0000-0000-0000-000000000003','a2000000-0000-0000-0000-000000000002','vp@tontix.cm',          crypt('Demo@2026!',gen_salt('bf')),'vice_president',TRUE),
('a3000000-0000-0000-0000-000000000004','a2000000-0000-0000-0000-000000000004','tresorier@tontix.cm',   crypt('Demo@2026!',gen_salt('bf')),'tresorier',TRUE),
('a3000000-0000-0000-0000-000000000005','a2000000-0000-0000-0000-000000000003','secretaire@tontix.cm',  crypt('Demo@2026!',gen_salt('bf')),'secretaire',TRUE),
('a3000000-0000-0000-0000-000000000006','a2000000-0000-0000-0000-000000000005','controleur@tontix.cm',  crypt('Demo@2026!',gen_salt('bf')),'controleur',TRUE),
('a3000000-0000-0000-0000-000000000007','a2000000-0000-0000-0000-000000000006','membre@tontix.cm',      crypt('Demo@2026!',gen_salt('bf')),'membre',TRUE);

-- ============================================================================
-- 5. MANDATS (membre_postes) — 5 mandats en cours + 1 mandat historique clos
-- ============================================================================
INSERT INTO membre_postes (membre_id, poste_id, date_debut, date_fin, notes) VALUES
('a2000000-0000-0000-0000-000000000001','a1000000-0000-0000-0000-000000000001','2019-03-01',NULL,'Élu à la création de l''association'),
('a2000000-0000-0000-0000-000000000002','a1000000-0000-0000-0000-000000000002','2019-03-01',NULL,NULL),
('a2000000-0000-0000-0000-000000000003','a1000000-0000-0000-0000-000000000003','2024-04-06',NULL,'Réélu en AG du 06/04/2024'),
('a2000000-0000-0000-0000-000000000004','a1000000-0000-0000-0000-000000000004','2024-04-06',NULL,'Réélue en AG du 06/04/2024'),
('a2000000-0000-0000-0000-000000000005','a1000000-0000-0000-0000-000000000005','2020-02-10',NULL,NULL),
('a2000000-0000-0000-0000-000000000007','a1000000-0000-0000-0000-000000000003','2019-03-01','2024-04-05','Ancien Secrétaire Général, remplacé par FOUDA Bernard');

-- ============================================================================
-- 6. RÈGLEMENT INTÉRIEUR (2 versions : historique + active) & STATUTS
-- ============================================================================
INSERT INTO reglement_interieur (association_id, version, titre, contenu_html, date_adoption, est_actif, signataires) VALUES
('a0000000-0000-0000-0000-000000000001','1.0','Règlement intérieur — version initiale','<p>Version 1.0, remplacée par la version 2.0.</p>','2019-03-01',FALSE,'[]'),
('a0000000-0000-0000-0000-000000000001','2.0','Règlement intérieur — Tontine Excellence Bassa','<h2>Titre I — Objet</h2><p>Le présent règlement fixe les modalités de fonctionnement...</p>','2024-04-06',TRUE,'["NGONO Paul","FOUDA Bernard","MBALLA Odette"]');

INSERT INTO statuts_association (association_id, version, fichier_url, date_adoption, signataires, uploaded_by, est_actif) VALUES
('a0000000-0000-0000-0000-000000000001','1.0','https://example.com/statuts/teb-v1.pdf','2019-03-01','["NGONO Paul","EKANI Sylvie"]','a3000000-0000-0000-0000-000000000002',TRUE);

-- ============================================================================
-- 7. ORDRE DU JOUR — RUBRIQUES TYPES
-- ============================================================================
INSERT INTO ordre_du_jour_rubriques (association_id, libelle, ordre_defaut, est_obligatoire, est_systeme) VALUES
('a0000000-0000-0000-0000-000000000001','Prière d''ouverture',1,FALSE,FALSE),
('a0000000-0000-0000-0000-000000000001','Mot du Président',2,TRUE,FALSE),
('a0000000-0000-0000-0000-000000000001','Lecture PV dernière séance',3,TRUE,TRUE),
('a0000000-0000-0000-0000-000000000001','Rapport du Trésorier',4,TRUE,FALSE),
('a0000000-0000-0000-0000-000000000001','Cotisations et tontines',5,TRUE,TRUE),
('a0000000-0000-0000-0000-000000000001','Questions diverses',9,FALSE,FALSE);

-- ============================================================================
-- 8. RÉUNIONS — les 5 statuts, les 4 types
-- ============================================================================
INSERT INTO reunions (id, association_id, numero, type, date_reunion, heure_debut, heure_fin_prevue, heure_fin_reelle, lieu, statut, quorum_requis, quorum_atteint, heure_ouverture_reelle, president_seance, secretaire_seance, mot_ouverture) VALUES
('a8000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000001',1,'ordinaire','2026-02-07','15:00','17:00','16:50','Salle communautaire Akwa','cloturee',7,TRUE,'15:05','NGONO Paul','FOUDA Bernard','Ouverture de la première réunion ordinaire de l''année.'),
('a8000000-0000-0000-0000-000000000002','a0000000-0000-0000-0000-000000000001',2,'ordinaire','2026-03-07','15:00','17:00','16:45','Salle communautaire Akwa','cloturee',7,TRUE,'15:10','NGONO Paul','FOUDA Bernard',NULL),
('a8000000-0000-0000-0000-000000000003','a0000000-0000-0000-0000-000000000001',3,'ag','2026-04-04','10:00','13:00','12:40','Chapiteau Ndokoti','cloturee',9,TRUE,'10:15','NGONO Paul','FOUDA Bernard','Assemblée Générale annuelle — bilan, élections, adoption du règlement v2.'),
('a8000000-0000-0000-0000-000000000004','a0000000-0000-0000-0000-000000000001',4,'ordinaire','2026-05-02','15:00','17:00','16:55','Salle communautaire Akwa','cloturee',7,TRUE,'15:00','NGONO Paul','FOUDA Bernard',NULL),
('a8000000-0000-0000-0000-000000000005','a0000000-0000-0000-0000-000000000001',5,'conseil_bureau','2026-06-13','18:00','19:30',NULL,'Domicile du Président','tenue',5,TRUE,'18:05','NGONO Paul','FOUDA Bernard','Conseil de bureau — suivi des prêts en cours.'),
('a8000000-0000-0000-0000-000000000006','a0000000-0000-0000-0000-000000000001',6,'ordinaire','2026-08-01','15:00','17:00',NULL,'Salle communautaire Akwa','annulee',7,NULL,NULL,NULL,NULL,NULL),
('a8000000-0000-0000-0000-000000000007','a0000000-0000-0000-0000-000000000001',7,'ordinaire','2026-09-09','15:00','17:00',NULL,'Salle communautaire Akwa','ouverte',7,NULL,'15:05','NGONO Paul','FOUDA Bernard','Réunion en cours au moment de la démo.'),
('a8000000-0000-0000-0000-000000000008','a0000000-0000-0000-0000-000000000001',8,'extraordinaire','2026-09-26','16:00','18:00',NULL,'Salle communautaire Akwa','planifiee',7,NULL,NULL,NULL,NULL,NULL);

-- Réunion 1 : PV complet, 3/3 signatures (verrouillé)
INSERT INTO reunion_signataires (reunion_id, membre_id, ordre_signature, role_signature, signed_at) VALUES
('a8000000-0000-0000-0000-000000000001','a2000000-0000-0000-0000-000000000001',1,'president','2026-02-07 17:10:00+01'),
('a8000000-0000-0000-0000-000000000001','a2000000-0000-0000-0000-000000000003',2,'secretaire','2026-02-07 17:12:00+01'),
('a8000000-0000-0000-0000-000000000001','a2000000-0000-0000-0000-000000000004',3,'tresorier','2026-02-07 17:15:00+01');

-- Réunion 2 : PV complet, 3/3 signatures
INSERT INTO reunion_signataires (reunion_id, membre_id, ordre_signature, role_signature, signed_at) VALUES
('a8000000-0000-0000-0000-000000000002','a2000000-0000-0000-0000-000000000001',1,'president','2026-03-07 17:00:00+01'),
('a8000000-0000-0000-0000-000000000002','a2000000-0000-0000-0000-000000000003',2,'secretaire','2026-03-07 17:05:00+01'),
('a8000000-0000-0000-0000-000000000002','a2000000-0000-0000-0000-000000000004',3,'tresorier','2026-03-07 17:20:00+01');

-- Réunion 3 (AG) : 3/3 signatures
INSERT INTO reunion_signataires (reunion_id, membre_id, ordre_signature, role_signature, signed_at) VALUES
('a8000000-0000-0000-0000-000000000003','a2000000-0000-0000-0000-000000000001',1,'president','2026-04-04 12:50:00+01'),
('a8000000-0000-0000-0000-000000000003','a2000000-0000-0000-0000-000000000003',2,'secretaire','2026-04-04 12:52:00+01'),
('a8000000-0000-0000-0000-000000000003','a2000000-0000-0000-0000-000000000004',3,'tresorier','2026-04-04 12:58:00+01');

-- Réunion 4 : SEULEMENT 2/3 signatures — PV volontairement pas verrouillé (test RG-ORG-013/RG-REU-022)
INSERT INTO reunion_signataires (reunion_id, membre_id, ordre_signature, role_signature, signed_at) VALUES
('a8000000-0000-0000-0000-000000000004','a2000000-0000-0000-0000-000000000001',1,'president','2026-05-02 17:00:00+01'),
('a8000000-0000-0000-0000-000000000004','a2000000-0000-0000-0000-000000000003',2,'secretaire',NULL);

-- Ordre du jour (quelques items sur les réunions tenues/clôturées)
INSERT INTO ordre_du_jour_items (reunion_id, rubrique_id, libelle_libre, ordre, rapporteur_id, contenu_rapport, rapport_valide, type, acteur_role) VALUES
('a8000000-0000-0000-0000-000000000001',(SELECT id FROM ordre_du_jour_rubriques WHERE association_id='a0000000-0000-0000-0000-000000000001' AND libelle='Rapport du Trésorier'),NULL,4,'a2000000-0000-0000-0000-000000000004','Solde global des caisses au 07/02/2026 : 4 890 000 FCFA. Aucun incident.',TRUE,'financier','tresorier'),
('a8000000-0000-0000-0000-000000000001',(SELECT id FROM ordre_du_jour_rubriques WHERE association_id='a0000000-0000-0000-0000-000000000001' AND libelle='Cotisations et tontines'),NULL,5,'a2000000-0000-0000-0000-000000000004','Cycle 1 de la Tontine Mensuelle clôturé, gagnante DIALLO Aminata.',TRUE,'financier','tresorier'),
('a8000000-0000-0000-0000-000000000003',NULL,'Élection du nouveau bureau et adoption du règlement intérieur v2.0',6,'a2000000-0000-0000-0000-000000000003','Bureau reconduit à l''unanimité, règlement v2.0 adopté.',TRUE,'statutaire','secretaire'),
('a8000000-0000-0000-0000-000000000004',(SELECT id FROM ordre_du_jour_rubriques WHERE association_id='a0000000-0000-0000-0000-000000000001' AND libelle='Cotisations et tontines'),NULL,5,'a2000000-0000-0000-0000-000000000004','Cycle 3 : deux impayés constatés, sanctions automatiques appliquées.',TRUE,'financier','tresorier'),
('a8000000-0000-0000-0000-000000000005',NULL,'Point sur le prêt en retard de DIALLO Aminata',3,'a2000000-0000-0000-0000-000000000004',NULL,FALSE,'financier','tresorier');

-- ============================================================================
-- 9. PRÉSENCES — les 4 statuts, sur les 4 réunions tenues/clôturées
--    (statut='absent' déclenche AUTOMATIQUEMENT une sanction via le trigger
--    trg_presences_sanction — voir types_sanction plus bas, inséré AVANT)
-- ============================================================================
-- ============================================================================
-- 9bis. TYPES DE SANCTION — insérés ICI (avant présences/cotisations) car
--    les triggers automatiques (absence, retard cotisation) ont besoin
--    qu'un type_sanction actif existe déjà au moment de l'INSERT/UPDATE.
--    Couvre les 3 modes de calcul (fixe/pourcentage/journalier) + paliers.
-- ============================================================================
INSERT INTO types_sanction (id, association_id, libelle, mode_calcul, montant_fixe, montant_pct, montant_journalier, est_automatique, declencheur, actif, description, paliers_retard, paliers_absence) VALUES
('a9000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000001','Absence non excusée','fixe',5000,NULL,NULL,TRUE,'absence_non_excusee',TRUE,'Sanction automatique à chaque absence non justifiée en réunion.',NULL,'[]'),
('a9000000-0000-0000-0000-000000000002','a0000000-0000-0000-0000-000000000001','Retard de cotisation','fixe',2500,NULL,NULL,TRUE,'retard_cotisation',TRUE,'Sanction automatique quand une cotisation reste impayée en fin de cycle.',NULL,'[]'),
('a9000000-0000-0000-0000-000000000003','a0000000-0000-0000-0000-000000000001','Retard de remboursement de prêt','pourcentage',NULL,0.0200,NULL,TRUE,'retard_pret',TRUE,'2% du capital restant par échéance en retard (RG-PRT-020).',NULL,'[]'),
('a9000000-0000-0000-0000-000000000004','a0000000-0000-0000-0000-000000000001','Retard à l''arrivée en réunion','fixe',0,NULL,NULL,TRUE,'retard_presence',TRUE,'Montant déterminé par palier selon les minutes de retard.','[{"minutes": 15, "montant": 500}, {"minutes": 60, "montant": 1000}, {"minutes": 180, "montant": 2500}]','[]'),
('a9000000-0000-0000-0000-000000000005','a0000000-0000-0000-0000-000000000001','Absences cumulées','fixe',0,NULL,NULL,TRUE,'absences_cumulees',TRUE,'Sanction ponctuelle supplémentaire quand le total d''absences non excusées franchit un seuil.',NULL,'[{"nombre": 3, "montant": 3000}, {"nombre": 6, "montant": 6000}]'),
('a9000000-0000-0000-0000-000000000006','a0000000-0000-0000-0000-000000000001','Bavardage en réunion','fixe',500,NULL,NULL,FALSE,NULL,TRUE,'Sanction disciplinaire appliquée manuellement par le bureau.',NULL,'[]'),
('a9000000-0000-0000-0000-000000000007','a0000000-0000-0000-0000-000000000001','Insubordination','fixe',10000,NULL,NULL,FALSE,NULL,TRUE,'Sanction disciplinaire lourde, appliquée manuellement.',NULL,'[]');

-- ============================================================================
-- 9ter. PRÉSENCES (statut='absent' déclenche automatiquement une sanction)
-- ============================================================================
-- Réunion 1 (07/02) : tout le monde présent sauf ESSAMA (absent non excusé → sanction auto) et BALDE (excusée)
INSERT INTO presences (reunion_id, membre_id, statut, heure_arrivee, motif_absence, saisie_par) VALUES
('a8000000-0000-0000-0000-000000000001','a2000000-0000-0000-0000-000000000001','present','15:00',NULL,'a3000000-0000-0000-0000-000000000005'),
('a8000000-0000-0000-0000-000000000001','a2000000-0000-0000-0000-000000000002','present','15:02',NULL,'a3000000-0000-0000-0000-000000000005'),
('a8000000-0000-0000-0000-000000000001','a2000000-0000-0000-0000-000000000003','present','15:00',NULL,'a3000000-0000-0000-0000-000000000005'),
('a8000000-0000-0000-0000-000000000001','a2000000-0000-0000-0000-000000000004','present','15:01',NULL,'a3000000-0000-0000-0000-000000000005'),
('a8000000-0000-0000-0000-000000000001','a2000000-0000-0000-0000-000000000005','present','15:05',NULL,'a3000000-0000-0000-0000-000000000005'),
('a8000000-0000-0000-0000-000000000001','a2000000-0000-0000-0000-000000000006','present','15:00',NULL,'a3000000-0000-0000-0000-000000000005'),
('a8000000-0000-0000-0000-000000000001','a2000000-0000-0000-0000-000000000007','present','15:03',NULL,'a3000000-0000-0000-0000-000000000005'),
('a8000000-0000-0000-0000-000000000001','a2000000-0000-0000-0000-000000000008','present','15:00',NULL,'a3000000-0000-0000-0000-000000000005'),
('a8000000-0000-0000-0000-000000000001','a2000000-0000-0000-0000-000000000009','present','15:00',NULL,'a3000000-0000-0000-0000-000000000005'),
('a8000000-0000-0000-0000-000000000001','a2000000-0000-0000-0000-000000000010','absent',NULL,NULL,'a3000000-0000-0000-0000-000000000005'),
('a8000000-0000-0000-0000-000000000001','a2000000-0000-0000-0000-000000000011','absent_excuse',NULL,'Voyage familial signalé à l''avance','a3000000-0000-0000-0000-000000000005');

-- Réunion 2 (07/03) : KAMDEM en retard (paliers), MVONDO absent non excusé (2e sanction ESSAMA-like)
INSERT INTO presences (reunion_id, membre_id, statut, heure_arrivee, motif_absence, saisie_par) VALUES
('a8000000-0000-0000-0000-000000000002','a2000000-0000-0000-0000-000000000001','present','15:00',NULL,'a3000000-0000-0000-0000-000000000005'),
('a8000000-0000-0000-0000-000000000002','a2000000-0000-0000-0000-000000000002','present','15:00',NULL,'a3000000-0000-0000-0000-000000000005'),
('a8000000-0000-0000-0000-000000000002','a2000000-0000-0000-0000-000000000003','present','15:00',NULL,'a3000000-0000-0000-0000-000000000005'),
('a8000000-0000-0000-0000-000000000002','a2000000-0000-0000-0000-000000000004','present','15:00',NULL,'a3000000-0000-0000-0000-000000000005'),
('a8000000-0000-0000-0000-000000000002','a2000000-0000-0000-0000-000000000005','present','15:00',NULL,'a3000000-0000-0000-0000-000000000005'),
('a8000000-0000-0000-0000-000000000002','a2000000-0000-0000-0000-000000000006','present','15:00',NULL,'a3000000-0000-0000-0000-000000000005'),
('a8000000-0000-0000-0000-000000000002','a2000000-0000-0000-0000-000000000007','en_retard','16:05',NULL,'a3000000-0000-0000-0000-000000000005'),
('a8000000-0000-0000-0000-000000000002','a2000000-0000-0000-0000-000000000008','present','15:00',NULL,'a3000000-0000-0000-0000-000000000005'),
('a8000000-0000-0000-0000-000000000002','a2000000-0000-0000-0000-000000000009','absent',NULL,NULL,'a3000000-0000-0000-0000-000000000005');

-- Réunion 3 (AG 04/04) : tout le monde présent
INSERT INTO presences (reunion_id, membre_id, statut, heure_arrivee, saisie_par) VALUES
('a8000000-0000-0000-0000-000000000003','a2000000-0000-0000-0000-000000000001','present','10:00','a3000000-0000-0000-0000-000000000005'),
('a8000000-0000-0000-0000-000000000003','a2000000-0000-0000-0000-000000000002','present','10:00','a3000000-0000-0000-0000-000000000005'),
('a8000000-0000-0000-0000-000000000003','a2000000-0000-0000-0000-000000000003','present','10:00','a3000000-0000-0000-0000-000000000005'),
('a8000000-0000-0000-0000-000000000003','a2000000-0000-0000-0000-000000000004','present','10:00','a3000000-0000-0000-0000-000000000005'),
('a8000000-0000-0000-0000-000000000003','a2000000-0000-0000-0000-000000000005','present','10:05','a3000000-0000-0000-0000-000000000005'),
('a8000000-0000-0000-0000-000000000003','a2000000-0000-0000-0000-000000000006','present','10:00','a3000000-0000-0000-0000-000000000005'),
('a8000000-0000-0000-0000-000000000003','a2000000-0000-0000-0000-000000000007','present','10:00','a3000000-0000-0000-0000-000000000005'),
('a8000000-0000-0000-0000-000000000003','a2000000-0000-0000-0000-000000000008','present','10:10','a3000000-0000-0000-0000-000000000005'),
('a8000000-0000-0000-0000-000000000003','a2000000-0000-0000-0000-000000000009','present','10:00','a3000000-0000-0000-0000-000000000005');

-- Réunion 4 (02/05) : NGO absente non excusée (3e absence cumulée pour la démo)
INSERT INTO presences (reunion_id, membre_id, statut, heure_arrivee, saisie_par) VALUES
('a8000000-0000-0000-0000-000000000004','a2000000-0000-0000-0000-000000000001','present','15:00','a3000000-0000-0000-0000-000000000005'),
('a8000000-0000-0000-0000-000000000004','a2000000-0000-0000-0000-000000000002','present','15:00','a3000000-0000-0000-0000-000000000005'),
('a8000000-0000-0000-0000-000000000004','a2000000-0000-0000-0000-000000000003','present','15:00','a3000000-0000-0000-0000-000000000005'),
('a8000000-0000-0000-0000-000000000004','a2000000-0000-0000-0000-000000000004','present','15:00','a3000000-0000-0000-0000-000000000005'),
('a8000000-0000-0000-0000-000000000004','a2000000-0000-0000-0000-000000000006','present','15:00','a3000000-0000-0000-0000-000000000005'),
('a8000000-0000-0000-0000-000000000004','a2000000-0000-0000-0000-000000000007','present','15:00','a3000000-0000-0000-0000-000000000005'),
('a8000000-0000-0000-0000-000000000004','a2000000-0000-0000-0000-000000000008','absent',NULL,'a3000000-0000-0000-0000-000000000005'),
('a8000000-0000-0000-0000-000000000004','a2000000-0000-0000-0000-000000000009','present','15:00','a3000000-0000-0000-0000-000000000005');

-- ============================================================================
-- 10. COMPTES BANCAIRES
-- ============================================================================
INSERT INTO comptes_bancaires (id, association_id, banque, agence, numero_compte, iban, titulaire, solde_dernier_releve, date_dernier_releve, actif) VALUES
('a5000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000001','Afriland First Bank','Agence Akwa','01234567890123','CM21 0002 0100 0123 4567 8901 23','Tontine Excellence Bassa',1050000,'2026-08-31',TRUE),
('a5000000-0000-0000-0000-000000000002','a0000000-0000-0000-0000-000000000001','Ecobank Cameroun','Agence Bonanjo','09876543210987',NULL,'Tontine Excellence Bassa',400000,'2026-08-31',TRUE);

-- ============================================================================
-- 11. CAISSES (tontine_id renseigné après création des tontines, plus bas)
-- ============================================================================
INSERT INTO caisses (id, association_id, libelle, description, type, solde_initial, solde_actuel, compte_bancaire_id, pret_autorise, taux_interet_mensuel, taux_penalite_mensuel, duree_max_pret_mois, seuil_alerte_bas, suivi_epargne) VALUES
('a6000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000001','Caisse Tontine Mensuelle','Caisse dédiée à la Tontine Mensuelle Bassa','tontine',500000,2000000,NULL,TRUE,0.0300,0.0200,12,200000,FALSE),
('a6000000-0000-0000-0000-000000000002','a0000000-0000-0000-0000-000000000001','Caisse Enchère VIP','Caisse dédiée à la Tontine Enchère VIP','tontine',300000,800000,NULL,FALSE,0.0000,0.0200,12,150000,FALSE),
('a6000000-0000-0000-0000-000000000003','a0000000-0000-0000-0000-000000000001','Mutuelle Santé','Caisse de solidarité — aides sociales','mutuelle',500000,1200000,NULL,FALSE,0.0000,0.0200,12,500000,FALSE),
('a6000000-0000-0000-0000-000000000004','a0000000-0000-0000-0000-000000000001','Caisse Scolaire','Caisse dédiée aux aides de rentrée scolaire','scolaire',200000,400000,NULL,FALSE,0.0000,0.0200,12,100000,FALSE),
('a6000000-0000-0000-0000-000000000005','a0000000-0000-0000-0000-000000000001','Compte Banque Afriland','Reflet du compte bancaire Afriland First Bank','banque',1000000,1000000,'a5000000-0000-0000-0000-000000000001',FALSE,0.0000,0.0200,12,300000,FALSE),
('a6000000-0000-0000-0000-000000000006','a0000000-0000-0000-0000-000000000001','Épargne Membres','Tirelire commune — dépôts libres des membres','autre',0,260000,NULL,FALSE,0.0000,0.0200,12,NULL,TRUE),
('a6000000-0000-0000-0000-000000000007','a0000000-0000-0000-0000-000000000001','Caisse Cagnotte Solidarité','Caisse dédiée à la Cagnotte Solidarité (mode cagnotte)','tontine',100000,150000,NULL,FALSE,0.0000,0.0200,12,50000,FALSE);

-- ============================================================================
-- 12. TONTINES (rotation, enchère, calendrier-en_preparation, cagnotte)
-- ============================================================================
-- mise_min_enchere est inclus dès l'INSERT : la contrainte CHECK
-- tontines_enchere_mise_min_ck est évaluée immédiatement (les CHECK ne sont
-- jamais DEFERRABLE en PostgreSQL, contrairement aux FOREIGN KEY), donc la
-- renseigner après coup via un UPDATE séparé ferait échouer l'INSERT initial.
INSERT INTO tontines (id, association_id, libelle, description, montant_part, mode_attribution, nb_parts_total, nb_cycles_realises, exige_avaliste, pret_autorise, taux_interet_pret, duree_max_pret_mois, mode_cagnotte, mise_min_enchere, statut, date_debut, caisse_id, created_by) VALUES
('a7000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000001','Tontine Mensuelle Bassa','Tontine classique en rotation, cotisation mensuelle',25000,'rotation',6,3,FALSE,TRUE,0.0300,12,FALSE,NULL,'active','2026-02-01','a6000000-0000-0000-0000-000000000001','a3000000-0000-0000-0000-000000000004'),
('a7000000-0000-0000-0000-000000000002','a0000000-0000-0000-0000-000000000001','Tontine Enchère VIP','Tontine à attribution par enchère, mise minimale 5 000 FCFA',50000,'enchere',4,1,FALSE,FALSE,0.0000,12,FALSE,5000,'active','2026-03-01','a6000000-0000-0000-0000-000000000002','a3000000-0000-0000-0000-000000000004'),
('a7000000-0000-0000-0000-000000000003','a0000000-0000-0000-0000-000000000001','Tontine Scolaire','Tontine calendaire encore en préparation, pas encore démarrée',15000,'calendrier',10,0,FALSE,FALSE,0.0000,12,FALSE,NULL,'en_preparation',NULL,NULL,'a3000000-0000-0000-0000-000000000004'),
('a7000000-0000-0000-0000-000000000004','a0000000-0000-0000-0000-000000000001','Cagnotte Solidarité','Tontine en mode cagnotte — accumulation libre, remises de gains ponctuelles',10000,'rotation',3,1,FALSE,FALSE,0.0000,12,TRUE,NULL,'active','2026-04-01','a6000000-0000-0000-0000-000000000007','a3000000-0000-0000-0000-000000000004');

UPDATE caisses SET tontine_id = 'a7000000-0000-0000-0000-000000000001' WHERE id = 'a6000000-0000-0000-0000-000000000001';
UPDATE caisses SET tontine_id = 'a7000000-0000-0000-0000-000000000002' WHERE id = 'a6000000-0000-0000-0000-000000000002';
UPDATE caisses SET tontine_id = 'a7000000-0000-0000-0000-000000000004' WHERE id = 'a6000000-0000-0000-0000-000000000007';

-- ============================================================================
-- 13. TONTINE_PARTS
-- ============================================================================
-- Tontine Mensuelle Bassa (rotation, 6 parts) : 2 déjà gagnées (cycles clos), 4 disponibles
INSERT INTO tontine_parts (id, tontine_id, membre_id, numero_part, ordre_rotation, statut) VALUES
('a7100000-0000-0000-0000-000000000001','a7000000-0000-0000-0000-000000000001','a2000000-0000-0000-0000-000000000006',1,1,'gagnee'),
('a7100000-0000-0000-0000-000000000002','a7000000-0000-0000-0000-000000000001','a2000000-0000-0000-0000-000000000007',2,2,'gagnee'),
('a7100000-0000-0000-0000-000000000003','a7000000-0000-0000-0000-000000000001','a2000000-0000-0000-0000-000000000008',3,3,'disponible'),
('a7100000-0000-0000-0000-000000000004','a7000000-0000-0000-0000-000000000001','a2000000-0000-0000-0000-000000000009',4,4,'disponible'),
('a7100000-0000-0000-0000-000000000005','a7000000-0000-0000-0000-000000000001','a2000000-0000-0000-0000-000000000002',5,5,'disponible'),
('a7100000-0000-0000-0000-000000000006','a7000000-0000-0000-0000-000000000001','a2000000-0000-0000-0000-000000000003',6,6,'disponible');

-- Tontine Enchère VIP (mode enchère, pas d'ordre de rotation)
INSERT INTO tontine_parts (id, tontine_id, membre_id, numero_part, statut) VALUES
('a7100000-0000-0000-0000-000000000007','a7000000-0000-0000-0000-000000000002','a2000000-0000-0000-0000-000000000006',1,'gagnee'),
('a7100000-0000-0000-0000-000000000008','a7000000-0000-0000-0000-000000000002','a2000000-0000-0000-0000-000000000007',2,'disponible'),
('a7100000-0000-0000-0000-000000000009','a7000000-0000-0000-0000-000000000002','a2000000-0000-0000-0000-000000000008',3,'disponible'),
('a7100000-0000-0000-0000-000000000010','a7000000-0000-0000-0000-000000000002','a2000000-0000-0000-0000-000000000009',4,'disponible');

-- Cagnotte Solidarité (3 parts, pas de "gagnant" — accumulation)
INSERT INTO tontine_parts (id, tontine_id, membre_id, numero_part, montant_accumule_initial, statut) VALUES
('a7100000-0000-0000-0000-000000000011','a7000000-0000-0000-0000-000000000004','a2000000-0000-0000-0000-000000000006',1,5000,'disponible'),
('a7100000-0000-0000-0000-000000000012','a7000000-0000-0000-0000-000000000004','a2000000-0000-0000-0000-000000000007',2,0,'disponible'),
('a7100000-0000-0000-0000-000000000013','a7000000-0000-0000-0000-000000000004','a2000000-0000-0000-0000-000000000008',3,0,'disponible');

-- ============================================================================
-- 14. CYCLES DE TONTINE
-- ============================================================================
INSERT INTO cycles_tontine (id, tontine_id, reunion_id, numero_cycle, statut, montant_collecte_prevu, gagnant_part_id, date_ouverture, date_cloture) VALUES
('a8100000-0000-0000-0000-000000000001','a7000000-0000-0000-0000-000000000001','a8000000-0000-0000-0000-000000000001',1,'clos',150000,'a7100000-0000-0000-0000-000000000001','2026-02-07 15:00:00+01','2026-02-07 17:00:00+01'),
('a8100000-0000-0000-0000-000000000002','a7000000-0000-0000-0000-000000000001','a8000000-0000-0000-0000-000000000002',2,'clos',150000,'a7100000-0000-0000-0000-000000000002','2026-03-07 15:00:00+01','2026-03-07 17:00:00+01'),
('a8100000-0000-0000-0000-000000000003','a7000000-0000-0000-0000-000000000001','a8000000-0000-0000-0000-000000000004',3,'clos',150000,'a7100000-0000-0000-0000-000000000003','2026-05-02 15:00:00+01','2026-05-02 17:00:00+01'),
('a8100000-0000-0000-0000-000000000004','a7000000-0000-0000-0000-000000000001','a8000000-0000-0000-0000-000000000005',4,'en_cours',150000,NULL,'2026-06-13 18:00:00+01',NULL),
('a8100000-0000-0000-0000-000000000005','a7000000-0000-0000-0000-000000000002','a8000000-0000-0000-0000-000000000002',1,'clos',200000,'a7100000-0000-0000-0000-000000000007','2026-03-07 15:00:00+01','2026-03-07 17:00:00+01'),
('a8100000-0000-0000-0000-000000000006','a7000000-0000-0000-0000-000000000004','a8000000-0000-0000-0000-000000000001',1,'clos',30000,NULL,'2026-02-07 15:00:00+01','2026-02-07 17:00:00+01');

-- ============================================================================
-- 15. COTISATIONS DE TONTINE
--    (statut recalculé automatiquement par trigger depuis montant_verse ;
--    les lignes "impayée" marquées ★ utilisent la manœuvre INSERT payée
--    PUIS UPDATE à 0 pour déclencher réellement la sanction automatique
--    trg_cotisations_sanction, qui n'écoute que les UPDATE de statut)
-- ============================================================================
-- Cycle 1 (tout le monde paie)
INSERT INTO cotisations_tontine (cycle_id, tontine_part_id, membre_id, montant_du, montant_verse, mode_paiement, saisie_par) VALUES
('a8100000-0000-0000-0000-000000000001','a7100000-0000-0000-0000-000000000001','a2000000-0000-0000-0000-000000000006',25000,25000,'especes','a3000000-0000-0000-0000-000000000004'),
('a8100000-0000-0000-0000-000000000001','a7100000-0000-0000-0000-000000000002','a2000000-0000-0000-0000-000000000007',25000,25000,'especes','a3000000-0000-0000-0000-000000000004'),
('a8100000-0000-0000-0000-000000000001','a7100000-0000-0000-0000-000000000003','a2000000-0000-0000-0000-000000000008',25000,25000,'mobile_money','a3000000-0000-0000-0000-000000000004'),
('a8100000-0000-0000-0000-000000000001','a7100000-0000-0000-0000-000000000004','a2000000-0000-0000-0000-000000000009',25000,25000,'especes','a3000000-0000-0000-0000-000000000004'),
('a8100000-0000-0000-0000-000000000001','a7100000-0000-0000-0000-000000000005','a2000000-0000-0000-0000-000000000002',25000,25000,'especes','a3000000-0000-0000-0000-000000000004'),
('a8100000-0000-0000-0000-000000000001','a7100000-0000-0000-0000-000000000006','a2000000-0000-0000-0000-000000000003',25000,25000,'especes','a3000000-0000-0000-0000-000000000004');

-- Cycle 2 (MVONDO/part4 impayée ★)
INSERT INTO cotisations_tontine (cycle_id, tontine_part_id, membre_id, montant_du, montant_verse, mode_paiement, saisie_par) VALUES
('a8100000-0000-0000-0000-000000000002','a7100000-0000-0000-0000-000000000001','a2000000-0000-0000-0000-000000000006',25000,25000,'especes','a3000000-0000-0000-0000-000000000004'),
('a8100000-0000-0000-0000-000000000002','a7100000-0000-0000-0000-000000000002','a2000000-0000-0000-0000-000000000007',25000,25000,'especes','a3000000-0000-0000-0000-000000000004'),
('a8100000-0000-0000-0000-000000000002','a7100000-0000-0000-0000-000000000003','a2000000-0000-0000-0000-000000000008',25000,25000,'especes','a3000000-0000-0000-0000-000000000004'),
('a8100000-0000-0000-0000-000000000002','a7100000-0000-0000-0000-000000000004','a2000000-0000-0000-0000-000000000009',25000,25000,'especes','a3000000-0000-0000-0000-000000000004'),
('a8100000-0000-0000-0000-000000000002','a7100000-0000-0000-0000-000000000005','a2000000-0000-0000-0000-000000000002',25000,25000,'especes','a3000000-0000-0000-0000-000000000004'),
('a8100000-0000-0000-0000-000000000002','a7100000-0000-0000-0000-000000000006','a2000000-0000-0000-0000-000000000003',25000,25000,'especes','a3000000-0000-0000-0000-000000000004');
-- ★ MVONDO (part4) ne paie finalement pas → sanction automatique déclenchée
UPDATE cotisations_tontine SET montant_verse = 0
WHERE cycle_id = 'a8100000-0000-0000-0000-000000000002' AND tontine_part_id = 'a7100000-0000-0000-0000-000000000004';

-- Cycle 3 (KAMDEM/part2 partielle naturelle, MVONDO/part4 impayée ★)
INSERT INTO cotisations_tontine (cycle_id, tontine_part_id, membre_id, montant_du, montant_verse, mode_paiement, saisie_par) VALUES
('a8100000-0000-0000-0000-000000000003','a7100000-0000-0000-0000-000000000001','a2000000-0000-0000-0000-000000000006',25000,25000,'especes','a3000000-0000-0000-0000-000000000004'),
('a8100000-0000-0000-0000-000000000003','a7100000-0000-0000-0000-000000000002','a2000000-0000-0000-0000-000000000007',25000,15000,'especes','a3000000-0000-0000-0000-000000000004'),
('a8100000-0000-0000-0000-000000000003','a7100000-0000-0000-0000-000000000003','a2000000-0000-0000-0000-000000000008',25000,25000,'especes','a3000000-0000-0000-0000-000000000004'),
('a8100000-0000-0000-0000-000000000003','a7100000-0000-0000-0000-000000000004','a2000000-0000-0000-0000-000000000009',25000,25000,'especes','a3000000-0000-0000-0000-000000000004'),
('a8100000-0000-0000-0000-000000000003','a7100000-0000-0000-0000-000000000005','a2000000-0000-0000-0000-000000000002',25000,25000,'especes','a3000000-0000-0000-0000-000000000004'),
('a8100000-0000-0000-0000-000000000003','a7100000-0000-0000-0000-000000000006','a2000000-0000-0000-0000-000000000003',25000,25000,'especes','a3000000-0000-0000-0000-000000000004');
-- ★ MVONDO (part4) impayée de nouveau → 2e sanction automatique
UPDATE cotisations_tontine SET montant_verse = 0
WHERE cycle_id = 'a8100000-0000-0000-0000-000000000003' AND tontine_part_id = 'a7100000-0000-0000-0000-000000000004';

-- Cycle 4 (en_cours — encaissement en cours, personne n'a encore "gagné")
INSERT INTO cotisations_tontine (cycle_id, tontine_part_id, membre_id, montant_du, montant_verse, mode_paiement, saisie_par) VALUES
('a8100000-0000-0000-0000-000000000004','a7100000-0000-0000-0000-000000000001','a2000000-0000-0000-0000-000000000006',25000,25000,'especes','a3000000-0000-0000-0000-000000000004'),
('a8100000-0000-0000-0000-000000000004','a7100000-0000-0000-0000-000000000002','a2000000-0000-0000-0000-000000000007',25000,0,NULL,NULL),
('a8100000-0000-0000-0000-000000000004','a7100000-0000-0000-0000-000000000003','a2000000-0000-0000-0000-000000000008',25000,12000,'especes','a3000000-0000-0000-0000-000000000004'),
('a8100000-0000-0000-0000-000000000004','a7100000-0000-0000-0000-000000000004','a2000000-0000-0000-0000-000000000009',25000,0,NULL,NULL),
('a8100000-0000-0000-0000-000000000004','a7100000-0000-0000-0000-000000000005','a2000000-0000-0000-0000-000000000002',25000,25000,'especes','a3000000-0000-0000-0000-000000000004'),
('a8100000-0000-0000-0000-000000000004','a7100000-0000-0000-0000-000000000006','a2000000-0000-0000-0000-000000000003',25000,0,NULL,NULL);
-- Les 3 cotisations encore à 0 ne sont pas (encore) en retard : le cycle est en cours → statut 'due'
UPDATE cotisations_tontine SET statut = 'due'
WHERE cycle_id = 'a8100000-0000-0000-0000-000000000004' AND montant_verse = 0;

-- Cycle Tontine Enchère VIP (tout le monde paie)
INSERT INTO cotisations_tontine (cycle_id, tontine_part_id, membre_id, montant_du, montant_verse, mode_paiement, saisie_par) VALUES
('a8100000-0000-0000-0000-000000000005','a7100000-0000-0000-0000-000000000007','a2000000-0000-0000-0000-000000000006',50000,50000,'virement','a3000000-0000-0000-0000-000000000004'),
('a8100000-0000-0000-0000-000000000005','a7100000-0000-0000-0000-000000000008','a2000000-0000-0000-0000-000000000007',50000,50000,'especes','a3000000-0000-0000-0000-000000000004'),
('a8100000-0000-0000-0000-000000000005','a7100000-0000-0000-0000-000000000009','a2000000-0000-0000-0000-000000000008',50000,50000,'especes','a3000000-0000-0000-0000-000000000004'),
('a8100000-0000-0000-0000-000000000005','a7100000-0000-0000-0000-000000000010','a2000000-0000-0000-0000-000000000009',50000,50000,'especes','a3000000-0000-0000-0000-000000000004');

-- Cycle Cagnotte Solidarité
INSERT INTO cotisations_tontine (cycle_id, tontine_part_id, membre_id, montant_du, montant_verse, mode_paiement, saisie_par) VALUES
('a8100000-0000-0000-0000-000000000006','a7100000-0000-0000-0000-000000000011','a2000000-0000-0000-0000-000000000006',10000,10000,'especes','a3000000-0000-0000-0000-000000000004'),
('a8100000-0000-0000-0000-000000000006','a7100000-0000-0000-0000-000000000012','a2000000-0000-0000-0000-000000000007',10000,10000,'especes','a3000000-0000-0000-0000-000000000004'),
('a8100000-0000-0000-0000-000000000006','a7100000-0000-0000-0000-000000000013','a2000000-0000-0000-0000-000000000008',10000,10000,'especes','a3000000-0000-0000-0000-000000000004');

-- ============================================================================
-- 16. ENCHÉRITES (offres sur le cycle de la Tontine Enchère VIP)
-- ============================================================================
INSERT INTO encherites (cycle_id, tontine_part_id, membre_id, montant_offre, est_gagnante) VALUES
('a8100000-0000-0000-0000-000000000005','a7100000-0000-0000-0000-000000000007','a2000000-0000-0000-0000-000000000006',15000,TRUE),
('a8100000-0000-0000-0000-000000000005','a7100000-0000-0000-0000-000000000008','a2000000-0000-0000-0000-000000000007',12000,FALSE),
('a8100000-0000-0000-0000-000000000005','a7100000-0000-0000-0000-000000000009','a2000000-0000-0000-0000-000000000008',8000,FALSE);

-- Complète le cycle "Enchère VIP" avec le résultat de l'enchère
UPDATE cycles_tontine SET montant_enchere = 15000, surplus_enchere = 15000, surplus_redistribue = 15000
WHERE id = 'a8100000-0000-0000-0000-000000000005';

-- ============================================================================
-- 17. BULLETINS DE GAIN (les 3 statuts non-annulés : brouillon/signé/payé)
-- ============================================================================
INSERT INTO bulletins_gain (id, cycle_id, gagnant_membre_id, gagnant_part_id, numero_bulletin, montant_brut, total_retenues, montant_net, statut, mode_versement, date_versement, signe_tresorier_at, signe_president_at, signe_beneficiaire_at, genere_par) VALUES
('a8200000-0000-0000-0000-000000000001','a8100000-0000-0000-0000-000000000001','a2000000-0000-0000-0000-000000000006','a7100000-0000-0000-0000-000000000001','BG-2026-001',150000,0,150000,'paye','especes','2026-02-07 17:20:00+01','2026-02-07 17:16:00+01','2026-02-07 17:17:00+01','2026-02-07 17:20:00+01','a3000000-0000-0000-0000-000000000004'),
('a8200000-0000-0000-0000-000000000002','a8100000-0000-0000-0000-000000000002','a2000000-0000-0000-0000-000000000007','a7100000-0000-0000-0000-000000000002','BG-2026-002',150000,0,150000,'signe',NULL,NULL,'2026-03-07 17:25:00+01','2026-03-07 17:26:00+01',NULL,'a3000000-0000-0000-0000-000000000004'),
('a8200000-0000-0000-0000-000000000003','a8100000-0000-0000-0000-000000000003','a2000000-0000-0000-0000-000000000008','a7100000-0000-0000-0000-000000000003','BG-2026-003',150000,0,150000,'brouillon',NULL,NULL,NULL,NULL,NULL,'a3000000-0000-0000-0000-000000000004'),
('a8200000-0000-0000-0000-000000000004','a8100000-0000-0000-0000-000000000005','a2000000-0000-0000-0000-000000000006','a7100000-0000-0000-0000-000000000007','BG-2026-004',200000,0,200000,'paye','virement','2026-03-07 17:30:00+01','2026-03-07 17:27:00+01','2026-03-07 17:28:00+01','2026-03-07 17:30:00+01','a3000000-0000-0000-0000-000000000004');

-- Retenues sur bulletin (le trigger trg_retenues_recalc met automatiquement
-- à jour total_retenues/montant_net des bulletins ci-dessus après cet INSERT)
INSERT INTO retenues_bulletin (bulletin_id, type_retenue, libelle, montant, priorite) VALUES
('a8200000-0000-0000-0000-000000000001','cotisation_mutuelle','Cotisation Mutuelle Santé du mois',2000,5),
('a8200000-0000-0000-0000-000000000002','pret','Avance sur remboursement de prêt en cours',20000,1);

-- ============================================================================
-- 18. PRÊTS — couvre tous les statuts et les 4 types de garantie
--    P4/P5/P6/P7/P8 sont insérés directement en statut 'en_cours' : le
--    trigger trg_prets_amortissement génère alors AUTOMATIQUEMENT leur
--    tableau d'amortissement (echeances_pret) — inutile de le faire à la main.
-- ============================================================================
INSERT INTO prets (id, caisse_id, emprunteur_id, montant_principal, taux_interet_mensuel, taux_penalite_mensuel, nb_echeances, montant_echeance, interet_total, montant_total_du, montant_rembourse, capital_restant, statut, date_demande, date_approbation, date_debut, date_prise_effet, approuve_par, refuse_par, motif_refus, avaliste_id, garantie_type, created_by) VALUES
-- P1 : demande fraîche, sans garantie
('a9500000-0000-0000-0000-000000000001','a6000000-0000-0000-0000-000000000001','a2000000-0000-0000-0000-000000000009',90000,0.0300,0.0200,3,31800,5400,95400,0,90000,'demande','2026-09-05',NULL,NULL,NULL,NULL,NULL,NULL,NULL,'aucune','a3000000-0000-0000-0000-000000000004'),
-- P2 : en attente de validation président (montant > seuil_approbation_pret), caution d'un membre
('a9500000-0000-0000-0000-000000000002','a6000000-0000-0000-0000-000000000001','a2000000-0000-0000-0000-000000000008',240000,0.0300,0.0200,6,44200,25200,265200,0,240000,'en_attente_validation','2026-09-01',NULL,NULL,NULL,NULL,NULL,NULL,'a2000000-0000-0000-0000-000000000009','caution_membre','a3000000-0000-0000-0000-000000000004'),
-- P3 : refusé par le Président (montant jugé trop élevé)
('a9500000-0000-0000-0000-000000000003','a6000000-0000-0000-0000-000000000001','a2000000-0000-0000-0000-000000000007',480000,0.0300,0.0200,12,47800,93600,573600,0,480000,'refuse','2026-04-10',NULL,NULL,NULL,NULL,'a3000000-0000-0000-0000-000000000002','Montant disproportionné par rapport à la capacité de remboursement du membre.',NULL,'aucune','a3000000-0000-0000-0000-000000000004'),
-- P4 : en cours, sain, aucune échéance en retard — garantie retenue sur tontine
('a9500000-0000-0000-0000-000000000004','a6000000-0000-0000-0000-000000000001','a2000000-0000-0000-0000-000000000007',300000,0.0300,0.0200,6,55250,31500,331500,0,300000,'en_cours','2026-08-10','2026-08-12','2026-08-15','2026-08-15','a3000000-0000-0000-0000-000000000002',NULL,NULL,NULL,'retenue_tontine','a3000000-0000-0000-0000-000000000004'),
-- P5 : en cours MAIS avec une échéance déjà en retard, PAS ENCORE traitée
--      → à tester avec `php artisan prets:detecter-retards`. Garantie = blocage épargne.
('a9500000-0000-0000-0000-000000000005','a6000000-0000-0000-0000-000000000001','a2000000-0000-0000-0000-000000000006',200000,0.0250,0.0200,4,53125,12500,212500,0,200000,'en_cours','2026-08-01','2026-08-03','2026-08-05','2026-08-05','a3000000-0000-0000-0000-000000000002',NULL,NULL,NULL,'blocage_epargne','a3000000-0000-0000-0000-000000000004'),
-- P6 : en retard, déjà traité manuellement (échéances pénalisées) — sans garantie
('a9500000-0000-0000-0000-000000000006','a6000000-0000-0000-0000-000000000001','a2000000-0000-0000-0000-000000000009',150000,0.0200,0.0200,5,31800,9000,159000,0,150000,'en_retard','2026-04-25','2026-04-28','2026-05-01','2026-05-01','a3000000-0000-0000-0000-000000000002',NULL,NULL,NULL,'aucune','a3000000-0000-0000-0000-000000000004'),
-- P7 : défaut (90+ jours sans le moindre remboursement) — caution d'un membre
('a9500000-0000-0000-0000-000000000007','a6000000-0000-0000-0000-000000000001','a2000000-0000-0000-0000-000000000008',100000,0.0200,0.0200,4,26250,5000,105000,0,100000,'defaut','2025-12-20','2025-12-28','2026-01-01','2026-01-01','a3000000-0000-0000-0000-000000000002',NULL,NULL,'a2000000-0000-0000-0000-000000000007','caution_membre','a3000000-0000-0000-0000-000000000004'),
-- P8 : intégralement soldé
('a9500000-0000-0000-0000-000000000008','a6000000-0000-0000-0000-000000000001','a2000000-0000-0000-0000-000000000006',100000,0.0200,0.0200,2,51500,3000,103000,0,100000,'en_cours','2025-12-20','2025-12-28','2026-01-01','2026-01-01','a3000000-0000-0000-0000-000000000002',NULL,NULL,NULL,'aucune','a3000000-0000-0000-0000-000000000004');

-- ── P6 : marque les 4 premières échéances en retard/pénalisées, la 5e reste à venir ──
UPDATE echeances_pret SET statut = 'penalisee', montant_penalite = 1200 WHERE pret_id = 'a9500000-0000-0000-0000-000000000006' AND numero_echeance IN (1,2,3,4);
UPDATE prets SET statut = 'en_retard' WHERE id = 'a9500000-0000-0000-0000-000000000006';

-- ── P7 : marque les 4 échéances (toutes) en retard/pénalisées — défaut caractérisé ──
UPDATE echeances_pret SET statut = 'penalisee', montant_penalite = 1500 WHERE pret_id = 'a9500000-0000-0000-0000-000000000007' AND numero_echeance IN (1,2,3,4);
UPDATE prets SET statut = 'defaut' WHERE id = 'a9500000-0000-0000-0000-000000000007';

-- ── P8 : rembourse intégralement les 2 échéances → trigger fait automatiquement
--        passer le prêt en statut 'solde' via fn_maj_pret_remboursement ──
UPDATE echeances_pret SET montant_verse = montant_total, statut = 'payee', date_versement_reel = date_echeance
WHERE pret_id = 'a9500000-0000-0000-0000-000000000008' AND numero_echeance = 1;
UPDATE echeances_pret SET montant_verse = montant_total, statut = 'payee', date_versement_reel = date_echeance
WHERE pret_id = 'a9500000-0000-0000-0000-000000000008' AND numero_echeance = 2;

-- ============================================================================
-- 19. HISTORIQUE DES PRÊTS (quelques transitions journalisées)
-- ============================================================================
INSERT INTO historique_prets (pret_id, statut_avant, statut_apres, commentaire, fait_par) VALUES
('a9500000-0000-0000-0000-000000000002','demande','en_attente_validation','Montant supérieur au seuil de validation directe du Trésorier','a3000000-0000-0000-0000-000000000004'),
('a9500000-0000-0000-0000-000000000003','demande','en_attente_validation',NULL,'a3000000-0000-0000-0000-000000000004'),
('a9500000-0000-0000-0000-000000000003','en_attente_validation','refuse','Montant disproportionné par rapport à la capacité de remboursement','a3000000-0000-0000-0000-000000000002'),
('a9500000-0000-0000-0000-000000000004','demande','approuve',NULL,'a3000000-0000-0000-0000-000000000002'),
('a9500000-0000-0000-0000-000000000004','approuve','en_cours','Décaissement effectué',(SELECT id FROM utilisateurs WHERE email='tresorier@tontix.cm')),
('a9500000-0000-0000-0000-000000000006','en_cours','en_retard','4 échéances impayées constatées lors du conseil de bureau du 13/06','a3000000-0000-0000-0000-000000000004'),
('a9500000-0000-0000-0000-000000000007','en_cours','en_retard','Aucun remboursement depuis le décaissement','a3000000-0000-0000-0000-000000000004'),
('a9500000-0000-0000-0000-000000000007','en_retard','defaut','Plus de 90 jours sans régularisation malgré relances','a3000000-0000-0000-0000-000000000004'),
('a9500000-0000-0000-0000-000000000008','en_cours','solde','Remboursement intégral des 2 échéances','a3000000-0000-0000-0000-000000000004');

-- ============================================================================
-- 20. SANCTIONS MANUELLES (les auto — absence & retard cotisation — ont déjà
--    été créées plus haut par les triggers trg_presences_sanction et
--    trg_cotisations_sanction). Couvre retard_pret, retard_presence,
--    absences_cumulees (pas de trigger DB pour ces 3-là) + sanctions
--    disciplinaires manuelles, sur tous les statuts possibles.
-- ============================================================================
-- annulee_par/motif_annulation sont inclus DIRECTEMENT dans l'INSERT de la
-- ligne "Insubordination" ci-dessous : comme pour tontines_enchere_mise_min_ck
-- plus haut, la contrainte sanctions_annulation_ck est un CHECK, donc évaluée
-- immédiatement — un UPDATE séparé après coup ferait échouer l'INSERT.
INSERT INTO sanctions_membres (association_id, membre_id, type_sanction_id, reunion_id, montant, motif, statut, est_automatique, reference_type, reference_id, appliquee_par, annulee_par, annulee_at, motif_annulation) VALUES
-- Retard de remboursement de prêt (P6, échéance n°1) — pas de trigger DB, appliquée par le trésorier
('a0000000-0000-0000-0000-000000000001','a2000000-0000-0000-0000-000000000009','a9000000-0000-0000-0000-000000000003',NULL,3000,'Retard sur l''échéance n°1 du prêt (RG-PRT-020)','due',TRUE,'echeance_pret',(SELECT id FROM echeances_pret WHERE pret_id='a9500000-0000-0000-0000-000000000006' AND numero_echeance=1),'a3000000-0000-0000-0000-000000000004',NULL,NULL,NULL),
-- Retard à l'arrivée en réunion (KAMDEM, palier 60 min) — payée, liée à une transaction plus bas
('a0000000-0000-0000-0000-000000000001','a2000000-0000-0000-0000-000000000007','a9000000-0000-0000-0000-000000000004','a8000000-0000-0000-0000-000000000002',1000,'Arrivée à 16h05 au lieu de 15h00 — palier 60 minutes','payee',TRUE,'presence',(SELECT id FROM presences WHERE reunion_id='a8000000-0000-0000-0000-000000000002' AND membre_id='a2000000-0000-0000-0000-000000000007'),'a3000000-0000-0000-0000-000000000004',NULL,NULL,NULL),
-- Absences cumulées (MVONDO)
('a0000000-0000-0000-0000-000000000001','a2000000-0000-0000-0000-000000000009','a9000000-0000-0000-0000-000000000005','a8000000-0000-0000-0000-000000000002',3000,'Seuil de 3 absences non excusées franchi sur les 12 derniers mois','due',TRUE,'membre','a2000000-0000-0000-0000-000000000009','a3000000-0000-0000-0000-000000000004',NULL,NULL,NULL),
-- Bavardage en AG (manuelle, payée)
('a0000000-0000-0000-0000-000000000001','a2000000-0000-0000-0000-000000000008','a9000000-0000-0000-0000-000000000006','a8000000-0000-0000-0000-000000000003',500,'A perturbé les débats pendant la présentation du rapport financier','payee',FALSE,NULL,NULL,'a3000000-0000-0000-0000-000000000002',NULL,NULL,NULL),
-- Insubordination (BALDE, à l'origine de l'exclusion) — annulée après recours (déjà annulée à l'insertion)
('a0000000-0000-0000-0000-000000000001','a2000000-0000-0000-0000-000000000011','a9000000-0000-0000-0000-000000000007','a8000000-0000-0000-0000-000000000003',10000,'Insultes répétées envers le bureau pendant l''AG','annulee',FALSE,NULL,NULL,'a3000000-0000-0000-0000-000000000002','a3000000-0000-0000-0000-000000000002','2026-04-20 10:00:00+01','Recours du bureau : l''échange a été requalifié en incident mineur, sanction levée.'),
-- Retenue directement sur le bulletin de gain de KAMDEM (cycle 2)
('a0000000-0000-0000-0000-000000000001','a2000000-0000-0000-0000-000000000007','a9000000-0000-0000-0000-000000000006','a8000000-0000-0000-0000-000000000004',1500,'Sanction disciplinaire compensée directement sur le bulletin de gain','retenue_sur_gain',FALSE,NULL,NULL,'a3000000-0000-0000-0000-000000000002',NULL,NULL,NULL);

UPDATE sanctions_membres SET bulletin_id = 'a8200000-0000-0000-0000-000000000002'
WHERE membre_id = 'a2000000-0000-0000-0000-000000000007' AND statut = 'retenue_sur_gain';

INSERT INTO retenues_bulletin (bulletin_id, type_retenue, libelle, montant, priorite) VALUES
('a8200000-0000-0000-0000-000000000002','sanction','Sanction disciplinaire compensée sur bulletin',1500,2);

-- ============================================================================
-- 21. TYPES D'AIDE SOCIALE (barème) + PLAFOND À VIE (nb_max_vie)
-- ============================================================================
INSERT INTO types_aide_sociale (id, association_id, libelle, type_evenement, montant_fixe, montant_min, montant_max, conditions, delai_versement_jours, caisse_source_id, nb_max_par_an, nb_max_vie, justificatif_requis, actif, date_effet) VALUES
('aa000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000001','Aide naissance','naissance',25000,NULL,NULL,'Acte de naissance à fournir dans les 30 jours',7,'a6000000-0000-0000-0000-000000000003',3,NULL,TRUE,TRUE,'2019-03-01'),
('aa000000-0000-0000-0000-000000000002','a0000000-0000-0000-0000-000000000001','Aide mariage','mariage',50000,NULL,NULL,'Acte de mariage à fournir',7,'a6000000-0000-0000-0000-000000000003',1,4,TRUE,TRUE,'2019-03-01'),
('aa000000-0000-0000-0000-000000000003','a0000000-0000-0000-0000-000000000001','Aide décès (membre)','deces_membre',150000,NULL,NULL,'Acte de décès à fournir',3,'a6000000-0000-0000-0000-000000000003',1,1,TRUE,TRUE,'2019-03-01'),
('aa000000-0000-0000-0000-000000000004','a0000000-0000-0000-0000-000000000001','Aide décès (famille proche)','deces_famille',75000,NULL,NULL,'Acte de décès + lien de parenté à fournir',3,'a6000000-0000-0000-0000-000000000003',3,NULL,TRUE,TRUE,'2019-03-01'),
('aa000000-0000-0000-0000-000000000005','a0000000-0000-0000-0000-000000000001','Aide maladie','maladie',NULL,10000,100000,'Ordonnance ou facture médicale à fournir',7,'a6000000-0000-0000-0000-000000000003',3,NULL,TRUE,TRUE,'2019-03-01'),
('aa000000-0000-0000-0000-000000000006','a0000000-0000-0000-0000-000000000001','Aide rentrée scolaire','scolarite',15000,NULL,NULL,'Certificat de scolarité des enfants à fournir',14,'a6000000-0000-0000-0000-000000000004',1,NULL,TRUE,TRUE,'2019-03-01');

INSERT INTO aide_sociale_initiale (membre_id, type_aide_id, nombre_deja_recu) VALUES
('a2000000-0000-0000-0000-000000000004','aa000000-0000-0000-0000-000000000002',1);

-- ============================================================================
-- 22. ÉVÉNEMENTS SOCIAUX — les 5 statuts
-- ============================================================================
INSERT INTO evenements_sociaux (association_id, membre_id, type_aide_id, description, date_evenement, date_declaration, montant_demande, montant_accorde, statut, approuve_par, approuve_at, refuse_par, motif_refus, date_versement, notes) VALUES
('a0000000-0000-0000-0000-000000000001','a2000000-0000-0000-0000-000000000006','aa000000-0000-0000-0000-000000000001','Naissance de son deuxième enfant','2026-08-20','2026-08-22',25000,NULL,'demandee',NULL,NULL,NULL,NULL,NULL,NULL),
('a0000000-0000-0000-0000-000000000001','a2000000-0000-0000-0000-000000000008','aa000000-0000-0000-0000-000000000005','Hospitalisation pour paludisme sévère','2026-08-25','2026-08-26',45000,NULL,'en_validation',NULL,NULL,NULL,NULL,NULL,'En attente de l''ordonnance complète'),
('a0000000-0000-0000-0000-000000000001','a2000000-0000-0000-0000-000000000007','aa000000-0000-0000-0000-000000000006','Rentrée scolaire de ses 3 enfants','2026-09-01','2026-09-02',15000,15000,'approuvee','a3000000-0000-0000-0000-000000000004','2026-09-03 10:00:00+01',NULL,NULL,NULL,'Certificats de scolarité fournis et validés'),
('a0000000-0000-0000-0000-000000000001','a2000000-0000-0000-0000-000000000009','aa000000-0000-0000-0000-000000000005','Consultation médicale ordinaire, non urgente','2026-07-10','2026-07-15',20000,NULL,'refusee',NULL,NULL,'a3000000-0000-0000-0000-000000000004','Ne relève pas d''une maladie grave au sens du règlement (RG-SOC)',NULL,NULL),
('a0000000-0000-0000-0000-000000000001','a2000000-0000-0000-0000-000000000004','aa000000-0000-0000-0000-000000000002','Mariage de sa fille aînée','2026-06-14','2026-06-16',50000,50000,'versee','a3000000-0000-0000-0000-000000000002','2026-06-18 09:00:00+01',NULL,NULL,'2026-06-20 14:00:00+01','Versement effectué en espèces lors de la cérémonie de remise');

-- ============================================================================
-- 23. DÉCISIONS D'ASSEMBLÉE GÉNÉRALE (les 5 statuts, 4 types)
-- ============================================================================
INSERT INTO decisions_ag (association_id, reunion_id, numero_decision, type, objet, description, quorum_present, votes_pour, votes_contre, votes_abstention, statut, date_effet, notes) VALUES
('a0000000-0000-0000-0000-000000000001','a8000000-0000-0000-0000-000000000003','AG-2026-001','statutaire','Adoption du règlement intérieur version 2.0','Refonte complète intégrant les nouvelles règles de sanction et de garantie de prêt.',9,9,0,0,'adopte','2026-04-06',NULL),
('a0000000-0000-0000-0000-000000000001','a8000000-0000-0000-0000-000000000003','AG-2026-002','organisationnel','Reconduction du bureau sortant pour un mandat de 2 ans',NULL,9,8,0,1,'adopte','2026-04-06',NULL),
('a0000000-0000-0000-0000-000000000001','a8000000-0000-0000-0000-000000000003','AG-2026-003','financier','Augmentation de la part de la Tontine Mensuelle à 30 000 FCFA','Proposition rejetée, jugée trop lourde pour certains membres.',9,3,6,0,'rejete',NULL,'À représenter lors d''une prochaine AG avec une hausse plus progressive'),
('a0000000-0000-0000-0000-000000000001','a8000000-0000-0000-0000-000000000003','AG-2026-004','disciplinaire','Exclusion de BALDE Fatou pour insultes répétées envers le bureau','Vote consécutif à l''incident du 04/04/2026.',9,7,1,1,'en_cours',NULL,'En attente de notification formelle à l''intéressée avant application');

-- ============================================================================
-- 24. ASSURANCES MEMBRES (date_fin nullable depuis la migration récente)
-- ============================================================================
INSERT INTO assurances_membres (membre_id, type_assurance, assureur, numero_police, date_debut, date_fin, prime_mensuelle, actif, caisse_id, notes) VALUES
('a2000000-0000-0000-0000-000000000001','Assurance santé collective','Activa Assurances','POL-2020-1147','2020-01-01',NULL,3500,TRUE,'a6000000-0000-0000-0000-000000000003','Police à durée indéterminée, reconduction tacite'),
('a2000000-0000-0000-0000-000000000004','Assurance santé collective','Activa Assurances','POL-2020-1148','2020-01-01','2026-12-31',3500,TRUE,'a6000000-0000-0000-0000-000000000003',NULL),
('a2000000-0000-0000-0000-000000000006','Assurance décès-invalidité','Chanas Assurances','POL-2021-0456','2021-01-01','2025-12-31',1500,FALSE,'a6000000-0000-0000-0000-000000000003','Non renouvelée à échéance');

-- ============================================================================
-- 25. TRANSACTIONS (solde_avant/solde_apres sont recalculés AUTOMATIQUEMENT
--    par le trigger fn_maj_solde_caisse pour entree/sortie/transfert_* — les
--    valeurs 0 passées ici sont de simples placeholders écrasés à l'insertion)
-- ============================================================================
-- cheque_numero est inclus dès l'INSERT pour la ligne "cheque" ci-dessous —
-- même raison que plus haut : transactions_cheque_ck est un CHECK, évalué
-- immédiatement (mode_paiement='cheque' SANS cheque_numero ferait échouer
-- l'INSERT, pas seulement un futur UPDATE). Même chose pour annulee/
-- annulee_par/motif_annulation sur la ligne "annulée" plus bas : une
-- transaction validée est rendue IMMUABLE par le trigger
-- trg_transactions_immutables (toute UPDATE sur une ligne valide=TRUE lève
-- une exception "immuable") — l'annulation doit donc être posée dès l'INSERT.
-- Décaissements des prêts en cours (P4, P6, P7, P8) depuis la Caisse Tontine Mensuelle
INSERT INTO transactions (id, caisse_id, type, montant, solde_avant, solde_apres, libelle, date_transaction, mode_paiement, cheque_numero, reference_type, reference_id, valide, valide_par, valide_at, annulee, annulee_par, annulee_at, motif_annulation, created_by) VALUES
('ab000000-0000-0000-0000-000000000001','a6000000-0000-0000-0000-000000000001','sortie',300000,0,0,'Décaissement prêt — KAMDEM Martin','2026-08-15 09:00:00+01','virement',NULL,'pret','a9500000-0000-0000-0000-000000000004',TRUE,'a3000000-0000-0000-0000-000000000004','2026-08-15 09:00:00+01',FALSE,NULL,NULL,NULL,'a3000000-0000-0000-0000-000000000004'),
('ab000000-0000-0000-0000-000000000002','a6000000-0000-0000-0000-000000000001','sortie',150000,0,0,'Décaissement prêt — MVONDO Pierre','2026-05-01 09:00:00+01','especes',NULL,'pret','a9500000-0000-0000-0000-000000000006',TRUE,'a3000000-0000-0000-0000-000000000004','2026-05-01 09:00:00+01',FALSE,NULL,NULL,NULL,'a3000000-0000-0000-0000-000000000004'),
('ab000000-0000-0000-0000-000000000003','a6000000-0000-0000-0000-000000000001','sortie',100000,0,0,'Décaissement prêt — NGO Christelle','2026-01-01 09:00:00+01','especes',NULL,'pret','a9500000-0000-0000-0000-000000000007',TRUE,'a3000000-0000-0000-0000-000000000004','2026-01-01 09:00:00+01',FALSE,NULL,NULL,NULL,'a3000000-0000-0000-0000-000000000004'),
('ab000000-0000-0000-0000-000000000004','a6000000-0000-0000-0000-000000000001','sortie',100000,0,0,'Décaissement prêt — DIALLO Aminata (soldé depuis)','2026-01-01 09:00:00+01','especes',NULL,'pret','a9500000-0000-0000-0000-000000000008',TRUE,'a3000000-0000-0000-0000-000000000004','2026-01-01 09:00:00+01',FALSE,NULL,NULL,NULL,'a3000000-0000-0000-0000-000000000004'),
-- Remboursements des 2 échéances du prêt soldé (P8)
('ab000000-0000-0000-0000-000000000005','a6000000-0000-0000-0000-000000000001','entree',52000,0,0,'Remboursement échéance 1/2 — prêt DIALLO Aminata','2026-02-01 10:00:00+01','especes',NULL,'echeance_pret',NULL,TRUE,'a3000000-0000-0000-0000-000000000004','2026-02-01 10:00:00+01',FALSE,NULL,NULL,NULL,'a3000000-0000-0000-0000-000000000004'),
('ab000000-0000-0000-0000-000000000006','a6000000-0000-0000-0000-000000000001','entree',51000,0,0,'Remboursement échéance 2/2 — prêt DIALLO Aminata','2026-03-01 10:00:00+01','especes',NULL,'echeance_pret',NULL,TRUE,'a3000000-0000-0000-0000-000000000004','2026-03-01 10:00:00+01',FALSE,NULL,NULL,NULL,'a3000000-0000-0000-0000-000000000004'),
-- Paiement d'une sanction (retard de KAMDEM)
('ab000000-0000-0000-0000-000000000007','a6000000-0000-0000-0000-000000000001','entree',1000,0,0,'Paiement sanction retard réunion — KAMDEM Martin','2026-03-08 09:00:00+01','especes',NULL,'sanction',NULL,TRUE,'a3000000-0000-0000-0000-000000000004','2026-03-08 09:00:00+01',FALSE,NULL,NULL,NULL,'a3000000-0000-0000-0000-000000000004'),
-- Un chèque (numéro unique par caisse)
('ab000000-0000-0000-0000-000000000008','a6000000-0000-0000-0000-000000000003','entree',50000,0,0,'Don d''un sympathisant à la Mutuelle Santé','2026-06-01 09:00:00+01','cheque','CHQ-000452',NULL,NULL,TRUE,'a3000000-0000-0000-0000-000000000004','2026-06-01 09:00:00+01',FALSE,NULL,NULL,NULL,'a3000000-0000-0000-0000-000000000004'),
-- Versement de l'aide sociale "mariage" (statut versée)
('ab000000-0000-0000-0000-000000000009','a6000000-0000-0000-0000-000000000003','sortie',50000,0,0,'Versement aide mariage — MBALLA Odette','2026-06-20 14:00:00+01','especes',NULL,'evenement_social',NULL,TRUE,'a3000000-0000-0000-0000-000000000002','2026-06-20 14:00:00+01',FALSE,NULL,NULL,NULL,'a3000000-0000-0000-0000-000000000004'),
-- Une transaction ANNULÉE — annulee/annulee_par/motif_annulation posés dès l'INSERT
('ab000000-0000-0000-0000-000000000010','a6000000-0000-0000-0000-000000000004','sortie',30000,0,0,'Saisie erronée — double paiement aide scolaire','2026-09-02 09:00:00+01','especes',NULL,NULL,NULL,TRUE,'a3000000-0000-0000-0000-000000000004','2026-09-02 09:00:00+01',TRUE,'a3000000-0000-0000-0000-000000000002','2026-09-02 15:00:00+01','Erreur de saisie : le versement avait déjà été enregistré la veille.','a3000000-0000-0000-0000-000000000004'),
-- Une transaction NON VALIDÉE (en attente de validation) — mode_paiement/valide_par
-- volontairement NULL, comme l'exige la contrainte transactions_validees_completes_ck
('ab000000-0000-0000-0000-000000000011','a6000000-0000-0000-0000-000000000003','entree',15000,0,0,'Cotisation exceptionnelle à valider par le trésorier','2026-09-08 16:00:00+01',NULL,NULL,NULL,NULL,FALSE,NULL,NULL,FALSE,NULL,NULL,NULL,'a3000000-0000-0000-0000-000000000005');

-- Relie les prêts à leur transaction de décaissement
UPDATE prets SET transaction_decaissement_id = 'ab000000-0000-0000-0000-000000000001' WHERE id = 'a9500000-0000-0000-0000-000000000004';
UPDATE prets SET transaction_decaissement_id = 'ab000000-0000-0000-0000-000000000002' WHERE id = 'a9500000-0000-0000-0000-000000000006';
UPDATE prets SET transaction_decaissement_id = 'ab000000-0000-0000-0000-000000000003' WHERE id = 'a9500000-0000-0000-0000-000000000007';
UPDATE prets SET transaction_decaissement_id = 'ab000000-0000-0000-0000-000000000004' WHERE id = 'a9500000-0000-0000-0000-000000000008';
UPDATE echeances_pret SET transaction_id = 'ab000000-0000-0000-0000-000000000005' WHERE pret_id = 'a9500000-0000-0000-0000-000000000008' AND numero_echeance = 1;
UPDATE echeances_pret SET transaction_id = 'ab000000-0000-0000-0000-000000000006' WHERE pret_id = 'a9500000-0000-0000-0000-000000000008' AND numero_echeance = 2;
UPDATE sanctions_membres SET transaction_id = 'ab000000-0000-0000-0000-000000000007', payee_at = '2026-03-08 09:00:00+01'
WHERE membre_id = 'a2000000-0000-0000-0000-000000000007' AND type_sanction_id = 'a9000000-0000-0000-0000-000000000004';
UPDATE evenements_sociaux SET transaction_id = 'ab000000-0000-0000-0000-000000000009' WHERE membre_id = 'a2000000-0000-0000-0000-000000000004' AND statut = 'versee';

-- ============================================================================
-- 26. TRANSFERT DE CAISSE — un exécuté, un en attente d'approbation
-- ============================================================================
INSERT INTO transactions (id, caisse_id, type, montant, solde_avant, solde_apres, libelle, date_transaction, mode_paiement, valide, valide_par, valide_at, created_by) VALUES
('ab000000-0000-0000-0000-000000000012','a6000000-0000-0000-0000-000000000001','transfert_sortant',80000,0,0,'Transfert vers Mutuelle Santé — réapprovisionnement','2026-07-01 09:00:00+01','virement',TRUE,'a3000000-0000-0000-0000-000000000004','2026-07-01 09:00:00+01','a3000000-0000-0000-0000-000000000004'),
('ab000000-0000-0000-0000-000000000013','a6000000-0000-0000-0000-000000000003','transfert_entrant',80000,0,0,'Transfert depuis Caisse Tontine Mensuelle — réapprovisionnement','2026-07-01 09:00:00+01','virement',TRUE,'a3000000-0000-0000-0000-000000000004','2026-07-01 09:00:00+01','a3000000-0000-0000-0000-000000000004');

INSERT INTO transferts_caisse (caisse_source_id, caisse_destination_id, montant, transaction_source_id, transaction_dest_id, motif, approuve_par, statut, demande_par, demande_at, approuve_at) VALUES
('a6000000-0000-0000-0000-000000000001','a6000000-0000-0000-0000-000000000003',80000,'ab000000-0000-0000-0000-000000000012','ab000000-0000-0000-0000-000000000013','Réapprovisionnement trimestriel de la Mutuelle Santé','a3000000-0000-0000-0000-000000000002','execute','a3000000-0000-0000-0000-000000000004','2026-07-01 08:30:00+01','2026-07-01 08:55:00+01');

-- Transfert encore EN ATTENTE d'approbation (pas de transactions liées tant que non exécuté)
INSERT INTO transferts_caisse (caisse_source_id, caisse_destination_id, montant, transaction_source_id, transaction_dest_id, motif, statut, demande_par, demande_at) VALUES
('a6000000-0000-0000-0000-000000000002','a6000000-0000-0000-0000-000000000004',60000,NULL,NULL,'Avance pour couvrir les aides de rentrée scolaire en attente','en_attente','a3000000-0000-0000-0000-000000000004','2026-09-08 11:00:00+01');

-- ============================================================================
-- 27. RAPPROCHEMENT BANCAIRE — écart volontairement non justifié (test alerte)
-- ============================================================================
INSERT INTO rapprochements_bancaires (compte_bancaire_id, caisse_id, periode_debut, periode_fin, solde_banque, solde_logiciel, justification, valide_par, valide_at) VALUES
('a5000000-0000-0000-0000-000000000001','a6000000-0000-0000-0000-000000000005','2026-08-01','2026-08-31',1050000,1000000,NULL,NULL,NULL);

-- ============================================================================
-- 28. ÉPARGNE MEMBRES (dépôts/retraits, solde calculé à la volée par l'appli)
-- ============================================================================
INSERT INTO epargne_mouvements (caisse_id, membre_id, type, montant, motif, created_by, created_at) VALUES
('a6000000-0000-0000-0000-000000000006','a2000000-0000-0000-0000-000000000006','depot',100000,'Dépôt initial','a3000000-0000-0000-0000-000000000004','2026-07-01 09:00:00+01'),
('a6000000-0000-0000-0000-000000000006','a2000000-0000-0000-0000-000000000007','depot',80000,'Dépôt initial','a3000000-0000-0000-0000-000000000004','2026-07-01 09:05:00+01'),
('a6000000-0000-0000-0000-000000000006','a2000000-0000-0000-0000-000000000008','depot',60000,'Dépôt initial','a3000000-0000-0000-0000-000000000004','2026-07-05 09:00:00+01'),
('a6000000-0000-0000-0000-000000000006','a2000000-0000-0000-0000-000000000009','depot',40000,'Dépôt initial','a3000000-0000-0000-0000-000000000004','2026-07-10 09:00:00+01'),
('a6000000-0000-0000-0000-000000000006','a2000000-0000-0000-0000-000000000007','retrait',20000,'Retrait partiel pour besoin personnel','a3000000-0000-0000-0000-000000000004','2026-08-15 09:00:00+01');

-- Garantie du prêt P5 (blocage_epargne) : photo du solde de DIALLO Aminata au décaissement
INSERT INTO pret_epargne_snapshots (pret_id, membre_id, solde_snapshot) VALUES
('a9500000-0000-0000-0000-000000000005','a2000000-0000-0000-0000-000000000006',100000);

-- ============================================================================
-- 29. REMISE DE GAINS (Cagnotte Solidarité, mode_cagnotte)
-- ============================================================================
INSERT INTO remises_gain (id, tontine_id, reunion_id, date_remise, notes, created_by) VALUES
('ac000000-0000-0000-0000-000000000001','a7000000-0000-0000-0000-000000000004','a8000000-0000-0000-0000-000000000001','2026-02-07 17:30:00+01','Première remise partielle décidée en séance','a3000000-0000-0000-0000-000000000004');

INSERT INTO remise_gain_lignes (remise_gain_id, tontine_part_id, montant_verse, notes) VALUES
('ac000000-0000-0000-0000-000000000001','a7100000-0000-0000-0000-000000000011',5000,'Besoin urgent signalé par DIALLO Aminata'),
('ac000000-0000-0000-0000-000000000001','a7100000-0000-0000-0000-000000000012',8000,NULL);

-- ============================================================================
-- 30. PLANNING DES TOURS (Tontine Mensuelle Bassa)
-- ============================================================================
INSERT INTO planning_tours (tontine_id, tontine_part_id, numero_tour, beneficiaire_membre_id, montant_prevu, date_prevue, statut) VALUES
('a7000000-0000-0000-0000-000000000001','a7100000-0000-0000-0000-000000000001',1,'a2000000-0000-0000-0000-000000000006',150000,'2026-02-07','realise'),
('a7000000-0000-0000-0000-000000000001','a7100000-0000-0000-0000-000000000002',2,'a2000000-0000-0000-0000-000000000007',150000,'2026-03-07','realise'),
('a7000000-0000-0000-0000-000000000001','a7100000-0000-0000-0000-000000000003',3,'a2000000-0000-0000-0000-000000000008',150000,'2026-05-02','realise'),
('a7000000-0000-0000-0000-000000000001','a7100000-0000-0000-0000-000000000004',4,'a2000000-0000-0000-0000-000000000009',150000,'2026-07-04','planifie'),
('a7000000-0000-0000-0000-000000000001','a7100000-0000-0000-0000-000000000005',5,'a2000000-0000-0000-0000-000000000002',150000,'2026-08-01','planifie'),
('a7000000-0000-0000-0000-000000000001','a7100000-0000-0000-0000-000000000006',6,'a2000000-0000-0000-0000-000000000003',150000,'2026-09-05','planifie');

-- ============================================================================
-- 31. NOTIFICATIONS (quelques exemples, canaux et statuts variés)
-- ============================================================================
INSERT INTO notifications (association_id, reunion_id, membre_id, canal, type_evenement, sujet, contenu, statut, programmee_a, envoyee_a) VALUES
('a0000000-0000-0000-0000-000000000001','a8000000-0000-0000-0000-000000000008','a2000000-0000-0000-0000-000000000006','sms','rappel_reunion_j7',NULL,'Rappel : réunion extraordinaire le 26/09/2026 à 16h, Salle communautaire Akwa.','envoyee','2026-09-19 08:00:00+01','2026-09-19 08:00:05+01'),
('a0000000-0000-0000-0000-000000000001','a8000000-0000-0000-0000-000000000008',NULL,'email','rappel_reunion_j3','Rappel réunion du 26/09','Rappel : réunion extraordinaire le 26/09/2026 à 16h.','en_attente','2026-09-23 08:00:00+01',NULL),
('a0000000-0000-0000-0000-000000000001',NULL,'a2000000-0000-0000-0000-000000000010','sms','alerte_solde_bas',NULL,'Votre statut a été mis à jour en "suspendu" suite à 3 cotisations impayées consécutives.','echec','2026-08-20 09:00:00+01',NULL);

UPDATE notifications SET erreur = 'Numéro de téléphone invalide ou injoignable', nb_tentatives = 2 WHERE statut = 'echec';

COMMIT;
