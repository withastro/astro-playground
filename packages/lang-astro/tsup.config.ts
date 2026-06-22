import { defineConfig } from "tsup";

export default defineConfig({
	entry: ["src/index.ts"],
	format: ["esm"],
	dts: true,
	clean: true,
	// Peer deps stay external; the generated parser/terms/tokens are bundled in.
	external: [
		"@codemirror/language",
		"@lezer/common",
		"@lezer/highlight",
		"@lezer/lr",
		"@lezer/javascript",
		"@lezer/css",
	],
});
