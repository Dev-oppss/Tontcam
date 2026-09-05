<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AideSocialeInitiale;
use App\Models\Caisse;
use App\Models\EcheancePret;
use App\Models\EpargneMouvement;
use App\Models\Membre;
use App\Models\Pret;
use App\Models\SanctionMembre;
use App\Models\TontinePart;
use App\Models\TypeSanction;
use App\Services\AccessScopeService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * "Initialisation" (RG-INIT, demande client) : pose un RÉSUMÉ — un point de
 * départ — pour un membre, sans reconstituer le détail des opérations qui y
 * ont mené (contrairement à l'import historique, voir ImportResolver).
 * Ex : "6000 FCFA de sanctions dues" au lieu des 3 cotisations manquées qui
 * l'expliquent.
 *
 * Couvre : sanctions (montant dû global + nombre d'absences déjà cumulées),
 * aide sociale (nombre d'aides déjà reçues par type, pour le plafond à
 * vie), cotisations/cagnotte (montant déjà accumulé par part), épargne
 * (solde de départ par caisse suivie), prêt en cours (montant restant dû +
 * prochaine échéance, sans reconstituer tout l'historique de
 * remboursement).
 */
class InitialisationMembreController extends Controller
{
    public function __construct(private AccessScopeService $scope) {}

    private const MOTIF_SANCTION_INITIALE = 'Solde initial (initialisation)';
    private const MOTIF_EPARGNE_INITIALE = 'Solde initial (initialisation)';
    private const NOTES_PRET_INITIAL = 'Prêt initial (initialisation)';

    public function show(string $membreId): JsonResponse
    {
        $membre = $this->scope->scopeAssociation(Membre::query())->findOrFail($membreId);
        $this->authorize('view', $membre);

        $sanctionInitiale = SanctionMembre::where('membre_id', $membre->id)->where('motif', self::MOTIF_SANCTION_INITIALE)->first();

        $pretInitial = Pret::where('emprunteur_id', $membre->id)->where('notes', self::NOTES_PRET_INITIAL)
            ->whereIn('statut', ['en_cours', 'en_retard'])->with('echeances')->first();

        return response()->json([
            'absences_cumulees_initiales' => $membre->absences_cumulees_initiales,
            'sanction_montant_du' => $sanctionInitiale ? (float) $sanctionInitiale->montant : 0,
            'aides' => AideSocialeInitiale::where('membre_id', $membre->id)->get(['type_aide_id', 'nombre_deja_recu']),
            // Toutes les parts du membre (pas seulement celles déjà initialisées) pour que
            // le formulaire puisse afficher un champ par part avec le bon tontine_part_id.
            'parts' => TontinePart::where('membre_id', $membre->id)->with('tontine:id,libelle')
                ->get(['id', 'tontine_id', 'numero_part', 'montant_accumule_initial'])
                ->map(fn ($p) => ['tontine_part_id' => $p->id, 'tontine_id' => $p->tontine_id, 'tontine_nom' => $p->tontine?->libelle, 'numero_part' => $p->numero_part, 'montant_accumule_initial' => (float) $p->montant_accumule_initial]),
            // Toutes les caisses suivant l'épargne (pas seulement celles déjà initialisées)
            // pour que le formulaire propose un champ par caisse épargne existante.
            'caisses_epargne' => Caisse::where('association_id', $membre->association_id)->where('suivi_epargne', true)
                ->get(['id', 'libelle'])
                ->map(function ($c) use ($membre) {
                    $mouvement = EpargneMouvement::where('caisse_id', $c->id)->where('membre_id', $membre->id)->where('motif', self::MOTIF_EPARGNE_INITIALE)->first();
                    return ['caisse_id' => $c->id, 'caisse_nom' => $c->libelle, 'solde_initial' => $mouvement ? (float) $mouvement->montant : 0];
                }),
            'pret_en_cours' => $pretInitial ? [
                'caisse_id' => $pretInitial->caisse_id,
                'montant_restant_du' => (float) $pretInitial->capital_restant,
                'taux_interet_mensuel' => (float) $pretInitial->taux_interet_mensuel,
                'date_prochaine_echeance' => $pretInitial->echeances->first()?->date_echeance,
            ] : null,
        ]);
    }

    public function store(Request $request, string $membreId): JsonResponse
    {
        $membre = $this->scope->scopeAssociation(Membre::query())->findOrFail($membreId);
        $this->authorize('update', $membre);

        if ($request->user()->role !== 'super_admin') {
            return response()->json(['message' => 'Réservé au super_admin.'], 403);
        }

        $data = $request->validate([
            'absences_cumulees' => ['nullable', 'integer', 'min:0'],
            'sanction_montant_du' => ['nullable', 'numeric', 'min:0'],
            'aides' => ['nullable', 'array'],
            'aides.*.type_aide_id' => ['required_with:aides', 'uuid'],
            'aides.*.nombre_deja_recu' => ['required_with:aides', 'integer', 'min:0'],
            'cotisations' => ['nullable', 'array'],
            'cotisations.*.tontine_part_id' => ['required_with:cotisations', 'uuid'],
            'cotisations.*.montant_initial' => ['required_with:cotisations', 'numeric', 'min:0'],
            'epargne' => ['nullable', 'array'],
            'epargne.*.caisse_id' => ['required_with:epargne', 'uuid'],
            'epargne.*.solde_initial' => ['required_with:epargne', 'numeric', 'min:0'],
            'pret_en_cours' => ['nullable', 'array'],
            'pret_en_cours.caisse_id' => ['required_with:pret_en_cours', 'uuid'],
            'pret_en_cours.montant_restant_du' => ['required_with:pret_en_cours', 'numeric', 'min:0'],
            'pret_en_cours.taux_interet_mensuel' => ['nullable', 'numeric', 'min:0'],
            'pret_en_cours.date_prochaine_echeance' => ['required_with:pret_en_cours', 'date'],
        ]);

        DB::transaction(function () use ($membre, $data) {
            if (array_key_exists('absences_cumulees', $data)) {
                $membre->update(['absences_cumulees_initiales' => $data['absences_cumulees'] ?? 0]);
            }

            if (array_key_exists('sanction_montant_du', $data)) {
                $montant = (float) ($data['sanction_montant_du'] ?? 0);
                $existante = SanctionMembre::where('membre_id', $membre->id)->where('motif', self::MOTIF_SANCTION_INITIALE)->first();
                if ($montant <= 0) {
                    $existante?->delete();
                } elseif ($existante) {
                    $existante->update(['montant' => $montant]);
                } else {
                    $type = TypeSanction::firstOrCreate(
                        ['association_id' => $membre->association_id, 'libelle' => 'Solde initial'],
                        ['mode_calcul' => 'fixe', 'montant_fixe' => 0, 'est_automatique' => false, 'actif' => true]
                    );
                    SanctionMembre::create([
                        'association_id' => $membre->association_id,
                        'membre_id' => $membre->id,
                        'type_sanction_id' => $type->id,
                        'montant' => $montant,
                        'motif' => self::MOTIF_SANCTION_INITIALE,
                        'statut' => 'due',
                        'est_automatique' => false,
                    ]);
                }
            }

            foreach ($data['aides'] ?? [] as $aide) {
                AideSocialeInitiale::updateOrCreate(
                    ['membre_id' => $membre->id, 'type_aide_id' => $aide['type_aide_id']],
                    ['nombre_deja_recu' => $aide['nombre_deja_recu'], 'updated_at' => now()]
                );
            }

            foreach ($data['cotisations'] ?? [] as $c) {
                TontinePart::where('membre_id', $membre->id)->where('id', $c['tontine_part_id'])
                    ->update(['montant_accumule_initial' => $c['montant_initial']]);
            }

            foreach ($data['epargne'] ?? [] as $e) {
                $montant = (float) $e['solde_initial'];
                $existant = EpargneMouvement::where('caisse_id', $e['caisse_id'])->where('membre_id', $membre->id)
                    ->where('motif', self::MOTIF_EPARGNE_INITIALE)->first();
                if ($montant <= 0) {
                    $existant?->delete();
                } elseif ($existant) {
                    $existant->update(['montant' => $montant]);
                } else {
                    EpargneMouvement::create([
                        'caisse_id' => $e['caisse_id'], 'membre_id' => $membre->id, 'type' => 'depot',
                        'montant' => $montant, 'motif' => self::MOTIF_EPARGNE_INITIALE,
                    ]);
                }
            }

            if (array_key_exists('pret_en_cours', $data)) {
                $this->enregistrerPretInitial($membre, $data['pret_en_cours'] ?? null);
            }
        });

        return $this->show($membre->id);
    }

    /**
     * Un seul "prêt initial" par membre à la fois (le cas courant : un membre
     * n'a en général qu'un seul prêt en cours). Crée directement le prêt en
     * statut en_cours avec UNE échéance restante — pas tout le tableau
     * d'amortissement historique — conformément à la philosophie
     * "résumé, pas reconstitution" de l'initialisation. Idempotent : renvoyer
     * un montant à 0 (ou omettre pret_en_cours dans le payload) supprime le
     * prêt initial existant s'il n'a encore reçu aucun remboursement réel.
     */
    private function enregistrerPretInitial(Membre $membre, ?array $data): void
    {
        $existant = Pret::where('emprunteur_id', $membre->id)->where('notes', self::NOTES_PRET_INITIAL)
            ->whereIn('statut', ['en_cours', 'en_retard'])->first();

        $montant = (float) ($data['montant_restant_du'] ?? 0);

        if (! $data || $montant <= 0) {
            if ($existant && (float) $existant->montant_rembourse <= 0) {
                $existant->echeances()->delete();
                $existant->delete();
            }
            return;
        }

        $caisse = Caisse::where('association_id', $membre->association_id)->findOrFail($data['caisse_id']);
        $taux = (float) ($data['taux_interet_mensuel'] ?? 0);
        $interet = round($montant * $taux, 2);

        if ($existant) {
            $pret = tap($existant)->update([
                'caisse_id' => $caisse->id, 'montant_principal' => $montant, 'taux_interet_mensuel' => $taux,
                'montant_total_du' => $montant + $interet, 'capital_restant' => $montant,
            ]);
            $pret->echeances()->delete();
        } else {
            $pret = Pret::create([
                'caisse_id' => $caisse->id, 'emprunteur_id' => $membre->id,
                'montant_principal' => $montant, 'taux_interet_mensuel' => $taux, 'taux_penalite_mensuel' => 0,
                'methode_amortissement' => 'lineaire', 'nb_echeances' => 1,
                'montant_echeance' => $montant + $interet, 'interet_total' => $interet,
                'montant_total_du' => $montant + $interet, 'montant_rembourse' => 0, 'capital_restant' => $montant,
                'statut' => 'en_cours', 'date_demande' => now()->toDateString(), 'date_debut' => now()->toDateString(),
                'date_fin_prevue' => $data['date_prochaine_echeance'],
                'notes' => self::NOTES_PRET_INITIAL,
            ]);
        }

        EcheancePret::create([
            'pret_id' => $pret->id, 'numero_echeance' => 1, 'date_echeance' => $data['date_prochaine_echeance'],
            'montant_capital' => $montant, 'montant_interet' => $interet, 'montant_total' => $montant + $interet,
            'montant_verse' => 0, 'statut' => 'a_venir',
        ]);
    }
}
