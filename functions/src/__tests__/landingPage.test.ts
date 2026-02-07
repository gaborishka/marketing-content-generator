import { describe, it, expect } from "vitest";
import { buildLandingPageSystemPrompt } from "../prompts/landingPage.prompt";

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
