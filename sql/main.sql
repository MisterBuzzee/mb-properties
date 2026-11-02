-- Tables of this resource: CREATE TABLE IF NOT EXISTS, names prefixed with the resource (ai_<name>_...),
-- every table ending with ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;".
-- Installed by createDatabaseTables on start: missing tables and columns are added, nothing is dropped,
-- keys are only created with a new table (plan indexes before the first release).

-- Owned properties: `property` is the panel record id, char_id = ai_core_characters.id of the owner.
-- owner_name is the name at purchase, shown without a join. One row per owned property, loaded at start.
CREATE TABLE IF NOT EXISTS `mb_properties_owned` (
  `property` VARCHAR(48) NOT NULL,
  `char_id` INT UNSIGNED NOT NULL,
  `owner_name` VARCHAR(64) NOT NULL,
  `price` INT UNSIGNED NOT NULL,
  `bought_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`property`),
  KEY `char_id` (`char_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Characters the owner gave a key to. Deleted with the property when it is sold.
CREATE TABLE IF NOT EXISTS `mb_properties_keys` (
  `property` VARCHAR(48) NOT NULL,
  `char_id` INT UNSIGNED NOT NULL,
  `name` VARCHAR(64) NOT NULL,
  PRIMARY KEY (`property`, `char_id`),
  KEY `char_id` (`char_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Placed furniture inside a property. Re-spawned for everyone who enters.
CREATE TABLE IF NOT EXISTS mb_properties_furniture (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  property VARCHAR(48) NOT NULL,
  model VARCHAR(64) NOT NULL,
  x DOUBLE NOT NULL,
  y DOUBLE NOT NULL,
  z DOUBLE NOT NULL,
  heading DOUBLE NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  KEY property (property)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;