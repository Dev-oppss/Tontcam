<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
    body { font-family: Helvetica, Arial, sans-serif; font-size: 12px; color: #101827; }
    .header { background: #0B0D12; color: #fff; padding: 14px 18px; }
    .header h1 { margin: 0; font-size: 15px; }
    .header p { margin: 2px 0 0; font-size: 10px; color: #cfd3db; }
    .section { padding: 16px 18px; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
    th { background: #f2f0eb; text-align: left; padding: 6px 8px; font-size: 10px; text-transform: uppercase; }
    td { padding: 6px 8px; border-bottom: 1px solid #eee; font-size: 11px; }
    .net { background: #4C5FD6; color: #fff; padding: 10px 8px; font-weight: bold; }
    .signatures { display: flex; margin-top: 40px; }
    .signature { width: 33%; border-top: 1px solid #999; padding-top: 6px; font-size: 10px; text-align: center; }
</style>
</head>
<body>
    <div class="header">
        <h1>{{ $bulletin->cycle->tontine->association->nom ?? 'TONTIX' }}</h1>
        <p>Bulletin de gain — Cycle n°{{ $bulletin->cycle->numero_cycle }} — {{ $bulletin->numero_bulletin }}</p>
    </div>
    <div class="section">
        <p><strong>Bénéficiaire :</strong> {{ $bulletin->gagnant->nom }} {{ $bulletin->gagnant->prenom }} — Part n°{{ $bulletin->part->numero_part }}</p>
        <table>
            <tr><th>Libellé</th><th style="text-align:right">Montant</th></tr>
            <tr><td>Cotisations collectées (gain brut)</td><td style="text-align:right">{{ number_format($bulletin->montant_brut, 0, ',', ' ') }} FCFA</td></tr>
            @foreach($bulletin->retenues as $r)
                <tr><td>{{ $r->libelle }}</td><td style="text-align:right;color:#c24e33">− {{ number_format($r->montant, 0, ',', ' ') }} FCFA</td></tr>
            @endforeach
            <tr class="net"><td>MONTANT NET À VERSER</td><td style="text-align:right">{{ number_format($bulletin->montant_net, 0, ',', ' ') }} FCFA</td></tr>
        </table>
        <div class="signatures">
            <div class="signature">Signature Trésorier</div>
            <div class="signature">Signature Président</div>
            <div class="signature">Signature Bénéficiaire</div>
        </div>
    </div>
</body>
</html>
