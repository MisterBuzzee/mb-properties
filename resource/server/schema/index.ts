import type { PanelSchema } from "@aicore-fivem/shared";
import { propertiesFile, propertiesTab } from "./properties";
import { interiorsFile, interiorsTab } from "./interiors";
import { settingsFile, settingsTab } from "./settings";
import { furnitureFile, furnitureTab } from "./furniture";

/** mb-properties' panel. */
export const propertiesSchema: PanelSchema = {
  title: "ADMIN_TITLE",
  icon: "building-columns",
  files: {
    settings: settingsFile,
    properties: propertiesFile,
    interiors: interiorsFile,
    furniture: furnitureFile,
  },
  tabs: [propertiesTab, interiorsTab, furnitureTab, settingsTab],
};
