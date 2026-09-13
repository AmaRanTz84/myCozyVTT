// ============================================
// Importing a Universal VTT file
//
// A UVTT holds one map image and the geometry that belongs with it. Some
// exporters crop the image to part of the map and then write out the walls for
// the whole of it, so the import would land a map with bare areas and walls
// standing in them. Those walls cannot even block sight, because the visibility
// pass stops at the map's own edges.
//
// The server refuses such a file with 409 and `UVTT_GEOMETRY_OUT_OF_BOUNDS`
// until the DM says to go ahead. What follows reads those counts off the
// refusal and puts them into words.
// ============================================

/** How much of a file's geometry falls outside its map image. */
export interface UvttOutOfBounds {
  walls: number;
  doors: number;
  lights: number;
}

function count(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0;
}

/**
 * The counts carried by a `UVTT_GEOMETRY_OUT_OF_BOUNDS` refusal.
 *
 * Returns undefined when the body does not carry them, so a caller can fall
 * back to showing the plain message instead of a dialog full of zeroes.
 */
export function uvttOutOfBounds(err: unknown): UvttOutOfBounds | undefined {
  if (!err || typeof err !== 'object') return undefined;
  const response = (err as { response?: unknown }).response;
  if (!response || typeof response !== 'object') return undefined;
  const data = (response as { data?: unknown }).data;
  if (!data || typeof data !== 'object') return undefined;
  const raw = (data as { outOfBounds?: unknown }).outOfBounds;
  if (!raw || typeof raw !== 'object') return undefined;

  const record = raw as Record<string, unknown>;
  const result = {
    walls: count(record.walls),
    doors: count(record.doors),
    lights: count(record.lights),
  };
  return result.walls + result.doors + result.lights > 0 ? result : undefined;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** "79 walls and 20 doors", skipping whatever is zero. */
export function describeOutOfBounds(counts: UvttOutOfBounds): string {
  const parts: string[] = [];
  if (counts.walls > 0) parts.push(plural(counts.walls, 'wall', 'walls'));
  if (counts.doors > 0) parts.push(plural(counts.doors, 'door', 'doors'));
  if (counts.lights > 0) parts.push(plural(counts.lights, 'light', 'lights'));
  if (parts.length === 0) return 'Some walls';
  if (parts.length === 1) return parts[0];
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}

/** What the DM is asked before a cropped file is imported. */
export function uvttOutOfBoundsMessage(counts?: UvttOutOfBounds): string {
  if (!counts) {
    return 'Some of this file\'s walls sit outside its map picture. Import it anyway?';
  }
  return (
    `${describeOutOfBounds(counts)} in this file sit outside its map picture. ` +
    'That usually means the tool that exported it cropped the picture but kept ' +
    'the walls for the whole map, so those walls arrive with nothing underneath ' +
    'them and cannot block sight. Everything inside the picture imports normally. ' +
    'Import anyway?'
  );
}
