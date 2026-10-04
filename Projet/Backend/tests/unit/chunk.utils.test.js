import { describe, test, expect } from '@jest/globals';
import { splitIntoChunks } from '../../src/utils/chunk.utils.js';

// Texte sans espaces, pour que trim() ne change pas les longueurs
const makeText = (length) =>
  Array.from({ length }, (_, i) => String(i % 10)).join('');

describe('chunk.utils', () => {

  describe('splitIntoChunks', () => {
    test('doit retourner un tableau vide pour un texte vide', () => {
      expect(splitIntoChunks('')).toEqual([]);
      expect(splitIntoChunks(null)).toEqual([]);
    });

    test('doit ignorer un texte plus court que la longueur minimale', () => {
      expect(splitIntoChunks('court')).toEqual([]);
    });

    test('doit retourner un seul chunk pour un texte court', () => {
      const chunks = splitIntoChunks(makeText(100));
      expect(chunks).toHaveLength(1);
      expect(chunks[0].charStart).toBe(0);
      expect(chunks[0].text).toHaveLength(100);
    });

    test('doit découper un texte long avec le bon pas (taille - chevauchement)', () => {
      const chunks = splitIntoChunks(makeText(1200), 500, 100);
      expect(chunks.map((c) => c.charStart)).toEqual([0, 400, 800]);
    });

    test('la fin d\'un chunk doit se retrouver au début du suivant', () => {
      const chunks = splitIntoChunks(makeText(1200), 500, 100);
      expect(chunks[0].text.slice(-100)).toBe(chunks[1].text.slice(0, 100));
    });

    test('doit lancer une erreur si le chevauchement est >= à la taille', () => {
      expect(() => splitIntoChunks(makeText(1000), 100, 100)).toThrow();
    });
  });

});
