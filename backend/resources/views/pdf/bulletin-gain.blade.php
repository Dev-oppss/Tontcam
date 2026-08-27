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
    .type-brut { color: #1a7f37; font-weight: bold; font-size: 9px; }
    .type-retenue { color: #c24e33; font-weight: bold; font-size: 9px; }
    .net { background: #4C5FD6; color: #fff; padding: 10px 8px; font-weight: bold; }
    .versement { margin-top: 12px; font-size: 10.5px; background: #f7f6f2; padding: 8px 10px; border-radius: 4px; }
    .signatures { width: 100%; border-collapse: separate; border-spacing: 14px 0; margin-top: 40px; }
    .signature { width: 33%; border-top: 1px solid #999; padding-top: 6px; font-size: 10px; text-align: center; }
</style>
</head>
<body>
    <div class="header">
        <div>
            <h1>{{ $bulletin->cycle->tontine->association->nom ?? 'TONTIX' }}</h1>
            <p>BULLETIN DE GAIN — CONFIDENTIEL</p>
        </div>
        <div class="meta">
            N° {{ $bulletin->numero_bulletin }}<br>
            Émis le {{ $bulletin->created_at->format('d/m/Y') }}
        </div>
    </div>
    <div class="section">
        <div class="infos">
            <div class="bloc">
                <strong>Bénéficiaire</strong>
                {{ $bulletin->gagnant->nom }} {{ $bulletin->gagnant->prenom }}<br>
                @if($bulletin->gagnant->matricule)Matricule {{ $bulletin->gagnant->matricule }} · @endif
                Part n°{{ $bulletin->part->numero_part }}<br>
                @if($bulletin->gagnant->telephone){{ $bulletin->gagnant->telephone }}<br>@endif
                @if($bulletin->part->avaliste)Avaliste : {{ $bulletin->part->avaliste->nom }} {{ $bulletin->part->avaliste->prenom }}@endif
            </div>
            <div class="bloc">
                <strong>Informations cycle</strong>
                Tontine : {{ $bulletin->cycle->tontine->libelle }}<br>
                Cycle n°{{ $bulletin->cycle->numero_cycle }} · {{ ucfirst(str_replace('_', ' ', $bulletin->cycle->tontine->mode_attribution)) }}<br>
                @if($bulletin->cycle->reunion)Réunion du {{ \Carbon\Carbon::parse($bulletin->cycle->reunion->date_reunion)->format('d/m/Y') }}<br>@endif
                Parts cotisantes : {{ $bulletin->cycle->cotisations()->where('statut', 'payee')->count() }} / {{ $bulletin->cycle->cotisations()->count() }}
                · {{ number_format($bulletin->cycle->tontine->montant_part, 0, ',', ' ') }} FCFA/part
            </div>
        </div>

        <table>
            <tr><th>Libellé</th><th>Type</th><th style="text-align:right">Montant</th></tr>
            <tr>
                <td>
                    @if($bulletin->cycle->tontine->mode_attribution === 'enchere' && $bulletin->cycle->montant_enchere)
                        Montant de l'enchère gagnante
                    @else
                        Cotisations collectées ({{ $bulletin->cycle->cotisations()->where('statut', 'payee')->count() }} parts × {{ number_format($bulletin->cycle->tontine->montant_part, 0, ',', ' ') }})
                    @endif
                </td>
                <td class="type-brut">GAIN BRUT</td>
                <td style="text-align:right">+ {{ number_format($bulletin->montant_brut, 0, ',', ' ') }} FCFA</td>
            </tr>
            @foreach($bulletin->retenues as $r)
                <tr>
                    <td>{{ $r->libelle }}</td>
                    <td class="type-retenue">RETENUE</td>
                    <td style="text-align:right;color:#c24e33">- {{ number_format($r->montant, 0, ',', ' ') }} FCFA</td>
                </tr>
            @endforeach
            <tr class="net"><td colspan="2">MONTANT NET À VERSER</td><td style="text-align:right">{{ number_format($bulletin->montant_net, 0, ',', ' ') }} FCFA</td></tr>
        </table>

        @if($bulletin->mode_versement)
            <div class="versement">
                <strong>Mode de versement :</strong>
                {{ ['especes'=>'Espèces','cheque'=>'Chèque','virement'=>'Virement','mobile_money'=>'Mobile Money'][$bulletin->mode_versement] ?? $bulletin->mode_versement }}
                @if($bulletin->reference_versement) — Référence {{ $bulletin->reference_versement }} @endif
                @if($bulletin->date_versement) · {{ \Carbon\Carbon::parse($bulletin->date_versement)->format('d/m/Y') }} @endif
            </div>
        @endif

        <table class="signatures">
            <tr>
                <td class="signature">
                    @if($bulletin->signe_tresorier_at)
                        ✓ Signé — Trésorier<br><span style="font-size:9px;color:#666">{{ $bulletin->signe_tresorier_at->format('d/m/Y H:i') }}</span>
                    @else
                        Signature Trésorier
                    @endif
                </td>
                <td class="signature">
                    @if($bulletin->signe_president_at)
                        ✓ Signé — Président<br><span style="font-size:9px;color:#666">{{ $bulletin->signe_president_at->format('d/m/Y H:i') }}</span>
                    @else
                        Signature Président
                    @endif
                </td>
                <td class="signature">
                    @if($bulletin->signe_beneficiaire_at)
                        ✓ Signé — Bénéficiaire<br><span style="font-size:9px;color:#666">{{ $bulletin->signe_beneficiaire_at->format('d/m/Y H:i') }}</span>
                    @else
                        Signature Bénéficiaire
                    @endif
                </td>
            </tr>
        </table>
        @if($bulletin->hash_integrite)
            <p style="margin-top:16px;font-size:8px;color:#999;word-break:break-all">
                Document scellé numériquement — hash d'intégrité SHA-256 : {{ $bulletin->hash_integrite }}<br>
                Toute modification du bulletin ou de ses signatures après coup invaliderait ce hash.
            </p>
        @endif
    </div>
</body>
</html>
