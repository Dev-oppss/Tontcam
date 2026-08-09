import axios from 'axios';

// Nécessite : npm install axios
// Défini dans .env du frontend : VITE_API_URL=http://localhost:8000/api
const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';
const TOKEN_KEY = 'tontix-token';

export const api = axios.create({
  baseURL: BASE_URL,
  headers: { Accept: 'application/json' },
});

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let onUnauthorized = null;
export function setUnauthorizedHandler(fn) {
  onUnauthorized = fn;
}

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      setToken(null);
      onUnauthorized?.();
    }
    // Normalise le message d'erreur pour un affichage direct en toast
    const message =
      error.response?.data?.message ||
      (error.response?.data?.errors ? Object.values(error.response.data.errors).flat().join(' ') : null) ||
      "Une erreur est survenue. Vérifiez votre connexion.";
    return Promise.reject(new Error(message));
  }
);

export default api;
