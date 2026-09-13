/**
 * Reading a UVTT file, and noticing when its picture does not cover its walls.
 *
 * A UVTT holds one map image and the geometry that goes with it. Some exporters
 * crop the image to part of the map and then write out the walls for all of it,
 * which imports as a map with bare areas the DM cannot explain. The parser
 * counts that geometry so the import can ask before going ahead.
 *
 * A wall counts as outside only when **both** ends are. Walls that sit on the
 * map's edge are ordinary, and one endpoint a hair over the line must not set
 * the whole thing off.
 */

import { parseUVTT } from './uvttParser';

/** A 1x1 PNG, enough for the parser to decode and sniff. */
const PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

type Point = { x: number; y: number };

function uvtt(overrides: {
  mapSize?: Point;
  lineOfSight?: Point[][];
  portals?: { bounds: Point[]; closed?: boolean }[];
  lights?: { position: Point; range: number; color?: string }[];
}): Buffer {
  return Buffer.from(
    JSON.stringify({
      format: 0.3,
      resolution: {
        map_origin: { x: 0, y: 0 },
        map_size: overrides.mapSize ?? { x: 10, y: 10 },
        pixels_per_grid: 140,
      },
      line_of_sight: overrides.lineOfSight ?? [],
      portals: overrides.portals ?? [],
      lights: overrides.lights ?? [],
      environment: { baked_lighting: false, ambient_light: '00000000' },
      image: PNG_BASE64,
    })
  );
}

/** A square of wall starting at (ox, oy), one grid square on a side. */
const square = (ox: number, oy: number): Point[] => [
  { x: ox, y: oy },
  { x: ox + 1, y: oy },
  { x: ox + 1, y: oy + 1 },
  { x: ox, y: oy + 1 },
  { x: ox, y: oy },
];

describe('parseUVTT', () => {
  describe('geometry the map image covers', () => {
    it('reports nothing out of bounds for a map that fits', () => {
      const result = parseUVTT(uvtt({ lineOfSight: [square(2, 2)] }));
      expect(result.outOfBounds).toEqual({ walls: 0, doors: 0, lights: 0 });
    });

    it('leaves a wall running along the map edge alone', () => {
      const edge: Point[] = [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
      ];
      expect(parseUVTT(uvtt({ lineOfSight: [edge] })).outOfBounds.walls).toBe(0);
    });

    it('leaves a wall with one end just over the line alone', () => {
      // Half outside is how a building meets the edge of its own picture.
      const straddling: Point[] = [
        { x: 9, y: 5 },
        { x: 11, y: 5 },
      ];
      expect(parseUVTT(uvtt({ lineOfSight: [straddling] })).outOfBounds.walls).toBe(0);
    });
  });

  describe('geometry the map image does not cover', () => {
    it('counts a wall whose both ends are past the right edge', () => {
      const result = parseUVTT(uvtt({ lineOfSight: [square(20, 2)] }));
      // A closed square is four segments.
      expect(result.outOfBounds.walls).toBe(4);
      expect(result.wallCount).toBe(4);
    });

    it('counts a wall at negative coordinates, which is how a crop reads', () => {
      expect(parseUVTT(uvtt({ lineOfSight: [square(-5, 2)] })).outOfBounds.walls).toBe(4);
    });

    it('counts doors and lights separately from walls', () => {
      const result = parseUVTT(
        uvtt({
          lineOfSight: [square(20, 2)],
          portals: [{ bounds: [{ x: 21, y: 3 }, { x: 21, y: 4 }] }],
          lights: [{ position: { x: 22, y: 3 }, range: 4 }],
        })
      );
      expect(result.outOfBounds).toEqual({ walls: 4, doors: 1, lights: 1 });
    });

    it('counts only what is outside when a file holds both', () => {
      const result = parseUVTT(uvtt({ lineOfSight: [square(2, 2), square(20, 2)] }));
      expect(result.wallCount).toBe(8);
      expect(result.outOfBounds.walls).toBe(4);
    });

    it('still returns every segment, because nothing is discarded', () => {
      const result = parseUVTT(uvtt({ lineOfSight: [square(2, 2), square(20, 2)] }));
      expect(result.wallSegments).toHaveLength(8);
    });
  });

  describe('the shape of what it returns', () => {
    it('converts grid units to pixels with the given grid size', () => {
      const result = parseUVTT(uvtt({ lineOfSight: [[{ x: 1, y: 2 }, { x: 3, y: 4 }]] }), 70);
      expect(result.wallSegments[0]).toMatchObject({ x1: 70, y1: 140, x2: 210, y2: 280 });
    });

    it('reads the map size and the source resolution', () => {
      const result = parseUVTT(uvtt({ mapSize: { x: 24, y: 33 } }));
      expect(result.mapWidth).toBe(24);
      expect(result.mapHeight).toBe(33);
      expect(result.sourcePixelsPerGrid).toBe(140);
    });
  });

  describe('files it refuses', () => {
    it.each([
      ['not JSON at all', Buffer.from('this is not json')],
      ['no resolution', Buffer.from(JSON.stringify({ image: PNG_BASE64 }))],
      ['no image', Buffer.from(JSON.stringify({ resolution: { map_size: { x: 1, y: 1 } }, line_of_sight: [] }))],
    ])('%s', (_label, buffer) => {
      expect(() => parseUVTT(buffer)).toThrow(/Invalid UVTT file/);
    });
  });
});
