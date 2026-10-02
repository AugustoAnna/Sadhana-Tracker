import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { sendDueReminders, type PushFn, type ReminderRow } from './send';

// A stand-in for the Supabase client: records each query with its filters and
// answers it from `world`, the state of the database for the test.
type Call = { table: string; op: 'select' | 'insert' | 'update' | 'delete'; values?: Record<string, unknown>; filters: unknown[][] };

type World = {
  claimError?: { code: string };
  sentAt?: string;
  practices?: number;
  loggedYesterday?: number;
  loggedThatWeek?: number;
  eligibilityError?: boolean;
  stampError?: { message: string };
};

function fakeSupabase(world: World) {
  const calls: Call[] = [];
  let sends = 0;
  const answer = (c: Call) => {
    switch (c.table) {
      case 'reminder_sends':
        if (c.op !== 'insert') return { error: null };
        return world.claimError ? { data: null, error: world.claimError } : { data: { id: `send-${++sends}` }, error: null };
      case 'participants':
        if (c.op === 'update') return { error: world.stampError ?? null };
        return world.eligibilityError
          ? { data: null, error: { message: 'timeout' } }
          : { data: { backtrack_push_sent_at: world.sentAt ?? null }, error: null };
      case 'participant_practices':
        return { count: world.practices ?? 1, error: null };
      case 'practice_completed':
        return c.filters.some((f) => f[0] === 'eq' && f[1] === 'local_date')
          ? { count: world.loggedYesterday ?? 0, error: null }
          : { count: world.loggedThatWeek ?? 1, error: null };
      default:
        return { error: null };
    }
  };
  const query = (call: Call) => {
    calls.push(call);
    const filter = (name: string) => (...args: unknown[]) => { call.filters.push([name, ...args]); return q; };
    const q = {
      select: () => q,
      single: () => q,
      eq: filter('eq'),
      gte: filter('gte'),
      lte: filter('lte'),
      is: filter('is'),
      then: (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
        Promise.resolve(answer(call)).then(resolve, reject),
    };
    return q;
  };
  const client = {
    from: (table: string) => ({
      insert: (values: Record<string, unknown>) => query({ table, op: 'insert', values, filters: [] }),
      update: (values: Record<string, unknown>) => query({ table, op: 'update', values, filters: [] }),
      delete: () => query({ table, op: 'delete', filters: [] }),
      select: () => query({ table, op: 'select', filters: [] }),
    }),
  };
  return { client, calls };
}

// 06:02 on 1 Oct for a participant on UTC: a 06:00 reminder is due.
const NOW = new Date('2026-10-01T06:02:00Z');

function device(id: string) {
  return { id, endpoint: `https://push.example/${id}`, p256dh: 'p256dh', auth: 'auth', environment: 'study' };
}

function participant(devices = [device('phone')], timezone = 'UTC') {
  return { id: 'p1', timezone, push_subscriptions: devices };
}

function reminder(id: string, time_local: string, p = participant(), overrides: Partial<ReminderRow> = {}): ReminderRow {
  return { id, kind: 'generic', slot: 1, practice_id: null, time_local, environment: 'study', participants: p, ...overrides };
}

async function run(
  reminders: ReminderRow[],
  world: World = {},
  opts: { backtrackEnabled?: boolean; push?: PushFn; now?: Date } = {},
) {
  const db = fakeSupabase(world);
  const push = vi.fn<PushFn>(opts.push ?? (async () => ({ statusCode: 201 })));
  const counts = await sendDueReminders(db.client as never, reminders, {
    now: opts.now ?? NOW,
    backtrackEnabled: opts.backtrackEnabled ?? true,
    push,
  });
  const where = (table: string, op: Call['op']) => db.calls.filter((c) => c.table === table && c.op === op);
  return { counts, push, payloads: push.mock.calls.map((c) => JSON.parse(c[1])), where };
}

let consoleError: ReturnType<typeof vi.spyOn>;
beforeEach(() => { consoleError = vi.spyOn(console, 'error').mockImplementation(() => {}); });
afterEach(() => consoleError.mockRestore());

describe('send-reminders: the backtracking push', () => {
  it('replaces the first morning reminder and stamps the participant once sent', async () => {
    const { counts, payloads, where } = await run([reminder('morning', '06:00:00')]);

    expect(payloads).toEqual([expect.objectContaining({
      title: 'Yesterday can still count',
      kind: 'backtrack',
      slot: 1,
      send_id: 'send-1',
      url: '/practice-home?day=yesterday&via=push&for=2026-09-30',
    })]);
    expect(counts).toMatchObject({ sent: 1, backtrack: 1 });
    expect(where('reminder_sends', 'update')[0].values).toMatchObject({ status: 'sent', kind: 'backtrack' });
    const stamps = where('participants', 'update');
    expect(stamps).toHaveLength(1);
    expect(stamps[0].filters).toEqual([['eq', 'id', 'p1'], ['is', 'backtrack_push_sent_at', null]]);
  });

  it('looks for a log yesterday and one in the six days before', async () => {
    const { where } = await run([reminder('morning', '06:00:00')]);

    const [yesterday, week] = where('practice_completed', 'select').map((c) => c.filters);
    expect(yesterday).toContainEqual(['eq', 'local_date', '2026-09-30']);
    expect(week).toEqual(expect.arrayContaining([['gte', 'local_date', '2026-09-24'], ['lte', 'local_date', '2026-09-29']]));
  });

  it("dates it by the participant's own day", async () => {
    // 06:02 on 1 Oct in Tokyo is still 30 Sep in UTC.
    const tokyo = participant([device('phone')], 'Asia/Tokyo');
    const { payloads } = await run([reminder('morning', '06:00:00', tokyo)], {}, { now: new Date('2026-09-30T21:02:00Z') });

    expect(payloads[0].url).toBe('/practice-home?day=yesterday&via=push&for=2026-09-30');
  });

  it.each<[string, World]>([
    ['it was sent before', { sentAt: '2026-09-20T06:00:00Z' }],
    ['the list is empty', { practices: 0 }],
    ['yesterday is logged', { loggedYesterday: 2 }],
    ['nothing was logged in the week before', { loggedThatWeek: 0 }],
    ['the eligibility check fails', { eligibilityError: true }],
  ])('sends the normal reminder when %s', async (_, world) => {
    const { counts, payloads, where } = await run([reminder('morning', '06:00:00')], world);

    expect(payloads[0]).toMatchObject({ title: 'Time to practice', kind: 'generic' });
    expect(counts).toMatchObject({ sent: 1, backtrack: 0 });
    expect(where('reminder_sends', 'update')[0].values).not.toHaveProperty('kind');
    expect(where('participants', 'update')).toHaveLength(0);
  });

  it('never asks the database with the flag off', async () => {
    const { payloads, where } = await run([reminder('morning', '06:00:00')], {}, { backtrackEnabled: false });

    expect(payloads[0]).toMatchObject({ kind: 'generic' });
    expect(where('participants', 'select')).toHaveLength(0);
  });

  it('leaves a later morning reminder alone', async () => {
    const p = participant();
    // 05:00 is not due at 06:02, but it is the first morning reminder.
    const { payloads, where } = await run([reminder('early', '05:00:00', p), reminder('morning', '06:00:00', p)]);

    expect(payloads).toEqual([expect.objectContaining({ kind: 'generic' })]);
    expect(where('participants', 'select')).toHaveLength(0);
  });

  it('reaches every device of the participant from one eligibility check', async () => {
    const p = participant([device('phone'), device('tablet')]);
    const { counts, payloads, where } = await run([reminder('morning', '06:00:00', p)]);

    expect(payloads.map((m) => m.kind)).toEqual(['backtrack', 'backtrack']);
    expect(counts).toMatchObject({ sent: 2, backtrack: 2 });
    expect(where('participants', 'select')).toHaveLength(1);
    // The second stamp matches no row: the first one already set it.
    expect(where('participants', 'update').every((c) => c.filters.some((f) => f[0] === 'is'))).toBe(true);
  });

  it('checks nothing when another run already claimed the occurrence', async () => {
    const { counts, push, where } = await run([reminder('morning', '06:00:00')], { claimError: { code: '23505' } });

    expect(push).not.toHaveBeenCalled();
    expect(counts).toMatchObject({ duplicate: 1, sent: 0 });
    expect(where('participants', 'select')).toHaveLength(0);
  });

  it('does not stamp a push that failed, so a later run can retry it', async () => {
    const failing: PushFn = async () => { throw { statusCode: 500, body: 'push service down' }; };
    const { counts, where } = await run([reminder('morning', '06:00:00')], {}, { push: failing });

    expect(counts).toMatchObject({ failed: 1, backtrack: 0 });
    expect(where('reminder_sends', 'update')[0].values).toMatchObject({ status: 'failed', kind: 'backtrack' });
    expect(where('participants', 'update')).toHaveLength(0);
  });

  it('removes an expired device without stamping', async () => {
    const gone: PushFn = async () => { throw { statusCode: 410, body: 'gone' }; };
    const { counts, where } = await run([reminder('morning', '06:00:00')], {}, { push: gone });

    expect(counts).toMatchObject({ deleted: 1, backtrack: 0 });
    expect(where('push_subscriptions', 'delete')).toHaveLength(1);
    expect(where('participants', 'update')).toHaveLength(0);
  });

  it('logs a failed stamp and still counts the send', async () => {
    const { counts } = await run([reminder('morning', '06:00:00')], { stampError: { message: 'permission denied' } });

    expect(counts).toMatchObject({ sent: 1, backtrack: 1 });
    expect(consoleError).toHaveBeenCalledWith('backtrack_push_sent_at stamp failed:', 'p1', 'permission denied');
  });
});
