import { useCallback, useRef, useState } from 'react';

/**
 * useAsyncGuard — empêche qu'un bouton d'action (Enregistrer, Payer, Verser,
 * Supprimer, Clôturer, Appliquer, etc.) ne soit déclenché plusieurs fois
 * pendant que l'action précédente est encore en cours (double-clic, clic
 * pendant le chargement réseau, double-tap mobile...).
 *
 * Usage :
 *   const [handleSave, saving] = useAsyncGuard(async () => {
 *     await addSanction(...);
 *   });
 *   <button onClick={handleSave} disabled={saving} className="btn-primary">
 *     {saving ? 'Enregistrement…' : 'Enregistrer'}
 *   </button>
 *
 * Le bouton devient automatiquement grisé et non cliquable (curseur "interdit")
 * tant que `saving` est vrai, grâce à la règle CSS globale `.btn:disabled`.
 */
export function useAsyncGuard(fn) {
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false); // ref synchrone : évite la fenêtre de race avant que le state ne se propage

  const guarded = useCallback(async (...args) => {
    if (busyRef.current) return; // clic ignoré : une action est déjà en cours
    busyRef.current = true;
    setBusy(true);
    try {
      return await fn(...args);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, [fn]);

  return [guarded, busy];
}

export default useAsyncGuard;
