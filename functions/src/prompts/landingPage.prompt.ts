/**
 * Parse the raw Gemini response text and extract either interview questions
 * (JSON code fence) or generated HTML (html code fence) plus a message.
 */
export function parseLandingPageResponse(text: string): {
  message: string;
  html: string | null;
  interview: { label: string; question: string; options: string[] }[] | null;
} {
  // Try to extract structured interview questions from ```json code fence
  const jsonMatch = text.match(/```json\s*\n([\s\S]*?)```/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[1]);
      if (Array.isArray(parsed.questions) && parsed.questions.length > 0) {
        return { message: "", html: null, interview: parsed.questions };
      }
    } catch {
      // JSON parse failed — fall through to normal handling
    }
  }

  // Extract HTML from ```html ... ``` code fence
  const htmlMatch = text.match(/```html\s*\n([\s\S]*?)```/);
  const html = htmlMatch ? htmlMatch[1].trim() : null;

  // Strip code fence from message to get just the conversational text
  const message = html
    ? text.replace(/```html\s*\n[\s\S]*?```/, "").trim() || "Here's your landing page!"
    : text;

  return { message, html, interview: null };
}

/**
 * Map a conversation history entry to Gemini-compatible content format.
 * Handles text, image data URLs, and role mapping (assistant → model).
 */
export function mapMessageToGeminiContent(msg: {
  role: string;
  content: string;
  images?: string[];
}): { role: string; parts: ({ text: string } | { inlineData: { mimeType: string; data: string } })[] } {
  const parts: ({ text: string } | { inlineData: { mimeType: string; data: string } })[] = [];
  if (msg.content) {
    parts.push({ text: msg.content });
  }
  if (msg.images && msg.images.length > 0) {
    for (const dataUrl of msg.images) {
      const match = dataUrl.match(/^data:(image\/[^;]+);base64,(.+)$/);
      if (match) {
        parts.push({ inlineData: { mimeType: match[1], data: match[2] } });
      }
    }
  }
  if (parts.length === 0) {
    parts.push({ text: "" });
  }
  return {
    role: msg.role === "assistant" ? "model" : "user",
    parts,
  };
}

export function buildLandingPageSystemPrompt(currentHtml?: string): string {
  let refinementBlock = "";
  if (currentHtml) {
    refinementBlock = `
CURRENT PAGE:
The user already has a landing page. They want to refine it. Here is the current HTML:
<current_page>
${currentHtml}
</current_page>

When the user asks for changes, return the FULL updated HTML with the requested modifications applied. Do not return partial snippets.
`;
  }

  return `You are an expert web designer and developer specializing in high-converting landing pages.

BEHAVIOR:
- On the user's FIRST message (when no current page exists), return ONLY a JSON object inside a \`\`\`json code fence with 3-4 clarifying questions. Each question must have 3-4 contextually relevant suggested answers tailored to what the user described. Include a short label for each question.
  Format:
  \`\`\`json
  {
    "questions": [
      {
        "label": "Target audience",
        "question": "Who is the primary target audience for this page?",
        "options": ["Option A", "Option B", "Option C", "Option D"]
      }
    ]
  }
  \`\`\`
  Questions should cover: target audience, desired tone/style, key features to highlight, and color/visual preferences.
  Do NOT include any text outside the JSON code fence on the first message.
- When the user provides their preferences (answers to those questions), generate a complete landing page.
- When refining an existing page, apply the requested changes and return the full updated HTML.

OUTPUT FORMAT:
- When generating or updating a page, include the complete HTML inside a single \`\`\`html code fence.
- You may include a brief explanation before or after the code fence.

HTML REQUIREMENTS:
- The page must be fully self-contained in a single HTML file.
- Use inline <style> tags for all CSS. No external CSS frameworks (no Tailwind CDN, no Bootstrap CDN).
- You may include Google Fonts via a <link> tag from fonts.googleapis.com.
- No external <script> fetches. Minimal inline <script> is acceptable for interactions (e.g., smooth scrolling, mobile menu toggle).
- The page must be responsive (mobile-friendly).
- Include these sections: hero with headline and CTA, features/benefits, social proof or testimonials, a final call-to-action, and a footer.
- Use modern design: clean typography, generous whitespace, subtle gradients or shadows, and consistent color scheme.
${refinementBlock}`;
}
