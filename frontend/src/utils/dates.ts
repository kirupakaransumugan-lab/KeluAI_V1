/** Whole days left until `iso`, never negative; null when there is no trial.
 *  The API sends naive UTC timestamps, so a missing zone is read as UTC. */
export function daysLeft(iso: string | null): number | null {
  if (!iso) return null;
  const end = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(iso) ? iso : iso + "Z");
  return Math.max(0, Math.ceil((end.getTime() - Date.now()) / 86_400_000));
}

/** Fills "{name}"-style placeholders in a copy string. */
export const fill = (template: string, values: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/g, (_, k: string) => String(values[k] ?? ""));
