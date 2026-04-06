import { getProvider } from "@/lib/agent";

const cache = new Map<string, string>();

type TranslateOptions = {
  target: string; // "Mongolian", "English"
  source?: string; // optional
};

export async function translateText(
  text: string,
  options: TranslateOptions,
): Promise<string> {
  if (!text) return "";

  const { target, source } = options;

  const cacheKey = `${source || "auto"}:${target}:${text}`;
  if (cache.has(cacheKey)) {
    return cache.get(cacheKey)!;
  }

  try {
    const provider = await getProvider();

    const prompt = `
Translate the following text into ${target}.
${source ? `The source language is ${source}.` : ""}

Rules:
- Keep it natural and concise
- Preserve meaning exactly
- Do NOT explain
- Return ONLY the translated text

Text:
"${text}"
`;
    const res = await provider.generate(prompt);
    const output = res?.trim();
    if (!output) {
      return text;
    }
    cache.set(cacheKey, output);

    return output;
  } catch (err) {
    console.error("translateText error:", err);
    return text;
  }
}
