// Main-thread client for the dedicated compiler worker.
//
// Provides a promise-based API over `compiler.worker.ts` with:
//   - a ready handshake: the worker uses top-level `await` to instantiate WASM,
//     so requests are queued until it posts `ready` (messages sent during that
//     window are otherwise dropped by the browser)
//   - per-request timeouts (terminate + respawn on hang / infinite loop)
//   - automatic respawn when the worker crashes (e.g. a Rust panic traps WASM)
import type {
	CompileOptions,
	CompileResult,
	CompilerRequest,
	CompilerResponse,
	ParsedAst,
	StyleBlock,
} from './compiler-protocol';

interface Pending {
	resolve: (value: unknown) => void;
	reject: (reason: unknown) => void;
	timer: ReturnType<typeof setTimeout>;
}

export interface CompilerClientOptions {
	/** Per-request timeout (ms). On timeout the worker is terminated + respawned. */
	timeoutMs?: number;
}

export class CompilerClient {
	#worker: Worker | null = null;
	#workerReady = false;
	#seq = 0;
	#pending = new Map<number, Pending>();
	/** Requests created before the worker signalled `ready`, flushed on ready. */
	#outbox: CompilerRequest[] = [];
	#timeoutMs: number;
	#ready = false;
	#readyListeners = new Set<(ready: boolean) => void>();

	constructor(options: CompilerClientOptions = {}) {
		this.#timeoutMs = options.timeoutMs ?? 8000;
	}

	get isReady(): boolean {
		return this.#ready;
	}

	/** Subscribe to readiness changes. Fires immediately with the current state. */
	subscribeReady(listener: (ready: boolean) => void): () => void {
		this.#readyListeners.add(listener);
		listener(this.#ready);
		return () => this.#readyListeners.delete(listener);
	}

	#setReady(ready: boolean) {
		if (this.#ready === ready) return;
		this.#ready = ready;
		for (const listener of this.#readyListeners) listener(ready);
	}

	#spawn(): Worker {
		this.#workerReady = false;
		const worker = new Worker(new URL('./compiler.worker.ts', import.meta.url), {
			type: 'module',
			name: 'astro-compiler',
		});
		worker.onmessage = (event: MessageEvent<CompilerResponse>) => this.#onMessage(event.data);
		worker.onerror = () => this.#crash(new Error('The Astro compiler worker crashed.'));
		worker.onmessageerror = () =>
			this.#crash(new Error('The Astro compiler worker sent an invalid message.'));
		this.#worker = worker;
		return worker;
	}

	#onMessage(message: CompilerResponse) {
		if (message.type === 'debug') {
			console.debug('[compiler.worker]', message.message);
			return;
		}
		if (message.type === 'ready') {
			this.#workerReady = true;
			this.#setReady(true);
			// Flush any requests queued while the worker was instantiating WASM.
			const worker = this.#worker;
			if (worker) {
				for (const request of this.#outbox) worker.postMessage(request);
			}
			this.#outbox = [];
			return;
		}
		const pending = this.#pending.get(message.id);
		if (!pending) return;
		this.#pending.delete(message.id);
		clearTimeout(pending.timer);
		if (message.ok) pending.resolve(message.result);
		else pending.reject(new Error(message.error));
	}

	/** Tear down the worker and reject everything in flight. The next call respawns. */
	#crash(error: Error) {
		if (this.#worker) {
			this.#worker.terminate();
			this.#worker = null;
		}
		this.#workerReady = false;
		this.#outbox = [];
		this.#setReady(false);
		for (const pending of this.#pending.values()) {
			clearTimeout(pending.timer);
			pending.reject(error);
		}
		this.#pending.clear();
	}

	#call<T>(request: Omit<CompilerRequest, 'id'>): Promise<T> {
		const worker = this.#worker ?? this.#spawn();
		const id = ++this.#seq;
		const message = { ...request, id } as CompilerRequest;
		return new Promise<T>((resolve, reject) => {
			const timer = setTimeout(() => {
				this.#pending.delete(id);
				this.#crash(new Error(`Compilation timed out after ${this.#timeoutMs}ms.`));
				reject(new Error(`Compilation timed out after ${this.#timeoutMs}ms.`));
			}, this.#timeoutMs);
			this.#pending.set(id, { resolve: resolve as (v: unknown) => void, reject, timer });
			if (this.#workerReady) worker.postMessage(message);
			else this.#outbox.push(message);
		});
	}

	compile(source: string, options?: CompileOptions): Promise<CompileResult> {
		return this.#call<CompileResult>({ type: 'compile', source, options });
	}

	parse(source: string): Promise<ParsedAst> {
		return this.#call<ParsedAst>({ type: 'parse', source });
	}

	extractStyles(source: string): Promise<StyleBlock[]> {
		return this.#call<StyleBlock[]>({ type: 'extractStyles', source });
	}

	dispose(): void {
		this.#crash(new Error('Compiler client disposed.'));
		this.#readyListeners.clear();
	}
}

/** Shared singleton compiler client for the app. */
export const compiler = new CompilerClient();
