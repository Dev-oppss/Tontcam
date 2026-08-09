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
    .section h2 { font-size: 12px; text-transform: uppercase; border-bottom: 1px solid #eee; padding-bottom: 4px; }
    .section h3 { font-size: 11px; margin: 14px 0 4px; color: #374151; }
    table { width: 100%; border-collapse: collapse; margin-top: 6px; }
    th { background: #f2f0eb; text-align: left; padding: 6px 8px; font-size: 10px; text-transform: uppercase; }
    td { padding: 6px 8px; border-bottom: 1px solid #eee; font-size: 11px; }
    .signatures { display: flex; flex-wrap: wrap; margin-top: 20px; }
    .signature { width: 33%; border-top: 1px solid #999; padding-top: 6px; font-size: 10px; text-align: center; margin-top: 20px; }
</style>
</head>
<body>
    <div class="header">
        <h1>{{ $reunion->association->nom ?? 'TONTIX' }}</h1>
        <p>Procès-verbal — Réunion n°{{ $reunion->numero }} ({{ ucfirst($reunion->type) }}) — {{ $reunion->date_reunion->format('d/m/Y') }}</p>
    </div>
    <div class="section">
        <p>
            <strong>Lieu :</strong> {{ $reunion->lieu }}{{ $reunion->hote ? ' — Hôte : '.$reunion->hote->nom.' '.$reunion->hote->prenom : '' }} &nbsp;
            <strong>Horaire :</strong> {{ $reunion->heure_debut }} → {{ $reunion->heure_fin_reelle ?? $reunion->heure_fin_prevue ?? '—' }} &nbsp;
            <strong>Quorum :</strong> {{ $reunion->quorum_atteint ? 'Atteint' : 'Non atteint' }} ({{ $reunion->quorum_requis ?? 0 }} requis)
        </p>

        <h2>Présences</h2>
        <table>
            <tr><th>Membre</th><th>Statut</th><th>Motif</th></tr>
            @foreach($reunion->presences as $p)
                <tr><td>{{ $p->membre->nom ?? '' }} {{ $p->membre->prenom ?? '' }}</td><td>{{ ucfirst(str_replace('_',' ', $p->statut)) }}</td><td>{{ $p->motif_absence ?? '—' }}</td></tr>
            @endforeach
        </table>

        <h2>Ordre du jour</h2>
        <table>
            <tr><th>Point</th><th>Rapport</th></tr>
            @foreach($reunion->ordreDuJour as $item)
                <tr>
                    <td>{{ $item->rubrique->libelle ?? $item->libelle_libre }}</td>
                    <td>{{ $item->contenu_rapport ?? '—' }}</td>
                </tr>
            @endforeach
        </table>

        <h2>Transactions financières par caisse</h2>
        @php
            $transactionsParCaisse = $reunion->seanceTransactions->groupBy(fn ($transaction) => $transaction->caisse_id ?: '__sans_caisse__');
            $typesSortie = ['attribution_tour', 'divers_sortie', 'pret_accorde', 'aide_sociale'];
            $libellesTypes = [
                'cotisation' => 'Cotisation', 'remboursement_pret' => 'Remboursement prêt',
                'paiement_sanction' => 'Paiement sanction', 'amende' => 'Amende',
                'attribution_tour' => 'Versement gain', 'divers_entree' => 'Entrée diverse',
                'divers_sortie' => 'Sortie diverse', 'pret_accorde' => 'Prêt accordé',
                'aide_sociale' => 'Aide sociale', 'depot_banque' => 'Dépôt banque',
            ];
        @endphp
        @forelse($transactionsParCaisse as $transactions)
            @php($premiere = $transactions->first())
            <h3>Caisse : {{ $premiere->caisse->libelle ?? 'Sans caisse affectée' }}</h3>
            <table>
                <tr><th>Type</th><th>Membre</th><th>Libellé</th><th>Entrée</th><th>Sortie</th></tr>
                @foreach($transactions as $transaction)
                    @php($imputation = str_contains((string) $transaction->note, 'Imputation sur gain'))
                    @php($sortie = in_array($transaction->type, $typesSortie, true))
                    <tr>
                        <td>{{ $libellesTypes[$transaction->type] ?? ucfirst(str_replace('_', ' ', $transaction->type)) }}{{ $imputation ? ' (imputation)' : '' }}</td>
                        <td>{{ $transaction->membre->nom ?? '' }} {{ $transaction->membre->prenom ?? '' }}</td>
                        <td>{{ $transaction->libelle ?? '—' }}</td>
                        <td style="text-align:right">{{ ! $sortie && ! $imputation ? number_format($transaction->montant, 0, ',', ' ').' FCFA' : '—' }}</td>
                        <td style="text-align:right">{{ $sortie ? number_format($transaction->montant, 0, ',', ' ').' FCFA' : '—' }}</td>
                    </tr>
                @endforeach
            </table>
        @empty
            <p>Aucune transaction financière enregistrée pour cette séance.</p>
        @endforelse

        <h2>Signatures</h2>
        <div class="signatures">
            @forelse($reunion->signataires as $s)
                <div class="signature">
                    <strong>{{ ucfirst($s->role_signature) }}</strong><br>
                    {{ $s->membre->nom ?? '' }} {{ $s->membre->prenom ?? '' }}<br>
                    Signé le {{ $s->signed_at?->format('d/m/Y H:i') }}<br>
                    Code : {{ strtoupper(substr(hash('sha256', $reunion->id.$s->membre_id.$s->signed_at?->format('Y-m-d H:i:s')), 0, 12)) }}
                </div>
            @empty
                <p>Aucune signature enregistrée.</p>
            @endforelse
        </div>

        <p style="font-size:9px;color:#888;margin-top:16px;">
            Document généré le {{ now()->format('d/m/Y H:i') }}. Chaque code de signature dépend de l'identité du signataire et de l'horodatage exact — toute falsification a posteriori le rendrait invalide.
        </p>
    </div>
</body>
</html>
