const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api";
export { API_BASE };
export const resolveApiUrl = (url) => {
  if (!url || /^https?:\/\//i.test(url)) return url;
  const origin = API_BASE.replace(/\/api\/?$/, "");
  return `${origin}${url.startsWith("/") ? "" : "/"}${url}`;
};
const TOKEN_KEY = "tontix_api_token";

export const getApiToken = () => (typeof window === "undefined" ? null : window.localStorage.getItem(TOKEN_KEY));
export const setApiToken = (token) => {
  if (typeof window !== "undefined") window.localStorage.setItem(TOKEN_KEY, token);
};
export const clearApiToken = () => {
  if (typeof window !== "undefined") window.localStorage.removeItem(TOKEN_KEY);
};

export async function request(path, { method = "GET", body, auth = true, headers = {} } = {}) {
  const init = { method, headers: { Accept: "application/json", ...headers } };
  const token = auth ? getApiToken() : null;
  if (token) init.headers.Authorization = `Bearer ${token}`;

  if (body instanceof FormData) {
    init.body = body;
  } else if (body !== undefined) {
    init.headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(body);
  }

  const res = await fetch(`${API_BASE}${path}`, init);
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    throw Object.assign(new Error(data?.message || `HTTP ${res.status}`), { status: res.status, data });
  }
  return data;
}

// Même logique que ouvrirPdfAuthentifie mais déclenche un téléchargement de
// fichier (CSV/XLSX) au lieu d'ouvrir un onglet — utilisé pour les exports.
export async function telechargerFichierAuthentifie(path, nomFichier) {
  const token = getApiToken();
  const res = await fetch(`${API_BASE}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try { const data = await res.json(); message = data?.message || message; } catch { /* pas du JSON */ }
    throw Object.assign(new Error(message), { status: res.status });
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nomFichier;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
// window.open(url) vers un endpoint PDF authentifié échouerait en 401 — le
// navigateur n'a pas le token à joindre à une navigation directe. On récupère
// le PDF en blob via fetch (avec le header Authorization), puis on ouvre un
// nouvel onglet sur une URL objet locale — l'utilisateur peut l'imprimer ou
// l'enregistrer normalement depuis là.
export async function ouvrirPdfAuthentifie(path) {
  const token = getApiToken();
  const res = await fetch(`${API_BASE}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try { const data = await res.json(); message = data?.message || message; } catch { /* pas du JSON, tant pis */ }
    throw Object.assign(new Error(message), { status: res.status });
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank");
  // L'URL objet reste valide le temps que l'onglet l'utilise ; on la libère
  // après un délai raisonnable plutôt que de la garder indéfiniment en mémoire.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
