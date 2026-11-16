import { describe, test, expect } from '@jest/globals';
import { isUuid, isEmail, normalizeEmail, cleanText, parseDueDate } from '../../src/utils/validation.utils.js';

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
