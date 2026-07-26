<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Membre;
use App\Models\SanctionMembre;
use App\Models\Transaction;
use App\Services\SimpleSpreadsheetService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

class ExportController extends Controller
{
    public function __construct(private readonly SimpleSpreadsheetService $spreadsheet) {}

    public function membresCsv(Request $request)
    {
        return $this->downloadCsv('membres.csv', $this->membres($request));
    }

    public function membresXlsx(Request $request)
    {
        return $this->downloadXlsx('membres.xlsx', $this->membres($request));
    }

    public function transactionsCsv(Request $request)
    {
        return $this->downloadCsv('transactions.csv', $this->transactions($request));
    }

    public function transactionsXlsx(Request $request)
    {
        return $this->downloadXlsx('transactions.xlsx', $this->transactions($request));
    }

    public function sanctionsCsv(Request $request)
    {
        return $this->downloadCsv('sanctions.csv', $this->sanctions($request));
    }

    public function sanctionsXlsx(Request $request)
    {
        return $this->downloadXlsx('sanctions.xlsx', $this->sanctions($request));
    }

    /**
     * RG-RPT-002 : relevé de compte individuel d'un membre (PDF).
     */
    public function releveMembrePdf(Request $request, string $membreId)
    {
        Gate::authorize('export-personal-data');
        $membre = \App\Models\Membre::where('association_id', $this->associationId($request))->findOrFail($membreId);

        $data = [
            'membre' => $membre,
            'cotisations' => \App\Models\CotisationTontine::where('membre_id', $membre->id)->latest()->limit(100)->get(),
            'prets' => $membre->prets()->with('echeances')->get(),
            'sanctions' => $membre->sanctions()->with('type')->get(),
            'gains' => \App\Models\BulletinGain::where('gagnant_membre_id', $membre->id)->get(),
            'genere_le' => now(),
        ];

        $pdf = \Barryvdh\DomPDF\Facade\Pdf::loadView('pdf.releve-membre', $data);

        return $pdf->download("releve-{$membre->nom}-{$membre->prenom}.pdf");
    }

    /**
     * RG-RPT-004 : rapport complet d'un cycle de tontine clôturé (PDF).
     */
    public function rapportCyclePdf(Request $request, string $cycleId)
    {
        Gate::authorize('export-personal-data');
        $cycle = \App\Models\CycleTontine::with('tontine.association', 'cotisations.membre', 'bulletin.gagnant')
            ->whereHas('tontine', fn ($q) => $q->where('association_id', $this->associationId($request)))
            ->findOrFail($cycleId);

        $pdf = \Barryvdh\DomPDF\Facade\Pdf::loadView('pdf.rapport-cycle', ['cycle' => $cycle, 'genere_le' => now()]);

        return $pdf->download("rapport-cycle-{$cycle->numero_cycle}.pdf");
    }

    /**
     * RG-RPT-002 (bilan annuel) : synthèse financière de l'association sur une année civile (PDF).
     */
    public function bilanAnnuelPdf(Request $request, string $annee)
    {
        Gate::authorize('export-personal-data');
        $associationId = $this->associationId($request);
        $debut = "{$annee}-01-01 00:00:00";
        $fin = "{$annee}-12-31 23:59:59";

        $caisses = \App\Models\Caisse::where('association_id', $associationId)->get();
        $transactions = Transaction::whereIn('caisse_id', $caisses->pluck('id'))
            ->whereBetween('date_transaction', [$debut, $fin])->get();

        $data = [
            'annee' => $annee,
            'association' => \App\Models\Association::find($associationId),
            'caisses' => $caisses,
            'total_entrees' => $transactions->where('type', 'entree')->sum('montant'),
            'total_sorties' => $transactions->whereIn('type', ['sortie'])->sum('montant'),
            'total_prets_decaisses' => \App\Models\Pret::whereHas('caisse', fn ($q) => $q->where('association_id', $associationId))
                ->whereBetween('date_debut', [$debut, $fin])->sum('montant_principal'),
            'total_sanctions' => SanctionMembre::where('association_id', $associationId)
                ->whereBetween('created_at', [$debut, $fin])->sum('montant'),
            'total_aides' => \App\Models\EvenementSocial::where('association_id', $associationId)
                ->where('statut', 'versee')->whereBetween('date_versement', [$debut, $fin])->sum('montant_accorde'),
            'genere_le' => now(),
        ];

        $pdf = \Barryvdh\DomPDF\Facade\Pdf::loadView('pdf.bilan-annuel', $data);

        return $pdf->download("bilan-annuel-{$annee}.pdf");
    }

    private function membres(Request $request): array
    {
        Gate::authorize('export-personal-data');
        $associationId = $this->associationId($request);
        $rows = Membre::query()->where('association_id', $associationId)->get()->map(fn ($m) => [
            $m->id, $m->nom, $m->prenom, $m->telephone, $m->email, $m->statut, optional($m->date_adhesion)->format('Y-m-d'),
        ])->all();
        return [['ID','Nom','Prenom','Telephone','Email','Statut','Adhesion'], $rows];
    }

    private function transactions(Request $request): array
    {
        Gate::authorize('export-personal-data');
        $associationId = $this->associationId($request);
        $rows = Transaction::query()
            ->whereHas('caisse', fn ($q) => $q->where('association_id', $associationId))
            ->get()
            ->map(fn ($t) => [
                $t->id, $t->caisse_id, $t->type, $t->montant, $t->libelle, $t->mode_paiement, $t->date_transaction?->format('Y-m-d H:i:s'),
            ])->all();
        return [['ID','Caisse','Type','Montant','Libelle','Mode','Date'], $rows];
    }

    private function sanctions(Request $request): array
    {
        Gate::authorize('export-personal-data');
        $associationId = $this->associationId($request);
        $rows = SanctionMembre::query()->where('association_id', $associationId)->get()->map(fn ($s) => [
            $s->id, $s->membre_id, $s->type_sanction_id, $s->montant, $s->statut, $s->motif,
        ])->all();
        return [['ID','Membre','Type','Montant','Statut','Motif'], $rows];
    }

    private function downloadCsv(string $name, array $dataset)
    {
        [$headers, $rows] = $dataset;
        return response($this->spreadsheet->csv($headers, $rows), 200, [
            'Content-Type' => 'text/csv; charset=utf-8',
            'Content-Disposition' => 'attachment; filename="'.$name.'"',
        ]);
    }

    private function downloadXlsx(string $name, array $dataset)
    {
        [$headers, $rows] = $dataset;
        return response($this->spreadsheet->xlsx($headers, $rows), 200, [
            'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition' => 'attachment; filename="'.$name.'"',
        ]);
    }

    private function associationId(Request $request): string
    {
        return $request->query('association_id')
            ?? $request->user()?->membre?->association_id
            ?? $request->user()?->association_id
            ?? '';
    }
}
