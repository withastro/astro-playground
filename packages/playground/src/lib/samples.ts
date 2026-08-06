/** Default `.astro` source shown when the playground first loads. */
export const DEFAULT_SOURCE = `---
interface Props {
	title?: string;
}

const { title = 'Astro Playground' } = Astro.props;
const features = ['Server-first rendering', 'Scoped styles', 'Zero JS by default'];
---

<main class="card">
	<p class="eyebrow">ASTRO COMPONENT</p>
	<h1>Welcome to {title}</h1>
	<p class="lede">Edit this component, then open Preview to render it with Astro.</p>
	<ul>
		{features.map((feature) => <li>{feature}</li>)}
	</ul>
	<button id="counter" type="button">Clicked 0 times</button>
</main>

<style>
	.card {
		max-width: 36rem;
		margin: 3rem auto;
		padding: 2rem;
		border: 1px solid #d8dee9;
		border-radius: 1rem;
		font-family: system-ui, sans-serif;
		box-shadow: 0 1rem 3rem rgb(15 23 42 / 10%);
	}
	h1 {
		margin: 0;
		color: #5b21b6;
	}
	.eyebrow {
		margin: 0 0 0.75rem;
		color: #7c3aed;
		font-size: 0.75rem;
		font-weight: 700;
		letter-spacing: 0.12em;
	}
	.lede {
		color: #475569;
		line-height: 1.6;
	}
	li + li {
		margin-top: 0.4rem;
	}
	button {
		margin-top: 1rem;
		padding: 0.65rem 0.9rem;
		border: 0;
		border-radius: 0.5rem;
		background: #111827;
		color: white;
		cursor: pointer;
	}
</style>

<script>
	const button = document.querySelector('#counter');
	let count = 0;
	button?.addEventListener('click', () => {
		count++;
		button.textContent = \`Clicked \${count} \${count === 1 ? 'time' : 'times'}\`;
	});
</script>
`;
