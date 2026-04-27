import { defineConfig, defaultExclude } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  base: "/", // Use root path for custom domain
  plugins: [react(), tailwindcss()],
  test: {
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
    exclude: [...defaultExclude, "**/.claude/**"],
    /** Align with map/geocode test mocks; avoids machine-specific `.env` breaking CI. */
    env: {
      VITE_API_BASE_URL: "http://localhost:18100",
    },
  },
});
