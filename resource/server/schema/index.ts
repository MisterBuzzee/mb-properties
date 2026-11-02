import type { PanelSchema } from "@aicore-fivem/shared";
import { propertiesFile, propertiesTab } from "./properties";
import { interiorsFile, interiorsTab } from "./interiors";
import { settingsFile, settingsTab } from "./settings";

/** mb-properties' panel: properties for sale (door, interior, price), the interiors and the rules. */
export const propertiesSchema: PanelSchema = {
  title: "ADMIN_TITLE",
  icon: "building-columns",
  files: {
    settings: settingsFile,
    properties: propertiesFile,
    interiors: interiorsFile,
  },
  tabs: [propertiesTab, interiorsTab, settingsTab],
};
