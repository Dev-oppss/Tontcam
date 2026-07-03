// Nécessite : npm install jspdf xlsx
import { jsPDF } from 'jspdf';
import { fmt, fmtDate } from '../data/mockData';

/* ── Export CSV / XLSX générique (listes membres, transactions, sanctions…) ── */
export function exportToCSV(rows, headers, filename = 'export.csv') {
  const escape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = [headers.map(escape).join(';'), ...rows.map((r) => r.map(escape).join(';'))];
  const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  downloadBlob(blob, filename);
}

export async function exportToXLSX(rows, headers, filename = 'export.xlsx', sheetName = 'Données') {
  const XLSX = await import('xlsx');
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, filename);
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

/* ── PDF : en-tête commun association ── */
function pdfHeader(doc, association, title, ref) {
  doc.setFillColor(11, 13, 18);
  doc.rect(0, 0, 210, 26, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(13);
  doc.text(association?.nom?.toUpperCase() || 'TONTIX', 14, 12);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
  doc.text(title, 14, 19);
  doc.setFontSize(8);
  doc.text(`N° ${ref}`, 196, 12, { align: 'right' });
  doc.text('CONFIDENTIEL', 196, 19, { align: 'right' });
  doc.setTextColor(20, 20, 20);
}

function pdfFooter(doc) {
  const page = doc.internal.getCurrentPageInfo().pageNumber;
  doc.setFontSize(7.5); doc.setTextColor(140, 140, 140);
  doc.text(`Généré le ${new Date().toLocaleDateString('fr-FR')} — Page ${page}`, 105, 290, { align: 'center' });
}

/* ── Bulletin de gain (RG-TON-034 à 040) ── */
export function exportBulletinGainPDF(bulletin, association) {
  const doc = new jsPDF();
  const ref = bulletin.numero || `BG-${new Date().getFullYear()}-${String(bulletin.id).padStart(3, '0')}`;
  pdfHeader(doc, association, `Bulletin de gain — Cycle #${bulletin.numeroTour}`, ref);

  let y = 38;
  doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.text('BÉNÉFICIAIRE', 14, y);
  doc.setFont('helvetica', 'normal');
  doc.text(bulletin.nomMembre, 14, y + 6);
  doc.text(`Part #${bulletin.numeroPart || '—'}`, 14, y + 11);
  if (bulletin.avaliste) doc.text(`Avaliste : ${bulletin.avaliste}`, 14, y + 16);

  doc.setFont('helvetica', 'bold'); doc.text('CYCLE', 120, y);
  doc.setFont('helvetica', 'normal');
  doc.text(`Mode : ${bulletin.modeAttribution || '—'}`, 120, y + 6);
  doc.text(`Date : ${fmtDate(bulletin.date)}`, 120, y + 11);

  y += 26;
  doc.setDrawColor(220, 220, 220); doc.line(14, y, 196, y);
  y += 8;

  const rows = [
    ['Cotisations collectées (gain brut)', '+', bulletin.gainBrut],
    ...(bulletin.retenues || []).map((r) => [r.libelle, '−', r.montant]),
  ];
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8);
  doc.text('LIBELLÉ', 14, y); doc.text('MONTANT', 180, y, { align: 'right' });
  y += 5; doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
  rows.forEach(([libelle, signe, montant]) => {
    doc.text(libelle, 14, y);
    doc.setTextColor(signe === '−' ? 200 : 30, signe === '−' ? 60 : 130, signe === '−' ? 50 : 60);
    doc.text(`${signe} ${fmt(montant)}`, 180, y, { align: 'right' });
    doc.setTextColor(20, 20, 20);
    y += 6;
  });

  y += 4;
  doc.setFillColor(76, 95, 214);
  doc.rect(14, y, 182, 10, 'F');
  doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
  doc.text('MONTANT NET À VERSER', 18, y + 6.5);
  doc.text(fmt(bulletin.gainNet), 192, y + 6.5, { align: 'right' });
  doc.setTextColor(20, 20, 20);

  y += 26;
  ['Signature Trésorier', 'Signature Président', 'Signature Bénéficiaire'].forEach((label, i) => {
    const x = 14 + i * 62;
    doc.setDrawColor(180); doc.line(x, y + 14, x + 52, y + 14);
    doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.text(label, x, y + 19);
  });

  pdfFooter(doc);
  doc.save(`${ref}.pdf`);
}

/* ── Relevé de compte membre (RG-MBR-016 / RG-RPT-003) ── */
export function exportRelevePDF(membre, transactions, association, periode) {
  const doc = new jsPDF();
  const ref = `REL-${membre.id}-${Date.now().toString().slice(-6)}`;
  pdfHeader(doc, association, `Relevé de compte — ${membre.nom} ${membre.prenom}`, ref);

  let y = 36;
  doc.setFontSize(9);
  doc.text(`Période : ${periode || 'Toutes opérations'}`, 14, y);
  y += 10;

  doc.setFont('helvetica', 'bold');
  ['Date', 'Type', 'Libellé', 'Montant', 'Statut'].forEach((h, i) => doc.text(h, 14 + i * 38, y));
  y += 4; doc.setDrawColor(220); doc.line(14, y, 196, y); y += 6;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5);

  transactions.forEach((t) => {
    if (y > 275) { doc.addPage(); pdfFooter(doc); y = 20; }
    doc.text(fmtDate(t.date), 14, y);
    doc.text(t.type, 52, y);
    doc.text(String(t.libelle).slice(0, 26), 90, y);
    doc.setTextColor(t.montant < 0 ? 200 : 30, t.montant < 0 ? 60 : 130, t.montant < 0 ? 50 : 60);
    doc.text(fmt(t.montant), 150, y);
    doc.setTextColor(20, 20, 20);
    doc.text(t.statut || '—', 178, y);
    y += 6;
  });

  pdfFooter(doc);
  doc.save(`${ref}.pdf`);
}
