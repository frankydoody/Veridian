// src/controllers/chat.controller.js
import { findProjectById } from '../models/project.model.js';
import {
  createConversation,
  findConversationsByProject,
  findConversationById,
  findMessagesByConversation,
  deactivateConversation,
} from '../models/chat.model.js';
import { askInConversation } from '../services/chat.service.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_QUESTION_LENGTH = 2000;
const MAX_TITLE_LENGTH = 200;

const NOT_FOUND = { message: 'Conversation introuvable ou accès non autorisé' };

// POST /api/chat/conversations   Body : { projectId, title? }
export const createConversationHandler = async (req, res, next) => {
  try {
    const { projectId, title } = req.body ?? {};

    if (typeof projectId !== 'string' || !UUID_REGEX.test(projectId)) {
      return res.status(400).json({ message: 'projectId est obligatoire (identifiant valide)' });
    }
    if (title !== undefined && (typeof title !== 'string' || title.length > MAX_TITLE_LENGTH)) {
      return res.status(400).json({ message: `Le titre doit être un texte de ${MAX_TITLE_LENGTH} caractères maximum` });
    }

    // L'appartenance au projet est vérifiée AVANT de créer quoi que ce soit
    const project = await findProjectById(projectId, req.user.id);
    if (!project) {
      return res.status(404).json({ message: 'Projet introuvable ou accès non autorisé' });
    }

    const conversation = await createConversation(projectId, req.user.id, title?.trim());

    return res.status(201).json({
      message: 'Conversation créée avec succès',
      conversation
    });

  } catch (error) {
    next(error);
  }
};

// GET /api/chat/conversations?projectId=...
export const getConversationsHandler = async (req, res, next) => {
  try {
    const { projectId } = req.query;

    if (typeof projectId !== 'string' || !UUID_REGEX.test(projectId)) {
      return res.status(400).json({ message: 'projectId est obligatoire (identifiant valide)' });
    }

    const project = await findProjectById(projectId, req.user.id);
    if (!project) {
      return res.status(404).json({ message: 'Projet introuvable ou accès non autorisé' });
    }

    const conversations = await findConversationsByProject(projectId, req.user.id);

    return res.status(200).json({
      message: 'Conversations récupérées avec succès',
      count: conversations.length,
      conversations
    });

  } catch (error) {
    next(error);
  }
};

// GET /api/chat/conversations/:id
export const getConversationHandler = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!UUID_REGEX.test(id)) {
      return res.status(400).json({ message: 'Identifiant de conversation invalide' });
    }

    const conversation = await findConversationById(id, req.user.id);
    if (!conversation) {
      return res.status(404).json(NOT_FOUND);
    }

    const messages = await findMessagesByConversation(id);

    return res.status(200).json({
      message: 'Conversation récupérée avec succès',
      conversation,
      messages
    });

  } catch (error) {
    next(error);
  }
};

// POST /api/chat/conversations/:id/messages   Body : { question }
export const sendMessageHandler = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { question } = req.body ?? {};

    if (!UUID_REGEX.test(id)) {
      return res.status(400).json({ message: 'Identifiant de conversation invalide' });
    }
    if (typeof question !== 'string' || question.trim() === '') {
      return res.status(400).json({ message: 'La question est obligatoire' });
    }
    if (question.trim().length > MAX_QUESTION_LENGTH) {
      return res.status(400).json({
        message: `La question est trop longue (${MAX_QUESTION_LENGTH} caractères maximum)`
      });
    }

    const conversation = await findConversationById(id, req.user.id);
    if (!conversation) {
      return res.status(404).json(NOT_FOUND);
    }

    let result;
    try {
      result = await askInConversation(conversation, question.trim());
    } catch (error) {
      // Panne de l'IA (clé absente, quota, réseau) : rien n'a été enregistré
      console.error('[Chat] Réponse impossible :', error.message);
      return res.status(502).json({
        message: "Le service d'IA est indisponible. Réessayez dans un instant."
      });
    }

    return res.status(201).json({
      message: 'Réponse générée avec succès',
      hasContext: result.hasContext,
      userMessage: result.userMessage,
      assistantMessage: result.assistantMessage
    });

  } catch (error) {
    next(error);
  }
};

// DELETE /api/chat/conversations/:id   (soft delete)
export const deleteConversationHandler = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!UUID_REGEX.test(id)) {
      return res.status(400).json({ message: 'Identifiant de conversation invalide' });
    }

    const deleted = await deactivateConversation(id, req.user.id);
    if (!deleted) {
      return res.status(404).json(NOT_FOUND);
    }

    return res.status(200).json({ message: 'Conversation supprimée avec succès' });

  } catch (error) {
    next(error);
  }
};
