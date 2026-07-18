import { describe, test, expect } from '@jest/globals';
import { generateToken, verifyToken } from '../../src/utils/jwt.utils.js';

describe('jwt.utils', () => {

  const payload = { id: 'abc-123', role: 'member' };

  describe('generateToken', () => {
    test('doit retourner un token JWT (3 segments séparés par des points)', () => {
      const token = generateToken(payload);
      const segments = token.split('.');
      expect(segments).toHaveLength(3);
    });

    test('doit encoder le payload dans le token', () => {
      const token = generateToken(payload);
      const decoded = verifyToken(token);
      expect(decoded.id).toBe(payload.id);
      expect(decoded.role).toBe(payload.role);
    });

    test('doit inclure une date d\'expiration', () => {
      const token = generateToken(payload);
      const decoded = verifyToken(token);
      expect(decoded.exp).toBeDefined();
    });
  });

  describe('verifyToken', () => {
    test('doit retourner le payload pour un token valide', () => {
      const token = generateToken(payload);
      const decoded = verifyToken(token);
      expect(decoded.id).toBe('abc-123');
      expect(decoded.role).toBe('member');
    });

    test('doit lever une erreur pour un token invalide', () => {
      expect(() => verifyToken('token.invalide.ici')).toThrow();
    });

    test('doit lever une erreur pour un token modifié', () => {
      const token = generateToken(payload);
      const tokenModifie = token.slice(0, -5) + 'xxxxx';
      expect(() => verifyToken(tokenModifie)).toThrow();
    });
  });

});