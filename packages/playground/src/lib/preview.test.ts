import { compileAstroSync, parseAstroSync } from "@astrojs/compiler-binding";
import { describe, expect, it } from "vitest";
import type { ParsedAst } from "./compiler-protocol";
import { PreviewClient, preparePreviewCode, validatePreview } from "./preview";

const filename = "index.astro";

function compile(source: string, renderable = false) {
	return compileAstroSync(source, {
		filename,
		internalURL: renderable ? "./runtime.js" : undefined,
		resolvePathProvided: renderable || undefined,
	});
}

function parse(source: string): ParsedAst {
	const parsed = parseAstroSync(source);
	return {
		ast: JSON.parse(parsed.ast),
		diagnostics: parsed.diagnostics,
	};
}

describe("preview validation", () => {
	it("accepts a self-contained Astro component", () => {
		const source = `---\nconst greeting = "Hello";\n---\n<h1>{greeting}</h1>`;
		expect(validatePreview(compile(source), parse(source))).toBeNull();
	});

	it("rejects static imports", () => {
		const source = `---\nimport Card from "./Card.astro";\n---\n<Card />`;
		expect(validatePreview(compile(source), parse(source))).toBe(
			"Imports are not supported in Preview: ./Card.astro",
		);
	});

	it("rejects dynamic imports", () => {
		const source = `---\nconst module = await import("./data.js");\n---\n<p>{module}</p>`;
		expect(validatePreview(compile(source), parse(source))).toBe(
			"Dynamic imports are not supported in Preview.",
		);
	});
});

describe("preview client", () => {
	it("prepares compiler output for the Dynamic Worker", () => {
		const result = compile(
			`<h1>Hello</h1><style>h1 { color: red; }</style>`,
			true,
		);
		const prepared = preparePreviewCode(result.code);

		expect(prepared).toContain('from "./runtime.js"');
		expect(prepared).not.toContain("astro&type=style");
	});

	it("posts prepared compiler output to the render endpoint", async () => {
		let request: RequestInit | undefined;
		const client = new PreviewClient({
			fetch: async (_input, init) => {
				request = init;
				return Response.json({ ok: true, html: "<h1>Hello</h1>" });
			},
		});
		const result = compile(
			`<h1>Hello</h1><style>h1 { color: red; }</style>`,
			true,
		);

		await expect(client.render(result)).resolves.toBe("<h1>Hello</h1>");
		expect(request?.method).toBe("POST");
		const body = JSON.parse(String(request?.body));
		expect(body.code).toContain('from "./runtime.js"');
		expect(body.code).not.toContain("astro&type=style");
	});

	it("calls the default fetch with the global receiver", async () => {
		const originalFetch = globalThis.fetch;
		globalThis.fetch = function (this: typeof globalThis) {
			if (this !== globalThis) throw new TypeError("Illegal invocation");
			return Promise.resolve(Response.json({ ok: true, html: "<p>Ready</p>" }));
		};
		try {
			const client = new PreviewClient();
			await expect(client.render(compile("<p>Ready</p>", true))).resolves.toBe(
				"<p>Ready</p>",
			);
		} finally {
			globalThis.fetch = originalFetch;
		}
	});

	it("cancels the active server request", async () => {
		const client = new PreviewClient({
			fetch: (_input, init) =>
				new Promise((_resolve, reject) => {
					init?.signal?.addEventListener("abort", () => {
						reject(init.signal?.reason);
					});
				}),
		});
		const rendering = client.render(compile("<h1>Hello</h1>", true));

		client.cancel();

		await expect(rendering).rejects.toThrow("Preview cancelled.");
	});
});
