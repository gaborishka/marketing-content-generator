// AI service for content modification via chat
import { GeneratedContent } from '../types';
import { GoogleGenAI, Type } from "@google/genai";
import { generateImage } from './geminiClient';

// Get API key from environment variable
const getApiKey = (): string => {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("VITE_GEMINI_API_KEY environment variable is required. Add it to your .env.local file.");
  }
  return apiKey;
};

// Initialize Gemini client
let client: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI {
  if (!client) {
    const apiKey = getApiKey();
    client = new GoogleGenAI({ apiKey });
  }
  return client;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface AIResponse {
  message: string;
  shouldUpdate?: boolean;
  updateFields?: string[];
  updatedContent?: Partial<GeneratedContent>;
  imagePrompt?: string;
  questions?: string[];
}

const CONTENT_MODIFICATION_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    message: { type: Type.STRING, description: "Response message to the user" },
    shouldUpdate: { type: Type.BOOLEAN, description: "Whether to update the content automatically" },
    updateFields: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "List of fields that should be updated: 'headline', 'body', 'text', 'image'"
    },
    updatedHeadline: { type: Type.STRING, description: "Updated headline ONLY if updateFields includes 'headline'" },
    updatedBody: { type: Type.STRING, description: "Updated body text ONLY if updateFields includes 'body'" },
    updatedText: { type: Type.STRING, description: "Updated full text ONLY if updateFields includes 'text' (use this if both headline and body need to change)" },
    imagePrompt: { type: Type.STRING, description: "Image generation prompt ONLY if updateFields includes 'image'" },
    questions: { 
      type: Type.ARRAY, 
      items: { type: Type.STRING },
      description: "Follow-up questions to ask the user if clarification is needed"
    },
    reasoning: { type: Type.STRING, description: "Brief explanation of the changes made" }
  },
  required: ["message"],
};

export async function chatWithAIForContent(
  content: GeneratedContent,
  messages: ChatMessage[],
  campaignContext?: { name: string; keyMessage: string; audience: string }
): Promise<AIResponse> {
  const ai = getGeminiClient();
  
  // Build context prompt
  const contextPrompt = `You are an AI assistant helping to modify marketing content. 

Current Content:
- Channel: ${content.channel}
- Audience: ${content.audience}
- Current Text: ${content.text}
${content.headline ? `- Headline: ${content.headline}` : ''}
${content.body ? `- Body: ${content.body}` : ''}
${campaignContext ? `
Campaign Context:
- Campaign Name: ${campaignContext.name}
- Key Message: ${campaignContext.keyMessage}
- Target Audience: ${campaignContext.audience}
` : ''}

Your role:
1. Understand the user's modification request
2. Identify which specific fields need to be updated (headline, body, text, or image)
3. If the request is clear and actionable, update ONLY the requested fields (set shouldUpdate: true and list fields in updateFields array)
4. If clarification is needed, ask follow-up questions (provide questions array)
5. Always explain what you're doing in the message field

CRITICAL RULES:
- ONLY update the fields that the user explicitly requested
- If user asks to update "body", ONLY update updatedBody - do NOT change headline or text
- If user asks to update "headline", ONLY update updatedHeadline - do NOT change body or text
- If user asks to regenerate/update image, provide imagePrompt in updateFields with 'image'
- Preserve all other fields exactly as they are
- Do NOT regenerate or modify fields that were not requested

Guidelines:
- Maintain the tone and style appropriate for ${content.channel}
- Keep the content suitable for ${content.audience} audience
- Preserve the core message while making requested changes
- For text updates: if only headline OR body is requested, update that specific field. If both need to change, use updatedText
- For image updates: create a detailed image prompt based on the content and user's request

Respond in JSON format with the schema provided.`;

  // Build conversation history - combine all messages into a single prompt for now
  // For multi-turn, we'd need to use chat history, but for simplicity, we'll combine
  const allMessages = [
    contextPrompt,
    ...messages.map(msg => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`)
  ].join('\n\n');

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: allMessages,
      config: {
        responseMimeType: "application/json",
        maxOutputTokens: 4096, // Increased to handle longer responses
        responseSchema: CONTENT_MODIFICATION_SCHEMA,
      },
    });

    const cleanText = (response.text || "{}")
      .replace(/```json\n?|```/g, "")
      .trim();

    let raw: any;
    try {
      raw = JSON.parse(cleanText);
    } catch (parseError) {
      console.error("AI response parse error:", parseError);
      console.error("Raw response text:", response.text);
      console.error("Cleaned text:", cleanText);
      
      // Try to fix common JSON issues
      let fixedText = cleanText;
      
      // If JSON is truncated, try to complete it
      if (!fixedText.endsWith('}')) {
        // Count open braces
        const openBraces = (fixedText.match(/\{/g) || []).length;
        const closeBraces = (fixedText.match(/\}/g) || []).length;
        const missingBraces = openBraces - closeBraces;
        
        // If we're in the middle of a string, try to close it
        if (fixedText.match(/"[^"]*$/)) {
          fixedText = fixedText.replace(/"[^"]*$/, '""');
        }
        
        // Close any open objects/arrays
        if (missingBraces > 0) {
          fixedText += '}'.repeat(missingBraces);
        }
      }
      
      // Try to extract JSON from the response if it's wrapped in text
      const jsonMatch = fixedText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          raw = JSON.parse(jsonMatch[0]);
        } catch (retryError) {
          // Last resort: try to parse what we have and provide defaults
          console.warn("Could not parse JSON, using fallback");
          raw = {
            message: cleanText.includes('message') ? 
              cleanText.match(/"message"\s*:\s*"([^"]*)"/)?.[1] || 
              "I've processed your request, but encountered a formatting issue." :
              "I've processed your request.",
            shouldUpdate: cleanText.includes('shouldUpdate') && cleanText.includes('true'),
            questions: [],
            updatedText: cleanText.includes('updatedText') ? 
              cleanText.match(/"updatedText"\s*:\s*"([^"]*)"/)?.[1] : undefined
          };
        }
      } else {
        // Fallback: create a basic response
        raw = {
          message: "I've processed your request, but the response format was incomplete. Please try again.",
          shouldUpdate: false,
          questions: []
        };
      }
    }

    // Validate that we have the required fields
    if (!raw || typeof raw !== 'object') {
      throw new Error("AI response is not a valid object");
    }

    const result: AIResponse = {
      message: raw.message || "I understand your request.",
      shouldUpdate: raw.shouldUpdate === true, // Explicitly check for true
      updateFields: Array.isArray(raw.updateFields) ? raw.updateFields : [],
      questions: Array.isArray(raw.questions) ? raw.questions : [],
    };

    // If update is requested, build the updated content - ONLY include requested fields
    if (result.shouldUpdate && Array.isArray(result.updateFields)) {
      result.updatedContent = {};
      
      // Only update headline if explicitly requested
      if (result.updateFields.includes('headline') && raw.updatedHeadline) {
        // If headline is separate, we need to update the text structure
        // For now, we'll update the text field with the new headline
        const textParts = content.text.split('\n\n');
        const currentBody = textParts.slice(1).join('\n\n') || '';
        result.updatedContent.text = `${raw.updatedHeadline}\n\n${currentBody}`.trim();
      }
      
      // Only update body if explicitly requested
      if (result.updateFields.includes('body') && raw.updatedBody) {
        const textParts = content.text.split('\n\n');
        const currentHeadline = textParts[0] || '';
        result.updatedContent.text = currentHeadline ? `${currentHeadline}\n\n${raw.updatedBody}`.trim() : raw.updatedBody;
      }
      
      // Update full text if explicitly requested
      if (result.updateFields.includes('text') && raw.updatedText) {
        result.updatedContent.text = raw.updatedText;
      }
      
      // Image regeneration - store the prompt, will be handled separately
      if (result.updateFields.includes('image') && raw.imagePrompt) {
        result.imagePrompt = raw.imagePrompt;
      }
    } else if (result.shouldUpdate && (!result.updateFields || result.updateFields.length === 0)) {
      // If shouldUpdate is true but no updateFields, log a warning
      console.warn("AI indicated shouldUpdate=true but no updateFields provided");
      result.shouldUpdate = false;
      result.message = (result.message || "") + " (Note: Update requested but fields were not specified)";
    }

    return result;
  } catch (error: any) {
    console.error("AI chat error:", error);
    throw new Error(`AI chat failed: ${error.message || String(error)}`);
  }
}

