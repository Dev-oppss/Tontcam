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

// Pour les fichiers binaires (PDF...) servis par une route authentifiée : `request()`
// ne peut pas servir ici, il parse toujours la réponse en JSON. On récupère le blob
// et on retourne une object URL, utilisable directement en src d'iframe — sans jamais
// dépendre du lien symbolique public/storage (souvent absent en production).
export async function requestBlob(path, { auth = true } = {}) {
  const init = { headers: {} };
  const token = auth ? getApiToken() : null;
  if (token) init.headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, init);
  if (!res.ok) {
    let data = null;
    try { data = await res.json(); } catch { /* corps non-JSON, on ignore */ }
    throw Object.assign(new Error(data?.message || `HTTP ${res.status}`), { status: res.status, data });
  }
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}
