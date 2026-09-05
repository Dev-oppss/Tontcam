<?php

use App\Http\Controllers\Api\AideSocialeController;
use App\Http\Controllers\Api\AssociationController;
use App\Http\Controllers\Api\UploadController;
use App\Http\Controllers\Api\AssuranceMembreController;
use App\Http\Controllers\Api\AuditLogController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\CaisseController;
use App\Http\Controllers\Api\CompteBancaireController;
use App\Http\Controllers\Api\CycleTontineController;
use App\Http\Controllers\Api\CagnotteController;
use App\Http\Controllers\Api\InitialisationMembreController;
use App\Http\Controllers\Api\EpargneController;
use App\Http\Controllers\Api\DecisionAgController;
use App\Http\Controllers\Api\ExportController;
use App\Http\Controllers\Api\MembreController;
use App\Http\Controllers\Api\OrdreDuJourRubriqueController;
use App\Http\Controllers\Api\ParametreController;
use App\Http\Controllers\Api\PlanningTourController;
use App\Http\Controllers\Api\PortalController;
use App\Http\Controllers\Api\PosteController;
use App\Http\Controllers\Api\PretController;
use App\Http\Controllers\Api\RapprochementBancaireController;
use App\Http\Controllers\Api\ReglementInterieurController;
use App\Http\Controllers\Api\ReunionController;
use App\Http\Controllers\Api\SanctionController;
use App\Http\Controllers\Api\SeanceTransactionController;
use App\Http\Controllers\Api\TontineController;
use App\Http\Controllers\Api\TypeAideSocialeController;
use App\Http\Controllers\Api\TypeSanctionController;
use App\Http\Controllers\Api\UtilisateurController;
use Illuminate\Support\Facades\Route;

Route::get('/health', fn () => ['ok' => true, 'app' => 'TontineApp API']);

Route::prefix('auth')->group(function () {
    Route::post('/register', [AuthController::class, 'register']);
    Route::post('/login', [AuthController::class, 'login']);
    Route::post('/forgot-password', [AuthController::class, 'forgotPassword']);
    Route::post('/reset-password', [AuthController::class, 'resetPassword']);
    Route::middleware(['auth:sanctum', 'association.context'])->group(function () {
        Route::post('/logout', [AuthController::class, 'logout']);
        Route::get('/me', [AuthController::class, 'me']);
        Route::put('/me', [AuthController::class, 'updateMe']);
        Route::post('/change-password', [AuthController::class, 'changePassword']);
    });
});

Route::middleware(['auth:sanctum', 'association.context'])->group(function () {

    // ── Organisation ────────────────────────────────────────────
    Route::apiResource('associations', AssociationController::class)->whereUuid('association');
    Route::post('/associations/{id}/statuts', [AssociationController::class, 'uploadStatuts']);
    Route::get('/associations/{id}/statuts', [AssociationController::class, 'historiqueStatuts']);

    // ── Membres ─────────────────────────────────────────────────
    Route::apiResource('membres', MembreController::class)->whereUuid('membre');
    Route::post('/membres/import-csv', [MembreController::class, 'importCsv']);
    Route::get('/membres/{id}/situation', [MembreController::class, 'situation']);
    Route::get('/membres/{id}/assurances', [AssuranceMembreController::class, 'index']);
    Route::post('/membres/{id}/assurances', [AssuranceMembreController::class, 'store']);
    Route::put('/assurances/{id}', [AssuranceMembreController::class, 'update']);

    // ── Réunions ────────────────────────────────────────────────
    Route::apiResource('reunions', ReunionController::class)->whereUuid('reunion');
    Route::post('/reunions/{id}/ouvrir', [ReunionController::class, 'ouvrir']);
    Route::post('/reunions/{id}/presences', [ReunionController::class, 'presences']);
    Route::post('/reunions/{id}/rapports', [ReunionController::class, 'ajouterRapport']);
    Route::post('/reunions/{id}/points', [ReunionController::class, 'ajouterPoint']);
    Route::put('/reunions/{id}/points/{pointId}', [ReunionController::class, 'modifierPoint']);
    Route::delete('/reunions/{id}/points/{pointId}', [ReunionController::class, 'supprimerPoint']);
    Route::get('/reunions/{id}/transactions', [SeanceTransactionController::class, 'index']);
    Route::post('/reunions/{id}/transactions', [SeanceTransactionController::class, 'store']);
    Route::put('/reunions/{id}/transactions/{transactionId}', [SeanceTransactionController::class, 'update']);
    Route::delete('/reunions/{id}/transactions/{transactionId}', [SeanceTransactionController::class, 'destroy']);
    Route::post('/reunions/{id}/signer', [ReunionController::class, 'signer']);
    Route::get('/reunions/{id}/pv-pdf', [ReunionController::class, 'pvPdf']);
    Route::get('/ordre-du-jour-rubriques', [OrdreDuJourRubriqueController::class, 'index']);
    Route::post('/ordre-du-jour-rubriques', [OrdreDuJourRubriqueController::class, 'store']);
    Route::put('/ordre-du-jour-rubriques/{id}', [OrdreDuJourRubriqueController::class, 'update']);
    Route::delete('/ordre-du-jour-rubriques/{id}', [OrdreDuJourRubriqueController::class, 'destroy']);

    // ── Tontines & cycles ───────────────────────────────────────
    Route::get('/tontines/{id}/cycles', [CycleTontineController::class, 'index']);
    Route::apiResource('tontines', TontineController::class)->whereUuid('tontine');
    Route::post('/tontines/{id}/parts', [TontineController::class, 'ajouterPart']);
    Route::put('/tontines/{id}/parts/{partId}', [TontineController::class, 'modifierPart']);
    Route::delete('/tontines/{id}/parts/{partId}', [TontineController::class, 'retirerPart']);
    Route::get('/tontines/{id}/planning', [PlanningTourController::class, 'index']);
    Route::post('/tontines/{id}/planning', [PlanningTourController::class, 'store']);
    Route::post('/tontines/{id}/planning/{tourId}/encaisser', [PlanningTourController::class, 'marquerEncaisse']);
    Route::delete('/tontines/{id}/planning/{tourId}', [PlanningTourController::class, 'destroy']);
    Route::post('/tontines/{id}/cycles/ouvrir', [CycleTontineController::class, 'ouvrir']);
    Route::post('/tontines/{id}/cycles/import-historique', [CycleTontineController::class, 'importHistorique']);
    Route::post('/tontines/{id}/cycles/import-historique/fichier', [CycleTontineController::class, 'importHistoriqueFichier']);
    Route::post('/tontines/{id}/enregistrer-beneficiaire', [CycleTontineController::class, 'enregistrerBeneficiaire']);
    Route::post('/tontines/{id}/activer-cagnotte', [TontineController::class, 'activerCagnotte']);
    Route::get('/tontines/{id}/cagnotte/proposition', [CagnotteController::class, 'proposition']);
    Route::get('/tontines/{id}/remises-gain', [CagnotteController::class, 'index']);
    Route::post('/tontines/{id}/remises-gain', [CagnotteController::class, 'store']);
    Route::get('/membres/{id}/initialisation', [InitialisationMembreController::class, 'show']);
    Route::post('/membres/{id}/initialisation', [InitialisationMembreController::class, 'store']);
    Route::post('/caisses/{id}/activer-epargne', [EpargneController::class, 'activer']);
    Route::get('/caisses/{id}/epargne/soldes', [EpargneController::class, 'soldes']);
    Route::get('/caisses/{id}/epargne/membres', [EpargneController::class, 'membres']);
    Route::post('/caisses/{id}/epargne/depots', [EpargneController::class, 'deposer']);
    Route::post('/caisses/{id}/epargne/cassation', [EpargneController::class, 'cassation']);
    Route::post('/caisses/{id}/epargne/couper-garantie', [EpargneController::class, 'couperGarantie']);
    Route::get('/cycles/{id}', [CycleTontineController::class, 'show']);
    Route::post('/cycles/{id}/cotisations', [CycleTontineController::class, 'saisirCotisations']);
    Route::post('/cycles/{id}/encheres', [CycleTontineController::class, 'placerEnchere']);
    Route::post('/cycles/{id}/designer-gagnant', [CycleTontineController::class, 'designerGagnant']);
    Route::delete('/cycles/{id}/encheres', [CycleTontineController::class, 'annulerEncheres']);
    Route::post('/cycles/{id}/cloturer', [CycleTontineController::class, 'cloturer']);
    Route::delete('/cycles/{id}', [CycleTontineController::class, 'annulerCycle']);
    Route::get('/cycles/{id}/bulletin', [CycleTontineController::class, 'bulletin']);
    Route::get('/bulletins/{id}/pdf', [CycleTontineController::class, 'bulletinPdf']);
    Route::post('/bulletins/{id}/signer', [CycleTontineController::class, 'signer']);
    Route::post('/bulletins/{id}/retenues', [CycleTontineController::class, 'ajouterRetenue']);
    Route::post('/bulletins/{id}/payer', [CycleTontineController::class, 'payerBulletin']);
    Route::post('/bulletins/{id}/annuler-versement', [CycleTontineController::class, 'annulerVersementBulletin']);
    Route::post('/bulletins/{id}/annuler', [CycleTontineController::class, 'annulerBulletin']);

    // ── Finance ─────────────────────────────────────────────────
    // Routes littérales AVANT apiResource ET contrainte UUID sur {caisse} : ce
    // conflit (GET/POST /caisses/transferts intercepté par la route show du
    // resource) a déjà régressé une fois après un reordering accidentel — la
    // contrainte whereUuid() le rend impossible structurellement, peu importe l'ordre.
    Route::post('/caisses/transferts', [CaisseController::class, 'transfert']);
    Route::get('/caisses/transferts', [CaisseController::class, 'transferts']);
    Route::post('/caisses/transferts/{id}/approuver', [CaisseController::class, 'approuverTransfert']);
    Route::get('/caisses/journal-global', [CaisseController::class, 'journalGlobal']);
    Route::post('/caisses/import-historique', [CaisseController::class, 'importHistorique']);
    Route::post('/caisses/import-historique/fichier', [CaisseController::class, 'importHistoriqueFichier']);
    Route::apiResource('caisses', CaisseController::class)->except(['destroy'])->whereUuid('caisse');
    Route::post('/caisses/{id}/transactions', [CaisseController::class, 'transaction']);
    Route::get('/caisses/{id}/journal', [CaisseController::class, 'journal']);
    Route::get('/comptes-bancaires', [CompteBancaireController::class, 'index']);
    Route::post('/comptes-bancaires', [CompteBancaireController::class, 'store']);
    Route::put('/comptes-bancaires/{id}', [CompteBancaireController::class, 'update']);

    Route::apiResource('prets', PretController::class)->except(['destroy'])->whereUuid('pret');
    Route::post('/prets/import-historique', [PretController::class, 'importHistorique']);
    Route::post('/prets/import-historique/fichier', [PretController::class, 'importHistoriqueFichier']);
    Route::post('/prets/{id}/valider', [PretController::class, 'valider']);
    Route::post('/prets/{id}/approuver', [PretController::class, 'approuver']);
    Route::post('/prets/{id}/refuser', [PretController::class, 'refuser']);
    Route::post('/prets/{id}/decaisser', [PretController::class, 'decaisser']);
    Route::post('/prets/{id}/rembourser', [PretController::class, 'rembourser']);
    Route::post('/prets/{id}/rembourser-libre', [PretController::class, 'rembourserLibre']);
    Route::get('/prets/{id}/echeances', [PretController::class, 'echeances']);

    // ── Sanctions & Social ──────────────────────────────────────
    Route::apiResource('sanctions', SanctionController::class)->except(['destroy'])->whereUuid('sanction');
    Route::post('/sanctions/import-historique', [SanctionController::class, 'importHistorique']);
    Route::post('/sanctions/import-historique/fichier', [SanctionController::class, 'importHistoriqueFichier']);
    Route::post('/decisions-ag/import-historique', [DecisionAgController::class, 'importHistorique']);
    Route::post('/decisions-ag/import-historique/fichier', [DecisionAgController::class, 'importHistoriqueFichier']);
    Route::post('/sanctions/{id}/payer', [SanctionController::class, 'payer']);
    Route::get('/types-sanction', [TypeSanctionController::class, 'index']);
    Route::post('/types-sanction', [TypeSanctionController::class, 'store']);
    Route::put('/types-sanction/{id}', [TypeSanctionController::class, 'update']);
    Route::delete('/types-sanction/{id}', [TypeSanctionController::class, 'destroy']);

    Route::apiResource('aides-sociales', AideSocialeController::class)->except(['destroy'])->whereUuid('aides_sociale');
    Route::post('/aides-sociales/{id}/valider', [AideSocialeController::class, 'valider']);
    Route::post('/aides-sociales/{id}/refuser', [AideSocialeController::class, 'refuser']);
    Route::post('/aides-sociales/{id}/verser', [AideSocialeController::class, 'verser']);
    Route::get('/types-aide-sociale', [TypeAideSocialeController::class, 'index']);
    Route::post('/types-aide-sociale', [TypeAideSocialeController::class, 'store']);
    Route::put('/types-aide-sociale/{id}', [TypeAideSocialeController::class, 'update']);
    Route::delete('/types-aide-sociale/{id}', [TypeAideSocialeController::class, 'destroy']);

    // ── Postes & mandats ────────────────────────────────────────
    Route::get('/postes', [PosteController::class, 'index']);
    Route::post('/postes', [PosteController::class, 'store']);
    Route::get('/postes/{id}/mandats', [PosteController::class, 'mandats']);
    Route::post('/postes/{id}/mandats', [PosteController::class, 'attribuer']);
    Route::put('/mandats/{id}/cloturer', [PosteController::class, 'cloturerMandat']);

    // ── Décisions d'AG ──────────────────────────────────────────
    Route::get('/decisions-ag', [DecisionAgController::class, 'index']);
    Route::post('/decisions-ag', [DecisionAgController::class, 'store']);
    Route::get('/decisions-ag/{id}', [DecisionAgController::class, 'show']);

    // ── Règlement intérieur ─────────────────────────────────────
    Route::get('/reglements', [ReglementInterieurController::class, 'index']);
    Route::get('/reglements/actif', [ReglementInterieurController::class, 'actif']);
    Route::post('/reglements', [ReglementInterieurController::class, 'store']);
    Route::get('/reglements/{id}', [ReglementInterieurController::class, 'show']);

    // ── Paramètres ──────────────────────────────────────────────
    Route::post('/uploads', [UploadController::class, 'store']);
    Route::get('/parametres', [ParametreController::class, 'index']);
    Route::put('/parametres', [ParametreController::class, 'update']);

    // ── Rapprochement bancaire ──────────────────────────────────
    Route::get('/rapprochements', [RapprochementBancaireController::class, 'index']);
    Route::post('/rapprochements', [RapprochementBancaireController::class, 'store']);
    Route::post('/rapprochements/{id}/justifier', [RapprochementBancaireController::class, 'justifier']);
    Route::get('/rapprochements/en-retard', [RapprochementBancaireController::class, 'enRetard']);

    // ── Utilisateurs ────────────────────────────────────────────
    Route::get('/utilisateurs', [UtilisateurController::class, 'index']);
    Route::post('/utilisateurs', [UtilisateurController::class, 'store']);
    Route::get('/utilisateurs/{id}', [UtilisateurController::class, 'show']);
    Route::put('/utilisateurs/{id}', [UtilisateurController::class, 'update']);
    Route::post('/utilisateurs/{id}/activer', [UtilisateurController::class, 'activer']);
    Route::post('/utilisateurs/{id}/desactiver', [UtilisateurController::class, 'desactiver']);

    // ── Journal d'audit ─────────────────────────────────────────
    Route::get('/audit-log', [AuditLogController::class, 'index']);

    // ── Portail membre (isolation stricte RG-SEC-006) ──────────
    Route::get('/portail/moi', [PortalController::class, 'show']);

    // ── Exports CSV / XLSX natifs (sans dépendance externe) ────
    Route::get('/exports/membres.csv', [ExportController::class, 'membresCsv']);
    Route::get('/exports/membres.xlsx', [ExportController::class, 'membresXlsx']);
    Route::get('/exports/transactions.csv', [ExportController::class, 'transactionsCsv']);
    Route::get('/exports/transactions.xlsx', [ExportController::class, 'transactionsXlsx']);
    Route::get('/exports/sanctions.csv', [ExportController::class, 'sanctionsCsv']);
    Route::get('/exports/sanctions.xlsx', [ExportController::class, 'sanctionsXlsx']);
    Route::get('/exports/membres/{id}/releve.pdf', [ExportController::class, 'releveMembrePdf']);
    Route::get('/exports/cycles/{id}/rapport.pdf', [ExportController::class, 'rapportCyclePdf']);
    Route::get('/exports/bilan-annuel/{annee}.pdf', [ExportController::class, 'bilanAnnuelPdf']);
});
