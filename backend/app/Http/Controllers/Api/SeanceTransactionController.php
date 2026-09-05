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
use App\Http\Controllers\Api\Concerns\AssertSeanceOuverte;

/**
 * Journal des mouvements de caisse saisis en direct pendant une réunion
 * (cotisations, paiements de sanction, dépôts...). Chaque entrée avec une
 * caisse associée génère une vraie Transaction (comptabilité cohérente,
 * pas un simple journal parallèle déconnecté des soldes réels).
 */
class SeanceTransactionController extends Controller
{
    use AssertSeanceOuverte;

    private const TYPES_SORTIE = ['attribution_tour', 'divers_sortie', 'pret_accorde', 'aide_sociale'];

    public function __construct(
        private AccessScopeService $scope,
        private CaisseService $caisseService,
        private PretService $pretService,
    ) {}

    public function index(string $reunionId): JsonResponse
    {
        $reunion = $this->scope->scopeAssociation(Reunion::query())->findOrFail($reunionId);
        $this->authorize('view', $reunion);

        return response()->json($reunion->seanceTransactions()->where('annulee', false)->with(['membre', 'caisse'])->latest()->get());
    }

    public function store(Request $request, string $reunionId): JsonResponse
    {
        $reunion = $this->scope->scopeAssociation(Reunion::query())->findOrFail($reunionId);
        $this->authorize('update', $reunion);

        try {
            $this->assertSeanceOuverte($reunion);
        } catch (\RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        $data = $request->validate([
            'type' => ['required', 'in:cotisation,remboursement_pret,paiement_sanction,amende,depot_banque,attribution_tour,divers_entree,divers_sortie,pret_accorde,aide_sociale'],
            'membre_id' => ['nullable', 'uuid'],
            'montant' => ['required', 'numeric', 'min:0.01'],
            'libelle' => ['nullable', 'string', 'max:300'],
            'reference_sanction_id' => ['nullable', 'uuid'],
            'reference_pret_id' => ['nullable', 'uuid', 'required_if:type,remboursement_pret'],
            'caisse_id' => ['nullable', 'uuid', 'required_unless:type,remboursement_pret'],
            'cycle_tontine_id' => ['nullable', 'uuid'],
            'note' => ['nullable', 'string'],
        ]);

        // Si l'appelant rattache la saisie à un cycle (ex : cotisation validée
        // depuis la Feuille de cotisation), on vérifie que ce cycle est bien
        // dans le périmètre accessible avant de créer le lien — sans ça,
        // annulerCycleAvantVersement() ne pourra jamais retrouver ni
        // contre-passer cette transaction.
        if (!empty($data['cycle_tontine_id'])) {
            $cycleExiste = \App\Models\CycleTontine::whereHas('tontine', fn ($q) => $this->scope->scopeAssociation($q))
                ->whereKey($data['cycle_tontine_id'])->exists();
            if (!$cycleExiste) {
                return response()->json(['message' => 'Cycle de tontine introuvable.'], 422);
            }
        }

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
                    $this->authorize('update', $pret->caisse);
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
                    $caisse = $this->scope->scopeAssociation(Caisse::query())->findOrFail($data['caisse_id']);
                    $this->authorize('update', $caisse);
                    $libelle = ($data['libelle'] ?? null) ?: "Séance du {$reunion->date_reunion} — {$data['type']}";
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

                return response()->json($seance->load(['membre', 'caisse']), 201);
            });
        } catch (\RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }
    }

    public function update(Request $request, string $reunionId, string $id): JsonResponse
    {
        $seance = SeanceTransaction::where('reunion_id', $reunionId)
            ->whereHas('reunion', fn ($q) => $this->scope->scopeAssociation($q))
            ->findOrFail($id);
        $this->authorize('update', $seance->reunion);
        if (in_array($seance->reunion->statut, ['cloturee', 'annulee'], true)) {
            return response()->json(['message' => 'Réunion clôturée ou annulée : opération non modifiable.'], 422);
        }
        if ($seance->annulee) {
            return response()->json(['message' => 'Cette opération est annulée, elle n\'est plus modifiable.'], 422);
        }
        if ($seance->type === 'remboursement_pret') {
            return response()->json(['message' => 'Le remboursement de prêt se corrige depuis la fiche du prêt.'], 422);
        }

        $data = $request->validate([
            'type' => ['required', 'in:cotisation,paiement_sanction,amende,depot_banque,attribution_tour,divers_entree,divers_sortie,pret_accorde,aide_sociale'],
            'membre_id' => ['nullable', 'uuid'],
            'montant' => ['required', 'numeric', 'min:0.01'],
            'libelle' => ['nullable', 'string', 'max:300'],
            'caisse_id' => ['nullable', 'uuid'],
            'note' => ['nullable', 'string'],
        ]);

        try {
            return DB::transaction(function () use ($seance, $data, $request) {
                // pt.4 du rapport de test : le client veut une édition directe plutôt
                // que supprimer + ressaisir. On contre-passe le(s) mouvement(s) de
                // caisse existants (traçabilité conservée, comme dans destroy()) puis
                // on ré-applique le nouveau montant/caisse — l'écriture d'origine et
                // sa contre-passation restent visibles dans le journal de caisse,
                // mais côté séance l'utilisateur voit une simple modification.
                $anciennesTransactions = \App\Models\Transaction::where('reference_type', 'seance_transaction')
                    ->where('reference_id', $seance->id)->where('annulee', false)->get();
                foreach ($anciennesTransactions as $t) {
                    $this->caisseService->annuler($t, $request->user(), 'Correction de la saisie (édition)');
                }

                $seance->update($data);

                if (!empty($data['caisse_id'])) {
                    $caisse = $this->scope->scopeAssociation(Caisse::query())->findOrFail($data['caisse_id']);
                    $this->authorize('update', $caisse);
                    $libelle = ($data['libelle'] ?? null) ?: "Séance du {$seance->reunion->date_reunion} — {$data['type']} (corrigé)";
                    $sens = in_array($data['type'], self::TYPES_SORTIE, true) ? 'sortie' : 'entree';
                    $this->caisseService->{$sens}($caisse, (float) $data['montant'], $libelle, [
                        'reference_type' => 'seance_transaction',
                        'reference_id' => $seance->id,
                        'created_by' => $request->user()->id,
                        'valide_par' => $request->user()->id,
                    ]);
                }

                return response()->json($seance->fresh()->load(['membre', 'caisse']));
            });
        } catch (\RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }
    }

    public function destroy(Request $request, string $reunionId, string $id): JsonResponse
    {
        $seance = SeanceTransaction::where('reunion_id', $reunionId)
            ->whereHas('reunion', fn ($q) => $this->scope->scopeAssociation($q))
            ->findOrFail($id);
        $this->authorize('update', $seance->reunion);
        if (in_array($seance->reunion->statut, ['cloturee', 'annulee'], true)) {
            return response()->json(['message' => 'Réunion clôturée ou annulée : opération non réversible.'], 422);
        }
        if ($seance->annulee) return response()->json(['message' => 'Cette opération est déjà annulée.'], 422);
        if ($seance->type === 'remboursement_pret') {
            return response()->json(['message' => 'Le remboursement de prêt doit être annulé depuis la fiche du prêt.'], 422);
        }
        $motif = $request->input('motif', 'Correction avant clôture de séance');

        DB::transaction(function () use ($seance, $motif, $request) {
            $transactions = \App\Models\Transaction::where('reference_type', 'seance_transaction')
                ->where('reference_id', $seance->id)->where('annulee', false)->get();
            foreach ($transactions as $transaction) $this->caisseService->annuler($transaction, $request->user(), $motif);
            if ($seance->reference_sanction_id) {
                SanctionMembre::whereKey($seance->reference_sanction_id)->where('statut', 'payee')->update(['statut' => 'due', 'payee_at' => null]);
            }
            $seance->update(['annulee' => true, 'annulee_at' => now(), 'annulee_par' => $request->user()->id, 'motif_annulation' => $motif]);
        });

        return response()->json(['annulee' => true]);
    }
}
