/**
 * Putting a cropped UVTT's refusal into words.
 *
 * The server counts the walls, doors and lights that fall outside a file's map
 * image and refuses the import until the DM says to go ahead. These turn that
 * reply into the sentence the DM reads, so the counts stay accurate and the
 * zeroes stay out of it.
 */

import { describe, it, expect } from 'vitest';
import { uvttOutOfBounds, describeOutOfBounds, uvttOutOfBoundsMessage } from '../uvttImport';

/** An axios-shaped rejection carrying the server's 409 body. */
const refusal = (outOfBounds: unknown) => ({
  response: { status: 409, data: { code: 'UVTT_GEOMETRY_OUT_OF_BOUNDS', outOfBounds } },
});

describe('uvttOutOfBounds', () => {
  it('reads the counts off the refusal', () => {
    expect(uvttOutOfBounds(refusal({ walls: 79, doors: 20, lights: 0 }))).toEqual({
      walls: 79,
      doors: 20,
      lights: 0,
    });
  });

  it('treats missing and negative numbers as none', () => {
    expect(uvttOutOfBounds(refusal({ walls: 4, doors: -1 }))).toEqual({
      walls: 4,
      doors: 0,
      lights: 0,
    });
  });

  it.each([
    ['nothing at all', undefined],
    ['a plain error', new Error('boom')],
    ['a response with no body', { response: {} }],
    ['a body with no counts', { response: { data: { code: 'X' } } }],
    ['counts that are all zero', refusal({ walls: 0, doors: 0, lights: 0 })],
    ['counts that are not numbers', refusal({ walls: 'lots' })],
  ])('answers undefined for %s, so the caller can fall back', (_label, err) => {
    expect(uvttOutOfBounds(err)).toBeUndefined();
  });
});

describe('describeOutOfBounds', () => {
  it.each([
    [{ walls: 79, doors: 20, lights: 0 }, '79 walls and 20 doors'],
    [{ walls: 4, doors: 0, lights: 0 }, '4 walls'],
    [{ walls: 0, doors: 0, lights: 3 }, '3 lights'],
    [{ walls: 12, doors: 2, lights: 1 }, '12 walls, 2 doors and 1 light'],
  ])('%o reads as "%s"', (counts, expected) => {
    expect(describeOutOfBounds(counts)).toBe(expected);
  });

  it('says one wall, not 1 walls', () => {
    expect(describeOutOfBounds({ walls: 1, doors: 1, lights: 1 })).toBe('1 wall, 1 door and 1 light');
  });
});

describe('uvttOutOfBoundsMessage', () => {
  it('leads with the counts and ends with the question', () => {
    const message = uvttOutOfBoundsMessage({ walls: 79, doors: 20, lights: 0 });
    expect(message).toContain('79 walls and 20 doors');
    expect(message).toMatch(/Import anyway\?$/);
    // The DM should know the rest of the map is fine.
    expect(message).toContain('imports normally');
  });

  it('still asks when the counts did not come through', () => {
    expect(uvttOutOfBoundsMessage(undefined)).toMatch(/Import it anyway\?$/);
  });
});
