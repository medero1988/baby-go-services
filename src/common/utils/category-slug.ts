/**
 * Normaliza una categoría a kebab-case en minúsculas, el formato canónico
 * compartido con el front y el taxonomy (`BabyCarrier`, `baby_carrier` → `baby-carrier`).
 */
export function toCategorySlug(value: string): string {
  return value
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[\s_-]+/g, '-')
    .toLowerCase();
}
