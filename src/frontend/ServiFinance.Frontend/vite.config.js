import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";
import { fileURLToPath } from "node:url";
var rootDir = path.dirname(fileURLToPath(import.meta.url));
export default defineConfig({
    plugins: [tailwindcss(), react()],
    build: {
        outDir: "../../backend/ServiFinance.Api/wwwroot/frontend",
        emptyOutDir: true,
        rollupOptions: {
            output: {
                entryFileNames: "assets/[name]-[hash].js",
                chunkFileNames: "assets/[name]-[hash].js",
                manualChunks: {
                    "react-vendor": ["react", "react-dom", "react-router-dom"],
                    "query-vendor": ["@tanstack/react-query"]
                },
                assetFileNames: function (assetInfo) {
                    var _a;
                    return ((_a = assetInfo.name) === null || _a === void 0 ? void 0 : _a.endsWith(".css"))
                        ? "assets/[name]-[hash][extname]"
                        : "assets/[name]-[hash][extname]";
                }
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
