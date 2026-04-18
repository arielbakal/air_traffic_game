import { ATCResponseSchema, ATC_JSON_SCHEMA } from "./schema.ts";
import { buildRetryPrompt } from "./prompts.ts";
import { logError } from "./telemetry.ts";
import type { ATCResponse } from "./schema.ts";

const OLLAMA_HOST = process.env.OLLAMA_HOST ?? "http://localhost:11434";
const MODEL = process.env.OLLAMA_MODEL ?? "qwen3:8b";
const TEMPERATURE = parseFloat(process.env.OLLAMA_TEMPERATURE ?? "0.2");
const NUM_CTX = parseInt(process.env.OLLAMA_CTX ?? "4096");

export interface OllamaResult {
  response: ATCResponse;
  tokensIn: number;
  tokensOut: number;
  latencyMs: number;
}

async function callOllamaRaw(
  systemPrompt: string,
  userMessage: string,
): Promise<{ content: string; tokensIn: number; tokensOut: number }> {
  const body = {
    model: MODEL,
    think: false,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ],
    format: ATC_JSON_SCHEMA,
    options: { temperature: TEMPERATURE, num_ctx: NUM_CTX },
    stream: false,
  };

  const res = await fetch(`${OLLAMA_HOST}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(300_000),
  });

  if (!res.ok) {
    throw new Error(`Ollama HTTP ${res.status}: ${await res.text()}`);
  }

  const json = (await res.json()) as {
    message: { content: string };
    prompt_eval_count?: number;
    eval_count?: number;
  };

  return {
    content: json.message.content,
    tokensIn: json.prompt_eval_count ?? 0,
    tokensOut: json.eval_count ?? 0,
  };
}

export async function queryOllama(systemPrompt: string, situationReport: string): Promise<OllamaResult> {
  const start = Date.now();
  let raw: { content: string; tokensIn: number; tokensOut: number };

  raw = await callOllamaRaw(systemPrompt, situationReport);

  let parsed: ATCResponse;
  try {
    parsed = ATCResponseSchema.parse(JSON.parse(raw.content));
  } catch (firstErr) {
    // Single retry with correction prompt
    try {
      const retry = await callOllamaRaw(systemPrompt, buildRetryPrompt(raw.content, String(firstErr)));
      parsed = ATCResponseSchema.parse(JSON.parse(retry.content));
      raw.tokensIn += retry.tokensIn;
      raw.tokensOut += retry.tokensOut;
    } catch (retryErr) {
      logError("ollama schema retry", retryErr);
      throw new Error(`Schema validation failed after retry: ${String(retryErr)}`);
    }
  }

  return {
    response: parsed,
    tokensIn: raw.tokensIn,
    tokensOut: raw.tokensOut,
    latencyMs: Date.now() - start,
  };
}

export function getModelName(): string {
  return MODEL;
}

export function getOllamaHost(): string {
  return OLLAMA_HOST;
}
