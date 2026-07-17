import { copyFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");

copyFileSync(resolve(root, "src", "injected.js"), resolve(root, "extension", "injected.js"));
copyFileSync(resolve(root, "src", "rtl-core.js"), resolve(root, "extension", "rtl-core.js"));
copyFileSync(resolve(root, "src", "rtl-style.css"), resolve(root, "extension", "rtl-style.css"));

console.log("Synced shared RTL assets into extension/.");
