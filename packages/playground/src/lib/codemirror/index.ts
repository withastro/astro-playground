import { astro } from '@astrojs/codemirror-astro';
import {
	autocompletion,
	closeBrackets,
	closeBracketsKeymap,
	completionKeymap,
} from '@codemirror/autocomplete';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { css } from '@codemirror/lang-css';
import { javascript } from '@codemirror/lang-javascript';
import { json } from '@codemirror/lang-json';
import {
	bracketMatching,
	defaultHighlightStyle,
	foldGutter,
	foldKeymap,
	indentOnInput,
	indentUnit,
	syntaxHighlighting,
} from '@codemirror/language';
import { type Diagnostic, lintGutter, lintKeymap, setDiagnostics } from '@codemirror/lint';
import { highlightSelectionMatches, searchKeymap } from '@codemirror/search';
import { Compartment, EditorState, type Extension } from '@codemirror/state';
import { oneDark } from '@codemirror/theme-one-dark';
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
} from '@codemirror/view';

export type EditorLanguage = 'astro' | 'javascript' | 'css' | 'json' | 'text';

function languageExtension(language: EditorLanguage): Extension {
	switch (language) {
		case 'astro':
			return astro();
		case 'javascript':
			return javascript({ typescript: true, jsx: true });
		case 'css':
			return css();
		case 'json':
			return json();
		case 'text':
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
		indentUnit.of('\t'),
		syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
		bracketMatching(),
		closeBrackets(),
		autocompletion(),
		rectangularSelection(),
		crosshairCursor(),
		highlightSelectionMatches(),
		foldGutter(),
		EditorView.lineWrapping,
		oneDark,
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
	destroy(): void;
}

export function createInputEditor(options: {
	parent: HTMLElement;
	doc: string;
	language: EditorLanguage;
	onChange: (value: string) => void;
}): InputEditorHandle {
	const view = new EditorView({
		parent: options.parent,
		state: EditorState.create({
			doc: options.doc,
			extensions: [
				baseExtensions(),
				languageExtension(options.language),
				highlightActiveLine(),
				lintGutter(),
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
		destroy() {
			view.destroy();
		},
	};
}

export interface OutputViewHandle {
	view: EditorView;
	setContent(text: string, language?: EditorLanguage): void;
	destroy(): void;
}

export function createOutputView(options: {
	parent: HTMLElement;
	doc: string;
	language: EditorLanguage;
}): OutputViewHandle {
	const languageConf = new Compartment();
	let currentLanguage = options.language;
	const view = new EditorView({
		parent: options.parent,
		state: EditorState.create({
			doc: options.doc,
			extensions: [
				baseExtensions(),
				languageConf.of(languageExtension(options.language)),
				EditorState.readOnly.of(true),
				EditorView.editable.of(false),
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
		destroy() {
			view.destroy();
		},
	};
}
