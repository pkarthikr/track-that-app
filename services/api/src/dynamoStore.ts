import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import {
  DeleteCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import type { HabitRecord, HabitStore } from "./store";

const HABIT_PREFIX = "HABIT#";

const userKey = (userId: string) => `USER#${userId}`;
const habitSk = (habitId: string) => `${HABIT_PREFIX}${habitId}`;
const completionPrefix = (habitId: string) => `COMP#${habitId}#`;

function toHabit(item: Record<string, unknown>): HabitRecord {
  const { SK, ...rest } = item;
  delete rest.PK;
  return { ...rest, id: String(SK).slice(HABIT_PREFIX.length) } as HabitRecord;
}

export function createDynamoStore(
  client: Pick<DynamoDBDocumentClient, "send">,
  tableName: string,
): HabitStore {
  async function queryPrefix(userId: string, prefix: string): Promise<Record<string, unknown>[]> {
    const items: Record<string, unknown>[] = [];
    let startKey: Record<string, unknown> | undefined;
    do {
      const page = await client.send(
        new QueryCommand({
          TableName: tableName,
          KeyConditionExpression: "PK = :pk AND begins_with(SK, :p)",
          ExpressionAttributeValues: { ":pk": userKey(userId), ":p": prefix },
          ExclusiveStartKey: startKey,
        }),
      );
      items.push(...(page.Items ?? []));
      startKey = page.LastEvaluatedKey;
    } while (startKey);
    return items;
  }

  return {
    async listHabits(userId) {
      const items = await queryPrefix(userId, HABIT_PREFIX);
      return items.map(toHabit);
    },

    async getHabit(userId, habitId) {
      const { Item } = await client.send(
        new GetCommand({
          TableName: tableName,
          Key: { PK: userKey(userId), SK: habitSk(habitId) },
        }),
      );
      return Item ? toHabit(Item) : undefined;
    },

    async putHabit(userId, habit) {
      const { id, ...attributes } = habit;
      await client.send(
        new PutCommand({
          TableName: tableName,
          Item: { ...attributes, PK: userKey(userId), SK: habitSk(id) },
          ConditionExpression: "attribute_not_exists(PK)",
        }),
      );
    },

    async updateHabit(userId, habitId, changes) {
      const names: Record<string, string> = {};
      const values: Record<string, unknown> = {};
      const sets: string[] = [];
      Object.entries(changes).forEach(([field, value], index) => {
        if (value === undefined) return;
        names[`#f${index}`] = field;
        values[`:v${index}`] = value;
        sets.push(`#f${index} = :v${index}`);
      });
      if (sets.length === 0) return this.getHabit(userId, habitId);
      try {
        const { Attributes } = await client.send(
          new UpdateCommand({
            TableName: tableName,
            Key: { PK: userKey(userId), SK: habitSk(habitId) },
            UpdateExpression: `SET ${sets.join(", ")}`,
            ConditionExpression: "attribute_exists(PK)",
            ExpressionAttributeNames: names,
            ExpressionAttributeValues: values,
            ReturnValues: "ALL_NEW",
          }),
        );
        return Attributes ? toHabit(Attributes) : undefined;
      } catch (error) {
        if (error instanceof Error && error.name === "ConditionalCheckFailedException") {
          return undefined;
        }
        throw error;
      }
    },

    async listCompletionDates(userId, habitId) {
      const prefix = completionPrefix(habitId);
      const items = await queryPrefix(userId, prefix);
      return items.map((item) => String(item.SK).slice(prefix.length));
    },

    async putCompletion(userId, habitId, date) {
      await client.send(
        new PutCommand({
          TableName: tableName,
          Item: { PK: userKey(userId), SK: `${completionPrefix(habitId)}${date}` },
        }),
      );
    },

    async deleteCompletion(userId, habitId, date) {
      await client.send(
        new DeleteCommand({
          TableName: tableName,
          Key: { PK: userKey(userId), SK: `${completionPrefix(habitId)}${date}` },
        }),
      );
    },
  };
}
