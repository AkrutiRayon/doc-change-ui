import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const InputSchema = z.object({
  query: z.string().min(1),
  mode: z.enum(["standard", "direct"]),
  context: z.string().default(""),
});

export const generateAiSummary = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");

    const systemPrompt =
      data.mode === "standard"
        ? `You are a technical writer. Using ONLY the provided code and change data, produce a concise product release summary in Markdown with these exact H3 sections in order:
### What Changed
### User Impact
### Security & Performance
Keep it tight (max ~180 words total). Do not invent facts beyond the provided context.`
        : `You answer the user's question using ONLY the provided code and change data. Be direct and specific. Cite file paths, commits, or authors when relevant. If the data does not contain the answer, say so plainly. Max ~180 words.`;

    const userPrompt =
      data.mode === "standard"
        ? `User query: ${data.query}\n\nChange data:\n${data.context}`
        : `Question: ${data.query}\n\nChange data:\n${data.context}`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": key,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`AI gateway error ${res.status}: ${text}`);
    }
    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    return { text: json.choices?.[0]?.message?.content ?? "" };
  });
