import { describe, test, expect } from '@jest/globals';
import { hashPassword, comparePassword } from '../../src/utils/hash.utils.js';

describe('hash.utils', () => {

  describe('hashPassword', () => {
    test('doit retourner un hash différent du mot de passe original', async () => {
      const password = 'monMotDePasse123';
      const hash = await hashPassword(password);
      expect(hash).not.toBe(password);
    });

    test('doit retourner un hash bcrypt (commence par $2b$)', async () => {
      const hash = await hashPassword('test123');
      expect(hash).toMatch(/^\$2b\$/);
    });

    test('deux hashes du même mot de passe doivent être différents (salt)', async () => {
      const hash1 = await hashPassword('memeMotDePasse');
      const hash2 = await hashPassword('memeMotDePasse');
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('comparePassword', () => {
    test('doit retourner true pour le bon mot de passe', async () => {
      const password = 'monMotDePasse123';
      const hash = await hashPassword(password);
      const result = await comparePassword(password, hash);
      expect(result).toBe(true);
    });

    test('doit retourner false pour un mauvais mot de passe', async () => {
      const hash = await hashPassword('bonMotDePasse');
      const result = await comparePassword('mauvaisMotDePasse', hash);
      expect(result).toBe(false);
    });
  });

});