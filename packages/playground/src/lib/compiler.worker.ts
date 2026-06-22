/// <reference lib="webworker" />
//
// Dedicated Web Worker that runs the Astro Rust compiler's WASM build.
//
// Isolating the compiler in its own worker means a Rust panic (the release
// build is compiled with `panic = "abort"`, which traps the WASM instance) or
// a pathological infinite loop never freezes the UI: the main thread can simply
// terminate and respawn this worker.
//
// The binding import below uses a top-level `await` to fetch + instantiate the
// WASM module. Because of that, the main thread must wait for the `ready`
// message before posting requests (see `compiler.ts`).
import {
	compileAstroSync,
	extractStylesSync,
	parseAstroSync,
} from '@astrojs/compiler-binding-wasm32-wasi';
import type { CompilerRequest, CompilerResponse } from './compiler-protocol';

const ctx = self as unknown as DedicatedWorkerGlobalScope;

function post(message: CompilerResponse) {
	ctx.postMessage(message);
}

// Surface otherwise-invisible failures (e.g. a WASM trap) to the main thread.
ctx.addEventListener('unhandledrejection', (event) => {
	post({ type: 'debug', message: `unhandledrejection: ${String(event.reason)}` });
});

post({ type: 'ready' });

ctx.onmessage = (event: MessageEvent<CompilerRequest>) => {
	const request = event.data;
	try {
		let result: unknown;
		switch (request.type) {
			case 'compile':
				result = compileAstroSync(request.source, request.options);
				break;
			case 'parse': {
				const parsed = parseAstroSync(request.source);
				// Parse the (potentially large) AST JSON here, off the main thread.
				result = { ast: JSON.parse(parsed.ast), diagnostics: parsed.diagnostics };
				break;
			}
			case 'extractStyles':
				result = extractStylesSync(request.source);
				break;
		}
		post({ type: 'result', id: request.id, ok: true, result });
	} catch (error) {
		post({
			type: 'result',
			id: request.id,
			ok: false,
			error: error instanceof Error ? error.message : String(error),
		});
	}
};
