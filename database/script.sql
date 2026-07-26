Récapitulatif des 5 parties :
a exécuter dans cet ordre



-- ********************************
-- Partie 1 — Extensions, ENUMs, Organisation

-- ============================================================================
--  TONTINEAPP — Schéma PostgreSQL 16  |  Partie 1/5
--  Extensions · 27 ENUMs · Domaine Organisation & Membres (6 tables)
-- ============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "unaccent";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

CREATE SCHEMA IF NOT EXISTS tontine;
SET search_path TO tontine, public;

-- 2. ENUMS
CREATE TYPE statut_membre          AS ENUM ('actif','suspendu','exclu','en_attente');
CREATE TYPE statut_reunion         AS ENUM ('planifiee','ouverte','tenue','cloturee','annulee');
CREATE TYPE type_reunion           AS ENUM ('ordinaire','extraordinaire','ag','conseil_bureau');
CREATE TYPE statut_presence        AS ENUM ('present','absent_excuse','absent','en_retard');
CREATE TYPE mode_attribution       AS ENUM ('rotation','tirage_sort','enchere','calendrier');
CREATE TYPE statut_tontine         AS ENUM ('en_preparation','active','suspendue','cloturee');
CREATE TYPE statut_part            AS ENUM ('disponible','gagnee','reservee','bloquee');
CREATE TYPE statut_cycle           AS ENUM ('ouvert','en_cours','clos','annule');
CREATE TYPE statut_cotisation      AS ENUM ('due','payee','partielle','en_retard','impayee','exoneree');
CREATE TYPE statut_bulletin        AS ENUM ('brouillon','genere','signe','paye','annule');
CREATE TYPE type_caisse            AS ENUM ('tontine','mutuelle','scolaire','evenement','annuelle','banque','autre');
CREATE TYPE type_transaction       AS ENUM ('entree','sortie','transfert_entrant','transfert_sortant','ajustement');
CREATE TYPE mode_paiement          AS ENUM ('especes','cheque','virement','mobile_money','carte_bancaire');
CREATE TYPE statut_pret            AS ENUM ('demande','en_attente_validation','approuve','refuse','en_cours','en_retard','defaut','solde','expire');
CREATE TYPE statut_echeance        AS ENUM ('a_venir','due','payee','partielle','en_retard','penalisee');
CREATE TYPE mode_calcul_sanction   AS ENUM ('fixe','pourcentage','journalier');
CREATE TYPE statut_sanction        AS ENUM ('due','payee','annulee','retenue_sur_gain');
CREATE TYPE type_evenement_social  AS ENUM ('naissance','mariage','maladie','deces_membre','deces_famille','scolarite','autre');
CREATE TYPE statut_aide            AS ENUM ('demandee','en_validation','approuvee','refusee','versee');
CREATE TYPE statut_decision_ag     AS ENUM ('en_cours','adopte','rejete','reporte','annule');
CREATE TYPE type_decision_ag       AS ENUM ('financier','statutaire','disciplinaire','organisationnel','autre');
CREATE TYPE role_utilisateur       AS ENUM ('super_admin','president','vice_president','tresorier','secretaire','controleur','membre');
CREATE TYPE canal_notification     AS ENUM ('sms','email','push','whatsapp');
CREATE TYPE statut_notification    AS ENUM ('en_attente','envoyee','echec','ignoree');
CREATE TYPE type_retenue_bulletin  AS ENUM ('pret','sanction','cotisation_mutuelle','assurance','autre');
CREATE TYPE methode_amortissement  AS ENUM ('lineaire','degressif','in_fine');
CREATE TYPE option_surplus_enchere AS ENUM ('redistribution','mise_en_caisse');

-- 3. ASSOCIATIONS
CREATE TABLE associations (
    id                          UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
    nom                         VARCHAR(200) NOT NULL,
    nom_abrege                  VARCHAR(50),
    siege_social                TEXT,
    ville                       VARCHAR(100),
    pays                        VARCHAR(100) DEFAULT 'Cameroun',
    telephone                   VARCHAR(30),
    email                       VARCHAR(200),
    date_creation               DATE         NOT NULL,
    devise                      CHAR(3)      NOT NULL DEFAULT 'XAF',
    logo_url                    TEXT,
    statuts_url                 TEXT,
    seuil_approbation_pret      NUMERIC(15,2) DEFAULT 100000,
    nb_signataires_pv           SMALLINT     DEFAULT 3 CHECK (nb_signataires_pv BETWEEN 2 AND 7),
    delai_rappel_j7             BOOLEAN      DEFAULT TRUE,
    delai_rappel_j3             BOOLEAN      DEFAULT TRUE,
    delai_rappel_j1             BOOLEAN      DEFAULT TRUE,
    config                      JSONB        DEFAULT '{}',
    actif                       BOOLEAN      DEFAULT TRUE,
    created_at                  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    deleted_at                  TIMESTAMPTZ,
    CONSTRAINT associations_nom_uq UNIQUE (nom, pays)
);

-- 4. POSTES
CREATE TABLE postes (
    id                  UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
    association_id      UUID         NOT NULL REFERENCES associations(id) ON DELETE CASCADE,
    libelle             VARCHAR(150) NOT NULL,
    code                VARCHAR(50),
    niveau_hierarchie   SMALLINT     NOT NULL DEFAULT 5,
    est_bureau          BOOLEAN      DEFAULT FALSE,
    est_obligatoire     BOOLEAN      DEFAULT FALSE,
    pouvoirs            TEXT,
    obligations         TEXT,
    actif               BOOLEAN      DEFAULT TRUE,
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT postes_libelle_asso_uq UNIQUE (association_id, libelle)
);

-- 5. MEMBRES
CREATE TABLE membres (
    id                  UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
    association_id      UUID          NOT NULL REFERENCES associations(id) ON DELETE CASCADE,
    matricule           VARCHAR(30),
    nom                 VARCHAR(100)  NOT NULL,
    prenom              VARCHAR(100)  NOT NULL,
    date_naissance      DATE,
    sexe                CHAR(1)       CHECK (sexe IN ('M','F','A')),
    telephone           VARCHAR(30)   NOT NULL,
    telephone2          VARCHAR(30),
    email               VARCHAR(200),
    adresse             TEXT,
    ville               VARCHAR(100),
    profession          VARCHAR(150),
    photo_url           TEXT,
    date_adhesion       DATE          NOT NULL DEFAULT CURRENT_DATE,
    statut              statut_membre NOT NULL DEFAULT 'en_attente',
    motif_suspension    TEXT,
    motif_exclusion     TEXT,
    est_assure          BOOLEAN       DEFAULT FALSE,
    date_debut_assurance DATE,
    date_fin_assurance  DATE,
    notes               TEXT,
    created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ,
    CONSTRAINT membres_tel_asso_uq      UNIQUE (association_id, telephone),
    CONSTRAINT membres_matricule_asso_uq UNIQUE (association_id, matricule),
    CONSTRAINT membres_date_adhesion_ck CHECK (date_adhesion <= CURRENT_DATE)
);

-- 6. MEMBRE_POSTES (historique des mandats)
CREATE TABLE membre_postes (
    id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    membre_id       UUID        NOT NULL REFERENCES membres(id),
    poste_id        UUID        NOT NULL REFERENCES postes(id),
    date_debut      DATE        NOT NULL,
    date_fin        DATE,
    est_actif       BOOLEAN     GENERATED ALWAYS AS (date_fin IS NULL OR date_fin >= CURRENT_DATE) STORED,
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT membre_postes_periode_ck CHECK (date_fin IS NULL OR date_fin > date_debut)
);

-- 7. UTILISATEURS
CREATE TABLE utilisateurs (
    id                  UUID             PRIMARY KEY DEFAULT uuid_generate_v4(),
    membre_id           UUID             NOT NULL REFERENCES membres(id) ON DELETE CASCADE,
    email               VARCHAR(200)     NOT NULL,
    password_hash       TEXT             NOT NULL,
    role                role_utilisateur NOT NULL DEFAULT 'membre',
    actif               BOOLEAN          DEFAULT TRUE,
    tentatives_echec    SMALLINT         DEFAULT 0,
    verrouille_jusqua   TIMESTAMPTZ,
    derniere_connexion  TIMESTAMPTZ,
    token_refresh       TEXT,
    token_reset_mdp     TEXT,
    token_reset_exp     TIMESTAMPTZ,
    preferences         JSONB            DEFAULT '{}',
    created_at          TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
    CONSTRAINT utilisateurs_email_uq UNIQUE (email)
);

-- 8. REGLEMENT_INTERIEUR
CREATE TABLE reglement_interieur (
    id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    association_id  UUID        NOT NULL REFERENCES associations(id) ON DELETE CASCADE,
    version         VARCHAR(20) NOT NULL,
    titre           VARCHAR(300),
    contenu_html    TEXT,
    fichier_url     TEXT,
    date_adoption   DATE        NOT NULL,
    est_actif       BOOLEAN     DEFAULT FALSE,
    signataires     JSONB       DEFAULT '[]',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT reglement_version_asso_uq UNIQUE (association_id, version)
);


--***************************************
-- Partie 2 — Réunions, Tontines & Cycles
-- ============================================================================
--  TONTINEAPP — Schéma PostgreSQL 16  |  Partie 2/5
--  Réunions (6 tables) · Tontines & Cycles (6 tables)
-- ============================================================================

-- 9. REUNIONS
CREATE TABLE reunions (
    id                   UUID           PRIMARY KEY DEFAULT uuid_generate_v4(),
    association_id       UUID           NOT NULL REFERENCES associations(id) ON DELETE CASCADE,
    numero               INTEGER        NOT NULL,
    type                 type_reunion   NOT NULL DEFAULT 'ordinaire',
    date_reunion         DATE           NOT NULL,
    heure_debut          TIME           NOT NULL,
    heure_fin_prevue     TIME,
    heure_fin_reelle     TIME,
    lieu                 TEXT           NOT NULL,
    est_domicile_membre  BOOLEAN        DEFAULT FALSE,
    hote_membre_id       UUID           REFERENCES membres(id),
    statut               statut_reunion NOT NULL DEFAULT 'planifiee',
    quorum_requis        SMALLINT       DEFAULT 0,
    quorum_atteint       BOOLEAN,
    notes                TEXT,
    created_by           UUID           REFERENCES utilisateurs(id),
    created_at           TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    deleted_at           TIMESTAMPTZ,
    CONSTRAINT reunions_numero_asso_uq   UNIQUE (association_id, numero),
    CONSTRAINT reunions_date_asso_uq     UNIQUE (association_id, date_reunion),
    CONSTRAINT reunions_heure_ck         CHECK (heure_fin_prevue IS NULL OR heure_fin_prevue > heure_debut),
    CONSTRAINT reunions_hote_domicile_ck CHECK (NOT est_domicile_membre OR hote_membre_id IS NOT NULL)
);

-- 10. REUNION_SIGNATAIRES
CREATE TABLE reunion_signataires (
    id               UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    reunion_id       UUID        NOT NULL REFERENCES reunions(id) ON DELETE CASCADE,
    membre_id        UUID        NOT NULL REFERENCES membres(id),
    ordre_signature  SMALLINT    NOT NULL DEFAULT 1,
    role_signature   VARCHAR(100) NOT NULL,
    signed_at        TIMESTAMPTZ,
    commentaire      TEXT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT reunion_signataires_uq UNIQUE (reunion_id, membre_id)
);

-- 11. ORDRE_DU_JOUR_RUBRIQUES
CREATE TABLE ordre_du_jour_rubriques (
    id              UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
    association_id  UUID         NOT NULL REFERENCES associations(id) ON DELETE CASCADE,
    libelle         VARCHAR(200) NOT NULL,
    ordre_defaut    SMALLINT     NOT NULL DEFAULT 99,
    est_obligatoire BOOLEAN      DEFAULT FALSE,
    est_systeme     BOOLEAN      DEFAULT FALSE,
    actif           BOOLEAN      DEFAULT TRUE,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT odj_rubriques_libelle_asso_uq UNIQUE (association_id, libelle)
);

-- 12. ORDRE_DU_JOUR_ITEMS
CREATE TABLE ordre_du_jour_items (
    id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    reunion_id      UUID        NOT NULL REFERENCES reunions(id) ON DELETE CASCADE,
    rubrique_id     UUID        REFERENCES ordre_du_jour_rubriques(id),
    libelle_libre   VARCHAR(300),
    ordre           SMALLINT    NOT NULL DEFAULT 99,
    rapporteur_id   UUID        REFERENCES membres(id),
    contenu_rapport TEXT,
    rapport_valide  BOOLEAN     DEFAULT FALSE,
    pieces_jointes  JSONB       DEFAULT '[]',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT odj_items_rubrique_ou_libre_ck
        CHECK (rubrique_id IS NOT NULL OR libelle_libre IS NOT NULL)
);

-- 13. PRESENCES
CREATE TABLE presences (
    id             UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
    reunion_id     UUID            NOT NULL REFERENCES reunions(id) ON DELETE CASCADE,
    membre_id      UUID            NOT NULL REFERENCES membres(id),
    statut         statut_presence NOT NULL DEFAULT 'absent',
    heure_arrivee  TIME,
    motif_absence  TEXT,
    saisie_par     UUID            REFERENCES utilisateurs(id),
    created_at     TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    CONSTRAINT presences_reunion_membre_uq UNIQUE (reunion_id, membre_id)
);

-- 14. NOTIFICATIONS
CREATE TABLE notifications (
    id              UUID                PRIMARY KEY DEFAULT uuid_generate_v4(),
    association_id  UUID                NOT NULL REFERENCES associations(id),
    reunion_id      UUID                REFERENCES reunions(id) ON DELETE CASCADE,
    membre_id       UUID                REFERENCES membres(id),
    canal           canal_notification  NOT NULL,
    type_evenement  VARCHAR(100)        NOT NULL,
    sujet           VARCHAR(300),
    contenu         TEXT                NOT NULL,
    statut          statut_notification NOT NULL DEFAULT 'en_attente',
    programmee_a    TIMESTAMPTZ         NOT NULL,
    envoyee_a       TIMESTAMPTZ,
    nb_tentatives   SMALLINT            DEFAULT 0,
    erreur          TEXT,
    created_at      TIMESTAMPTZ         NOT NULL DEFAULT NOW()
);

-- 15. TONTINES
CREATE TABLE tontines (
    id                    UUID                 PRIMARY KEY DEFAULT uuid_generate_v4(),
    association_id        UUID                 NOT NULL REFERENCES associations(id) ON DELETE CASCADE,
    libelle               VARCHAR(200)         NOT NULL,
    description           TEXT,
    montant_part          NUMERIC(15,2)        NOT NULL CHECK (montant_part > 0),
    mode_attribution      mode_attribution     NOT NULL DEFAULT 'rotation',
    nb_parts_total        SMALLINT             NOT NULL CHECK (nb_parts_total > 0),
    nb_cycles_realises    SMALLINT             NOT NULL DEFAULT 0,
    exige_avaliste        BOOLEAN              DEFAULT FALSE,
    pret_autorise         BOOLEAN              DEFAULT FALSE,
    taux_interet_pret     NUMERIC(5,4)         DEFAULT 0.05,
    duree_max_pret_mois   SMALLINT             DEFAULT 6,
    option_surplus        option_surplus_enchere DEFAULT 'redistribution',
    mise_min_enchere      NUMERIC(15,2),
    statut                statut_tontine       NOT NULL DEFAULT 'en_preparation',
    date_debut            DATE,
    date_fin_prevue       DATE,
    date_cloture          DATE,
    caisse_id             UUID,               -- FK ajoutée après CREATE TABLE caisses
    config                JSONB                DEFAULT '{}',
    created_by            UUID                 REFERENCES utilisateurs(id),
    created_at            TIMESTAMPTZ          NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ          NOT NULL DEFAULT NOW(),
    deleted_at            TIMESTAMPTZ,
    CONSTRAINT tontines_libelle_asso_uq     UNIQUE (association_id, libelle),
    CONSTRAINT tontines_enchere_mise_min_ck CHECK (mode_attribution <> 'enchere' OR mise_min_enchere IS NOT NULL)
);

-- 16. TONTINE_PARTS
CREATE TABLE tontine_parts (
    id                   UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    tontine_id           UUID        NOT NULL REFERENCES tontines(id) ON DELETE CASCADE,
    membre_id            UUID        NOT NULL REFERENCES membres(id),
    numero_part          SMALLINT    NOT NULL,
    ordre_rotation       SMALLINT,
    date_gain_calendrier DATE,
    statut               statut_part NOT NULL DEFAULT 'disponible',
    avaliste_id          UUID        REFERENCES membres(id),
    date_attribution     TIMESTAMPTZ,
    notes                TEXT,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT tontine_parts_numero_uq        UNIQUE (tontine_id, numero_part),
    CONSTRAINT tontine_parts_avaliste_diff_ck CHECK (avaliste_id IS NULL OR avaliste_id <> membre_id)
);

-- 17. CYCLES_TONTINE
CREATE TABLE cycles_tontine (
    id                     UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
    tontine_id             UUID          NOT NULL REFERENCES tontines(id) ON DELETE CASCADE,
    reunion_id             UUID          NOT NULL REFERENCES reunions(id),
    numero_cycle           SMALLINT      NOT NULL,
    statut                 statut_cycle  NOT NULL DEFAULT 'ouvert',
    montant_collecte_prevu NUMERIC(15,2) NOT NULL DEFAULT 0,
    montant_collecte_reel  NUMERIC(15,2) NOT NULL DEFAULT 0,
    montant_deficit        NUMERIC(15,2) GENERATED ALWAYS AS (montant_collecte_prevu - montant_collecte_reel) STORED,
    gagnant_part_id        UUID          REFERENCES tontine_parts(id),
    montant_enchere        NUMERIC(15,2),
    surplus_enchere        NUMERIC(15,2) DEFAULT 0,
    surplus_redistribue    NUMERIC(15,2) DEFAULT 0,
    surplus_mis_en_caisse  NUMERIC(15,2) DEFAULT 0,
    date_ouverture         TIMESTAMPTZ,
    date_cloture           TIMESTAMPTZ,
    notes                  TEXT,
    created_at             TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at             TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    CONSTRAINT cycles_numero_tontine_uq  UNIQUE (tontine_id, numero_cycle),
    CONSTRAINT cycles_tontine_reunion_uq UNIQUE (tontine_id, reunion_id)
);

-- 18. COTISATIONS_TONTINE
CREATE TABLE cotisations_tontine (
    id                  UUID              PRIMARY KEY DEFAULT uuid_generate_v4(),
    cycle_id            UUID              NOT NULL REFERENCES cycles_tontine(id) ON DELETE CASCADE,
    tontine_part_id     UUID              NOT NULL REFERENCES tontine_parts(id),
    membre_id           UUID              NOT NULL REFERENCES membres(id),
    montant_du          NUMERIC(15,2)     NOT NULL CHECK (montant_du > 0),
    montant_verse       NUMERIC(15,2)     NOT NULL DEFAULT 0 CHECK (montant_verse >= 0),
    montant_deficit     NUMERIC(15,2)     GENERATED ALWAYS AS (montant_du - montant_verse) STORED,
    statut              statut_cotisation NOT NULL DEFAULT 'due',
    date_versement      TIMESTAMPTZ,
    mode_paiement       mode_paiement,
    reference_paiement  VARCHAR(100),
    saisie_par          UUID              REFERENCES utilisateurs(id),
    notes               TEXT,
    created_at          TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
    CONSTRAINT cotisations_cycle_part_uq UNIQUE (cycle_id, tontine_part_id)
);

-- 19. BULLETINS_GAIN
CREATE TABLE bulletins_gain (
    id                    UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
    cycle_id              UUID            NOT NULL REFERENCES cycles_tontine(id),
    gagnant_membre_id     UUID            NOT NULL REFERENCES membres(id),
    gagnant_part_id       UUID            NOT NULL REFERENCES tontine_parts(id),
    numero_bulletin       VARCHAR(50)     NOT NULL,
    montant_brut          NUMERIC(15,2)   NOT NULL CHECK (montant_brut >= 0),
    total_retenues        NUMERIC(15,2)   NOT NULL DEFAULT 0,
    montant_net           NUMERIC(15,2)   NOT NULL DEFAULT 0,
    statut                statut_bulletin NOT NULL DEFAULT 'brouillon',
    mode_versement        mode_paiement,
    reference_versement   VARCHAR(100),
    date_versement        TIMESTAMPTZ,
    signe_tresorier_at    TIMESTAMPTZ,
    signe_president_at    TIMESTAMPTZ,
    signe_beneficiaire_at TIMESTAMPTZ,
    pdf_url               TEXT,
    genere_par            UUID            REFERENCES utilisateurs(id),
    created_at            TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    CONSTRAINT bulletins_numero_uq      UNIQUE (numero_bulletin),
    CONSTRAINT bulletins_montant_net_ck CHECK (montant_net = montant_brut - total_retenues)
);

-- 20. RETENUES_BULLETIN
CREATE TABLE retenues_bulletin (
    id              UUID                  PRIMARY KEY DEFAULT uuid_generate_v4(),
    bulletin_id     UUID                  NOT NULL REFERENCES bulletins_gain(id) ON DELETE CASCADE,
    type_retenue    type_retenue_bulletin NOT NULL,
    libelle         VARCHAR(300)          NOT NULL,
    montant         NUMERIC(15,2)         NOT NULL CHECK (montant >= 0),
    priorite        SMALLINT              NOT NULL DEFAULT 5,
    reference_id    UUID,
    reference_type  VARCHAR(100),
    created_at      TIMESTAMPTZ           NOT NULL DEFAULT NOW()
);

-- 21. ENCHERITES (offres en mode enchère)
CREATE TABLE encherites (
    id              UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
    cycle_id        UUID          NOT NULL REFERENCES cycles_tontine(id) ON DELETE CASCADE,
    tontine_part_id UUID          NOT NULL REFERENCES tontine_parts(id),
    membre_id       UUID          NOT NULL REFERENCES membres(id),
    montant_offre   NUMERIC(15,2) NOT NULL CHECK (montant_offre > 0),
    est_gagnante    BOOLEAN       DEFAULT FALSE,
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    CONSTRAINT encherites_cycle_part_uq UNIQUE (cycle_id, tontine_part_id)
);

--************************************
-- Partie 3 — Caisses, Prêts & Sanctions
-- ============================================================================
--  TONTINEAPP — Schéma PostgreSQL 16  |  Partie 3/5
--  Caisses & Banque (5 tables) · Prêts (3 tables) · Sanctions (2 tables)
-- ============================================================================

-- 22. COMPTES_BANCAIRES
CREATE TABLE comptes_bancaires (
    id                    UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
    association_id        UUID         NOT NULL REFERENCES associations(id) ON DELETE CASCADE,
    banque                VARCHAR(150) NOT NULL,
    agence                VARCHAR(150),
    numero_compte         VARCHAR(100) NOT NULL,
    iban                  VARCHAR(50),
    titulaire             VARCHAR(200) NOT NULL,
    solde_dernier_releve  NUMERIC(15,2) DEFAULT 0,
    date_dernier_releve   DATE,
    actif                 BOOLEAN      DEFAULT TRUE,
    notes                 TEXT,
    created_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT comptes_numero_uq UNIQUE (numero_compte)
);

-- 23. CAISSES
CREATE TABLE caisses (
    id                    UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
    association_id        UUID          NOT NULL REFERENCES associations(id) ON DELETE CASCADE,
    libelle               VARCHAR(200)  NOT NULL,
    description           TEXT,
    type                  type_caisse   NOT NULL DEFAULT 'autre',
    solde_initial         NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (solde_initial >= 0),
    solde_actuel          NUMERIC(15,2) NOT NULL DEFAULT 0,
    compte_bancaire_id    UUID          REFERENCES comptes_bancaires(id),
    tontine_id            UUID          REFERENCES tontines(id),
    pret_autorise         BOOLEAN       DEFAULT FALSE,
    taux_interet_mensuel  NUMERIC(5,4)  DEFAULT 0.05,
    taux_penalite_mensuel NUMERIC(5,4)  DEFAULT 0.02,
    duree_max_pret_mois   SMALLINT      DEFAULT 12,
    methode_amortissement methode_amortissement DEFAULT 'lineaire',
    seuil_alerte_bas      NUMERIC(15,2),
    actif                 BOOLEAN       DEFAULT TRUE,
    date_ouverture        DATE          NOT NULL DEFAULT CURRENT_DATE,
    date_cloture          DATE,
    config                JSONB         DEFAULT '{}',
    created_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    deleted_at            TIMESTAMPTZ,
    CONSTRAINT caisses_libelle_asso_uq  UNIQUE (association_id, libelle),
    CONSTRAINT caisses_solde_positif_ck CHECK (solde_actuel >= 0),
    CONSTRAINT caisses_tontine_type_ck  CHECK (tontine_id IS NULL OR type = 'tontine')
);

-- FK différée tontines → caisses (cycle de référence)
ALTER TABLE tontines ADD CONSTRAINT tontines_caisse_fk
    FOREIGN KEY (caisse_id) REFERENCES caisses(id) DEFERRABLE INITIALLY DEFERRED;

-- 24. TRANSACTIONS (journal universel)
CREATE TABLE transactions (
    id                 UUID             PRIMARY KEY DEFAULT uuid_generate_v4(),
    caisse_id          UUID             NOT NULL REFERENCES caisses(id),
    type               type_transaction NOT NULL,
    montant            NUMERIC(15,2)    NOT NULL CHECK (montant > 0),
    solde_avant        NUMERIC(15,2)    NOT NULL,
    solde_apres        NUMERIC(15,2)    NOT NULL,
    libelle            VARCHAR(400)     NOT NULL,
    date_transaction   TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
    mode_paiement      mode_paiement,
    cheque_numero      VARCHAR(50),
    reference_externe  VARCHAR(200),
    reference_type     VARCHAR(100),
    reference_id       UUID,
    valide             BOOLEAN          DEFAULT FALSE,
    valide_par         UUID             REFERENCES utilisateurs(id),
    valide_at          TIMESTAMPTZ,
    annulee            BOOLEAN          DEFAULT FALSE,
    annulee_par        UUID             REFERENCES utilisateurs(id),
    annulee_at         TIMESTAMPTZ,
    motif_annulation   TEXT,
    notes              TEXT,
    created_by         UUID             REFERENCES utilisateurs(id),
    created_at         TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
    CONSTRAINT transactions_solde_apres_ck CHECK (solde_apres >= 0),
    CONSTRAINT transactions_cheque_ck      CHECK (mode_paiement <> 'cheque' OR cheque_numero IS NOT NULL)
);

-- 25. TRANSFERTS_CAISSE
CREATE TABLE transferts_caisse (
    id                    UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
    caisse_source_id      UUID          NOT NULL REFERENCES caisses(id),
    caisse_destination_id UUID          NOT NULL REFERENCES caisses(id),
    montant               NUMERIC(15,2) NOT NULL CHECK (montant > 0),
    transaction_source_id UUID          NOT NULL REFERENCES transactions(id),
    transaction_dest_id   UUID          NOT NULL REFERENCES transactions(id),
    motif                 TEXT          NOT NULL,
    approuve_par          UUID          REFERENCES utilisateurs(id),
    created_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    CONSTRAINT transferts_caisses_diff_ck CHECK (caisse_source_id <> caisse_destination_id)
);

-- 26. RAPPROCHEMENTS_BANCAIRES
CREATE TABLE rapprochements_bancaires (
    id                  UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
    compte_bancaire_id  UUID          NOT NULL REFERENCES comptes_bancaires(id),
    caisse_id           UUID          NOT NULL REFERENCES caisses(id),
    periode_debut       DATE          NOT NULL,
    periode_fin         DATE          NOT NULL,
    solde_banque        NUMERIC(15,2) NOT NULL,
    solde_logiciel      NUMERIC(15,2) NOT NULL,
    ecart               NUMERIC(15,2) GENERATED ALWAYS AS (solde_banque - solde_logiciel) STORED,
    justification       TEXT,
    valide_par          UUID          REFERENCES utilisateurs(id),
    valide_at           TIMESTAMPTZ,
    created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    CONSTRAINT rapprochement_periode_ck CHECK (periode_fin > periode_debut)
);

-- 27. PRETS
CREATE TABLE prets (
    id                          UUID                  PRIMARY KEY DEFAULT uuid_generate_v4(),
    caisse_id                   UUID                  NOT NULL REFERENCES caisses(id),
    emprunteur_id               UUID                  NOT NULL REFERENCES membres(id),
    montant_principal           NUMERIC(15,2)         NOT NULL CHECK (montant_principal > 0),
    taux_interet_mensuel        NUMERIC(5,4)          NOT NULL CHECK (taux_interet_mensuel >= 0),
    taux_penalite_mensuel       NUMERIC(5,4)          NOT NULL DEFAULT 0.02,
    methode_amortissement       methode_amortissement NOT NULL DEFAULT 'lineaire',
    nb_echeances                SMALLINT              NOT NULL CHECK (nb_echeances > 0),
    montant_echeance            NUMERIC(15,2)         NOT NULL,
    interet_total               NUMERIC(15,2)         NOT NULL,
    montant_total_du            NUMERIC(15,2)         NOT NULL,
    montant_rembourse           NUMERIC(15,2)         NOT NULL DEFAULT 0,
    capital_restant             NUMERIC(15,2)         NOT NULL,
    statut                      statut_pret           NOT NULL DEFAULT 'demande',
    date_demande                DATE                  NOT NULL DEFAULT CURRENT_DATE,
    date_approbation            DATE,
    date_debut                  DATE,
    date_fin_prevue             DATE,
    date_solde                  DATE,
    approuve_par                UUID                  REFERENCES utilisateurs(id),
    refuse_par                  UUID                  REFERENCES utilisateurs(id),
    motif_refus                 TEXT,
    avaliste_id                 UUID                  REFERENCES membres(id),
    transaction_decaissement_id UUID                  REFERENCES transactions(id),
    notes                       TEXT,
    created_by                  UUID                  REFERENCES utilisateurs(id),
    created_at                  TIMESTAMPTZ           NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ           NOT NULL DEFAULT NOW(),
    CONSTRAINT prets_montant_total_ck CHECK (montant_total_du = montant_principal + interet_total),
    CONSTRAINT prets_avaliste_diff_ck CHECK (avaliste_id IS NULL OR avaliste_id <> emprunteur_id),
    CONSTRAINT prets_dates_ck         CHECK (date_fin_prevue IS NULL OR date_fin_prevue > date_debut)
);

-- 28. ECHEANCES_PRET (tableau d'amortissement)
CREATE TABLE echeances_pret (
    id                    UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
    pret_id               UUID            NOT NULL REFERENCES prets(id) ON DELETE CASCADE,
    numero_echeance       SMALLINT        NOT NULL,
    date_echeance         DATE            NOT NULL,
    montant_capital       NUMERIC(15,2)   NOT NULL CHECK (montant_capital >= 0),
    montant_interet       NUMERIC(15,2)   NOT NULL CHECK (montant_interet >= 0),
    montant_total         NUMERIC(15,2)   NOT NULL,
    montant_verse         NUMERIC(15,2)   NOT NULL DEFAULT 0,
    montant_penalite      NUMERIC(15,2)   NOT NULL DEFAULT 0,
    capital_restant_apres NUMERIC(15,2)   NOT NULL,
    statut                statut_echeance NOT NULL DEFAULT 'a_venir',
    date_versement_reel   DATE,
    transaction_id        UUID            REFERENCES transactions(id),
    notes                 TEXT,
    created_at            TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    CONSTRAINT echeances_numero_pret_uq   UNIQUE (pret_id, numero_echeance),
    CONSTRAINT echeances_montant_total_ck CHECK (montant_total = montant_capital + montant_interet)
);

-- 29. HISTORIQUE_PRETS
CREATE TABLE historique_prets (
    id           UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    pret_id      UUID        NOT NULL REFERENCES prets(id) ON DELETE CASCADE,
    statut_avant statut_pret,
    statut_apres statut_pret NOT NULL,
    commentaire  TEXT,
    fait_par     UUID        REFERENCES utilisateurs(id),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 30. TYPES_SANCTION
CREATE TABLE types_sanction (
    id                 UUID                 PRIMARY KEY DEFAULT uuid_generate_v4(),
    association_id     UUID                 NOT NULL REFERENCES associations(id) ON DELETE CASCADE,
    libelle            VARCHAR(200)         NOT NULL,
    mode_calcul        mode_calcul_sanction NOT NULL DEFAULT 'fixe',
    montant_fixe       NUMERIC(15,2),
    montant_pct        NUMERIC(5,4),
    montant_journalier NUMERIC(15,2),
    est_automatique    BOOLEAN              DEFAULT FALSE,
    declencheur        VARCHAR(100),
    actif              BOOLEAN              DEFAULT TRUE,
    description        TEXT,
    created_at         TIMESTAMPTZ          NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ          NOT NULL DEFAULT NOW(),
    CONSTRAINT types_sanction_libelle_asso_uq UNIQUE (association_id, libelle),
    CONSTRAINT types_sanction_montant_ck CHECK (
        (mode_calcul = 'fixe'        AND montant_fixe        IS NOT NULL) OR
        (mode_calcul = 'pourcentage' AND montant_pct         IS NOT NULL) OR
        (mode_calcul = 'journalier'  AND montant_journalier  IS NOT NULL)
    )
);

-- 31. SANCTIONS_MEMBRES
CREATE TABLE sanctions_membres (
    id               UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
    association_id   UUID            NOT NULL REFERENCES associations(id),
    membre_id        UUID            NOT NULL REFERENCES membres(id),
    type_sanction_id UUID            NOT NULL REFERENCES types_sanction(id),
    reunion_id       UUID            REFERENCES reunions(id),
    montant          NUMERIC(15,2)   NOT NULL CHECK (montant >= 0),
    motif            TEXT            NOT NULL,
    statut           statut_sanction NOT NULL DEFAULT 'due',
    est_automatique  BOOLEAN         DEFAULT FALSE,
    reference_type   VARCHAR(100),
    reference_id     UUID,
    appliquee_par    UUID            REFERENCES utilisateurs(id),
    annulee_par      UUID            REFERENCES utilisateurs(id),
    annulee_at       TIMESTAMPTZ,
    motif_annulation TEXT,
    payee_at         TIMESTAMPTZ,
    transaction_id   UUID            REFERENCES transactions(id),
    bulletin_id      UUID            REFERENCES bulletins_gain(id),
    created_at       TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    CONSTRAINT sanctions_annulation_ck CHECK (
        statut <> 'annulee' OR (annulee_par IS NOT NULL AND motif_annulation IS NOT NULL)
    )
);

-- *******************************
-- Partie 4 — Social, Sécurité & Index
-- ============================================================================
--  TONTINEAPP — Schéma PostgreSQL 16  |  Partie 4/5
--  Social & Aides (4 tables) · Sécurité & Audit (4 tables) · 55+ Index
-- ============================================================================

-- 32. TYPES_AIDE_SOCIALE
CREATE TABLE types_aide_sociale (
    id                    UUID                  PRIMARY KEY DEFAULT uuid_generate_v4(),
    association_id        UUID                  NOT NULL REFERENCES associations(id) ON DELETE CASCADE,
    libelle               VARCHAR(200)          NOT NULL,
    type_evenement        type_evenement_social NOT NULL,
    montant_fixe          NUMERIC(15,2),
    montant_min           NUMERIC(15,2),
    montant_max           NUMERIC(15,2),
    conditions            TEXT,
    delai_versement_jours SMALLINT              DEFAULT 7,
    caisse_source_id      UUID                  REFERENCES caisses(id),
    nb_max_par_an         SMALLINT              DEFAULT 3,
    justificatif_requis   BOOLEAN               DEFAULT TRUE,
    actif                 BOOLEAN               DEFAULT TRUE,
    date_effet            DATE,
    created_at            TIMESTAMPTZ           NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ           NOT NULL DEFAULT NOW(),
    CONSTRAINT types_aide_libelle_asso_uq UNIQUE (association_id, libelle),
    CONSTRAINT types_aide_montant_ck CHECK (
        montant_fixe IS NOT NULL
        OR (montant_min IS NOT NULL AND montant_max IS NOT NULL AND montant_max >= montant_min)
    )
);

-- 33. EVENEMENTS_SOCIAUX
CREATE TABLE evenements_sociaux (
    id               UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    association_id   UUID        NOT NULL REFERENCES associations(id),
    membre_id        UUID        NOT NULL REFERENCES membres(id),
    type_aide_id     UUID        NOT NULL REFERENCES types_aide_sociale(id),
    description      TEXT        NOT NULL,
    date_evenement   DATE        NOT NULL,
    date_declaration DATE        NOT NULL DEFAULT CURRENT_DATE,
    montant_demande  NUMERIC(15,2),
    montant_accorde  NUMERIC(15,2),
    statut           statut_aide NOT NULL DEFAULT 'demandee',
    pieces_jointes   JSONB       DEFAULT '[]',
    approuve_par     UUID        REFERENCES utilisateurs(id),
    approuve_at      TIMESTAMPTZ,
    refuse_par       UUID        REFERENCES utilisateurs(id),
    motif_refus      TEXT,
    transaction_id   UUID        REFERENCES transactions(id),
    date_versement   TIMESTAMPTZ,
    notes            TEXT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT evenements_date_ck CHECK (date_declaration >= date_evenement)
);

-- 34. DECISIONS_AG
CREATE TABLE decisions_ag (
    id               UUID               PRIMARY KEY DEFAULT uuid_generate_v4(),
    association_id   UUID               NOT NULL REFERENCES associations(id) ON DELETE CASCADE,
    reunion_id       UUID               NOT NULL REFERENCES reunions(id),
    numero_decision  VARCHAR(30)        NOT NULL,
    type             type_decision_ag   NOT NULL DEFAULT 'organisationnel',
    objet            VARCHAR(500)       NOT NULL,
    description      TEXT,
    quorum_present   SMALLINT,
    votes_pour       SMALLINT           DEFAULT 0,
    votes_contre     SMALLINT           DEFAULT 0,
    votes_abstention SMALLINT           DEFAULT 0,
    statut           statut_decision_ag NOT NULL DEFAULT 'en_cours',
    date_effet       DATE,
    notes            TEXT,
    created_at       TIMESTAMPTZ        NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ        NOT NULL DEFAULT NOW(),
    CONSTRAINT decisions_numero_asso_uq UNIQUE (association_id, numero_decision)
);

-- 35. ASSURANCES_MEMBRES
CREATE TABLE assurances_membres (
    id              UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
    membre_id       UUID          NOT NULL REFERENCES membres(id) ON DELETE CASCADE,
    type_assurance  VARCHAR(150)  NOT NULL,
    assureur        VARCHAR(200),
    numero_police   VARCHAR(100),
    date_debut      DATE          NOT NULL,
    date_fin        DATE,
    prime_mensuelle NUMERIC(15,2),
    actif           BOOLEAN       DEFAULT TRUE,
    caisse_id       UUID          REFERENCES caisses(id),
    notes           TEXT,
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    CONSTRAINT assurances_dates_ck CHECK (date_fin > date_debut)
);

-- 36. SESSIONS_UTILISATEURS
CREATE TABLE sessions_utilisateurs (
    id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    utilisateur_id  UUID        NOT NULL REFERENCES utilisateurs(id) ON DELETE CASCADE,
    token_hash      TEXT        NOT NULL,
    ip_address      INET,
    user_agent      TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at      TIMESTAMPTZ NOT NULL,
    revoked_at      TIMESTAMPTZ,
    CONSTRAINT sessions_token_uq UNIQUE (token_hash)
);

-- 37. AUDIT_LOG (immuable)
CREATE TABLE audit_log (
    id              BIGSERIAL    PRIMARY KEY,
    association_id  UUID         REFERENCES associations(id),
    utilisateur_id  UUID         REFERENCES utilisateurs(id),
    action          VARCHAR(50)  NOT NULL,
    table_name      VARCHAR(100) NOT NULL,
    record_id       UUID,
    valeur_avant    JSONB,
    valeur_apres    JSONB,
    ip_address      INET,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- 38. PERMISSIONS_ROLES (matrice RBAC)
CREATE TABLE permissions_roles (
    id         UUID             PRIMARY KEY DEFAULT uuid_generate_v4(),
    role       role_utilisateur NOT NULL,
    module     VARCHAR(100)     NOT NULL,
    action     VARCHAR(50)      NOT NULL,
    autorise   BOOLEAN          NOT NULL DEFAULT FALSE,
    conditions JSONB            DEFAULT '{}',
    CONSTRAINT permissions_role_module_action_uq UNIQUE (role, module, action)
);

-- 39. PARAMETRES_ASSOCIATION
CREATE TABLE parametres_association (
    id              UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
    association_id  UUID         NOT NULL REFERENCES associations(id) ON DELETE CASCADE,
    cle             VARCHAR(200) NOT NULL,
    valeur          TEXT,
    valeur_json     JSONB,
    description     TEXT,
    modifiable      BOOLEAN      DEFAULT TRUE,
    updated_by      UUID         REFERENCES utilisateurs(id),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT parametres_cle_asso_uq UNIQUE (association_id, cle)
);

-- ============================================================================
-- INDEX DE PERFORMANCE (55+)
-- ============================================================================

-- Associations
CREATE INDEX idx_associations_actif        ON associations(actif) WHERE actif = TRUE;

-- Membres
CREATE INDEX idx_membres_asso              ON membres(association_id);
CREATE INDEX idx_membres_statut            ON membres(association_id, statut);
CREATE INDEX idx_membres_telephone         ON membres(telephone);
CREATE INDEX idx_membres_deleted           ON membres(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_membres_search            ON membres USING gin(
    to_tsvector('french', unaccent(nom || ' ' || prenom))
);

-- Postes
CREATE INDEX idx_postes_asso               ON postes(association_id);
CREATE INDEX idx_membre_postes_membre      ON membre_postes(membre_id);
CREATE INDEX idx_membre_postes_actif       ON membre_postes(est_actif) WHERE est_actif = TRUE;

-- Utilisateurs
CREATE INDEX idx_utilisateurs_membre       ON utilisateurs(membre_id);
CREATE INDEX idx_utilisateurs_email        ON utilisateurs(email);
CREATE INDEX idx_utilisateurs_role         ON utilisateurs(role);

-- Réunions
CREATE INDEX idx_reunions_asso             ON reunions(association_id);
CREATE INDEX idx_reunions_date             ON reunions(association_id, date_reunion DESC);
CREATE INDEX idx_reunions_statut           ON reunions(statut);

-- Présences
CREATE INDEX idx_presences_reunion         ON presences(reunion_id);
CREATE INDEX idx_presences_membre          ON presences(membre_id);
CREATE INDEX idx_presences_statut          ON presences(statut);

-- ODJ
CREATE INDEX idx_odj_items_reunion         ON ordre_du_jour_items(reunion_id);
CREATE INDEX idx_odj_items_rapporteur      ON ordre_du_jour_items(rapporteur_id);

-- Tontines
CREATE INDEX idx_tontines_asso             ON tontines(association_id);
CREATE INDEX idx_tontines_statut           ON tontines(statut);
CREATE INDEX idx_tontines_caisse           ON tontines(caisse_id);

-- Parts
CREATE INDEX idx_parts_tontine             ON tontine_parts(tontine_id);
CREATE INDEX idx_parts_membre              ON tontine_parts(membre_id);
CREATE INDEX idx_parts_statut              ON tontine_parts(tontine_id, statut);
CREATE INDEX idx_parts_avaliste            ON tontine_parts(avaliste_id) WHERE avaliste_id IS NOT NULL;

-- Cycles
CREATE INDEX idx_cycles_tontine            ON cycles_tontine(tontine_id);
CREATE INDEX idx_cycles_reunion            ON cycles_tontine(reunion_id);
CREATE INDEX idx_cycles_statut             ON cycles_tontine(statut);
CREATE INDEX idx_cycles_gagnant            ON cycles_tontine(gagnant_part_id) WHERE gagnant_part_id IS NOT NULL;

-- Cotisations
CREATE INDEX idx_cotisations_cycle         ON cotisations_tontine(cycle_id);
CREATE INDEX idx_cotisations_membre        ON cotisations_tontine(membre_id);
CREATE INDEX idx_cotisations_statut        ON cotisations_tontine(statut);
CREATE INDEX idx_cotisations_part          ON cotisations_tontine(tontine_part_id);

-- Bulletins
CREATE INDEX idx_bulletins_cycle           ON bulletins_gain(cycle_id);
CREATE INDEX idx_bulletins_membre          ON bulletins_gain(gagnant_membre_id);
CREATE INDEX idx_bulletins_statut          ON bulletins_gain(statut);
CREATE INDEX idx_retenues_bulletin         ON retenues_bulletin(bulletin_id);

-- Caisses & Transactions
CREATE INDEX idx_caisses_asso              ON caisses(association_id);
CREATE INDEX idx_caisses_type              ON caisses(type);
CREATE INDEX idx_transactions_caisse       ON transactions(caisse_id);
CREATE INDEX idx_transactions_date         ON transactions(caisse_id, date_transaction DESC);
CREATE INDEX idx_transactions_type         ON transactions(type);
CREATE INDEX idx_transactions_reference    ON transactions(reference_type, reference_id)
    WHERE reference_id IS NOT NULL;

-- Prêts & Échéances
CREATE INDEX idx_prets_caisse              ON prets(caisse_id);
CREATE INDEX idx_prets_emprunteur          ON prets(emprunteur_id);
CREATE INDEX idx_prets_statut              ON prets(statut);
CREATE INDEX idx_prets_en_retard           ON prets(emprunteur_id)
    WHERE statut IN ('en_retard','defaut');
CREATE INDEX idx_echeances_pret            ON echeances_pret(pret_id);
CREATE INDEX idx_echeances_date            ON echeances_pret(date_echeance);
CREATE INDEX idx_echeances_dues            ON echeances_pret(date_echeance, statut)
    WHERE statut IN ('due','en_retard','penalisee');

-- Sanctions
CREATE INDEX idx_sanctions_membre          ON sanctions_membres(membre_id);
CREATE INDEX idx_sanctions_asso            ON sanctions_membres(association_id);
CREATE INDEX idx_sanctions_dues            ON sanctions_membres(membre_id) WHERE statut = 'due';

-- Social & Décisions
CREATE INDEX idx_evenements_membre         ON evenements_sociaux(membre_id);
CREATE INDEX idx_evenements_statut         ON evenements_sociaux(statut);
CREATE INDEX idx_decisions_ag_reunion      ON decisions_ag(reunion_id);
CREATE INDEX idx_decisions_ag_statut       ON decisions_ag(statut);

-- Audit & Notifications
CREATE INDEX idx_audit_asso                ON audit_log(association_id, created_at DESC);
CREATE INDEX idx_audit_table               ON audit_log(table_name, record_id);
CREATE INDEX idx_notifications_statut      ON notifications(statut, programmee_a)
    WHERE statut = 'en_attente';

-- ============================================================================
-- ROW-LEVEL SECURITY
-- ============================================================================

ALTER TABLE associations        ENABLE ROW LEVEL SECURITY;
ALTER TABLE membres             ENABLE ROW LEVEL SECURITY;
ALTER TABLE reunions            ENABLE ROW LEVEL SECURITY;
ALTER TABLE tontines            ENABLE ROW LEVEL SECURITY;
ALTER TABLE caisses             ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE prets               ENABLE ROW LEVEL SECURITY;
ALTER TABLE sanctions_membres   ENABLE ROW LEVEL SECURITY;

-- Politique d'isolation par association (variable SET par l'application)
-- Usage : SET tontine.current_association_id = '<uuid>';
CREATE POLICY pol_membres_asso    ON membres
    USING (association_id = current_setting('tontine.current_association_id')::UUID);
CREATE POLICY pol_reunions_asso   ON reunions
    USING (association_id = current_setting('tontine.current_association_id')::UUID);
CREATE POLICY pol_tontines_asso   ON tontines
    USING (association_id = current_setting('tontine.current_association_id')::UUID);
CREATE POLICY pol_caisses_asso    ON caisses
    USING (association_id = current_setting('tontine.current_association_id')::UUID);
CREATE POLICY pol_sanctions_asso  ON sanctions_membres
    USING (association_id = current_setting('tontine.current_association_id')::UUID);


-- ******************************
-- Partie 5 — Triggers, Vues & Seed
-- ============================================================================
--  TONTINEAPP — Schéma PostgreSQL 16  |  Partie 5/5
--  Fonctions PL/pgSQL · Triggers · Vues · Données de démarrage
-- ============================================================================

-- ============================================================================
-- FONCTIONS & TRIGGERS
-- ============================================================================

-- F-01 : updated_at automatique
CREATE OR REPLACE FUNCTION fn_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := NOW(); RETURN NEW; END;
$$;

DO $$ DECLARE t TEXT; BEGIN
  FOREACH t IN ARRAY ARRAY[
    'associations','postes','membres','utilisateurs',
    'reunions','presences','ordre_du_jour_items',
    'tontines','tontine_parts','cycles_tontine',
    'cotisations_tontine','bulletins_gain',
    'caisses','prets','echeances_pret',
    'types_sanction','sanctions_membres',
    'types_aide_sociale','evenements_sociaux','decisions_ag'
  ] LOOP
    EXECUTE format(
      'CREATE TRIGGER trg_%s_updated_at
       BEFORE UPDATE ON %s
       FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at()', t, t);
  END LOOP;
END; $$;

-- F-02 : Solde caisse — recalcul avant INSERT transaction
CREATE OR REPLACE FUNCTION fn_maj_solde_caisse()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE v_delta NUMERIC(15,2);
BEGIN
    v_delta := CASE WHEN NEW.type IN ('entree','transfert_entrant','ajustement')
                    THEN NEW.montant ELSE -NEW.montant END;
    IF (SELECT solde_actuel FROM caisses WHERE id = NEW.caisse_id) + v_delta < 0 THEN
        RAISE EXCEPTION 'Solde insuffisant dans la caisse (id: %)', NEW.caisse_id;
    END IF;
    SELECT solde_actuel INTO NEW.solde_avant FROM caisses WHERE id = NEW.caisse_id;
    NEW.solde_apres := NEW.solde_avant + v_delta;
    UPDATE caisses SET solde_actuel = NEW.solde_apres, updated_at = NOW()
    WHERE id = NEW.caisse_id;
    RETURN NEW;
END; $$;

CREATE TRIGGER trg_transactions_solde
BEFORE INSERT ON transactions
FOR EACH ROW EXECUTE FUNCTION fn_maj_solde_caisse();

-- F-03 : Recalcul collecte réelle du cycle
CREATE OR REPLACE FUNCTION fn_recalc_collecte_cycle()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    UPDATE cycles_tontine
    SET montant_collecte_reel = (
        SELECT COALESCE(SUM(montant_verse),0) FROM cotisations_tontine WHERE cycle_id = NEW.cycle_id
    ), updated_at = NOW() WHERE id = NEW.cycle_id;
    RETURN NEW;
END; $$;

CREATE TRIGGER trg_cotisations_recalc_cycle
AFTER INSERT OR UPDATE ON cotisations_tontine
FOR EACH ROW EXECUTE FUNCTION fn_recalc_collecte_cycle();

-- F-04 : Statut cotisation selon montant versé
CREATE OR REPLACE FUNCTION fn_maj_statut_cotisation()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF    NEW.montant_verse <= 0              THEN NEW.statut := 'impayee';
    ELSIF NEW.montant_verse < NEW.montant_du  THEN NEW.statut := 'partielle';
    ELSE  NEW.statut := 'payee'; NEW.date_versement := COALESCE(NEW.date_versement, NOW());
    END IF;
    RETURN NEW;
END; $$;

CREATE TRIGGER trg_cotisations_statut
BEFORE INSERT OR UPDATE OF montant_verse ON cotisations_tontine
FOR EACH ROW EXECUTE FUNCTION fn_maj_statut_cotisation();

-- F-05 : Génération tableau d'amortissement (linéaire)
CREATE OR REPLACE FUNCTION fn_generer_amortissement(p_pret_id UUID)
RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE
    v_pret        prets%ROWTYPE;
    v_cap_rem     NUMERIC(15,2);
    v_cap_ech     NUMERIC(15,2);
    v_int_ech     NUMERIC(15,2);
    i             SMALLINT;
BEGIN
    SELECT * INTO v_pret FROM prets WHERE id = p_pret_id;
    DELETE FROM echeances_pret WHERE pret_id = p_pret_id;
    v_cap_rem := v_pret.montant_principal;
    FOR i IN 1..v_pret.nb_echeances LOOP
        v_cap_ech := ROUND(v_pret.montant_principal / v_pret.nb_echeances, 2);
        IF i = v_pret.nb_echeances THEN v_cap_ech := v_cap_rem; END IF;
        v_int_ech := ROUND(v_cap_rem * v_pret.taux_interet_mensuel, 2);
        INSERT INTO echeances_pret (
            pret_id, numero_echeance, date_echeance,
            montant_capital, montant_interet, montant_total,
            capital_restant_apres, statut
        ) VALUES (
            p_pret_id, i, v_pret.date_debut + (i * INTERVAL '1 month'),
            v_cap_ech, v_int_ech, v_cap_ech + v_int_ech,
            v_cap_rem - v_cap_ech, 'a_venir'
        );
        v_cap_rem := v_cap_rem - v_cap_ech;
    END LOOP;
END; $$;

CREATE OR REPLACE FUNCTION fn_trg_amortissement()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.statut = 'en_cours' AND (OLD.statut IS NULL OR OLD.statut <> 'en_cours') THEN
        PERFORM fn_generer_amortissement(NEW.id);
    END IF;
    RETURN NEW;
END; $$;

CREATE TRIGGER trg_prets_amortissement
AFTER INSERT OR UPDATE OF statut ON prets
FOR EACH ROW EXECUTE FUNCTION fn_trg_amortissement();

-- F-06 : MAJ capital restant après remboursement
CREATE OR REPLACE FUNCTION fn_maj_pret_remboursement()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    UPDATE prets SET
        montant_rembourse = (SELECT COALESCE(SUM(montant_verse),0) FROM echeances_pret WHERE pret_id = NEW.pret_id),
        capital_restant   = (SELECT COALESCE(capital_restant_apres,0) FROM echeances_pret WHERE pret_id = NEW.pret_id ORDER BY numero_echeance DESC LIMIT 1),
        updated_at = NOW()
    WHERE id = NEW.pret_id;
    UPDATE prets SET statut = 'solde', date_solde = CURRENT_DATE
    WHERE id = NEW.pret_id AND capital_restant <= 0 AND statut NOT IN ('solde','refuse');
    RETURN NEW;
END; $$;

CREATE TRIGGER trg_echeances_maj_pret
AFTER UPDATE OF montant_verse ON echeances_pret
FOR EACH ROW EXECUTE FUNCTION fn_maj_pret_remboursement();

-- F-07 : Sanction auto — retard cotisation
CREATE OR REPLACE FUNCTION fn_sanction_retard_cotisation()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE v_ts RECORD; v_montant NUMERIC(15,2); v_asso UUID;
BEGIN
    IF NEW.statut NOT IN ('en_retard','impayee') OR OLD.statut = NEW.statut THEN RETURN NEW; END IF;
    SELECT t.association_id INTO v_asso FROM tontines t
    JOIN tontine_parts tp ON tp.tontine_id = t.id AND tp.id = NEW.tontine_part_id LIMIT 1;
    SELECT * INTO v_ts FROM types_sanction
    WHERE association_id = v_asso AND est_automatique = TRUE AND declencheur = 'retard_cotisation' AND actif LIMIT 1;
    IF FOUND THEN
        v_montant := CASE v_ts.mode_calcul
            WHEN 'fixe'        THEN v_ts.montant_fixe
            WHEN 'pourcentage' THEN ROUND(NEW.montant_du * v_ts.montant_pct, 2)
            WHEN 'journalier'  THEN v_ts.montant_journalier * 1
        END;
        IF v_montant > 0 THEN
            INSERT INTO sanctions_membres (association_id, membre_id, type_sanction_id, montant, motif, statut, est_automatique, reference_type, reference_id)
            VALUES (v_asso, NEW.membre_id, v_ts.id, v_montant, 'Retard cotisation automatique', 'due', TRUE, 'cotisation_tontine', NEW.id)
            ON CONFLICT DO NOTHING;
        END IF;
    END IF;
    RETURN NEW;
END; $$;

CREATE TRIGGER trg_cotisations_sanction
AFTER UPDATE OF statut ON cotisations_tontine
FOR EACH ROW EXECUTE FUNCTION fn_sanction_retard_cotisation();

-- F-08 : Sanction auto — absence non excusée
CREATE OR REPLACE FUNCTION fn_sanction_absence()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE v_ts RECORD; v_asso UUID;
BEGIN
    IF NEW.statut <> 'absent' OR (OLD.statut IS NOT NULL AND OLD.statut = 'absent') THEN RETURN NEW; END IF;
    SELECT association_id INTO v_asso FROM reunions WHERE id = NEW.reunion_id;
    SELECT * INTO v_ts FROM types_sanction
    WHERE association_id = v_asso AND est_automatique AND declencheur = 'absence_non_excusee' AND actif LIMIT 1;
    IF FOUND AND COALESCE(v_ts.montant_fixe,0) > 0 THEN
        INSERT INTO sanctions_membres (association_id, membre_id, type_sanction_id, reunion_id, montant, motif, statut, est_automatique, reference_type, reference_id)
        VALUES (v_asso, NEW.membre_id, v_ts.id, NEW.reunion_id, v_ts.montant_fixe, 'Absence non excusée', 'due', TRUE, 'presence', NEW.id)
        ON CONFLICT DO NOTHING;
    END IF;
    RETURN NEW;
END; $$;

CREATE TRIGGER trg_presences_sanction
AFTER INSERT OR UPDATE OF statut ON presences
FOR EACH ROW EXECUTE FUNCTION fn_sanction_absence();

-- F-09 : Recalcul bulletin de gain
CREATE OR REPLACE FUNCTION fn_recalc_bulletin()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE v_bid UUID; v_brut NUMERIC(15,2); v_ret NUMERIC(15,2);
BEGIN
    v_bid := CASE TG_OP WHEN 'DELETE' THEN OLD.bulletin_id ELSE NEW.bulletin_id END;
    SELECT montant_brut INTO v_brut FROM bulletins_gain WHERE id = v_bid;
    SELECT COALESCE(SUM(montant),0) INTO v_ret FROM retenues_bulletin WHERE bulletin_id = v_bid;
    UPDATE bulletins_gain SET total_retenues = v_ret, montant_net = v_brut - v_ret, updated_at = NOW() WHERE id = v_bid;
    RETURN NEW;
END; $$;

CREATE TRIGGER trg_retenues_recalc
AFTER INSERT OR UPDATE OR DELETE ON retenues_bulletin
FOR EACH ROW EXECUTE FUNCTION fn_recalc_bulletin();

-- F-10 : Alerte solde bas
CREATE OR REPLACE FUNCTION fn_alerte_solde_bas()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.seuil_alerte_bas IS NOT NULL AND NEW.solde_actuel < NEW.seuil_alerte_bas
       AND (OLD.solde_actuel IS NULL OR OLD.solde_actuel >= NEW.seuil_alerte_bas) THEN
        INSERT INTO notifications (association_id, type_evenement, canal, sujet, contenu, programmee_a)
        VALUES (NEW.association_id, 'alerte_solde_bas', 'email',
            'Alerte solde bas — ' || NEW.libelle,
            'Solde ' || NEW.solde_actuel || ' FCFA < seuil ' || NEW.seuil_alerte_bas || ' FCFA', NOW());
    END IF;
    RETURN NEW;
END; $$;

CREATE TRIGGER trg_caisses_alerte
AFTER UPDATE OF solde_actuel ON caisses
FOR EACH ROW EXECUTE FUNCTION fn_alerte_solde_bas();

-- F-11 : Audit log automatique (tables financières)
CREATE OR REPLACE FUNCTION fn_audit_log()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    INSERT INTO audit_log (table_name, record_id, action, valeur_avant, valeur_apres)
    VALUES (TG_TABLE_NAME,
        CASE TG_OP WHEN 'DELETE' THEN OLD.id ELSE NEW.id END,
        TG_OP,
        CASE TG_OP WHEN 'INSERT' THEN NULL ELSE to_jsonb(OLD) END,
        CASE TG_OP WHEN 'DELETE' THEN NULL ELSE to_jsonb(NEW) END);
    RETURN NULL;
END; $$;

CREATE TRIGGER trg_audit_transactions  AFTER INSERT OR UPDATE OR DELETE ON transactions  FOR EACH ROW EXECUTE FUNCTION fn_audit_log();
CREATE TRIGGER trg_audit_bulletins     AFTER INSERT OR UPDATE OR DELETE ON bulletins_gain FOR EACH ROW EXECUTE FUNCTION fn_audit_log();
CREATE TRIGGER trg_audit_prets         AFTER INSERT OR UPDATE OR DELETE ON prets          FOR EACH ROW EXECUTE FUNCTION fn_audit_log();
CREATE TRIGGER trg_audit_sanctions     AFTER INSERT OR UPDATE OR DELETE ON sanctions_membres FOR EACH ROW EXECUTE FUNCTION fn_audit_log();
CREATE TRIGGER trg_audit_membres       AFTER UPDATE OR DELETE ON membres                  FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

-- ============================================================================
-- VUES UTILITAIRES
-- ============================================================================

CREATE OR REPLACE VIEW vue_situation_membre AS
SELECT m.id AS membre_id, m.association_id,
    m.nom || ' ' || m.prenom AS nom_complet, m.statut,
    COUNT(DISTINCT tp.id) AS nb_parts,
    COALESCE(SUM(bg.montant_net) FILTER (WHERE bg.statut='paye'), 0) AS total_gains,
    COALESCE((SELECT SUM(montant_verse) FROM cotisations_tontine WHERE membre_id = m.id), 0) AS total_cotisations,
    COALESCE((SELECT SUM(capital_restant) FROM prets WHERE emprunteur_id = m.id AND statut IN ('en_cours','en_retard','defaut')), 0) AS capital_restant_prets,
    COALESCE((SELECT SUM(montant) FROM sanctions_membres WHERE membre_id = m.id AND statut = 'due'), 0) AS sanctions_dues
FROM membres m
LEFT JOIN tontine_parts tp ON tp.membre_id = m.id
LEFT JOIN bulletins_gain bg ON bg.gagnant_membre_id = m.id
WHERE m.deleted_at IS NULL
GROUP BY m.id, m.association_id, m.nom, m.prenom, m.statut;

CREATE OR REPLACE VIEW vue_prets_en_retard AS
SELECT p.id, ca.association_id,
    m.nom || ' ' || m.prenom AS emprunteur, m.telephone,
    cai.libelle AS caisse, p.montant_principal, p.capital_restant, p.statut,
    MIN(e.date_echeance) AS premiere_echeance_retard,
    COUNT(e.id) AS nb_echeances_retard,
    SUM(e.montant_total - e.montant_verse) AS montant_retard_total,
    CURRENT_DATE - MIN(e.date_echeance) AS jours_retard_max
FROM prets p
JOIN membres m ON m.id = p.emprunteur_id
JOIN caisses cai ON cai.id = p.caisse_id
JOIN associations ca ON ca.id = cai.association_id
JOIN echeances_pret e ON e.pret_id = p.id AND e.statut IN ('en_retard','penalisee')
WHERE p.statut IN ('en_retard','defaut')
GROUP BY p.id, ca.association_id, m.nom, m.prenom, m.telephone, cai.libelle, p.montant_principal, p.capital_restant, p.statut;

CREATE OR REPLACE VIEW vue_etat_caisses AS
SELECT ca.id, ca.association_id, ca.libelle, ca.type, ca.solde_actuel,
    ca.seuil_alerte_bas,
    ca.solde_actuel < COALESCE(ca.seuil_alerte_bas, 0) AS en_alerte,
    COALESCE(SUM(t.montant) FILTER (WHERE t.type IN ('entree','transfert_entrant') AND NOT t.annulee), 0) AS total_entrees,
    COALESCE(SUM(t.montant) FILTER (WHERE t.type IN ('sortie','transfert_sortant') AND NOT t.annulee), 0) AS total_sorties,
    COUNT(p.id) FILTER (WHERE p.statut IN ('en_cours','en_retard')) AS nb_prets_actifs
FROM caisses ca
LEFT JOIN transactions t ON t.caisse_id = ca.id
LEFT JOIN prets p ON p.caisse_id = ca.id
WHERE ca.deleted_at IS NULL
GROUP BY ca.id, ca.association_id, ca.libelle, ca.type, ca.solde_actuel, ca.seuil_alerte_bas;

CREATE OR REPLACE VIEW vue_kpi_association AS
SELECT a.id, a.nom,
    COUNT(DISTINCT m.id) AS nb_membres_actifs,
    COUNT(DISTINCT t.id) FILTER (WHERE t.statut = 'active') AS nb_tontines_actives,
    COALESCE(SUM(ca.solde_actuel), 0) AS total_fonds,
    COUNT(DISTINCT p.id) FILTER (WHERE p.statut IN ('en_cours','en_retard')) AS nb_prets_actifs,
    COALESCE(SUM(sm.montant) FILTER (WHERE sm.statut = 'due'), 0) AS montant_sanctions_dues
FROM associations a
LEFT JOIN membres m ON m.association_id = a.id AND m.statut = 'actif'
LEFT JOIN tontines t ON t.association_id = a.id
LEFT JOIN caisses ca ON ca.association_id = a.id AND ca.actif
LEFT JOIN prets p ON p.caisse_id = ca.id
LEFT JOIN sanctions_membres sm ON sm.association_id = a.id
WHERE a.actif AND a.deleted_at IS NULL
GROUP BY a.id, a.nom;

-- ============================================================================
-- NOTE : les donnees de demonstration ont ete deplacees vers
-- database/seed_demo.sql, charge uniquement par
-- php artisan db:seed --class=Database\Seeders\DemoDataSeeder
-- et jamais automatiquement par cette migration ni en production.
-- ============================================================================


-- ============================================================================
-- FIN DU SCRIPT — TontineApp PostgreSQL 16
-- Récap : 33 tables · 27 ENUMs · 55+ index · 11 fonctions · 20 triggers · 4 vues
-- Ordre d'exécution : Partie 1 → 2 → 3 → 4 → 5
-- ============================================================================

-- ******