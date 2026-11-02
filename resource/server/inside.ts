import {
  aiLog,
  inventory,
  nearestPlayerTo,
  notify,
  onClientCallback,
  online,
} from "@aicore-fivem/lib/server";
import { fail, oneArg, readId } from "@aicore-fivem/lib/shared";
import { Locale } from "common";
import { EVENTS, type Property } from "common/property";
import { content, core } from "./content";
import { inside, interiors } from "./interiors";
import { nameOf, sourceOf } from "./players";
import { owners, sendAccess } from "./store";

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
      if (id === property.id) interiors.move(other, property.door, null);
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
