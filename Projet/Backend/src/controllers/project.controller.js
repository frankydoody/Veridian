import {
  createProjectWithOwner,
  findProjectsByUser,
  findProjectById,
  updateProject,
  updateProjectStatus,
} from '../models/project.model.js';

export const createProjectHandler = async (req, res, next) => {
  try {
    const { name, description } = req.body;

    if (!name) {
      return res.status(400).json({
        message: 'Le nom du projet est obligatoire'
      });
    }

    const project = await createProjectWithOwner(
      name,
      description,
      req.user.id
    );

    return res.status(201).json({
      message: 'Projet créé avec succès',
      project
    });

  } catch (error) {
    next(error);
  }
};

export const getProjectsHandler = async (req, res, next) => {
  try {
    const projects = await findProjectsByUser(req.user.id);

    return res.status(200).json({
      message: 'Projets récupérés avec succès',
      count: projects.length,
      projects
    });

  } catch (error) {
    next(error);
  }
};

export const getProjectByIdHandler = async (req, res, next) => {
  try {
    const { id } = req.params;

    const project = await findProjectById(id, req.user.id);

    if (!project) {
      return res.status(404).json({
        message: 'Projet introuvable ou accès non autorisé'
      });
    }

    return res.status(200).json({
      message: 'Projet récupéré avec succès',
      project
    });

  } catch (error) {
    next(error);
  }
};

export const updateProjectHandler = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;

    if (!name) {
      return res.status(400).json({
        message: 'Le nom du projet est obligatoire'
      });
    }

    const project = await findProjectById(id, req.user.id);

    if (!project) {
      return res.status(404).json({
        message: 'Projet introuvable ou accès non autorisé'
      });
    }

    if (project.owner_id !== req.user.id) {
      return res.status(403).json({
        message: 'Seul le propriétaire peut modifier ce projet'
      });
    }

    const updatedProject = await updateProject(id, name, description);

    return res.status(200).json({
      message: 'Projet mis à jour avec succès',
      project: updatedProject
    });

  } catch (error) {
    next(error);
  }
};

export const updateProjectStatusHandler = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['active', 'archived', 'inactive'];

    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        message: `Statut invalide. Valeurs acceptées : ${validStatuses.join(', ')}`
      });
    }

    const project = await findProjectById(id, req.user.id);

    if (!project) {
      return res.status(404).json({
        message: 'Projet introuvable ou accès non autorisé'
      });
    }

    if (project.owner_id !== req.user.id) {
      return res.status(403).json({
        message: 'Seul le propriétaire peut modifier le statut'
      });
    }

    const updatedProject = await updateProjectStatus(id, status);

    return res.status(200).json({
      message: 'Statut mis à jour avec succès',
      project: updatedProject
    });

  } catch (error) {
    next(error);
  }
};

