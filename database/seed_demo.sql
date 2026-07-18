-- ============================================================================
-- DONNÉES DE DÉMARRAGE (SEED)
-- ============================================================================

INSERT INTO associations (id, nom, nom_abrege, siege_social, ville, telephone, email, date_creation)
VALUES ('11111111-1111-1111-1111-111111111111','Tontine Solidarité Cameroun','TSC','Rue de la Paix, Akwa','Douala','+237 691 000 001','tsc@tontineapp.cm','2020-01-15');

INSERT INTO postes (id, association_id, libelle, code, niveau_hierarchie, est_bureau, est_obligatoire) VALUES
('aa000001-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','Président','PRES',1,TRUE,TRUE),
('aa000001-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111','Secrétaire Général','SG',3,TRUE,TRUE),
('aa000001-0000-0000-0000-000000000003','11111111-1111-1111-1111-111111111111','Trésorier Général','TG',3,TRUE,TRUE),
('aa000001-0000-0000-0000-000000000004','11111111-1111-1111-1111-111111111111','Contrôleur Financier','CF',4,TRUE,FALSE),
('aa000001-0000-0000-0000-000000000005','11111111-1111-1111-1111-111111111111','Membre','MBR',9,FALSE,FALSE);

INSERT INTO membres (id, association_id, matricule, nom, prenom, telephone, email, date_adhesion, statut) VALUES
('bb000001-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','TSC-001','Messi','Jean Président','+237 691 100 001','president@tsc.cm','2020-01-15','actif'),
('bb000001-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111','TSC-002','Trésor','Amina','+237 691 100 002','tresorier@tsc.cm','2020-01-15','actif'),
('bb000001-0000-0000-0000-000000000003','11111111-1111-1111-1111-111111111111','TSC-003','Kamdem','Martin','+237 691 234 567','martin.k@email.cm','2021-03-10','actif'),
('bb000001-0000-0000-0000-000000000004','11111111-1111-1111-1111-111111111111','TSC-004','Diallo','Aminata','+237 677 890 123','aminata.d@email.cm','2020-06-01','actif'),
('bb000001-0000-0000-0000-000000000005','11111111-1111-1111-1111-111111111111','TSC-005','Essama','Robert','+237 655 321 456','robert.e@email.cm','2022-01-20','suspendu'),
('bb000001-0000-0000-0000-000000000006','11111111-1111-1111-1111-111111111111','TSC-006','Ngo','Christelle','+237 699 456 789','christelle.n@email.cm','2023-04-05','actif'),
('bb000001-0000-0000-0000-000000000007','11111111-1111-1111-1111-111111111111','TSC-007','Mvondo','Pierre','+237 688 654 321','pierre.m@email.cm','2021-07-15','actif'),
('bb000001-0000-0000-0000-000000000008','11111111-1111-1111-1111-111111111111','TSC-008','Baldé','Fatou','+237 677 111 222','fatou.b@email.cm','2020-09-01','actif');

INSERT INTO utilisateurs (membre_id, email, password_hash, role) VALUES
('bb000001-0000-0000-0000-000000000001','president@tsc.cm', crypt('Demo@2026!',gen_salt('bf')), 'president'),
('bb000001-0000-0000-0000-000000000002','tresorier@tsc.cm', crypt('Demo@2026!',gen_salt('bf')), 'tresorier'),
('bb000001-0000-0000-0000-000000000003','martin.k@email.cm',crypt('Demo@2026!',gen_salt('bf')), 'membre'),
('bb000001-0000-0000-0000-000000000004','aminata.d@email.cm',crypt('Demo@2026!',gen_salt('bf')),'membre');

INSERT INTO types_sanction (association_id, libelle, mode_calcul, montant_fixe, est_automatique, declencheur) VALUES
('11111111-1111-1111-1111-111111111111','Retard de cotisation','fixe',2500,TRUE,'retard_cotisation'),
('11111111-1111-1111-1111-111111111111','Absence non excusée','fixe',5000,TRUE,'absence_non_excusee'),
('11111111-1111-1111-1111-111111111111','Bavardage en réunion','fixe',500,FALSE,NULL),
('11111111-1111-1111-1111-111111111111','Insubordination','fixe',10000,FALSE,NULL),
('11111111-1111-1111-1111-111111111111','Insulte','fixe',15000,FALSE,NULL);

INSERT INTO caisses (id, association_id, libelle, type, solde_initial, solde_actuel, pret_autorise, taux_interet_mensuel, seuil_alerte_bas) VALUES
('cc000001-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','Caisse Tontine Solidarité','tontine',0,1840000,TRUE,0.05,200000),
('cc000001-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111','Mutuelle Santé','mutuelle',500000,3200000,FALSE,0.00,500000),
('cc000001-0000-0000-0000-000000000003','11111111-1111-1111-1111-111111111111','Caisse Scolaire','scolaire',0,580000,FALSE,0.00,100000),
('cc000001-0000-0000-0000-000000000004','11111111-1111-1111-1111-111111111111','Caisse Annuelle','annuelle',0,2100000,TRUE,0.04,300000);

INSERT INTO tontines (id, association_id, libelle, montant_part, mode_attribution, nb_parts_total, statut, date_debut, caisse_id, exige_avaliste, pret_autorise)
VALUES ('dd000001-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','Tontine Solidarité',25000,'rotation',20,'active','2025-01-01','cc000001-0000-0000-0000-000000000001',FALSE,TRUE);

UPDATE caisses SET tontine_id = 'dd000001-0000-0000-0000-000000000001'
WHERE id = 'cc000001-0000-0000-0000-000000000001';

INSERT INTO tontine_parts (tontine_id, membre_id, numero_part, ordre_rotation, statut) VALUES
('dd000001-0000-0000-0000-000000000001','bb000001-0000-0000-0000-000000000004',1,1,'disponible'),
('dd000001-0000-0000-0000-000000000001','bb000001-0000-0000-0000-000000000007',2,2,'disponible'),
('dd000001-0000-0000-0000-000000000001','bb000001-0000-0000-0000-000000000003',3,3,'disponible'),
('dd000001-0000-0000-0000-000000000001','bb000001-0000-0000-0000-000000000006',4,4,'disponible'),
('dd000001-0000-0000-0000-000000000001','bb000001-0000-0000-0000-000000000005',5,5,'disponible'),
('dd000001-0000-0000-0000-000000000001','bb000001-0000-0000-0000-000000000008',6,6,'disponible'),
('dd000001-0000-0000-0000-000000000001','bb000001-0000-0000-0000-000000000003',7,7,'gagnee'),
('dd000001-0000-0000-0000-000000000001','bb000001-0000-0000-0000-000000000004',8,8,'disponible');

INSERT INTO types_aide_sociale (association_id, libelle, type_evenement, montant_fixe, montant_min, montant_max, caisse_source_id) VALUES
('11111111-1111-1111-1111-111111111111','Aide Naissance','naissance',25000,NULL,NULL,'cc000001-0000-0000-0000-000000000002'),
('11111111-1111-1111-1111-111111111111','Aide Mariage','mariage',50000,NULL,NULL,'cc000001-0000-0000-0000-000000000002'),
('11111111-1111-1111-1111-111111111111','Aide Maladie','maladie',NULL,20000,80000,'cc000001-0000-0000-0000-000000000002'),
('11111111-1111-1111-1111-111111111111','Aide Décès Membre','deces_membre',150000,NULL,NULL,'cc000001-0000-0000-0000-000000000002'),
('11111111-1111-1111-1111-111111111111','Aide Décès Famille','deces_famille',75000,NULL,NULL,'cc000001-0000-0000-0000-000000000002'),
('11111111-1111-1111-1111-111111111111','Aide Scolaire','scolarite',NULL,50000,200000,'cc000001-0000-0000-0000-000000000003');

INSERT INTO ordre_du_jour_rubriques (association_id, libelle, ordre_defaut, est_obligatoire, est_systeme) VALUES
('11111111-1111-1111-1111-111111111111','Prière d''ouverture',1,FALSE,FALSE),
('11111111-1111-1111-1111-111111111111','Mot du Président',2,TRUE,FALSE),
('11111111-1111-1111-1111-111111111111','Lecture PV dernière séance',3,TRUE,TRUE),
('11111111-1111-1111-1111-111111111111','Cotisations et tontines',5,TRUE,TRUE),
('11111111-1111-1111-1111-111111111111','Questions diverses',9,FALSE,FALSE);
