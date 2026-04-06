import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "path";
import pkg from "./package.json";

const appVersion = JSON.stringify(pkg.version);

// Standalone React DevTools (optional, similar to electron.vite.config.ts)
const useStandaloneReactDevTools = process.env.KONOMI_REACT_DEVTOOLS === "1";
function standaloneReactDevToolsPlugin() {
  return {
    name: "konomi:standalone-react-devtools",
    apply: "serve" as const,
    transformIndexHtml: {
      order: "pre" as const,
      handler(html: string) {
        if (!useStandaloneReactDevTools) return html;
        return {
          html: html.replace(
            "script-src 'self';",
            "script-src 'self' http://localhost:8097;"
          ),
          tags: [
            {
              tag: "script",
              attrs: { src: "http://localhost:8097" },
              injectTo: "head-prepend" as const,
            },
          ],
        };
      },
    },
  };
}

export default defineConfig({
  root: resolve(__dirname, "src/renderer"),
  define: {
    __APP_VERSION__: appVersion,
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "src/renderer/src"),
      "@preload": resolve(__dirname, "src/preload"),
    },
  },
  plugins: [tailwindcss(), standaloneReactDevToolsPlugin(), react()],
  server: {
    port: 5173,
    host: true,
    allowedHosts: true, // 모든 외부 IP/도메인 접속 허용
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/local': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://localhost:3000',
        ws: true,
      }
    }
  },
  build: {
    outDir: resolve(__dirname, "dist"),
    emptyOutDir: true,
  }
});
