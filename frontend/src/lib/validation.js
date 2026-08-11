// Validation front-end générique des champs obligatoires.
// But : éviter qu'un formulaire entièrement rempli soit perdu à cause d'un
// seul champ requis oublié, découvert seulement après le rejet du backend.
//
// Usage :
//   const missing = getMissingFields(form, [
//     { key: 'nom', label: 'Nom' },
//     { key: 'idTontine', label: 'Tontine' },
//   ]);
//   if (missing.length) {
//     showToast(`Champ(s) requis manquant(s) : ${missing.join(', ')}`, 'error');
//     return;
//   }

export const isEmptyValue = (v) =>
  v === undefined || v === null || (typeof v === 'string' && v.trim() === '');

/**
 * @param {object} values - l'état du formulaire (form, formOuv, etc.)
 * @param {Array<{key:string,label:string}>} rules - champs requis à vérifier
 * @returns {string[]} libellés des champs manquants
 */
export function getMissingFields(values, rules) {
  return rules
    .filter(({ key }) => isEmptyValue(values?.[key]))
    .map(({ label }) => label);
}

/**
 * @returns {{ [key:string]: string }} objet d'erreurs { champ: "Ce champ est requis." }
 * compatible avec le pattern `errors.xxx` déjà utilisé (ex: Membres.jsx).
 */
export function getMissingFieldErrors(values, rules) {
  const errors = {};
  rules.forEach(({ key, label }) => {
    if (isEmptyValue(values?.[key])) errors[key] = `${label} est requis.`;
  });
  return errors;
}
