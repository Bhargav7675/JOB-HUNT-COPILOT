import type { LlmConfig } from "@/lib/llm";

export function profileLlm(profile: {
  openaiApiKey?: string | null;
  llmProvider?: string | null;
  llmModel?: string | null;
  llmBaseUrl?: string | null;
}): LlmConfig {
  return {
    apiKey: profile.openaiApiKey,
    provider: profile.llmProvider || "auto",
    model: profile.llmModel,
    baseUrl: profile.llmBaseUrl,
  };
}
