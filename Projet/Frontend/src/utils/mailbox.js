// src/utils/mailbox.js
// Bloc 18 : lien vers la boîte courriel de test (Mailpit), filtré sur l'adresse de
// l'utilisateur connecté (page de recherche de Mailpit : /search?q=to:adresse).

/**
 * Adresse de la boîte de test, filtrée sur `email` si elle est fournie.
 * Renvoie null si l'adresse de base est absente ou n'est pas http(s) (lien jamais dangereux).
 */
export function mailboxLink(base, email) {
  if (typeof base !== 'string' || !/^https?:\/\//i.test(base.trim())) return null
  const root = base.trim().replace(/\/+$/, '')
  return email ? `${root}/search?q=${encodeURIComponent(`to:${email}`)}` : root
}
