"use strict";
const path = require("path");
const fs = require("fs");
const root = process.env.LIBPNG_ROOT || "";
if (!root) {
  process.stderr.write("LIBPNG_ROOT is not set\n");
  process.exit(1);
}

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
  // libpng (vcpkg x64-windows-static naming)
  const pngLib = findLib(libDir, [
    "libpng16.lib",
    "libpng16_static.lib",
    "libpng.lib",
  ]);
  // zlib (required for static link of libpng on Windows)
  const zlibLib = findLib(libDir, [
    "zlib.lib",
    "zlibstatic.lib",
    "zlib_static.lib",
  ]);
  // node-gyp <!@(...) splits on whitespace — two paths → two library entries
  process.stdout.write(`${pngLib} ${zlibLib}`);
} else if (process.platform === "linux") {
  // Linux distro static libpng is often not built with -fPIC, so link the shared lib.
  const pngLib = findLib(libDir, [
    "libpng.so",
    "libpng16.so",
    "libpng16.so.16",
  ]);
  process.stdout.write(pngLib);
} else {
  const pngLib = findLib(libDir, ["libpng.a", "libpng16.a", "libpng.dylib"]);
  process.stdout.write(pngLib);
}
