import { defineConfig } from 'astro/config'
import preact from '@astrojs/preact';
import react from '@astrojs/react';
import svelte from '@astrojs/svelte';
import vue from '@astrojs/vue';

function style() {
	return {
		name: '@astrojs/playground/style',
		hooks: {
			'astro:config:setup': async ({ injectScript }) => {
				injectScript('page-ssr', `import '/default.css';`);
			}
		}
	}
}

// https://astro.build/config
export default defineConfig({
	integrations: [style(), preact(), react(), svelte(), vue()],
});
