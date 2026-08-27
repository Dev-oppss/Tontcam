<?php

namespace App\Services\Import;

use Illuminate\Http\UploadedFile;
use RuntimeException;
use ZipArchive;

/**
 * Lit un fichier CSV ou XLSX uploade et retourne un tableau de lignes
 * associatives (cle = en-tete de colonne, en minuscules et sans espaces).
 *
 * Volontairement sans dependance Composer (PhpSpreadsheet, league/csv...) :
 * cet environnement n'a pas acces a Packagist. Le format XLSX est un simple
 * zip contenant du XML (OOXML) - on le lit avec ZipArchive + SimpleXML,
 * toutes deux des extensions PHP natives.
 */
class TabularFileReader
{
    /** @return array<int, array<string, string|null>> */
    public function lire(UploadedFile $fichier): array
    {
        $extension = strtolower($fichier->getClientOriginalExtension());

        return match ($extension) {
            'csv', 'txt' => $this->lireCsv($fichier->getRealPath()),
            'xlsx' => $this->lireXlsx($fichier->getRealPath()),
            default => throw new RuntimeException("Format de fichier non supporté : .$extension (utilisez .csv ou .xlsx)."),
        };
    }

    private function lireCsv(string $chemin): array
    {
        $handle = fopen($chemin, 'r');
        if (! $handle) {
            throw new RuntimeException('Impossible de lire le fichier CSV.');
        }

        // Tolère un BOM UTF-8 en tête de fichier (Excel en ajoute un par defaut
        // a l'export "CSV UTF-8"), sinon le premier en-tete serait corrompu.
        $premiereLigne = fgets($handle);
        $premiereLigne = preg_replace('/^\xEF\xBB\xBF/', '', $premiereLigne ?: '');
        rewind($handle);
        $bomLength = str_starts_with((string) fgets($handle), "\xEF\xBB\xBF") ? 3 : 0;
        rewind($handle);
        if ($bomLength) {
            fread($handle, $bomLength);
        }

        $delimiteur = $this->detecterDelimiteur($premiereLigne);
        $entetes = fgetcsv($handle, 0, $delimiteur);
        if (! $entetes) {
            fclose($handle);
            return [];
        }
        $entetes = array_map(fn ($e) => $this->normaliserEntete((string) $e), $entetes);

        $lignes = [];
        while (($valeurs = fgetcsv($handle, 0, $delimiteur)) !== false) {
            if (count(array_filter($valeurs, fn ($v) => $v !== null && $v !== '')) === 0) {
                continue; // ligne vide, ignorée
            }
            $valeurs = array_pad($valeurs, count($entetes), null);
            $ligne = array_combine($entetes, array_slice($valeurs, 0, count($entetes)));
            $lignes[] = $this->normaliserValeursVides($ligne);
        }
        fclose($handle);

        return $lignes;
    }

    private function detecterDelimiteur(string $premiereLigne): string
    {
        // Les exports Excel FR utilisent ; par defaut (car , sert de separateur
        // decimal) ; on detecte le plus frequent des deux sur l'entete.
        return substr_count($premiereLigne, ';') > substr_count($premiereLigne, ',') ? ';' : ',';
    }

    private function lireXlsx(string $chemin): array
    {
        $zip = new ZipArchive();
        if ($zip->open($chemin) !== true) {
            throw new RuntimeException('Fichier XLSX invalide ou corrompu.');
        }

        $chainesPartagees = $this->lireChainesPartagees($zip);

        $feuilleXml = $zip->getFromName('xl/worksheets/sheet1.xml');
        if ($feuilleXml === false) {
            $zip->close();
            throw new RuntimeException('Aucune feuille trouvée dans le fichier XLSX (attendu : la première feuille).');
        }
        $zip->close();

        $xml = simplexml_load_string($feuilleXml);
        if ($xml === false) {
            throw new RuntimeException('Feuille XLSX illisible (XML invalide).');
        }

        $grille = []; // [rowIndex][colLetter] => valeur
        foreach ($xml->sheetData->row as $row) {
            $rIndex = (int) $row['r'];
            foreach ($row->c as $cell) {
                $ref = (string) $cell['r'];
                preg_match('/^([A-Z]+)(\d+)$/', $ref, $m);
                $colonne = $m[1] ?? null;
                if (! $colonne) {
                    continue;
                }
                $type = (string) $cell['t'];
                $valeurBrute = isset($cell->v) ? (string) $cell->v : null;
                if ($type === 's' && $valeurBrute !== null) {
                    $valeurBrute = $chainesPartagees[(int) $valeurBrute] ?? '';
                } elseif ($type === 'inlineStr') {
                    $valeurBrute = (string) ($cell->is->t ?? '');
                }
                $grille[$rIndex][$colonne] = $valeurBrute;
            }
        }

        if (empty($grille)) {
            return [];
        }

        ksort($grille);
        $indices = array_keys($grille);
        $premiereRangee = $grille[$indices[0]];
        ksort($premiereRangee);
        $colonnesEntetes = array_keys($premiereRangee);
        $entetes = array_map(fn ($v) => $this->normaliserEntete((string) $v), array_values($premiereRangee));

        $lignes = [];
        foreach (array_slice($indices, 1) as $rIndex) {
            $rangee = $grille[$rIndex];
            $valeurs = [];
            foreach ($colonnesEntetes as $i => $col) {
                $valeurs[$entetes[$i]] = $rangee[$col] ?? null;
            }
            if (count(array_filter($valeurs, fn ($v) => $v !== null && $v !== '')) === 0) {
                continue;
            }
            $lignes[] = $this->normaliserValeursVides($valeurs);
        }

        return $lignes;
    }

    /** @return array<int, string> */
    private function lireChainesPartagees(ZipArchive $zip): array
    {
        $xmlContent = $zip->getFromName('xl/sharedStrings.xml');
        if ($xmlContent === false) {
            return [];
        }
        $xml = simplexml_load_string($xmlContent);
        if ($xml === false) {
            return [];
        }
        $chaines = [];
        foreach ($xml->si as $i => $si) {
            // <t> direct, ou concatenation de plusieurs <r><t>...</t></r> (texte enrichi)
            if (isset($si->t)) {
                $chaines[$i] = (string) $si->t;
            } else {
                $chaines[$i] = implode('', array_map(fn ($r) => (string) $r->t, iterator_to_array($si->r ?? [])));
            }
        }
        return $chaines;
    }

    private function normaliserEntete(string $entete): string
    {
        $entete = trim(mb_strtolower($entete));
        $entete = strtr($entete, ['é' => 'e', 'è' => 'e', 'ê' => 'e', 'à' => 'a', 'ù' => 'u', 'ô' => 'o', 'î' => 'i', 'ç' => 'c', 'ï' => 'i', 'ë' => 'e', 'â' => 'a']);
        $entete = preg_replace('/[^a-z0-9]+/', '_', $entete);
        return trim($entete, '_');
    }

    /**
     * Une cellule vide (CSV comme XLSX) vaut '' apres lecture, jamais null -
     * contrairement a un champ simplement absent d'un payload JSON. Sans
     * cette normalisation, chaque endpoint d'import devrait re-gerer ce cas
     * lui-meme (ex: array_sum() plante sur '', 'nullable'/'??' ne traitent
     * pas '' comme absent) : on le fait une seule fois, ici, a la source.
     */
    private function normaliserValeursVides(array $ligne): array
    {
        return array_map(fn ($v) => (is_string($v) && trim($v) === '') ? null : $v, $ligne);
    }

}
