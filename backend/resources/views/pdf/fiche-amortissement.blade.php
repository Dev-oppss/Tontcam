<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
    body { font-family: Helvetica, Arial, sans-serif; font-size: 12px; color: #101827; }
    .header { background: #0B0D12; color: #fff; padding: 14px 18px; display: flex; justify-content: space-between; }
    .header h1 { margin: 0; font-size: 15px; }
    .header p { margin: 2px 0 0; font-size: 10px; color: #cfd3db; }
    .header .meta { text-align: right; font-size: 10px; color: #cfd3db; }
    .section { padding: 16px 18px; }
    .infos { display: flex; gap: 16px; margin-bottom: 8px; }
    .infos .bloc { flex: 1; background: #f7f6f2; border-radius: 4px; padding: 8px 10px; font-size: 10.5px; }
    .infos .bloc strong { display: block; font-size: 9px; text-transform: uppercase; color: #6b7280; margin-bottom: 3px; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
    th { background: #f2f0eb; text-align: left; padding: 6px 8px; font-size: 10px; text-transform: uppercase; }
    td { padding: 6px 8px; border-bottom: 1px solid #eee; font-size: 11px; }
    .right { text-align: right; }
    .statut-payee { color: #1a7f37; font-weight: bold; }
    .statut-retard { color: #c24e33; font-weight: bold; }
    .totaux { width: 100%; border-collapse: collapse; margin-top: 12px; }
    .totaux td { border: none; padding: 4px 8px; font-size: 11px; }
    .totaux .label { color: #6b7280; }
    .totaux .net { background: #4C5FD6; color: #fff; font-weight: bold; padding: 10px 8px; }
    .signatures { width: 100%; border-collapse: separate; border-spacing: 14px 0; margin-top: 40px; }
    .signature { width: 33%; border-top: 1px solid #999; padding-top: 6px; font-size: 10px; text-align: center; }
</style>
</head>
<body>
    <div class="header">
        <div>
            <h1>{{ $pret->caisse->association->nom ?? 'TONTIX' }}</h1>
            <p>FICHE D'AMORTISSEMENT — PRÊT</p>
        </div>
        <div class="meta">
            Prêt n° {{ substr($pret->id, 0, 8) }}<br>
            Émis le {{ now()->format('d/m/Y') }}
        </div>
    </div>
    <div class="section">
        <div class="infos">
            <div class="bloc">
                <strong>Emprunteur</strong>
                {{ $pret->emprunteur->nom }} {{ $pret->emprunteur->prenom }}<br>
                @if($pret->emprunteur->matricule)Matricule {{ $pret->emprunteur->matricule }}<br>@endif
                @if($pret->emprunteur->telephone){{ $pret->emprunteur->telephone }}<br>@endif
                @if($pret->avaliste)Avaliste (caution) : {{ $pret->avaliste->nom }} {{ $pret->avaliste->prenom }}@endif
            </div>
            <div class="bloc">
                <strong>Conditions du prêt</strong>
                Caisse : {{ $pret->caisse->libelle }}<br>
                Capital : {{ number_format($pret->montant_principal, 0, ',', ' ') }} FCFA
                · Taux : {{ number_format($pret->taux_interet_mensuel * 100, 2) }} %/mois<br>
                Durée : {{ $pret->nb_echeances }} mensualité(s)<br>
                Prise d'effet : {{ $pret->date_prise_effet ? \Carbon\Carbon::parse($pret->date_prise_effet)->format('d/m/Y') : '—' }}
                @if($pret->date_fin_prevue) · Fin prévue : {{ \Carbon\Carbon::parse($pret->date_fin_prevue)->format('d/m/Y') }} @endif
            </div>
        </div>

        <table>
            <tr>
                <th>N°</th>
                <th>Échéance</th>
                <th class="right">Capital</th>
                <th class="right">Intérêt</th>
                <th class="right">Mensualité</th>
                <th class="right">Versé</th>
                <th class="right">Reste dû</th>
                <th>Statut</th>
            </tr>
            @foreach($pret->echeances->sortBy('numero_echeance') as $e)
                <tr>
                    <td>{{ $e->numero_echeance }}</td>
                    <td>{{ \Carbon\Carbon::parse($e->date_echeance)->format('d/m/Y') }}</td>
                    <td class="right">{{ number_format($e->montant_capital, 0, ',', ' ') }}</td>
                    <td class="right">{{ number_format($e->montant_interet, 0, ',', ' ') }}</td>
                    <td class="right">{{ number_format($e->montant_total, 0, ',', ' ') }}</td>
                    <td class="right">{{ number_format($e->montant_verse, 0, ',', ' ') }}</td>
                    <td class="right">{{ $e->capital_restant_apres !== null ? number_format($e->capital_restant_apres, 0, ',', ' ') : '—' }}</td>
                    <td class="{{ $e->statut === 'payee' ? 'statut-payee' : (in_array($e->statut, ['en_retard','penalisee']) ? 'statut-retard' : '') }}">
                        {{ ['a_venir'=>'À venir','due'=>'Due','partielle'=>'Partielle','payee'=>'Payée','en_retard'=>'En retard','penalisee'=>'Pénalisée'][$e->statut] ?? $e->statut }}
                    </td>
                </tr>
            @endforeach
        </table>

        <table class="totaux">
            <tr>
                <td class="label">Total capital</td><td class="right">{{ number_format($pret->montant_principal, 0, ',', ' ') }} FCFA</td>
                <td class="label">Total intérêts</td><td class="right">{{ number_format($pret->interet_total, 0, ',', ' ') }} FCFA</td>
            </tr>
            <tr>
                <td class="label">Déjà remboursé</td><td class="right">{{ number_format($pret->montant_rembourse, 0, ',', ' ') }} FCFA</td>
                <td class="label">Capital restant dû</td><td class="right">{{ number_format($pret->capital_restant, 0, ',', ' ') }} FCFA</td>
            </tr>
            <tr>
                <td colspan="3" class="net">TOTAL DÛ SUR TOUTE LA DURÉE</td>
                <td class="net right">{{ number_format($pret->montant_total_du, 0, ',', ' ') }} FCFA</td>
            </tr>
        </table>

        <table class="signatures">
            <tr>
                <td class="signature">Signature Trésorier</td>
                <td class="signature">Signature Emprunteur</td>
                @if($pret->avaliste)
                    <td class="signature">Signature Avaliste</td>
                @endif
            </tr>
        </table>
    </div>
</body>
</html>
