import { spec } from "@aicore-fivem/lib/shared";
import type { FileSpec, TabSpec } from "@aicore-fivem/shared";
import { blip } from "./blip";

export const settingsFile: FileSpec = {
  kind: "settings",
  sync: "all",
  sections: {
    account: { type: "text", lookup: "account", min: 2, max: 32 },
    sellPercent: spec.int(0, 100),
    policeJobs: {
      type: "names",
      lookup: "job",
      max: 10,
      itemMax: 32,
      pattern: "^[a-z0-9_]{2,32}$",
    },
    policeEnter: { type: "bool" },
    stashSlots: spec.int(1, 200),
    stashWeight: spec.int(1000, 10_000_000),
    ownedBlip: blip,
    saleBlip: blip,
  },
};

export const settingsTab: TabSpec = {
  id: "settings",
  file: "settings",
  icon: "sliders",
  label: "ADMIN_TAB_SETTINGS",
  desc: "ADMIN_TAB_SETTINGS_DESC",
  cards: [
    {
      icon: "sliders",
      title: "ADMIN_C_SETTINGS",
      desc: "ADMIN_C_SETTINGS_DESC",
      fields: [
        {
          widget: "text",
          lookup: "account",
          path: "account",
          label: "ADMIN_F_ACCOUNT",
          hint: "ADMIN_H_ACCOUNT",
          placeholder: "ADMIN_P_ACCOUNT",
        },
        {
          widget: "number",
          path: "sellPercent",
          label: "ADMIN_F_SELL",
          hint: "ADMIN_H_SELL",
          min: 0,
          max: 100,
          unit: "%",
        },
        {
          widget: "number",
          path: "stashSlots",
          label: "ADMIN_F_STASH_SLOTS",
          min: 1,
          max: 200,
        },
        {
          widget: "number",
          path: "stashWeight",
          label: "ADMIN_F_STASH_WEIGHT",
          hint: "ADMIN_H_STASH_WEIGHT",
          min: 1000,
          max: 10_000_000,
          unit: "g",
        },
        {
          widget: "switch",
          path: "policeEnter",
          label: "ADMIN_F_POLICE_ENTER",
          hint: "ADMIN_H_POLICE_ENTER",
        },
        {
          widget: "tags",
          lookup: "job",
          path: "policeJobs",
          label: "ADMIN_F_POLICE_JOBS",
          placeholder: "ADMIN_P_POLICE_JOBS",
        },
        {
          widget: "blip",
          path: "ownedBlip",
          label: "ADMIN_F_OWNED_BLIP",
          hint: "ADMIN_H_OWNED_BLIP",
        },
        {
          widget: "blip",
          path: "saleBlip",
          label: "ADMIN_F_SALE_BLIP",
          hint: "ADMIN_H_SALE_BLIP",
        },
      ],
    },
  ],
};
