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
