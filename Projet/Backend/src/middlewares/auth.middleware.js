import { verifyToken } from '../utils/jwt.utils.js';
import { findUserById} from '../models/user.model.js';


export const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        message: 'Token manquant ou format invalide'
      });
    }

    const token = authHeader.split(' ')[1];

    const decoded = verifyToken(token);

    const user = await findUserById(decoded.id);

    if (!user || !user.is_active) {
      return res.status(401).json({
        message: 'Utilisateur introuvable ou désactivé'
      });
    }

    req.user = user;

    next();

  } catch (error) {
    return res.status(401).json({
      message: 'Token invalide ou expiré'
    });
  }
};




