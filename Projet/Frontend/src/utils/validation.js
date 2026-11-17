// src/utils/validation.js
// Validation côté client des formulaires (bloc 13). Mêmes règles que le serveur
// (Backend/src/utils/validation.utils.js) : le client prévient tout de suite, le serveur
// reste la vraie protection (on peut l'appeler sans passer par l'interface).
// Chaque fonction renvoie un objet { champ: 'message' } ; vide = formulaire valide.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function text(errors, key, value, { label, max, required = false }) {
  const v = (value ?? '').trim()
  if (required && !v) errors[key] = `${label} est obligatoire`
  else if (v.length > max) errors[key] = `${label} ne doit pas dépasser ${max} caractères`
}

export function validateProject({ name, description }) {
  const errors = {}
  text(errors, 'name', name, { label: 'Le nom du projet', max: 150, required: true })
  text(errors, 'description', description, { label: 'La description', max: 2000 })
  return errors
}

export function validateMeeting({ projectId, title, description, scheduledAt }) {
  const errors = {}
  if (!projectId) errors.projectId = 'Choisissez un projet'
  text(errors, 'title', title, { label: 'Le titre', max: 200, required: true })
  text(errors, 'description', description, { label: 'La description', max: 2000 })
  // Bloc 16 : date prévue facultative (valeur d'un <input type="datetime-local">)
  if (scheduledAt && Number.isNaN(new Date(scheduledAt).getTime())) errors.scheduledAt = 'Date invalide'
  return errors
}

export function validateTask({ title, description, projectId, assigneeId, dueDate }) {
  const errors = {}
  text(errors, 'title', title, { label: 'Le titre', max: 200, required: true })
  text(errors, 'description', description, { label: 'La description', max: 2000 })
  if (assigneeId && !projectId) errors.assigneeId = 'Choisissez d\'abord un projet'
  if (dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) errors.dueDate = 'Date invalide'
  return errors
}

export function validateMemberEmail(email) {
  const errors = {}
  const v = (email ?? '').trim()
  if (!v) errors.email = 'Le courriel est obligatoire'
  else if (!EMAIL_RE.test(v)) errors.email = 'Adresse courriel invalide'
  return errors
}

export const hasErrors = (errors) => Object.keys(errors).length > 0
