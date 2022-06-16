import "../lib/monaco";
import { DEFAULT_STYLES } from "./utils";
import type { WebContainer as Runtime } from '@webcontainer/api';
import { FileSystemTree, load as loadWebContainer } from '@webcontainer/api';
// @ts-ignore
import { initialize as loadAstro, transform } from "@astrojs/compiler";
import astroWASM from "@astrojs/compiler/astro.wasm?url";
import * as monaco from "monaco-editor";

import pkgJSON from "../assets/package.json";
import pkgLockJSON from "../assets/package-lock.json";
import astroConfig from "../assets/astro.config.mjs?raw";
import defaultStyles from "../assets/default.css?raw";

const [_, WebContainer] = await Promise.all([loadAstro({ wasmURL: astroWASM }), loadWebContainer()]);
globalThis['@astrojs/playground/runtime'] = globalThis['@astrojs/playground/runtime'] || await WebContainer.boot()
const runtime = globalThis['@astrojs/playground/runtime'] as Runtime;

const installingAstro = new Promise<void>(async resolve => {
  await runtime.loadFiles({
    '~': {
      directory: {
        'projects': {
          directory: {}
        }
      }
    },
    'package.json': {
      file: {
        contents: JSON.stringify(pkgJSON, null, 2)
      }
    },
    'package-lock.json': {
      file: {
        contents: JSON.stringify(pkgLockJSON, null, 2)
      }
    }
  })
  runtime.run({ command: 'turbo', args: ['install']}, { stdout(data) {
    if (data.includes('success')) resolve();
  } })
})

export default async function setup() {
  for (const playground of document.querySelectorAll("[data-playground]")) {
    init(playground as HTMLElement);
  }
}

interface State {
  id: string;
  elements: {
    root: HTMLElement;
    nav: HTMLElement;
    editor: HTMLElement;
    preview: HTMLIFrameElement;
    files: HTMLScriptElement;
  };
  reset: () => void;
  activePath: string;
  editor: monaco.editor.IStandaloneCodeEditor;
  runtime: Runtime;
  models: monaco.editor.ITextModel[];
}

let count = 0;
async function init(root: HTMLElement) {
  const id = `project-${count++}`;
  const elements = {
    root,
    nav: root.querySelector("[data-nav]") as HTMLElement,
    editor: root.querySelector("[data-editor]") as HTMLElement,
    preview: root.querySelector("[data-preview]") as HTMLIFrameElement,
    files: root.querySelector("[data-files]") as HTMLScriptElement,
  };
  const initialFiles = JSON.parse(elements.files.innerHTML);
  elements.files.remove();
  const models = initialFiles.map((file) =>
    monaco.editor.createModel(
      file.code,
      undefined /* infer */,
      monaco.Uri.from({ scheme: id, path: file.name })
    )
  );

  const editor = await setupEditor(elements.editor, models[0]);
  const url = await setupRuntime(elements.preview, runtime, id, initialFiles);
  elements.preview.src = `${url}`;
  elements.preview.setAttribute('src', `${url}`);
  if (elements.preview.parentElement.classList.contains("loading")) {
    const loader =
      elements.preview.parentElement.querySelector(".loader");
    elements.preview.parentElement.classList.remove("loading");
    setTimeout(() => {
      loader.remove();
    }, 500);
  }
  elements.preview.style.setProperty("opacity", "1");
  const state: State = {
    id,
    reset: () => {
      initialFiles.forEach((file) => {
        const model = models.find(
          (model) => model.uri.path === file.name
        ) as monaco.editor.ITextModel;
        model.setValue(file.code);
      });
      const entry = initialFiles[0].name;
      elements.nav
        .querySelector("[data-file][aria-selected]")
        .removeAttribute("aria-selected");
      elements.nav
        .querySelector(`[data-file="${entry}"]`)
        .setAttribute("aria-selected", "true");
      editor.setModel(models[0]);
    },
    elements,
    editor,
    runtime,
    activePath: initialFiles[0].name,
    models,
  };
  syncState(state);
  nav(state);
  resize(state);
}

async function setupEditor(
  element: HTMLElement,
  model: monaco.editor.ITextModel
) {
  const isDark = window.getComputedStyle(element)["colorScheme"] === "dark";
  const editor = monaco.editor.create(element, {
    model: model,
    theme: isDark ? "vs-dark" : "vs",
    fontFamily:
      '"Source Code Pro", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
    fontSize: 17,
    lineHeight: 22,
    renderLineHighlight: "none",
    autoIndent: "brackets",
    hideCursorInOverviewRuler: true,
    minimap: {
      enabled: false,
    },
    bracketPairColorization: {
      enabled: true,
    },
    parameterHints: {
      enabled: true,
    },
    wordWrap: "off",
    roundedSelection: true,
    smoothScrolling: true,
    overviewRulerBorder: false,
    scrollbar: {
      useShadows: false,
      vertical: "hidden",
      verticalScrollbarSize: 10,
      horizontalScrollbarSize: 10,
    },
    tabSize: 2,
    scrollBeyondLastLine: false,
    lineNumbersMinChars: 2,
    linkedEditing: true,
    autoClosingBrackets: "always",
  });
  return editor;
}

let ports = new Map();
async function setupRuntime(
  element: HTMLIFrameElement,
  runtime: Runtime,
  id: string,
  input: { name: string; code: string }[]
): Promise<string> {
  return new Promise(async (resolve) => {
    let myPort: number;
    runtime.on('server-ready', (port, url) => {
      ports.set(port, url)
      if (port === myPort) {
        resolve(url);
      }
    })

    const index = input.find(file => file.name === '/src/pages/index.astro');
    if (!index) {
      const firstComponent = input.find(file => file.name.endsWith('.astro'));
      input.push({
        name: '/src/pages/index.astro',
        code: `---
import Component from "${firstComponent.name}";
---
<Component />
`
      })
    }

    const files: FileSystemTree = {};
    for (const f of input) {
      const fullpath = f.name.split('/').slice(1)
      let target = files;
      for (const part of fullpath.slice(0, -1)) {
        if (target[part] === undefined) {
          target[part] = { directory: {} }
        }
        target = target[part]['directory'];
      }
      target[fullpath.at(-1)] = {
        file: { 
          contents: f.code
        }
      }
    }
    files['default.css'] = {
      file: {
        contents: defaultStyles
      }
    }
    if (!files['astro.config.mjs']) {
      files['astro.config.mjs'] = {
        file: {
          contents: astroConfig
        }
      }
    }
    await installingAstro;
    await runtime.loadFiles({ [`${id}`]: { directory: files }}, { mountPoints: `~/projects/` })    
    runtime.run({ command: 'turbo', args: ['--cwd', `~/projects/${id}`, 'exec', 'astro', 'dev'] }, { 
      stdout(data) {
        if (data.includes('localhost:')) {
          myPort = Number.parseInt(data.split('localhost:')[1].split('/')[0]);
        }
        if (ports.has(myPort)) {
          const url = ports.get(myPort);
          resolve(url);
        }
      }
    });
  })
}

function nav(state: State) {
  const {
    models,
    editor,
    elements: { nav: element, preview },
  } = state;
  function updatePath(e: Event) {
    const target = (e.target as HTMLElement).closest(
      "[data-file]"
    ) as HTMLElement;
    const path = target?.dataset.file;
    if (!path) return;
    if (path === state.activePath) return;
    for (const el of element.querySelectorAll("[data-file][aria-selected]")) {
      el.removeAttribute("aria-selected");
    }
    target.setAttribute("aria-selected", "true");
    const model = models.find((m) => path === m.uri.path);
    editor.setModel(model);
  }

  async function doAction(e: Event) {
    const target = (e.target as HTMLElement).closest(
      "[data-action]"
    ) as HTMLElement;
    const action = target?.dataset.action;
    if (!action) return;
    switch (action) {
      case "reload": {
        // state.reset();
        preview.setAttribute('src', preview.getAttribute('src'));
        return;
      }
      case 'download': {
        const res = await fetch('/_api/playground', { method: 'POST', body: JSON.stringify({ files: [] }) })
        const text = await res.text();
        console.log({ text });
        return;
      }
    }
  }
  element.addEventListener("click", (e) => {
    updatePath(e);
    doAction(e);
  });
}

function resize({ editor, elements }: State) {
  const media = window.matchMedia("(min-width: 960px)");
  let multiplier = media.matches ? 0.5 : 1;
  let screenHeight = window.innerHeight;
  media.addEventListener("change", ({ matches }) => {
    if (matches) {
      multiplier = 0.5;
    } else {
      multiplier = 1;
    }
  });
  const ro = new ResizeObserver(([entry]) => {
    screenHeight = window.innerHeight;
    const { height } = editor.getLayoutInfo();
    editor.layout({ width: entry.contentRect.width * multiplier - 16, height });
  });
  ro.observe(elements.editor.parentElement ?? elements.editor);


  function autogrow() {
    const { width } = editor.getLayoutInfo();
    const lines = editor.getModel().getLineCount();
    const height = Math.max(Math.min(lines * 22 + 12, screenHeight * 0.8), 192);
    editor.layout({ width, height });
    elements.root.style.setProperty(
      `--playground-content-height`,
      `${height}px`
    );
  }
  editor.onDidChangeModelContent(autogrow);
  editor.onDidChangeModel(autogrow);
  autogrow();
}

function syncState(state: State) {
  const { id, elements, editor, runtime } = state;
  const updateActivePath = ({ newModelUrl: { path } }) => {
    state.activePath = path;
    update();
  };
  editor.onDidChangeModel(updateActivePath);
  const update = debounce(async () => {
    const text = editor.getValue();
    const activePath = state.activePath;
    const parts = activePath.split('/')
    await runtime.loadFiles({ [parts.at(-1)]: { file: { contents: text }} }, { mountPoints: `~/projects/${id}/${parts.slice(1, -1).join('/')}` });
  }, 30);
  editor.onDidChangeModelContent(debounce(update, 300));
}

function debounce(func, timeout = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      func.apply(this, args);
    }, timeout);
  };
}
