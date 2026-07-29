<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Caisse;
use App\Models\Pret;
use App\Models\Reunion;
use App\Models\SanctionMembre;
use App\Models\SeanceTransaction;
use App\Services\AccessScopeService;
use App\Services\CaisseService;
use App\Services\PretService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Journal des mouvements de caisse saisis en direct pendant une réunion
 * (cotisations, paiements de sanction, dépôts...). Chaque entrée avec une
 * caisse associée génère une vraie Transaction (comptabilité cohérente,
 * pas un simple journal parallèle déconnecté des soldes réels).
 */
class SeanceTransactionController extends Controller
{
    private const TYPES_SORTIE = ['attribution_tour', 'divers_sortie', 'pret_accorde', 'aide_sociale'];

    public function __construct(
        private AccessScopeService $scope,
        private CaisseService $caisseService,
        private PretService $pretService,
    ) {}

    public function index(string $reunionId): JsonResponse
    {
        $reunion = $this->scope->scopeAssociation(Reunion::query())->findOrFail($reunionId);

        return response()->json($reunion->seanceTransactions()->with('membre')->latest()->get());
    }

    public function store(Request $request, string $reunionId): JsonResponse
    {
        $reunion = $this->scope->scopeAssociation(Reunion::query())->findOrFail($reunionId);

        $data = $request->validate([
            'type' => ['required', 'in:cotisation,remboursement_pret,paiement_sanction,amende,depot_banque,attribution_tour,divers_entree,divers_sortie,pret_accorde,aide_sociale'],
            'membre_id' => ['nullable', 'uuid'],
            'montant' => ['required', 'numeric', 'min:0.01'],
            'libelle' => ['nullable', 'string', 'max:300'],
            'reference_sanction_id' => ['nullable', 'uuid'],
            'reference_pret_id' => ['nullable', 'uuid', 'required_if:type,remboursement_pret'],
            'caisse_id' => ['nullable', 'uuid', 'required_unless:type,remboursement_pret'],
            'note' => ['nullable', 'string'],
        ]);

        try {
            return DB::transaction(function () use ($reunion, $data, $request) {
                $estRemboursementPret = $data['type'] === 'remboursement_pret';

                // Remboursement de prêt : le mouvement de caisse ET la mise à jour des
                // échéances/capital_restant sont entièrement pris en charge par
                // PretService::rembourserLibre() (répartit le montant sur les échéances
                // impayées, dans l'ordre). On NE crée PAS un second mouvement de caisse
                // ci-dessous pour ce type — ce serait compter le même argent deux fois.
                if ($estRemboursementPret) {
                    $pret = Pret::whereHas('caisse', fn ($q) => $this->scope->scopeAssociation($q))
                        ->findOrFail($data['reference_pret_id']);
                    $this->pretService->rembourserLibre($pret, (float) $data['montant'], $request->user());
                    // Le journal de séance reflète toujours le prêt réel, pas un choix
                    // de caisse potentiellement différent saisi par erreur à l'écran.
                    $data['caisse_id'] = $pret->caisse_id;
                }

                $seance = SeanceTransaction::create([
                    ...$data,
                    'reunion_id' => $reunion->id,
                    'created_by' => $request->user()->id,
                ]);

                // Si une caisse est renseignée, on répercute réellement le mouvement (books
                // cohérents) — sauf remboursement_pret, déjà traité ci-dessus.
                if (!$estRemboursementPret && !empty($data['caisse_id'])) {
                    $caisse = Caisse::findOrFail($data['caisse_id']);
                    $libelle = $data['libelle'] ?: "Séance du {$reunion->date_reunion} — {$data['type']}";
                    $sens = in_array($data['type'], self::TYPES_SORTIE, true) ? 'sortie' : 'entree';

                    $this->caisseService->{$sens}($caisse, (float) $data['montant'], $libelle, [
                        'reference_type' => 'seance_transaction',
                        'reference_id' => $seance->id,
                        'created_by' => $request->user()->id,
                        'valide_par' => $request->user()->id,
                    ]);
                }

                // Paiement de sanction : on marque la sanction réglée en cohérence.
                if (!empty($data['reference_sanction_id'])) {
                    SanctionMembre::where('id', $data['reference_sanction_id'])->update([
                        'statut' => 'payee', 'payee_at' => now(),
                    ]);
                }

                return response()->json($seance->load('membre'), 201);
            });
        } catch (\RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }
    }

    public function destroy(string $reunionId, string $id): JsonResponse
    {
        $seance = SeanceTransaction::where('reunion_id', $reunionId)
            ->whereHas('reunion', fn ($q) => $this->scope->scopeAssociation($q))
            ->findOrFail($id);

        // Ne supprime que l'entrée du journal — ne défait pas une transaction de caisse déjà validée
        // (RG-CAI : jamais de suppression silencieuse d'un mouvement financier). Utiliser un ajustement sinon.
        if ($seance->caisse_id) {
            return response()->json(['message' => 'Cette entrée a généré un mouvement de caisse réel — utilisez un ajustement plutôt qu\'une suppression.'], 422);
        }

        $seance->delete();

        return response()->json(['deleted' => true]);
    }
}
