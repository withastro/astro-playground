<script lang="ts">
	import type { CompileOptions } from '@astrojs/compiler-binding';
	import type { Theme } from '../lib/codemirror';
	import { COMPACT_OPTIONS, SCOPED_STYLE_STRATEGIES, SOURCEMAP_OPTIONS } from '../lib/options';

	interface Props {
		options: CompileOptions;
		theme: Theme;
		shareLabel: string;
		onChange: () => void;
		onToggleTheme: () => void;
		onShare: () => void;
	}

	let { options, theme, shareLabel, onChange, onToggleTheme, onShare }: Props = $props();

	function setSourcemap(value: string) {
		options.sourcemap = value === 'none' ? undefined : (value as CompileOptions['sourcemap']);
		onChange();
	}
	function setCompact(value: string) {
		options.compact = value as CompileOptions['compact'];
		onChange();
	}
	function setScoped(value: string) {
		options.scopedStyleStrategy = value as CompileOptions['scopedStyleStrategy'];
		onChange();
	}
</script>

<div class="toolbar">
	<form class="options" onsubmit={(e) => e.preventDefault()}>
		<label for="opt-sourcemap">
			<span>sourcemap</span>
			<select
				id="opt-sourcemap"
				name="sourcemap"
				value={options.sourcemap ?? 'none'}
				onchange={(e) => setSourcemap(e.currentTarget.value)}
			>
				<option value="none">none</option>
				{#each SOURCEMAP_OPTIONS as option (option)}<option value={option}>{option}</option>{/each}
			</select>
		</label>
		<label for="opt-compact">
			<span>compact</span>
			<select
				id="opt-compact"
				name="compact"
				value={options.compact ?? 'none'}
				onchange={(e) => setCompact(e.currentTarget.value)}
			>
				{#each COMPACT_OPTIONS as option (option)}<option value={option}>{option}</option>{/each}
			</select>
		</label>
		<label for="opt-scoped-style">
			<span>scoped style</span>
			<select
				id="opt-scoped-style"
				name="scopedStyleStrategy"
				value={options.scopedStyleStrategy ?? 'where'}
				onchange={(e) => setScoped(e.currentTarget.value)}
			>
				{#each SCOPED_STYLE_STRATEGIES as option (option)}<option value={option}>{option}</option>{/each}
			</select>
		</label>
	</form>

	<div class="actions">
		<button
			type="button"
			class="ghost"
			aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
			onclick={onToggleTheme}
		>
			{theme === 'dark' ? 'Light' : 'Dark'} mode
		</button>
		<button type="button" class="share" aria-label="Copy shareable link" onclick={onShare}>
			{shareLabel}
		</button>
	</div>

	<span class="visually-hidden" role="status" aria-live="polite">
		{shareLabel === 'Share' ? '' : shareLabel}
	</span>
</div>

<style>
	.toolbar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem 1rem;
		flex: none;
		min-height: 40px;
		padding: 0.4rem 0.75rem;
		border-bottom: 1px solid var(--border);
		background: var(--panel);
	}
	.options {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem 0.9rem;
		margin: 0;
		min-width: 0;
	}
	label {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		font-size: 0.74rem;
		color: var(--muted);
		white-space: nowrap;
	}
	select {
		appearance: auto;
		font-size: 0.74rem;
		color: var(--fg);
		background: var(--bg);
		border: 1px solid var(--border);
		border-radius: 6px;
		padding: 0.15rem 0.3rem;
		max-width: 8rem;
	}
	.actions {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-wrap: wrap;
	}
	button {
		appearance: none;
		cursor: pointer;
		font-size: 0.74rem;
		border-radius: 6px;
		padding: 0.3rem 0.7rem;
		border: 1px solid var(--border);
		white-space: nowrap;
	}
	.ghost {
		background: transparent;
		color: var(--muted);
	}
	.ghost:hover {
		color: var(--fg);
	}
	.share {
		background: var(--accent);
		color: #fff;
		border-color: transparent;
		font-weight: 600;
	}
	.share:hover {
		filter: brightness(1.08);
	}

	@media (max-width: 800px) {
		.toolbar {
			justify-content: flex-start;
		}
		.options,
		.actions {
			width: 100%;
		}
		.actions {
			justify-content: flex-end;
		}
		label {
			flex: 1 1 auto;
			justify-content: space-between;
		}
		select {
			max-width: none;
		}
	}
</style>
