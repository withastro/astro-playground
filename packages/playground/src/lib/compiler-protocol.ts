// Message protocol shared between the main thread (`compiler.ts`) and the
// dedicated compiler Web Worker (`compiler.worker.ts`).
import type {
	CompileOptions,
	CompileResult,
	DiagnosticMessage,
	StyleBlock,
} from "@astrojs/compiler-binding";

/** Result of `parse`, with the AST JSON already parsed off the main thread. */
export interface ParsedAst {
	ast: unknown;
	diagnostics: DiagnosticMessage[];
}

export type CompilerRequest =
	| { type: "compile"; id: number; source: string; options?: CompileOptions }
	| { type: "parse"; id: number; source: string }
	| { type: "extractStyles"; id: number; source: string };

export type CompilerResponse =
	| { type: "ready" }
	| { type: "debug"; message: string }
	| { type: "result"; id: number; ok: true; result: unknown }
	| { type: "result"; id: number; ok: false; error: string };

export type { CompileOptions, CompileResult, DiagnosticMessage, StyleBlock };
