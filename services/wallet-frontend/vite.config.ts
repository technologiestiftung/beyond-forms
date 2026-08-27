/* global process */
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { searchForWorkspaceRoot } from "vite";

// https://vite.dev/config/
export default defineConfig({
	plugins: [react(), tailwindcss()],
	server: {
		fs: { allow: [searchForWorkspaceRoot(process.cwd()), "../../demo"] },
		hmr: !process.env.VITE_E2E_TEST,
		proxy: {
			"/auth-proxy": {
				target: process.env.AUTH_PROXY_URL || "http://localhost:8003",
				changeOrigin: true,
				rewrite: (path) => path.replace(/^\/auth-proxy/, ""),
			},
			"/api": {
				target: process.env.API_PROXY_URL || "http://localhost:8080",
				changeOrigin: true,
				ws: !process.env.VITE_E2E_TEST,
				rewrite: (path) => path.replace(/^\/api/, ""),
			},
		},
	},
	build: {
		rollupOptions: {
			output: {
				manualChunks(id) {
					if (id.includes("node_modules")) {
						return "vendor";
					}
					return undefined;
				},
			},
		},
	},
	test: {
		globals: true,
		environment: "jsdom",
		setupFiles: ["./src/tests/vitest.setup.ts"],
	},
});
