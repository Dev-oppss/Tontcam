<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Services\AccessScopeService;
use App\Services\AuditService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AuditLogController extends Controller
{
    public function __construct(private AccessScopeService $scope, private AuditService $audit) {}

    /**
     * Accès restreint : Super Admin et Contrôleur uniquement (RG-SEC-011).
     * La consultation elle-même est tracée (RG-SEC-012).
     */
    public function index(Request $request): JsonResponse
    {
        if ($request->user()->cannot('access-audit-log')) {
            return response()->json(['message' => "Accès restreint au Super Admin et au Contrôleur."], 403);
        }

        $filtres = $request->only(['module' => $request->get('table'), 'action' => $request->get('action')]);
        $this->audit->journaliserConsultation($request->user(), $filtres);

        $query = AuditLog::where('association_id', $this->scope->associationId($request->user()))
            ->with('utilisateur.membre')
            ->orderByDesc('created_at');

        if ($request->filled('table')) {
            $query->where('table_name', $request->table);
        }
        if ($request->filled('action')) {
            $query->where('action', $request->action);
        }
        if ($request->filled('du') && $request->filled('au')) {
            $query->whereBetween('created_at', [$request->du, $request->au]);
        }

        $logs = $query->paginate($request->integer('per_page', 50));
        $logs->getCollection()->transform(fn (AuditLog $log) => $this->presenter($log));

        return response()->json($logs);
    }

    /** Données métier lisibles, sans divulgation des structures et valeurs internes. */
    private function presenter(AuditLog $log): array
    {
        $modules = [
            'audit_log' => 'Journal d’audit',
            'transactions' => 'Opérations de caisse',
            'tontine.transactions' => 'Opérations de tontine',
            'tontine_transactions' => 'Opérations de tontine',
            'tontines' => 'Tontines',
            'cotisations_tontine' => 'Cotisations de tontine',
            'prets' => 'Prêts',
            'sanctions_membres' => 'Sanctions',
            'decisions_ag' => 'Décisions d’AG',
            'reunions' => 'Réunions',
            'membres' => 'Membres',
            'caisses' => 'Caisses',
        ];
        return [
            'id' => $log->id,
            'created_at' => $log->created_at,
            'utilisateur' => $log->utilisateur?->membre ? [
                'membre' => [
                    'nom' => $log->utilisateur->membre->nom,
                    'prenom' => $log->utilisateur->membre->prenom,
                ],
            ] : ['email' => 'Administrateur'],
            'module' => $modules[$log->table_name] ?? 'Gestion interne',
            'action' => $log->action,
            'resume' => $this->resumer($log),
        ];
    }

    /**
     * Résumé métier lisible construit à partir de valeur_avant/valeur_apres,
     * au lieu d'un texte générique identique pour toutes les lignes.
     * Ne divulgue que des champs "métier" (montant, libellé, statut...),
     * jamais d'identifiants techniques ou de clés étrangères brutes.
     */
    private function resumer(AuditLog $log): string
    {
        $avant = $log->valeur_avant ?? [];
        $apres = $log->valeur_apres ?? [];

        return match ($log->action) {
            'create' => $this->resumerCreation($log->table_name, $apres),
            'update' => $this->resumerModification($log->table_name, $avant, $apres),
            'delete' => $this->resumerSuppression($log->table_name, $avant),
            'view' => 'Consultation du journal d’audit',
            default => 'Opération enregistrée',
        };
    }

    private function resumerCreation(string $table, array $donnees): string
    {
        return match (true) {
            in_array($table, ['transactions', 'tontine.transactions', 'tontine_transactions'], true) =>
                trim(($donnees['libelle'] ?? 'Transaction').' — '.$this->montant($donnees['montant'] ?? null).' enregistrée'),

            $table === 'prets' =>
                'Prêt de '.$this->montant($donnees['montant_principal'] ?? null).' créé'
                    .($donnees['nb_echeances'] ?? null ? " ({$donnees['nb_echeances']} échéance(s))" : ''),

            $table === 'sanctions_membres' =>
                'Sanction'.($donnees['montant'] ?? null ? ' de '.$this->montant($donnees['montant']) : '')
                    .($donnees['motif'] ?? null ? " — {$donnees['motif']}" : '').' appliquée',

            $table === 'evenements_sociaux' =>
                'Événement social déclaré'
                    .($donnees['montant_demande'] ?? null ? ' — demande : '.$this->montant($donnees['montant_demande']) : ''),

            default => 'Création enregistrée',
        };
    }

    private function resumerModification(string $table, array $avant, array $apres): string
    {
        // Champs techniques qu'on ne veut jamais afficher dans un diff.
        $champsIgnores = ['updated_at', 'created_at', 'id'];

        $champsSuivis = match (true) {
            in_array($table, ['transactions', 'tontine.transactions', 'tontine_transactions'], true) =>
                ['montant' => 'Montant', 'libelle' => 'Libellé', 'statut' => 'Statut', 'valide' => 'Validation', 'annulee' => 'Annulation'],
            $table === 'prets' =>
                ['statut' => 'Statut', 'montant_rembourse' => 'Montant remboursé', 'capital_restant' => 'Capital restant'],
            $table === 'sanctions_membres' =>
                ['statut' => 'Statut', 'montant' => 'Montant'],
            $table === 'evenements_sociaux' =>
                ['statut' => 'Statut', 'montant_accorde' => 'Montant accordé'],
            default => null,
        };

        $champsAModifier = array_diff(array_keys($apres), $champsIgnores);
        if ($champsSuivis !== null) {
            $diffs = [];
            foreach ($champsSuivis as $champ => $libelle) {
                if (! array_key_exists($champ, $apres) || ($avant[$champ] ?? null) === $apres[$champ]) {
                    continue;
                }
                $ancien = $avant[$champ] ?? '—';
                $nouveau = $apres[$champ];
                $diffs[] = str_contains($champ, 'montant') || str_contains($champ, 'capital')
                    ? "{$libelle} : {$this->montant($ancien)} → {$this->montant($nouveau)}"
                    : "{$libelle} : {$ancien} → {$nouveau}";
            }
            if ($diffs !== []) {
                return implode(' · ', $diffs);
            }
        }

        $nbChamps = count($champsAModifier);
        return $nbChamps > 0 ? "Modification enregistrée ({$nbChamps} champ(s) modifié(s))" : 'Modification enregistrée';
    }

    private function resumerSuppression(string $table, array $donnees): string
    {
        return match (true) {
            in_array($table, ['transactions', 'tontine.transactions', 'tontine_transactions'], true) =>
                trim(($donnees['libelle'] ?? 'Transaction').' — '.$this->montant($donnees['montant'] ?? null).' supprimée'),
            $table === 'prets' => 'Prêt de '.$this->montant($donnees['montant_principal'] ?? null).' supprimé',
            default => 'Suppression enregistrée',
        };
    }

    private function montant(mixed $valeur): string
    {
        return $valeur === null ? '—' : number_format((float) $valeur, 0, ',', ' ').' FCFA';
    }
}
