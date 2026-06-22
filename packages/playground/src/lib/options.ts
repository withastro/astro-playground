import type { CompileOptions } from '@astrojs/compiler-binding';

/** Default options passed to the compiler's `compileAstroSync`. */
export const DEFAULT_COMPILE_OPTIONS: CompileOptions = {
	filename: 'index.astro',
	sourcemap: 'external',
	compact: 'none',
	scopedStyleStrategy: 'where',
};

export const SOURCEMAP_OPTIONS = ['external', 'inline', 'both'] as const;
export const COMPACT_OPTIONS = ['none', 'html', 'jsx'] as const;
export const SCOPED_STYLE_STRATEGIES = ['where', 'class', 'attribute'] as const;
