import { buckets } from "@aicore-fivem/lib/server";
import type { Vec4 } from "@aicore-fivem/lib/shared";
import { EVENTS, INSIDE_META } from "common/property";
import { core } from "./content";

/**
 * Who is inside which property (server truth; also in the character's metadata for a rejoin) and the routing bucket
 * of every occupied property (lib `buckets`: taken when the first player enters, given back when the last one leaves).
 */
export class Interiors {
  readonly inside = new Map<number, string>();
  private readonly worlds = new Map<
    string,
    { bucket: number; count: number }
  >();

  /** Moves the player into a property (`id`) or out (null): bucket here, the teleport on the player's client. */
  move(source: number, at: Vec4, id: string | null): void {
    const previous = this.inside.get(source);
    if (previous !== id) {
      if (previous) this.leave(previous);
      if (id) this.enter(id);
    }
    if (id) this.inside.set(source, id);
    else this.inside.delete(source);
    SetPlayerRoutingBucket(
      String(source),
      id ? (this.worlds.get(id)?.bucket ?? 0) : 0,
    );
    core.SetMeta(source, INSIDE_META, id);
    emitNet(EVENTS.inside, source, id, at);
  }

  /** The player is gone (drop, logout): the metadata stays for the rejoin. */
  forget(source: number): void {
    const id = this.inside.get(source);
    if (id === undefined) return;
    this.inside.delete(source);
    this.leave(id);
  }

  /** Back to the shared world before the buckets go back to ai-core; the metadata moves them to the door later. */
  stop(): void {
    for (const source of this.inside.keys())
      SetPlayerRoutingBucket(String(source), 0);
  }

  private enter(id: string): void {
    const world = this.worlds.get(id);
    if (world) world.count++;
    else
      this.worlds.set(id, {
        bucket: buckets.acquire(`property:${id}`),
        count: 1,
      });
  }

  private leave(id: string): void {
    const world = this.worlds.get(id);
    if (!world || --world.count > 0) return;
    this.worlds.delete(id);
    buckets.release(world.bucket);
  }
}

export const interiors = new Interiors();
export const inside = interiors.inside;
