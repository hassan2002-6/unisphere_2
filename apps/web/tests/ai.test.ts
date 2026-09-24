import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { aiStatus, callLLM, resolveProvider } from "@/server/ai/provider";
import { buildSystemPrompt } from "@/server/ai/retrieval";
import { parseSources } from "@/server/ai/assistant";

const KEYS = ["GROQ_API_KEY", "OPENAI_API_KEY", "OPENROUTER_API_KEY", "AI_API_KEY", "AI_BASE_URL", "AI_MODEL"];
let saved: Record<string, string | undefined> = {};

beforeEach(() => {
  saved = {};
  for (const k of KEYS) {
    saved[k] = process.env[k];
    delete process.env[k];
  }
});

afterEach(() => {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

describe("provider resolution", () => {
  it("reports offline with no keys", () => {
    expect(resolveProvider()).toBeNull();
    expect(aiStatus()).toEqual({ configured: false, provider: "offline", model: "canned-fallback" });
  });

  it("prefers groq when GROQ_API_KEY is set", () => {
    process.env.GROQ_API_KEY = "test-key";
    const p = resolveProvider();
    expect(p?.name).toBe("groq");
    expect(p?.baseUrl).toContain("groq.com");
  });

  it("honours AI_MODEL for the selected provider", () => {
    process.env.GROQ_API_KEY = "test-key";
    process.env.AI_MODEL = "llama-3.1-8b-instant";
    expect(resolveProvider()?.model).toBe("llama-3.1-8b-instant");
  });

  it("falls back to a custom OpenAI-compatible endpoint", () => {
    process.env.AI_API_KEY = "k";
    process.env.AI_BASE_URL = "http://localhost:11434/v1";
    const p = resolveProvider();
    expect(p?.name).toBe("custom");
    expect(p?.baseUrl).toBe("http://localhost:11434/v1");
  });
});

describe("canned fallback", () => {
  it("returns an honest fallback without any provider", async () => {
    const res = await callLLM([{ role: "user", content: "hi" }], ["Clash policy: report within 48h."]);
    expect(res.fallback).toBe(true);
    expect(res.text).toContain("without an API key");
    expect(res.text).toContain("Clash policy");
  });

  it("never invents content when context is empty", async () => {
    const res = await callLLM([{ role: "user", content: "hi" }], []);
    expect(res.fallback).toBe(true);
    expect(res.text).toContain("Nothing matched");
  });
});

describe("system prompt grounding", () => {
  it("includes grounding rules, citations and both context blocks", () => {
    const prompt = buildSystemPrompt(["2 unread notifications."], [
      { title: "Clash policy", source: "Student handbook", snippet: "Report clashes within 48 hours." },
    ]);
    expect(prompt).toContain("GROUNDING RULES");
    expect(prompt).toContain("[1] Clash policy");
    expect(prompt).toContain("2 unread notifications.");
    expect(prompt).toContain("Never invent dates");
  });

  it("marks empty state explicitly", () => {
    const prompt = buildSystemPrompt([], []);
    expect(prompt).toContain("(no matching knowledge-base entries)");
    expect(prompt).toContain("(no personal data available)");
  });
});

describe("source parsing", () => {
  it("keeps well-formed sources and drops junk", () => {
    const parsed = parseSources([
      { title: "A", source: "handbook", snippet: "text" },
      { title: "", source: "", snippet: "" },
      "nonsense",
      null,
      { title: "B" },
    ]);
    expect(parsed).toHaveLength(2);
    expect(parsed[0].title).toBe("A");
    expect(parsed[1].source).toBe("");
  });

  it("returns [] for non-arrays", () => {
    expect(parseSources(null)).toEqual([]);
    expect(parseSources("x")).toEqual([]);
  });
});
