import {
  AdminWorld,
  callAction,
  GlobalGroup,
  stateBoolean,
} from "@aicore-fivem/lib/client";
import { OWNED_PREFIX, readInterior, readSettings } from "common/property";

export const owned = new GlobalGroup(OWNED_PREFIX, stateBoolean);

export const world = new AdminWorld(["settings", "properties", "interiors"]);
export const content = {
  settings: world.view("settings", readSettings),
  interiors: world.records("interiors", readInterior),
};
export const FALLBACK = { fallback: "PROP_ERR_FAR" };
export const call = (name: string, args: unknown[] = []) =>
  callAction(name, args, FALLBACK);
