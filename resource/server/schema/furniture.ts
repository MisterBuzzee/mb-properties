import type { FileSpec, TabSpec } from "@aicore-fivem/shared";

export const furnitureFile: FileSpec = {
  kind: "records",
  sync: "all",
  labelPath: "label",
  newRecord: { label: "", model: "prop_table_01", price: 100, category: "misc" },
  sections: {
    label: { type: "text", min: 1, max: 48 },
    model: { type: "text", min: 2, max: 64 },
    price: { type: "number", min: 0, max: 1000000, integer: true },
    category: { type: "text", min: 1, max: 24 },
  },
};

export const furnitureTab: TabSpec = {
  id: "furniture",
  file: "furniture",
  icon: "couch",
  label: "ADMIN_TAB_FURNITURE",
  desc: "ADMIN_TAB_FURNITURE_DESC",
  createLabel: "ADMIN_NEW_FURNITURE",
  deleteLabel: "ADMIN_DELETE_FURNITURE",
  cards: [
    {
      icon: "couch",
      title: "ADMIN_C_FURNITURE",
      desc: "ADMIN_C_FURNITURE_DESC",
      fields: [
        {
          widget: "text",
          path: "label",
          label: "ADMIN_F_LABEL",
          placeholder: "ADMIN_P_LABEL",
        },
        {
          widget: "text",
          path: "model",
          label: "ADMIN_F_MODEL",
          placeholder: "prop_table_01",
        },
        {
          widget: "number",
          path: "price",
          label: "ADMIN_F_PRICE",
          min: 0,
          max: 1000000,
          unit: "$",
        },
        {
          widget: "text",
          path: "category",
          label: "ADMIN_F_CATEGORY",
          placeholder: "misc",
        },
      ],
    },
  ],
};