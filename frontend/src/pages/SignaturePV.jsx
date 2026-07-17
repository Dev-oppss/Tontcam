import { PenLine, Lock, CheckCircle2 } from 'lucide-react';
import { useApp } from '../context/AppContext';

/**
 * Workflow de signature électronique d'un PV de réunion (RG-REU-021 à 025).
 *
 * Props :
 *  - reunion        : objet réunion (doit contenir .id, .signatures = [{ idMembre, nom, role, signeLe }], .statutPV)
 *  - signatairesRequis : nombre de signatures requises (par défaut lu dans parametres.nbSignatairesPV, sinon 3)
 *  - rapportsComplets  : bool — tous les rapports de rubriques obligatoires sont saisis (RG-REU-021)
 *
 * Usage dans Reunions.jsx :
 *   import SignaturePV from '../components/ui/SignaturePV';
 *   <SignaturePV reunion={reunionEnCours} rapportsComplets={tousLesRapportsSaisis} />
 */
export default function SignaturePV({ reunion, rapportsComplets = true, signatairesRequis }) {
  const { user, membres = [], signerPV, parametres = {} } = useApp();
  const requis = signatairesRequis ?? Number(parametres.nbSignatairesPV || 3);
  const signatures = reunion?.signatures || [];
  const verrouille = signatures.length >= requis;
  const dejaSigne = signatures.some((s) => s.idMembre === user?.membre_id);

  const handleSign = () => {
    if (!reunion || verrouille || dejaSigne || !rapportsComplets) return;
    const m = membres.find((x) => x.id === user?.membre_id);
    signerPV?.(reunion.id, {
      idMembre: user?.membre_id,
      nom: `${m?.nom || ''} ${m?.prenom || ''}`.trim() || user?.name,
      role: user?.role,
      signeLe: new Date().toISOString(),
    });
  };

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <p className="font-display font-semibold text-ink-900 text-sm flex items-center gap-2">
          {verrouille ? <Lock size={15} className="text-emerald-600" /> : <PenLine size={15} className="text-indigo-500" />}
          Signatures du PV
        </p>
        <span className="text-xs font-mono text-ink-600/50">{signatures.length}/{requis}</span>
      </div>

      <div className="flex gap-2 mb-3">
        {Array.from({ length: requis }).map((_, i) => {
          const sig = signatures[i];
          return (
            <div key={i} className={`flex-1 rounded-xl border p-2.5 text-center ${sig ? 'bg-emerald-50 border-emerald-100' : 'bg-white/40 border-white/50 border-dashed'}`}>
              {sig ? (
                <>
                  <CheckCircle2 size={14} className="mx-auto text-emerald-600 mb-1" />
                  <p className="text-[11px] font-semibold text-ink-900 truncate">{sig.nom}</p>
                  <p className="text-[10px] text-ink-600/50">{sig.role}</p>
                </>
              ) : (
                <p className="text-[11px] text-ink-600/40 italic py-1.5">En attente</p>
              )}
            </div>
          );
        })}
      </div>

      {!rapportsComplets && !verrouille && (
        <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2 mb-3">
          Tous les rapports des rubriques obligatoires doivent être saisis avant signature (RG-REU-021).
        </p>
      )}

      {verrouille ? (
        <p className="text-xs text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2 flex items-center gap-1.5">
          <Lock size={12} /> PV verrouillé — aucune modification possible (RG-REU-024).
        </p>
      ) : dejaSigne ? (
        <p className="text-xs text-ink-600/50 text-center py-1">Vous avez déjà signé ce PV.</p>
      ) : (
        <button onClick={handleSign} disabled={!rapportsComplets} className="btn-primary w-full justify-center">
          <PenLine size={14} /> Signer ce PV
        </button>
      )}
    </div>
  );
}
