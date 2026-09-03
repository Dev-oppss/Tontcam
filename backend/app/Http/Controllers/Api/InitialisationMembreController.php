<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AideSocialeInitiale;
use App\Models\Membre;
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
 * vie), cotisations/cagnotte (montant déjà accumulé par part). L'épargne
 * est volontairement absente pour l'instant (pas encore de module dédié —
 * à faire plus tard).
 */
class InitialisationMembreController extends Controller
{
    public function __construct(private AccessScopeService $scope) {}

    private const MOTIF_SANCTION_INITIALE = 'Solde initial (initialisation)';

    public function show(string $membreId): JsonResponse
    {
        $membre = $this->scope->scopeAssociation(Membre::query())->findOrFail($membreId);
        $this->authorize('view', $membre);

        $sanctionInitiale = SanctionMembre::where('membre_id', $membre->id)->where('motif', self::MOTIF_SANCTION_INITIALE)->first();

        return response()->json([
            'absences_cumulees_initiales' => $membre->absences_cumulees_initiales,
            'sanction_montant_du' => $sanctionInitiale ? (float) $sanctionInitiale->montant : 0,
            'aides' => AideSocialeInitiale::where('membre_id', $membre->id)->get(['type_aide_id', 'nombre_deja_recu']),
            // Toutes les parts du membre (pas seulement celles déjà initialisées) pour que
            // le formulaire puisse afficher un champ par part avec le bon tontine_part_id.
            'parts' => TontinePart::where('membre_id', $membre->id)->with('tontine:id,libelle')
                ->get(['id', 'tontine_id', 'numero_part', 'montant_accumule_initial'])
                ->map(fn ($p) => ['tontine_part_id' => $p->id, 'tontine_id' => $p->tontine_id, 'tontine_nom' => $p->tontine?->libelle, 'numero_part' => $p->numero_part, 'montant_accumule_initial' => (float) $p->montant_accumule_initial]),
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
        });

        return $this->show($membre->id);
    }
}
