# Veridian

> Application web de mémoire organisationnelle pour réunions d'équipe — propulsée par l'IA.

Projet de fin d'études — Génie logiciel · Université

---

## Table des matières

- [Description](#description)
- [Technologies](#technologies)
- [Prérequis](#prérequis)
- [Installation](#installation)
- [Configuration](#configuration)
- [Démarrage](#démarrage)
- [Structure du projet](#structure-du-projet)
- [Documentation](#documentation)

---

## Description

Veridian est une application web qui permet aux équipes en entreprise d'enregistrer leurs réunions, d'en extraire automatiquement les décisions clés via l'IA, et de maintenir une mémoire organisationnelle consultable. Le système détecte les contradictions entre décisions passées et nouvelles, et offre un chat en langage naturel pour interroger l'historique du projet.

## Technologies

| Couche | Technologie |
|---|---|
| Backend | Node.js 20+, Express 4 |
| Frontend | React 18, Vite |
| Base de données | PostgreSQL 16 + pgvector |
| Transcription | OpenAI Whisper API |
| IA / NLP | Anthropic Claude API |
| Conteneurisation | Docker, Docker Compose |

## Prérequis

- Node.js >= 20.x
- Docker Desktop (Windows/macOS) ou Docker Engine (Ubuntu)
- Git
- Clés API : OpenAI, Anthropic

## Installation

```bash
# 1. Cloner le repo
git clone https://github.com/frankydoody/Veridian.git
cd Veridian

# 2. Démarrer la base de données
docker compose up -d

# 3. Installer les dépendances backend
cd backend && npm install

# 4. Configurer les variables d'environnement
cp .env.example .env
# Éditer .env avec vos clés API

# 5. Installer les dépendances frontend
cd ../frontend && npm install

# 6. Configurer le frontend
cp .env.example .env
```

## Démarrage

```bash
# Terminal 1 — Backend
cd backend && npm run dev

# Terminal 2 — Frontend
cd frontend && npm run dev
```

- API : http://localhost:3000
- Frontend : http://localhost:5173
- Health check : http://localhost:3000/api/health

## Structure du projet

```
Veridian/
├── backend/          # API Node.js/Express
├── frontend/         # Interface React/Vite
├── docs/             # Documentation & diagrammes UML
└── docker-compose.yml
```

## Documentation

Les diagrammes UML et le rapport d'analyse sont disponibles dans le dossier [`docs/`](./docs/).
