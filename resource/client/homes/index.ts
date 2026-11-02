import { onServerEvent, player } from "@aicore-fivem/lib/client";
import { readVec4, type Vec4 } from "@aicore-fivem/lib/shared";
import { CORE } from "@aicore-fivem/shared";
import { EVENTS, type Access } from "common/property";
import { owned, world } from "./content";
import { Homes } from "./homes";

const homes = new Homes();
void homes.load();
on(CORE.clientPlayerLoadedEvent, () => void homes.load());
world.onChange("settings", () => homes.rebuild());
owned.onChange((id) => homes.update(id));

onServerEvent(
  EVENTS.access,
  {
    args: ([id, access]): [string, Access | false] | null =>
      typeof id === "string" &&
      (access === "owner" || access === "key" || access === false)
        ? [id, access]
        : null,
  },
  (id, access) => homes.setAccess(id, access),
);
onServerEvent(
  EVENTS.inside,
  {
    // A malformed target is refused (never a teleport to 0, 0, 0).
    args: ([id, to]): [string | null, Vec4] | null => {
      const point = readVec4(to);
      return (id == null || typeof id === "string") && point
        ? [id ?? null, point]
        : null;
    },
  },
  (id, to) => {
    homes.setInside(id);
    void player.teleport(to, { heading: to.heading });
  },
);
