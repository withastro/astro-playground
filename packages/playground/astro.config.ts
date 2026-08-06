import { fileURLToPath } from "node:url";
import cloudflare from "@astrojs/cloudflare";
import svelte from "@astrojs/svelte";
import { defineConfig } from "astro/config";
import { rolldown } from "rolldown";
import {
	type Connect,
	type Plugin,
	type PreviewServer,
	searchForWorkspaceRoot,
	type UserConfig,
	type ViteDevServer,
} from "vite";

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
function crossOriginIsolation(): Plugin {
	const apply = (server: PreviewServer | ViteDevServer) => {
		const handle: Connect.NextHandleFunction = (_req, res, next) => {
			for (const [key, value] of Object.entries(COI_HEADERS)) {
				res.setHeader(key, value);
			}
			next();
		};
		server.middlewares.stack.unshift({
			route: "",
			handle,
		});
	};
	return {
		name: "playground:cross-origin-isolation",
		configureServer: apply,
		configurePreviewServer: apply,
	};
}

const PREVIEW_WORKER_SOURCE = "virtual:preview-worker-source";
const RESOLVED_PREVIEW_WORKER_SOURCE = `\0${PREVIEW_WORKER_SOURCE}`;

interface PreviewWorkerBundle {
	mainModule: string;
	modules: Record<string, string>;
}

function previewWorkerSource(): Plugin {
	const entryPoint = fileURLToPath(
		new URL("./src/lib/preview-worker.ts", import.meta.url),
	);
	const runtimeEntryPoint = fileURLToPath(
		new URL("./src/lib/preview-runtime.ts", import.meta.url),
	);
	let workerBundle: PreviewWorkerBundle | undefined;

	return {
		name: "playground:preview-worker-source",
		resolveId(id) {
			if (id === PREVIEW_WORKER_SOURCE) return RESOLVED_PREVIEW_WORKER_SOURCE;
		},
		async load(id) {
			if (id !== RESOLVED_PREVIEW_WORKER_SOURCE) return;
			this.addWatchFile(entryPoint);
			this.addWatchFile(runtimeEntryPoint);
			if (!workerBundle) {
				const bundle = await rolldown({
					input: {
						runtime: runtimeEntryPoint,
						worker: entryPoint,
					},
					external: (specifier, importer) =>
						specifier === "./component.js" && importer === entryPoint,
					platform: "neutral",
					resolve: {
						conditionNames: [
							"workerd",
							"worker",
							"browser",
							"import",
							"default",
						],
						mainFields: ["module", "main"],
					},
					transform: {
						define: {
							"process.env.NODE_ENV": JSON.stringify("production"),
						},
					},
				});
				try {
					const result = await bundle.generate({
						chunkFileNames: "chunks/[name]-[hash].js",
						codeSplitting: true,
						entryFileNames: "[name].js",
						format: "es",
					});
					const chunks = result.output.filter(
						(output) => output.type === "chunk",
					);
					if (chunks.length !== result.output.length) {
						throw new Error(
							"Preview worker bundling produced a non-JavaScript asset.",
						);
					}
					const entry = chunks.find(
						(chunk) => chunk.facadeModuleId === entryPoint,
					);
					if (!entry)
						throw new Error("Preview worker bundle has no entry module.");
					workerBundle = {
						mainModule: entry.fileName,
						modules: Object.fromEntries(
							chunks.map((chunk) => [chunk.fileName, chunk.code]),
						),
					};
				} finally {
					await bundle.close();
				}
			}
			return `export default ${JSON.stringify(workerBundle)};`;
		},
		watchChange(id) {
			if (id === entryPoint || id === runtimeEntryPoint)
				workerBundle = undefined;
		},
	};
}

const vite: UserConfig = {
	plugins: [crossOriginIsolation(), previewWorkerSource()],
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
};

// https://astro.build/config
export default defineConfig({
	integrations: [svelte()],
	adapter: cloudflare(),
	server: {
		headers: COI_HEADERS,
	},
	vite,
});
