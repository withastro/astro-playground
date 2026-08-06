import {
	experimental_AstroContainer as AstroContainer,
	type AstroContainerOptions,
} from "astro/container";
import type { AstroComponentFactory } from "astro/runtime/server/index.js";
// The generated component is supplied as a second module by Worker Loader.
// @ts-expect-error There is intentionally no component.js on disk.
import component from "./component.js";
import type { PreviewRenderRequest } from "./preview-protocol";

const SCRIPT_ID = /\$\$renderScript\(\$\$result,\s*("(?:\\.|[^"\\])*")\s*\)/g;

function scriptIds(code: string): string[] {
	return Array.from(code.matchAll(SCRIPT_ID), (match) => JSON.parse(match[1]));
}

function createManifest(
	factory: AstroComponentFactory,
	code: string,
	metadata: Omit<PreviewRenderRequest, "code">,
): NonNullable<AstroContainerOptions["manifest"]> {
	const ids = scriptIds(code);
	if (ids.length !== metadata.scripts.length) {
		throw new Error("The compiler emitted unsupported script metadata.");
	}

	const inlinedScripts = new Map<string, string>();
	for (const [index, script] of metadata.scripts.entries()) {
		if (script.type !== "inline") {
			throw new Error("External scripts are not supported in Preview.");
		}
		inlinedScripts.set(ids[index], script.code ?? "");
	}

	return {
		componentMetadata: new Map([
			[
				factory.moduleId ?? "index.astro",
				{
					containsHead: metadata.containsHead,
					propagation: metadata.propagation ? "self" : "none",
				},
			],
		]),
		inlinedScripts,
	} as NonNullable<AstroContainerOptions["manifest"]>;
}

export default {
	async fetch(request: Request): Promise<Response> {
		if (request.method !== "POST") {
			return new Response("Method not allowed", { status: 405 });
		}

		const { code, ...metadata } =
			(await request.json()) as PreviewRenderRequest;
		const factory = component as AstroComponentFactory;
		if (!factory?.isAstroComponentFactory) {
			throw new Error("The compiler output did not export an Astro component.");
		}

		const container = await AstroContainer.create({
			manifest: createManifest(factory, code, metadata),
		});
		return container.renderToResponse(factory, {
			request: new Request("https://preview.astro.build/"),
			partial: true,
		});
	},
};
