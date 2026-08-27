import { useState, useEffect } from 'react';
import { Gavel, Plus, Trophy, AlertTriangle } from 'lucide-react';
import { fmt, fmtDate } from '../data/mockData';
import { useApp } from '../context/AppContext';
import { PageHeader, Table, Badge, Modal, FormField } from '../components/ui/index';
import { getMissingFields } from '../lib/validation';
import { useAsyncGuard } from '../hooks/useAsyncGuard';

export default function Encheres() {
  const { membres, membresParTontine, encheres, rotations, tontines, chargerRotations, addEnchere, attribuerTour, annulerEncheres, showToast } = useApp();

  useEffect(() => {
    tontines.filter(t => t.typeAttribution === 'enchere').forEach(t => chargerRotations(t.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tontines.map(t => t.id).join(',')]);

  const [addModal, setAddModal]   = useState(false);
  const [confirm,  setConfirm]    = useState(null); // { type:'attribuer'|'annuler', rotation, gagnant? }
  const [form, setForm] = useState({ idMembre:'', montantEnchere:'', dateEnchere: new Date().toISOString().split('T')[0] });

  // Tour en attente d'attribution
  const tourEnCours = rotations.find(r => !r.dateAttribution);
  const encTour = tourEnCours ? encheres.filter(e => e.idRotation === tourEnCours.id) : [];
  const potTotal = tourEnCours?.montantTotal || 0;

  const maxEnchere = encTour.length > 0
    ? encTour.reduce((max, e) => e.montantEnchere > max.montantEnchere ? e : max, encTour[0])
    : null;

  const handleAdd = async () => {
    const missing = getMissingFields(form, [
      { key: 'idMembre', label: 'Membre' },
      { key: 'montantEnchere', label: "Montant de l'enchère" },
    ]);
    if (missing.length) { showToast?.(`Champ(s) requis manquant(s) : ${missing.join(', ')}`, 'error'); return; }
    const m = membres.find(x => x.id === form.idMembre);
    await addEnchere({
      idRotation: tourEnCours?.id,
      idTontine: tourEnCours?.idTontine,
      idMembre: form.idMembre,
      nomMembre: `${m.nom} ${m.prenom}`,
      montantEnchere: Number(form.montantEnchere),
      dateEnchere: form.dateEnchere,
    });
    setAddModal(false);
    setForm({ idMembre:'', montantEnchere:'', dateEnchere: new Date().toISOString().split('T')[0] });
  };
  const [guardedHandleAdd, addingEnchere] = useAsyncGuard(handleAdd);

  const handleConfirm = async () => {
    if (!confirm) return;
    if (confirm.type === 'attribuer') {
      const montantRecu = potTotal - (confirm.gagnant.montantEnchere || 0);
      await attribuerTour(confirm.rotation.id, confirm.gagnant.idMembre, montantRecu);
    } else {
      await annulerEncheres(confirm.rotation.id);
    }
    setConfirm(null);
  };
  const [guardedHandleConfirm, confirming] = useAsyncGuard(handleConfirm);

  const membresDejaMis = encTour.map(e => e.idMembre);

  return (
    <div className="space-y-6">
      <PageHeader title="Enchères" subtitle="Gestion des enchères pour la prochaine rotation"
        action={<button onClick={()=>setAddModal(true)} className="btn-primary" disabled={!tourEnCours}>
          <Plus size={15}/> Enregistrer enchère
        </button>}/>

      {!tourEnCours && (
        <div className="card text-center py-12 text-gray-400">
          <Trophy size={40} className="mx-auto mb-3 text-gray-200"/>
          <p className="font-medium">Tous les tours ont été attribués</p>
          <p className="text-sm mt-1">Aucun tour en attente d'enchère</p>
        </div>
      )}

      {tourEnCours && (
        <>
          {/* Simulation */}
          <div className="card border-l-4 border-l-amber-500 bg-amber-50/40">
            <div className="flex items-start gap-3">
              <Gavel size={20} className="text-amber-600 mt-0.5 shrink-0"/>
              <div className="flex-1">
                <p className="font-semibold text-gray-800 mb-3">Tour N°{tourEnCours.numeroTour} — En cours d'enchères</p>
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div className="p-3 bg-white rounded-xl text-center border border-amber-100">
                    <p className="text-xs text-gray-400 mb-1">Pot total</p>
                    <p className="text-lg font-bold text-gray-800">{fmt(potTotal)}</p>
                  </div>
                  <div className="p-3 bg-white rounded-xl text-center border border-amber-100">
                    <p className="text-xs text-gray-400 mb-1">Meilleure enchère</p>
                    {maxEnchere ? (
                      <>
                        <p className="text-lg font-bold text-amber-600">{fmt(maxEnchere.montantEnchere)}</p>
                        <p className="text-xs text-gray-500">{maxEnchere.nomMembre}</p>
                      </>
                    ) : (
                      <p className="text-sm text-gray-400 italic">Aucune enchère</p>
                    )}
                  </div>
                  <div className="p-3 bg-primary-50 rounded-xl text-center border border-primary-100">
                    <p className="text-xs text-gray-400 mb-1">Gagnant recevra</p>
                    <p className="text-lg font-bold text-primary-600">
                      {maxEnchere ? fmt(potTotal - maxEnchere.montantEnchere) : fmt(potTotal)}
                    </p>
                  </div>
                </div>
                {maxEnchere && (
                  <div className="mt-3 p-3 bg-white rounded-xl border border-amber-100 text-xs text-gray-500">
                    Redistribution : {fmt(maxEnchere.montantEnchere)} ÷ 22 parts = <strong>{fmt(Math.round(maxEnchere.montantEnchere/22))}/part</strong>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Tableau enchères */}
          <div className="card p-0 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-semibold text-gray-800">Enchères reçues — Tour N°{tourEnCours.numeroTour}</h3>
              <Badge variant="amber">{encTour.length} enchère(s)</Badge>
            </div>
            {encTour.length === 0 ? (
              <p className="text-center text-gray-400 py-8 text-sm">Aucune enchère reçue pour ce tour</p>
            ) : (
              <Table headers={['Rang','Membre','Montant enchère','Date','Statut']}>
                {[...encTour].sort((a,b)=>b.montantEnchere-a.montantEnchere).map((e,i)=>(
                  <tr key={e.id} className="hover:bg-gray-50 transition-colors">
                    <td className="td">
                      {i===0
                        ? <div className="flex items-center gap-1.5 text-amber-600 font-bold"><Trophy size={14}/>1er</div>
                        : <span className="text-gray-400 font-medium">{i+1}e</span>}
                    </td>
                    <td className="td font-semibold text-gray-800">{e.nomMembre}</td>
                    <td className="td"><span className={`font-bold text-lg ${i===0?'text-amber-600':'text-gray-700'}`}>{fmt(e.montantEnchere)}</span></td>
                    <td className="td text-gray-500">{fmtDate(e.dateEnchere)}</td>
                    <td className="td"><Badge variant={i===0?'amber':'gray'}>{i===0?'Meilleure offre':'En attente'}</Badge></td>
                  </tr>
                ))}
              </Table>
            )}

            <div className="px-6 py-3 border-t border-gray-100 flex gap-3 justify-end">
              <button
                onClick={()=>setConfirm({type:'annuler',rotation:tourEnCours})}
                className="btn-secondary"
                disabled={encTour.length===0}>
                <AlertTriangle size={14}/>Annuler les enchères
              </button>
              <button
                onClick={()=>maxEnchere&&setConfirm({type:'attribuer',rotation:tourEnCours,gagnant:maxEnchere})}
                className="btn-amber"
                disabled={!maxEnchere}>
                <Gavel size={14}/>
                {maxEnchere ? `Attribuer à ${maxEnchere.nomMembre}` : 'Aucune enchère'}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Historique des tours attribués */}
      {rotations.filter(r=>r.dateAttribution).length > 0 && (
        <div className="card p-0 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-800">Historique des attributions</h3>
          </div>
          <Table headers={['Tour','Bénéficiaire','Enchère gagnante','Montant reçu','Date']}>
            {rotations.filter(r=>r.dateAttribution).reverse().map(r=>(
              <tr key={r.id} className="hover:bg-gray-50">
                <td className="td"><div className="w-8 h-8 rounded-xl gradient-primary flex items-center justify-center text-white text-xs font-bold">{r.numeroTour}</div></td>
                <td className="td font-semibold text-gray-800">{r.beneficiaire}</td>
                <td className="td text-amber-600 font-bold">{r.enchere>0?fmt(r.enchere):'—'}</td>
                <td className="td font-bold text-primary-600">{fmt(r.montantRecu)}</td>
                <td className="td text-gray-500">{fmtDate(r.dateAttribution)}</td>
              </tr>
            ))}
          </Table>
        </div>
      )}

      {/* Modal nouvelle enchère */}
      <Modal open={addModal} onClose={()=>setAddModal(false)} title="Enregistrer une enchère"
        footer={<><button onClick={()=>setAddModal(false)} disabled={addingEnchere} className="btn-secondary">Annuler</button><button onClick={guardedHandleAdd} disabled={addingEnchere} className="btn-primary"><Gavel size={14}/>{addingEnchere ? 'Enregistrement…' : 'Enregistrer'}</button></>}>
        <div className="space-y-4">
          {tourEnCours&&(
            <div className="p-3 bg-amber-50 rounded-xl text-sm text-amber-800">
              Pot total du tour N°{tourEnCours.numeroTour} : <strong>{fmt(potTotal)}</strong>
            </div>
          )}
          <FormField label="Membre" required>
            <select className="select" value={form.idMembre} onChange={e=>setForm(f=>({...f,idMembre:e.target.value}))}>
              <option value="">Sélectionner un membre…</option>
              {membres.filter(m=>m.statut==='actif'&&!membresDejaMis.includes(m.id)).map(m=>{
                const parts = membresParTontine.filter(mt=>mt.idMembre===m.id).reduce((s,mt)=>s+mt.nombreParts,0);
                return <option key={m.id} value={m.id}>{m.nom} {m.prenom} ({parts} part{parts>1?'s':''})</option>;
              })}
            </select>
          </FormField>
          <FormField label="Montant de l'enchère (FCFA)" required>
            <input type="number" className="input" placeholder="150000" step="5000"
              value={form.montantEnchere} onChange={e=>setForm(f=>({...f,montantEnchere:e.target.value}))}/>
          </FormField>
          <FormField label="Date de l'enchère">
            <input type="date" className="input" value={form.dateEnchere}
              onChange={e=>setForm(f=>({...f,dateEnchere:e.target.value}))}/>
          </FormField>
        </div>
      </Modal>

      {/* Modal confirmation */}
      <Modal open={!!confirm} onClose={()=>setConfirm(null)} title={confirm?.type==='attribuer'?'Confirmer l\'attribution':'Confirmer l\'annulation'}
        footer={<>
          <button onClick={()=>setConfirm(null)} disabled={confirming} className="btn-secondary">Annuler</button>
          <button onClick={guardedHandleConfirm} disabled={confirming} className={confirm?.type==='attribuer'?'btn-amber':'btn-danger'}>
            {confirming ? 'Veuillez patienter…' : (confirm?.type==='attribuer'?<><Gavel size={14}/>Confirmer l'attribution</>:<><AlertTriangle size={14}/>Oui, annuler</>)}
          </button>
        </>}>
        {confirm?.type==='attribuer' ? (
          <div className="space-y-3 text-sm">
            <p className="text-gray-700">Vous allez attribuer le tour N°<strong>{confirm?.rotation?.numeroTour}</strong> à :</p>
            <div className="p-4 bg-amber-50 rounded-xl text-center">
              <p className="font-bold text-amber-800 text-lg">{confirm?.gagnant?.nomMembre}</p>
              <p className="text-amber-600">Enchère : {fmt(confirm?.gagnant?.montantEnchere)}</p>
              <p className="text-primary-700 font-semibold mt-1">Montant reçu : {fmt(potTotal - (confirm?.gagnant?.montantEnchere||0))}</p>
            </div>
            <p className="text-gray-500 text-xs">Cette action est irréversible.</p>
          </div>
        ) : (
          <p className="text-sm text-gray-600">Toutes les enchères du tour N°<strong>{confirm?.rotation?.numeroTour}</strong> seront supprimées. Êtes-vous sûr ?</p>
        )}
      </Modal>
    </div>
  );
}
