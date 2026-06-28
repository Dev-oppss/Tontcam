<?php

namespace App\Services;

use App\Models\BulletinGain;
use App\Models\CycleTontine;
use App\Models\RetenueBulletin;
use RuntimeException;
use App\Services\DocumentSignatureService;
use App\Services\SimplePdfService;

class BulletinGainService
{
    public function __construct(
        private readonly NotificationService $notificationService,
        private readonly SimplePdfService $pdfService,
        private readonly DocumentSignatureService $signatureService,
    ) {}

    public function calculerBrut(CycleTontine $cycle): float
    {
        return (float) $cycle->cotisations()->sum('montant_verse');
    }

    public function calculerRetenues(array $retenues): float
    {
        return array_sum(array_map(fn ($r) => (float) ($r['montant'] ?? 0), $retenues));
    }

    public function calculerNet(float $brut, float $retenues): float
    {
        return round($brut - $retenues, 2);
    }

    public function generer(CycleTontine $cycle, array $retenues = [], ?string $userId = null): BulletinGain
    {
        $cycle->loadMissing(['gagnantPart', 'tontine']);
        $part = $cycle->gagnantPart;

        if (! $part) {
            throw new RuntimeException('Cycle sans gagnant.');
        }

        $brut = $this->calculerBrut($cycle);
        $totalRetenues = $this->calculerRetenues($retenues);
        $net = $this->calculerNet($brut, $totalRetenues);

        $bulletin = BulletinGain::create([
            'cycle_id' => $cycle->id,
            'gagnant_membre_id' => $part->membre_id,
            'gagnant_part_id' => $part->id,
            'numero_bulletin' => 'BG-'.now()->format('YmdHis'),
            'montant_brut' => $brut,
            'total_retenues' => $totalRetenues,
            'montant_net' => $net,
            'statut' => 'genere',
            'genere_par' => $userId,
        ]);

        foreach ($retenues as $retenue) {
            RetenueBulletin::create(array_merge($retenue, ['bulletin_id' => $bulletin->id]));
        }

        $this->notificationService->notifierBulletinGain(
            $cycle->tontine->association_id,
            $part->membre_id,
            $net,
            $bulletin->id
        );

        return $bulletin->load('retenues');
    }

    public function genererPdf(BulletinGain $bulletin): string
    {
        $path = storage_path('app/public/bulletins/'.$bulletin->numero_bulletin.'.pdf');
        if (! is_dir(dirname($path))) {
            mkdir(dirname($path), 0777, true);
        }
        $lines = [
            'Bulletin: '.$bulletin->numero_bulletin,
            'Cycle: '.$bulletin->cycle_id,
            'Gagnant: '.$bulletin->gagnant_membre_id,
            'Brut: '.$bulletin->montant_brut,
            'Retenues: '.$bulletin->total_retenues,
            'Net: '.$bulletin->montant_net,
            'Genere: '.now()->toDateTimeString(),
        ];
        file_put_contents($path, $this->pdfService->render($lines, 'Bulletin de gain'));
        $this->signatureService->sign($path, [
            'type' => 'bulletin_gain',
            'bulletin_id' => $bulletin->id,
            'cycle_id' => $bulletin->cycle_id,
        ]);
        $bulletin->forceFill(['pdf_url' => 'storage/bulletins/'.$bulletin->numero_bulletin.'.pdf'])->save();
        return $bulletin->pdf_url;
    }
}
