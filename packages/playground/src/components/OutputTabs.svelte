<!-- biome-ignore-all lint/a11y/useValidAriaValues: aria-selected is bound to a dynamic boolean; biome can't statically evaluate Svelte expressions -->
<script lang="ts">
	import type { CompileResult, Component } from '@astrojs/compiler-binding';
	import { onMount, tick, untrack } from 'svelte';
	import {
		createOutputView,
		type EditorLanguage,
		type OutputViewHandle,
		type Theme,
	} from '../lib/codemirror';
	import type { ParsedAst } from '../lib/compiler-protocol';

	interface Props {
		result: CompileResult | null;
		ast: ParsedAst | null;
		theme: Theme;
	}

	let { result, ast, theme }: Props = $props();

	type TabId = 'js' | 'css' | 'scripts' | 'metadata' | 'diagnostics' | 'ast' | 'sourcemap';

	const TABS: { id: TabId; label: string }[] = [
		{ id: 'js', label: 'JS' },
		{ id: 'css', label: 'CSS' },
		{ id: 'scripts', label: 'Scripts' },
		{ id: 'metadata', label: 'Metadata' },
		{ id: 'diagnostics', label: 'Diagnostics' },
		{ id: 'ast', label: 'AST' },
		{ id: 'sourcemap', label: 'Source map' },
	];

	const CODE_TABS = new Set<TabId>(['js', 'css', 'scripts', 'ast', 'sourcemap']);

	let active = $state<TabId>('js');

	const diagnosticCount = $derived(result?.diagnostics.length ?? 0);
	const isCodeTab = $derived(CODE_TABS.has(active));

	// Arrow-key navigation for the tablist (WAI-ARIA tabs pattern).
	async function onTabKeydown(event: KeyboardEvent) {
		const index = TABS.findIndex((tab) => tab.id === active);
		let next = index;
		if (event.key === 'ArrowRight') next = (index + 1) % TABS.length;
		else if (event.key === 'ArrowLeft') next = (index - 1 + TABS.length) % TABS.length;
		else if (event.key === 'Home') next = 0;
		else if (event.key === 'End') next = TABS.length - 1;
		else return;
		event.preventDefault();
		active = TABS[next].id;
		await tick();
		document.getElementById(`tab-${active}`)?.focus();
	}

	function formatComponents(components: Component[]): string {
		if (!components || components.length === 0) return '—';
		return components
			.map((component) => `${component.localName} (${component.specifier})`)
			.join('\n');
	}

	function formatSourceMap(map: string): string {
		if (!map) return '// No source map was generated for the current options.';
		try {
			return JSON.stringify(JSON.parse(map), null, 2);
		} catch {
			return map;
		}
	}

	function codeFor(tab: TabId): { text: string; language: EditorLanguage } {
		if (!result) return { text: '', language: 'text' };
		switch (tab) {
			case 'js':
				return { text: result.code, language: 'javascript' };
			case 'css':
				return {
					text:
						result.css.length > 0
							? result.css.join('\n\n')
							: '/* No <style> output for this component. */',
					language: 'css',
				};
			case 'scripts':
				return {
					text:
						result.scripts.length > 0
							? result.scripts
									.map((script, index) =>
										script.type === 'inline'
											? `// script #${index + 1} (inline)\n${script.code ?? ''}`
											: `// script #${index + 1} (external)\n// src: ${script.src ?? ''}`,
									)
									.join('\n\n')
							: '// No hoisted <script> tags in this component.',
					language: 'javascript',
				};
			case 'ast':
				return { text: ast ? JSON.stringify(ast.ast, null, 2) : '', language: 'json' };
			case 'sourcemap':
				return { text: formatSourceMap(result.map), language: 'json' };
			default:
				return { text: '', language: 'text' };
		}
	}

	let host: HTMLDivElement;
	let view: OutputViewHandle | undefined;

	onMount(() => {
		view = createOutputView({
			parent: host,
			doc: '',
			language: 'javascript',
			theme: untrack(() => theme),
			ariaLabel: 'Compiled output (read-only)',
		});
		return () => view?.destroy();
	});

	$effect(() => {
		if (!view || !isCodeTab) return;
		const code = codeFor(active);
		view.setContent(code.text, code.language);
	});

	$effect(() => {
		view?.setTheme(theme);
	});
</script>

<div class="outputs">
	<div class="tablist" role="tablist" aria-label="Compiler output">
		{#each TABS as tab (tab.id)}
			<button
				type="button"
				role="tab"
				id={`tab-${tab.id}`}
				class="tab"
				class:active={active === tab.id}
				aria-selected={active === tab.id}
				aria-controls="output-panel"
				tabindex={active === tab.id ? 0 : -1}
				onclick={() => (active = tab.id)}
				onkeydown={onTabKeydown}
			>
				{tab.label}
				{#if tab.id === 'diagnostics' && diagnosticCount > 0}
					<span class="badge">{diagnosticCount}</span>
				{/if}
			</button>
		{/each}
	</div>

	<!-- biome-ignore lint/a11y/noNoninteractiveTabindex: false-positive. A tabpanel must have a tab index -->
	<div class="panel" id="output-panel" role="tabpanel" aria-labelledby={`tab-${active}`} tabindex="0">
		<div class="code-host" bind:this={host} hidden={!isCodeTab}></div>

		{#if active === 'metadata'}
			<div class="structured">
				{#if result}
					<dl>
						<dt>Scope hash</dt>
						<dd><code>{result.scope || '—'}</code></dd>
						<dt>Contains &lt;head&gt;</dt>
						<dd>{result.containsHead}</dd>
						<dt>Propagation</dt>
						<dd>{result.propagation}</dd>
						<dt>Hydrated components</dt>
						<dd>{formatComponents(result.hydratedComponents)}</dd>
						<dt>Client-only components</dt>
						<dd>{formatComponents(result.clientOnlyComponents)}</dd>
						<dt>Server components</dt>
						<dd>{formatComponents(result.serverComponents)}</dd>
						{#if result.styleError.length > 0}
							<dt>Style errors</dt>
							<dd class="error">{result.styleError.join('\n')}</dd>
						{/if}
					</dl>
				{:else}
					<p class="empty">Nothing compiled yet.</p>
				{/if}
			</div>
		{:else if active === 'diagnostics'}
			<div class="structured">
				{#if result && result.diagnostics.length > 0}
					<ul class="diagnostics">
						{#each result.diagnostics as diagnostic, index (index)}
							<li class={diagnostic.severity}>
								<span class="severity">{diagnostic.severity}</span>
								<div class="diag-body">
									<p class="diag-text">{diagnostic.text}</p>
									{#if diagnostic.hint}<p class="diag-hint">{diagnostic.hint}</p>{/if}
									{#if diagnostic.labels?.[0]}
										<p class="diag-loc">
											line {diagnostic.labels[0].line}, column {diagnostic.labels[0].column + 1}
										</p>
									{/if}
								</div>
							</li>
						{/each}
					</ul>
				{:else}
					<p class="empty">No diagnostics.</p>
				{/if}
			</div>
		{/if}
	</div>
</div>

<style>
	.outputs {
		display: flex;
		flex-direction: column;
		height: 100%;
		min-height: 0;
	}
	.tablist {
		display: flex;
		flex: none;
		gap: 0.125rem;
		height: 40px;
		padding: 0 0.25rem;
		overflow-x: auto;
		border-bottom: 1px solid var(--border);
		background: var(--panel);
	}
	.tab {
		appearance: none;
		border: none;
		background: transparent;
		color: var(--muted);
		font-size: 0.8rem;
		padding: 0.4rem 0.7rem;
		border-radius: 6px 6px 0 0;
		cursor: pointer;
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
	}
	.tab:hover {
		color: var(--fg);
	}
	.tab.active {
		color: var(--fg);
		background: var(--bg);
		box-shadow: inset 0 -2px 0 var(--accent);
	}
	.badge {
		font-size: 0.7rem;
		background: var(--accent);
		color: white;
		border-radius: 999px;
		padding: 0 0.4rem;
		line-height: 1.4;
	}
	.panel {
		position: relative;
		flex: 1;
		min-height: 0;
		overflow: auto;
	}
	.code-host {
		position: absolute;
		inset: 0;
	}
	.code-host[hidden] {
		display: none;
	}
	:global(.code-host .cm-editor) {
		height: 100%;
	}
	:global(.code-host .cm-scroller) {
		font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
		font-size: 13px;
	}
	.structured {
		padding: 1rem;
		font-size: 0.85rem;
	}
	dl {
		display: grid;
		grid-template-columns: max-content 1fr;
		gap: 0.4rem 1rem;
		margin: 0;
	}
	dt {
		color: var(--muted);
	}
	dd {
		margin: 0;
		white-space: pre-wrap;
		word-break: break-word;
	}
	.diagnostics {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
	}
	.diagnostics li {
		display: flex;
		gap: 0.6rem;
		padding: 0.6rem;
		border-radius: 6px;
		background: var(--panel);
		border-left: 3px solid var(--muted);
	}
	.diagnostics li.error {
		border-left-color: #f87171;
	}
	.diagnostics li.warning {
		border-left-color: #fbbf24;
	}
	.severity {
		text-transform: uppercase;
		font-size: 0.65rem;
		letter-spacing: 0.05em;
		color: var(--muted);
	}
	.diag-body {
		flex: 1;
	}
	.diag-text {
		margin: 0 0 0.25rem;
	}
	.diag-hint,
	.diag-loc {
		margin: 0;
		color: var(--muted);
		font-size: 0.78rem;
	}
	.empty {
		color: var(--muted);
	}
	.error {
		color: #f87171;
	}
	code {
		font-family: ui-monospace, monospace;
	}
</style>
