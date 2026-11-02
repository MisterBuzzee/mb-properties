import { sleep } from "@aicore-fivem/lib/shared";
import { isRecord } from "@aicore-fivem/lib/shared";

export const furnitureObjects: number[] = [];

export function clearFurniture(): void {
  for (const o of furnitureObjects) {
    if (DoesEntityExist(o)) DeleteEntity(o);
  }
  furnitureObjects.length = 0;
}

export async function spawnFurniture(items: unknown): Promise<void> {
  clearFurniture();
  if (!Array.isArray(items)) return;
  for (const it of items) {
    if (!isRecord(it)) continue;
    const model = String(it.model ?? "");
    const x = Number(it.x), y = Number(it.y), z = Number(it.z), h = Number(it.heading);
    if (!model || !Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) continue;
    const hash = GetHashKey(model);
    RequestModel(hash);
    let tries = 0;
    while (!HasModelLoaded(hash) && tries < 100) {
      await sleep(10);
      tries += 1;
    }
    if (!HasModelLoaded(hash)) continue;
    const obj = CreateObject(hash, x, y, z, false, false, false);
    SetEntityHeading(obj, Number.isFinite(h) ? h : 0);
    PlaceObjectOnGroundProperly(obj);
    furnitureObjects.push(obj);
    SetModelAsNoLongerNeeded(hash);
  }
}

export function trackFurniture(obj: number): void {
  furnitureObjects.push(obj);
}