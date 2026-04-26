import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [tailwindcss(), react()],
  build: {
    outDir: "../../backend/ServiFinance.Api/wwwroot/frontend",
    emptyOutDir: true,
    rollupOptions: {
      output: {
        entryFileNames: "assets/index.js",
        chunkFileNames: "assets/[name].js",
        manualChunks: {
          "react-vendor": ["react", "react-dom", "react-router-dom"],
          "query-vendor": ["@tanstack/react-query"]
        },
        assetFileNames: (assetInfo) => assetInfo.name?.endsWith(".css")
          ? "assets/index.css"
          : "assets/[name][extname]"
      }
    }
  },
  resolve: {
    alias: {
      "@": path.resolve(rootDir, "./src")
    }
  },
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:5228",
      "/account": "http://localhost:5228",
      "/_framework": "http://localhost:5228"
    }
  }
});
