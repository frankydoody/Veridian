// src/utils/recording.js
// Outils de l'enregistrement audio (bloc 20). Fonctions pures : testables avec node --test.

// Formats d'enregistrement, du préféré au moins préféré.
// Chrome/Edge : webm/opus ; Firefox : webm ou ogg/opus ; Safari : mp4.
export const RECORDING_TYPES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/ogg;codecs=opus',
  'audio/mp4',
]

/**
 * Premier format pris en charge par le navigateur, ou '' (le navigateur choisira lui-même).
 * @param isTypeSupported  MediaRecorder.isTypeSupported (paramètre : testable sans navigateur)
 */
export function pickRecordingType(isTypeSupported) {
  if (typeof isTypeSupported !== 'function') return ''
  return RECORDING_TYPES.find((type) => {
    try { return isTypeSupported(type) } catch { return false }
  }) ?? ''
}

// Extension de fichier pour un type d'enregistrement (le serveur, lui, se fie au type)
export function extensionForType(type) {
  const base = String(type ?? '').split(';')[0]
  return { 'audio/webm': 'webm', 'audio/ogg': 'ogg', 'audio/mp4': 'm4a', 'audio/mpeg': 'mp3', 'audio/wav': 'wav' }[base] ?? 'webm'
}

// 75 → « 01:15 » ; 3725 → « 1:02:05 »
export function formatDuration(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds || 0))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const pad = (n) => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`
}

// « 1 536 000 » octets → « 1,5 Mo »
export function formatSize(bytes) {
  if (!bytes) return '0 Mo'
  return `${(bytes / 1024 / 1024).toLocaleString('fr-CA', { maximumFractionDigits: 1 })} Mo`
}

/**
 * Message clair pour une erreur de getUserMedia / MediaRecorder.
 * https://developer.mozilla.org/docs/Web/API/MediaDevices/getUserMedia#exceptions
 */
export function describeMicrophoneError(error) {
  switch (error?.name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return 'Accès au micro refusé. Autorisez le micro pour ce site (icône à gauche de l\'adresse), puis réessayez.'
    case 'NotFoundError':
    case 'OverconstrainedError':
      return 'Aucun micro détecté. Branchez un micro ou vérifiez les réglages son de l\'ordinateur.'
    case 'NotReadableError':
    case 'AbortError':
      return 'Le micro est occupé ou inaccessible (une autre application l\'utilise peut-être). Fermez-la et réessayez.'
    default:
      return `Impossible de démarrer l'enregistrement : ${error?.message || 'erreur inconnue'}.`
  }
}

// Pourquoi ce navigateur ne peut pas enregistrer (ou null s'il le peut)
export function recordingUnsupportedReason(win) {
  if (!win) return 'Navigateur indisponible.'
  if (win.isSecureContext === false) {
    return 'L\'enregistrement exige une adresse sécurisée (https:// ou http://localhost). Utilisez http://localhost:5173.'
  }
  if (!win.navigator?.mediaDevices?.getUserMedia) return 'Ce navigateur ne permet pas d\'accéder au micro. Utilisez Chrome, Edge ou Firefox récents.'
  if (typeof win.MediaRecorder !== 'function') return 'Ce navigateur ne sait pas enregistrer l\'audio (MediaRecorder absent). Utilisez Chrome, Edge ou Firefox récents.'
  return null
}

export const AUDIO_FILE_ACCEPT = '.mp3,.wav,.m4a,.webm,.ogg,audio/*'
const AUDIO_FILE_EXTENSIONS = ['mp3', 'wav', 'm4a', 'webm', 'ogg']

/**
 * Vérifie un fichier choisi AVANT de l'envoyer.
 * @returns message d'erreur, ou null si le fichier est acceptable
 */
export function validateAudioFile(file, maxMb) {
  if (!file) return 'Choisissez un fichier audio.'
  const extension = String(file.name ?? '').split('.').pop().toLowerCase()
  const isAudioType = String(file.type ?? '').startsWith('audio/')
  if (!isAudioType && !AUDIO_FILE_EXTENSIONS.includes(extension)) {
    return 'Format non pris en charge. Formats acceptés : mp3, wav, m4a, webm, ogg.'
  }
  if (file.size === 0) return 'Le fichier est vide.'
  if (maxMb && file.size > maxMb * 1024 * 1024) {
    return `Fichier trop volumineux (${formatSize(file.size)}) : ${maxMb} Mo au maximum.`
  }
  return null
}
