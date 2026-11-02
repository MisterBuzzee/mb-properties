import {
  bool,
  int,
  readBlipStyle,
  record,
  str,
  vec4,
  type Vec4,
} from "@aicore-fivem/lib/shared";

/** mb-properties' contracts and panel content. No natives. */

export const EVENTS = {
  /** Callback: () -> { ok, list: Array<{ id, access }> } the properties the player owns or holds a key to (the session snapshot). */
  mine: "mb-properties:mine",
  /** Server -> player: (id, access: "owner" | "key" | false) the player's access to a property changed. */
  access: "mb-properties:client:access",
  /** Callback: (id) -> { ok } buys the property at its door. */
  buy: "mb-properties:buy",
  /** Callback: (id) -> { ok } enters the property's interior (the move arrives as `inside`). */
  enter: "mb-properties:enter",
  /** Callback: () -> { ok } leaves the interior through the door. */
  exit: "mb-properties:exit",
  /** Callback: () -> { ok } opens the stash of the property the player is in. */
  stash: "mb-properties:stash",
  /** Callback: () -> { ok, keys: Array<{ charId, name }> } the key holders of the property the player owns and is in. */
  keys: "mb-properties:keys",
  /** Callback: () -> { ok } gives a key to the closest player inside. */
  giveKey: "mb-properties:giveKey",
  /** Callback: (charId) -> { ok } takes a key back. */
  takeKey: "mb-properties:takeKey",
  /** Callback: () -> { ok } sells the property the player owns and is in. */
  sell: "mb-properties:sell",
  /** Callback: (name, x, y, z, heading) -> { ok } buys and places a furniture item (deducts money, persists). */
  buyFurniture: "mb-properties:buyFurniture",
  /** Server -> player: (id | null, items) placed furniture in the property (or cleared on exit). */
  furniture: "mb-properties:client:furniture",
  /** Server -> player: (id | null, to: Vec4) the player is inside this property now (or left): teleport to `to`. */
  inside: "mb-properties:client:inside",
} as const;

/** GlobalState prefix of a property that has an owner (`prop:<id>`, true). */
export const OWNED_PREFIX = "prop:";
/** ai-core metadata key: the property a character is inside (a character that left the game inside comes back at its door). */
export const INSIDE_META = "property";

export type Access = "owner" | "key";

export interface Settings {
  account: string;
  /** Percent of the price paid back on a sale. */
  sellPercent: number;
  policeJobs: string[];
  /** On-duty police can enter any property. */
  policeEnter: boolean;
  stashSlots: number;
  stashWeight: number;
  /** Map blip of the player's own properties and of properties for sale. */
  ownedBlip: BlipStyle;
  saleBlip: BlipStyle;
}

export interface BlipStyle {
  sprite: number;
  color: number;
  scale: number;
}

export function readSettings(raw: unknown): Settings {
  const v = record(raw);
  const jobs = Array.isArray(v.policeJobs)
    ? v.policeJobs.filter((j): j is string => typeof j === "string")
    : [];
  return {
    account: str(v.account, "bank", 32),
    sellPercent: int(v.sellPercent, 50, 0, 100),
    policeJobs: jobs.length > 0 ? jobs : ["police"],
    policeEnter: bool(v.policeEnter, true),
    stashSlots: int(v.stashSlots, 40, 1, 200),
    stashWeight: int(v.stashWeight, 150_000, 1000, 10_000_000),
    ownedBlip: readBlipStyle(v.ownedBlip, { sprite: 40, color: 2, scale: 0.7 }),
    saleBlip: readBlipStyle(v.saleBlip, { sprite: 350, color: 0, scale: 0.7 }),
  };
}

export interface Interior {
  id: string;
  label: string;
  entry: Vec4;
}

const ZERO = { x: 0, y: 0, z: 0, heading: 0 };

/** One interior record (`panel.records` / `world.records`). */
export function readInterior(id: string, v: Record<string, unknown>): Interior {
  return { id, label: str(v.label, id, 48), entry: vec4(v.entry, ZERO) };
}

export interface Property {
  id: string;
  label: string;
  door: Vec4;
  interior: string;
  price: number;
  blip: boolean;
}

export interface Furniture {
  id: string;
  label: string;
  model: string;
  price: number;
  category: string;
}

export function readFurniture(id: string, v: Record<string, unknown>): Furniture {
  return {
    id,
    label: str(v.label, id, 48),
    model: str(v.model, "prop_table_01", 64),
    price: int(v.price, 0, 0),
    category: str(v.category, "misc", 24),
  };
}

/** One property record (`panel.records` / `world.records`). */
export function readProperty(id: string, v: Record<string, unknown>): Property {
  return {
    id,
    label: str(v.label, id, 48),
    door: vec4(v.door, ZERO),
    interior: str(v.interior, "low", 48),
    price: int(v.price, 0, 0),
    blip: bool(v.blip, false),
  };
}
