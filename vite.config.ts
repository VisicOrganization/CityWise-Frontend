import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";


function getBasePath() {
  if (process.env.DEPLOY_TARGET !== "github-pages") {
    return "/";
  }

  const repositoryName = process.env.GITHUB_REPOSITORY?.split("/")[1];
  return repositoryName ? `/${repositoryName}/` : "/";
}

export default defineConfig({
  base: getBasePath(),
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
  },
});
