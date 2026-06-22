/** Default `.astro` source shown when the playground first loads. */
export const DEFAULT_SOURCE = `---
import Counter from './Counter.svelte';

interface Props {
	title?: string;
}

const { title = 'Astro Playground' } = Astro.props;
const items = ['islands', 'content', 'actions'];
---

<section class="intro">
	<h1>{title}</h1>
	<ul>
		{items.map((item) => <li>{item}</li>)}
	</ul>

	<Counter client:visible />
</section>

<style>
	.intro {
		font-family: system-ui, sans-serif;
	}
	h1 {
		color: rebeccapurple;
	}
</style>

<script>
	console.log('Hello from a hoisted script!');
</script>
`;
