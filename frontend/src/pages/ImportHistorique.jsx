import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, DatabaseBackup, FileJson, LockKeyhole } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { PageHeader, SectionCard } from '../components/ui/index';
import AssistantImportHistorique from '../components/import/AssistantImportHistorique';

const EXEMPLES = {
  transactions: { lignes: [{ caisse_id: 'Caisse principale', sens: 'entree', montant: 50000, libelle: 'Cotisation historique', date_transaction: '15/01/2025', mode_paiement: 'especes' }], transferts: [] },
  decisions: { decisions: [{ reunion_id: '15/01/2025', numero_decision: 'AG-2025-001', type: 'financier', objet: 'Adoption du budget', quorum_present: 12, votes_pour: 10, votes_contre: 1, votes_abstention: 1, statut: 'adopte', date_effet: '15/01/2025' }] },
  prets: { pret_ref: 'PRET-1', caisse_id: 'Caisse principale', emprunteur_id: 'Nom Prénom du membre', montant_principal: 100000, taux_interet_mensuel: 0.02, statut: 'en_cours', date_demande: '05/01/2025', echeances: [{ numero_echeance: 1, date_echeance: '05/02/2025', montant_capital: 20000, montant_interet: 2000, statut: 'a_venir' }] },
  sanctions: { membre_id: 'Nom Prénom du membre', type_sanction_id: 'Libellé de la sanction', motif: 'Retard de cotisation', date_application: '15/01/2025' },
  cycles: { tontine_id: 'Nom de la tontine', reunion_id: '15/01/2025', gagnant_part_id: 'Nom Prénom du gagnant', date_ouverture: '15/01/2025', date_cloture: '15/01/2025', gain_verse: true, mode_versement: 'especes', cotisations: [{ tontine_part_id: 'Nom Prénom du membre', montant_verse: 10000, date_versement: '15/01/2025' }] },
};

const LABELS = { transactions: 'Journal de caisse et transferts', decisions: 'Décisions d\u2019AG', prets: 'Prêts historiques', sanctions: 'Sanctions historiques', cycles: 'Cycles de tontine' };

export default function ImportHistorique() {
  const { user, tontines, membres, membresParTontine, banques, typesSanction, importerHistorique, importerHistoriqueFichier } = useApp();
  const [type, setType] = useState('transactions');
  const [tontineId, setTontineId] = useState('');
  const [busy, setBusy] = useState(false);
  const [resultat, setResultat] = useState(null);
  const [modeAvance, setModeAvance] = useState(false);
  const [texte, setTexte] = useState(() => JSON.stringify(EXEMPLES.transactions, null, 2));
  const [erreurAvance, setErreurAvance] = useState('');
  const exemple = useMemo(() => JSON.stringify(EXEMPLES[type], null, 2), [type]);

  if (user?.role !== 'super_admin') {
    return <div className="p-8 text-center text-ink-600"><LockKeyhole className="mx-auto mb-3" />Accès réservé au super administrateur.</div>;
  }

  const changerType = (nouveau) => {
    setType(nouveau); setTexte(JSON.stringify(EXEMPLES[nouveau], null, 2));
    setResultat(null); setTontineId(''); setErreurAvance('');
  };

  const membresTontine = type === 'cycles' && tontineId
    ? membresParTontine.filter((p) => p.idTontine === tontineId).map((p) => membres.find((m) => m.id === p.idMembre)).filter(Boolean)
    : null;

  const importerFichier = async (fichier) => {
    if (type === 'cycles' && !tontineId) return null;
    setBusy(true); setResultat(null);
    try {
      const res = await importerHistoriqueFichier(type, fichier, tontineId);
      if (res) setResultat(res);
      return res;
    } finally { setBusy(false); }
  };

  const importerJson = async () => {
    let payload;
    try { payload = JSON.parse(texte); } catch { setErreurAvance('Le contenu doit être un JSON valide.'); return; }
    setBusy(true); setErreurAvance('');
    try { await importerHistorique(type, payload); } catch (err) { setErreurAvance(err?.message || 'Import refusé.'); } finally { setBusy(false); }
  };

  return <div className="space-y-6">
    <PageHeader title="Reprise d\u2019historique" subtitle="Import initial d\u2019une association déjà active avant TONTIX." />
    <SectionCard title="Accès exceptionnel" subtitle="Réservé au super administrateur. Importez dans l\u2019ordre chronologique ; les écritures ne peuvent pas être annulées automatiquement.">
      <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"><DatabaseBackup size={18} className="shrink-0" />Créez d\u2019abord les membres, caisses, tontines et parts historiques dans l\u2019app. Vous pourrez ensuite les désigner ici par leur nom — pas besoin d\u2019identifiant technique.</div>
    </SectionCard>
    <SectionCard title="Type d\u2019historique">
      <div className="flex flex-wrap gap-2">{Object.entries(LABELS).map(([key, label]) => <button key={key} onClick={() => changerType(key)} className={type === key ? 'btn-primary text-xs' : 'btn-secondary text-xs'}>{label}</button>)}</div>
    </SectionCard>

    {type === 'cycles' && <SectionCard title="Tontine concernée">
      <select className="select" value={tontineId} onChange={(e) => setTontineId(e.target.value)}>
        <option value="">Sélectionner…</option>
        {tontines.map((t) => <option key={t.id} value={t.id}>{t.nom}</option>)}
      </select>
    </SectionCard>}

    {(type !== 'cycles' || tontineId) && <SectionCard title={LABELS[type]} subtitle="Une ligne à la fois — comme remplir un cahier.">
      <AssistantImportHistorique
        type={type}
        tontineId={tontineId}
        busy={busy}
        onImporter={importerFichier}
        contexte={{ membres, caisses: banques, tontines, typesSanction, membresTontine }}
      />
      {resultat && <div className="mt-4 rounded-xl border border-ink-200 bg-white p-3 text-xs space-y-2">
        <p className="font-semibold text-ink-800">{resultat.crees} ligne(s)/groupe(s) importé(s){resultat.erreurs?.length ? `, ${resultat.erreurs.length} en erreur` : ''}</p>
        {resultat.erreurs?.length > 0 && <ul className="space-y-1 max-h-48 overflow-auto">
          {resultat.erreurs.map((e, i) => <li key={i} className="text-red-600">Ligne {e.ligne ?? (Array.isArray(e.lignes) ? e.lignes.join(', ') : e.cycle_ref ?? e.pret_ref ?? '?')} : {e.erreur}</li>)}
        </ul>}
      </div>}
    </SectionCard>}

    <button onClick={() => setModeAvance((v) => !v)} className="flex items-center gap-2 text-xs text-ink-500 hover:text-ink-700">
      {modeAvance ? <ChevronUp size={14} /> : <ChevronDown size={14} />} Mode avancé (coller un fichier CSV/XLSX ou du JSON)
    </button>

    {modeAvance && <SectionCard title="Mode avancé" subtitle="Réservé aux utilisateurs à l\u2019aise avec l\u2019informatique — collez un lot JSON ou déposez un fichier.">
      <div className="grid lg:grid-cols-2 gap-4">
        <div><p className="text-xs font-semibold text-ink-700 mb-2">Données à importer (JSON)</p><textarea className="input min-h-[300px] font-mono text-xs" value={texte} onChange={(e) => setTexte(e.target.value)} spellCheck="false" /></div>
        <div><p className="text-xs font-semibold text-ink-700 mb-2">Modèle attendu</p><pre className="min-h-[300px] overflow-auto rounded-xl bg-slate-950 p-4 text-xs text-slate-100">{exemple}</pre></div>
      </div>
      {erreurAvance && <p className="mt-3 text-sm text-red-600">{erreurAvance}</p>}
      <div className="mt-4 flex justify-end"><button onClick={importerJson} disabled={busy} className="btn-primary"><FileJson size={15} />{busy ? 'Import en cours…' : 'Importer ce lot JSON'}</button></div>
      <p className="mt-4 text-xs text-ink-500">Les noms (membre, caisse, réunion par sa date...) sont acceptés partout où un identifiant est attendu, aussi bien en JSON qu\u2019en CSV/XLSX déposé depuis l\u2019assistant ci-dessus.</p>
    </SectionCard>}
  </div>;
}
