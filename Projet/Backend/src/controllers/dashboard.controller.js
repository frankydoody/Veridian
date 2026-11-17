// src/controllers/dashboard.controller.js
// Bloc 21 — GET /api/dashboard : compteurs réels pour l'utilisateur connecté.
import { findDashboardSummary } from '../models/dashboard.model.js';

export const getDashboardHandler = async (req, res, next) => {
  try {
    const summary = await findDashboardSummary(req.user.id);
    return res.status(200).json(summary);
  } catch (error) {
    next(error);
  }
};
