/**
 * Turning stored slugs into something a person reads.
 *
 * The catalog stores machine-friendly values — lowercase, kebab-case,
 * pipe-separated — because that is what filters and the achievement engine
 * need. None of it should ever reach the screen in that form.
 *
 * Everything display-facing goes through here, so a fix lands once rather
 * than in each screen that happens to render the field.
 */

/** Words that title-case would get wrong. */
const OVERRIDES: Record<string, string> = {
  // Places with punctuation or house style the slug cannot carry
  'galaxys-edge': "Galaxy's Edge",
  'american-adventure': 'The American Adventure',
  'main-street': 'Main Street, U.S.A.',
  'hollywood-blvd': 'Hollywood Blvd',
  'sunset-blvd': 'Sunset Blvd',
  'rafiki-planet-watch': "Rafiki's Planet Watch",
  dinoland: 'DinoLand U.S.A.',
  epcot: 'EPCOT',

  // Cuisines where title case produces the wrong thing
  bbq: 'BBQ',
  'bbq-american': 'BBQ, American',
};

/** Lowercase words that stay lowercase inside a longer name. */
const MINOR = new Set(['of', 'the', 'and', 'at', 'in', 'on', 'a']);

/** `american-adventure` -> `American Adventure`, respecting minor words. */
export function titleCase(slug: string): string {
  if (!slug) return '';
  const key = slug.toLowerCase();
  if (OVERRIDES[key]) return OVERRIDES[key];

  return key
    .split(/[-_\s]+/)
    .map((word, i) =>
      i > 0 && MINOR.has(word) ? word : word.charAt(0).toUpperCase() + word.slice(1),
    )
    .join(' ');
}

/**
 * A pipe-separated stored value as a readable list.
 *
 * `american|seafood` -> `American, Seafood`. Commas read far better than
 * pipes, which are a storage detail that leaked into the UI.
 */
export function formatList(value: string | null | undefined, separator = ', '): string {
  if (!value) return '';
  return value
    .split('|')
    .map((part) => titleCase(part.trim()))
    .filter(Boolean)
    .join(separator);
}

/** Same, for values already split into an array by the database driver. */
export function formatArray(
  values: readonly string[] | null | undefined,
  separator = ', ',
): string {
  if (!values?.length) return '';
  return values.map((v) => titleCase(v)).filter(Boolean).join(separator);
}

export const formatSubArea = titleCase;
export const formatCuisine = (v: string | null | undefined) => formatList(v);
