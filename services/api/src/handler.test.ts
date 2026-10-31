import type { APIGatewayProxyEventV2WithJWTAuthorizer } from "aws-lambda";
import { describe, expect, it, vi } from "vitest";

import { createHandler } from "./handler";
import { createMemoryStore } from "./memoryStore";
import type { HabitRecord, HabitStore } from "./store";

const NOW = new Date("2026-10-30T12:00:00Z");

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
      await store.putHabit("user-1", habit("a"));
      await store.putHabit("user-1", habit("b", { archivedAt: "2026-05-01T00:00:00.000Z" }));
      await store.putHabit("user-1", habit("c"));
      await store.putHabit("user-2", habit("z"));
      for (const date of ["2026-10-24", "2026-10-25", "2026-10-29", "2026-10-30"]) {
        await store.putCompletion("user-1", "a", date);
      }

      const res = await call(store, {
        routeKey: "GET /habits",
        queryStringParameters: { today: "2026-10-30" },
      });

      expect(res.statusCode).toBe(200);
      const list = res.json as unknown as Array<Record<string, unknown>>;
      expect(list.map((h) => h.id)).toEqual(["a", "c"]);
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
      await store.putHabit("user-1", habit("a"));
      // Daily habit done every day from 366 days before today through today.
      const first = new Date("2025-10-29T00:00:00Z");
      for (let i = 0; i <= 366; i++) {
        const d = new Date(first.getTime() + i * 86_400_000).toISOString().slice(0, 10);
        await store.putCompletion("user-1", "a", d);
      }

      const res = await get(store, "a");

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
      await store.putHabit("user-1", habit("gone", { archivedAt: "2026-05-01T00:00:00.000Z" }));
      await store.putHabit("user-2", habit("theirs"));
      for (const id of ["missing", "gone", "theirs"]) {
        const res = await get(store, id);
        expect(res.statusCode).toBe(404);
        expect(res.json.code).toBe("not-found");
      }
    });

    it("rejects an invalid today", async () => {
      const res = await call(createMemoryStore(), {
        routeKey: "GET /habits/{id}",
        pathParameters: { id: "a" },
        queryStringParameters: { today: "nope" },
      });
      expect(res.statusCode).toBe(400);
    });
  });
});
