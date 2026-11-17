import jwt from 'jsonwebtoken';

// Bloc 17 : algorithme imposé (HS256) à la signature ET à la vérification.
// Sans la liste « algorithms », une bibliothèque mal configurée peut accepter un jeton
// dont l'en-tête annonce un autre algorithme (attaque classique « alg: none »).
const ALGORITHM = 'HS256';

export const generateToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    algorithm: ALGORITHM,
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
};

export const verifyToken = (token) => {
  return jwt.verify(token, process.env.JWT_SECRET, { algorithms: [ALGORITHM] });
};
