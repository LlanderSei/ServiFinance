import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";
var rootDir = path.dirname(fileURLToPath(import.meta.url));
export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            "@": path.resolve(rootDir, "./src")
        }
    },
    server: {
        port: 5173,
        proxy: {
            "/api": "https://localhost:7050",
            "/account": "https://localhost:7050",
            "/_framework": "https://localhost:7050"
        }
    }
});
