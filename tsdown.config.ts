import { existsSync } from "node:fs";
import { defineConfig, type UserConfig } from "tsdown";
import postBuild from "./scripts/postBuild.ts";

const config: Record<string, UserConfig> = {
  resource: {
    outExtensions() {
      return { js: ".js" };
    },
    sourcemap: "hidden",
    outputOptions: {
      entryFileNames: "[name].js",
    },
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
    minify: {
      compress: true,
      mangle: false,
      codegen: { removeWhitespace: false },
    },
    sourcemap: false,
    outputOptions: {
      banner: "exports = globalThis.exports;",
      comments: false,
    },
    plugins: [
      {
        name: "aicore-no-cardinal",
        transform(code: string, id: string) {
          if (!id.replaceAll("\\", "/").endsWith("mysql2/lib/helpers.js"))
            return null;
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

const sides = ["client", "server"].filter((side) =>
  existsSync(`./resource/${side}/index.ts`),
);

export default defineConfig(sides.map(createConfig));