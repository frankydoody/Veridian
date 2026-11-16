// src/controllers/task.controller.js
// Routes /api/tasks.
// Bloc 13 : création et modification complètes (acteur choisi parmi les membres du projet,
// échéance, priorité), suppression logique, validation des identifiants (400 au lieu de 500).

import {
  findAllTasks,
  findTaskForUser,
  createTask,
  updateTask,
  updateTaskStatus,
  deactivateTask,
} from '../models/task.model.js';
import { findProjectById } from '../models/project.model.js';
import { findMeetingById } from '../models/meeting.model.js';
import { isActiveMember } from '../models/member.model.js';
import {
  isUuid, cleanText, parseDueDate, TASK_PRIORITIES, TASK_STATUSES,
} from '../utils/validation.utils.js';

const TASK_NOT_FOUND = { message: 'Tâche introuvable ou accès non autorisé' };
const has = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);

/**
 * Valide les champs d'une tâche. En mode `partial` (modification), seuls les champs
 * présents sont vérifiés. Renvoie { fields } ou { error }.
 */
export function validateTaskFields(body, { partial = false } = {}) {
  const fields = {};

  if (!partial || has(body, 'title')) {
    const title = cleanText(body.title, { label: 'Le titre', max: 200, required: true });
    if (title.error) return { error: title.error };
    fields.title = title.value;
  }
  if (has(body, 'description')) {
    const description = cleanText(body.description, { label: 'La description', max: 2000 });
    if (description.error) return { error: description.error };
    fields.description = description.value;
  }
  if (has(body, 'priority')) {
    if (!TASK_PRIORITIES.includes(body.priority)) {
      return { error: `Priorité invalide. Valeurs acceptées : ${TASK_PRIORITIES.join(', ')}` };
    }
    fields.priority = body.priority;
  }
  if (has(body, 'status')) {
    if (!TASK_STATUSES.includes(body.status)) {
      return { error: `Statut invalide. Valeurs acceptées : ${TASK_STATUSES.join(', ')}` };
    }
    fields.status = body.status;
  }
  if (has(body, 'due_date')) {
    const due = parseDueDate(body.due_date);
    if (due.error) return { error: due.error };
    fields.due_date = due.value;
  }
  if (has(body, 'assignee_id')) {
    const id = body.assignee_id === '' ? null : body.assignee_id;
    if (id !== null && !isUuid(id)) return { error: 'Identifiant d\'acteur invalide' };
    fields.assignee_id = id;
  }
  return { fields };
}

// Un acteur doit être membre actif du projet de la tâche. Renvoie un message d'erreur ou null.
async function checkAssignee(assigneeId, projectId) {
  if (!assigneeId) return null;
  if (!projectId) return 'Choisissez un projet avant d\'assigner la tâche à un acteur';
  if (!(await isActiveMember(projectId, assigneeId))) {
    return 'L\'acteur choisi doit être membre du projet de la tâche';
  }
  return null;
}

// GET /api/tasks — tâches visibles par l'utilisateur connecté
export async function getAllTasksHandler(req, res, next) {
  try {
    const tasks = await findAllTasks(req.user.id);
    res.json({ tasks });
  } catch (err) {
    next(err);
  }
}

// POST /api/tasks — crée une tâche manuelle
export async function createTaskHandler(req, res, next) {
  try {
    const body = req.body ?? {};
    const { fields, error } = validateTaskFields(body);
    if (error) return res.status(400).json({ message: error });

    let projectId = body.project_id || null;
    const meetingId = body.meeting_id || null;
    if (projectId && !isUuid(projectId)) return res.status(400).json({ message: 'Identifiant de projet invalide' });
    if (meetingId && !isUuid(meetingId)) return res.status(400).json({ message: 'Identifiant de réunion invalide' });

    // Une tâche ne peut être rattachée qu'à un projet / une réunion dont l'utilisateur est membre
    if (projectId && !(await findProjectById(projectId, req.user.id))) {
      return res.status(404).json({ message: 'Projet introuvable ou accès non autorisé' });
    }
    if (meetingId) {
      const meeting = await findMeetingById(meetingId, req.user.id);
      if (!meeting) return res.status(404).json({ message: 'Réunion introuvable ou accès non autorisé' });
      if (projectId && meeting.project_id !== projectId) {
        return res.status(400).json({ message: 'La réunion n\'appartient pas à ce projet' });
      }
      projectId = meeting.project_id;
    }

    const assigneeError = await checkAssignee(fields.assignee_id, projectId);
    if (assigneeError) return res.status(400).json({ message: assigneeError });

    const created = await createTask({
      ...fields,
      project_id: projectId,
      meeting_id: meetingId,
      user_id: req.user.id,
    });
    const task = await findTaskForUser(created.id, req.user.id);
    res.status(201).json({ message: 'Tâche créée', task });
  } catch (err) {
    next(err);
  }
}

// PUT /api/tasks/:id — modifie une tâche (seulement les champs envoyés)
export async function updateTaskHandler(req, res, next) {
  try {
    const { id } = req.params;
    if (!isUuid(id)) return res.status(400).json({ message: 'Identifiant de tâche invalide' });

    // Accès vérifié AVANT toute modification
    const existing = await findTaskForUser(id, req.user.id);
    if (!existing) return res.status(404).json(TASK_NOT_FOUND);

    const { fields, error } = validateTaskFields(req.body ?? {}, { partial: true });
    if (error) return res.status(400).json({ message: error });
    if (Object.keys(fields).length === 0) {
      return res.status(400).json({ message: 'Aucun champ à modifier' });
    }

    if (has(fields, 'assignee_id')) {
      const assigneeError = await checkAssignee(fields.assignee_id, existing.project_id);
      if (assigneeError) return res.status(400).json({ message: assigneeError });
    }

    await updateTask(id, fields);
    const task = await findTaskForUser(id, req.user.id);
    res.json({ message: 'Tâche modifiée', task });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/tasks/:id/status — change le statut (todo → in_progress → done)
export async function updateTaskStatusHandler(req, res, next) {
  try {
    const { id } = req.params;
    if (!isUuid(id)) return res.status(400).json({ message: 'Identifiant de tâche invalide' });

    const { status } = req.body ?? {};
    if (!TASK_STATUSES.includes(status)) {
      return res.status(400).json({ message: 'Statut invalide' });
    }
    const updated = await updateTaskStatus(id, status, req.user.id);
    if (!updated) return res.status(404).json(TASK_NOT_FOUND);

    // Tâche complète (avec le nom du projet) pour que la liste reste à jour
    const task = await findTaskForUser(id, req.user.id);
    res.json({ task });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/tasks/:id — suppression logique (créateur ou propriétaire du projet)
export async function deleteTaskHandler(req, res, next) {
  try {
    const { id } = req.params;
    if (!isUuid(id)) return res.status(400).json({ message: 'Identifiant de tâche invalide' });

    const existing = await findTaskForUser(id, req.user.id);
    if (!existing) return res.status(404).json(TASK_NOT_FOUND);

    const removed = await deactivateTask(id, req.user.id);
    if (!removed) {
      return res.status(403).json({
        message: 'Seul le créateur de la tâche ou le propriétaire du projet peut la supprimer',
      });
    }
    res.sendStatus(204);
  } catch (err) {
    next(err);
  }
}
