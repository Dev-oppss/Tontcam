<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * BUG CONFIRME ET REPRODUIT (PostgreSQL local) : le trigger fn_maj_solde_caisse()
 * traitait TOUT type='ajustement' comme une entrée (+montant), quel que soit le
 * sens réellement voulu par l'application. Or CaisseService::annuler() calcule et
 * envoie explicitement le bon solde_avant/solde_apres (ex: soustraction pour
 * contre-passer une cotisation annulée) — le trigger BEFORE INSERT écrasait ces
 * valeurs correctes avec son propre calcul erroné (toujours +montant), quel que
 * soit ce que l'application avait calculé.
 *
 * Effet observé : annuler une cotisation de 60000 stockait solde_apres =
 * solde_avant + 60000 au lieu de solde_avant - 60000 sur la ligne de transaction
 * elle-même (colonne figée, jamais corrigée depuis). Le VRAI solde de caisse
 * (caisses.solde_actuel) restait par chance correct, car le code PHP fait un
 * second UPDATE explicite juste après l'insertion qui écrase la valeur fausse du
 * trigger — mais les lignes "ajustement"/"Annulation ..." déjà en base gardent
 * pour toujours le mauvais solde_avant/solde_apres, et tout total agrégé qui se
 * fie à ces colonnes (comme les KPI Entrées/Sorties) reste faux.
 *
 * Correction : pour type='ajustement', on ne recalcule plus le sens — on fait
 * confiance à solde_avant/solde_apres déjà fournis par l'application (seule à
 * connaître le sens réel d'une contre-passation), on vérifie juste qu'ils sont
 * bien fournis et qu'ils ne donnent pas un solde négatif.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::unprepared("
            CREATE OR REPLACE FUNCTION tontine.fn_maj_solde_caisse()
            RETURNS trigger
            LANGUAGE plpgsql
            AS \$function\$
            DECLARE v_delta NUMERIC(15,2);
            BEGIN
                IF NEW.type = 'ajustement' THEN
                    IF NEW.solde_avant IS NULL OR NEW.solde_apres IS NULL THEN
                        RAISE EXCEPTION 'Une transaction de type ajustement doit fournir solde_avant et solde_apres explicitement';
                    END IF;
                    IF NEW.solde_apres < 0 THEN
                        RAISE EXCEPTION 'Solde insuffisant dans la caisse (id: %)', NEW.caisse_id;
                    END IF;
                    UPDATE caisses SET solde_actuel = NEW.solde_apres, updated_at = NOW()
                    WHERE id = NEW.caisse_id;
                    RETURN NEW;
                END IF;

                v_delta := CASE WHEN NEW.type IN ('entree','transfert_entrant')
                                THEN NEW.montant ELSE -NEW.montant END;
                IF (SELECT solde_actuel FROM caisses WHERE id = NEW.caisse_id) + v_delta < 0 THEN
                    RAISE EXCEPTION 'Solde insuffisant dans la caisse (id: %)', NEW.caisse_id;
                END IF;
                SELECT solde_actuel INTO NEW.solde_avant FROM caisses WHERE id = NEW.caisse_id;
                NEW.solde_apres := NEW.solde_avant + v_delta;
                UPDATE caisses SET solde_actuel = NEW.solde_apres, updated_at = NOW()
                WHERE id = NEW.caisse_id;
                RETURN NEW;
            END; \$function\$;
        ");
    }

    public function down(): void
    {
        DB::unprepared("
            CREATE OR REPLACE FUNCTION tontine.fn_maj_solde_caisse()
            RETURNS trigger
            LANGUAGE plpgsql
            AS \$function\$
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
            END; \$function\$;
        ");
    }
};
