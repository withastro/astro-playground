import type { convertToTsx as ConvertToTsx } from "@astrojs/astro2tsx";
import wasmUrl from "@astrojs/astro2tsx/astro2tsx.wasm32-wasi.wasm?url";
import {
	getDefaultContext,
	instantiateNapiModuleSync,
	WASI,
} from "@napi-rs/wasm-runtime";

const wasi = new WASI({ version: "preview1" });
const memory = new WebAssembly.Memory({
	initial: 4000,
	maximum: 65536,
	shared: true,
});
const wasm = await fetch(wasmUrl).then((response) => response.arrayBuffer());
const { napiModule } = instantiateNapiModuleSync(wasm, {
	context: getDefaultContext(),
	wasi,
	overwriteImports(importObject: Record<string, Record<string, unknown>>) {
		importObject.env = {
			...importObject.env,
			...importObject.napi,
			...importObject.emnapi,
			memory,
		};
		return importObject;
	},
	beforeInit({ instance }: { instance: WebAssembly.Instance }) {
		for (const name of Object.keys(instance.exports)) {
			if (name.startsWith("__napi_register__")) {
				(instance.exports[name] as CallableFunction)();
			}
		}
	},
});

export const convertToTsx = napiModule.exports
	.convertToTsx as typeof ConvertToTsx;
