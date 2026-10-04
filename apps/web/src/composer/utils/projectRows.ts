/**
 * How a row in the stored-projects list describes itself.
 *
 * In its own module because it is **not** a component: exporting it from
 * `WelcomeModal.tsx` broke React Fast Refresh, and it is pure logic that deserves a
 * test without a DOM.
 *
 * Relative rather than absolute on purpose. "3 d ago" answers the question the row
 * actually raises — *is this recent enough to continue?* — and a date would answer a
 * different one. The break at 30 days is where "ago" stops being useful.
 */
export const describeProjectRow = (project: { name: string; updatedAt: number }): string => {
  const elapsed = Date.now() - project.updatedAt;
  const minutos = Math.round(elapsed / 60000);

  if (minutos < 1) return 'just now';
  if (minutos < 60) return `${minutos} min ago`;

  const horas = Math.round(minutos / 60);
  if (horas < 24) return `${horas} h ago`;

  const dias = Math.round(horas / 24);
  if (dias < 30) return `${dias} d ago`;

  return new Date(project.updatedAt).toLocaleDateString();
};
