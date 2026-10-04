// src/utils/chunk.utils.js
// Découpage d'un texte long en morceaux (chunks) qui se chevauchent.
// Fonction pure : aucune dépendance, donc facile à tester unitairement.

const DEFAULT_SIZE = 500;       // caractères par chunk
const DEFAULT_OVERLAP = 100;    // caractères partagés entre deux chunks voisins
const DEFAULT_MIN_LENGTH = 20;  // en dessous, le chunk est ignoré

/**
 * Découpe un texte en chunks avec chevauchement.
 * Le chevauchement évite de couper une idée en deux : la fin d'un chunk
 * est répétée au début du suivant.
 *
 * @param {string} text
 * @param {number} size      — longueur maximale d'un chunk
 * @param {number} overlap   — chevauchement entre deux chunks
 * @param {number} minLength — longueur minimale pour garder un chunk
 * @returns {{ text: string, charStart: number }[]}
 */
export const splitIntoChunks = (
  text,
  size = DEFAULT_SIZE,
  overlap = DEFAULT_OVERLAP,
  minLength = DEFAULT_MIN_LENGTH
) => {
  if (!text) return [];

  if (overlap >= size) {
    throw new Error('Le chevauchement doit être plus petit que la taille du chunk');
  }

  const chunks = [];
  const step = size - overlap;

  for (let start = 0; start < text.length; start += step) {
    const chunkText = text.slice(start, start + size).trim();

    if (chunkText.length >= minLength) {
      chunks.push({ text: chunkText, charStart: start });
    }

    // Le chunk courant atteint la fin du texte : inutile de continuer
    if (start + size >= text.length) break;
  }

  return chunks;
};
