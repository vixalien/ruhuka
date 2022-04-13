// @ts-check
const { build } = require("esbuild");

build({
  entryPoints: ["src/index.ts"],
  outdir: "dist",
  format: "cjs",
  bundle: true,
})