import {
  DeleteCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { describe, expect, it } from "vitest";
import { createDynamoStore } from "./dynamoStore";

interface RecordedCommand {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test inspects arbitrary command inputs
  input: Record<string, any>;
}

function fakeClient(responses: unknown[] = []) {
  const commands: RecordedCommand[] = [];
  const queue = [...responses];
  const send = async (command: RecordedCommand) => {
    commands.push(command);
    const next = queue.shift();
    if (next instanceof Error) throw next;
    return next ?? {};
  };
  return { client: { send } as never, commands };
}

const stored = {
  PK: "USER#u1",
  SK: "HABIT#h1",
  name: "Read",
  color: "blue",
  weekdays: [1],
  createdAt: "c",
};

describe("dynamo store", () => {
  it("puts a habit conditionally on the key not existing", async () => {
    const { client, commands } = fakeClient();
    const store = createDynamoStore(client, "T");
    await store.putHabit("u1", {
      id: "h1",
      name: "Read",
      color: "blue",
      weekdays: [1],
      createdAt: "2026-10-30T00:00:00.000Z",
    });
    const cmd = commands[0]!;
    expect(cmd).toBeInstanceOf(PutCommand);
    expect(cmd.input.TableName).toBe("T");
    expect(cmd.input.Item.PK).toBe("USER#u1");
    expect(cmd.input.Item.SK).toBe("HABIT#h1");
    expect(cmd.input.Item.name).toBe("Read");
    expect(cmd.input.ConditionExpression).toBe("attribute_not_exists(PK)");
  });

  it("gets a habit, stripping keys and setting id from the sort key", async () => {
    const { client, commands } = fakeClient([{ Item: stored }, {}]);
    const store = createDynamoStore(client, "T");
    expect(await store.getHabit("u1", "h1")).toEqual({
      id: "h1",
      name: "Read",
      color: "blue",
      weekdays: [1],
      createdAt: "c",
    });
    expect(commands[0]).toBeInstanceOf(GetCommand);
    expect(commands[0]!.input.Key).toEqual({ PK: "USER#u1", SK: "HABIT#h1" });
    expect(await store.getHabit("u1", "h2")).toBeUndefined();
  });

  it("lists habits with the HABIT# prefix", async () => {
    const { client, commands } = fakeClient([{ Items: [stored] }]);
    const store = createDynamoStore(client, "T");
    const list = await store.listHabits("u1");
    expect(list.map((h) => h.id)).toEqual(["h1"]);
    expect(list[0]).not.toHaveProperty("PK");
    expect(commands[0]).toBeInstanceOf(QueryCommand);
    expect(commands[0]!.input.ExpressionAttributeValues[":p"]).toBe("HABIT#");
    expect(commands[0]!.input.ExpressionAttributeValues[":pk"]).toBe("USER#u1");
  });

  it("updates conditionally and maps a failed condition to undefined", async () => {
    const failure = Object.assign(new Error("no"), { name: "ConditionalCheckFailedException" });
    const { client, commands } = fakeClient([{ Attributes: { ...stored, name: "New" } }, failure]);
    const store = createDynamoStore(client, "T");
    const updated = await store.updateHabit("u1", "h1", { name: "New" });
    expect(updated?.id).toBe("h1");
    expect(updated?.name).toBe("New");
    expect(commands[0]).toBeInstanceOf(UpdateCommand);
    expect(commands[0]!.input.ConditionExpression).toBe("attribute_exists(PK)");
    expect(commands[0]!.input.Key).toEqual({ PK: "USER#u1", SK: "HABIT#h1" });
    expect(await store.updateHabit("u1", "gone", { name: "x" })).toBeUndefined();
  });

  it("puts a completion under the COMP# sort key", async () => {
    const { client, commands } = fakeClient();
    await createDynamoStore(client, "T").putCompletion("u1", "h1", "2026-10-30");
    expect(commands[0]).toBeInstanceOf(PutCommand);
    expect(commands[0]!.input.Item.PK).toBe("USER#u1");
    expect(commands[0]!.input.Item.SK).toBe("COMP#h1#2026-10-30");
  });

  it("deletes a completion by key", async () => {
    const { client, commands } = fakeClient();
    await createDynamoStore(client, "T").deleteCompletion("u1", "h1", "2026-10-30");
    expect(commands[0]).toBeInstanceOf(DeleteCommand);
    expect(commands[0]!.input.Key).toEqual({ PK: "USER#u1", SK: "COMP#h1#2026-10-30" });
  });

  it("lists completion dates across pages and strips the prefix", async () => {
    const { client, commands } = fakeClient([
      {
        Items: [{ SK: "COMP#h1#2026-10-28" }, { SK: "COMP#h1#2026-10-29" }],
        LastEvaluatedKey: { PK: "USER#u1", SK: "COMP#h1#2026-10-29" },
      },
      { Items: [{ SK: "COMP#h1#2026-10-30" }] },
    ]);
    const dates = await createDynamoStore(client, "T").listCompletionDates("u1", "h1");
    expect(dates).toEqual(["2026-10-28", "2026-10-29", "2026-10-30"]);
    expect(commands).toHaveLength(2);
    expect(commands[0]!.input.KeyConditionExpression).toContain("begins_with(SK, :p)");
    expect(commands[0]!.input.ExpressionAttributeValues[":p"]).toBe("COMP#h1#");
    expect(commands[1]!.input.ExclusiveStartKey).toEqual({
      PK: "USER#u1",
      SK: "COMP#h1#2026-10-29",
    });
  });
});
