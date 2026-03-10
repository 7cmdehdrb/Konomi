import { resolve } from "path";
import { builtinModules } from "module";
import { defineConfig } from "electron-vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Packages that must remain external (native addons or complex runtime deps)
const externalPackages = [
  "better-sqlite3",
  "@prisma/client",
  "@prisma/adapter-better-sqlite3",
];

export default defineConfig({
  main: {
    resolve: {
      alias: {
        "@": resolve("src/renderer/src"),
      },
    },
    build: {
      rollupOptions: {
        external: (id: string) => {
          if (id === "electron") return true;
          if (builtinModules.includes(id) || id.startsWith("node:"))
            return true;
          return externalPackages.some(
            (pkg) => id === pkg || id.startsWith(pkg + "/"),
          );
        },
        input: {
          index: resolve("src/main/index.ts"),
          "nai.worker": resolve("src/main/lib/nai.worker.ts"),
          "phash.worker": resolve("src/main/lib/phash.worker.ts"),
          utility: resolve("src/main/utility.ts"),
        },
      },
    },
  },
  preload: {},
  renderer: {
    resolve: {
      alias: {
        "@": resolve("src/renderer/src"),
        "@preload": resolve("src/preload"),
      },
    },
    plugins: [tailwindcss(), react()],
  },
});
