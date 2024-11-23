import { defineConfig } from "tsup";

export default defineConfig({
    entry: ["src/index.ts"],
    outDir: "dist",
    sourcemap: true,
    clean: true,
    format: ["esm"],
    external: [
        "dotenv",
        "fs",
        "path",
        "http",
        "https",
        "util", // Add util to external
        "stream", // Add stream
        "combined-stream",
        "form-data",
        "events",
        "crypto",
        "os"
    ],
    noExternal: [], // Clear noExternal if set
    target: 'node22'
});