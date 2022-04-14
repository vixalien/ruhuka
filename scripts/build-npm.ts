// ex. scripts/build_npm.ts
import { build, emptyDir } from "https://deno.land/x/dnt@0.23.0/mod.ts";

await emptyDir("./npm");

await build({
  entryPoints: ["./mod.ts"],
  outDir: "./npm",
  shims: {
    // see JS docs for overview and more options
    deno: false,
  },
  packageManager: "yarn",
  test: false,
  package: {
    name: "ruhuka",
    description: "A small REST API Client",
    version: Deno.args[0],
    license: "MIT",
    repository: {
      type: "git",
      url: "git+https://github.com/vixalien/ruhuka.git",
    },
    bugs: {
      url: "https://github.com/vixalien/ruhuka/issues",
    },
  }
});

// post build steps
Deno.copyFileSync("README.md", "npm/README.md");