import type {
  DateString,
  Habit,
  HabitDetail,
  HabitPatch,
  HabitSummary,
  NewHabit,
} from "@trackthat/shared";
import { fetchAuthSession } from "aws-amplify/auth";

export interface HabitsApi {
  listHabits(today: DateString): Promise<HabitSummary[]>;
  getHabit(id: string, today: DateString): Promise<HabitDetail>;
  createHabit(input: NewHabit): Promise<Habit>;
  updateHabit(id: string, changes: HabitPatch): Promise<Habit>;
  logCompletion(id: string, date: DateString): Promise<void>;
  undoCompletion(id: string, date: DateString): Promise<void>;
}

export class HabitsApiError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "HabitsApiError";
    this.status = status;
    this.code = code;
  }
}

export function readApiUrl(env: Record<string, unknown>): string {
  const value = env.VITE_API_URL;
  if (typeof value !== "string" || !/^https?:\/\//.test(value)) {
    throw new Error(
      'VITE_API_URL must be set to the API URL (an http(s):// address). See the README "Deploying" section.',
    );
  }
  return value.replace(/\/+$/, "");
}

export async function idToken(): Promise<string> {
  const token = (await fetchAuthSession()).tokens?.idToken?.toString();
  if (!token) throw new Error("Not signed in");
  return token;
}

async function errorFrom(response: Response): Promise<HabitsApiError> {
  try {
    const body = (await response.json()) as { code?: unknown; message?: unknown };
    if (typeof body.code === "string" && typeof body.message === "string") {
      return new HabitsApiError(response.status, body.code, body.message);
    }
  } catch {
    // fall through to the generic error
  }
  return new HabitsApiError(response.status, "unknown", `Request failed (${response.status})`);
}

export function createHabitsApi(options: {
  baseUrl: string;
  getToken: () => Promise<string>;
  fetch?: typeof fetch;
}): HabitsApi {
  const { baseUrl, getToken } = options;
  const doFetch = options.fetch ?? ((...args: Parameters<typeof fetch>) => fetch(...args));

  async function send(method: string, path: string, body?: unknown): Promise<Response> {
    const headers: Record<string, string> = { Authorization: `Bearer ${await getToken()}` };
    if (body !== undefined) headers["Content-Type"] = "application/json";
    let response: Response;
    try {
      response = await doFetch(`${baseUrl}${path}`, {
        method,
        headers,
        ...(body !== undefined && { body: JSON.stringify(body) }),
      });
    } catch {
      throw new HabitsApiError(0, "network", "Could not reach the server");
    }
    if (!response.ok) throw await errorFrom(response);
    return response;
  }

  async function json<T>(method: string, path: string, body?: unknown): Promise<T> {
    return (await (await send(method, path, body)).json()) as T;
  }

  const habitPath = (id: string) => `/habits/${encodeURIComponent(id)}`;
  const completionPath = (id: string, date: DateString) =>
    `${habitPath(id)}/completions/${encodeURIComponent(date)}`;

  return {
    listHabits: (today) => json("GET", `/habits?today=${encodeURIComponent(today)}`),
    getHabit: (id, today) => json("GET", `${habitPath(id)}?today=${encodeURIComponent(today)}`),
    createHabit: (input) => json("POST", "/habits", input),
    updateHabit: (id, changes) => json("PATCH", habitPath(id), changes),
    async logCompletion(id, date) {
      await send("PUT", completionPath(id, date));
    },
    async undoCompletion(id, date) {
      await send("DELETE", completionPath(id, date));
    },
  };
}
