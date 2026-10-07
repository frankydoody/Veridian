// src/pages/MemoryPage.jsx
// Interface de chat avec la mémoire IA du projet (RAG — Retrieval Augmented Generation)
// L'utilisateur pose des questions en langage naturel sur l'historique des réunions

import { useState, useRef, useEffect } from 'react'

// ─── Composant Message ────────────────────────────────────────────────────────
// Affiche un message dans le fil de conversation
// role : 'user' (à droite) ou 'assistant' (à gauche)
function Message({ role, content }) {
  const isUser = role === 'user'

  return (
    <div style={{
      display: 'flex',
      justifyContent: isUser ? 'flex-end' : 'flex-start',
      marginBottom: '0.75rem',
    }}>
      <div style={{
        maxWidth: '75%',
        padding: '0.75rem 1rem',
        borderRadius: isUser ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
        fontSize: '13px',
        lineHeight: 1.6,
        // Utilisateur → bulle colorée IA, assistant → surface neutre
        background: isUser ? 'var(--color-ai)' : 'var(--color-surface-2)',
        color: isUser ? '#fff' : 'var(--color-text)',
        border: isUser ? 'none' : '1px solid var(--color-border)',
      }}>
        {content}
      </div>
    </div>
  )
}

// ─── Composant TypingIndicator ────────────────────────────────────────────────
// Trois points animés pendant que l'IA "réfléchit"
function TypingIndicator() {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: '0.75rem' }}>
      <div style={{
        padding: '0.75rem 1rem',
        borderRadius: '16px 16px 16px 4px',
        background: 'var(--color-surface-2)',
        border: '1px solid var(--color-border)',
        display: 'flex',
        gap: '4px',
        alignItems: 'center',
      }}>
        {[0, 1, 2].map((i) => (
          <div key={i} style={{
            width: '6px', height: '6px',
            borderRadius: '50%',
            background: 'var(--color-text-muted)',
            // Animation décalée pour chaque point
            animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite`,
          }} />
        ))}
      </div>
    </div>
  )
}

// ─── Page principale ──────────────────────────────────────────────────────────
export default function MemoryPage() {
  // Historique des messages dans le fil de chat
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: 'Bonjour ! Je suis la mémoire IA de Veridian. Pose-moi une question sur tes réunions, décisions ou projets.',
    },
  ])

  // Texte saisi dans le champ
  const [input, setInput] = useState('')

  // true pendant que l'IA "répond" (simulation)
  const [loading, setLoading] = useState(false)

  // Référence vers le bas du fil — pour scroll automatique
  const bottomRef = useRef(null)

  // Scroll automatique vers le bas à chaque nouveau message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  // ─── Envoi d'un message ─────────────────────────────────────────────────────
  async function handleSend() {
    const text = input.trim()
    if (!text || loading) return

    // 1. Ajouter le message utilisateur dans le fil
    setMessages((prev) => [...prev, { role: 'user', content: text }])
    setInput('')
    setLoading(true)

    // 2. Simuler une réponse IA (sera remplacé par un vrai appel API)
    //    setTimeout simule le délai réseau + traitement
    await new Promise((r) => setTimeout(r, 1500))

    const fakeReply = getFakeReply(text)
    setMessages((prev) => [...prev, { role: 'assistant', content: fakeReply }])
    setLoading(false)
  }

  // Envoyer avec la touche Entrée (Shift+Entrée = saut de ligne)
  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <>
      {/* Animation CSS pour les points du TypingIndicator */}
      <style>{`
        @keyframes bounce {
          0%, 60%, 100% { transform: translateY(0); }
          30%            { transform: translateY(-6px); }
        }
      `}</style>

      <div style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        gap: '1rem',
      }}>

        {/* En-tête */}
        <div>
          <h1 style={{ fontSize: '1.375rem', fontWeight: '600', color: 'var(--color-text)' }}>
            Mémoire IA
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginTop: '0.25rem' }}>
            Interroge l'historique de tes réunions en langage naturel
          </p>
        </div>

        {/* Fil de conversation — scrollable */}
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

          {/* Points de chargement pendant la réponse IA */}
          {loading && <TypingIndicator />}

          {/* Ancre invisible tout en bas pour le scroll auto */}
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
              color: input.trim() && !loading ? '#fff' : 'var(--color-text-muted)',
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

// ─── Réponses fictives ────────────────────────────────────────────────────────
// Simule des réponses IA selon des mots-clés — sera remplacé par chatWithMemory()
function getFakeReply(text) {
  const t = text.toLowerCase()
  if (t.includes('décision'))
    return 'Lors du Sprint 4, trois décisions ont été prises : migrer vers PostgreSQL, adopter React pour le frontend, et reporter la v2 mobile au prochain sprint.'
  if (t.includes('tâche'))
    return 'Les tâches en cours sont : wireframes mobile (Marie), migration BDD (Francis), et tests unitaires (Jean).'
  if (t.includes('projet'))
    return 'Tu as 3 projets actifs : Alpha (refonte UI), Beta (app mobile), et Gamma (audit sécurité).'
  if (t.includes('contradiction'))
    return 'Une contradiction a été détectée : en Sprint 3 il a été décidé de garder MySQL, mais en Sprint 4 la décision a été inversée vers PostgreSQL.'
  return 'Je n\'ai pas trouvé d\'information précise sur ce sujet dans les réunions enregistrées. Essaie de reformuler ou de préciser le projet concerné.'
}