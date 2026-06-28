<?php

namespace App\Services;

class SimplePdfService
{
    public function render(array $lines, string $title = 'TontineApp'): string
    {
        $lines = array_values(array_filter(array_map(fn ($line) => (string) $line, $lines), fn ($line) => $line !== ''));
        $text = $title . "\n\n" . implode("\n", $lines);
        $text = str_replace(["\\", "(", ")", "\r"], ["\\\\", "\\(", "\\)", ""], $text);
        $text = str_replace("\n", "\\n", $text);

        $objects = [];
        $objects[] = "<< /Type /Catalog /Pages 2 0 R >>";
        $objects[] = "<< /Type /Pages /Kids [3 0 R] /Count 1 >>";
        $objects[] = "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>";
        $stream = "BT /F1 12 Tf 40 800 Td (" . $text . ") Tj ET";
        $objects[] = "<< /Length " . strlen($stream) . " >>\nstream\n{$stream}\nendstream";
        $objects[] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";

        $pdf = "%PDF-1.4\n";
        $offsets = [0];
        foreach ($objects as $i => $object) {
            $offsets[] = strlen($pdf);
            $pdf .= ($i + 1) . " 0 obj\n{$object}\nendobj\n";
        }

        $xref = strlen($pdf);
        $pdf .= "xref\n0 " . (count($objects) + 1) . "\n";
        $pdf .= "0000000000 65535 f \n";
        for ($i = 1; $i <= count($objects); $i++) {
            $pdf .= sprintf("%010d 00000 n \n", $offsets[$i]);
        }
        $pdf .= "trailer << /Size " . (count($objects) + 1) . " /Root 1 0 R >>\n";
        $pdf .= "startxref\n{$xref}\n%%EOF";

        return $pdf;
    }
}
