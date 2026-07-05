import { findUserByEmail, createUser } from '../models/user.model.js';
import { hashPassword, comparePassword } from '../utils/hash.utils.js';
import { generateToken } from '../utils/jwt.utils.js';

export const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        message: 'Tous les champs sont obligatoires (name, email, password)'
      });
    }

    const existingUser = await findUserByEmail(email);
    if (existingUser) {
      return res.status(409).json({
        message: 'Un compte existe déjà avec cet email'
      });
    }

    const hashedPassword = await hashPassword(password);
    const newUser = await createUser(name, email, hashedPassword);

    const token = generateToken({ id: newUser.id, role: newUser.role });

    return res.status(201).json({
      message: 'Compte créé avec succès',
      token,
      user: newUser
    });

  } catch (error) {
    return res.status(500).json({
      message: 'Erreur serveur lors de l\'inscription'
    });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: 'Email et mot de passe obligatoires'
      });
    }

    const user = await findUserByEmail(email);
    if (!user) {
      return res.status(401).json({
        message: 'Email ou mot de passe incorrect'
      });
    }

    if (!user.is_active) {
      return res.status(403).json({
        message: 'Ce compte a été désactivé'
      });
    }

    const isValidPassword = await comparePassword(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({
        message: 'Email ou mot de passe incorrect'
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
    return res.status(500).json({
      message: 'Erreur serveur lors de la connexion'
    });
  }
};



