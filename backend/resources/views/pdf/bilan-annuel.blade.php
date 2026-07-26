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
        <h1>{{ $association->nom ?? 'TONTIX' }}</h1>
        <p>Bilan financier annuel — Année {{ $annee }}</p>
    </div>
    <div class="section">
        <h2>Synthèse</h2>
        <table>
            <tr><td>Total entrées (toutes caisses)</td><td style="text-align:right">{{ number_format($total_entrees, 0, ',', ' ') }} FCFA</td></tr>
            <tr><td>Total sorties (toutes caisses)</td><td style="text-align:right">{{ number_format($total_sorties, 0, ',', ' ') }} FCFA</td></tr>
            <tr><td>Total prêts décaissés sur l'année</td><td style="text-align:right">{{ number_format($total_prets_decaisses, 0, ',', ' ') }} FCFA</td></tr>
            <tr><td>Total sanctions appliquées</td><td style="text-align:right">{{ number_format($total_sanctions, 0, ',', ' ') }} FCFA</td></tr>
            <tr><td>Total aides sociales versées</td><td style="text-align:right">{{ number_format($total_aides, 0, ',', ' ') }} FCFA</td></tr>
            <tr class="net"><td>SOLDE NET DE L'ANNÉE</td><td style="text-align:right">{{ number_format($total_entrees - $total_sorties, 0, ',', ' ') }} FCFA</td></tr>
        </table>

        <h2>Solde actuel par caisse</h2>
        <table>
            <tr><th>Caisse</th><th>Type</th><th style="text-align:right">Solde actuel</th></tr>
            @foreach($caisses as $c)
                <tr><td>{{ $c->libelle }}</td><td>{{ $c->type }}</td><td style="text-align:right">{{ number_format($c->solde_actuel, 0, ',', ' ') }} FCFA</td></tr>
            @endforeach
        </table>

        <p class="footer">Document généré le {{ $genere_le->format('d/m/Y H:i') }}. Bilan calculé sur les transactions du 1er janvier au 31 décembre {{ $annee }}.</p>
    </div>
</body>
</html>
