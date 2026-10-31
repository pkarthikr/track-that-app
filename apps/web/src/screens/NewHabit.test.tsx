import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { HabitsApi } from "../habits/api";
import { NewHabit } from "./NewHabit";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function fakeApi(createHabit = vi.fn()): HabitsApi {
  return {
    listHabits: vi.fn(),
    getHabit: vi.fn(),
    createHabit,
    updateHabit: vi.fn(),
    logCompletion: vi.fn(),
    undoCompletion: vi.fn(),
  };
}

function setup(api: HabitsApi) {
  const onCreated = vi.fn();
  const onCancel = vi.fn();
  render(<NewHabit api={api} onCreated={onCreated} onCancel={onCancel} />);
  return { onCreated, onCancel };
}

const day = (name: string) => screen.getByRole("button", { name });
const submit = () => screen.getByRole("button", { name: "Create habit" });
const typeName = (value: string) =>
  fireEvent.change(screen.getByLabelText("Name"), { target: { value } });

describe("NewHabit", () => {
  it("starts with all seven days pressed and green selected", () => {
    setup(fakeApi());
    for (const name of DAYS) expect(day(name).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("radio", { name: "Green" }).getAttribute("aria-checked")).toBe("true");
  });

  it("asks for at least one day and sends nothing", () => {
    const createHabit = vi.fn();
    setup(fakeApi(createHabit));
    typeName("Gym");
    for (const name of DAYS) fireEvent.click(day(name));
    fireEvent.click(submit());
    expect(screen.getByText("Pick at least one day.")).toBeTruthy();
    expect(createHabit).not.toHaveBeenCalled();
  });

  it("shows the validator message for an empty name", () => {
    const createHabit = vi.fn();
    setup(fakeApi(createHabit));
    fireEvent.click(submit());
    expect(screen.getByText("name must be 1 to 60 characters")).toBeTruthy();
    expect(createHabit).not.toHaveBeenCalled();
  });

  it("creates the habit and reports its id", async () => {
    const createHabit = vi.fn().mockResolvedValue({ id: "h1" });
    const { onCreated } = setup(fakeApi(createHabit));
    typeName("Gym");
    fireEvent.click(screen.getByRole("radio", { name: "Coral" }));
    for (const name of ["Sunday", "Tuesday", "Thursday", "Saturday"]) fireEvent.click(day(name));
    fireEvent.click(submit());
    await waitFor(() => expect(onCreated).toHaveBeenCalledWith("h1"));
    expect(createHabit).toHaveBeenCalledWith({ name: "Gym", color: "coral", weekdays: [1, 3, 5] });
  });

  it("disables the button while the request is in flight", async () => {
    let resolve!: (habit: { id: string }) => void;
    const createHabit = vi.fn().mockReturnValue(
      new Promise((r) => {
        resolve = r;
      }),
    );
    const { onCreated } = setup(fakeApi(createHabit));
    typeName("Gym");
    fireEvent.click(submit());
    expect((submit() as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(submit());
    expect(createHabit).toHaveBeenCalledTimes(1);
    resolve({ id: "h1" });
    await waitFor(() => expect(onCreated).toHaveBeenCalledWith("h1"));
  });

  it("shows an alert, keeps the values and re-enables on failure", async () => {
    const createHabit = vi.fn().mockRejectedValue(new Error("boom"));
    const { onCreated } = setup(fakeApi(createHabit));
    typeName("Gym");
    fireEvent.click(screen.getByRole("radio", { name: "Coral" }));
    fireEvent.click(day("Sunday"));
    fireEvent.click(submit());
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect((screen.getByLabelText("Name") as HTMLInputElement).value).toBe("Gym");
    expect(screen.getByRole("radio", { name: "Coral" }).getAttribute("aria-checked")).toBe("true");
    expect(day("Sunday").getAttribute("aria-pressed")).toBe("false");
    expect((submit() as HTMLButtonElement).disabled).toBe(false);
    expect(onCreated).not.toHaveBeenCalled();
  });

  it("calls onCancel", () => {
    const { onCancel } = setup(fakeApi());
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
