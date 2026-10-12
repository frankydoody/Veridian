// src/controllers/task.controller.js

import {
  findAllTasks,
  createTask,
  updateTaskStatus,
  deleteTask,
} from '../models/task.model.js';

// GET /api/tasks — liste toutes les tâches de l'utilisateur connecté
export async function getAllTasksHandler(req, res, next) {
  try {
    const tasks = await findAllTasks(req.user.id);
    res.json({ tasks });
  } catch (err) {
    next(err);
  }
}

// POST /api/tasks — crée une tâche
export async function createTaskHandler(req, res, next) {
  try {
    const task = await createTask({ ...req.body, user_id: req.user.id });
    res.status(201).json({ task });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/tasks/:id/status — change le statut (todo → in_progress → done)
export async function updateTaskStatusHandler(req, res, next) {
  try {
    const { status } = req.body;
    if (!['todo', 'in_progress', 'done'].includes(status)) {
      return res.status(400).json({ message: 'Statut invalide' });
    }
    const task = await updateTaskStatus(req.params.id, status, req.user.id);
    if (!task) return res.status(404).json({ message: 'Tâche introuvable' });
    res.json({ task });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/tasks/:id
export async function deleteTaskHandler(req, res, next) {
  try {
    await deleteTask(req.params.id, req.user.id);
    res.sendStatus(204);
  } catch (err) {
    next(err);
  }
}
