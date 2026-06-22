<script lang="ts">
	import { onMount } from 'svelte';
	import type { Diagnostic } from '@codemirror/lint';
	import { createInputEditor, type InputEditorHandle } from '../lib/codemirror';

	interface Props {
		value: string;
		diagnostics?: readonly Diagnostic[];
		onChange: (value: string) => void;
	}

	let { value, diagnostics = [], onChange }: Props = $props();

	let host: HTMLDivElement;
	let handle: InputEditorHandle | undefined;

	onMount(() => {
		handle = createInputEditor({ parent: host, doc: value, language: 'astro', onChange });
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
</script>

<div class="editor-host" bind:this={host}></div>

<style>
	.editor-host {
		position: absolute;
		inset: 0;
		overflow: hidden;
	}
	.editor-host :global(.cm-editor) {
		height: 100%;
	}
	.editor-host :global(.cm-scroller) {
		font-family:
			ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace;
		font-size: 13px;
		line-height: 1.5;
	}
</style>
