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
  else if (pick === "furniture") await buyFurniture();
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

async function buyFurniture(): Promise<void> {
  const list = [...content.furniture.values()];
  if (list.length === 0) {
    notify("No furniture available", "info");
    return;
  }
  const pick = await menu({
    title: "Buy furniture",
    items: list.map((f: Furniture) => ({
      id: f.id,
      label: `${f.label} ($${f.price})`,
      icon: "couch",
    })),
    back: true,
  });
  if (!pick || pick === "MENU_BACK") return;
  const item = list.find((f: Furniture) => f.id === pick);
  if (!item) return;

  const hash = GetHashKey(item.model);
  RequestModel(hash);
  let tries = 0;
  while (!HasModelLoaded(hash) && tries < 100) {
    await sleep(10);
    tries += 1;
  }
  if (!HasModelLoaded(hash)) return;

  // Freeze the player while placing.
  FreezeEntityPosition(cache.ped, true);

  const preview = CreateObject(hash, 0, 0, 0, false, false, false);
  SetEntityAlpha(preview, 140, false);
  SetEntityCollision(preview, false, false);

  let confirmed = false;
  let cancelled = false;
  let heading = GetEntityHeading(cache.ped);

  // Helper: ground point under the camera aim.
  const aimPoint = (): { x: number; y: number; z: number } | null => {
    const cam: any = GetGameplayCamCoord();
    const rot: any = GetGameplayCamRot(2);
    const rx = (rot.x * Math.PI) / 180;
    const rz = (rot.z * Math.PI) / 180;
    const dirX = -Math.sin(rz) * Math.abs(Math.cos(rx));
    const dirY = Math.cos(rz) * Math.abs(Math.cos(rx));
    const dirZ = Math.sin(rx);
    const dist = 6.0;
    const ex = cam.x + dirX * dist;
    const ey = cam.y + dirY * dist;
    const ez = cam.z + dirZ * dist;
    const ray = StartShapeTestRay(cam.x, cam.y, cam.z, ex, ey, ez, 1, cache.ped, 0);
    const res = GetShapeTestResult(ray) as any;
    if (res && res[0] === 2 && res[1]) {
      const c = res[2];
      return { x: c.x, y: c.y, z: c.z };
    }
    // fallback: in front of player
    const [px = 0, py = 0, pz = 0] = GetEntityCoords(cache.ped, false);
    const ph = GetEntityHeading(cache.ped);
    const pr = (ph * Math.PI) / 180;
    return { x: px + Math.sin(pr) * 2, y: py + Math.cos(pr) * 2, z: pz };
  };

  while (!confirmed && !cancelled) {
    const pt = aimPoint();
    if (pt) SetEntityCoords(preview, pt.x, pt.y, pt.z, false, false, false, false);
    // scroll wheel rotates
    if (IsControlJustPressed(0, 241)) heading += 15; // scroll up
    if (IsControlJustPressed(0, 242)) heading -= 15; // scroll down
    SetEntityHeading(preview, heading);
    if (IsControlJustPressed(0, 38)) confirmed = true;   // E
    if (IsControlJustPressed(0, 177)) cancelled = true;  // Backspace
    await sleep(0);
  }

  const [fx = 0, fy = 0, fz = 0] = GetEntityCoords(preview, false);
  const fheading = GetEntityHeading(preview);
  DeleteEntity(preview);
  SetModelAsNoLongerNeeded(hash);
  FreezeEntityPosition(cache.ped, false);

  if (cancelled) return;

  const ok = await call(EVENTS.buyFurniture, [item.id, fx, fy, fz, fheading]);
  if (!ok) return;
  // Spawn the real prop (persisted on the server).
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
  const item = items.find((it: any) => Number(it.id) === id);
  if (!item) return;
  const action = await menu({
    title: "Manage furniture",
    items: [
      { id: "move", label: "Move", icon: "arrows-up-down-left-right" },
      { id: "remove", label: "Remove", icon: "trash" },
    ],
    back: true,
  });
  if (action === "remove") {
    const ok = await call(EVENTS.removeFurniture, [id]);
    if (!ok) return;
    // re-spawn remaining
    const r2 = await call(EVENTS.listFurniture, []);
    await spawnFurniture(Array.isArray(r2?.items) ? r2.items : []);
    notify("Removed", "success");
    return;
  }
  if (action === "move") {
    // ghost preview (freeze player, aim with camera, rotate with scroll wheel)
    const hash = GetHashKey(String(item.model));
    RequestModel(hash);
    let t = 0;
    while (!HasModelLoaded(hash) && t < 100) { await sleep(10); t += 1; }
    if (!HasModelLoaded(hash)) return;
    FreezeEntityPosition(cache.ped, true);
    const preview = CreateObject(hash, Number(item.x), Number(item.y), Number(item.z), false, false, false);
    SetEntityAlpha(preview, 140, false);
    SetEntityCollision(preview, false, false);
    SetEntityHeading(preview, Number(item.heading));
    let confirmed = false;
    let cancelled = false;
    let heading = Number(item.heading);

    const aimPoint = (): { x: number; y: number; z: number } | null => {
      const cam: any = GetGameplayCamCoord();
      const rot: any = GetGameplayCamRot(2);
      const rx = (rot.x * Math.PI) / 180;
      const rz = (rot.z * Math.PI) / 180;
      const dirX = -Math.sin(rz) * Math.abs(Math.cos(rx));
      const dirY = Math.cos(rz) * Math.abs(Math.cos(rx));
      const dirZ = Math.sin(rx);
      const dist = 6.0;
      const ex = cam.x + dirX * dist;
      const ey = cam.y + dirY * dist;
      const ez = cam.z + dirZ * dist;
      const ray = StartShapeTestRay(cam.x, cam.y, cam.z, ex, ey, ez, 1, cache.ped, 0);
      const res = GetShapeTestResult(ray) as any;
      if (res && res[0] === 2 && res[1]) {
        const c = res[2];
        return { x: c.x, y: c.y, z: c.z };
      }
      return null;
    };

    while (!confirmed && !cancelled) {
      const pt = aimPoint();
      if (pt) SetEntityCoords(preview, pt.x, pt.y, pt.z, false, false, false, false);
      if (IsControlJustPressed(0, 241)) heading += 15;
      if (IsControlJustPressed(0, 242)) heading -= 15;
      SetEntityHeading(preview, heading);
      if (IsControlJustPressed(0, 38)) confirmed = true;
      if (IsControlJustPressed(0, 177)) cancelled = true;
      await sleep(0);
    }
    const [fx = 0, fy = 0, fz = 0] = GetEntityCoords(preview, false);
    const fh = GetEntityHeading(preview);
    DeleteEntity(preview);
    SetModelAsNoLongerNeeded(hash);
    FreezeEntityPosition(cache.ped, false);
    if (cancelled) return;
    const ok = await call(EVENTS.updateFurniture, [id, fx, fy, fz, fh]);
    if (!ok) return;
    const r2 = await call(EVENTS.listFurniture, []);
    await spawnFurniture(Array.isArray(r2?.items) ? r2.items : []);
    notify("Moved", "success");
  }
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
