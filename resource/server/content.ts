import { AdminPanel, resourceExport } from "@aicore-fivem/lib/server";
import { readInterior, readProperty, readSettings } from "common/property";
import { propertiesSchema } from "./schema";

export const core = resourceExport("ai-core");
const panel = new AdminPanel(propertiesSchema);
export const content = {
  settings: panel.view("settings", readSettings),
  properties: panel.records("properties", readProperty),
  interiors: panel.records("interiors", readInterior),
};
