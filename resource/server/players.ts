import { online } from "@aicore-fivem/lib/server";
import { core } from "./content";

export const sourceOf = (charId: number) => core.GetSourceByCharId(charId);
export const nameOf = (source: number) => online.name(source);
