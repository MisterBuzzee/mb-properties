import { GlobalGroup, stateBoolean } from "@aicore-fivem/lib/server";
import { mysql } from "@aicore-fivem/mysql";
import { createLogger } from "@aicore-fivem/lib/shared";
import { ResourceName } from "common";
import { EVENTS, OWNED_PREFIX, type Access } from "common/property";

const ownedFlags = new GlobalGroup(OWNED_PREFIX, stateBoolean);

const log = createLogger(ResourceName);

interface Ownership {
  owner: number;
  ownerName: string;
  /** charId -> name */
  keys: Map<number, string>;
}

/**
 * Who owns which property and who holds keys, in memory (loaded once; rows exist only for owned properties). Each
 * change writes the DB, sets the property's GlobalState flag (removed on a sale) and sends the access delta to the
 * online characters it concerns. `byChar` indexes every access per character, so a player's snapshot never walks
 * every owned property.
 */
class Owners {
  private readonly byProperty = new Map<string, Ownership>();
  private readonly byChar = new Map<number, Map<string, Access>>();
  /** Properties whose sale is being written: no key changes until it settles (a key row could outlive the DELETE). */
  private readonly selling = new Set<string>();

  async load(): Promise<void> {
    const owned = await mysql.query<
      Array<{ property: string; char_id: number; owner_name: string }>
    >("SELECT property, char_id, owner_name FROM mb_properties_owned");
    const keys = await mysql.query<
      Array<{ property: string; char_id: number; name: string }>
    >("SELECT property, char_id, name FROM mb_properties_keys");
    for (const r of owned) {
      const owner = Number(r.char_id);
      this.byProperty.set(r.property, {
        owner,
        ownerName: r.owner_name,
        keys: new Map(),
      });
      this.index(owner, r.property, "owner");
    }
    for (const r of keys) {
      const o = this.byProperty.get(r.property);
      const charId = Number(r.char_id);
      if (!o || o.owner === charId) continue;
      o.keys.set(charId, r.name);
      this.index(charId, r.property, "key");
    }
    for (const id of this.byProperty.keys()) ownedFlags.set(id, true);
    log.info(`${this.byProperty.size} owned properties loaded`);
  }

  /** Sets (or with null removes) one entry of the per-character index. */
  private index(charId: number, id: string, access: Access | null): void {
    let list = this.byChar.get(charId);
    if (access === null) {
      list?.delete(id);
      if (list?.size === 0) this.byChar.delete(charId);
      return;
    }
    if (!list) this.byChar.set(charId, (list = new Map()));
    list.set(id, access);
  }

  get(id: string): Ownership | undefined {
    return this.byProperty.get(id);
  }

  accessOf(id: string, charId: number): Access | null {
    return this.byChar.get(charId)?.get(id) ?? null;
  }

  /** Every property the character owns or holds a key to (the player's snapshot). */
  accessList(charId: number): Array<{ id: string; access: Access }> {
    const list = this.byChar.get(charId);
    return list ? [...list].map(([id, access]) => ({ id, access })) : [];
  }

  async buy(
    id: string,
    charId: number,
    name: string,
    price: number,
  ): Promise<boolean> {
    if (this.byProperty.has(id)) return false;
    this.byProperty.set(id, {
      owner: charId,
      ownerName: name,
      keys: new Map(),
    });
    try {
      await mysql.query(
        "INSERT INTO mb_properties_owned (property, char_id, owner_name, price) VALUES (?, ?, ?, ?)",
        [id, charId, name.slice(0, 64), price],
      );
    } catch (error) {
      this.byProperty.delete(id);
      log.error(`buying ${id} failed`, error);
      return false;
    }
    this.index(charId, id, "owner");
    ownedFlags.set(id, true);
    return true;
  }

  /**
   * Deletes the ownership and its keys; answers every character that lost access, or null when the DB refused (memory
   * and the flag stay, so the property is still owned, also after a restart). The record stays in memory during the
   * write: nobody buys it in between.
   */
  async sell(id: string): Promise<number[] | null> {
    const o = this.byProperty.get(id);
    if (!o || this.selling.has(id)) return null;
    this.selling.add(id);
    const done = await mysql
      .transaction([
        {
          query: "DELETE FROM mb_properties_keys WHERE property = ?",
          values: [id],
        },
        {
          query: "DELETE FROM mb_properties_owned WHERE property = ?",
          values: [id],
        },
      ])
      .finally(() => this.selling.delete(id));
    if (!done || this.byProperty.get(id) !== o) return null;
    this.byProperty.delete(id);
    const lost = [o.owner, ...o.keys.keys()];
    for (const charId of lost) this.index(charId, id, null);
    ownedFlags.set(id, undefined);
    return lost;
  }

  giveKey(id: string, charId: number, name: string): void {
    const o = this.byProperty.get(id);
    if (!o || this.selling.has(id) || o.owner === charId || o.keys.has(charId))
      return;
    o.keys.set(charId, name);
    this.index(charId, id, "key");
    mysql
      .query(
        "INSERT IGNORE INTO mb_properties_keys (property, char_id, name) VALUES (?, ?, ?)",
        [id, charId, name.slice(0, 64)],
      )
      .catch((error: unknown) => log.error("key save failed", error));
  }

  takeKey(id: string, charId: number): boolean {
    if (this.selling.has(id)) return false;
    const o = this.byProperty.get(id);
    if (!o?.keys.delete(charId)) return false;
    this.index(charId, id, null);
    mysql
      .query(
        "DELETE FROM mb_properties_keys WHERE property = ? AND char_id = ?",
        [id, charId],
      )
      .catch((error: unknown) => log.error("key delete failed", error));
    return true;
  }
}

export const owners = new Owners();

/** Sends a character's new access to a property, when that character is online. */
export function sendAccess(
  sourceOf: (charId: number) => number | null,
  charId: number,
  id: string,
  access: Access | false,
): void {
  const source = sourceOf(charId);
  if (source !== null) emitNet(EVENTS.access, source, id, access);
}
