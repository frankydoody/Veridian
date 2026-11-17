// src/components/ProjectFormModal.jsx — formulaire « Créer un projet » (bloc 13)
import { useState } from 'react'
import Modal from './Modal.jsx'
import { Field, FormError, Button, FormActions, inputStyle } from './form.jsx'
import { api } from '../services/api.js'
import { validateProject, hasErrors } from '../utils/validation.js'

export default function ProjectFormModal({ onClose, onCreated }) {
  const [form, setForm] = useState({ name: '', description: '' })
  const [errors, setErrors] = useState({})
  const [serverError, setServerError] = useState('')
  const [saving, setSaving] = useState(false)

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  async function handleSubmit(e) {
    e.preventDefault()
    const found = validateProject(form)
    setErrors(found)
    if (hasErrors(found)) return

    setSaving(true)
    setServerError('')
    try {
      const data = await api.post('/projects', { name: form.name.trim(), description: form.description.trim() })
      onCreated(data.project)
    } catch (err) {
      setServerError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title="Nouveau projet" onClose={onClose}>
      <form onSubmit={handleSubmit} noValidate>
        <FormError message={serverError} />
        <Field id="project-name" label="Nom du projet *" error={errors.name}>
          <input id="project-name" style={inputStyle} value={form.name} onChange={set('name')} maxLength={150}
            aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? 'project-name-error' : undefined} />
        </Field>
        <Field id="project-description" label="Description" error={errors.description}>
          <textarea id="project-description" style={{ ...inputStyle, minHeight: '90px', resize: 'vertical' }}
            value={form.description} onChange={set('description')} maxLength={2000} />
        </Field>
        <p style={{ fontSize: '12px', color: 'var(--color-text-faint)', margin: '0 0 0.75rem' }}>
          Vous serez propriétaire du projet : vous pourrez y ajouter des membres.
        </p>
        <FormActions>
          <Button type="button" variant="secondary" onClick={onClose}>Annuler</Button>
          <Button type="submit" disabled={saving}>{saving ? 'Création…' : 'Créer le projet'}</Button>
        </FormActions>
      </form>
    </Modal>
  )
}
