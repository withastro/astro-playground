import cloudflare from "@astrojs/cloudflare";
import svelte from "@astrojs/svelte";
import { defineConfig } from "astro/config";
import { searchForWorkspaceRoot } from "vite";

/**
 * The Rust compiler's WASM build (`wasm32-wasip1-threads`) instantiates a
 * SharedArrayBuffer + Web Worker, which requires the page to be
 * cross-origin isolated. In production these headers are served on the
 * prerendered HTML via `public/_headers`.
 */
const COI_HEADERS = {
	"Cross-Origin-Opener-Policy": "same-origin",
	"Cross-Origin-Embedder-Policy": "credentialless",
};

/**
 * Force COOP/COEP on every dev/preview response — including the HTML document,
 * which the Cloudflare dev middleware renders and serves without picking up
 * Astro's `server.headers`. We unshift to the front of the connect stack so it
 * runs before the Cloudflare middleware writes the response.
 */
function crossOriginIsolation() {
	const apply = (server) => {
		server.middlewares.stack.unshift({
			route: "",
			handle: (_req, res, next) => {
				for (const [key, value] of Object.entries(COI_HEADERS)) {
					res.setHeader(key, value);
				}
				next();
			},
		});
	};
	return {
		name: "playground:cross-origin-isolation",
		configureServer: apply,
		configurePreviewServer: apply,
	};
}

// https://astro.build/config
export default defineConfig({
	integrations: [svelte()],
	adapter: cloudflare(),
	server: {
		headers: COI_HEADERS,
	},
	vite: {
		plugins: [crossOriginIsolation()],
		// The WASM binding ships hand-written browser glue that uses
		// `new URL('./x.wasm', import.meta.url)` and `new Worker(new URL(...))`.
		// Pre-bundling rewrites those URLs and breaks them, so exclude it.
		optimizeDeps: {
			exclude: ["@astrojs/compiler-binding-wasm32-wasi"],
		},
		worker: {
			format: "es",
		},
		build: {
			// CodeMirror + the compiler island are legitimately large single chunks.
			chunkSizeWarningLimit: 2000,
		},
		server: {
			fs: {
				// In a pnpm monorepo the hoisted WASM package lives at the workspace
				// root, outside this package — allow Vite's dev server to serve it.
				allow: [searchForWorkspaceRoot(process.cwd())],
			},
		},
	},
});
