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
