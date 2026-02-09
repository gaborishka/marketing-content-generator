import { describe, it, expect } from "vitest";
import {
  buildLandingPageSystemPrompt,
  parseLandingPageResponse,
  mapMessageToGeminiContent,
} from "../prompts/landingPage.prompt";

// ── buildLandingPageSystemPrompt ─────────────────────────────────────────────

describe("buildLandingPageSystemPrompt", () => {
  it("includes key instructions in the base prompt", () => {
    const prompt = buildLandingPageSystemPrompt();

    expect(prompt).toContain("self-contained");
    expect(prompt).toContain("Google Fonts");
    expect(prompt).toContain("```html");
    expect(prompt).toContain("inline <style>");
  });

  it("instructs structured JSON questions for first message", () => {
    const prompt = buildLandingPageSystemPrompt();

    expect(prompt).toContain("```json");
    expect(prompt).toContain('"questions"');
    expect(prompt).toContain('"label"');
    expect(prompt).toContain('"options"');
  });

  it("covers required question topics", () => {
    const prompt = buildLandingPageSystemPrompt();

    expect(prompt).toContain("target audience");
    expect(prompt).toContain("tone/style");
    expect(prompt).toContain("features");
    expect(prompt).toContain("color");
  });

  it("does not include refinement block when no currentHtml", () => {
    const prompt = buildLandingPageSystemPrompt();

    expect(prompt).not.toContain("<current_page>");
    expect(prompt).not.toContain("CURRENT PAGE");
  });

  it("does not include refinement block for undefined", () => {
    const prompt = buildLandingPageSystemPrompt(undefined);

    expect(prompt).not.toContain("<current_page>");
  });

  it("includes refinement block with currentHtml when provided", () => {
    const html = "<html><body><h1>Hello</h1></body></html>";
    const prompt = buildLandingPageSystemPrompt(html);

    expect(prompt).toContain("<current_page>");
    expect(prompt).toContain(html);
    expect(prompt).toContain("CURRENT PAGE");
    expect(prompt).toContain("refine");
  });

  it("includes required landing page sections", () => {
    const prompt = buildLandingPageSystemPrompt();

    expect(prompt).toContain("hero");
    expect(prompt).toContain("features");
    expect(prompt).toContain("testimonials");
    expect(prompt).toContain("call-to-action");
    expect(prompt).toContain("footer");
  });

  it("prohibits external CSS frameworks", () => {
    const prompt = buildLandingPageSystemPrompt();

    expect(prompt).toContain("No external CSS frameworks");
  });
});

// ── parseLandingPageResponse ─────────────────────────────────────────────────

describe("parseLandingPageResponse", () => {
  it("extracts interview questions from JSON code fence", () => {
    const text = '```json\n{\n  "questions": [\n    { "label": "Audience", "question": "Who is the target?", "options": ["A", "B", "C"] }\n  ]\n}\n```';
    const result = parseLandingPageResponse(text);

    expect(result.interview).toHaveLength(1);
    expect(result.interview![0].label).toBe("Audience");
    expect(result.interview![0].options).toEqual(["A", "B", "C"]);
    expect(result.message).toBe("");
    expect(result.html).toBeNull();
  });

  it("extracts multiple interview questions", () => {
    const questions = [
      { label: "Audience", question: "Who?", options: ["A", "B"] },
      { label: "Style", question: "What style?", options: ["Modern", "Classic"] },
      { label: "Color", question: "What color?", options: ["Blue", "Red", "Green"] },
    ];
    const text = "```json\n" + JSON.stringify({ questions }) + "\n```";
    const result = parseLandingPageResponse(text);

    expect(result.interview).toHaveLength(3);
    expect(result.interview![0].label).toBe("Audience");
    expect(result.interview![2].label).toBe("Color");
  });

  it("extracts HTML from html code fence", () => {
    const html = "<html><body><h1>My Page</h1></body></html>";
    const text = `Here is your page:\n\n\`\`\`html\n${html}\n\`\`\`\n\nLet me know if you want changes.`;
    const result = parseLandingPageResponse(text);

    expect(result.html).toBe(html);
    expect(result.interview).toBeNull();
    expect(result.message).not.toContain("```html");
    expect(result.message).toContain("Here is your page:");
  });

  it("returns default message when HTML is present but no surrounding text", () => {
    const text = "```html\n<html><body>Hello</body></html>\n```";
    const result = parseLandingPageResponse(text);

    expect(result.html).toBe("<html><body>Hello</body></html>");
    expect(result.message).toBe("Here's your landing page!");
  });

  it("returns plain text when no code fences are present", () => {
    const text = "I need more details about your project. Can you describe the target audience?";
    const result = parseLandingPageResponse(text);

    expect(result.message).toBe(text);
    expect(result.html).toBeNull();
    expect(result.interview).toBeNull();
  });

  it("handles empty response text", () => {
    const result = parseLandingPageResponse("");

    expect(result.message).toBe("");
    expect(result.html).toBeNull();
    expect(result.interview).toBeNull();
  });

  it("falls through to normal handling when JSON is invalid", () => {
    const text = "```json\n{ invalid json }\n```\n\nSome text here.";
    const result = parseLandingPageResponse(text);

    expect(result.interview).toBeNull();
    expect(result.message).toContain("Some text here.");
  });

  it("falls through when JSON has empty questions array", () => {
    const text = '```json\n{ "questions": [] }\n```\n\nNo questions needed.';
    const result = parseLandingPageResponse(text);

    expect(result.interview).toBeNull();
    expect(result.message).toContain("No questions needed.");
  });

  it("falls through when JSON has no questions key", () => {
    const text = '```json\n{ "other": "data" }\n```\n\nPlain response.';
    const result = parseLandingPageResponse(text);

    expect(result.interview).toBeNull();
  });

  it("prefers JSON interview over HTML when both are present", () => {
    const text =
      '```json\n{ "questions": [{ "label": "Q", "question": "Q?", "options": ["A"] }] }\n```\n\n```html\n<html></html>\n```';
    const result = parseLandingPageResponse(text);

    expect(result.interview).toHaveLength(1);
    expect(result.html).toBeNull();
  });

  it("trims whitespace from extracted HTML", () => {
    const text = "```html\n   <html><body>Hi</body></html>   \n```";
    const result = parseLandingPageResponse(text);

    expect(result.html).toBe("<html><body>Hi</body></html>");
  });
});

// ── mapMessageToGeminiContent ────────────────────────────────────────────────

describe("mapMessageToGeminiContent", () => {
  it("maps user role to user", () => {
    const result = mapMessageToGeminiContent({ role: "user", content: "hello" });
    expect(result.role).toBe("user");
  });

  it("maps assistant role to model", () => {
    const result = mapMessageToGeminiContent({ role: "assistant", content: "hi" });
    expect(result.role).toBe("model");
  });

  it("includes text content as a text part", () => {
    const result = mapMessageToGeminiContent({ role: "user", content: "Build a SaaS page" });
    expect(result.parts).toEqual([{ text: "Build a SaaS page" }]);
  });

  it("parses base64 image data URLs into inlineData parts", () => {
    const dataUrl = "data:image/png;base64,iVBORw0KGgo=";
    const result = mapMessageToGeminiContent({
      role: "user",
      content: "Use this design",
      images: [dataUrl],
    });

    expect(result.parts).toHaveLength(2);
    expect(result.parts[0]).toEqual({ text: "Use this design" });
    expect(result.parts[1]).toEqual({
      inlineData: { mimeType: "image/png", data: "iVBORw0KGgo=" },
    });
  });

  it("handles multiple images", () => {
    const images = [
      "data:image/jpeg;base64,/9j/4AAQ=",
      "data:image/png;base64,iVBORw0=",
    ];
    const result = mapMessageToGeminiContent({
      role: "user",
      content: "Compare these",
      images,
    });

    expect(result.parts).toHaveLength(3);
    expect(result.parts[1]).toEqual({
      inlineData: { mimeType: "image/jpeg", data: "/9j/4AAQ=" },
    });
    expect(result.parts[2]).toEqual({
      inlineData: { mimeType: "image/png", data: "iVBORw0=" },
    });
  });

  it("skips images that are not valid data URLs", () => {
    const result = mapMessageToGeminiContent({
      role: "user",
      content: "text",
      images: ["not-a-data-url", "https://example.com/img.png"],
    });

    expect(result.parts).toHaveLength(1);
    expect(result.parts[0]).toEqual({ text: "text" });
  });

  it("adds empty text part when message has no content and no images", () => {
    const result = mapMessageToGeminiContent({ role: "user", content: "" });

    expect(result.parts).toEqual([{ text: "" }]);
  });

  it("handles message with only images (no text content)", () => {
    const result = mapMessageToGeminiContent({
      role: "user",
      content: "",
      images: ["data:image/png;base64,abc123"],
    });

    // No text part since content is empty, only image part
    expect(result.parts).toHaveLength(1);
    expect(result.parts[0]).toEqual({
      inlineData: { mimeType: "image/png", data: "abc123" },
    });
  });

  it("handles undefined images array", () => {
    const result = mapMessageToGeminiContent({
      role: "user",
      content: "hello",
      images: undefined,
    });

    expect(result.parts).toEqual([{ text: "hello" }]);
  });

  it("handles empty images array", () => {
    const result = mapMessageToGeminiContent({
      role: "user",
      content: "hello",
      images: [],
    });

    expect(result.parts).toEqual([{ text: "hello" }]);
  });
});
