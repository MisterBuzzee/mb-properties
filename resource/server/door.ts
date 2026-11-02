import {
  aiLog,
  isNear,
  notify,
  onClientCallback,
  online,
  vehicleOf,
} from "@aicore-fivem/lib/server";
import { fail, oneArg, readText } from "@aicore-fivem/lib/shared";
import { Locale } from "common";
import { EVENTS } from "common/property";
import { content, core } from "./content";
import { inside, interiors } from "./interiors";
import { nameOf, sourceOf } from "./players";
import { owners, sendAccess } from "./store";

const isPolice = (source: number) =>
  online.onDutyIn(source, content.settings.value.policeJobs);

const idArgs = oneArg((v) => readText(v, 64));

onClientCallback(
  EVENTS.mine,
  (source) => {
    const charId = online.charId(source);
    return {
      ok: true,
      list: charId === undefined ? [] : owners.accessList(charId),
    };
  },
  { rate: { count: 2, windowMs: 10_000 } },
);

onClientCallback(
  EVENTS.buy,
  { args: idArgs, lock: true },
  async (source, id) => {
    const property = content.properties.get(id);
    const charId = online.charId(source);
    if (!property || charId === undefined || !isNear(source, property.door, 3))
      return fail("PROP_ERR_FAR");
    if (owners.get(id)) return fail("PROP_ERR_OWNED");
    const account = content.settings.value.account;
    if (!core.RemoveMoney(source, account, property.price, `property:${id}`))
      return fail("PROP_ERR_MONEY");
    if (!(await owners.buy(id, charId, nameOf(source), property.price))) {
      core.AddMoney(source, account, property.price, `property:${id}:refund`);
      return fail("PROP_ERR_OWNED");
    }
    sendAccess(sourceOf, charId, id, "owner");
    notify(source, Locale("PROP_BOUGHT", property.label), "success");
    aiLog("properties", `bought ${id}`, {
      source,
      metadata: { price: property.price },
    });
    return { ok: true };
  },
);

onClientCallback(EVENTS.enter, { args: idArgs, lock: true }, (source, id) => {
  const property = content.properties.get(id);
  const interior = property
    ? content.interiors.get(property.interior)
    : undefined;
  const charId = online.charId(source);
  if (
    !property ||
    !interior ||
    charId === undefined ||
    !isNear(source, property.door, 3)
  )
    return fail("PROP_ERR_FAR");
  if (vehicleOf(source)) return fail("PROP_ERR_VEHICLE");
  if (
    !owners.accessOf(id, charId) &&
    !(content.settings.value.policeEnter && isPolice(source) && owners.get(id))
  )
    return fail("PROP_ERR_LOCKED");
  interiors.move(source, interior.entry, id);
  return { ok: true };
});

onClientCallback(
  EVENTS.exit,
  (source) => {
    const property = content.properties.get(inside.get(source) ?? "");
    if (!property) return fail("PROP_ERR_FAR");
    interiors.move(source, property.door, null);
    return { ok: true };
  },
  { lock: true },
);
