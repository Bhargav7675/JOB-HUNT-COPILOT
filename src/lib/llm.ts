export type LlmProvider = "auto" | "openai" | "anthropic";

export type LlmConfig = {
  apiKey?: string | null;
  provider?: LlmProvider | string | null;
  model?: string | null;
  baseUrl?: string | null;
};

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

function resolveKey(config: LlmConfig) {
  return (
    config.apiKey ||
    process.env.ANTHROPIC_API_KEY ||
    process.env.OPENAI_API_KEY ||
    process.env.LLM_API_KEY ||
    null
  );
}

export function detectProvider(config: LlmConfig): "openai" | "anthropic" {
  const explicit = (config.provider || "auto").toLowerCase();
  if (explicit === "anthropic" || explicit === "claude") return "anthropic";
  if (explicit === "openai") return "openai";

  const key = resolveKey(config) || "";
  if (key.startsWith("sk-ant-")) return "anthropic";
  return "openai";
}

function defaultModel(provider: "openai" | "anthropic", override?: string | null) {
  if (override?.trim()) return override.trim();
  if (provider === "anthropic") {
    return process.env.ANTHROPIC_MODEL || "claude-sonnet-4-20250514";
  }
  return process.env.OPENAI_MODEL || "gpt-4o-mini";
}

function extractJsonObject(text: string) {
  const trimmed = text.trim();
  if (trimmed.startsWith("{")) return trimmed;
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) return fenced[1].trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) return trimmed.slice(start, end + 1);
  return trimmed;
}

async function chatOpenAI(
  config: LlmConfig,
  messages: ChatMessage[],
  options: { temperature?: number; json?: boolean },
) {
  const key = resolveKey(config);
  if (!key) throw new Error("Missing LLM API key");

  const OpenAI = (await import("openai")).default;
  const client = new OpenAI({
    apiKey: key,
    baseURL: config.baseUrl || process.env.OPENAI_BASE_URL || undefined,
  });

  const completion = await client.chat.completions.create({
    model: defaultModel("openai", config.model),
    temperature: options.temperature ?? 0.3,
    ...(options.json ? { response_format: { type: "json_object" as const } } : {}),
    messages,
  });

  return completion.choices[0]?.message?.content?.trim() || "";
}

async function chatAnthropic(
  config: LlmConfig,
  messages: ChatMessage[],
  options: { temperature?: number; json?: boolean },
) {
  const key = resolveKey(config);
  if (!key) throw new Error("Missing LLM API key");

  const system = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
  const turnMessages = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role === "assistant" ? ("assistant" as const) : ("user" as const),
      content: m.content,
    }));

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: defaultModel("anthropic", config.model),
      max_tokens: 4096,
      temperature: options.temperature ?? 0.3,
      system: system
        ? options.json
          ? `${system}\n\nReturn valid JSON only, with no markdown fences.`
          : system
        : options.json
          ? "Return valid JSON only, with no markdown fences."
          : undefined,
      messages: turnMessages.length
        ? turnMessages
        : [{ role: "user", content: "Respond as requested." }],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Anthropic error ${res.status}: ${errText.slice(0, 240)}`);
  }

  const data = (await res.json()) as {
    content?: Array<{ type: string; text?: string }>;
  };
  return data.content?.filter((c) => c.type === "text").map((c) => c.text || "").join("\n").trim() || "";
}

export async function llmChat(
  config: LlmConfig,
  messages: ChatMessage[],
  options: { temperature?: number; json?: boolean } = {},
): Promise<string> {
  const key = resolveKey(config);
  if (!key) throw new Error("Missing LLM API key");

  const provider = detectProvider({ ...config, apiKey: key });
  if (provider === "anthropic") {
    return chatAnthropic(config, messages, options);
  }
  return chatOpenAI(config, messages, options);
}

export async function llmJson<T>(
  config: LlmConfig,
  messages: ChatMessage[],
  options: { temperature?: number } = {},
): Promise<T> {
  const raw = await llmChat(config, messages, { ...options, json: true });
  return JSON.parse(extractJsonObject(raw)) as T;
}

export function hasLlmKey(config: LlmConfig) {
  return Boolean(resolveKey(config));
}
