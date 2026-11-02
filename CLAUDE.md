# mb-properties

Houses and apartments bought at their door: a private copy of the interior per property (routing bucket), a stash, keys for other characters, selling back, police entry. Depends on ai-core (characters, money, metadata, menu, prompts); uses the active inventory through ai-core's inventory layer (lib `inventory`) for the stash.

## Decisions

- Ownership and keys live in server memory (loaded once) and the DB, indexed per property and per character (a player's `mine` snapshot never walks every owned property; `mine` is rate limited to 2 per 10 s). The owned flag of each property is GlobalState `prop:<id>`, removed (not set false) on a sale; a player's own access is the `mine` snapshot, then `access` deltas.
- A sale deletes the rows first (one transaction) and only then memory and the flag; a failed transaction refuses with `PROP_ERR_SELL` and the property stays owned.
- Routing buckets come from lib `buckets` (ai-core's allocator): taken when the first player enters a property, given back when the last one leaves (exit, sale, drop, logout). On resource stop every player inside goes back to bucket 0 (ai-core frees the buckets); the metadata brings them to the door on the replay.
- Moves: the server switches the bucket and sends `inside(id, to)`; the client teleports with `player.teleport` (fade, collision). Enter / exit fade out before the call, so the switch happens behind a black screen; a refusal fades back in.
- The property a character is inside is ai-core metadata `property`; `onCharacter` `loaded` (also the replay after a restart) moves such a character to the door in bucket 0.
- Door points: one point per property with a label function (buy / enter / locked), kept by lib `RecordObjects`; an ownership or access change re-adds only that property's point (`rebuild(id)`: its blip changes), a panel edit only the edited record, a settings edit (blip looks) and the access snapshot all of them (`rebuildAll`).
- Blip looks of own properties and properties for sale are panel settings (`ownedBlip`, `saleBlip`); `settings` is `sync: "all"` for that (nothing secret in it).
- Only the owner (inside the property) manages keys and sells; key holders enter and open the stash `property_<id>_<owner charId>` (per owner: after a sale the next buyer starts with an empty stash). Key changes wait while a sale is being written. A key goes to the nearest player inside the same property (`nearestPlayerTo`).
- Exception to "no character data in own tables": `owner_name` and the key holders' `name` are kept so the owner's key list shows offline holders without asking ai-core per row (ai-core has no offline name lookup by char id). They may go stale after a rename.

## Contracts

- Events and callbacks: `resource/common/property.ts`. GlobalState `prop:<id>`. Metadata `property`. Tables `ai_properties_owned`, `ai_properties_keys` (`sql/main.sql`).

## Entry points

- Server: door actions (list, buy, enter, exit) `resource/server/door.ts`, inside actions (stash, keys, sell) `server/inside.ts`, who is inside and the buckets `server/interiors.ts`, start / character / stop hooks `server/lifecycle.ts`, ownership store `server/store.ts`, panel `server/content.ts` + `server/schema/` (one file per tab).
- Client: doors and blips `resource/client/homes/homes.ts`, door and inside menus `homes/menus.ts`, its events `homes/index.ts`.
