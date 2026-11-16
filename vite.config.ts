import { defineConfig } from "vitest/config";

// Static, relative-path build so the studio can be hosted on any static host
// (GitHub Pages, Netlify, Vercel) under any sub-path.
export default defineConfig({
  base: "./",
  build: {
    target: "es2022",
    sourcemap: true,
  },
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
  },
});
