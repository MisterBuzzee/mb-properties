import type { FileSpec, TabSpec } from "@aicore-fivem/shared";

export const interiorsFile: FileSpec = {
  kind: "records",
  sync: "all",
  labelPath: "label",
  newRecord: { label: "", entry: { x: 0, y: 0, z: 0, heading: 0 } },
  sections: {
    label: { type: "text", min: 1, max: 48 },
    entry: { type: "vec4" },
  },
};

export const interiorsTab: TabSpec = {
  id: "interiors",
  file: "interiors",
  icon: "warehouse",
  label: "ADMIN_TAB_INTERIORS",
  desc: "ADMIN_TAB_INTERIORS_DESC",
  createLabel: "ADMIN_NEW_INTERIOR",
  deleteLabel: "ADMIN_DELETE_INTERIOR",
  deleteDesc: "ADMIN_DELETE_INTERIOR_DESC",
  cards: [
    {
      icon: "warehouse",
      title: "ADMIN_C_INTERIOR",
      desc: "ADMIN_C_INTERIOR_DESC",
      fields: [
        {
          widget: "text",
          path: "label",
          suggest: { from: "entry" },
          label: "ADMIN_F_LABEL",
          placeholder: "ADMIN_P_INTERIOR_LABEL",
        },
        {
          widget: "point",
          path: "entry",
          label: "ADMIN_F_ENTRY",
          hint: "ADMIN_H_ENTRY",
          heading: true,
          ground: true,
        },
      ],
    },
  ],
};
