import { astro } from "@astrojs/codemirror-astro";
import {
	autocompletion,
	closeBrackets,
	closeBracketsKeymap,
	completionKeymap,
} from "@codemirror/autocomplete";
import {
	defaultKeymap,
	history,
	historyKeymap,
	indentWithTab,
} from "@codemirror/commands";
import { css } from "@codemirror/lang-css";
import { javascript } from "@codemirror/lang-javascript";
import { json } from "@codemirror/lang-json";
import {
	bracketMatching,
	defaultHighlightStyle,
	foldGutter,
	foldKeymap,
	indentOnInput,
	indentUnit,
	syntaxHighlighting,
} from "@codemirror/language";
import {
	type Diagnostic,
	lintGutter,
	lintKeymap,
	setDiagnostics,
} from "@codemirror/lint";
import { highlightSelectionMatches, searchKeymap } from "@codemirror/search";
import { Compartment, EditorState, type Extension } from "@codemirror/state";
import { oneDark } from "@codemirror/theme-one-dark";
import {
	crosshairCursor,
	drawSelection,
	dropCursor,
	EditorView,
	highlightActiveLine,
	highlightActiveLineGutter,
	highlightSpecialChars,
	keymap,
	lineNumbers,
	rectangularSelection,
} from "@codemirror/view";

export type EditorLanguage = "astro" | "javascript" | "css" | "json" | "text";
export type Theme = "light" | "dark";

function themeExtension(theme: Theme): Extension {
	// Light mode relies on `defaultHighlightStyle` (a fallback in `baseExtensions`).
	return theme === "dark" ? oneDark : [];
}

function languageExtension(language: EditorLanguage): Extension {
	switch (language) {
		case "astro":
			return astro();
		case "javascript":
			return javascript({ typescript: true, jsx: true });
		case "css":
			return css();
		case "json":
			return json();
		case "text":
			return [];
	}
}

function baseExtensions(): Extension[] {
	return [
		lineNumbers(),
		highlightActiveLineGutter(),
		highlightSpecialChars(),
		history(),
		drawSelection(),
		dropCursor(),
		EditorState.allowMultipleSelections.of(true),
		indentOnInput(),
		indentUnit.of("\t"),
		syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
		bracketMatching(),
		closeBrackets(),
		autocompletion(),
		rectangularSelection(),
		crosshairCursor(),
		highlightSelectionMatches(),
		foldGutter(),
		EditorView.lineWrapping,
		keymap.of([
			...closeBracketsKeymap,
			...defaultKeymap,
			...searchKeymap,
			...historyKeymap,
			...foldKeymap,
			...completionKeymap,
			...lintKeymap,
			indentWithTab,
		]),
	];
}

export interface InputEditorHandle {
	view: EditorView;
	setDoc(text: string): void;
	setDiagnostics(diagnostics: readonly Diagnostic[]): void;
	setTheme(theme: Theme): void;
	destroy(): void;
}

export function createInputEditor(options: {
	parent: HTMLElement;
	doc: string;
	language: EditorLanguage;
	theme: Theme;
	ariaLabel: string;
	onChange: (value: string) => void;
}): InputEditorHandle {
	const themeCompartment = new Compartment();
	const view = new EditorView({
		parent: options.parent,
		state: EditorState.create({
			doc: options.doc,
			extensions: [
				baseExtensions(),
				languageExtension(options.language),
				highlightActiveLine(),
				lintGutter(),
				EditorView.contentAttributes.of({ "aria-label": options.ariaLabel }),
				themeCompartment.of(themeExtension(options.theme)),
				EditorView.updateListener.of((update) => {
					if (update.docChanged) options.onChange(update.state.doc.toString());
				}),
			],
		}),
	});

	return {
		view,
		setDoc(text) {
			if (text === view.state.doc.toString()) return;
			view.dispatch({
				changes: { from: 0, to: view.state.doc.length, insert: text },
			});
		},
		setDiagnostics(diagnostics) {
			view.dispatch(setDiagnostics(view.state, diagnostics as Diagnostic[]));
		},
		setTheme(theme) {
			view.dispatch({
				effects: themeCompartment.reconfigure(themeExtension(theme)),
			});
		},
		destroy() {
			view.destroy();
		},
	};
}

export interface OutputViewHandle {
	view: EditorView;
	setContent(text: string, language?: EditorLanguage): void;
	setTheme(theme: Theme): void;
	destroy(): void;
}

export function createOutputView(options: {
	parent: HTMLElement;
	doc: string;
	language: EditorLanguage;
	theme: Theme;
	ariaLabel: string;
}): OutputViewHandle {
	const languageConf = new Compartment();
	const themeCompartment = new Compartment();
	let currentLanguage = options.language;
	const view = new EditorView({
		parent: options.parent,
		state: EditorState.create({
			doc: options.doc,
			extensions: [
				baseExtensions(),
				languageConf.of(languageExtension(options.language)),
				themeCompartment.of(themeExtension(options.theme)),
				EditorView.contentAttributes.of({ "aria-label": options.ariaLabel }),
				// `readOnly` (not `editable: false`) keeps the output keyboard-focusable
				// and text-selectable while preventing edits.
				EditorState.readOnly.of(true),
			],
		}),
	});

	return {
		view,
		setContent(text, language) {
			const effects = [];
			if (language && language !== currentLanguage) {
				currentLanguage = language;
				effects.push(languageConf.reconfigure(languageExtension(language)));
			}
			view.dispatch({
				changes: { from: 0, to: view.state.doc.length, insert: text },
				effects,
			});
		},
		setTheme(theme) {
			view.dispatch({
				effects: themeCompartment.reconfigure(themeExtension(theme)),
			});
		},
		destroy() {
			view.destroy();
		},
	};
}
