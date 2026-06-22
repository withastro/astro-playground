import type { DiagnosticMessage } from "@astrojs/compiler-binding";
import type { Diagnostic } from "@codemirror/lint";

/**
 * The compiler reports span offsets as UTF-8 **byte** offsets, but CodeMirror
 * positions are UTF-16 code-unit indices. This builds a fast lookup from byte
 * offset → UTF-16 index for a given source string.
 */
export function createByteToUtf16(source: string): (byte: number) => number {
	const byteCheckpoints: number[] = [0];
	const utf16Checkpoints: number[] = [0];
	let byte = 0;
	let utf16 = 0;
	for (const char of source) {
		const cp = char.codePointAt(0) ?? 0;
		byte += cp <= 0x7f ? 1 : cp <= 0x7ff ? 2 : cp <= 0xffff ? 3 : 4;
		utf16 += char.length; // 2 for astral code points (surrogate pair), else 1
		byteCheckpoints.push(byte);
		utf16Checkpoints.push(utf16);
	}
	return (target: number): number => {
		if (target <= 0) return 0;
		const last = byteCheckpoints.length - 1;
		if (target >= byteCheckpoints[last]) return utf16Checkpoints[last];
		// binary search for the largest checkpoint <= target
		let lo = 0;
		let hi = last;
		while (lo < hi) {
			const mid = (lo + hi + 1) >> 1;
			if (byteCheckpoints[mid] <= target) lo = mid;
			else hi = mid - 1;
		}
		return utf16Checkpoints[lo];
	};
}

const SEVERITY_MAP: Record<
	DiagnosticMessage["severity"],
	Diagnostic["severity"]
> = {
	error: "error",
	warning: "warning",
	information: "info",
	hint: "hint",
};

/** Convert compiler diagnostics into CodeMirror lint diagnostics. */
export function toCodeMirrorDiagnostics(
	source: string,
	messages: readonly DiagnosticMessage[],
): Diagnostic[] {
	if (messages.length === 0) return [];
	const toUtf16 = createByteToUtf16(source);
	const docLength = source.length; // UTF-16 length, matches CodeMirror doc length
	const diagnostics: Diagnostic[] = [];
	for (const message of messages) {
		const label = message.labels?.[0];
		let from = 0;
		let to = 0;
		if (label) {
			from = Math.min(toUtf16(label.start), docLength);
			to = Math.min(toUtf16(label.end), docLength);
		}
		if (to < from) to = from;
		diagnostics.push({
			from,
			to,
			severity: SEVERITY_MAP[message.severity] ?? "error",
			message: message.hint
				? `${message.text}\n\nHint: ${message.hint}`
				: message.text,
		});
	}
	return diagnostics;
}
