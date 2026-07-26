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
    .footer { margin-top: 20px; font-size: 8px; color: #999; }
</style>
</head>
<body>
    <div class="header">
        <h1>{{ $membre->association->nom ?? 'TONTIX' }}</h1>
        <p>Relevé de compte individuel — {{ $membre->nom }} {{ $membre->prenom }}</p>
    </div>
    <div class="section">
        <p><strong>Membre :</strong> {{ $membre->nom }} {{ $membre->prenom }} — Statut : {{ $membre->statut }}<br>
           <strong>Téléphone :</strong> {{ $membre->telephone }} — <strong>Adhésion :</strong> {{ optional($membre->date_adhesion)->format('d/m/Y') }}</p>

        <h2>Cotisations récentes</h2>
        <table>
            <tr><th>Date</th><th>Statut</th><th style="text-align:right">Montant dû</th><th style="text-align:right">Versé</th></tr>
            @forelse($cotisations as $c)
                <tr><td>{{ optional($c->created_at)->format('d/m/Y') }}</td><td>{{ $c->statut }}</td>
                    <td style="text-align:right">{{ number_format($c->montant_du, 0, ',', ' ') }}</td>
                    <td style="text-align:right">{{ number_format($c->montant_verse, 0, ',', ' ') }}</td></tr>
            @empty
                <tr><td colspan="4">Aucune cotisation enregistrée.</td></tr>
            @endforelse
        </table>

        <h2>Prêts</h2>
        <table>
            <tr><th>Montant</th><th>Statut</th><th style="text-align:right">Restant dû</th></tr>
            @forelse($prets as $p)
                <tr><td>{{ number_format($p->montant_principal, 0, ',', ' ') }} FCFA</td><td>{{ $p->statut }}</td>
                    <td style="text-align:right">{{ number_format($p->capital_restant, 0, ',', ' ') }} FCFA</td></tr>
            @empty
                <tr><td colspan="3">Aucun prêt.</td></tr>
            @endforelse
        </table>

        <h2>Sanctions</h2>
        <table>
            <tr><th>Type</th><th>Statut</th><th style="text-align:right">Montant</th></tr>
            @forelse($sanctions as $s)
                <tr><td>{{ $s->type->libelle ?? '—' }}</td><td>{{ $s->statut }}</td>
                    <td style="text-align:right">{{ number_format($s->montant, 0, ',', ' ') }} FCFA</td></tr>
            @empty
                <tr><td colspan="3">Aucune sanction.</td></tr>
            @endforelse
        </table>

        <h2>Gains de tontine (bulletins)</h2>
        <table>
            <tr><th>N° Bulletin</th><th style="text-align:right">Montant net</th><th>Statut</th></tr>
            @forelse($gains as $g)
                <tr><td>{{ $g->numero_bulletin }}</td><td style="text-align:right">{{ number_format($g->montant_net, 0, ',', ' ') }} FCFA</td><td>{{ $g->statut }}</td></tr>
            @empty
                <tr><td colspan="3">Aucun gain.</td></tr>
            @endforelse
        </table>

        <p class="footer">Document généré le {{ $genere_le->format('d/m/Y H:i') }}.</p>
    </div>
</body>
</html>
