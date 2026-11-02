import {
  aiLogChannels,
  createDatabaseTables,
  onCharacter,
  onStop,
} from "@aicore-fivem/lib/server";
import { createLogger } from "@aicore-fivem/lib/shared";
import { ResourceName } from "common";
import { INSIDE_META } from "common/property";
import { content, core } from "./content";
import { interiors } from "./interiors";
import { owners } from "./store";

const log = createLogger(ResourceName);
aiLogChannels({ properties: {} });
createDatabaseTables(ResourceName, "sql/main.sql")
  .then(() => owners.load())
  .catch((error: unknown) => log.error("database setup failed", error));

/** A character that left the game inside (or was inside at a restart) comes back at the door, in the shared world. */
onCharacter({
  loaded: (source) => {
    const id = core.GetMeta(source, INSIDE_META);
    const property =
      typeof id === "string" ? content.properties.get(id) : undefined;
    if (property) interiors.move(source, property.door, null);
  },
  unloaded: (source) => interiors.forget(source),
});

onStop(() => interiors.stop());
