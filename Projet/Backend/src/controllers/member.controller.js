// src/controllers/member.controller.js
// Bloc 13 — Gestion des membres d'un projet.
//   GET    /api/projects/:id/members           tout membre du projet
//   POST   /api/projects/:id/members           propriétaire seulement ; { email } d'un compte EXISTANT
//   DELETE /api/projects/:id/members/:userId   propriétaire seulement ; jamais le propriétaire
//
// Codes de réponse :
//   400 identifiant ou courriel invalide
//   404 projet inexistant OU l'utilisateur n'en est pas membre (même réponse : on ne révèle
//       pas l'existence d'un projet à quelqu'un qui n'y a pas accès)
//   403 membre du projet mais pas propriétaire (il connaît déjà le projet : rien n'est révélé)
import { findProjectById } from '../models/project.model.js';
import {
  findProjectMembers,
  findActiveUserByEmail,
  addProjectMember,
  deactivateProjectMember,
} from '../models/member.model.js';
import { isUuid, isEmail, normalizeEmail } from '../utils/validation.utils.js';

const NOT_FOUND = { message: 'Projet introuvable ou accès non autorisé' };
const OWNER_ONLY = { message: 'Seul le propriétaire du projet peut gérer ses membres' };

// Vérifie l'identifiant et l'appartenance. Renvoie le projet, ou null après avoir répondu.
const loadProject = async (req, res) => {
  const { id } = req.params;
  if (!isUuid(id)) {
    res.status(400).json({ message: 'Identifiant de projet invalide' });
    return null;
  }
  const project = await findProjectById(id, req.user.id);
  if (!project) {
    res.status(404).json(NOT_FOUND);
    return null;
  }
  return project;
};

export const getMembersHandler = async (req, res, next) => {
  try {
    const project = await loadProject(req, res);
    if (!project) return;

    const members = await findProjectMembers(project.id);
    return res.status(200).json({ count: members.length, members });
  } catch (error) {
    next(error);
  }
};

export const addMemberHandler = async (req, res, next) => {
  try {
    const project = await loadProject(req, res);
    if (!project) return;
    if (project.owner_id !== req.user.id) return res.status(403).json(OWNER_ONLY);

    const { email } = req.body ?? {};
    if (!isEmail(email)) {
      return res.status(400).json({ message: 'Adresse courriel invalide' });
    }

    const user = await findActiveUserByEmail(normalizeEmail(email));
    if (!user) {
      return res.status(404).json({
        message: 'Aucun compte actif avec ce courriel. La personne doit d\'abord créer son compte Veridian.',
      });
    }

    const added = await addProjectMember(project.id, user.id);
    if (!added) {
      return res.status(409).json({ message: `${user.name} est déjà membre de ce projet` });
    }

    return res.status(201).json({
      message: `${user.name} a été ajouté(e) au projet`,
      member: { id: user.id, name: user.name, email: user.email, role: added.role, joined_at: added.joined_at },
    });
  } catch (error) {
    next(error);
  }
};

export const removeMemberHandler = async (req, res, next) => {
  try {
    const project = await loadProject(req, res);
    if (!project) return;
    if (project.owner_id !== req.user.id) return res.status(403).json(OWNER_ONLY);

    const { userId } = req.params;
    if (!isUuid(userId)) {
      return res.status(400).json({ message: 'Identifiant d\'utilisateur invalide' });
    }
    if (userId === project.owner_id) {
      return res.status(400).json({ message: 'Le propriétaire ne peut pas être retiré du projet' });
    }

    const removed = await deactivateProjectMember(project.id, userId);
    if (!removed) {
      return res.status(404).json({ message: 'Cette personne n\'est pas membre du projet' });
    }
    return res.status(200).json({ message: 'Membre retiré du projet' });
  } catch (error) {
    next(error);
  }
};
