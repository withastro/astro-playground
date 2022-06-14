if (import.meta.env.MODE !== 'production') {
    window['@astrojs/playground'] = true;
}

async function load() {
    await import('./scripts/playground.ts').then(({ default: setup }) => setup())
}

if ('requestIdleCallback' in window) {
    requestIdleCallback(load)
} else {
    setTimeout(load, 200)
}
