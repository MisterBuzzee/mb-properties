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

// Pending gizmo state.
let pendingGizmoPreview: number | null = null;
let pendingGizmoItem: Furniture | null = null;

async function placeFurniture(item: Furniture): Promise<void> {
  const [px = 0, py = 0, pz = 0] = GetEntityCoords(cache.ped, false);
  const heading = GetEntityHeading(cache.ped);
  const rad = (heading * Math.PI) / 180;
  const x = px + Math.sin(rad) * 1.5;
  const y = py + Math.cos(rad) * 1.5;
  const z = pz;

  const hash = GetHashKey(item.model);
  RequestModel(hash);
  let tries = 0;
  while (!HasModelLoaded(hash) && tries < 100) {
    await sleep(10);
    tries += 1;
  }
  if (!HasModelLoaded(hash)) return;
  const preview = CreateObject(hash, x, y, z, false, false, false);
  SetEntityHeading(preview, heading);
  PlaceObjectOnGroundProperly(preview);

  // Hide the ped; we control the item.
  SetEntityVisible(cache.ped, false, false);
  SetEntityAlpha(cache.ped, 0, false);

  pendingGizmoPreview = preview;
  pendingGizmoItem = item;

  const gizmo = (globalThis as any).exports?.object_gizmo;
  if (gizmo && typeof gizmo.useGizmo === "function") {
    // Fire-and-forget: gizmo runs in Lua and fires editFinished event when done.
    try { gizmo.useGizmo(preview); } catch { /* ignore */ }
  } else {
    // No gizmo: fall back to immediate placement.
    const ok = await call(EVENTS.buyFurniture, [item.id, x, y, z, heading]);
    if (ok) {
      const hash2 = GetHashKey(item.model);
      RequestModel(hash2);
      let t2 = 0;
      while (!HasModelLoaded(hash2) && t2 < 100) { await sleep(10); t2 += 1; }
      if (HasModelLoaded(hash2)) {
        const obj = CreateObject(hash2, x, y, z, false, false, false);
        trackFurniture(obj);
        SetEntityHeading(obj, heading);
        PlaceObjectOnGroundProperly(obj);
        SetModelAsNoLongerNeeded(hash2);
        notify(`Placed ${item.label}`, "success");
      }
    }
    DeleteEntity(preview);
    SetModelAsNoLongerNeeded(hash);
    SetEntityVisible(cache.ped, true, false);
    SetEntityAlpha(cache.ped, 255, false);
    pendingGizmoPreview = null;
    pendingGizmoItem = null;
  }
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

on("object_gizmo:client:editFinished", (result: any) => {
  const preview = pendingGizmoPreview;
  const item = pendingGizmoItem;
  pendingGizmoPreview = null;
  pendingGizmoItem = null;
  if (!preview || !item) return;
  if (!DoesEntityExist(preview)) {
    SetEntityVisible(cache.ped, true, false);
    SetEntityAlpha(cache.ped, 255, false);
    return;
  }
  const cancelled = !!result?.cancelled;
  const pos = result?.position;
  const rot = result?.rotation;
  const fx = pos ? (pos.x ?? pos[0] ?? 0) : 0;
  const fy = pos ? (pos.y ?? pos[1] ?? 0) : 0;
  const fz = pos ? (pos.z ?? pos[2] ?? 0) : 0;
  let fheading = GetEntityHeading(preview);
  if (rot) {
    if (typeof rot === "number") fheading = rot;
    else if (rot.z !== undefined) fheading = rot.z;
    else if (Array.isArray(rot) && rot.length >= 3) fheading = rot[2];
  }
  DeleteEntity(preview);
  SetModelAsNoLongerNeeded(GetHashKey(item.model));
  SetEntityVisible(cache.ped, true, false);
  SetEntityAlpha(cache.ped, 255, false);
  if (cancelled) {
    notify("Cancelled", "info");
    return;
  }
  void (async () => {
    const ok = await call(EVENTS.buyFurniture, [item.id, fx, fy, fz, fheading]);
    if (!ok) return;
    const hash2 = GetHashKey(item.model);
    RequestModel(hash2);
    let t2 = 0;
    while (!HasModelLoaded(hash2) && t2 < 100) {
      await sleep(10);
      t2 += 1;
    }
    if (!HasModelLoaded(hash2)) return;
    const obj = CreateObject(hash2, fx, fy, fz, false, false, false);
    trackFurniture(obj);
    SetEntityHeading(obj, fheading);
    PlaceObjectOnGroundProperly(obj);
    SetModelAsNoLongerNeeded(hash2);
    notify(`Placed ${item.label}`, "success");
  })();
});
