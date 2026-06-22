// Encode/decode the playground state (source + compile options) for shareable URLs.
import type { CompileOptions } from "@astrojs/compiler-binding";

// UTF-8 safe base64 for the source, see:
// https://developer.mozilla.org/en-US/docs/Web/API/btoa#unicode_strings

function toBinary(string: string): string {
	const codeUnits = new Uint16Array(string.length);
	for (let i = 0; i < codeUnits.length; i++) {
		codeUnits[i] = string.charCodeAt(i);
	}
	const charCodes = new Uint8Array(codeUnits.buffer);
	let result = "";
	for (let i = 0; i < charCodes.length; i++) {
		result += String.fromCharCode(charCodes[i]);
	}
	return result;
}

function fromBinary(binary: string): string {
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < bytes.length; i++) {
		bytes[i] = binary.charCodeAt(i);
	}
	const charCodes = new Uint16Array(bytes.buffer);
	let result = "";
	for (let i = 0; i < charCodes.length; i++) {
		result += String.fromCharCode(charCodes[i]);
	}
	return result;
}

export function encodeCode(code: string): string {
	return btoa(toBinary(code));
}

export function decodeCode(encoded: string): string {
	try {
		return fromBinary(atob(encoded));
	} catch {
		return encoded;
	}
}

type ShareableOptions = Pick<
	CompileOptions,
	"sourcemap" | "compact" | "scopedStyleStrategy" | "filename"
>;

export interface SharedState {
	code?: string;
	options: Partial<ShareableOptions>;
}

/** Parse source + options from the URL hash, if present. */
export function readSharedState(): SharedState | null {
	if (typeof location === "undefined") return null;
	const raw = location.hash.replace(/^#/, "");
	if (!raw) return null;
	const params = new URLSearchParams(raw);
	const state: SharedState = { options: {} };

	const code = params.get("code");
	if (code) state.code = decodeCode(code);

	const sourcemap = params.get("sourcemap");
	if (sourcemap) {
		state.options.sourcemap =
			sourcemap === "none"
				? undefined
				: (sourcemap as ShareableOptions["sourcemap"]);
	}
	const compact = params.get("compact");
	if (compact) state.options.compact = compact as ShareableOptions["compact"];
	const scoped = params.get("scopedStyleStrategy");
	if (scoped)
		state.options.scopedStyleStrategy =
			scoped as ShareableOptions["scopedStyleStrategy"];
	const filename = params.get("filename");
	if (filename) state.options.filename = filename;

	return state;
}

function buildHash(code: string, options: Partial<ShareableOptions>): string {
	const params = new URLSearchParams();
	params.set("code", encodeCode(code));
	params.set("sourcemap", options.sourcemap ?? "none");
	params.set("compact", options.compact ?? "none");
	params.set("scopedStyleStrategy", options.scopedStyleStrategy ?? "where");
	if (options.filename) params.set("filename", options.filename);
	return params.toString();
}

/** Replace the URL hash with the current state (no new history entry). */
export function writeSharedState(
	code: string,
	options: Partial<ShareableOptions>,
): void {
	if (typeof history === "undefined") return;
	history.replaceState(null, "", `#${buildHash(code, options)}`);
}

/** Build an absolute, shareable URL for the given state. */
export function shareUrl(
	code: string,
	options: Partial<ShareableOptions>,
): string {
	return `${location.origin}${location.pathname}#${buildHash(code, options)}`;
}
