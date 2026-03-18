import fs from "fs";
import os from "os";
import path from "path";

function resolveAppDataDir() {
  const overridePath = (process.env.KONOMI_DEV_USER_DATA_PATH ?? "").trim();
  if (overridePath) {
    return overridePath;
  }

  if (process.platform === "win32") {
    const appDataDir =
      (process.env.APPDATA ?? "").trim() ||
      path.join(os.homedir(), "AppData", "Roaming");
    return path.join(appDataDir, "konomi-dev");
  }

  if (process.platform === "darwin") {
    return path.join(
      os.homedir(),
      "Library",
      "Application Support",
      "konomi-dev",
    );
  }

  const xdgConfigHome = (process.env.XDG_CONFIG_HOME ?? "").trim();
  const configHome = xdgConfigHome || path.join(os.homedir(), ".config");
  return path.join(configHome, "konomi-dev");
}

const targetPath = resolveAppDataDir();
const isDryRun = process.argv.includes("--dry-run");

console.log(`[db:init] target: ${targetPath}`);

if (!fs.existsSync(targetPath)) {
  console.log("[db:init] nothing to reset");
  process.exit(0);
}

if (isDryRun) {
  console.log("[db:init] dry run, skipping delete");
  process.exit(0);
}

fs.rmSync(targetPath, { recursive: true, force: true });
console.log("[db:init] removed dev user data");
