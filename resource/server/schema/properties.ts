import { spec } from "@aicore-fivem/lib/shared";
import type { FileSpec, TabSpec } from "@aicore-fivem/shared";
import { blip } from "./blip";

export const propertiesFile: FileSpec = {
  kind: "records",
  sync: "all",
  labelPath: "label",
  newRecord: {
    label: "",
    door: { x: 0, y: 0, z: 0, heading: 0 },
    interior: "low",
    price: 50000,
    blip: false,
  },
  sections: {
    label: { type: "text", min: 1, max: 48 },
    door: { type: "vec4" },
    interior: { type: "text", min: 1, max: 48 },
    price: spec.int(0, 1_000_000_000),
    blip: { type: "bool" },
  },
};

export const propertiesTab: TabSpec = {
  id: "properties",
  file: "properties",
  icon: "building-columns",
  label: "ADMIN_TAB_PROPERTIES",
  desc: "ADMIN_TAB_PROPERTIES_DESC",
  listSub: "interior",
  createLabel: "ADMIN_NEW_PROPERTY",
  deleteLabel: "ADMIN_DELETE_PROPERTY",
  deleteDesc: "ADMIN_DELETE_PROPERTY_DESC",
  cards: [
    {
      icon: "building-columns",
      title: "ADMIN_C_PROPERTY",
      desc: "ADMIN_C_PROPERTY_DESC",
      fields: [
        {
          widget: "text",
          path: "label",
          suggest: { from: "door" },
          label: "ADMIN_F_LABEL",
          placeholder: "ADMIN_P_LABEL",
        },
        {
          widget: "point",
          path: "door",
          label: "ADMIN_F_DOOR",
          hint: "ADMIN_H_DOOR",
          heading: true,
          ground: true,
        },
        {
          widget: "text",
          path: "interior",
          label: "ADMIN_F_INTERIOR",
          hint: "ADMIN_H_INTERIOR",
          placeholder: "ADMIN_P_INTERIOR",
        },
        {
          widget: "number",
          path: "price",
          label: "ADMIN_F_PRICE",
          min: 0,
          max: 1_000_000_000,
          unit: "$",
        },
        {
          widget: "switch",
          path: "blip",
          label: "ADMIN_F_BLIP",
          hint: "ADMIN_H_BLIP",
        },
      ],
    },
  ],
};
