import { describe, test, expect } from '@jest/globals';
import {
  isUuid, isEmail, normalizeEmail, cleanText, parseDueDate,
  parseScheduledAt, parseCalendarRange, CALENDAR_MAX_DAYS,
} from '../../src/utils/validation.utils.js';

describe('validation.utils (bloc 13)', () => {
  test('isUuid : accepte un UUID, refuse le reste (évite une erreur 500 de PostgreSQL)', () => {
    expect(isUuid('3f2b8c1e-9a4d-4e7b-8c2a-1d5e6f7a8b9c')).toBe(true);
    expect(isUuid('123')).toBe(false);
    expect(isUuid("1' OR '1'='1")).toBe(false);
    expect(isUuid(undefined)).toBe(false);
  });

  test('isEmail et normalizeEmail', () => {
    expect(isEmail('marie.tremblay@example.com')).toBe(true);
    expect(isEmail('pas-un-courriel')).toBe(false);
    expect(isEmail('a@b')).toBe(false);
    expect(normalizeEmail('  Marie@Example.COM ')).toBe('marie@example.com');
  });

  test('cleanText : obligatoire, facultatif, longueur maximale, espaces retirés', () => {
    expect(cleanText('  Titre  ', { label: 'Le titre', max: 10, required: true })).toEqual({ value: 'Titre', error: null });
    expect(cleanText('   ', { label: 'Le titre', max: 10, required: true }).error).toBe('Le titre est obligatoire');
    expect(cleanText(undefined, { label: 'La description', max: 10 })).toEqual({ value: null, error: null });
    expect(cleanText('x'.repeat(11), { label: 'Le titre', max: 10 }).error).toMatch(/10 caractères/);
    expect(cleanText(42, { label: 'Le titre', max: 10 }).error).toMatch(/texte/);
  });

  test('parseDueDate : AAAA-MM-JJ fixée à 17 h UTC (même jour dans tous les fuseaux)', () => {
    expect(parseDueDate('2026-11-20').value.toISOString()).toBe('2026-11-20T17:00:00.000Z');
    expect(parseDueDate('').value).toBeNull();
    expect(parseDueDate(null).value).toBeNull();
    expect(parseDueDate('31/12/2026').error).toBeTruthy();
    expect(parseDueDate('1999-01-01').error).toMatch(/hors limites/);
  });
});

// Bloc 16 — Date prévue d'une réunion et plage du calendrier
describe('parseScheduledAt (bloc 16)', () => {
  test('absente → null sans erreur (facultative)', () => {
    expect(parseScheduledAt(undefined)).toEqual({ value: null, error: null });
    expect(parseScheduledAt('')).toEqual({ value: null, error: null });
  });

  test('date ISO complète → conservée telle quelle (instant UTC)', () => {
    expect(parseScheduledAt('2026-12-05T19:30:00.000Z').value.toISOString()).toBe('2026-12-05T19:30:00.000Z');
  });

  test('date seule → midi UTC, pour rester sur le même jour', () => {
    expect(parseScheduledAt('2026-12-05').value.toISOString()).toBe('2026-12-05T12:00:00.000Z');
  });

  test('texte, nombre ou année absurde → erreur', () => {
    expect(parseScheduledAt('demain').error).toBe('Date de réunion invalide');
    expect(parseScheduledAt(12).error).toBe('Date de réunion invalide');
    expect(parseScheduledAt('1850-01-01').error).toBe('Date de réunion hors limites');
  });
});

describe('parseCalendarRange (bloc 16)', () => {
  test('plage valide (une grille de 6 semaines)', () => {
    expect(parseCalendarRange('2026-11-30', '2027-01-10')).toEqual({ from: '2026-11-30', to: '2027-01-10', error: null });
  });

  test('un seul jour est accepté', () => {
    expect(parseCalendarRange('2026-12-05', '2026-12-05').error).toBeNull();
  });

  test('paramètre manquant → erreur', () => {
    expect(parseCalendarRange('2026-12-01', undefined).error).toMatch(/obligatoires/);
  });

  test('format invalide ou jour inexistant → erreur', () => {
    expect(parseCalendarRange('01/12/2026', '2026-12-31').error).toMatch(/Date invalide/);
    expect(parseCalendarRange('2026-02-31', '2026-03-05').error).toMatch(/Date invalide/);
    // Un tableau (?from=a&from=b) n'est pas une chaîne
    expect(parseCalendarRange(['2026-12-01'], '2026-12-31').error).toMatch(/Date invalide/);
  });

  test('fin avant début → erreur', () => {
    expect(parseCalendarRange('2026-12-10', '2026-12-01').error).toMatch(/suivre/);
  });

  test(`plus de ${CALENDAR_MAX_DAYS} jours → erreur`, () => {
    expect(parseCalendarRange('2026-01-01', '2026-12-31').error).toMatch(/trop longue/);
  });
});
