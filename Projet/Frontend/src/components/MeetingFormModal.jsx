// src/components/MeetingFormModal.jsx — formulaire « Nouvelle réunion » (bloc 13)
// `projectId` permet de présélectionner le projet (depuis la page d'un projet).
import { useEffect, useState } from 'react'
import Modal from './Modal.jsx'
import { Field, FormError, Button, FormActions, inputStyle } from './form.jsx'
import { api } from '../services/api.js'
import { validateMeeting, hasErrors } from '../utils/validation.js'

export default function MeetingFormModal({ onClose, onCreated, projectId = '' }) {
  const [projects, setProjects] = useState([])
  const [loadingProjects, setLoadingProjects] = useState(true)
  const [form, setForm] = useState({ projectId, title: '', description: '' })
  const [errors, setErrors] = useState({})
  const [serverError, setServerError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api.get('/projects')
      .then((data) => {
        const active = (data.projects ?? []).filter((p) => p.status === 'active')
        setProjects(active)
        if (!projectId && active.length === 1) setForm((f) => ({ ...f, projectId: active[0].id }))
      })
      .catch((err) => setServerError(`Impossible de charger les projets : ${err.message}`))
      .finally(() => setLoadingProjects(false))
  }, [projectId])

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  async function handleSubmit(e) {
    e.preventDefault()
    const found = validateMeeting(form)
    setErrors(found)
    if (hasErrors(found)) return

    setSaving(true)
    setServerError('')
    try {
      const data = await api.post('/meetings', {
        projectId: form.projectId,
        title: form.title.trim(),
        description: form.description.trim(),
      })
      onCreated(data.meeting)
    } catch (err) {
      setServerError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title="Nouvelle réunion" onClose={onClose}>
      <form onSubmit={handleSubmit} noValidate>
        <FormError message={serverError} />
        <Field id="meeting-project" label="Projet *" error={errors.projectId}
          hint={!loadingProjects && projects.length === 0 ? 'Créez d\'abord un projet (page Projets).' : undefined}>
          <select id="meeting-project" style={inputStyle} value={form.projectId} onChange={set('projectId')}
            disabled={loadingProjects}>
            <option value="">{loadingProjects ? 'Chargement…' : '— Choisir un projet —'}</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </Field>
        <Field id="meeting-title" label="Titre *" error={errors.title}>
          <input id="meeting-title" style={inputStyle} value={form.title} onChange={set('title')} maxLength={200}
            placeholder="Ex. : Revue de sprint" aria-invalid={Boolean(errors.title)} />
        </Field>
        <Field id="meeting-description" label="Description" error={errors.description}>
          <textarea id="meeting-description" style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' }}
            value={form.description} onChange={set('description')} maxLength={2000} />
        </Field>
        <FormActions>
          <Button type="button" variant="secondary" onClick={onClose}>Annuler</Button>
          <Button type="submit" disabled={saving || loadingProjects}>{saving ? 'Création…' : 'Créer la réunion'}</Button>
        </FormActions>
      </form>
    </Modal>
  )
}
