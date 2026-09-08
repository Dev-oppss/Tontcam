<?php

namespace App\Console\Commands;

use App\Models\EcheancePret;
use App\Services\PretService;
use App\Services\SanctionService;
use Illuminate\Console\Command;

/**
 * RG-PRT-020 : jusqu'ici aucun mécanisme ne détectait automatiquement une
 * échéance de prêt impayée — SanctionService::retardPret() existait mais
 * n'était appelée nulle part, et PretService::verifierDefauts() portait un
 * commentaire "à appeler via scheduler quotidien" sans jamais être
 * enregistrée dans le scheduler. Un prêt non remboursé restait donc figé en
 * 'en_cours' indéfiniment, sans pénalité ni passage en défaut.
 *
 * Cette commande ferme ce trou :
 *  1. Repère les échéances encore 'a_venir'/'due' dont la date est dépassée
 *     sur un prêt actif (en_cours ou déjà en_retard) ;
 *  2. Fait passer le prêt en 'en_retard' s'il ne l'était pas déjà ;
 *  3. Applique la pénalité + la sanction automatique via
 *     SanctionService::retardPret() (qui bascule l'échéance en
 *     'penalisee' — elle ne sera donc plus reprise par la requête ci-dessus
 *     les prochains jours, garantissant qu'elle n'est traitée qu'une fois) ;
 *  4. Fait passer en 'defaut' les prêts non régularisés depuis 90+ jours via
 *     PretService::verifierDefauts().
 */
class DetecterRetardsPretsCommand extends Command
{
    protected $signature = 'prets:detecter-retards';

    protected $description = "Détecte les échéances de prêt en retard, applique la pénalité et la sanction automatique (RG-PRT-020), puis passe en défaut les prêts non régularisés depuis 90 jours";

    public function handle(SanctionService $sanctionService, PretService $pretService): int
    {
        $nbEcheancesTraitees = 0;

        EcheancePret::whereIn('statut', ['a_venir', 'due'])
            ->where('date_echeance', '<', now()->toDateString())
            ->whereHas('pret', fn ($q) => $q->whereIn('statut', ['en_cours', 'en_retard']))
            ->with('pret')
            ->chunkById(100, function ($echeances) use (&$nbEcheancesTraitees, $sanctionService) {
                foreach ($echeances as $echeance) {
                    $pret = $echeance->pret;

                    if ($pret->statut === 'en_cours') {
                        $pret->update(['statut' => 'en_retard']);
                    }

                    // Bascule l'échéance en 'penalisee' + applique la pénalité et la
                    // sanction — elle ne matchera donc plus la requête ci-dessus.
                    $sanctionService->retardPret($pret->fresh(), $echeance);

                    $nbEcheancesTraitees++;
                }
            });

        $nbPassesEnDefaut = $pretService->verifierDefauts();

        $this->info("{$nbEcheancesTraitees} échéance(s) de prêt passée(s) en retard et pénalisée(s).");
        $this->info("{$nbPassesEnDefaut} prêt(s) passé(s) en défaut (90 jours+ sans régularisation).");

        return self::SUCCESS;
    }
}
