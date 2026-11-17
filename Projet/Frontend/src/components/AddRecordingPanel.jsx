// src/components/AddRecordingPanel.jsx — trois façons de fournir le contenu d'une réunion (bloc 20) :
//   1. enregistrer dans le navigateur ;  2. téléverser un fichier audio ;  3. coller une transcription.
// Les deux premières envoient l'audio (réponse 202, Whisper en arrière-plan) ;
// la troisième enregistre le texte directement (aucun Whisper).
import { useState } from 'react'
import AudioRecorder from './AudioRecorder.jsx'
import { Button, FormError, inputStyle } from './form.jsx'
import { api, uploadWithProgress } from '../services/api.js'
import { AUDIO_FILE_ACCEPT, validateAudioFile, formatSize } from '../utils/recording.js'

const TABS = [
  { key: 'record', label: 'Enregistrer' },
  { key: 'file', label: 'Téléverser un fichier' },
  { key: 'text', label: 'Coller un texte' },
]

function FileUpload({ meetingId, maxMb, disabled, onUploaded }) {
  const [file, setFile] = useState(null)
  const [error, setError] = useState('')
  const [progress, setProgress] = useState(null)

  function choose(e) {
    const chosen = e.target.files?.[0] ?? null
    setFile(chosen)
    setError(chosen ? validateAudioFile(chosen, maxMb) ?? '' : '')
  }

  async function send() {
    const problem = validateAudioFile(file, maxMb)
    if (problem) { setError(problem); return }
    setError('')
    setProgress(0)
    const form = new FormData()
    form.append('meetingId', meetingId)
    form.append('audio', file, file.name)
    try {
      const data = await uploadWithProgress('/transcriptions/upload', form, setProgress)
      setFile(null)
      onUploaded?.(data)
    } catch (err) {
      setError(err.message) // le fichier reste choisi : on peut réessayer
    } finally {
      setProgress(null)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <FormError message={error} />
      <label htmlFor="audio-file" style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
        Fichier audio (mp3, wav, m4a, webm, ogg){maxMb ? ` — ${maxMb} Mo au maximum` : ''}
      </label>
      <input id="audio-file" type="file" accept={AUDIO_FILE_ACCEPT} onChange={choose} disabled={progress !== null}
        style={{ ...inputStyle, padding: '0.4rem' }} />
      {file && !error && (
        <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>{file.name} · {formatSize(file.size)}</span>
      )}
      {progress !== null ? (
        <div>
          <div style={{ fontSize: '12px', marginBottom: '0.35rem' }}>Envoi… {progress} %</div>
          <div role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}
            style={{ height: '6px', borderRadius: '3px', background: 'var(--color-surface-3)', overflow: 'hidden' }}>
            <div style={{ width: `${progress}%`, height: '100%', background: 'var(--color-ai)' }} />
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button onClick={send} disabled={disabled || !file || Boolean(error)}>Envoyer pour transcription</Button>
        </div>
      )}
    </div>
  )
}

function TextTranscript({ meetingId, disabled, onUploaded }) {
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function send() {
    if (!text.trim()) { setError('Collez le texte de la réunion.'); return }
    setSaving(true)
    setError('')
    try {
      const data = await api.post('/transcriptions/text', { meetingId, rawText: text.trim() })
      setText('')
      onUploaded?.(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <FormError message={error} />
      <label htmlFor="transcript-text" style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
        Transcription déjà disponible (par exemple « Marie : Je prépare les maquettes pour vendredi. »). L'analyse démarre ensuite.
      </label>
      <textarea id="transcript-text" value={text} onChange={(e) => setText(e.target.value)} maxLength={200000}
        style={{ ...inputStyle, minHeight: '160px', resize: 'vertical', lineHeight: 1.6 }} />
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button onClick={send} disabled={disabled || saving}>{saving ? 'Enregistrement…' : 'Enregistrer et analyser'}</Button>
      </div>
    </div>
  )
}

export default function AddRecordingPanel({ meetingId, maxMb, disabled, hasTranscription, onUploaded }) {
  const [tab, setTab] = useState('record')

  return (
    <div>
      {hasTranscription && (
        <p style={{ margin: '0 0 0.75rem', fontSize: '12px', color: 'var(--color-amber-text)' }}>
          Cette réunion a déjà une transcription : un nouvel envoi la remplacera, et l'analyse sera refaite.
        </p>
      )}
      <div role="tablist" aria-label="Façon d'ajouter la réunion" style={{ display: 'flex', gap: '0.25rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: '0.35rem 0.8rem', borderRadius: 'var(--radius-md)', fontSize: '12px', fontWeight: 500,
              cursor: 'pointer', border: '1px solid',
              borderColor: tab === t.key ? 'var(--color-ai)' : 'var(--color-border)',
              background: tab === t.key ? 'var(--color-ai-glow)' : 'transparent',
              color: tab === t.key ? 'var(--color-ai)' : 'var(--color-text-muted)',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div role="tabpanel">
        {tab === 'record' && <AudioRecorder meetingId={meetingId} maxMb={maxMb} disabled={disabled} onUploaded={onUploaded} />}
        {tab === 'file' && <FileUpload meetingId={meetingId} maxMb={maxMb} disabled={disabled} onUploaded={onUploaded} />}
        {tab === 'text' && <TextTranscript meetingId={meetingId} disabled={disabled} onUploaded={onUploaded} />}
      </div>
    </div>
  )
}
