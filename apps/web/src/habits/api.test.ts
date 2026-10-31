import { describe, expect, it, vi } from "vitest";
import { createHabitsApi, HabitsApiError, readApiUrl } from "./api";

const BASE = "https://api.example.com";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function setup(response: Response | Error) {
  const fetchFake = vi.fn(() =>
    response instanceof Error ? Promise.reject(response) : Promise.resolve(response),
  );
  const api = createHabitsApi({
    baseUrl: BASE,
    getToken: () => Promise.resolve("tok"),
    fetch: fetchFake as unknown as typeof fetch,
  });
  return { api, fetchFake };
}

function lastCall(fetchFake: ReturnType<typeof vi.fn>) {
  const [url, init] = fetchFake.mock.calls[0] as unknown as [string, RequestInit];
  return { url, init, headers: init.headers as Record<string, string> };
}

describe("readApiUrl", () => {
  it("returns the value without a trailing slash", () => {
    expect(readApiUrl({ VITE_API_URL: "https://x.test/" })).toBe("https://x.test");
    expect(readApiUrl({ VITE_API_URL: "http://localhost:3000" })).toBe("http://localhost:3000");
  });

  it.each([{}, { VITE_API_URL: "" }, { VITE_API_URL: "ftp://x" }, { VITE_API_URL: "x.test" }])(
    "throws naming VITE_API_URL for %j",
    (env) => {
      expect(() => readApiUrl(env)).toThrow(/VITE_API_URL/);
    },
  );
});

describe("createHabitsApi", () => {
  it("lists habits", async () => {
    const { api, fetchFake } = setup(jsonResponse([{ id: "h1" }]));
    expect(await api.listHabits("2026-10-30")).toEqual([{ id: "h1" }]);
    const { url, init, headers } = lastCall(fetchFake);
    expect(url).toBe(`${BASE}/habits?today=2026-10-30`);
    expect(init.method).toBe("GET");
    expect(headers.Authorization).toBe("Bearer tok");
  });

  it("gets a habit", async () => {
    const { api, fetchFake } = setup(jsonResponse({ id: "h1" }));
    await api.getHabit("h1", "2026-10-30");
    const { url, init } = lastCall(fetchFake);
    expect(url).toBe(`${BASE}/habits/h1?today=2026-10-30`);
    expect(init.method).toBe("GET");
  });

  it("creates a habit with a JSON body", async () => {
    const { api, fetchFake } = setup(jsonResponse({ id: "h1" }, 201));
    const input = { name: "Read", color: "#fff" } as unknown as Parameters<
      typeof api.createHabit
    >[0];
    expect(await api.createHabit(input)).toEqual({ id: "h1" });
    const { url, init, headers } = lastCall(fetchFake);
    expect(url).toBe(`${BASE}/habits`);
    expect(init.method).toBe("POST");
    expect(headers["Content-Type"]).toBe("application/json");
    expect(JSON.parse(init.body as string)).toEqual(input);
  });

  it("updates a habit", async () => {
    const { api, fetchFake } = setup(jsonResponse({ id: "h1" }));
    const changes = { name: "Run" } as unknown as Parameters<typeof api.updateHabit>[1];
    await api.updateHabit("h1", changes);
    const { url, init } = lastCall(fetchFake);
    expect(url).toBe(`${BASE}/habits/h1`);
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body as string)).toEqual(changes);
  });

  it("logs a completion and resolves on 204 without parsing", async () => {
    const { api, fetchFake } = setup(new Response(null, { status: 204 }));
    await expect(api.logCompletion("h1", "2026-10-30")).resolves.toBeUndefined();
    const { url, init } = lastCall(fetchFake);
    expect(url).toBe(`${BASE}/habits/h1/completions/2026-10-30`);
    expect(init.method).toBe("PUT");
  });

  it("undoes a completion", async () => {
    const { api, fetchFake } = setup(new Response(null, { status: 204 }));
    await api.undoCompletion("h1", "2026-10-30");
    const { url, init } = lastCall(fetchFake);
    expect(url).toBe(`${BASE}/habits/h1/completions/2026-10-30`);
    expect(init.method).toBe("DELETE");
  });

  it("encodes the habit id in the path", async () => {
    const { api, fetchFake } = setup(new Response(null, { status: 204 }));
    await api.logCompletion("a/b", "2026-10-30");
    expect(lastCall(fetchFake).url).toBe(`${BASE}/habits/a%2Fb/completions/2026-10-30`);
  });

  it("turns a JSON error body into a HabitsApiError", async () => {
    const { api } = setup(jsonResponse({ code: "not-found", message: "No such habit" }, 404));
    const error = await api.getHabit("h1", "2026-10-30").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(HabitsApiError);
    expect(error).toMatchObject({ status: 404, code: "not-found", message: "No such habit" });
  });

  it("gives code unknown for a non-JSON error body", async () => {
    const { api } = setup(new Response("<html>bad gateway</html>", { status: 502 }));
    const error = await api.listHabits("2026-10-30").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(HabitsApiError);
    expect(error).toMatchObject({ status: 502, code: "unknown" });
  });

  it("gives status 0 and code network when fetch rejects", async () => {
    const { api } = setup(new TypeError("Failed to fetch"));
    const error = await api.listHabits("2026-10-30").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(HabitsApiError);
    expect(error).toMatchObject({ status: 0, code: "network" });
  });
});
