"use strict";
const path = require("path");
const root = process.env.LIBWEBP_ROOT || "";
if (!root) {
  process.stderr.write("LIBWEBP_ROOT is not set\n");
  process.exit(1);
}
const fs = require("fs");

function findLib(dir, candidates) {
  for (const name of candidates) {
    const p = path.join(dir, name);
    if (fs.existsSync(p)) return p.replace(/\\/g, "/");
  }
  process.stderr.write(
    `Could not find lib among: ${candidates.join(", ")} in ${dir}\n`,
  );
  process.exit(1);
}

const libDir = path.join(root, "lib");

if (process.platform === "win32") {
  process.stdout.write(findLib(libDir, ["libwebp.lib", "webp.lib"]));
} else if (process.platform === "linux") {
  process.stdout.write(
    findLib(libDir, ["libwebp.so", "libwebp.so.7", "libwebp.so.7.1.5"]),
  );
} else {
  process.stdout.write(findLib(libDir, ["libwebp.a", "libwebp.dylib"]));
}
