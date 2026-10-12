// src/pages/MemoryPage.jsx
// Chat RAG avec la mémoire IA — POST /api/memory/chat

import { useState, useRef, useEffect } from 'react'
import { api } from '../services/api.js'

// ─── Composant Message ────────────────────────────────────────────────────────
function Message({ role, content, sources }) {
  const isUser = role === 'user'
  return (
    <div style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start', marginBottom: '0.75rem' }}>
      <div style={{ maxWidth: '75%' }}>
        <div style={{
          padding: '0.75rem 1rem',
          borderRadius: isUser ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
          fontSize: '13px',
          lineHeight: 1.6,
          background: isUser ? 'var(--color-ai)' : 'var(--color-surface-2)',
          color: isUser ? '#fff' : 'var(--color-text)',
          border: isUser ? 'none' : '1px solid var(--color-border)',
          whiteSpace: 'pre-wrap',
        }}>
          {content}
        </div>

        {/* Sources RAG — affiché uniquement pour les réponses assistants avec contexte */}
        {sources && sources.length > 0 && (
          <div style={{ marginTop: '0.5rem', display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
            {sources.map((s, i) => (
              <span key={i} style={{
                fontSize: '11px',
                color: 'var(--color-text-muted)',
                background: 'var(--color-surface-2)',
                border: '1px solid var(--color-border)',
                borderRadius: '999px',
                padding: '2px 8px',
              }}>
                📄 {s.meetingTitle || 'Réunion'} · {Math.round(s.similarity * 100)}%
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Indicateur de frappe ─────────────────────────────────────────────────────
function TypingIndicator() {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: '0.75rem' }}>
      <div style={{
        padding: '0.75rem 1rem',
        borderRadius: '16px 16px 16px 4px',
        background: 'var(--color-surface-2)',
        border: '1px solid var(--color-border)',
        display: 'flex', gap: '4px', alignItems: 'center',
      }}>
        {[0, 1, 2].map((i) => (
          <div key={i} style={{
            width: '6px', height: '6px', borderRadius: '50%',
            background: 'var(--color-text-muted)',
            animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite`,
          }} />
        ))}
      </div>
    </div>
  )
}

// ─── Page principale ──────────────────────────────────────────────────────────
export default function MemoryPage() {
  const [messages, setMessages] = useState([{
    role: 'assistant',
    content: 'Bonjour ! Je suis la mémoire IA de Veridian. Sélectionne un projet ci-dessus, puis pose-moi une question sur tes réunions, décisions ou projets.',
  }])
  const [input,    setInput]    = useState('')
  const [loading,  setLoading]  = useState(false)

  // Scope de recherche — projet ou réunion sélectionné
  const [projects,   setProjects]   = useState([])
  const [meetings,   setMeetings]   = useState([])
  const [projectId,  setProjectId]  = useState('')
  const [meetingId,  setMeetingId]  = useState('')   // optionnel — affine la recherche
  const [scopeLoading, setScopeLoading] = useState(true)

  const bottomRef = useRef(null)

  // Scroll automatique à chaque nouveau message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  // Chargement des projets au montage
  useEffect(() => {
    api.get('/projects')
      .then((data) => {
        const actifs = (data.projects || []).filter((p) => p.status === 'active')
        setProjects(actifs)
        if (actifs.length === 1) setProjectId(actifs[0].id)  // sélection auto si un seul projet
      })
      .catch(() => {}) // silencieux — on affiche juste le sélecteur vide
      .finally(() => setScopeLoading(false))
  }, [])

  // Quand le projet change → charger ses réunions
  useEffect(() => {
    setMeetingId('')
    setMeetings([])
    if (!projectId) return
    api.get('/meetings')
      .then((data) => {
        const filtered = (data.meetings || []).filter((m) => m.project_id === projectId)
        setMeetings(filtered)
      })
      .catch(() => {})
  }, [projectId])

  // ─── Envoi ─────────────────────────────────────────────────────────────────
  async function handleSend() {
    const text = input.trim()
    if (!text || loading) return

    if (!projectId && !meetingId) {
      setMessages((prev) => [...prev, {
        role: 'assistant',
        content: '⚠️ Sélectionne d\'abord un projet pour que je sache dans quel contexte chercher.',
      }])
      return
    }

    setMessages((prev) => [...prev, { role: 'user', content: text }])
    setInput('')
    setLoading(true)

    try {
      const body = { question: text }
      if (meetingId) body.meetingId = meetingId
      else           body.projectId = projectId

      const data = await api.post('/memory/chat', body)

      setMessages((prev) => [...prev, {
        role: 'assistant',
        content: data.answer,
        sources: data.sources || [],
      }])
    } catch (err) {
      setMessages((prev) => [...prev, {
        role: 'assistant',
        content: `❌ Erreur : ${err.message}`,
      }])
    } finally {
      setLoading(false)
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <>
      <style>{`
        @keyframes bounce {
          0%, 60%, 100% { transform: translateY(0); }
          30%            { transform: translateY(-6px); }
        }
      `}</style>

      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '1rem' }}>

        {/* En-tête */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <h1 style={{ fontSize: '1.375rem', fontWeight: '600', color: 'var(--color-text)' }}>
              Mémoire IA
            </h1>
            <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginTop: '0.25rem' }}>
              Interroge l'historique de tes réunions en langage naturel
            </p>
          </div>

          {/* Sélecteurs de scope */}
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {/* Sélecteur projet */}
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              disabled={scopeLoading}
              style={{
                padding: '0.4rem 0.75rem',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border)',
                background: 'var(--color-surface-1)',
                color: 'var(--color-text)',
                fontSize: '13px',
                cursor: 'pointer',
              }}
            >
              <option value="">— Choisir un projet —</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>

            {/* Sélecteur réunion (optionnel) */}
            {meetings.length > 0 && (
              <select
                value={meetingId}
                onChange={(e) => setMeetingId(e.target.value)}
                style={{
                  padding: '0.4rem 0.75rem',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border)',
                  background: 'var(--color-surface-1)',
                  color: 'var(--color-text)',
                  fontSize: '13px',
                  cursor: 'pointer',
                }}
              >
                <option value="">Toutes les réunions</option>
                {meetings.map((m) => (
                  <option key={m.id} value={m.id}>{m.title}</option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Fil de conversation */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          background: 'var(--color-surface-1)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)',
          padding: '1.25rem',
        }}>
          {messages.map((m, i) => (
            <Message key={i} {...m} />
          ))}
          {loading && <TypingIndicator />}
          <div ref={bottomRef} />
        </div>

        {/* Zone de saisie */}
        <div style={{
          display: 'flex',
          gap: '0.75rem',
          background: 'var(--color-surface-1)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)',
          padding: '0.75rem',
        }}>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ex : Quelles décisions ont été prises lors du Sprint 4 ?"
            rows={2}
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              resize: 'none',
              fontSize: '13px',
              color: 'var(--color-text)',
              fontFamily: 'inherit',
              lineHeight: 1.6,
            }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || loading}
            style={{
              alignSelf: 'flex-end',
              background: input.trim() && !loading ? 'var(--color-ai)' : 'var(--color-surface-2)',
              color:      input.trim() && !loading ? '#fff'            : 'var(--color-text-muted)',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              padding: '0.5rem 1rem',
              fontSize: '13px',
              fontWeight: '500',
              cursor: input.trim() && !loading ? 'pointer' : 'default',
              transition: 'background 200ms ease, color 200ms ease',
            }}
          >
            Envoyer
          </button>
        </div>

      </div>
    </>
  )
}
