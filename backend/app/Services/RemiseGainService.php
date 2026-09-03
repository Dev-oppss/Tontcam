<?php

namespace App\Services;

use App\Models\Pret;
use App\Models\RemiseGain;
use App\Models\SanctionMembre;
use App\Models\Tontine;
use App\Models\TontinePart;
use App\Models\Utilisateur;
use Illuminate\Support\Facades\DB;
use RuntimeException;

/**
 * Mode "cagnotte" (RG-TON) : les cotisations n'attribuent plus de gagnant
 * cycle par cycle. Chaque part accumule un solde (ses cotisations moins ce
 * qui lui a déjà été remis), distribué plus tard à un nombre libre de
 * bénéficiaires via une "remise de gains" indépendante des cycles.
 */
class RemiseGainService
{
    /**
     * Solde accumulé et non encore remis, par part — calculé à la volée
     * (jamais stocké) pour ne jamais pouvoir dériver de la réalité des
     * cotisations et remises déjà enregistrées.
     */
    public function soldeAccumule(TontinePart $part): float
    {
        $verse = (float) $part->cotisations()->sum('montant_verse');
        $dejaRemis = (float) DB::table('remise_gain_lignes')->where('tontine_part_id', $part->id)->sum('montant_verse');

        return round($verse - $dejaRemis, 2);
    }

    /**
     * Liste des parts ayant un solde > 0, avec dettes du membre affichées à
     * titre purement informatif (aucune déduction automatique — décision du
     * trésorier au moment de la remise, jamais de l'application).
     */
    public function proposition(Tontine $tontine): array
    {
        return $tontine->parts()->with('membre')->orderBy('numero_part')->get()
            ->map(fn (TontinePart $part) => ['part' => $part, 'solde' => $this->soldeAccumule($part)])
            ->filter(fn ($ligne) => $ligne['solde'] > 0)
            ->values()
            ->map(function ($ligne) {
                $part = $ligne['part'];
                return [
                    'tontine_part_id' => $part->id,
                    'numero_part' => $part->numero_part,
                    'membre_id' => $part->membre_id,
                    'membre_nom' => $part->membre ? "{$part->membre->nom} {$part->membre->prenom}" : null,
                    'solde_propose' => $ligne['solde'],
                    'dettes' => $this->dettesInformatives($part->membre_id),
                ];
            })->all();
    }

    /** Purement informatif — jamais déduit automatiquement (demande client explicite). */
    private function dettesInformatives(string $membreId): array
    {
        $pretsDus = Pret::where('emprunteur_id', $membreId)->whereIn('statut', ['en_cours', 'en_retard', 'defaut'])
            ->with('echeances')->get()
            ->sum(fn ($p) => $p->echeances->whereIn('statut', ['due', 'en_retard', 'partielle', 'penalisee'])
                ->sum(fn ($e) => (float) $e->montant_capital + (float) $e->montant_interet - (float) ($e->montant_verse ?? 0)));

        $sanctionsDues = (float) SanctionMembre::where('membre_id', $membreId)->where('statut', 'due')->sum('montant');

        return array_filter(['pret_du' => round((float) $pretsDus, 2), 'sanctions_dues' => $sanctionsDues], fn ($v) => $v > 0);
    }

    /**
     * @param array<array{tontine_part_id:string, montant:float, notes?:string}> $lignes
     */
    public function creerRemise(Tontine $tontine, array $lignes, ?string $reunionId, ?string $notes, Utilisateur $auteur): RemiseGain
    {
        if (! $tontine->mode_cagnotte) {
            throw new RuntimeException('Le mode cagnotte n’est pas activé sur cette tontine.');
        }
        if (empty($lignes)) {
            throw new RuntimeException('Sélectionnez au moins un bénéficiaire.');
        }

        return DB::transaction(function () use ($tontine, $lignes, $reunionId, $notes, $auteur) {
            $remise = RemiseGain::create([
                'tontine_id' => $tontine->id,
                'reunion_id' => $reunionId,
                'date_remise' => now(),
                'notes' => $notes,
                'created_by' => $auteur->id,
            ]);

            $caisseService = app(CaisseService::class);

            foreach ($lignes as $ligne) {
                $part = TontinePart::where('tontine_id', $tontine->id)->findOrFail($ligne['tontine_part_id']);
                $solde = $this->soldeAccumule($part);
                $montant = (float) $ligne['montant'];
                if ($montant <= 0) {
                    throw new RuntimeException("Le montant pour {$part->membre?->nom} doit être positif.");
                }
                if ($montant > $solde + 0.01) {
                    throw new RuntimeException("{$part->membre?->nom} {$part->membre?->prenom} : montant demandé ({$montant}) supérieur à l’accumulé disponible ({$solde}).");
                }

                $remise->lignes()->create([
                    'tontine_part_id' => $part->id,
                    'montant_verse' => $montant,
                    'notes' => $ligne['notes'] ?? null,
                ]);

                $caisseService->sortie($tontine->caisse, $montant, "Remise de gains — {$part->membre?->nom} {$part->membre?->prenom} (part n°{$part->numero_part})", [
                    'reference_type' => 'remise_gain',
                    'reference_id' => $remise->id,
                    'created_by' => $auteur->id,
                    'valide_par' => $auteur->id,
                ]);
            }

            return $remise->fresh(['lignes.part.membre']);
        });
    }
}
