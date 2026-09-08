import { useEffect, useState } from 'react';
import { PiggyBank, Send, Users } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Modal } from '../ui/index';

const fmt = (n) => Number(n || 0).toLocaleString('fr-FR');

export default function EpargneModal({ caisse, onClose }) {
  const { membres, activerEpargne, chargerSoldesEpargne, deposerEpargne, cassationEpargne } = useApp();
  const [soldes, setSoldes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [depotMembreId, setDepotMembreId] = useState('');
  const [depotMontant, setDepotMontant] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [confirmCassation, setConfirmCassation] = useState(false);

  const charger = async () => {
    if (!caisse.suiviEpargne) return;
    setLoading(true);
    setSoldes((await chargerSoldesEpargne(caisse.id)) || []);
    setLoading(false);
  };

  useEffect(() => { charger(); }, [caisse.id, caisse.suiviEpargne]);

  const total = soldes.reduce((s, l) => s + Number(l.solde || 0), 0);

  const deposer = async () => {
    if (!depotMembreId || !Number(depotMontant) > 0) return;
    setEnvoi(true);
    const res = await deposerEpargne(caisse.id, { membre_id: depotMembreId, montant: Number(depotMontant) });
    setEnvoi(false);
    if (res) { setDepotMembreId(''); setDepotMontant(''); charger(); }
  };

  const lancerCassation = async () => {
    setEnvoi(true);
    const res = await cassationEpargne(caisse.id);
    setEnvoi(false);
    setConfirmCassation(false);
    if (res) charger();
  };

  return <Modal open title={`🐷 Épargne — ${caisse.nom}`} onClose={onClose}
    footer={caisse.suiviEpargne
      ? (confirmCassation
          ? <div className="flex items-center gap-2 ml-auto">
              <span className="text-xs text-red-600">Rembourser TOUT le monde d'un coup, êtes-vous sûr ?</span>
              <button onClick={() => setConfirmCassation(false)} className="btn-secondary text-xs">Annuler</button>
              <button onClick={lancerCassation} disabled={envoi} className="btn-primary text-xs bg-red-600 hover:bg-red-700">{envoi ? 'Envoi…' : 'Oui, tout rembourser'}</button>
            </div>
          : <button onClick={() => setConfirmCassation(true)} disabled={soldes.length === 0} className="btn-secondary ml-auto"><Users size={14}/> Cassation générale</button>)
      : <button onClick={() => activerEpargne(caisse.id).then(charger)} className="btn-primary ml-auto"><PiggyBank size={14}/> Activer le suivi épargne</button>}>
    {!caisse.suiviEpargne
      ? <div className="text-sm text-ink-600 space-y-2">
          <p>Chaque membre pourra déposer ce qu'il veut, quand il veut, dans cette caisse. L'appli suit le solde de chacun. Le remboursement se fait en une fois, à tout le monde, via une "cassation générale".</p>
          <p className="text-amber-700 text-xs font-semibold">Une fois activé, ce suivi ne peut plus être désactivé sur cette caisse.</p>
        </div>
      : <div className="space-y-4">
          <div className="rounded-xl border border-ink-200 bg-white p-3">
            <p className="text-xs font-semibold text-ink-700 mb-2">Nouveau dépôt</p>
            <div className="flex items-center gap-2">
              <select className="select flex-1" value={depotMembreId} onChange={(e) => setDepotMembreId(e.target.value)}>
                <option value="">Choisir un membre…</option>
                {membres.map((m) => <option key={m.id} value={m.id}>{m.nom} {m.prenom}</option>)}
              </select>
              <input className="input w-28" type="number" min="1" placeholder="Montant" value={depotMontant} onChange={(e) => setDepotMontant(e.target.value)} />
              <button onClick={deposer} disabled={envoi} className="btn-primary text-xs shrink-0"><Send size={13}/> Déposer</button>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-ink-700">Soldes par membre</p>
              <span className="text-xs text-ink-500">Total : {fmt(total)}</span>
            </div>
            {loading && <p className="text-sm text-ink-500">Chargement…</p>}
            {!loading && soldes.length === 0 && <p className="text-sm text-ink-500">Personne n'a encore déposé dans cette caisse.</p>}
            <ul className="space-y-1 max-h-56 overflow-auto">
              {soldes.map((l) => <li key={l.membre_id} className="flex items-center justify-between text-sm rounded-lg bg-ink-50 px-2 py-1.5">
                <span>{l.membre_nom}</span>
                <span className="font-medium">{fmt(l.solde)}</span>
              </li>)}
            </ul>
          </div>
        </div>}
  </Modal>;
}
