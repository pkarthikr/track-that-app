import { APP_NAME } from "@trackthat/shared";

export const handler = async (): Promise<{ message: string; app: string }> => ({
  message: "hello",
  app: APP_NAME,
});
