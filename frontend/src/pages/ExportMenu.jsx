import { useState, useRef, useEffect } from 'react';
import { Download, FileText, FileSpreadsheet, FileType } from 'lucide-react';

/**
 * <ExportMenu
 *   onPDF={() => exportBulletinGainPDF(bulletin, association)}   // optionnel
 *   onXLSX={() => exportToXLSX(rows, headers, 'membres.xlsx')}   // optionnel
 *   onCSV={() => exportToCSV(rows, headers, 'membres.csv')}      // optionnel
 * />
 */
export function ExportMenu({ onPDF, onXLSX, onCSV, label = 'Exporter' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)} className="btn-secondary">
        <Download size={14} /> {label}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-44 rounded-xl border border-white/60 bg-white/70 backdrop-blur-2xl backdrop-saturate-150 shadow-[0_20px_50px_rgba(11,13,18,.18)] z-20 overflow-hidden">
          {onPDF && (
            <button onClick={() => { onPDF(); setOpen(false); }} className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-ink-800 hover:bg-white/60 transition-colors">
              <FileText size={14} className="text-red-500" /> PDF
            </button>
          )}
          {onXLSX && (
            <button onClick={() => { onXLSX(); setOpen(false); }} className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-ink-800 hover:bg-white/60 transition-colors">
              <FileSpreadsheet size={14} className="text-emerald-600" /> Excel (XLSX)
            </button>
          )}
          {onCSV && (
            <button onClick={() => { onCSV(); setOpen(false); }} className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-ink-800 hover:bg-white/60 transition-colors">
              <FileType size={14} className="text-indigo-500" /> CSV
            </button>
          )}
        </div>
      )}
    </div>
  );
}
