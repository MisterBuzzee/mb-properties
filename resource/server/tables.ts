// Generated from sql/main.sql by aicore-db-types (the build runs it). Do not edit: change the SQL and build.

/** Row of each table as @aicore-fivem/mysql returns it. */
export type Tables = {
  mb_properties_owned: {
    property: string;
    char_id: number;
    owner_name: string;
    price: number;
    bought_at: number;
  };
  mb_properties_keys: {
    property: string;
    char_id: number;
    name: string;
  };
};

/** What an INSERT needs: columns with a default, NULL or AUTO_INCREMENT may be left out. */
export type TableInserts = {
  mb_properties_owned: {
    property: string;
    char_id: number;
    owner_name: string;
    price: number;
    bought_at?: number;
  };
  mb_properties_keys: {
    property: string;
    char_id: number;
    name: string;
  };
};
