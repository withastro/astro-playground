import "../lib/monaco";
import { DEFAULT_STYLES } from './utils';
import { SandpackClient, SandpackErrorMessage, SandpackMessage } from "@codesandbox/sandpack-client";
// @ts-ignore
import { initialize as loadAstro, transform } from "@astrojs/compiler";
import astroWASM from "@astrojs/compiler/astro.wasm?url";
import * as monaco from "monaco-editor";

await Promise.all([
  loadAstro({ wasmURL: astroWASM })
]);

export default function setup() {
  for (const playground of document.querySelectorAll("[data-playground]")) {
    init(playground as HTMLElement);
  }
}

interface State {
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
  sandpack: SandpackClient;
  models: monaco.editor.ITextModel[];
}

let count = 0;
async function init(root: HTMLElement) {
  const id = `${count++}`;
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
      monaco.Uri.from({ scheme: `playground-${id}`, path: file.name })
    )
  );
  const editor = await setupEditor(elements.editor, models[0]);
  const files = await Promise.all(
    initialFiles.map((file) => {
      if (!file.name.endsWith(".astro")) return file;
      return transform(file.code, {
        pathname: file.name,
        sourcefile: file.name,
        site: "https://localhost:3000/",
        projectRoot: "file://",
        sourcemap: 'inline'
      }).then(({ code }) => ({ name: `${file.name}.js`, code }));
    })
  );
  const sandpack = setupSandpack(elements.preview, files);
  const state: State = {
    reset: () => {
      initialFiles.forEach((file) => {
        const model = models.find(
          (model) => model.uri.path === file.name
        ) as monaco.editor.ITextModel;
        model.setValue(file.code);
      });
      const entry = normalizePath(initialFiles[0].name);
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
    sandpack,
    activePath: normalizePath(files[0].name),
    models,
  };
  syncState(state);
  nav(state);
  resize(state);
}

async function setupEditor(element: HTMLElement, model: monaco.editor.ITextModel) {
  const isDark = window.getComputedStyle(element)["colorScheme"] === "dark";
  const editor = monaco.editor.create(element, {
    model: model,
    theme: isDark ? "vs-dark" : "vs",
    fontFamily:
      '"Source Code Pro", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
    fontSize: 17,
    lineHeight: 22,
    renderLineHighlight: "none",
    autoIndent: 'brackets',
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
      vertical: 'hidden',
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

function setupSandpack(
  element: HTMLIFrameElement,
  input: { name: string; code: string }[]
) {
  const entry = input[0];
  const files = {};

  const accentColor = window.getComputedStyle(element)["accentColor"];
  const colorScheme = window.getComputedStyle(element)["colorScheme"];
  const customProperties = `
    :root {
      --playground-accent-color: ${accentColor};
      --playground-color-scheme: ${colorScheme};
      accent-color: var(--playground-accent-color);
      color-scheme: var(--playground-color-scheme);
    }
  `;
  const styles = `${customProperties}\n${DEFAULT_STYLES}`;

  files["/@virtual/entry.js"] = {
    code: `export { default as Component } from "${entry.name}"`,
  };

  for (const file of input) {
    files[file.name] = { code: file.code };
  }

  files["/@astro/render.js"] = {
    code: `
      import { createResult } from "astro/dist/core/render/result.js";
      import { renderPage, renderHead } from "astro/server/index.js";
      const result = createResult({
          styles: new Set(),
          links: new Set(),
          scripts: new Set(),
          renderers: [],
          request: null,
          props: {},
          site: "http://localhost:3000",
          request: new Request({ url: "http://localhost:3000/index" })
      });

      export default async (Component) => {
          const { html } = await renderPage(result, Component, {}, null);
          if (result.styles.size > 0 || result.links.size > 0 || result.scripts.size > 0) {
            const head = await renderHead(result);
            result.styles.clear();
            result.links.clear();
            result.scripts.clear();
            return head + html;
          }
          return html ?? ${JSON.stringify(entry.code)};
      }
    `,
  };

  files["/index.js"] = {
    code: `
      import render from "/@astro/render.js";
      import { Component } from "/@virtual/entry.js";

      if (!document.body.dataset.styled) {
        const style = document.createElement('style');
        style.innerHTML = ${JSON.stringify(styles)}
        document.head.appendChild(style);
        document.body.dataset.styled = "true";
      }

      (async () => {
        const html = await render(Component);
        if (html) {
          document.querySelector('#root').innerHTML = html;
        }
      })()
    `,
  };

  return new SandpackClient(
    element,
    {
      template: "vanilla-ts",
      files,
      entry: "/index.js",
      dependencies: {
        astro: "latest",
      },
    },
    {
      showErrorScreen: false,
      showLoadingScreen: false,
      showOpenInCodeSandbox: false,
    }
  );
}

function nav(state: State) {
  const {
    models,
    editor,
    sandpack,
    elements: { nav: element },
  } = state;
  function updatePath(e: Event) {
    const target = (e.target as HTMLElement).closest(
      "[data-file]"
    ) as HTMLElement;
    const path = target?.dataset.file;
    if (!path) return;
    if (path === normalizePath(state.activePath)) return;
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
      case "reset":
        return state.reset();
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
  media.addEventListener("change", ({ matches }) => {
    if (matches) {
      multiplier = 0.5;
    } else {
      multiplier = 1;
    }
  });
  const ro = new ResizeObserver(([entry]) => {
    const { height } = editor.getLayoutInfo();
    editor.layout({ width: entry.contentRect.width * multiplier - 16, height });
  });
  ro.observe(elements.editor.parentElement ?? elements.editor);

  function autogrow() {
    const { width } = editor.getLayoutInfo();
    const lines = editor.getModel().getLineCount();
    const height = (lines * 22) + 12;
    editor.layout({ width, height });
    elements.root.style.setProperty(`--playground-content-height`, `${height}px`);
  }
  editor.onDidChangeModelContent(autogrow);
  editor.onDidChangeModel(autogrow);
  autogrow();
}

function syncState(state: State) {
  const { elements, editor, sandpack } = state;
  const updateActivePath = ({ newModelUrl: { path } }) => {
    state.activePath = path;
    update();
  };
  editor.onDidChangeModel(updateActivePath);
  const update = debounce(async () => {
    if (sandpack.status !== "idle") return;
    const text = editor.getValue();
    const files = getFiles() ?? {};
    const activePath = normalizePath(state.activePath);
    if (activePath.endsWith(".astro")) {
      const res = await transform(text, {
        pathname: state.activePath,
        sourcefile: state.activePath,
        site: "https://localhost:3000/",
        projectRoot: "file://",
        sourcemap: 'inline'
      });
      const id = `${activePath}.js`;
      files[id] = { code: res.code };
      if (elements.root.hasAttribute('data-sync-view')) {
        files["/@virtual/entry.js"] = {
          code: `export { default as Component } from "${id}"`,
        };
      }
    } else {
      const id = state.activePath;
      files[id] = { code: text };
    }
    updateClients({ files });
  }, 30);
  editor.onDidChangeModelContent(debounce(update, 400));
  sandpack.listen((msg) => {
    switch (msg.type) {
      case "status": {
        if (msg.status === "idle") {
          if (elements.preview.parentElement.classList.contains('loading')) {
            const loader = elements.preview.parentElement.querySelector('.loader');
            elements.preview.parentElement.classList.remove('loading');
            setTimeout(() => {
              loader.remove();
            }, 500);
          } 
          elements.preview.style.setProperty("opacity", "1");
          clearErrors();
        }
        return;
      }
      case "action": {
        if (msg.action === "show-error") {
          surfaceError(msg);
        }
        return;
      }
    }
  });

  let decorations: string[] = []
  function surfaceError(msg: SandpackMessage & SandpackErrorMessage) {
    if (normalizePath(msg.path) !== state.activePath) return;
    
    const newDecorations: monaco.editor.IModelDeltaDecoration[] = []
    let loc: [number, number, number, number] = [0, 0, 0, 0];
    let opts: monaco.editor.IModelDecorationOptions = {};
    if (msg.title === 'ReferenceError') {
      const len = /^(\w+) is not/.exec(msg.message).at(1).length + 1;
      newDecorations.push({
        range: new monaco.Range(
          msg.line,
          msg.column + 1,
          msg.line,
          msg.column + len
        ),
        options: {
          className: 'error reference-error'
        }
      });
      newDecorations.push({
        range: new monaco.Range(msg.line, msg.column, msg.line, msg.column),
        options: {
          isWholeLine: true,
          className: 'has-error',
          linesDecorationsClassName: 'error-marker'
        }
      })
    } else {
      loc = [
        msg.line,
        msg.column,
        msg.lineEnd ?? msg.line,
        msg.columnEnd ?? msg.column + 1
      ]
      opts.inlineClassName = 'error reference-error';
    }
    newDecorations.push({
      range: new monaco.Range(...loc),
      options: {
        inlineClassName: 'decoration-error'
      }
    });
    decorations = editor.deltaDecorations(decorations, newDecorations);
  }
  function clearErrors() {
    decorations = editor.deltaDecorations(decorations, []);
  }

  function getFiles() {
    const { status, bundlerState: state } = sandpack;
    if (status !== "idle") {
      return;
    }
    const files = {};
    for (const id in state.transpiledModules) {
      const file = state.transpiledModules[id].module;
      if (!id.startsWith("/node_modules")) {
        Object.assign(files, { [file.path]: { code: file.code } });
      }
    }
    return files;
  }

  function updateClients({ files }) {
    const { status } = sandpack;
    if (status !== "idle") {
      return;
    }
    sandpack.updatePreview({
      files,
    });
  }
}

function normalizePath(path: string) {
  return path.replace('.astro.js', '.astro')
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
