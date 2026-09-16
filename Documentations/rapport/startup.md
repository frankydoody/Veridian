# Démarrage de Veridian — Après redémarrage

## Ordre obligatoire — respecter la séquence

### Étape 1 — Permissions Docker (Ubuntu seulement)
À faire une seule fois par session si Docker refuse :
```bash
exec su -l $USER
```
*(Pas nécessaire après un vrai redémarrage complet — seulement si tu vois "permission denied")*

---

### Étape 2 — Démarrer la base de données
```bash
cd ~/dev/Veridian
docker compose up -d

# Vérifier que c'est healthy
docker compose ps
```
Attendre que `veridian_db` affiche `healthy` avant de continuer.

---

### Étape 3 — Terminal 1 — Lancer le Backend
```bash
cd ~/dev/Veridian/Projet/Backend
npm run dev
```


---

### Étape 4 — Terminal 2 — Variables de test (optionnel)
```bash
# Récupérer un token frais
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"francis@test.com","password":"123456"}' \
  | grep -o '"token":"[^"]*"' \
  | cut -d'"' -f4)

echo $TOKEN

# IDs fréquemment utilisés
PROJECT_ID="49f8f14a-c7aa-4bc0-b327-f44818676fcd"
MEETING_ID="16b165bd-bd98-43cc-898c-0f821f8bdda3"
```

---

### Étape 5 — Vérification rapide
```bash
curl http://localhost:3000/api/health
# Résultat attendu : {"status":"ok"}
```

---

### Étape 6 — Lancer les tests (optionnel)
```bash
cd ~/dev/Veridian/Projet/Backend
npm test
# 11 tests doivent passer en vert
```

---

## Commandes utiles

```bash
# Voir les logs de la BD
docker compose logs postgres

# Arrêter la BD
docker compose down

# Réinitialiser la BD (⚠️ efface tout)
docker compose down -v && docker compose up -d

# Vérifier la branche Git actuelle
git branch

# Changer de branche
git checkout branch/bloc-05-transcription
```

---

## Sur quelle branche suis-je ?

```bash
git branch
# La branche active est marquée d'un *
```
