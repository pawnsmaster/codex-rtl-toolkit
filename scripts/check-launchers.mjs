import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = resolve(import.meta.dirname, "..");
const commandFile = resolve(root, "desktop", "Run-CodexRTL.command");
const commandSource = readFileSync(commandFile, "utf8");

if (!commandSource.startsWith("#!/bin/bash\n") || !commandSource.includes("remote-debugging-address=127.0.0.1")) {
  throw new Error("macOS launcher is incomplete.");
}

if (process.platform === "win32") {
  const result = spawnSync("powershell", [
    "-NoProfile", "-ExecutionPolicy", "Bypass", "-File",
    resolve(root, "scripts", "check-powershell.ps1")
  ], { stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status || 1);
} else {
  const result = spawnSync("/bin/bash", ["-n", commandFile], { stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status || 1);
}

console.log("OK: platform launchers parse.");
