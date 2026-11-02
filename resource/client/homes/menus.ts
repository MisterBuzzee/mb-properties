import { cache, fadeIn, fadeOut, menu, notify } from "@aicore-fivem/lib/client";
import { isRecord, sleep } from "@aicore-fivem/lib/shared";
import { Locale } from "common";
import { EVENTS, type Furniture, type Property } from "common/property";
import { call, content, owned } from "./content";
import { trackFurniture, spawnFurniture } from "./furniture";

/** The door of a property: buy it when nobody owns it, else go in. */
export async function door(p: Property): Promise<void> {
  if (owned.get(p.id) !== true) {
    const pick = await menu({
      title: p.label,
      items: [
        {
          id: "buy",
          label: Locale("PROP_BUY", p.price),
          icon: "money-bill-wave",
        },
      ],
    });
    if (pick === "buy") await call(EVENTS.buy, [p.id]);
    return;
  }
  await move(EVENTS.enter, [p.id]);
}

/** The property menu at the interior entry. */
export async function insideMenu(): Promise<void> {
  const items = [
    { id: "exit", label: Locale("PROP_EXIT"), icon: "location-dot" },
    { id: "stash", label: Locale("PROP_STASH"), icon: "box-open" },
    { id: "keys", label: Locale("PROP_KEYS"), icon: "key" },
    { id: "furniture", label: "Buy furniture", icon: "couch" },
    { id: "manage", label: "Manage furniture", icon: "sliders" },
    { id: "sell", label: Locale("PROP_SELL"), icon: "money-bill-wave" },
  ];
  const pick = await menu({ title: Locale("PROP_MENU"), items });
  if (pick === "exit") await move(EVENTS.exit);
  else if (pick === "stash") await call(EVENTS.stash);
  else if (pick === "keys") await keys();
  else if (pick === "furniture") await openFurnitureCatalog();
  else if (pick === "manage") await manageFurniture();
  else if (pick === "sell") {
    const sure = await menu({
      title: Locale("PROP_SELL"),
      items: [
        {
          id: "yes",
          label: Locale("PROP_SELL_CONFIRM"),
          icon: "money-bill-wave",
        },
      ],
    });
    if (sure === "yes") await call(EVENTS.sell);
  }
}

async function openFurnitureCatalog(): Promise<void> {
  const list = [...content.furniture.values()];
  if (list.length === 0) {
    notify("No furniture available", "info");
    return;
  }
  SetNuiFocus(true, true);
  SendNUIMessage({ action: "open", items: list });
}

async function placeFurniture(item: Furniture): Promise<void> {
  // Simple, reliable placement: spawn in front of the player, persist on server.
  const [px = 0, py = 0, pz = 0] = GetEntityCoords(cache.ped, false);
  const heading = GetEntityHeading(cache.ped);
  const rad = (heading * Math.PI) / 180;
  const x = px + Math.sin(rad) * 1.5;
  const y = py + Math.cos(rad) * 1.5;
  const z = pz;

  const ok = await call(EVENTS.buyFurniture, [item.id, x, y, z, heading]);
  if (!ok) return;

  const hash = GetHashKey(item.model);
  RequestModel(hash);
  let tries = 0;
  while (!HasModelLoaded(hash) && tries < 100) {
    await sleep(10);
    tries += 1;
  }
  if (!HasModelLoaded(hash)) return;
  const obj = CreateObject(hash, x, y, z, false, false, false);
  trackFurniture(obj);
  SetEntityHeading(obj, heading);
  PlaceObjectOnGroundProperly(obj);
  SetModelAsNoLongerNeeded(hash);
  notify(`Placed ${item.label}`, "success");
}

async function manageFurniture(): Promise<void> {
  const reply = await call(EVENTS.listFurniture, []);
  const items = Array.isArray(reply?.items) ? reply.items : [];
  if (items.length === 0) {
    notify("No furniture placed", "info");
    return;
  }
  const pick = await menu({
    title: "Manage furniture",
    items: items.map((it: any) => ({
      id: String(it.id),
      label: `${it.model} (#${it.id})`,
      icon: "couch",
    })),
    back: true,
  });
  if (!pick || pick === "MENU_BACK") return;
  const id = Number(pick);
  const sure = await menu({
    title: "Remove furniture?",
    items: [{ id: "yes", label: "Remove", icon: "trash" }],
    back: true,
  });
  if (sure !== "yes") return;
  const ok = await call(EVENTS.removeFurniture, [id]);
  if (!ok) return;
  const r2 = await call(EVENTS.listFurniture, []);
  await spawnFurniture(Array.isArray(r2?.items) ? r2.items : []);
  notify("Removed", "success");
}

async function keys(): Promise<void> {
  const reply = await call(EVENTS.keys);
  if (!reply) return;
  const holders = (Array.isArray(reply.keys) ? reply.keys : []).filter(
    (k): k is { charId: number; name?: unknown } =>
      isRecord(k) && typeof k.charId === "number",
  );
  const pick = await menu({
    title: Locale("PROP_KEYS"),
    items: [
      { id: "give", label: Locale("PROP_GIVE_KEY"), icon: "key" },
      ...holders.map((k) => ({
        id: String(k.charId),
        label: typeof k.name === "string" ? k.name : "",
        description: Locale("PROP_TAKE_KEY"),
      })),
    ],
  });
  if (pick === "give") await call(EVENTS.giveKey);
  else if (pick !== null) await call(EVENTS.takeKey, [Number(pick)]);
}

/** Enter / exit: the screen goes black first; the server's `inside` event teleports and lifts the fade. */
async function move(name: string, args: unknown[] = []): Promise<void> {
  await fadeOut();
  if (!(await call(name, args))) await fadeIn(300);
}

RegisterNuiCallback("selectFurniture", (data: unknown, cb: (v: unknown) => void) => {
  const id = (data as { id?: string } | undefined)?.id;
  const item = [...content.furniture.values()].find((f: Furniture) => f.id === id);
  SetNuiFocus(false, false);
  SendNUIMessage({ action: "close" });
  if (item) void placeFurniture(item);
  cb(true);
});

RegisterNuiCallback("closeFurniture", (_data: unknown, cb: (v: unknown) => void) => {
  SetNuiFocus(false, false);
  SendNUIMessage({ action: "close" });
  cb(true);
});
