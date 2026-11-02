import {
  aiLog,
  inventory,
  nearestPlayerTo,
  notify,
  onClientCallback,
  online,
} from "@aicore-fivem/lib/server";
import { fail, oneArg, readId, readText } from "@aicore-fivem/lib/shared";
import { Locale } from "common";
import { EVENTS, type Property } from "common/property";
import { content, core } from "./content";
import { createLogger } from "@aicore-fivem/lib/shared";
import { mysql } from "@aicore-fivem/mysql";
import { inside, interiors } from "./interiors";
import { nameOf, sourceOf } from "./players";
import { owners, sendAccess } from "./store";

const log = createLogger("mb-properties");

/** The property the player is in, when they own it. */
function ownedInside(source: number): Property | null {
  const id = inside.get(source);
  const charId = online.charId(source);
  const property = id ? content.properties.get(id) : undefined;
  return property &&
    charId !== undefined &&
    owners.accessOf(property.id, charId) === "owner"
    ? property
    : null;
}

onClientCallback(EVENTS.stash, (source) => {
  const id = inside.get(source);
  const property = id ? content.properties.get(id) : undefined;
  const charId = online.charId(source);
  if (
    !property ||
    charId === undefined ||
    !owners.accessOf(property.id, charId)
  )
    return fail("PROP_ERR_LOCKED");
  // Per owner: a sold property's stash stays with the seller's character, the next buyer starts empty.
  const owner = owners.get(property.id)?.owner;
  if (owner === undefined) return fail("PROP_ERR_LOCKED");
  const name = `property_${property.id}_${owner}`;
  const settings = content.settings.value;
  inventory.registerStash(
    name,
    property.label,
    settings.stashSlots,
    settings.stashWeight,
  );
  return inventory.openInventory(source, name)
    ? { ok: true }
    : fail("PROP_ERR_FAR");
});

onClientCallback(
  EVENTS.buyFurniture,
  {
    args: (raw) => {
      const [name, x, y, z, heading] = raw;
      if (typeof name !== "string") return null;
      const id = name.trim().slice(0, 64);
      if (!id) return null;
      const xn = Number(x), yn = Number(y), zn = Number(z), hn = Number(heading);
      if (
        !Number.isFinite(xn) ||
        !Number.isFinite(yn) ||
        !Number.isFinite(zn) ||
        !Number.isFinite(hn)
      )
        return null;
      return [id, xn, yn, zn, hn];
    },
    lock: true,
  },
  async (source, name, x, y, z, heading) => {
    const property = ownedInside(source);
    if (!property) return fail("PROP_ERR_OWNER");
    const item = content.furniture.get(name);
    if (!item) return fail("PROP_ERR_FAR");
    const settings = content.settings.value;
    if (!core.RemoveMoney(source, settings.account, item.price, "furniture"))
      return fail("PROP_ERR_MONEY");
    try {
      await mysql.query(
        "INSERT INTO mb_properties_furniture (property, model, x, y, z, heading) VALUES (?, ?, ?, ?, ?, ?)",
        [property.id, item.model, x, y, z, heading],
      );
    } catch (error) {
      core.AddMoney(source, settings.account, item.price, "furniture:refund");
      log.error("furniture save failed", error);
      return fail("PROP_ERR_FAR");
    }
    aiLog("properties", `bought furniture ${item.id}`, {
      source,
      metadata: { property: property.id, item: item.id },
    });
    return { ok: true };
  },
);

onClientCallback(EVENTS.keys, (source) => {
  const property = ownedInside(source);
  if (!property) return fail("PROP_ERR_OWNER");
  const keys = owners.get(property.id)?.keys ?? new Map<number, string>();
  return {
    ok: true,
    keys: [...keys].map(([charId, name]) => ({ charId, name })),
  };
});

onClientCallback(
  EVENTS.giveKey,
  (source) => {
    const property = ownedInside(source);
    if (!property) return fail("PROP_ERR_OWNER");
    const target = nearestPlayerTo(
      source,
      3,
      (other) => inside.get(other) === property.id,
    );
    const charId = target === null ? undefined : online.charId(target);
    if (target === null || charId === undefined) return fail("PROP_ERR_NOBODY");
    owners.giveKey(property.id, charId, nameOf(target));
    sendAccess(sourceOf, charId, property.id, "key");
    notify(target, Locale("PROP_KEY_GOT", property.label), "success");
    return { ok: true };
  },
  { lock: true },
);

onClientCallback(
  EVENTS.takeKey,
  { args: oneArg(readId), lock: true },
  (source, charId) => {
    const property = ownedInside(source);
    if (!property) return fail("PROP_ERR_OWNER");
    if (!owners.takeKey(property.id, charId)) return fail("PROP_ERR_NOBODY");
    sendAccess(sourceOf, charId, property.id, false);
    return { ok: true };
  },
);

onClientCallback(
  EVENTS.sell,
  async (source) => {
    const property = ownedInside(source);
    if (!property) return fail("PROP_ERR_OWNER");
    const settings = content.settings.value;
    const refund = Math.floor((property.price * settings.sellPercent) / 100);
    const lost = await owners.sell(property.id);
    if (!lost) return fail("PROP_ERR_SELL");
    for (const charId of lost) sendAccess(sourceOf, charId, property.id, false);
    for (const [other, id] of inside)
      if (id === property.id) {
        interiors.move(other, property.door, null);
        emitNet(EVENTS.furniture, other, null, []);
      }
    if (refund > 0)
      core.AddMoney(
        source,
        settings.account,
        refund,
        `property:${property.id}:sell`,
      );
    notify(source, Locale("PROP_SOLD", property.label, refund), "success");
    aiLog("properties", `sold ${property.id}`, {
      source,
      metadata: { refund },
    });
    return { ok: true };
  },
  { lock: true },
);

onClientCallback(EVENTS.listFurniture, async (source) => {
  const property = ownedInside(source);
  if (!property) return fail("PROP_ERR_OWNER");
    const rows = await mysql.query<
      Array<{ id: number; model: string; x: number; y: number; z: number; heading: number }>
    >("SELECT id, model, x, y, z, heading FROM mb_properties_furniture WHERE property = ?", [
      property.id,
    ]);
    return {
      ok: true,
      items: rows.map((r) => ({
        id: Number(r.id),
        model: r.model,
        x: Number(r.x),
        y: Number(r.y),
        z: Number(r.z),
        heading: Number(r.heading),
      })),
    };
});

onClientCallback(
  EVENTS.removeFurniture,
  { args: oneArg(readId), lock: true },
  async (source, id) => {
    const property = ownedInside(source);
    if (!property) return fail("PROP_ERR_OWNER");
    try {
      await mysql.query("DELETE FROM mb_properties_furniture WHERE id = ? AND property = ?", [
        id,
        property.id,
      ]);
    } catch (error) {
      log.error("furniture remove failed", error);
      return fail("PROP_ERR_FAR");
    }
    return { ok: true };
  },
);

onClientCallback(
  EVENTS.updateFurniture,
  {
    args: (raw) => {
      const [id, x, y, z, heading] = raw;
      const nid = Number(id);
      if (!Number.isInteger(nid)) return null;
      const xn = Number(x), yn = Number(y), zn = Number(z), hn = Number(heading);
      if (!Number.isFinite(xn) || !Number.isFinite(yn) || !Number.isFinite(zn) || !Number.isFinite(hn))
        return null;
      return [nid, xn, yn, zn, hn];
    },
    lock: true,
  },
  async (source, id, x, y, z, heading) => {
    const property = ownedInside(source);
    if (!property) return fail("PROP_ERR_OWNER");
    try {
      await mysql.query(
        "UPDATE mb_properties_furniture SET x = ?, y = ?, z = ?, heading = ? WHERE id = ? AND property = ?",
        [x, y, z, heading, id, property.id],
      );
    } catch (error) {
      log.error("furniture move failed", error);
      return fail("PROP_ERR_FAR");
    }
    return { ok: true };
  },
);

/** Placed furniture for a property (used to re-spawn on enter). */
export async function loadFurniture(
  property: string,
): Promise<Array<{ model: string; x: number; y: number; z: number; heading: number }>> {
  const rows = await mysql.query<
    Array<{ model: string; x: number; y: number; z: number; heading: number }>
  >("SELECT model, x, y, z, heading FROM mb_properties_furniture WHERE property = ?", [
    property,
  ]);
  return rows.map((r) => ({
    model: r.model,
    x: Number(r.x),
    y: Number(r.y),
    z: Number(r.z),
    heading: Number(r.heading),
  }));
}
