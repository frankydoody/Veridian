// src/components/AudioRecorder.jsx — enregistrer une réunion dans le navigateur (bloc 20)
// getUserMedia (micro) + MediaRecorder (encodage) ; minuteur, pause / reprise, écoute de
// contrôle, envoi avec progression. Si l'envoi échoue, l'enregistrement reste en mémoire.
import { useCallback, useEffect, useRef, useState } from 'react'
import { uploadWithProgress } from '../services/api.js'
import { Button, FormError } from './form.jsx'
import {
  pickRecordingType, extensionForType, formatDuration, formatSize,
  describeMicrophoneError, recordingUnsupportedReason,
} from '../utils/recording.js'

// Niveau du micro (0 à 1), mesuré environ 10 fois par seconde
function useMicLevel(stream, active) {
  const [level, setLevel] = useState(0)
  useEffect(() => {
    if (!stream || !active) { setLevel(0); return undefined }
    const AudioCtx = window.AudioContext || window.webkitAudioContext
    if (!AudioCtx) return undefined
    const ctx = new AudioCtx()
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 512
    ctx.createMediaStreamSource(stream).connect(analyser)
    const data = new Uint8Array(analyser.fftSize)
    const timer = setInterval(() => {
      analyser.getByteTimeDomainData(data)
      let peak = 0
      for (const v of data) peak = Math.max(peak, Math.abs(v - 128))
      setLevel(Math.min(1, peak / 64))
    }, 100)
    return () => { clearInterval(timer); ctx.close() }
  }, [stream, active])
  return level
}

export default function AudioRecorder({ meetingId, maxMb, disabled, onUploaded }) {
  // idle | starting | recording | paused | stopped | uploading
  const [state, setState] = useState('idle')
  const [error, setError] = useState('')
  const [elapsed, setElapsed] = useState(0)
  const [recording, setRecording] = useState(null) // { blob, url, type }
  const [progress, setProgress] = useState(0)
  const [stream, setStream] = useState(null)

  const recorderRef = useRef(null)
  const chunksRef = useRef([])
  const clockRef = useRef({ accumulated: 0, startedAt: 0 })
  const unsupported = recordingUnsupportedReason(window)
  const level = useMicLevel(stream, state === 'recording')

  const releaseMicrophone = useCallback(() => {
    stream?.getTracks().forEach((track) => track.stop())
    setStream(null)
  }, [stream])

  // Minuteur : temps accumulé + temps depuis la dernière reprise
  useEffect(() => {
    if (state !== 'recording') return undefined
    const timer = setInterval(() => {
      const { accumulated, startedAt } = clockRef.current
      setElapsed((accumulated + Date.now() - startedAt) / 1000)
    }, 250)
    return () => clearInterval(timer)
  }, [state])

  // Prévenir avant de fermer l'onglet si un enregistrement n'est pas envoyé
  useEffect(() => {
    if (!['recording', 'paused', 'stopped', 'uploading'].includes(state)) return undefined
    const warn = (e) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [state])

  // En quittant la page : arrêter l'enregistrement, libérer le micro et la mémoire
  useEffect(() => () => {
    if (recorderRef.current?.state !== 'inactive') recorderRef.current?.stop()
    recorderRef.current?.stream?.getTracks().forEach((t) => t.stop())
  }, [])
  useEffect(() => () => { if (recording?.url) URL.revokeObjectURL(recording.url) }, [recording])

  async function start() {
    setError('')
    setState('starting')
    let micStream
    try {
      micStream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      })
    } catch (err) {
      setError(describeMicrophoneError(err))
      setState('idle')
      return
    }

    try {
      const type = pickRecordingType(window.MediaRecorder.isTypeSupported?.bind(window.MediaRecorder))
      const recorder = new MediaRecorder(micStream, type ? { mimeType: type } : undefined)
      chunksRef.current = []
      recorder.ondataavailable = (e) => { if (e.data?.size) chunksRef.current.push(e.data) }
      recorder.onstop = () => {
        const finalType = recorder.mimeType || type || 'audio/webm'
        const blob = new Blob(chunksRef.current, { type: finalType })
        setRecording({ blob, url: URL.createObjectURL(blob), type: finalType })
        setState('stopped')
      }
      recorder.onerror = (e) => setError(`Erreur pendant l'enregistrement : ${e.error?.message ?? 'inconnue'}`)
      // Données remises chaque seconde : un problème en cours de route ne fait pas tout perdre
      recorder.start(1000)
      recorderRef.current = recorder
      clockRef.current = { accumulated: 0, startedAt: Date.now() }
      setElapsed(0)
      setStream(micStream)
      setState('recording')
    } catch (err) {
      micStream.getTracks().forEach((t) => t.stop())
      setError(describeMicrophoneError(err))
      setState('idle')
    }
  }

  function pause() {
    recorderRef.current?.pause()
    clockRef.current.accumulated += Date.now() - clockRef.current.startedAt
    setState('paused')
  }

  function resume() {
    recorderRef.current?.resume()
    clockRef.current.startedAt = Date.now()
    setState('recording')
  }

  function stop() {
    if (state === 'recording') clockRef.current.accumulated += Date.now() - clockRef.current.startedAt
    setElapsed(clockRef.current.accumulated / 1000)
    recorderRef.current?.stop() // → onstop crée le fichier
    releaseMicrophone()
  }

  function discard() {
    if (!window.confirm('Effacer cet enregistrement sans l\'envoyer ?')) return
    setRecording(null)
    setElapsed(0)
    setState('idle')
  }

  async function send() {
    if (!recording) return
    if (maxMb && recording.blob.size > maxMb * 1024 * 1024) {
      setError(`Enregistrement trop volumineux (${formatSize(recording.blob.size)}) : ${maxMb} Mo au maximum.`)
      return
    }
    setError('')
    setProgress(0)
    setState('uploading')
    const form = new FormData()
    form.append('meetingId', meetingId)
    const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')
    form.append('audio', recording.blob, `reunion-${stamp}.${extensionForType(recording.type)}`)
    try {
      const data = await uploadWithProgress('/transcriptions/upload', form, setProgress)
      setRecording(null)
      setState('idle')
      onUploaded?.(data)
    } catch (err) {
      // L'enregistrement est conservé : on peut réessayer
      setError(err.message)
      setState('stopped')
    }
  }

  if (unsupported) return <FormError message={unsupported} />

  const isLive = state === 'recording' || state === 'paused'

  return (
    <div>
      <FormError message={error} />

      {(state === 'idle' || state === 'starting') && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <Button onClick={start} disabled={disabled || state === 'starting'}>
            {state === 'starting' ? 'Autorisation du micro…' : '● Enregistrer'}
          </Button>
          <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
            Le navigateur demandera l'accès au micro.
          </span>
        </div>
      )}

      {isLive && (
        <div role="status" aria-live="polite" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <span style={{
            width: '10px', height: '10px', borderRadius: '50%', flexShrink: 0,
            background: state === 'recording' ? '#F87171' : 'var(--color-text-faint)',
            animation: state === 'recording' ? 'pulse 1.2s ease-in-out infinite' : 'none',
          }} />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '1.25rem', minWidth: '4.5rem' }}>{formatDuration(elapsed)}</span>
          <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>{state === 'paused' ? 'En pause' : 'Enregistrement…'}</span>
          {/* Niveau du micro : s'il reste à plat en parlant, le mauvais micro est choisi */}
          <div aria-label="Niveau du micro" style={{ width: '90px', height: '6px', borderRadius: '3px', background: 'var(--color-surface-3)', overflow: 'hidden' }}>
            <div style={{ width: `${Math.round(level * 100)}%`, height: '100%', background: 'var(--color-success)', transition: 'width 90ms linear' }} />
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', marginLeft: 'auto' }}>
            {state === 'recording'
              ? <Button variant="secondary" onClick={pause}>Pause</Button>
              : <Button variant="secondary" onClick={resume}>Reprendre</Button>}
            <Button variant="danger" onClick={stop}>■ Arrêter</Button>
          </div>
          <style>{'@keyframes pulse { 0%,100% { opacity: 1 } 50% { opacity: 0.3 } }'}</style>
        </div>
      )}

      {(state === 'stopped' || state === 'uploading') && recording && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
            Enregistrement de {formatDuration(elapsed)} · {formatSize(recording.blob.size)} — écoutez-le avant de l'envoyer.
          </div>
          <audio controls src={recording.url} style={{ width: '100%' }} aria-label="Écoute de contrôle" />
          {state === 'uploading' ? (
            <div>
              <div style={{ fontSize: '12px', marginBottom: '0.35rem' }}>Envoi… {progress} %</div>
              <div role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}
                style={{ height: '6px', borderRadius: '3px', background: 'var(--color-surface-3)', overflow: 'hidden' }}>
                <div style={{ width: `${progress}%`, height: '100%', background: 'var(--color-ai)' }} />
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <Button variant="secondary" onClick={discard}>Recommencer</Button>
              <Button onClick={send} disabled={disabled}>{error ? 'Réessayer l\'envoi' : 'Envoyer pour transcription'}</Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
