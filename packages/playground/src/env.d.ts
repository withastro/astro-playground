/// <reference types="astro/client" />

// The WASM binding (`@astrojs/compiler-binding-wasm32-wasi`) ships no type
// declarations, but its runtime API is identical to the native binding's.
// Re-export those types so imports from the WASM package are fully typed.
declare module '@astrojs/compiler-binding-wasm32-wasi' {
	export * from '@astrojs/compiler-binding';
}
