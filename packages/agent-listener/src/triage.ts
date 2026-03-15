import type { Config } from "./config.js";

export interface TriageResult {
  /** 1 (noise) to 5 (critical) */
  severity: number;
  /** One-line summary */
  summary: string;
  /** What to investigate if escalated */
  hint: string;
  /** Whether to escalate to Claude for deep analysis */
  escalate: boolean;
}

/**
 * Fast triage via Groq (OpenAI-compatible API).
 * Classifies the exception/breakpoint and decides if it's worth a deep dive.
 *
 * ~$0.0006 per call with Llama 3.3 70B.
 */
export async function triage(
  state: unknown,
  reason: string,
  config: Config,
): Promise<TriageResult> {
  const prompt = `You are a debug triage bot. Analyze this ${reason} and respond with ONLY valid JSON, no markdown.

Debug state:
${JSON.stringify(state, null, 2)}

Respond with exactly this JSON format:
{"severity": <1-5>, "summary": "<one line>", "hint": "<what to investigate>", "escalate": <true/false>}

Severity guide:
1 = noise (expected error, handled exception, test assertion)
2 = low (minor, non-blocking, known pattern)
3 = medium (unexpected but contained, worth investigating)
4 = high (data corruption risk, unhandled error in critical path)
5 = critical (crash, security issue, data loss)

Set escalate=true if severity >= ${config.escalationThreshold}.`;

  const response = await fetch(`${config.groqBaseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.groqApiKey}`,
    },
    body: JSON.stringify({
      model: config.groqModel,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1,
      max_tokens: 200,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Groq API error ${response.status}: ${text}`);
  }

  const data = (await response.json()) as {
    choices: Array<{ message: { content: string } }>;
  };

  const raw = data.choices[0]?.message?.content ?? "";

  try {
    // Extract JSON from the response (handle markdown fences)
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found");
    const parsed = JSON.parse(jsonMatch[0]) as TriageResult;

    return {
      severity: Math.max(1, Math.min(5, parsed.severity ?? 3)),
      summary: parsed.summary ?? "Unknown issue",
      hint: parsed.hint ?? "",
      escalate: parsed.escalate ?? parsed.severity >= config.escalationThreshold,
    };
  } catch {
    // Fallback if Groq returns garbage — escalate to be safe
    return {
      severity: 3,
      summary: `${reason} (triage parse failed)`,
      hint: raw.slice(0, 200),
      escalate: true,
    };
  }
}
