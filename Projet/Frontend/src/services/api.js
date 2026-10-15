// src/services/api.js
// Point central pour tous les appels vers le backend Express
// Utilise la même clé token que AuthContext (via client.js)

import { getToken, clearToken } from '../api/client.js'

const BASE_URL = 'http://localhost:3000/api'

async function request(method, path, body = null) {
  const token = getToken()  // même clé que AuthContext : 'veridian_token'

  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  }

  if (body) options.body = JSON.stringify(body)

  const res = await fetch(`${BASE_URL}${path}`, options)

  if (res.status === 401) {
    clearToken()
    window.location.href = '/login'
    return
  }

  if (res.status === 204) return null

  const data = await res.json()

  if (!res.ok) throw new Error(data.message || 'Erreur serveur')

  return data
}

export const api = {
  get:    (path)        => request('GET',    path),
  post:   (path, body)  => request('POST',   path, body),
  put:    (path, body)  => request('PUT',    path, body),
  patch:  (path, body)  => request('PATCH',  path, body),
  delete: (path)        => request('DELETE', path),
}
