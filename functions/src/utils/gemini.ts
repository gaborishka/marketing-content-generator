// Gemini client singleton for Cloud Functions.
// Extracted from functions/src/index.ts:43

import { GoogleGenAI } from "@google/genai";
import { defineSecret } from "firebase-functions/params";

export const GEMINI_API_KEY = defineSecret("GEMINI_API_KEY");

let client: GoogleGenAI | null = null;

// Helper to get API key with fallback to environment variable for local development
function getApiKey(): string {
  try {
    // Try to get from Firebase secret (works in production and emulator if set)
    const secretValue = GEMINI_API_KEY.value();
    if (secretValue) {
      return secretValue;
    }
  } catch (error) {
    // Secret not available, fall back to environment variable for local dev
  }
  
  // Fallback to environment variable for local development
  const envKey = process.env.GEMINI_API_KEY;
  if (envKey) {
    return envKey;
  }
  
  throw new Error("API key must be set when using the Gemini API. Set GEMINI_API_KEY environment variable or configure Firebase secret.");
}

export function getGeminiClient(): GoogleGenAI {
  if (!client) {
    const apiKey = getApiKey();
    client = new GoogleGenAI({ apiKey });
  }
  return client;
}

// Reset for testing
export function resetGeminiClient(): void {
  client = null;
}
