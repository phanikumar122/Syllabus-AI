import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vite";
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": path.resolve(import.meta.dirname, ".") } },
  server: {
    hmr: process.env.DISABLE_HMR !== "true",
    proxy: { "/api": "http://127.0.0.1:3001" },
  },
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: "firebase-store",
              test: /node_modules[\\/]@firebase[\\/]firestore/,
            },
            {
              name: "firebase-auth",
              test: /node_modules[\\/]@firebase[\\/]auth/,
            },
          ],
        },
      },
    },
  },
});
