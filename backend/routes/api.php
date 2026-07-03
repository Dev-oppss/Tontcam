<?php

use App\Http\Controllers\Api\AideSocialeController;
use App\Http\Controllers\Api\AssociationController;
use App\Http\Controllers\Api\AuditLogController;
use App\Http\Controllers\Api\CompteBancaireController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\CaisseController;
use App\Http\Controllers\Api\TypeAideSocialeController;
use App\Http\Controllers\Api\TypeSanctionController;
use App\Http\Controllers\Api\ExportController;
use App\Http\Controllers\Api\CycleTontineController;
use App\Http\Controllers\Api\PortalController;
use App\Http\Controllers\Api\MembreController;
use App\Http\Controllers\Api\PretController;
use App\Http\Controllers\Api\ReunionController;
use App\Http\Controllers\Api\SanctionController;
use App\Http\Controllers\Api\TontineController;
use App\Http\Middleware\SetAssociationContext;
use Illuminate\Support\Facades\Route;

Route::get('/health', fn () => ['ok' => true, 'app' => 'TontineApp API']);

Route::prefix('auth')->group(function () {
    Route::post('/login', [AuthController::class, 'login']);
    Route::post('/forgot-password', [AuthController::class, 'forgotPassword']);
    Route::post('/reset-password', [AuthController::class, 'resetPassword']);
    Route::middleware('auth:sanctum')->group(function () {
        Route::post('/logout', [AuthController::class, 'logout']);
        Route::get('/me', [AuthController::class, 'me']);
        Route::post('/change-password', [AuthController::class, 'changePassword']);
    });
});

Route::middleware(['auth:sanctum', SetAssociationContext::class])->group(function () {
    Route::apiResource('associations', AssociationController::class);
    Route::post('/associations/{id}/statuts', [AssociationController::class, 'update']);
    Route::post('/reglements', [AssociationController::class, 'store']);

    Route::apiResource('membres', MembreController::class);
    Route::post('/membres/import-csv', [MembreController::class, 'importCsv']);
    Route::get('/membres/{id}/situation', [MembreController::class, 'show']);
    Route::get('/membres/{id}/releve-pdf', [MembreController::class, 'relevePdf']);

    Route::apiResource('reunions', ReunionController::class);
    Route::post('/reunions/{id}/ouvrir', [ReunionController::class, 'update']);
    Route::post('/reunions/{id}/presences', [ReunionController::class, 'update']);
    Route::post('/reunions/{id}/ordre-du-jour', [ReunionController::class, 'update']);
    Route::post('/reunions/{id}/rapports', [ReunionController::class, 'update']);
    Route::post('/reunions/{id}/pieces-jointes', [ReunionController::class, 'update']);
    Route::post('/reunions/{id}/soumettre-signature', [ReunionController::class, 'update']);
    Route::post('/reunions/{id}/signer', [ReunionController::class, 'update']);
    Route::post('/reunions/{id}/cloturer', [ReunionController::class, 'update']);
    Route::post('/reunions/{id}/reporter', [ReunionController::class, 'update']);
    Route::post('/reunions/{id}/annuler', [ReunionController::class, 'update']);
    Route::delete('/reunions/{reunion}/ordre-du-jour/{point}', [ReunionController::class, 'destroyPoint']);
    Route::get('/reunions/{id}/pv-pdf', [ReunionController::class, 'pvPdf']);

    Route::apiResource('tontines', TontineController::class);
    Route::post('/tontines/{id}/parts', [TontineController::class, 'parts']);
    Route::post('/tontines/{id}/cycles/ouvrir', [CycleTontineController::class, 'store']);
    Route::post('/tontines/{id}/bulletin', [TontineController::class, 'update']);
    Route::post('/cycles/{id}/cotisations', [CycleTontineController::class, 'update']);
    Route::post('/cycles/{id}/designer-gagnant', [CycleTontineController::class, 'update']);
    Route::post('/cycles/{id}/cloturer', [CycleTontineController::class, 'update']);
    Route::post('/cycles/{id}/bulletin', [CycleTontineController::class, 'update']);
    Route::get('/bulletins/{id}/pdf', [CycleTontineController::class, 'bulletinPdf']);

    Route::get('/caisses/journaux', [CaisseController::class, 'journaux']);
    Route::apiResource('caisses', CaisseController::class);
    Route::post('/caisses/{id}/transactions', [CaisseController::class, 'update']);
    Route::post('/caisses/transferts', [CaisseController::class, 'transfert']);
    Route::get('/caisses/{id}/journal', [CaisseController::class, 'show']);
    Route::get('/caisses/{id}/journal-pdf', [CaisseController::class, 'journalPdf']);
    Route::apiResource('comptes-bancaires', CompteBancaireController::class);

    Route::apiResource('prets', PretController::class);
    Route::post('/prets/{id}/valider', [PretController::class, 'update']);
    Route::post('/prets/{id}/approuver', [PretController::class, 'update']);
    Route::post('/prets/{id}/refuser', [PretController::class, 'update']);
    Route::post('/prets/{id}/decaisser', [PretController::class, 'update']);
    Route::post('/prets/{id}/rembourser', [PretController::class, 'update']);
    Route::get('/prets/{id}/echeances', [PretController::class, 'show']);

    Route::apiResource('sanctions', SanctionController::class);
    Route::post('/sanctions/{id}/payer', [SanctionController::class, 'update']);
    Route::apiResource('aides-sociales', AideSocialeController::class);
    Route::post('/aides-sociales/{id}/valider', [AideSocialeController::class, 'update']);
    Route::post('/aides-sociales/{id}/verser', [AideSocialeController::class, 'update']);
    Route::apiResource('types-sanctions', TypeSanctionController::class);
    Route::apiResource('types-aides-sociales', TypeAideSocialeController::class);
    Route::get('/portail/membre', [PortalController::class, 'show']);

    Route::middleware('role:super_admin,controleur,president,tresorier')->group(function () {
        Route::get('/audit-log', [AuditLogController::class, 'index']);
        Route::get('/exports/membres.csv', [ExportController::class, 'membresCsv']);
        Route::get('/exports/membres.xlsx', [ExportController::class, 'membresXlsx']);
        Route::get('/exports/transactions.csv', [ExportController::class, 'transactionsCsv']);
        Route::get('/exports/transactions.xlsx', [ExportController::class, 'transactionsXlsx']);
        Route::get('/exports/sanctions.csv', [ExportController::class, 'sanctionsCsv']);
        Route::get('/exports/sanctions.xlsx', [ExportController::class, 'sanctionsXlsx']);
    });
});
