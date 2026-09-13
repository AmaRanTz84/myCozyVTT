/**
 * Importing a UVTT whose picture does not cover its walls.
 *
 * A UVTT holds one map image and the geometry that goes with it. Some exporters
 * crop the image to part of the map and then write out the walls for the whole
 * of it, so the import lands a map with bare areas and walls floating in them.
 * Those walls cannot even block sight: the visibility pass stops at the map's
 * own edges.
 *
 * Rather than quietly producing that, the route asks first. Declining must
 * leave nothing behind, and confirming must import every segment, including the
 * ones outside, since it is the picture that is incomplete, not the walls.
 *
 * Requires PostgreSQL at DATABASE_URL.
 */

import request from 'supertest';
import { createTestApp } from '../../__tests__/helpers/test-app';
import {
  prisma,
  createTestUser,
  createTestCampaign,
  cleanupUsers,
  cleanupCampaigns,
  TEST_PASSWORD,
} from '../../__tests__/helpers/db';

const app = createTestApp();

/** A 1x1 PNG, enough for the importer to decode and store. */
const PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

type Point = { x: number; y: number };

/** A square of wall one grid square on a side, starting at (ox, oy). */
const square = (ox: number, oy: number): Point[] => [
  { x: ox, y: oy },
  { x: ox + 1, y: oy },
  { x: ox + 1, y: oy + 1 },
  { x: ox, y: oy + 1 },
  { x: ox, y: oy },
];

function uvttFile(lineOfSight: Point[][]): Buffer {
  return Buffer.from(
    JSON.stringify({
      format: 0.3,
      resolution: {
        map_origin: { x: 0, y: 0 },
        map_size: { x: 10, y: 10 },
        pixels_per_grid: 140,
      },
      line_of_sight: lineOfSight,
      portals: [],
      lights: [],
      environment: { baked_lighting: false, ambient_light: '00000000' },
      image: PNG_BASE64,
    })
  );
}

/** Entirely inside the picture. */
const TIDY = uvttFile([square(2, 2)]);
/** One square inside, one well off to the right of the picture. */
const CROPPED = uvttFile([square(2, 2), square(20, 2)]);

let dmId: string;
let campaignId: string;
let dm: ReturnType<typeof request.agent>;

const importUvtt = (file: Buffer, name: string, confirm?: boolean) => {
  const req = dm
    .post(`/api/campaigns/${campaignId}/maps/import-uvtt`)
    .attach('file', file, `${name}.uvtt`)
    .field('name', name);
  return confirm === undefined ? req : req.field('confirm', String(confirm));
};

const mapCount = () => prisma.map.count({ where: { campaignId } });

beforeAll(async () => {
  const stamp = Date.now();
  const user = await createTestUser({
    email: `uvtt-dm-${stamp}@test.cozyvtt.local`,
    displayName: 'UVTT DM',
  });
  dmId = user.id;
  campaignId = (await createTestCampaign(dmId, { name: `UVTT ${stamp}` })).id;
  await prisma.campaignMembership.create({
    data: { userId: dmId, campaignId, role: 'DM', characterIds: [] },
  });
  dm = request.agent(app);
  const login = await dm.post('/api/auth/login').send({ email: user.email, password: TEST_PASSWORD });
  expect(login.status).toBe(200);
});

afterAll(async () => {
  await prisma.asset.deleteMany({ where: { uploadedById: dmId } });
  await cleanupCampaigns([campaignId]);
  await cleanupUsers([dmId]);
  await prisma.$disconnect();
});

beforeEach(() => prisma.map.deleteMany({ where: { campaignId } }));

describe('a UVTT whose picture covers all its walls', () => {
  it('imports without asking', async () => {
    const res = await importUvtt(TIDY, 'tidy');
    expect(res.status).toBe(201);
    expect(res.body.totalSegments).toBe(4);
  });
});

describe('a UVTT with walls outside its picture', () => {
  it('asks first, and creates nothing', async () => {
    const res = await importUvtt(CROPPED, 'cropped');
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('UVTT_GEOMETRY_OUT_OF_BOUNDS');
    expect(res.body.outOfBounds).toEqual({ walls: 4, doors: 0, lights: 0 });
    expect(await mapCount()).toBe(0);
  });

  it('leaves no asset or file behind when it asks', async () => {
    const before = await prisma.asset.count({ where: { campaignId } });
    await importUvtt(CROPPED, 'cropped');
    expect(await prisma.asset.count({ where: { campaignId } })).toBe(before);
  });

  it('imports on confirmation, keeping the walls outside too', async () => {
    const res = await importUvtt(CROPPED, 'cropped', true);
    expect(res.status).toBe(201);
    // Both squares: nothing is discarded, the picture is what is incomplete.
    expect(res.body.totalSegments).toBe(8);
    expect(await mapCount()).toBe(1);
  });

  it('still asks when confirm says anything but true', async () => {
    const res = await importUvtt(CROPPED, 'cropped', false);
    expect(res.status).toBe(409);
    expect(await mapCount()).toBe(0);
  });

  it('does not ask about a tidy file even when confirmation is offered', async () => {
    expect((await importUvtt(TIDY, 'tidy', true)).status).toBe(201);
  });
});

describe('who may import', () => {
  it('refuses someone who is not the DM of this campaign', async () => {
    const stranger = await createTestUser({
      email: `uvtt-stranger-${Date.now()}@test.cozyvtt.local`,
      displayName: 'UVTT Stranger',
    });
    const agent = request.agent(app);
    await agent.post('/api/auth/login').send({ email: stranger.email, password: TEST_PASSWORD });

    const res = await agent
      .post(`/api/campaigns/${campaignId}/maps/import-uvtt`)
      .attach('file', CROPPED, 'cropped.uvtt');
    expect([403, 404]).toContain(res.status);
    expect(await mapCount()).toBe(0);

    await cleanupUsers([stranger.id]);
  });
});
