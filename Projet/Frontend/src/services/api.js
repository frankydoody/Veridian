// src/services/api.js
// Client HTTP des pages protégées (utilisateur connecté).
//
// Pourquoi deux clients ? api/client.js sert à la connexion et à l'inscription : là, un 401
// veut dire « mauvais mot de passe » et doit s'afficher dans le formulaire. Ici, un 401 veut
// dire « jeton expiré ou invalide » : on déconnecte et on renvoie vers la page de connexion
// avec un message clair.
//
// Les URL sont relatives (/api/...) : en développement, le proxy de Vite (vite.config.js)
// les transmet au backend sur le port 3000. Le navigateur ne voit qu'une seule origine.

import { getToken, clearToken } from '../api/client.js'

const BASE_URL = '/api'
const SESSION_MESSAGE_KEY = 'veridian_session_message'

export const SESSION_EXPIRED_MESSAGE = 'Votre session a expiré. Veuillez vous reconnecter.'

// Message à afficher une seule fois sur la page de connexion
export function setSessionMessage(message) {
  try { sessionStorage.setItem(SESSION_MESSAGE_KEY, message) } catch { /* stockage indisponible */ }
}
export function takeSessionMessage() {
  try {
    const message = sessionStorage.getItem(SESSION_MESSAGE_KEY)
    sessionStorage.removeItem(SESSION_MESSAGE_KEY)
    return message
  } catch {
    return null
  }
}

// Erreur HTTP avec son code : les pages peuvent distinguer 404, 409, 413...
export class ApiError extends Error {
  constructor(message, status, data) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.data = data
  }
}

function handleUnauthorized() {
  clearToken()
  setSessionMessage(SESSION_EXPIRED_MESSAGE)
  if (window.location.pathname !== '/login') window.location.assign('/login')
}

async function readError(res) {
  const data = await res.json().catch(() => ({}))
  const fallback = res.status === 413
    ? 'Fichier trop volumineux.'
    : `Erreur serveur (${res.status})`
  return new ApiError(data.message || fallback, res.status, data)
}

/**
 * @param body  objet (envoyé en JSON) ou FormData (envoyé tel quel, pour les fichiers)
 * @param as    'json' (défaut) ou 'blob' (fichier binaire : audio, PDF)
 */
async function request(method, path, body = null, { as = 'json', signal } = {}) {
  const token = getToken()
  const isForm = typeof FormData !== 'undefined' && body instanceof FormData

  const headers = {}
  if (token) headers.Authorization = `Bearer ${token}`
  // Avec FormData, ne PAS fixer Content-Type : le navigateur ajoute la « boundary » multipart
  if (body && !isForm) headers['Content-Type'] = 'application/json'

  let res
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body ? (isForm ? body : JSON.stringify(body)) : undefined,
      signal,
    })
  } catch (err) {
    if (err.name === 'AbortError') throw err
    throw new ApiError('Serveur injoignable. Vérifiez votre connexion et que le backend est démarré.', 0)
  }

  if (res.status === 401) {
    handleUnauthorized()
    throw new ApiError(SESSION_EXPIRED_MESSAGE, 401)
  }
  if (!res.ok) throw await readError(res)
  if (res.status === 204) return null
  if (as === 'blob') return res.blob()
  return res.json().catch(() => ({}))
}

export const api = {
  get:    (path, opts)       => request('GET',    path, null, opts),
  post:   (path, body, opts) => request('POST',   path, body, opts),
  put:    (path, body, opts) => request('PUT',    path, body, opts),
  patch:  (path, body, opts) => request('PATCH',  path, body, opts),
  delete: (path, opts)       => request('DELETE', path, null, opts),
  blob:   (path, opts)       => request('GET',    path, null, { ...opts, as: 'blob' }),
}
