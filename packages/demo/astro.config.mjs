import { defineConfig } from 'astro/config';
import playground from '@astrojs/playground';

// https://astro.build/config
export default defineConfig({
    integrations: [
        playground()
    ]
});
