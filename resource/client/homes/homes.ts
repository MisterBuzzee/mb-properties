import { callAction, Points } from "@aicore-fivem/lib/client";
import { isRecord, RecordObjects } from "@aicore-fivem/lib/shared";
import { Locale } from "common";
import {
  EVENTS,
  readProperty,
  type Access,
  type Property,
} from "common/property";
import { content, FALLBACK, owned, world } from "./content";
import { door, insideMenu } from "./menus";

/**
 * Door points (buy, enter, locked; the label follows ownership), blips of the player's properties and properties for
 * sale, and the property menu at the interior entry while inside. Access comes as one snapshot, then deltas; a change
 * (ownership, access, its panel record) re-adds only that property's point.
 */
export class Homes {
  private readonly access = new Map<string, Access>();
  private readonly doors = new Points();
  private readonly inner = new Points();
  /** One door point per panel record (after `access` and `doors`: it builds at once). */
  private readonly properties = new RecordObjects(
    world,
    "properties",
    readProperty,
    (id, p) => {
      this.add(p);
      return () => this.doors.remove(id);
    },
  );

  async load(): Promise<void> {
    const reply = await callAction(EVENTS.mine, [], {
      ...FALLBACK,
      silent: true,
    });
    this.access.clear();
    for (const row of Array.isArray(reply?.list) ? reply.list : [])
      if (
        isRecord(row) &&
        typeof row.id === "string" &&
        (row.access === "owner" || row.access === "key")
      )
        this.access.set(row.id, row.access);
    this.rebuild();
  }

  setAccess(id: string, access: Access | false): void {
    if (access) this.access.set(id, access);
    else this.access.delete(id);
    this.update(id);
  }

  private label(p: Property): string {
    if (owned.get(p.id) !== true)
      return Locale("PROP_PROMPT_BUY", p.label, p.price);
    return this.access.has(p.id)
      ? Locale("PROP_PROMPT_ENTER", p.label)
      : Locale("PROP_PROMPT_LOCKED", p.label);
  }

  /** Adds (or replaces) one property's door point; its blip follows ownership and access. */
  private add(p: Property): void {
    const mine = this.access.has(p.id);
    const forSale = p.blip && owned.get(p.id) !== true;
    const style = mine
      ? content.settings.value.ownedBlip
      : content.settings.value.saleBlip;
    this.doors.add(p.id, {
      coords: p.door,
      label: () => this.label(p),
      icon: "house",
      radius: 1.5,
      blip: mine || forSale ? { ...style, label: p.label } : undefined,
      onPressed: () => door(p),
    });
  }

  /** One property's ownership or access changed. */
  update(id: string): void {
    this.properties.rebuild(id);
  }

  /** Every door again (the access snapshot, blip looks in the settings). */
  rebuild(): void {
    this.properties.rebuildAll();
  }

  setInside(id: string | null): void {
    this.inner.clear();
    const property = id ? this.properties.records.get(id) : undefined;
    const interior = property
      ? content.interiors.get(property.interior)
      : undefined;
    if (!interior) return;
    this.inner.add("inside", {
      coords: interior.entry,
      label: Locale("PROP_PROMPT_MENU"),
      icon: "bars",
      radius: 1.5,
      interval: 400,
      onPressed: () => insideMenu(),
    });
  }
}
