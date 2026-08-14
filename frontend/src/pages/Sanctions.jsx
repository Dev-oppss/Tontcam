import { useState } from 'react';
import { ShieldAlert, Plus, Settings2, CreditCard } from 'lucide-react';
import { fmt, fmtDate, typeSancLabel } from '../data/mockData';
import { useApp } from '../context/AppContext';
import { PageHeader, Table, Badge, Modal, FormField } from '../components/ui/index';
import { ModePaiementFields, isModePaiementValid, ModePaiementBadge } from '../components/ui/ModePaiement';
import { getMissingFields } from '../lib/validation';

const PRESET_TYPES = [
  { code: 'retard_cotisation', libelle: 'Retard de cotisation', montantFixe: 2500 },
  { code: 'absence_non_excusee', libelle: 'Absence non excusée', montantFixe: 5000 },
  { code: 'insubordination', libelle: 'Insubordination', montantFixe: 10000 },
  { code: 'insulte', libelle: 'Insulte', montantFixe: 15000 },
];

const emptyCustomType = () => ({
  libelle: '',
  montant: '',
});

const slugify = (value) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '_')
  .replace(/^_+|_+$/g, '');

export default function Sanctions() {
  const { membres, sanctions, reunions, addSanction, payerSanction, typesSanction, addTypeSanction, showToast } = useApp();
  const [add, setAdd] = useState(false);
  const [addType, setAddType] = useState(false);
  const [form, setForm] = useState({
    idMembre: '',
    nomMembre: '',
    typeSanction: 'retard_cotisation',
    montant: 2500,
    numReunion: '',
    dateSanction: new Date().toISOString().split('T')[0],
  });
  const [customTypeForm, setCustomTypeForm] = useState(emptyCustomType());
  const [payModal, setPayModal] = useState(null);
  const [payModePaiement, setPayModePaiement] = useState('especes');
  const [payDetailsPaiement, setPayDetailsPaiement] = useState('');

  const handlePayer = () => {
    if (!isModePaiementValid(payModePaiement, payDetailsPaiement)) { showToast?.('Référence de paiement requise pour ce mode de versement.', 'error'); return; }
    payerSanction(payModal.id, { modePaiement: payModePaiement, detailsPaiement: payDetailsPaiement });
    setPayModal(null);
    setPayModePaiement('especes');
    setPayDetailsPaiement('');
  };

  const impayees = sanctions.filter(s=>s.statut==='impayee');
  const payees   = sanctions.filter(s=>s.statut==='payee');
  const typeV    = { retard_cotisation:'amber', absence_non_excusee:'red', insubordination:'red', insulte:'red', autre:'gray' };
  const montantsParType = Object.fromEntries(PRESET_TYPES.map((t) => [t.code, t.montantFixe]));

  const resetForm = () => {
    setForm({
      idMembre: '',
      nomMembre: '',
      typeSanction: 'retard_cotisation',
      montant: 2500,
      numReunion: '',
      dateSanction: new Date().toISOString().split('T')[0],
    });
    setCustomTypeForm(emptyCustomType());
  };

  const handleSelectType = (value) => {
    if (value === 'autre') {
      setForm((f) => ({ ...f, typeSanction: value, montant: Number(customTypeForm.montant || f.montant || 0) }));
      return;
    }
    setForm((f) => ({
      ...f,
      typeSanction: value,
      montant: montantsParType[value] || f.montant,
    }));
  };

  const ensureCustomType = async () => {
    const libelle = customTypeForm.libelle.trim();
    if (!libelle) return null;
    const code = slugify(libelle);
    const already = typesSanction.find((item) => item.code === code || String(item.libelle || '').toLowerCase() === libelle.toLowerCase());
    if (already) return already;
    return addTypeSanction({
      libelle,
      code,
      montantFixe: Number(customTypeForm.montant || 0),
      delaiReglementJours: 7,
      estAutomatique: false,
      modeCalcul: 'fixe',
    });
  };

  const handleAdd = async () => {
    const missing = getMissingFields(form, [{ key: 'idMembre', label: 'Membre' }]);
    if (form.typeSanction === 'autre' && !customTypeForm.libelle.trim()) missing.push('Libellé de la sanction');
    if (missing.length) { showToast?.(`Champ(s) requis manquant(s) : ${missing.join(', ')}`, 'error'); return; }
    const m = membres.find(x=>x.id===form.idMembre);
    let typeCode = form.typeSanction;
    let motif = typeSancLabel[typeCode] || typeCode;
    let montant = Number(form.montant || 0);

    if (typeCode === 'autre') {
      const created = await ensureCustomType();
      if (!created) { showToast?.('Libellé de la sanction requis.', 'error'); return; }
      typeCode = created.code;
      motif = created.libelle || customTypeForm.libelle.trim();
      montant = Number(created.montantFixe ?? customTypeForm.montant ?? form.montant ?? 0);
    }

    addSanction({
      idMembre: form.idMembre,
      nomMembre: `${m.nom} ${m.prenom}`,
      typeSanction: typeCode,
      motif,
      montant,
      numReunion: form.numReunion,
      dateSanction: form.dateSanction,
    });
    setAdd(false);
    resetForm();
  };

  const handleAddType = () => {
    if (!customTypeForm.libelle.trim()) { showToast?.('Libellé requis.', 'error'); return; }
    addTypeSanction({
      libelle: customTypeForm.libelle.trim(),
      code: slugify(customTypeForm.libelle),
      montantFixe: Number(customTypeForm.montant || 0),
      delaiReglementJours: 7,
      estAutomatique: false,
      modeCalcul: 'fixe',
    });
    setAddType(false);
    setCustomTypeForm(emptyCustomType());
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Sanctions" subtitle="Types de sanction paramétrables et pénalités des membres"
        action={
          <div className="flex gap-2">
            <button onClick={()=>setAddType(true)} className="btn-secondary"><Settings2 size={15}/> Paramètres</button>
            <button onClick={()=>setAdd(true)} className="btn-primary"><Plus size={15}/> Nouvelle sanction</button>
          </div>
        }/>

      <div className="grid grid-cols-3 gap-4">
        <div className="card text-center border-t-4 border-t-red-400">
          <p className="text-2xl font-bold text-red-600">{impayees.length}</p>
          <p className="text-xs text-gray-400 mt-1">Sanctions impayées</p>
          <p className="text-sm font-semibold text-red-500 mt-0.5">{fmt(impayees.reduce((s,x)=>s+x.montant,0))}</p>
        </div>
        <div className="card text-center border-t-4 border-t-green-400">
          <p className="text-2xl font-bold text-primary-600">{payees.length}</p>
          <p className="text-xs text-gray-400 mt-1">Sanctions réglées</p>
          <p className="text-sm font-semibold text-primary-500 mt-0.5">{fmt(payees.reduce((s,x)=>s+x.montant,0))}</p>
        </div>
        <div className="card text-center border-t-4 border-t-amber-400">
          <p className="text-2xl font-bold text-gray-800">{sanctions.length}</p>
          <p className="text-xs text-gray-400 mt-1">Total sanctions</p>
        </div>
      </div>

        <div className="card">
        <h3 className="font-semibold text-gray-800 mb-3">Catalogue des sanctions</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {(typesSanction.length ? typesSanction : PRESET_TYPES).map((t) => (
            <div key={t.code || t.libelle} className="p-3 rounded-xl border border-surface-200 bg-surface-50">
              <p className="text-sm font-semibold text-ink-800">{t.libelle}</p>
              <p className="text-xs text-ink-600/50 mt-1">{fmt(t.montantFixe || 0)}</p>
            </div>
          ))}
        </div>
      </div>

      {impayees.length>0&&(
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-sm font-semibold text-red-700 mb-2 flex items-center gap-1.5"><ShieldAlert size={14}/>Amendes impayées</p>
          {impayees.map(s=>(
            <div key={s.id} className="flex items-center justify-between text-sm py-1.5 border-b border-red-100 last:border-0">
              <span className="font-medium text-red-800">{s.nomMembre}</span>
              <span className="text-gray-500 text-xs">{s.motif || typeSancLabel[s.typeSanction] || s.typeSanction}</span>
              <span className="font-bold text-red-600">{fmt(s.montant)}</span>
            </div>
          ))}
        </div>
      )}

      <div className="card p-0 overflow-hidden">
        <Table headers={['Membre','Réunion','Type','Motif','Origine','Montant','Date','Statut','Paiement','Action']}>
          {sanctions.map(s=>{
            const reu = reunions.find(r => r.id === s.numReunion);
            return (
            <tr key={s.id} className="hover:bg-gray-50 transition-colors">
              <td className="td font-medium text-gray-800">{s.nomMembre}</td>
              <td className="td text-gray-500">{reu ? `N°${reu.numero} — ${fmtDate(reu.date)}` : (s.numReunion ? '—' : '—')}</td>
              <td className="td"><Badge variant={typeV[s.typeSanction]}>{typeSancLabel[s.typeSanction]||s.typeSanction}</Badge></td>
              <td className="td text-gray-500 max-w-[220px] truncate" title={s.motif}>{s.motif || '—'}</td>
              <td className="td"><Badge variant={s.estAutomatique ? 'amber' : 'gray'}>{s.estAutomatique ? 'Automatique' : 'Manuelle'}</Badge></td>
              <td className="td font-bold text-red-600">{fmt(s.montant)}</td>
              <td className="td text-gray-500">{fmtDate(s.dateSanction)}</td>
              <td className="td"><Badge variant={s.statut==='payee'?'green':'red'}>{s.statut==='payee'?'Payée':'Impayée'}</Badge></td>
              <td className="td">
                {s.statut === 'payee'
                  ? <ModePaiementBadge modePaiement={s.modePaiement} detailsPaiement={s.detailsPaiement} />
                  : <span className="text-ink-600/30 text-xs">—</span>}
              </td>
              <td className="td">
                {s.statut==='impayee'&&(
                  <button onClick={()=>setPayModal(s)} className="btn-primary py-1 px-2.5 text-xs flex items-center gap-1">
                    <CreditCard size={12}/>Marquer payée
                  </button>
                )}
              </td>
            </tr>
          );})}
        </Table>
      </div>

      <Modal open={add} onClose={()=>setAdd(false)} title="Nouvelle sanction"
        footer={<><button onClick={()=>setAdd(false)} className="btn-secondary">Annuler</button><button onClick={handleAdd} className="btn-danger"><ShieldAlert size={14}/>Enregistrer</button></>}>
        <div className="space-y-4">
          <FormField label="Membre" required>
            <select className="select" value={form.idMembre} onChange={e=>setForm(f=>({...f,idMembre:e.target.value}))}>
              <option value="">Sélectionner…</option>
              {membres.map(m=><option key={m.id} value={m.id}>{m.nom} {m.prenom}</option>)}
            </select>
          </FormField>
          <FormField label="Type de sanction" required>
            <select className="select" value={form.typeSanction} onChange={e=>handleSelectType(e.target.value)}>
              {PRESET_TYPES.map((type) => <option key={type.code} value={type.code}>{type.libelle}</option>)}
              <option value="autre">Autre</option>
            </select>
          </FormField>
          {form.typeSanction === 'autre' && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-amber-900">Type personnalisé</p>
                  <p className="text-xs text-amber-700 mt-1">Ce type sera sauvegardé et réutilisable pour les prochains membres.</p>
                </div>
              </div>
              <FormField label="Libellé de la sanction" required>
                <input className="input" value={customTypeForm.libelle} onChange={e=>setCustomTypeForm(f=>({...f,libelle:e.target.value}))} placeholder="Ex : Retard de réunion, refus de participation…" />
              </FormField>
              <FormField label="Montant (FCFA)" required>
                <input type="number" className="input" value={customTypeForm.montant} onChange={e=>setCustomTypeForm(f=>({...f,montant:e.target.value}))} />
              </FormField>
            </div>
          )}
          {form.typeSanction !== 'autre' && (
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Montant (FCFA)">
                <input type="number" className="input" value={form.montant} onChange={e=>setForm(f=>({...f,montant:e.target.value}))}/>
              </FormField>
              <FormField label="N° Réunion concernée">
                <input type="number" className="input" placeholder="7" value={form.numReunion} onChange={e=>setForm(f=>({...f,numReunion:e.target.value}))}/>
              </FormField>
            </div>
          )}
          {form.typeSanction === 'autre' && (
            <div className="grid grid-cols-2 gap-3">
              <FormField label="N° Réunion concernée">
                <input type="number" className="input" placeholder="7" value={form.numReunion} onChange={e=>setForm(f=>({...f,numReunion:e.target.value}))}/>
              </FormField>
              <div className="hidden md:block" />
            </div>
          )}
          <FormField label="Date">
            <input type="date" className="input" value={form.dateSanction} onChange={e=>setForm(f=>({...f,dateSanction:e.target.value}))}/>
          </FormField>
        </div>
      </Modal>

      <Modal open={addType} onClose={()=>setAddType(false)} title="Paramétrer un type de sanction"
        footer={<><button onClick={()=>setAddType(false)} className="btn-secondary">Annuler</button><button onClick={handleAddType} className="btn-primary"><Settings2 size={14}/>Enregistrer</button></>}>
        <div className="space-y-4">
          <FormField label="Libellé" required>
            <input className="input" value={customTypeForm.libelle} onChange={e=>setCustomTypeForm(f=>({...f,libelle:e.target.value}))} placeholder="Ex : Retard de cotisation" />
          </FormField>
          <FormField label="Montant (FCFA)" required>
            <input type="number" className="input" value={customTypeForm.montant} onChange={e=>setCustomTypeForm(f=>({...f,montant:e.target.value}))} />
          </FormField>
        </div>
      </Modal>

      <Modal open={!!payModal} onClose={()=>setPayModal(null)} title="Régler la sanction"
        footer={<>
          <button onClick={()=>setPayModal(null)} className="btn-secondary">Annuler</button>
          <button onClick={handlePayer} disabled={!isModePaiementValid(payModePaiement, payDetailsPaiement)}
            className={`btn-primary ${!isModePaiementValid(payModePaiement, payDetailsPaiement) ? 'opacity-40 cursor-not-allowed' : ''}`}>
            <CreditCard size={14}/>Confirmer le paiement
          </button>
        </>}>
        {payModal && (
          <div className="space-y-4">
            <div className="p-3 bg-red-50 rounded-xl border border-red-100">
              <p className="text-sm font-semibold text-red-800">{payModal.nomMembre}</p>
              <p className="text-xs text-red-600 mt-0.5">{payModal.motif || typeSancLabel[payModal.typeSanction] || payModal.typeSanction} — <strong>{fmt(payModal.montant)}</strong></p>
            </div>
            <ModePaiementFields
              modePaiement={payModePaiement}
              detailsPaiement={payDetailsPaiement}
              onModeChange={(v)=>{ setPayModePaiement(v); setPayDetailsPaiement(''); }}
              onDetailsChange={setPayDetailsPaiement}
            />
          </div>
        )}
      </Modal>
    </div>
  );
}
