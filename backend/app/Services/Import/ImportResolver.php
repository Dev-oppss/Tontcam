<?php

namespace App\Services\Import;

use App\Models\Caisse;
use App\Models\Membre;
use App\Models\Reunion;
use App\Models\TontinePart;
use App\Models\TypeSanction;
use App\Services\AccessScopeService;
use RuntimeException;

/**
 * Permet aux imports historiques (CSV/XLSX) d'accepter des noms lisibles au
 * lieu d'UUID, et des dates au format courant (jj/mm/aaaa) au lieu d'ISO.
 *
 * Objectif : les utilisateurs (souvent des tresoriers ages, peu familiers de
 * l'informatique) recopient un cahier papier tel quel - "Ngo Bella" plutot
 * que "3f2a1c4e-...", "15/03/2004" plutot que "2004-03-15" - meme pour un
 * historique tres ancien : aucune contrainte de date recente n'est imposee.
 *
 * Chaque methode renvoie soit une valeur deja valide (UUID/date ISO transmis
 * tel quel, pour compatibilite avec les imports JSON existants), soit une
 * valeur resolue, soit leve une RuntimeException au message comprehensible
 * (deja remontee ligne par ligne par les controleurs appelants).
 */
class ImportResolver
{
    private const RE_UUID = '/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i';

    public function __construct(private AccessScopeService $scope) {}

    public function estUuid(?string $valeur): bool
    {
        return is_string($valeur) && preg_match(self::RE_UUID, trim($valeur)) === 1;
    }

    /**
     * Convertit une date en 'Y-m-d'. Accepte jj/mm/aaaa, jj-mm-aaaa,
     * jj.mm.aaaa, aaaa-mm-jj, aaaa/mm/jj — sans limite d'anciennete.
     */
    public function date(mixed $valeur): ?string
    {
        $valeur = trim((string) ($valeur ?? ''));
        if ($valeur === '') {
            return null;
        }
        foreach (['d/m/Y', 'd-m-Y', 'd.m.Y', 'Y-m-d', 'Y/m/d', 'd/m/y'] as $format) {
            $d = \DateTime::createFromFormat('!' . $format, $valeur);
            $erreurs = \DateTime::getLastErrors();
            if ($d !== false && (! $erreurs || ($erreurs['warning_count'] === 0 && $erreurs['error_count'] === 0))) {
                return $d->format('Y-m-d');
            }
        }
        $ts = strtotime($valeur);
        if ($ts !== false) {
            return date('Y-m-d', $ts);
        }
        throw new RuntimeException("date \"$valeur\" illisible — utilisez jj/mm/aaaa (ex: 15/03/2004).");
    }

    /** Résout un membre par nom complet ("Nom Prenom" ou "Prenom Nom"), sinon UUID direct. */
    public function membre(?string $valeur): ?string
    {
        return $this->resoudre($valeur, Membre::query()->where('association_id', $this->scope->associationId()), ['nom', 'prenom'], 'membre');
    }

    /** Résout une caisse par libellé, sinon UUID direct. */
    public function caisse(?string $valeur): ?string
    {
        return $this->resoudre($valeur, Caisse::query()->whereHas('association', fn ($q) => $this->scope->scopeAssociation($q)), ['libelle'], 'caisse');
    }

    /** Résout un type de sanction par libellé, sinon UUID direct. */
    public function typeSanction(?string $valeur): ?string
    {
        return $this->resoudre($valeur, TypeSanction::query()->where('association_id', $this->scope->associationId()), ['libelle'], 'type de sanction');
    }

    /**
     * Résout une réunion par sa date (jj/mm/aaaa) — au besoin suffixée
     * "#2" pour désambiguïser si plusieurs réunions ont eu lieu le même jour
     * (ex: "12/05/2024 #2" = la 2e réunion de ce jour, par ordre de numéro).
     */
    public function reunion(?string $valeur): ?string
    {
        $valeur = trim((string) ($valeur ?? ''));
        if ($valeur === '' ) {
            return null;
        }
        if ($this->estUuid($valeur)) {
            return $valeur;
        }
        [$datePart, $rang] = array_pad(array_map('trim', explode('#', $valeur, 2)), 2, null);
        $dateIso = $this->date($datePart);
        $reunions = Reunion::where('association_id', $this->scope->associationId())
            ->whereDate('date_reunion', $dateIso)
            ->orderBy('numero')
            ->get();
        if ($reunions->isEmpty()) {
            throw new RuntimeException("aucune réunion trouvée à la date $datePart.");
        }
        if ($reunions->count() === 1) {
            return $reunions->first()->id;
        }
        if ($rang !== null && ctype_digit($rang) && isset($reunions[(int) $rang - 1])) {
            return $reunions[(int) $rang - 1]->id;
        }
        throw new RuntimeException("plusieurs réunions le $datePart — précisez \"$datePart #1\", \"$datePart #2\"... (numéro d'ordre de la réunion ce jour-là).");
    }

    /**
     * Résout une part de tontine par nom du membre titulaire (au sein d'une
     * tontine donnée) — suffixe "#2" si le membre détient plusieurs parts.
     */
    public function partTontine(?string $valeur, string $tontineId): ?string
    {
        $valeur = trim((string) ($valeur ?? ''));
        if ($valeur === '') {
            return null;
        }
        if ($this->estUuid($valeur)) {
            return $valeur;
        }
        [$nomPart, $rang] = array_pad(array_map('trim', explode('#', $valeur, 2)), 2, null);
        $membreId = $this->membre($nomPart);
        $parts = TontinePart::where('tontine_id', $tontineId)->where('membre_id', $membreId)->orderBy('numero_part')->get();
        if ($parts->isEmpty()) {
            throw new RuntimeException("\"$nomPart\" ne détient aucune part dans cette tontine.");
        }
        if ($parts->count() === 1) {
            return $parts->first()->id;
        }
        if ($rang !== null && ctype_digit($rang) && isset($parts[(int) $rang - 1])) {
            return $parts[(int) $rang - 1]->id;
        }
        throw new RuntimeException("\"$nomPart\" détient plusieurs parts — précisez \"$nomPart #1\", \"$nomPart #2\"...");
    }

    private function resoudre(?string $valeur, $query, array $colonnesNom, string $libelleType): ?string
    {
        $valeur = trim((string) ($valeur ?? ''));
        if ($valeur === '') {
            return null;
        }
        if ($this->estUuid($valeur)) {
            return $valeur;
        }
        $cible = mb_strtolower($valeur);
        $query->where(function ($q) use ($colonnesNom, $cible) {
            foreach ($colonnesNom as $col) {
                $q->orWhereRaw('LOWER(TRIM(' . $col . ')) = ?', [$cible]);
            }
            if (count($colonnesNom) >= 2) {
                $concat = 'LOWER(TRIM(CONCAT(' . implode(", ' ', ", $colonnesNom) . ')))';
                $concatInverse = 'LOWER(TRIM(CONCAT(' . implode(", ' ', ", array_reverse($colonnesNom)) . ')))';
                $q->orWhereRaw("$concat = ?", [$cible])->orWhereRaw("$concatInverse = ?", [$cible]);
            }
        });
        $resultats = $query->limit(2)->get();
        if ($resultats->isEmpty()) {
            throw new RuntimeException("$libelleType \"$valeur\" introuvable — vérifiez l'orthographe exacte, ou utilisez son identifiant.");
        }
        if ($resultats->count() > 1) {
            throw new RuntimeException("plusieurs $libelleType" . "s correspondent à \"$valeur\" — utilisez son identifiant exact pour lever l'ambiguïté.");
        }
        return $resultats->first()->id;
    }
}
