import { BLIP_STYLE_FIELDS } from "@aicore-fivem/lib/shared";

export const blip = {
  type: "object",
  optional: true,
  fields: BLIP_STYLE_FIELDS,
} as const;
