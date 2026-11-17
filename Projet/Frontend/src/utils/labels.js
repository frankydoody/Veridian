// src/utils/labels.js
// Libellés et couleurs partagés par toutes les pages.
// Les clés correspondent EXACTEMENT aux valeurs permises par la base (contraintes CHECK de schema.sql
// et des migrations) : une seule source de vérité au lieu d'une liste par page.

// meetings.status
export const MEETING_STATUS = {
  planned:    { label: 'Planifiée',      color: '#4D96FF' },
  active:     { label: 'En cours',       color: 'var(--color-ai)' },
  processing: { label: 'En traitement',  color: 'var(--color-amber)' },
  done:       { label: 'Terminée',       color: 'var(--color-success)' },
  cancelled:  { label: 'Annulée',        color: 'var(--color-text-faint)' },
}

// meetings.analysis_status (migration 010)
export const ANALYSIS_STATUS = {
  none:       { label: 'Non analysée',   color: 'var(--color-text-faint)' },
  processing: { label: 'Analyse en cours', color: 'var(--color-amber)' },
  done:       { label: 'Analysée',       color: 'var(--color-success)' },
  error:      { label: 'Échec de l\'analyse', color: 'var(--color-danger)' },
}

// tasks.status
export const TASK_STATUS = {
  todo:        { label: 'À faire',  color: 'var(--color-text-muted)' },
  in_progress: { label: 'En cours', color: 'var(--color-ai)' },
  done:        { label: 'Terminée', color: 'var(--color-success)' },
}

// tasks.priority
export const PRIORITY = {
  haute:   { label: 'Haute',   color: '#FF6B6B', bg: 'rgba(255,107,107,0.12)' },
  moyenne: { label: 'Moyenne', color: '#FFD93D', bg: 'rgba(255,217,61,0.12)' },
  basse:   { label: 'Basse',   color: '#6BCB77', bg: 'rgba(107,203,119,0.12)' },
}

// Gravité des alertes et des risques
export const SEVERITY = {
  high:   { label: 'Élevée',  color: '#F87171' },
  medium: { label: 'Moyenne', color: 'var(--color-amber)' },
  low:    { label: 'Faible',  color: 'var(--color-text-muted)' },
}

// Renvoie l'entrée d'une table, ou une entrée neutre si la valeur est inconnue
export function labelOf(table, key) {
  return table[key] ?? { label: key ?? '—', color: 'var(--color-text-muted)' }
}
