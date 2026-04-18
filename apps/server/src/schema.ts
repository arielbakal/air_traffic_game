import { z } from "zod";

const BaseCommand = { callsign: z.string().min(1).max(10), reasoning: z.string() };

export const ATCCommandSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("heading"), ...BaseCommand, value: z.number().int().min(0).max(359) }),
  z.object({ type: z.literal("altitude"), ...BaseCommand, value: z.number().int().min(0).max(45000).multipleOf(100) }),
  z.object({ type: z.literal("speed"), ...BaseCommand, value: z.number().int().min(100).max(500) }),
  z.object({ type: z.literal("approach"), ...BaseCommand, runway: z.string() }),
  z.object({ type: z.literal("hold"), ...BaseCommand }),
  z.object({ type: z.literal("goAround"), ...BaseCommand }),
  z.object({ type: z.literal("takeoff"), ...BaseCommand, runway: z.string() }),
  z.object({ type: z.literal("noop"), reasoning: z.string(), callsign: z.string().optional() }),
]);

export const ATCResponseSchema = z.object({
  situation_assessment: z.string().min(1),
  commands: z.array(ATCCommandSchema).max(5),
});

export type ATCCommand = z.infer<typeof ATCCommandSchema>;
export type ATCResponse = z.infer<typeof ATCResponseSchema>;

export const ATC_JSON_SCHEMA = {
  type: "object",
  properties: {
    situation_assessment: { type: "string", description: "Brief assessment of current traffic situation" },
    commands: {
      type: "array",
      maxItems: 5,
      items: {
        type: "object",
        properties: {
          type: { type: "string", enum: ["heading", "altitude", "speed", "approach", "hold", "goAround", "takeoff", "noop"] },
          callsign: { type: "string" },
          value: { type: "number" },
          runway: { type: "string" },
          reasoning: { type: "string" },
        },
        required: ["type", "callsign", "runway", "value", "reasoning"],
      },
    },
  },
  required: ["situation_assessment", "commands"],
};
