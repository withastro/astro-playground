<script lang="ts">
	import type { Diagnostic } from '@codemirror/lint';
	import { onMount, untrack } from 'svelte';
	import { createInputEditor, type InputEditorHandle, type Theme } from '../lib/codemirror';

	interface Props {
		value: string;
		diagnostics?: readonly Diagnostic[];
		theme: Theme;
		onChange: (value: string) => void;
	}

	let { value, diagnostics = [], theme, onChange }: Props = $props();

	let host: HTMLDivElement;
	let handle: InputEditorHandle | undefined;

	onMount(() => {
		// Initial values only; the `$effect`s below keep them in sync afterwards.
		handle = createInputEditor({
			parent: host,
			doc: untrack(() => value),
			language: 'astro',
			theme: untrack(() => theme),
			ariaLabel: 'Astro source editor',
			onChange,
		});
		return () => handle?.destroy();
	});

	// Sync external value changes (reset, shared-link load) into the editor.
	$effect(() => {
		handle?.setDoc(value);
	});

	// Push compiler diagnostics into the editor's lint state.
	$effect(() => {
		handle?.setDiagnostics(diagnostics);
	});

	// React to theme changes.
	$effect(() => {
		handle?.setTheme(theme);
	});
</script>

<div class="editor-host" bind:this={host}></div>

<style>
	.editor-host {
		position: absolute;
		inset: 0;
		overflow: hidden;
	}
	/* CodeMirror injects these at runtime, so they must be global. */
	:global(.editor-host .cm-editor) {
		height: 100%;
	}
	:global(.editor-host .cm-scroller) {
		font-family:
			ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace;
		font-size: 13px;
		line-height: 1.5;
	}
</style>
