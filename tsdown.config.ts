import { existsSync } from "node:fs";
import { defineConfig, type UserConfig } from "tsdown";
import postBuild from "./scripts/postBuild.ts";

const config: Record<string, UserConfig> = {
  resource: {
    outExtensions() {
      return { js: ".js" };
    },
    // Maps sit next to the bundles but are never listed in `files` (players cannot download them); ai-core maps
    // client error stacks back to the source with them.
    sourcemap: "hidden",
    outputOptions: {
      entryFileNames: "[name].js",
    },
    // FiveM loads one file per side: every import, the @aicore-fivem packages included, is bundled in.
    // These must be RegExp; tsdown treats a string like "/.*/" as a literal package name.
    deps: {
      alwaysBundle: [/.*/],
      onlyBundle: false,
      neverBundle: [/^public\//],
    },
  },

  client: {
    platform: "browser",
    target: "es2023",
    format: "iife",
    minify: true,
  },

  server: {
    platform: "node",
    format: "cjs",
    // Comments and dead code go; names and lines stay, so FXServer's error lines stay readable without a map.
    minify: {
      compress: true,
      mangle: false,
      codegen: { removeWhitespace: false },
    },
    // Readable as it is; a map would only add a large committed file nothing reads.
    sourcemap: false,
    outputOptions: {
      // FXServer runs server scripts inside a CommonJS wrapper whose `exports` parameter shadows the
      // FiveM `exports` function; our exports need the global one.
      banner: "exports = globalThis.exports;",
      comments: false,
    },
    plugins: [
      {
        // mysql2 tries an optional `require("cardinal")` (debug highlighting) at load; the FXServer sandbox
        // prints a permission warning for the lookup. The call sits in a try/catch, so it is replaced by a throw.
        name: "aicore-no-cardinal",
        transform(code: string, id: string) {
          if (!id.replaceAll("\\", "/").endsWith("mysql2/lib/helpers.js"))
            return null;
          // map null: the one-line swap moves nothing the source map needs.
          return {
            code: code.replace(
              /require\(`cardinal\$\{REQUIRE_TERMINATOR\}`\)/,
              '(() => { throw new Error("cardinal disabled"); })()',
            ),
            map: null,
          };
        },
      },
    ],
  },
};

function createConfig(name: string): UserConfig {
  return {
    name,
    entry: {
      [name]: `./resource/${name}/index.ts`,
    },
    tsconfig: `./resource/${name}/tsconfig.json`,
    ...config.resource,
    ...config[name],
    outputOptions: {
      ...config.resource?.outputOptions,
      ...config[name]?.outputOptions,
    },
    onSuccess: postBuild,
  };
}

// A side without resource/<side>/index.ts builds no bundle (a server-only or client-only resource).
const sides = ["client", "server"].filter((side) =>
  existsSync(`./resource/${side}/index.ts`),
);

export default defineConfig(sides.map(createConfig));
