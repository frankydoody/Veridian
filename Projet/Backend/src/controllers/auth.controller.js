import { findUserByEmail, createUser } from '../models/user.model.js';
import { hashPassword, comparePassword } from '../utils/hash.utils.js';
import { generateToken } from '../utils/jwt.utils.js';
import { validateRegistration, normalizeEmail } from '../utils/validation.utils.js';

// Bloc 17 : empreinte bcrypt d'un mot de passe quelconque, calculée une seule fois.
// Quand le courriel est inconnu, on compare quand même le mot de passe à cette empreinte :
// la réponse prend alors le même temps qu'avec un vrai compte, et la durée ne révèle
// pas si un courriel est inscrit.
let dummyHash;
const getDummyHash = async () => {
  dummyHash ??= await hashPassword('mot-de-passe-factice-pour-egaliser-le-temps');
  return dummyHash;
};

export const register = async (req, res, next) => {
  try {
    const { value, error } = validateRegistration(req.body ?? {});
    if (error) return res.status(400).json({ message: error });

    // Courriel enregistré en minuscules ; doublon détecté sans tenir compte de la casse
    const existingUser = await findUserByEmail(value.email);
    if (existingUser) {
      return res.status(409).json({
        message: 'Un compte existe déjà avec cet email'
      });
    }

    const hashedPassword = await hashPassword(value.password);
    const newUser = await createUser(value.name, value.email, hashedPassword);

    const token = generateToken({ id: newUser.id, role: newUser.role });

    return res.status(201).json({
      message: 'Compte créé avec succès',
      token,
      user: newUser
    });

  } catch (error) {
    // Deux inscriptions simultanées du même courriel : la contrainte UNIQUE tranche
    if (error.code === '23505') {
      return res.status(409).json({ message: 'Un compte existe déjà avec cet email' });
    }
    next(error);
  }
};

export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body ?? {};

    if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
      return res.status(400).json({
        message: 'Email et mot de passe obligatoires'
      });
    }

    const user = await findUserByEmail(normalizeEmail(email));

    // Bloc 17 : le mot de passe est vérifié AVANT de dire quoi que ce soit sur le compte.
    // Avant, « compte désactivé » était répondu sans mot de passe valide : n'importe qui
    // pouvait savoir qu'un courriel était inscrit.
    const isValidPassword = await comparePassword(password, user ? user.password_hash : await getDummyHash());
    if (!user || !isValidPassword) {
      return res.status(401).json({
        message: 'Email ou mot de passe incorrect'
      });
    }

    if (!user.is_active) {
      return res.status(403).json({
        message: 'Ce compte a été désactivé'
      });
    }

    const token = generateToken({ id: user.id, role: user.role });

    const { password_hash, ...userWithoutPassword } = user;

    return res.status(200).json({
      message: 'Connexion réussie',
      token,
      user: userWithoutPassword
    });

  } catch (error) {
    next(error);
  }
};

export const me = (req, res) => {
  const { password_hash, ...user } = req.user;

  return res.status(200).json({
    message: 'Utilisateur connecté',
    user
  });
};
