---
name: qa-gitlab-to-testmo
description: Sync GitLab → Testmo (création/mise à jour des cas de test neo-pilot)
schedule: Jours ouvrés 10:00 ET 13:30 (Europe/Paris)
type: À distance (serveurs Anthropic)
---

# Routine B — Sync GitLab → Testmo (création cas de test)

> **Usage** : copier le prompt ci-dessous dans une nouvelle routine "À distance" dans l'app Claude Desktop.
> Remplacer les 2 valeurs `[...]` par celles du fichier `backend/.env` avant de sauvegarder.
> Créer 2 routines avec ce même prompt : une à 10h00, une à 13h30.

---

## PROMPT À COPIER-COLLER

```
Tu es un agent QA automatique. Synchronise les issues GitLab vers Testmo en créant ou mettant à jour les cas de test pour le projet neo-pilot.

## CREDENTIALS
TESTMO_URL = "https://neo-logix.testmo.net"
TESTMO_TOKEN = "[VALEUR DE TESTMO_TOKEN DANS backend/.env]"
GITLAB_URL = "https://gitlab.neo-logix.fr"
GITLAB_TOKEN = "[VALEUR DE GITLAB_TOKEN DANS backend/.env]"

## CONFIGURATION PROJET neo-pilot
- GitLab projectId     = 63
- Testmo projectId     = 1
- Testmo repoId        = 1
- Testmo rootFolderId  = 4514
- Label GitLab source  = "Test::TODO"

## MISSION

Écris un script Node.js dans /tmp/qa-gitlab-to-testmo.js (module https natif uniquement, pas de npm) puis exécute-le avec `node /tmp/qa-gitlab-to-testmo.js`.

### Étape 1 — Itération GitLab active
GET https://gitlab.neo-logix.fr/api/v4/projects/63/iterations?state=current&per_page=10
Header: PRIVATE-TOKEN: {GITLAB_TOKEN}
→ Prendre l'itération state="current" la plus récente.
→ Fallback : si aucune "current", prendre la plus récente toutes states confondues.
→ Extraire : id (iterationId) et title (iterationName, ex: "R10 - run 1")

### Étape 2 — Issues GitLab (label Test::TODO dans l'itération)
GET https://gitlab.neo-logix.fr/api/v4/projects/63/issues?iteration_id={iterationId}&labels=Test%3A%3ATODO&state=opened&scope=all&per_page=100
→ Gérer la pagination via header Link: rel="next".
→ Pour chaque issue : iid, id, title, description, web_url, time_estimate.

### Étape 3 — Notes (étapes de test) de chaque issue
GET https://gitlab.neo-logix.fr/api/v4/projects/63/issues/{iid}/notes?sort=asc&order_by=created_at
→ Filtrer : garder uniquement les notes où system === false.
→ Les notes non-système décrivent les étapes de test.

### Étape 4 — Cas existants dans Testmo
GET https://neo-logix.testmo.net/api/v1/projects/1/cases?page=N
Header: Authorization: Bearer {TESTMO_TOKEN}
→ Paginer jusqu'à épuisement.
→ Construire un index : name → caseId.
→ Match : case.name === issue.title (comparaison exacte).

### Étape 5a — Créer un nouveau cas (si absent)
POST https://neo-logix.testmo.net/api/v1/projects/1/cases
Header: Authorization: Bearer {TESTMO_TOKEN}, Content-Type: application/json
Body: {
  "folder_id": 4514,
  "name": "{issue.title}",
  "steps": [
    { "step": "{contenu de chaque note}", "result": "" }
  ]
}
→ 1 note non-système = 1 step.
→ Si aucune note : créer le cas sans steps.

### Étape 5b — Mettre à jour un cas existant (si présent)
PUT https://neo-logix.testmo.net/api/v1/projects/1/cases/{caseId}
→ Même body que la création.
→ Mettre à jour uniquement si les steps ont changé.

### Étape 6 — Rapport
✅ Itération traitée : "R10 - run 1" (iterationId=X)
✅ Issues trouvées avec Test::TODO : N
✅ Cas créés : X | mis à jour : Y | inchangés : Z | erreurs : W
Si erreurs > 0 : lister les issues concernées avec le message d'erreur.
```
