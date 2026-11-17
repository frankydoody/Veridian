import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  pickRecordingType, extensionForType, formatDuration, formatSize,
  describeMicrophoneError, recordingUnsupportedReason, validateAudioFile,
} from './recording.js'

test('pickRecordingType : le premier format pris en charge, sinon vide', () => {
  assert.equal(pickRecordingType(() => true), 'audio/webm;codecs=opus')
  assert.equal(pickRecordingType((t) => t === 'audio/mp4'), 'audio/mp4') // Safari
  assert.equal(pickRecordingType(() => false), '')
  assert.equal(pickRecordingType(undefined), '')
  assert.equal(pickRecordingType(() => { throw new Error('x') }), '')
})

test('extensionForType', () => {
  assert.equal(extensionForType('audio/webm;codecs=opus'), 'webm')
  assert.equal(extensionForType('audio/mp4'), 'm4a')
  assert.equal(extensionForType(''), 'webm')
})

test('formatDuration et formatSize', () => {
  assert.equal(formatDuration(0), '00:00')
  assert.equal(formatDuration(75), '01:15')
  assert.equal(formatDuration(3725), '1:02:05')
  assert.match(formatSize(1.5 * 1024 * 1024), /^1,5\sMo$/)
})

test('describeMicrophoneError : messages clairs selon la cause', () => {
  assert.match(describeMicrophoneError({ name: 'NotAllowedError' }), /refusé/)
  assert.match(describeMicrophoneError({ name: 'NotFoundError' }), /Aucun micro/)
  assert.match(describeMicrophoneError({ name: 'NotReadableError' }), /occupé/)
  assert.match(describeMicrophoneError({ name: 'Autre', message: 'boum' }), /boum/)
})

test('recordingUnsupportedReason : contexte non sécurisé, API absentes', () => {
  const ok = { isSecureContext: true, navigator: { mediaDevices: { getUserMedia() {} } }, MediaRecorder: function () {} }
  assert.equal(recordingUnsupportedReason(ok), null)
  assert.match(recordingUnsupportedReason({ ...ok, isSecureContext: false }), /localhost/)
  assert.match(recordingUnsupportedReason({ ...ok, navigator: {} }), /micro/)
  assert.match(recordingUnsupportedReason({ ...ok, MediaRecorder: undefined }), /MediaRecorder/)
})

test('validateAudioFile : type, fichier vide, taille maximale', () => {
  assert.equal(validateAudioFile({ name: 'r.mp3', type: 'audio/mpeg', size: 1000 }, 200), null)
  assert.equal(validateAudioFile({ name: 'r.m4a', type: '', size: 1000 }, 200), null) // type inconnu du système
  assert.match(validateAudioFile({ name: 'doc.pdf', type: 'application/pdf', size: 10 }, 200), /Format/)
  assert.match(validateAudioFile({ name: 'r.wav', type: 'audio/wav', size: 0 }, 200), /vide/)
  assert.match(validateAudioFile({ name: 'r.wav', type: 'audio/wav', size: 300 * 1024 * 1024 }, 200), /trop volumineux/)
  assert.match(validateAudioFile(null, 200), /Choisissez/)
})
