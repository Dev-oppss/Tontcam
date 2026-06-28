<?php

namespace App\Services;

use App\Models\CotisationTontine;
use App\Models\CycleTontine;
use App\Models\Encherite;
use App\Models\Tontine;
use App\Models\TontinePart;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class TontineCycleService
{
    public function ouvrirCycle(Tontine $tontine, string $reunionId): CycleTontine
    {
        return DB::transaction(function () use ($tontine, $reunionId) {
            $numero = ((int) $tontine->cycles()->max('numero_cycle')) + 1;
            $parts = $tontine->parts()->whereIn('statut', ['attribuee', 'active', 'disponible'])->get();

            if ($parts->isEmpty()) {
                throw new RuntimeException('Aucune part active pour cette tontine.');
            }

            $cycle = CycleTontine::create([
                'tontine_id' => $tontine->id,
                'reunion_id' => $reunionId,
                'numero_cycle' => $numero,
                'statut' => 'ouvert',
                'montant_collecte_prevu' => $parts->count() * (float) $tontine->montant_part,
                'date_ouverture' => now(),
            ]);

            foreach ($parts as $part) {
                CotisationTontine::create([
                    'cycle_id' => $cycle->id,
                    'tontine_part_id' => $part->id,
                    'membre_id' => $part->membre_id,
                    'montant_du' => $tontine->montant_part,
                    'statut' => 'due',
                ]);
            }

            return $cycle->load(['cotisations.part', 'tontine']);
        });
    }

    public function saisirCotisation(CycleTontine $cycle, string $partId, float $montant, array $meta = []): CotisationTontine
    {
        return DB::transaction(function () use ($cycle, $partId, $montant, $meta) {
            $cotisation = CotisationTontine::query()
                ->where('cycle_id', $cycle->id)
                ->where('tontine_part_id', $partId)
                ->lockForUpdate()
                ->firstOrFail();

            $verse = min((float) $cotisation->montant_du, (float) $cotisation->montant_verse + $montant);
            $cotisation->fill(array_merge($meta, [
                'montant_verse' => $verse,
                'statut' => $verse >= (float) $cotisation->montant_du ? 'payee' : 'partielle',
                'date_versement' => now(),
            ]))->save();

            $cycle->forceFill([
                'montant_collecte_reel' => $cycle->cotisations()->sum('montant_verse'),
            ])->save();

            return $cotisation->refresh();
        });
    }

    public function designerGagnant(CycleTontine $cycle, ?string $partId = null): CycleTontine
    {
        $cycle->loadMissing('tontine.parts');
        $tontine = $cycle->tontine;

        $part = $partId ? TontinePart::findOrFail($partId) : match ($tontine->mode_attribution) {
            'tirage_sort' => $tontine->parts()->whereNull('date_attribution')->inRandomOrder()->first(),
            'enchere' => Encherite::query()
                ->where('cycle_id', $cycle->id)
                ->orderByDesc('montant_offre')
                ->first()?->tontinePart,
            'calendrier' => $tontine->parts()
                ->whereNull('date_attribution')
                ->orderByRaw('COALESCE(date_gain_calendrier, CURRENT_DATE) ASC')
                ->orderBy('numero_part')
                ->first(),
            default => $tontine->parts()
                ->whereNull('date_attribution')
                ->orderBy('ordre_rotation')
                ->orderBy('numero_part')
                ->first(),
        };

        if (! $part) {
            throw new RuntimeException('Aucune part gagnante disponible.');
        }

        $cycle->forceFill(['gagnant_part_id' => $part->id])->save();
        $part->forceFill(['date_attribution' => now(), 'statut' => 'gagnee'])->save();

        return $cycle->refresh()->load('gagnantPart');
    }

    public function cloturerCycle(CycleTontine $cycle): CycleTontine
    {
        if (! $cycle->gagnant_part_id) {
            throw new RuntimeException('Designer un gagnant avant cloture.');
        }

        $cycle->forceFill([
            'statut' => 'clos',
            'date_cloture' => now(),
            'montant_collecte_reel' => $cycle->cotisations()->sum('montant_verse'),
        ])->save();

        return $cycle->refresh();
    }
}
