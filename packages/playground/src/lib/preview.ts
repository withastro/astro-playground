import type { CompileResult } from "@astrojs/compiler-binding";
import type { ParsedAst } from "./compiler-protocol";
import type {
	PreviewRenderRequest,
	PreviewRenderResponse,
} from "./preview-protocol";

interface ActiveRender {
	controller: AbortController;
	timer: ReturnType<typeof setTimeout>;
}

interface AstNode {
	type?: unknown;
	source?: {
		value?: unknown;
	};
}

function moduleSyntaxError(ast: unknown): string | null {
	const stack: unknown[] = [ast];
	const seen = new WeakSet<object>();

	while (stack.length > 0) {
		const value = stack.pop();
		if (!value || typeof value !== "object" || seen.has(value)) continue;
		seen.add(value);

		const node = value as AstNode;
		if (node.type === "ImportDeclaration") {
			const specifier = node.source?.value;
			return typeof specifier === "string"
				? `Imports are not supported in Preview: ${specifier}`
				: "Imports are not supported in Preview.";
		}
		if (node.type === "ImportExpression") {
			return "Dynamic imports are not supported in Preview.";
		}
		if (
			(node.type === "ExportAllDeclaration" ||
				node.type === "ExportNamedDeclaration") &&
			node.source
		) {
			return "Re-exports are not supported in Preview.";
		}

		for (const child of Object.values(value)) {
			if (child && typeof child === "object") stack.push(child);
		}
	}

	return null;
}

export function validatePreview(
	result: CompileResult,
	ast: ParsedAst,
): string | null {
	if (
		result.diagnostics.some((diagnostic) => diagnostic.severity === "error")
	) {
		return "Fix compiler errors before rendering the preview.";
	}

	const syntaxError = moduleSyntaxError(ast.ast);
	if (syntaxError) return syntaxError;

	if (
		result.hydratedComponents.length > 0 ||
		result.clientOnlyComponents.length > 0
	) {
		return "Framework components and client directives are not supported in Preview.";
	}
	if (result.serverComponents.length > 0) {
		return "Server islands are not supported in Preview.";
	}
	if (result.scripts.some((script) => script.type === "external")) {
		return "External scripts are not supported in Preview.";
	}

	return null;
}

export function createPreviewDocument(html: string): string {
	const document = new DOMParser().parseFromString(html, "text/html");
	const csp = document.createElement("meta");
	csp.httpEquiv = "Content-Security-Policy";
	csp.content = [
		"default-src 'none'",
		"base-uri 'none'",
		"script-src 'unsafe-inline'",
		"style-src 'unsafe-inline'",
		"img-src data: blob:",
		"media-src data: blob:",
		"font-src data:",
		"connect-src 'none'",
		"form-action 'none'",
	].join("; ");

	const viewport = document.createElement("meta");
	viewport.name = "viewport";
	viewport.content = "width=device-width, initial-scale=1";

	document.head.prepend(csp, viewport);

	return `<!doctype html>\n${document.documentElement.outerHTML}`;
}

export interface PreviewClientOptions {
	endpoint?: string;
	fetch?: typeof globalThis.fetch;
	timeoutMs?: number;
}

export class PreviewClient {
	#active: ActiveRender | null = null;
	#endpoint: string;
	#fetch: typeof globalThis.fetch;
	#timeoutMs: number;

	constructor(options: PreviewClientOptions = {}) {
		this.#endpoint = options.endpoint ?? "/api/render";
		this.#fetch = options.fetch ?? globalThis.fetch.bind(globalThis);
		this.#timeoutMs = options.timeoutMs ?? 5000;
	}

	async render(result: CompileResult): Promise<string> {
		this.cancel();

		const controller = new AbortController();
		const timer = setTimeout(() => {
			controller.abort(
				new Error(`Preview timed out after ${this.#timeoutMs}ms.`),
			);
		}, this.#timeoutMs);
		this.#active = { controller, timer };

		const request: PreviewRenderRequest = {
			code: result.code,
			scripts: result.scripts.map((script) =>
				script.type === "inline"
					? { type: "inline", code: script.code }
					: { type: "external", src: script.src },
			),
			containsHead: result.containsHead,
			propagation: result.propagation,
		};

		try {
			const response = await this.#fetch(this.#endpoint, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(request),
				signal: controller.signal,
			});
			const payload = (await response.json()) as PreviewRenderResponse;
			if (!payload || typeof payload !== "object" || !("ok" in payload)) {
				throw new Error("The preview server returned an invalid response.");
			}
			if (!response.ok || !payload.ok) {
				throw new Error(
					"error" in payload
						? payload.error
						: "The preview server returned an error.",
				);
			}
			return payload.html;
		} catch (error) {
			if (
				controller.signal.aborted &&
				controller.signal.reason instanceof Error
			) {
				throw controller.signal.reason;
			}
			throw error;
		} finally {
			if (this.#active?.controller === controller) this.#active = null;
			clearTimeout(timer);
		}
	}

	cancel(): void {
		const active = this.#active;
		if (!active) return;
		this.#active = null;
		clearTimeout(active.timer);
		active.controller.abort(new Error("Preview cancelled."));
	}

	dispose(): void {
		this.cancel();
	}
}

export const preview = new PreviewClient();
