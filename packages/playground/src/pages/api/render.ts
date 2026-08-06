import { env } from "cloudflare:workers";
import previewWorkerBundle from "virtual:preview-worker-source";
import type { APIRoute } from "astro";
import type { PreviewRenderRequest } from "../../lib/preview-protocol";

export const prerender = false;

const MAX_REQUEST_BYTES = 1024 * 1024;
const COMPATIBILITY_DATE = "2026-06-22";

function errorResponse(error: string, status: number): Response {
	return Response.json(
		{ ok: false, error },
		{ status, headers: { "Cache-Control": "no-store" } },
	);
}

function isPreviewRequest(value: unknown): value is PreviewRenderRequest {
	if (!value || typeof value !== "object") return false;
	const request = value as Partial<PreviewRenderRequest>;
	return (
		typeof request.code === "string" &&
		request.code.length > 0 &&
		typeof request.containsHead === "boolean" &&
		typeof request.propagation === "boolean" &&
		Array.isArray(request.scripts) &&
		request.scripts.every(
			(script) =>
				script?.type === "inline" &&
				(script.code === undefined || typeof script.code === "string"),
		)
	);
}

export const POST: APIRoute = async ({ request }) => {
	if (!request.headers.get("content-type")?.startsWith("application/json")) {
		return errorResponse("Preview requests must use JSON.", 415);
	}

	const contentLength = Number(request.headers.get("content-length"));
	if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BYTES) {
		return errorResponse("The compiled preview is too large.", 413);
	}

	const text = await request.text();
	if (new TextEncoder().encode(text).byteLength > MAX_REQUEST_BYTES) {
		return errorResponse("The compiled preview is too large.", 413);
	}

	let payload: unknown;
	try {
		payload = JSON.parse(text);
	} catch {
		return errorResponse("The preview request contains invalid JSON.", 400);
	}
	if (!isPreviewRequest(payload)) {
		return errorResponse("The preview request is invalid.", 400);
	}

	try {
		const worker = env.LOADER.load({
			compatibilityDate: COMPATIBILITY_DATE,
			mainModule: previewWorkerBundle.mainModule,
			modules: {
				...previewWorkerBundle.modules,
				"component.js": payload.code,
			},
			globalOutbound: null,
		});
		const response = await worker.getEntrypoint().fetch(
			new Request("https://preview.astro.build/", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(payload),
			}),
		);
		const html = await response.text();
		if (!response.ok) {
			return errorResponse(
				html || `The preview returned HTTP ${response.status}.`,
				400,
			);
		}
		return Response.json(
			{ ok: true, html },
			{ headers: { "Cache-Control": "no-store" } },
		);
	} catch (error) {
		return errorResponse(
			error instanceof Error ? error.message : String(error),
			400,
		);
	}
};
