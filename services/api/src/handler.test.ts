import type { APIGatewayProxyEventV2WithJWTAuthorizer } from "aws-lambda";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createHandler, handler } from "./handler";
import { createMemoryStore } from "./memoryStore";
import type { HabitRecord, HabitStore } from "./store";

const NOW = new Date("2026-10-30T12:00:00Z");

const ID_A = "01HZZZZZZZZZZZZZZZZZZZZZZA";
const ID_B = "01HZZZZZZZZZZZZZZZZZZZZZZB";
const ID_C = "01HZZZZZZZZZZZZZZZZZZZZZZC";
const ID_Z = "01HZZZZZZZZZZZZZZZZZZZZZZZ";
const ID_MISSING = "01HZZZZZZZZZZZZZZZZZZZZZZM";
const ID_GONE = "01HZZZZZZZZZZZZZZZZZZZZZZG";
const ID_THEIRS = "01HZZZZZZZZZZZZZZZZZZZZZZT";

interface EventOptions {
  routeKey: string;
  sub?: string | null;
  pathParameters?: Record<string, string>;
  queryStringParameters?: Record<string, string>;
  body?: string;
}

function makeEvent({
  routeKey,
  sub = "user-1",
  pathParameters,
  queryStringParameters,
  body,
}: EventOptions): APIGatewayProxyEventV2WithJWTAuthorizer {
  return {
    routeKey,
    pathParameters,
    queryStringParameters,
    body,
    requestContext: {
      authorizer: { jwt: { claims: sub === null ? {} : { sub }, scopes: [] } },
    },
  } as unknown as APIGatewayProxyEventV2WithJWTAuthorizer;
}

const habit = (id: string, extra: Partial<HabitRecord> = {}): HabitRecord => ({
  id,
  name: `Habit ${id}`,
  color: "green",
  weekdays: [0, 1, 2, 3, 4, 5, 6],
  createdAt: "2026-01-01T00:00:00.000Z",
  ...extra,
});

async function call(store: HabitStore, options: EventOptions) {
  const result = await createHandler({ store, now: () => NOW })(makeEvent(options));
  if (typeof result === "string") throw new Error("expected a structured result");
  return {
    statusCode: result.statusCode,
    headers: result.headers,
    json: JSON.parse(result.body ?? "null") as Record<string, unknown>,
  };
}

describe("lazy handler", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("reports a missing TABLE_NAME as a normal internal error", async () => {
    vi.stubEnv("TABLE_NAME", "");
    const log = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await handler(makeEvent({ routeKey: "GET /habits" }));

    if (typeof result === "string") throw new Error("expected a structured result");
    expect(result.statusCode).toBe(500);
    expect(JSON.parse(result.body ?? "null")).toEqual({
      code: "internal",
      message: "internal error",
    });
    expect(log).toHaveBeenCalledTimes(1);
    expect(String(log.mock.calls[0]?.[0])).toContain("TABLE_NAME");
  });
});

describe("handler", () => {
  it("rejects a request with no sub claim", async () => {
    const res = await call(createMemoryStore(), { routeKey: "GET /habits", sub: null });
    expect(res.statusCode).toBe(401);
    expect(res.json.code).toBe("unauthorized");
    expect(res.headers?.["content-type"]).toBe("application/json");
  });

  it("returns not-found for an unknown route", async () => {
    const res = await call(createMemoryStore(), { routeKey: "GET /nope" });
    expect(res.statusCode).toBe(404);
    expect(res.json.code).toBe("not-found");
  });

  it("maps a store failure to a bare internal error", async () => {
    const store = createMemoryStore();
    store.listHabits = async () => {
      throw new Error("boom secret detail");
    };
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await call(store, {
      routeKey: "GET /habits",
      queryStringParameters: { today: "2026-10-30" },
    });
    expect(res.statusCode).toBe(500);
    expect(res.json.code).toBe("internal");
    expect(JSON.stringify(res.json)).not.toContain("boom");
    expect(JSON.stringify(res.json)).not.toContain("at ");
    expect(log).toHaveBeenCalledTimes(1);
    log.mockRestore();
  });

  describe("GET /habits", () => {
    it.each([undefined, "2026-02-30"])("rejects today=%s", async (today) => {
      const res = await call(createMemoryStore(), {
        routeKey: "GET /habits",
        queryStringParameters: today === undefined ? undefined : { today },
      });
      expect(res.statusCode).toBe(400);
      expect(res.json.code).toBe("invalid-request");
    });

    it("lists active habits with streak and weekDone", async () => {
      const store = createMemoryStore();
      await store.putHabit("user-1", habit(ID_A));
      await store.putHabit("user-1", habit(ID_B, { archivedAt: "2026-05-01T00:00:00.000Z" }));
      await store.putHabit("user-1", habit(ID_C));
      await store.putHabit("user-2", habit(ID_Z));
      for (const date of ["2026-10-24", "2026-10-25", "2026-10-29", "2026-10-30"]) {
        await store.putCompletion("user-1", ID_A, date);
      }

      const res = await call(store, {
        routeKey: "GET /habits",
        queryStringParameters: { today: "2026-10-30" },
      });

      expect(res.statusCode).toBe(200);
      const list = res.json as unknown as Array<Record<string, unknown>>;
      expect(list.map((h) => h.id)).toEqual([ID_A, ID_C]);
      expect(list[0]?.weekDone).toEqual(["2026-10-25", "2026-10-29", "2026-10-30"]);
      expect(list[0]?.streak).toBe(2);
      expect(list[1]).toMatchObject({ streak: 0, weekDone: [] });
      for (const h of list) expect(h).not.toHaveProperty("archivedAt");
    });
  });

  describe("GET /habits/{id}", () => {
    const get = (store: HabitStore, id: string, sub = "user-1") =>
      call(store, {
        routeKey: "GET /habits/{id}",
        sub,
        pathParameters: { id },
        queryStringParameters: { today: "2026-10-30" },
      });

    it("limits done to the 365 days ending today but counts older days toward the streak", async () => {
      const store = createMemoryStore();
      await store.putHabit("user-1", habit(ID_A));
      // Daily habit done every day from 366 days before today through today.
      const first = new Date("2025-10-29T00:00:00Z");
      for (let i = 0; i <= 366; i++) {
        const d = new Date(first.getTime() + i * 86_400_000).toISOString().slice(0, 10);
        await store.putCompletion("user-1", ID_A, d);
      }

      const res = await get(store, ID_A);

      expect(res.statusCode).toBe(200);
      const done = res.json.done as string[];
      expect(done).toHaveLength(365);
      expect(done[0]).toBe("2025-10-31");
      expect(done.at(-1)).toBe("2026-10-30");
      expect(done).not.toContain("2025-10-29");
      expect(res.json.streak).toBe(367);
      expect(res.json).not.toHaveProperty("archivedAt");
    });

    it("returns 404 for unknown, archived and foreign habits", async () => {
      const store = createMemoryStore();
      await store.putHabit("user-1", habit(ID_GONE, { archivedAt: "2026-05-01T00:00:00.000Z" }));
      await store.putHabit("user-2", habit(ID_THEIRS));
      for (const id of [ID_MISSING, ID_GONE, ID_THEIRS]) {
        const res = await get(store, id);
        expect(res.statusCode).toBe(404);
        expect(res.json.code).toBe("not-found");
      }
    });

    it("rejects an invalid today", async () => {
      const res = await call(createMemoryStore(), {
        routeKey: "GET /habits/{id}",
        pathParameters: { id: ID_A },
        queryStringParameters: { today: "nope" },
      });
      expect(res.statusCode).toBe(400);
    });
  });

  describe("malformed habit ids", () => {
    const cases: Array<[string, Record<string, string>, string?]> = [
      ["GET /habits/{id}", {}],
      ["PATCH /habits/{id}", {}, JSON.stringify({ name: "x" })],
      ["PUT /habits/{id}/completions/{date}", { date: "2026-10-30" }],
      ["DELETE /habits/{id}/completions/{date}", { date: "2026-10-30" }],
    ];
    it.each(cases)("%s returns 404 for a short or very long id", async (routeKey, extra, body) => {
      for (const id of ["h1", "a".repeat(2000)]) {
        const res = await call(createMemoryStore(), {
          routeKey,
          pathParameters: { id, ...extra },
          queryStringParameters: { today: "2026-10-30" },
          body,
        });
        expect(res.statusCode).toBe(404);
        expect(res.json.code).toBe("not-found");
      }
    });
  });

  describe("POST /habits", () => {
    const post = (store: HabitStore, body: string | undefined, sub = "user-1") =>
      call(store, { routeKey: "POST /habits", sub, body });
    const valid = JSON.stringify({ name: " Read ", color: "blue", weekdays: [3, 1, 1] });

    it("creates and stores a habit", async () => {
      const store = createMemoryStore();
      const res = await post(store, valid);
      expect(res.statusCode).toBe(201);
      expect(res.json).toEqual({
        id: expect.stringMatching(/^[0-9A-HJKMNP-TV-Z]{26}$/),
        name: "Read",
        color: "blue",
        weekdays: [1, 3],
        createdAt: NOW.toISOString(),
      });
      const stored = await store.listHabits("user-1");
      expect(stored).toHaveLength(1);
      expect(stored[0]?.id).toBe(res.json.id);
      expect(await store.listHabits("user-2")).toEqual([]);
    });

    it.each([
      ["not json"],
      ["null"],
      ["[]"],
      [undefined],
      [JSON.stringify({ name: "x".repeat(61), color: "blue", weekdays: [1] })],
      [JSON.stringify({ name: "x", color: "blue", weekdays: [7] })],
    ])("rejects the garbage body %s with 400", async (body) => {
      const store = createMemoryStore();
      const res = await post(store, body);
      expect(res.statusCode).toBe(400);
      expect(res.json.code).toBe("invalid-request");
      expect(await store.listHabits("user-1")).toEqual([]);
    });

    it("rejects the 51st habit, archived ones counted, with 409", async () => {
      const store = createMemoryStore();
      for (let i = 0; i < 50; i++) {
        const id = `01HZZZZZZZZZZZZZZZZZZZZ${String(i).padStart(3, "0")}`;
        const extra = i === 0 ? { archivedAt: "2026-05-01T00:00:00.000Z" } : {};
        await store.putHabit("user-1", habit(id, extra));
      }
      const res = await post(store, valid);
      expect(res.statusCode).toBe(409);
      expect(res.json.code).toBe("habit-limit");
      expect(await store.listHabits("user-1")).toHaveLength(50);
      expect((await post(store, valid, "user-2")).statusCode).toBe(201);
    });
  });

  describe("PATCH /habits/{id}", () => {
    const patch = (store: HabitStore, id: string, body: unknown, sub = "user-1") =>
      call(store, {
        routeKey: "PATCH /habits/{id}",
        sub,
        pathParameters: { id },
        body: JSON.stringify(body),
      });

    it("renames and recolors", async () => {
      const store = createMemoryStore();
      await store.putHabit("user-1", habit(ID_A));
      const res = await patch(store, ID_A, { name: "New", color: "pink" });
      expect(res.statusCode).toBe(200);
      expect(res.json).toEqual({
        id: ID_A,
        name: "New",
        color: "pink",
        weekdays: [0, 1, 2, 3, 4, 5, 6],
        createdAt: "2026-01-01T00:00:00.000Z",
      });
      expect(await store.getHabit("user-1", ID_A)).toMatchObject({ name: "New", color: "pink" });
    });

    it("a rename alone keeps the color", async () => {
      const store = createMemoryStore();
      await store.putHabit("user-1", habit(ID_A));
      await patch(store, ID_A, { name: "Only name" });
      expect(await store.getHabit("user-1", ID_A)).toMatchObject({
        name: "Only name",
        color: "green",
      });
    });

    it("archives, and the habit leaves the list", async () => {
      const store = createMemoryStore();
      await store.putHabit("user-1", habit(ID_A));
      const res = await patch(store, ID_A, { archived: true });
      expect(res.statusCode).toBe(200);
      expect((await store.getHabit("user-1", ID_A))?.archivedAt).toBe(NOW.toISOString());
      const list = await call(store, {
        routeKey: "GET /habits",
        queryStringParameters: { today: "2026-10-30" },
      });
      expect(list.json).toEqual([]);
    });

    it.each([{ weekdays: [1] }, {}, { name: "" }, { archived: false }, null])(
      "rejects the body %j with 400",
      async (body) => {
        const store = createMemoryStore();
        await store.putHabit("user-1", habit(ID_A));
        const res = await patch(store, ID_A, body);
        expect(res.statusCode).toBe(400);
        expect(res.json.code).toBe("invalid-request");
      },
    );

    it("rejects a non-JSON body with 400", async () => {
      const store = createMemoryStore();
      await store.putHabit("user-1", habit(ID_A));
      const res = await call(store, {
        routeKey: "PATCH /habits/{id}",
        pathParameters: { id: ID_A },
        body: "{oops",
      });
      expect(res.statusCode).toBe(400);
    });

    it("returns 404 for another user's, unknown and archived habits", async () => {
      const store = createMemoryStore();
      await store.putHabit("user-2", habit(ID_THEIRS));
      await store.putHabit("user-1", habit(ID_GONE, { archivedAt: "2026-05-01T00:00:00.000Z" }));
      for (const id of [ID_THEIRS, ID_MISSING, ID_GONE]) {
        const res = await patch(store, id, { name: "Hijack" });
        expect(res.statusCode).toBe(404);
        expect(res.json.code).toBe("not-found");
      }
      expect(await store.getHabit("user-2", ID_THEIRS)).toEqual(habit(ID_THEIRS));
      expect(await store.getHabit("user-1", ID_THEIRS)).toBeUndefined();
      expect((await store.getHabit("user-1", ID_GONE))?.name).toBe(`Habit ${ID_GONE}`);
    });
  });

  describe("completions", () => {
    const put = (store: HabitStore, id: string, date: string, sub = "user-1") =>
      call(store, {
        routeKey: "PUT /habits/{id}/completions/{date}",
        sub,
        pathParameters: { id, date },
      });
    const del = (store: HabitStore, id: string, date: string, sub = "user-1") =>
      call(store, {
        routeKey: "DELETE /habits/{id}/completions/{date}",
        sub,
        pathParameters: { id, date },
      });

    it("PUT is idempotent", async () => {
      const store = createMemoryStore();
      await store.putHabit("user-1", habit(ID_A));
      expect((await put(store, ID_A, "2026-10-30")).statusCode).toBe(204);
      expect((await put(store, ID_A, "2026-10-30")).statusCode).toBe(204);
      expect(await store.listCompletionDates("user-1", ID_A)).toEqual(["2026-10-30"]);
    });

    it("DELETE is idempotent", async () => {
      const store = createMemoryStore();
      await store.putHabit("user-1", habit(ID_A));
      await store.putCompletion("user-1", ID_A, "2026-10-30");
      expect((await del(store, ID_A, "2026-10-30")).statusCode).toBe(204);
      expect((await del(store, ID_A, "2026-10-30")).statusCode).toBe(204);
      expect(await store.listCompletionDates("user-1", ID_A)).toEqual([]);
    });

    it.each([
      ["2026-10-31", 204],
      ["2026-11-01", 400],
      ["2025-10-29", 204],
      ["2025-10-28", 400],
      ["2026-13-01", 400],
      ["nope", 400],
    ])("PUT and DELETE of %s give %i", async (date, status) => {
      const store = createMemoryStore();
      await store.putHabit("user-1", habit(ID_A));
      const putRes = await put(store, ID_A, date);
      expect(putRes.statusCode).toBe(status);
      expect((await del(store, ID_A, date)).statusCode).toBe(status);
      if (status === 400) {
        expect(putRes.json.code).toBe("invalid-request");
        expect(await store.listCompletionDates("user-1", ID_A)).toEqual([]);
      }
    });

    it("returns 404 and stores nothing for unknown, archived and foreign habits", async () => {
      const store = createMemoryStore();
      await store.putHabit("user-1", habit(ID_GONE, { archivedAt: "2026-05-01T00:00:00.000Z" }));
      await store.putHabit("user-2", habit(ID_THEIRS));
      for (const id of [ID_MISSING, ID_GONE, ID_THEIRS]) {
        for (const op of [put, del]) {
          const res = await op(store, id, "2026-10-30");
          expect(res.statusCode).toBe(404);
          expect(res.json.code).toBe("not-found");
        }
        for (const user of ["user-1", "user-2"]) {
          expect(await store.listCompletionDates(user, id)).toEqual([]);
        }
      }
    });
  });
});
