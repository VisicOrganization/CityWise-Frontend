import { defineConfig, defaultExclude } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  base: "/", // Use root path for custom domain
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      // Same-origin /nominatim/search in dev (avoids browser CORS to openstreetmap.org).
      "/nominatim": {
        target: "https://nominatim.openstreetmap.org",
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/nominatim/, ""),
      },
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
    exclude: [...defaultExclude, "**/.claude/**"],
  },
});
