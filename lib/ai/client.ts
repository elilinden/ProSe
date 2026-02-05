import OpenAI from "openai";

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export function getModel(): string {
  // safe default for MVP. You can switch later.
  return process.env.OPENAI_MODEL || "gpt-4.1-mini";
}

export function requireApiKey() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("Missing OPENAI_API_KEY. Add it to .env.local.");
  }
}