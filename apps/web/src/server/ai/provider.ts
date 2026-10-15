/**
 * Provider-agnostic LLM adapter (plan M5). Groq is the default free-tier
 * provider; any OpenAI-compatible endpoint works via AI_BASE_URL + AI_API_KEY.
 * If no key is configured (or the call fails) we return an honest canned
 * fallback rather than hallucinating — the demo stays useful offline.
 */

export type ChatMsg = { role: "system" | "user" | "assistant"; content: string };

export type LLMResult = {
  text: string;
  provider: string;
  model: string;
  fallback: boolean;
  tokens?: number;
};

type ProviderConfig = { name: string; baseUrl: string; apiKey: string; model: string };

export function resolveProvider(): ProviderConfig | null {
  // Explicit offline mode (demos without network): AI_FALLBACK_MODE=1 answers
  // from the knowledge base only.
  if (process.env.AI_FALLBACK_MODE === "1") return null;

  // CommandCode (project default) — OpenAI-compatible, model ids like
  // "deepseek/deepseek-v4.1-flash". Base URL overridable for self-hosting.
  const cc = process.env.COMMANDCODE_API_KEY;
  if (cc) {
    return {
      name: "commandcode",
      baseUrl: (process.env.COMMANDCODE_BASE_URL ?? "https://api.commandcode.ai/provider/v1").replace(/\/$/, ""),
      apiKey: cc,
      model: process.env.AI_MODEL ?? "deepseek/deepseek-v4.1-flash",
    };
  }
  const groq = process.env.GROQ_API_KEY;
  if (groq) {
    return {
      name: "groq",
      baseUrl: "https://api.groq.com/openai/v1",
      apiKey: groq,
      model: process.env.AI_MODEL ?? "llama-3.3-70b-versatile",
    };
  }
  const openai = process.env.OPENAI_API_KEY;
  if (openai) {
    return {
      name: "openai",
      baseUrl: "https://api.openai.com/v1",
      apiKey: openai,
      model: process.env.AI_MODEL ?? "gpt-4o-mini",
    };
  }
  const openrouter = process.env.OPENROUTER_API_KEY;
  if (openrouter) {
    return {
      name: "openrouter",
      baseUrl: "https://openrouter.ai/api/v1",
      apiKey: openrouter,
      model: process.env.AI_MODEL ?? "meta-llama/llama-3.3-70b-instruct",
    };
  }
  const generic = process.env.AI_API_KEY;
  const base = process.env.AI_BASE_URL;
  if (generic && base) {
    return { name: "custom", baseUrl: base, apiKey: generic, model: process.env.AI_MODEL ?? "default" };
  }
  return null;
}

export function aiStatus(): { configured: boolean; provider: string; model: string } {
  const provider = resolveProvider();
  return provider
    ? { configured: true, provider: provider.name, model: provider.model }
    : { configured: false, provider: "offline", model: "canned-fallback" };
}

function cannedReply(context: string[]): string {
  const top = context.slice(0, 3).map((c, i) => `[${i + 1}] ${c}`).join("\n\n");
  return [
    "The AI service is running without an API key right now, so I can't compose a fresh answer.",
    "Here's what I found in the university knowledge base for your question:",
    "",
    top || "Nothing matched in the knowledge base — try rephrasing, or contact the coordination office.",
    "",
    "(Set GROQ_API_KEY in the environment to enable full AI answers.)",
  ].join("\n");
}

/** Max time we wait for a provider before falling back. */
const TIMEOUT_MS = 25_000;

async function oneShot(
  provider: NonNullable<ReturnType<typeof resolveProvider>>,
  messages: ChatMsg[],
  contextForFallback: string[],
): Promise<LLMResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${provider.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${provider.apiKey}`,
      },
      body: JSON.stringify({
        model: provider.model,
        messages,
        temperature: 0.2,
        max_tokens: 900,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`provider ${provider.name} responded ${res.status}: ${body.slice(0, 300)}`);
    }

    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
      usage?: { total_tokens?: number };
    };
    const text = data.choices?.[0]?.message?.content?.trim();
    if (!text) throw new Error(`provider ${provider.name} returned an empty completion`);

    return {
      text,
      provider: provider.name,
      model: provider.model,
      fallback: false,
      tokens: data.usage?.total_tokens,
    };
  } catch (e) {
    throw e instanceof Error ? e : new Error(String(e));
  } finally {
    clearTimeout(timer);
  }
}

/**
 * One transparent retry (spec §9 — safe retries): a single timeout, network
 * blip or 5xx should not silently degrade the assistant to its offline answer.
 * 4xx responses (bad key, bad request) are permanent and fail fast.
 */
export async function callLLM(messages: ChatMsg[], contextForFallback: string[] = []): Promise<LLMResult> {
  const provider = resolveProvider();
  if (!provider) {
    return { text: cannedReply(contextForFallback), provider: "offline", model: "canned-fallback", fallback: true };
  }
  for (let attempt = 1; ; attempt++) {
    try {
      return await oneShot(provider, messages, contextForFallback);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      const permanent = /responded 4(?!29)\d\d/.test(message);
      if (attempt >= 2 || permanent) {
        console.error(`[ai] provider call failed (attempt ${attempt}):`, message);
        return { text: cannedReply(contextForFallback), provider: provider.name, model: provider.model, fallback: true };
      }
      await new Promise((resolve) => setTimeout(resolve, 700));
    }
  }
}
