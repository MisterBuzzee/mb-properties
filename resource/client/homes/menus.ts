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
  const hash = GetHashKey(item.model);
  RequestModel(hash);
  let tries = 0;
  while (!HasModelLoaded(hash) && tries < 100) {
    await sleep(10);
    tries += 1;
  }
  if (!HasModelLoaded(hash)) return;

  // Hide the ped.
  SetEntityVisible(cache.ped, false, false);
  SetEntityAlpha(cache.ped, 0, false);

  const [spx = 0, spy = 0, spz = 0] = GetEntityCoords(cache.ped, false);
  const sph = GetEntityHeading(cache.ped);
  const spr = (sph * Math.PI) / 180;
  const preview = CreateObject(hash, spx + Math.sin(spr) * 2, spy + Math.cos(spr) * 2, spz, false, false, false);
  SetEntityAlpha(preview, 200, false);
  SetEntityCollision(preview, false, false);
  PlaceObjectOnGroundProperly(preview);

  // Save original transform for cancel.
  const origCoords = GetEntityCoords(preview, false);
  const origHeading = GetEntityHeading(preview);

  // Enter cursor mode and run the gizmo.
  EnterCursorMode();
  let confirmed = false;
  let cancelled = false;

  while (!confirmed && !cancelled && DoesEntityExist(preview)) {
    // Build the matrix buffer (column-major, right/forward/up/position).
    const buf = new ArrayBuffer(60);
    const view = new DataView(buf);
    const f = GetEntityMatrix(preview)[0] as any;
    const r = GetEntityMatrix(preview)[1] as any;
    const u = GetEntityMatrix(preview)[2] as any;
    const a = GetEntityMatrix(preview)[3] as any;
    // right
    view.setFloat32(0, r[0], true); view.setFloat32(4, r[1], true); view.setFloat32(8, r[2], true); view.setFloat32(12, 0, true);
    // forward
    view.setFloat32(16, f[0], true); view.setFloat32(20, f[1], true); view.setFloat32(24, f[2], true); view.setFloat32(28, 0, true);
    // up
    view.setFloat32(32, u[0], true); view.setFloat32(36, u[1], true); view.setFloat32(40, u[2], true); view.setFloat32(44, 0, true);
    // position
    view.setFloat32(48, a[0], true); view.setFloat32(52, a[1], true); view.setFloat32(56, a[2], true);

    let changed = false;
    try {
      changed = Citizen.invokeNative("0xEB2EDCA2", buf, "Editor1", Citizen.returnResultAnyway()) as boolean;
    } catch {
      changed = false;
    }
    if (changed) {
      const x1 = view.getFloat32(0, true), y1 = view.getFloat32(4, true), z1 = view.getFloat32(8, true);
      const x2 = view.getFloat32(16, true), y2 = view.getFloat32(20, true), z2 = view.getFloat32(24, true);
      const x3 = view.getFloat32(32, true), y3 = view.getFloat32(36, true), z3 = view.getFloat32(40, true);
      const tx = view.getFloat32(48, true), ty = view.getFloat32(52, true), tz = view.getFloat32(56, true);
      SetEntityMatrix(preview, x1, y1, z1, x2, y2, z2, x3, y3, z3, tx, ty, tz);
    }

    // Disable game controls during gizmo.
    DisableControlAction(0, 24, true);
    DisableControlAction(0, 25, true);
    DisableControlAction(0, 140, true);
    DisablePlayerFiring(PlayerId(), true);

    if (IsControlJustPressed(0, 201)) confirmed = true; // Enter
    if (IsControlJustPressed(0, 177)) cancelled = true; // Backspace
    if (IsControlJustPressed(0, 202)) cancelled = true; // Esc
    await sleep(0);
  }

  LeaveCursorMode();
  SetEntityVisible(cache.ped, true, false);
  SetEntityAlpha(cache.ped, 255, false);

  if (cancelled || !DoesEntityExist(preview)) {
    SetEntityCoords(preview, origCoords[0] ?? 0, origCoords[1] ?? 0, origCoords[2] ?? 0, false, false, false, false);
    SetEntityHeading(preview, origHeading);
    DeleteEntity(preview);
    SetModelAsNoLongerNeeded(hash);
    return;
  }

  const [fx = 0, fy = 0, fz = 0] = GetEntityCoords(preview, true);
  const fheading = GetEntityHeading(preview);
  DeleteEntity(preview);
  SetModelAsNoLongerNeeded(hash);

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
    const hash = GetHashKey(String(item.model));
    RequestModel(hash);
    let t = 0;
    while (!HasModelLoaded(hash) && t < 100) { await sleep(10); t += 1; }
    if (!HasModelLoaded(hash)) return;

    // Hide the ped and take control of the item only.
    SetEntityVisible(cache.ped, false, false);
    SetEntityAlpha(cache.ped, 0, false);

    const preview = CreateObject(hash, Number(item.x), Number(item.y), Number(item.z), false, false, false);
    SetEntityAlpha(preview, 200, false);
    SetEntityCollision(preview, false, false);
    PlaceObjectOnGroundProperly(preview);
    SetEntityHeading(preview, Number(item.heading));

    let confirmed = false;
    let cancelled = false;
    let heading = Number(item.heading);

    while (!confirmed && !cancelled) {
      const [cx = 0, cy = 0, cz = 0] = GetEntityCoords(preview, true);
      const camRot: any = GetGameplayCamRot(2);
      const yaw = (camRot.z * Math.PI) / 180;
      const fwdX = -Math.sin(yaw), fwdY = Math.cos(yaw);
      const rightX = Math.cos(yaw), rightY = Math.sin(yaw);
      const speed = 0.1;
      let dx = 0, dy = 0, dz = 0;
      if (IsDisabledControlPressed(0, 32)) { dx += fwdX * speed; dy += fwdY * speed; }
      if (IsDisabledControlPressed(0, 33)) { dx -= fwdX * speed; dy -= fwdY * speed; }
      if (IsDisabledControlPressed(0, 34)) { dx -= rightX * speed; dy -= rightY * speed; }
      if (IsDisabledControlPressed(0, 35)) { dx += rightX * speed; dy += rightY * speed; }
      if (IsDisabledControlPressed(0, 44)) dz += speed;
      if (IsDisabledControlPressed(0, 36)) dz -= speed;
      SetEntityCoords(preview, cx + dx, cy + dy, cz + dz, false, false, false, false);
      if (IsDisabledControlJustPressed(0, 241)) heading += 15;
      if (IsDisabledControlJustPressed(0, 242)) heading -= 15;
      SetEntityHeading(preview, heading);
      if (IsDisabledControlJustPressed(0, 38)) confirmed = true;
      if (IsDisabledControlJustPressed(0, 177)) cancelled = true;
      DisableControlAction(0, 30, true);
      DisableControlAction(0, 31, true);
      DisableControlAction(0, 32, true);
      DisableControlAction(0, 33, true);
      DisableControlAction(0, 34, true);
      DisableControlAction(0, 35, true);
      DisableControlAction(0, 44, true);
      DisableControlAction(0, 36, true);
      DisableControlAction(0, 21, true);
      DisableControlAction(0, 22, true);
      DisableControlAction(0, 24, true);
      DisableControlAction(0, 25, true);
      DisableControlAction(0, 38, true);
      DisableControlAction(0, 177, true);
      await sleep(0);
    }

    SetEntityVisible(cache.ped, true, false);
    SetEntityAlpha(cache.ped, 255, false);
    const [fx = 0, fy = 0, fz = 0] = GetEntityCoords(preview, true);
    const fh = GetEntityHeading(preview);
    DeleteEntity(preview);
    SetModelAsNoLongerNeeded(hash);
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
