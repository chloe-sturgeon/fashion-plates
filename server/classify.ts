import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import {
  CATEGORIES,
  COLOR_FAMILIES,
  PATTERNS,
  SEASONS,
  type AnalyzeResult,
} from "../shared/types.ts";

const MODEL = process.env.CLAUDE_MODEL ?? "claude-opus-5-5";

const ClassificationSchema = z.object({
  is_clothing: z.boolean().describe("False if the photo does not show a wearable clothing item or accessory."),
  category: z.enum(CATEGORIES),
  subcategory: z.string().describe('Specific garment type, e.g. "t-shirt", "wide-leg jeans", "ankle boots".'),
  name: z.string().describe('Short display name, 2-5 words, e.g. "Navy striped linen shirt".'),
  colors: z
    .array(
      z.object({
        name: z.string().describe('Descriptive color name, e.g. "dusty rose", "olive".'),
        hex: z.string().describe("Representative sRGB hex color, #rrggbb."),
        family: z.enum(COLOR_FAMILIES),
      }),
    )
    .describe("1 to 4 colors in order of how much of the garment they cover."),
  pattern: z.enum(PATTERNS),
  material: z.string().describe('Best guess at fabric or material, e.g. "denim", "knit wool", "leather".'),
  style_tags: z.array(z.string()).describe('3-6 lowercase style words, e.g. "casual", "boho", "minimalist".'),
  seasons: z.array(z.enum(SEASONS)),
  occasions: z.array(z.string()).describe('Lowercase, e.g. "work", "date night", "weekend".'),
  features: z
    .array(z.string())
    .describe('Lowercase distinguishing details useful for search: neckline, sleeve length, fit, length, closures, embellishments.'),
  description: z.string().describe("One or two sentences describing the item."),
});

const SYSTEM = `You catalog clothing for a personal virtual closet app. The user photographs one item at a time
(laid flat, on a hanger, or worn). Identify that single main item and describe it so it can be searched later.

Category rules:
- top: shirts, blouses, t-shirts, sweaters, tanks, bodysuits, hoodies
- jacket: coats, blazers, cardigans, vests and any outer layer
- dress: dresses and jumpsuits/rompers
- pants: trousers, jeans, shorts, leggings
- skirt, shoes, hat, belt, scarf: as named
If the item fits none of these well, pick the closest one.

Colors: report the garment's own colors (ignore the background, hanger, and skin). Hex values should match how the
fabric actually looks in the photo.`;

let client: Anthropic | null = null;
function getClient(): Anthropic {
  client ??= new Anthropic();
  return client;
}

export class ClassifyError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

export async function classifyClothing(image: Buffer, mediaType: "image/jpeg" | "image/png" | "image/webp"): Promise<AnalyzeResult> {
  let response;
  try {
    response = await getClient().beta.messages.parse({
      model: MODEL,
      max_tokens: 4000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: {
        effort: "low",
        format: betaZodOutputFormat(ClassificationSchema),
      },
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType, data: image.toString("base64") } },
            { type: "text", text: "Catalog this clothing item." },
          ],
        },
      ],
    });
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      throw new ClassifyError("AI tagging is not configured: set ANTHROPIC_API_KEY on the server.", 503);
    } else if (err instanceof Anthropic.RateLimitError) {
      throw new ClassifyError("AI tagging is busy right now. Try again in a moment, or tag the item by hand.", 429);
    } else if (err instanceof Anthropic.APIError) {
      throw new ClassifyError(`AI tagging failed (${err.status}): ${err.message}`, 502);
    } else if (err instanceof Error && /api.?key|auth/i.test(err.message)) {
      // The SDK throws a plain Error when no credentials can be found at all.
      throw new ClassifyError("AI tagging is not configured: set ANTHROPIC_API_KEY on the server.", 503);
    }
    throw err;
  }

  if (response.stop_reason === "refusal") {
    throw new ClassifyError("The AI declined to describe this image. Please tag it by hand.", 422);
  }
  const out = response.parsed_output;
  if (!out) {
    throw new ClassifyError("The AI response could not be read. Please tag it by hand.", 502);
  }

  return {
    isClothing: out.is_clothing,
    attributes: {
      name: out.name,
      category: out.category,
      subcategory: out.subcategory,
      colors: out.colors.slice(0, 4).map((c) => ({ ...c, hex: normalizeHex(c.hex) })),
      pattern: out.pattern,
      material: out.material,
      styleTags: out.style_tags,
      seasons: out.seasons,
      occasions: out.occasions,
      features: out.features,
      description: out.description,
    },
  };
}

function normalizeHex(hex: string): string {
  const m = hex.trim().match(/^#?([0-9a-f]{6}|[0-9a-f]{3})$/i);
  if (!m) return "#888888";
  const h = m[1].length === 3 ? [...m[1]].map((c) => c + c).join("") : m[1];
  return `#${h.toLowerCase()}`;
}
