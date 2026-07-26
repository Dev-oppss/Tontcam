<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
    body { font-family: Helvetica, Arial, sans-serif; font-size: 11px; color: #101827; }
    .header { background: #0B0D12; color: #fff; padding: 14px 18px; }
    .header h1 { margin: 0; font-size: 15px; }
    .header p { margin: 2px 0 0; font-size: 10px; color: #cfd3db; }
    .section { padding: 14px 18px; }
    h2 { font-size: 12px; margin: 16px 0 4px; border-bottom: 1px solid #ddd; padding-bottom: 4px; }
    table { width: 100%; border-collapse: collapse; margin-top: 4px; }
    th { background: #f2f0eb; text-align: left; padding: 5px 8px; font-size: 9px; text-transform: uppercase; }
    td { padding: 5px 8px; border-bottom: 1px solid #eee; font-size: 10px; }
    .net { background: #4C5FD6; color: #fff; padding: 8px; font-weight: bold; }
    .footer { margin-top: 20px; font-size: 8px; color: #999; }
</style>
</head>
<body>
    <div class="header">
        <h1>{{ $cycle->tontine->association->nom ?? 'TONTIX' }}</h1>
        <p>Rapport de cycle — {{ $cycle->tontine->libelle }} — Cycle n°{{ $cycle->numero_cycle }}</p>
    </div>
    <div class="section">
        <p><strong>Statut du cycle :</strong> {{ $cycle->statut }} —
           <strong>Bénéficiaire désigné :</strong> {{ $cycle->gagnant->nom ?? '—' }} {{ $cycle->gagnant->prenom ?? '' }}</p>

        <h2>Cotisations du cycle</h2>
        <table>
            <tr><th>Membre</th><th>Statut</th><th style="text-align:right">Dû</th><th style="text-align:right">Versé</th></tr>
            @php $totalDu = 0; $totalVerse = 0; @endphp
            @forelse($cycle->cotisations as $c)
                @php $totalDu += $c->montant_du; $totalVerse += $c->montant_verse; @endphp
                <tr><td>{{ $c->membre->nom ?? '—' }} {{ $c->membre->prenom ?? '' }}</td><td>{{ $c->statut }}</td>
                    <td style="text-align:right">{{ number_format($c->montant_du, 0, ',', ' ') }}</td>
                    <td style="text-align:right">{{ number_format($c->montant_verse, 0, ',', ' ') }}</td></tr>
            @empty
                <tr><td colspan="4">Aucune cotisation saisie.</td></tr>
            @endforelse
            <tr class="net"><td colspan="2">TOTAL</td>
                <td style="text-align:right">{{ number_format($totalDu, 0, ',', ' ') }}</td>
                <td style="text-align:right">{{ number_format($totalVerse, 0, ',', ' ') }}</td></tr>
        </table>

        @if($cycle->bulletin)
            <h2>Bulletin de gain</h2>
            <table>
                <tr><th>N° Bulletin</th><th style="text-align:right">Brut</th><th style="text-align:right">Retenues</th><th style="text-align:right">Net</th></tr>
                <tr>
                    <td>{{ $cycle->bulletin->numero_bulletin }}</td>
                    <td style="text-align:right">{{ number_format($cycle->bulletin->montant_brut, 0, ',', ' ') }}</td>
                    <td style="text-align:right">{{ number_format($cycle->bulletin->total_retenues, 0, ',', ' ') }}</td>
                    <td style="text-align:right">{{ number_format($cycle->bulletin->montant_net, 0, ',', ' ') }}</td>
                </tr>
            </table>
        @endif

        <p class="footer">Document généré le {{ $genere_le->format('d/m/Y H:i') }}.</p>
    </div>
</body>
</html>
