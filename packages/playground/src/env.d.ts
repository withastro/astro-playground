/// <reference types="astro/client" />

declare module "virtual:preview-worker-source" {
	const bundle: {
		mainModule: string;
		modules: Record<string, string>;
	};
	export default bundle;
}

declare module "cloudflare:workers" {
	export const env: Env;
}

// The WASM binding (`@astrojs/compiler-binding-wasm32-wasi`) ships no type
// declarations, but its runtime API is identical to the native binding's.
// Re-export those types so imports from the WASM package are fully typed.
declare module "@astrojs/compiler-binding-wasm32-wasi" {
	export * from "@astrojs/compiler-binding";
}

// The WASM runtime does not publish TypeScript declarations.
declare module "@napi-rs/wasm-runtime";
