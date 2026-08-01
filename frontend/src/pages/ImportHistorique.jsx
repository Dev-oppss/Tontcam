import { useMemo, useState } from 'react';
import { DatabaseBackup, FileJson, LockKeyhole, Upload } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { PageHeader, SectionCard } from '../components/ui/index';

const EXEMPLES = {
  transactions: { lignes: [{ caisse_id: 'UUID_CAISSE', sens: 'entree', montant: 50000, libelle: 'Cotisation historique', date_transaction: '2025-01-15', mode_paiement: 'especes' }], transferts: [] },
  decisions: { decisions: [{ reunion_id: 'UUID_REUNION', numero_decision: 'AG-2025-001', type: 'financier', objet: 'Adoption du budget', quorum_present: 12, votes_pour: 10, votes_contre: 1, votes_abstention: 1, statut: 'adopte', date_effet: '2025-01-15' }] },
  prets: { caisse_id: 'UUID_CAISSE', emprunteur_id: 'UUID_MEMBRE', montant_principal: 100000, taux_interet_mensuel: 0.02, statut: 'en_cours', date_demande: '2025-01-05', echeances: [{ numero_echeance: 1, date_echeance: '2025-02-05', montant_capital: 20000, montant_interet: 2000, statut: 'a_venir' }] },
  sanctions: { membre_id: 'UUID_MEMBRE', type_sanction_id: 'UUID_TYPE_SANCTION', motif: 'Retard de cotisation', date_application: '2025-01-15' },
  cycles: { tontine_id: 'UUID_TONTINE', reunion_id: 'UUID_REUNION', gagnant_part_id: 'UUID_PART', date_ouverture: '2025-01-15', date_cloture: '2025-01-15', gain_verse: true, mode_versement: 'especes', cotisations: [{ tontine_part_id: 'UUID_PART', montant_verse: 10000, date_versement: '2025-01-15' }] },
};

const LABELS = { transactions: 'Journal de caisse et transferts', decisions: 'Décisions d’AG', prets: 'Prêts historiques', sanctions: 'Sanctions historiques', cycles: 'Cycles de tontine' };

export default function ImportHistorique() {
  const { user, importerHistorique } = useApp();
  const [type, setType] = useState('transactions');
  const [texte, setTexte] = useState(() => JSON.stringify(EXEMPLES.transactions, null, 2));
  const [erreur, setErreur] = useState('');
  const [busy, setBusy] = useState(false);
  const exemple = useMemo(() => JSON.stringify(EXEMPLES[type], null, 2), [type]);

  if (user?.role !== 'super_admin') {
    return <div className="p-8 text-center text-ink-600"><LockKeyhole className="mx-auto mb-3" />Accès réservé au super administrateur.</div>;
  }

  const changerType = (nouveau) => { setType(nouveau); setTexte(JSON.stringify(EXEMPLES[nouveau], null, 2)); setErreur(''); };
  const importer = async () => {
    let payload;
    try { payload = JSON.parse(texte); } catch { setErreur('Le contenu doit être un JSON valide.'); return; }
    setBusy(true); setErreur('');
    try { await importerHistorique(type, payload); } catch (err) { setErreur(err?.message || 'Import refusé.'); } finally { setBusy(false); }
  };

  return <div className="space-y-6">
    <PageHeader title="Reprise d’historique" subtitle="Import initial d’une association déjà active avant TONTIX." />
    <SectionCard title="Accès exceptionnel" subtitle="Réservé au super administrateur. Importez dans l’ordre chronologique ; les écritures ne peuvent pas être annulées automatiquement.">
      <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"><DatabaseBackup size={18} className="shrink-0" />Créez d’abord les membres, caisses, tontines, parts et réunions historiques. Utilisez ensuite leurs UUID dans les imports.</div>
    </SectionCard>
    <SectionCard title="Type d’historique">
      <div className="flex flex-wrap gap-2">{Object.entries(LABELS).map(([key, label]) => <button key={key} onClick={() => changerType(key)} className={type === key ? 'btn-primary text-xs' : 'btn-secondary text-xs'}>{label}</button>)}</div>
    </SectionCard>
    <SectionCard title={LABELS[type]} subtitle="Collez un lot JSON. Reprenez les UUID depuis l’API ou les exports techniques.">
      <div className="grid lg:grid-cols-2 gap-4">
        <div><p className="text-xs font-semibold text-ink-700 mb-2">Données à importer</p><textarea className="input min-h-[430px] font-mono text-xs" value={texte} onChange={(e) => setTexte(e.target.value)} spellCheck="false" /></div>
        <div><p className="text-xs font-semibold text-ink-700 mb-2">Modèle attendu</p><pre className="min-h-[430px] overflow-auto rounded-xl bg-slate-950 p-4 text-xs text-slate-100">{exemple}</pre></div>
      </div>
      {erreur && <p className="mt-3 text-sm text-red-600">{erreur}</p>}
      <div className="mt-4 flex justify-end"><button onClick={importer} disabled={busy} className="btn-primary"><Upload size={15} />{busy ? 'Import en cours…' : 'Importer ce lot'}</button></div>
    </SectionCard>
    <p className="text-xs text-ink-500 flex items-center gap-1"><FileJson size={13} />Les transactions, prêts, sanctions et mouvements de cycle sont journalisés côté serveur.</p>
  </div>;
}
