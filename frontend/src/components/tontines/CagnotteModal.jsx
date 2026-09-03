import { useEffect, useState } from 'react';
import { Coins, Send, History } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Modal } from '../ui/index';

const fmt = (n) => Number(n || 0).toLocaleString('fr-FR');
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

export default function CagnotteModal({ tontine, onClose }) {
  const { activerCagnotte, chargerPropositionCagnotte, chargerRemisesGain, creerRemiseGain } = useApp();
  const [onglet, setOnglet] = useState('proposition'); // 'proposition' | 'historique'
  const [lignes, setLignes] = useState([]);
  const [historique, setHistorique] = useState([]);
  const [selection, setSelection] = useState({}); // { tontine_part_id: montant }
  const [loading, setLoading] = useState(false);
  const [loadingHisto, setLoadingHisto] = useState(false);
  const [envoi, setEnvoi] = useState(false);

  const charger = async () => {
    if (!tontine.modeCagnotte) return;
    setLoading(true);
    const props = await chargerPropositionCagnotte(tontine.id);
    setLignes(props || []);
    setLoading(false);
  };

  const chargerHistorique = async () => {
    if (!tontine.modeCagnotte) return;
    setLoadingHisto(true);
    const res = await chargerRemisesGain(tontine.id);
    setHistorique(res || []);
    setLoadingHisto(false);
  };

  useEffect(() => { charger(); }, [tontine.id, tontine.modeCagnotte]);
  useEffect(() => { if (onglet === 'historique') chargerHistorique(); }, [onglet, tontine.id]);

  const toggle = (l) => setSelection((s) => {
    const copie = { ...s };
    if (copie[l.tontine_part_id] !== undefined) delete copie[l.tontine_part_id];
    else copie[l.tontine_part_id] = l.solde_propose;
    return copie;
  });

  const changerMontant = (id, valeur) => setSelection((s) => ({ ...s, [id]: valeur }));

  const envoyer = async () => {
    const choisis = Object.entries(selection).filter(([, m]) => Number(m) > 0);
    if (choisis.length === 0) return;
    setEnvoi(true);
    const res = await creerRemiseGain(tontine.id, {
      lignes: choisis.map(([tontine_part_id, montant]) => ({ tontine_part_id, montant: Number(montant) })),
    });
    setEnvoi(false);
    if (res) { setSelection({}); charger(); chargerHistorique(); }
  };

  return <Modal open title={`🪙 Cagnotte — ${tontine.nom}`} onClose={onClose}
    footer={tontine.modeCagnotte && onglet === 'proposition'
      ? <button onClick={envoyer} disabled={envoi || Object.keys(selection).length === 0} className="btn-primary ml-auto"><Send size={14}/> {envoi ? 'Envoi…' : 'Verser aux bénéficiaires sélectionnés'}</button>
      : !tontine.modeCagnotte
        ? <button onClick={() => activerCagnotte(tontine.id).then(charger)} className="btn-primary ml-auto"><Coins size={14}/> Activer le mode cagnotte</button>
        : null}>
    {!tontine.modeCagnotte
      ? <div className="text-sm text-ink-600 space-y-2">
          <p>En mode cagnotte, les cotisations s'accumulent sans attribution automatique. Vous pourrez ensuite distribuer l'argent à qui vous voulez, quand vous voulez.</p>
          <p className="text-amber-700 text-xs font-semibold">Une fois activé, ce mode ne peut plus être désactivé sur cette tontine.</p>
        </div>
      : <div className="space-y-3">
          <div className="flex gap-2 border-b border-ink-200 mb-1">
            <button onClick={() => setOnglet('proposition')} className={`px-3 py-1.5 text-xs font-semibold border-b-2 ${onglet === 'proposition' ? 'border-emerald-500 text-emerald-700' : 'border-transparent text-ink-400'}`}>À distribuer</button>
            <button onClick={() => setOnglet('historique')} className={`px-3 py-1.5 text-xs font-semibold border-b-2 flex items-center gap-1 ${onglet === 'historique' ? 'border-emerald-500 text-emerald-700' : 'border-transparent text-ink-400'}`}><History size={13}/> Historique</button>
          </div>

          {onglet === 'proposition' && <>
            {loading && <p className="text-sm text-ink-500">Chargement…</p>}
            {!loading && lignes.length === 0 && <p className="text-sm text-ink-500">Rien à distribuer pour l'instant — aucune part n'a de solde accumulé.</p>}
            {lignes.map((l) => {
              const coche = selection[l.tontine_part_id] !== undefined;
              return <div key={l.tontine_part_id} className={`rounded-xl border p-3 ${coche ? 'border-emerald-300 bg-emerald-50' : 'border-ink-200 bg-white'}`}>
                <div className="flex items-center justify-between gap-3">
                  <label className="flex items-center gap-2 text-sm font-medium text-ink-800">
                    <input type="checkbox" checked={coche} onChange={() => toggle(l)} />
                    {l.membre_nom} <span className="text-xs text-ink-400">(part n°{l.numero_part})</span>
                  </label>
                  <span className="text-xs text-ink-500">Accumulé : {fmt(l.solde_propose)}</span>
                </div>
                {coche && <div className="mt-2 flex items-center gap-2">
                  <span className="text-xs text-ink-500">Montant à verser</span>
                  <input className="input w-32 text-sm" type="number" max={l.solde_propose} min="0"
                    value={selection[l.tontine_part_id]} onChange={(e) => changerMontant(l.tontine_part_id, e.target.value)} />
                </div>}
                {(l.dettes?.pret_du || l.dettes?.sanctions_dues) && <p className="mt-2 text-xs text-amber-700">
                  ⚠ Ce membre a {l.dettes.pret_du ? `${fmt(l.dettes.pret_du)} de prêt dû` : ''}{l.dettes.pret_du && l.dettes.sanctions_dues ? ' et ' : ''}{l.dettes.sanctions_dues ? `${fmt(l.dettes.sanctions_dues)} de sanction due` : ''} — information seulement, rien n'est déduit automatiquement.
                </p>}
              </div>;
            })}
          </>}

          {onglet === 'historique' && <>
            {loadingHisto && <p className="text-sm text-ink-500">Chargement…</p>}
            {!loadingHisto && historique.length === 0 && <p className="text-sm text-ink-500">Aucune remise de gains effectuée pour l'instant.</p>}
            {historique.map((r) => <div key={r.id} className="rounded-xl border border-ink-200 bg-white p-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-ink-800">{fmtDate(r.date_remise)}</p>
                <span className="text-xs text-ink-500">{r.lignes?.length || 0} bénéficiaire(s) — {fmt((r.lignes || []).reduce((s, l) => s + Number(l.montant_verse || 0), 0))} au total</span>
              </div>
              {r.notes && <p className="mt-1 text-xs text-ink-500 italic">{r.notes}</p>}
              <ul className="mt-2 space-y-1">
                {(r.lignes || []).map((l) => <li key={l.id} className="flex items-center justify-between text-xs text-ink-700">
                  <span>{l.part?.membre ? `${l.part.membre.nom} ${l.part.membre.prenom}` : '—'} <span className="text-ink-400">(part n°{l.part?.numero_part})</span></span>
                  <span className="font-medium">{fmt(l.montant_verse)}</span>
                </li>)}
              </ul>
            </div>)}
          </>}
        </div>}
  </Modal>;
}
