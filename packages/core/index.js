export default function integration() {
    return {
        name: '@astrojs/playground',
        hooks: {
            'astro:config:setup': ({ injectRoute }) => {
				injectRoute({
                    pattern: '/_api/playground',
                    entryPoint: '@astrojs/playground/routes/api.ts'
                })
            },
            'astro:server:setup': ({ server }) => {
                server.middlewares.use((req, res, next) => {
                    res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
                    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
                    next()
                })
            },
        }
    }
}
