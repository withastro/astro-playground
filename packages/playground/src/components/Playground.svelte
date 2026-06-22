<script lang="ts">
	import { onDestroy } from 'svelte';
	import type { CompileResult } from '@astrojs/compiler-binding';
	import { compiler } from '../lib/compiler';
	import type { ParsedAst } from '../lib/compiler-protocol';
	import { toCodeMirrorDiagnostics } from '../lib/diagnostics';
	import { DEFAULT_COMPILE_OPTIONS } from '../lib/options';
	import { DEFAULT_SOURCE } from '../lib/samples';
	import Editor from './Editor.svelte';
	import OutputTabs from './OutputTabs.svelte';

	let source = $state(DEFAULT_SOURCE);
	const options = { ...DEFAULT_COMPILE_OPTIONS };

	let result = $state<CompileResult | null>(null);
	let ast = $state<ParsedAst | null>(null);
	let status = $state<'loading' | 'compiling' | 'ready' | 'error'>('loading');
	let errorMessage = $state('');
	let compileMs = $state(0);

	const diagnostics = $derived(
		result ? toCodeMirrorDiagnostics(source, result.diagnostics) : [],
	);

	let runId = 0;
	let debounceTimer: ReturnType<typeof setTimeout> | undefined;

	async function runCompile() {
		const current = ++runId;
		const start = performance.now();
		if (result) status = 'compiling';
		try {
			const [compiled, parsed] = await Promise.all([
				compiler.compile(source, options),
				compiler.parse(source),
			]);
			if (current !== runId) return; // a newer run superseded this one
			result = compiled;
			ast = parsed;
			compileMs = Math.round(performance.now() - start);
			status = 'ready';
			errorMessage = '';
		} catch (error) {
			if (current !== runId) return;
			errorMessage = error instanceof Error ? error.message : String(error);
			status = 'error';
		}
	}

	function scheduleCompile() {
		clearTimeout(debounceTimer);
		debounceTimer = setTimeout(runCompile, 200);
	}

	function handleSourceChange(next: string) {
		source = next;
		scheduleCompile();
	}

	// Kick off the first compilation (spawns the worker + loads WASM).
	runCompile();

	onDestroy(() => {
		clearTimeout(debounceTimer);
		compiler.dispose();
	});
</script>

<div class="app">
	{#if status === 'error'}
		<div class="error-banner">{errorMessage}</div>
	{/if}

	<div class="split">
		<section class="pane">
			<div class="pane-head">
				<span class="filename">{options.filename}</span>
				<span class="status" data-status={status}>
					{#if status === 'loading'}
						Starting compiler…
					{:else if status === 'compiling'}
						Compiling…
					{:else if status === 'error'}
						Compiler error
					{:else}
						Compiled in {compileMs} ms
					{/if}
				</span>
			</div>
			<div class="pane-body">
				<Editor value={source} {diagnostics} onChange={handleSourceChange} />
			</div>
		</section>
		<section class="pane">
			<OutputTabs {result} {ast} />
		</section>
	</div>
</div>

<style>
	.app {
		display: flex;
		flex-direction: column;
		height: 100%;
		background: var(--bg);
		color: var(--fg);
	}
	.error-banner {
		padding: 0.6rem 1rem;
		background: rgba(248, 113, 113, 0.12);
		color: #f87171;
		font-size: 0.85rem;
		font-family: ui-monospace, monospace;
		border-bottom: 1px solid rgba(248, 113, 113, 0.3);
		white-space: pre-wrap;
	}
	.split {
		flex: 1;
		min-height: 0;
		display: grid;
		grid-template-columns: 1fr 1fr;
	}
	.pane {
		display: flex;
		flex-direction: column;
		min-width: 0;
		min-height: 0;
	}
	.pane:first-child {
		border-right: 1px solid var(--border);
	}
	.pane-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		height: 40px;
		flex: none;
		padding: 0 0.75rem;
		font-size: 0.78rem;
		color: var(--muted);
		border-bottom: 1px solid var(--border);
		background: var(--panel);
	}
	.filename {
		font-family: ui-monospace, monospace;
	}
	.status[data-status='error'] {
		color: #f87171;
	}
	.status[data-status='ready'] {
		color: #4ade80;
	}
	.pane-body {
		position: relative;
		flex: 1;
		min-height: 0;
	}
	@media (max-width: 800px) {
		.split {
			grid-template-columns: 1fr;
			grid-template-rows: 1fr 1fr;
		}
		.pane:first-child {
			border-right: none;
			border-bottom: 1px solid var(--border);
		}
	}
</style>
