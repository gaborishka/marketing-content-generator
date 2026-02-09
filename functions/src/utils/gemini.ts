// Gemini client singleton for Cloud Functions.
// Extracted from functions/src/index.ts:43

import { GoogleGenAI } from "@google/genai";
import { defineSecret } from "firebase-functions/params";

export const GEMINI_API_KEY = defineSecret("GEMINI_API_KEY");

let client: GoogleGenAI | null = null;

export function getGeminiClient(): GoogleGenAI {
  if (!client) {
    client = new GoogleGenAI({ apiKey: GEMINI_API_KEY.value() });
  }
  return client;
}

// Reset for testing
export function resetGeminiClient(): void {
  client = null;
}
