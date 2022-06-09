export const DEFAULT_STYLES = `
:root {
  font-family: system-ui, sans-serif;
  accent-color: var(--playground-accent-color);
}
* {
  box-sizing: border-box;
}
html, body {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 100vh;
  max-width: 100vw;
}
body {
  display: flex;
  flex-direction: column;
  margin: 0;
  padding: 8px;
}
#root > :first-child {
  margin-top: 0;
}
`;

export function createDirectory(name: string, content: string) {
    function parse(content: string) {
        try {
            return JSON.parse(`[${content}]`)
        } catch (e) {
            // Recursively correct arrays
            const msg = /Unexpected token . in JSON at position (\d+)/.exec(e.message).at(1)
            if (msg) {
                const pos = Number.parseInt(msg) - 1;
                return parse(`[${content.slice(0, pos)},${content.slice(pos)}]`)
            }
        }
    }

    const files = parse(content).flat(Infinity);
    const result = [];
    for (const entry of files) {
        const path = [name, entry.name].map(x => x.replace(/^\/|\/$/, '')).join('/')
        result.push({ ...entry, name: path })
    }

    return result;
}

export function safe(json: string) {
    return json.replaceAll("</script", "\\u003C/script")
}

export function dedent(content: string): string {
    let lns = content.split("\n");
    if (lns[0] === '') {
        lns = lns.slice(1)
    }
    const indent = lns[0].slice(0, lns[0].length - lns[0].trimStart().length);
    return lns.map(ln => ln.replace(indent, '')).join('\n').trimEnd();
}
