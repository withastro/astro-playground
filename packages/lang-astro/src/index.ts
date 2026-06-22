import { LanguageSupport, LRLanguage } from '@codemirror/language';
import type { Input, SyntaxNodeRef } from '@lezer/common';
import { parseMixed } from '@lezer/common';
import { parser as cssParser } from '@lezer/css';
import { tags as t, styleTags } from '@lezer/highlight';
import { parser as jsParser } from '@lezer/javascript';
import { parser } from './parser.js';
import { Expression, Frontmatter, RawElement } from './parser.terms.js';

// TypeScript for the frontmatter, TSX (single expression) for `{ … }` blocks.
const tsParser = jsParser.configure({ dialect: 'ts' });
const expressionParser = jsParser.configure({ dialect: 'ts jsx', top: 'SingleExpression' });

/** Nest embedded languages into the opaque Frontmatter / Expression / RawElement tokens. */
function configureNesting(node: SyntaxNodeRef, input: Input) {
	if (node.type.id === Frontmatter) {
		// strip the leading and trailing `---` fences
		const from = node.from + 3;
		const to = node.to - 3;
		return to > from ? { parser: tsParser, overlay: [{ from, to }] } : null;
	}

	if (node.type.id === Expression) {
		// strip the surrounding `{` and `}`
		const from = node.from + 1;
		const to = node.to - 1;
		return to > from ? { parser: expressionParser, overlay: [{ from, to }] } : null;
	}

	if (node.type.id === RawElement) {
		const text = input.read(node.from, node.to);
		const open = text.indexOf('>');
		const close = text.lastIndexOf('</');
		if (open < 0 || close < 0 || close <= open + 1) return null;
		const isStyle = /^<\s*style\b/i.test(text);
		return {
			parser: isStyle ? cssParser : jsParser,
			overlay: [{ from: node.from + open + 1, to: node.from + close }],
		};
	}

	return null;
}

export const astroLanguage = LRLanguage.define({
	name: 'astro',
	parser: parser.configure({
		props: [
			styleTags({
				'TagName RawTagName': t.tagName,
				AttributeName: t.attributeName,
				AttributeString: t.attributeValue,
				UnquotedValue: t.attributeValue,
				Comment: t.blockComment,
				Frontmatter: t.meta,
				Expression: t.brace,
			}),
		],
		wrap: parseMixed(configureNesting),
	}),
	languageData: {
		commentTokens: { block: { open: '<!--', close: '-->' } },
	},
});

/** CodeMirror 6 language support for Astro (`.astro`) files. */
export function astro(): LanguageSupport {
	return new LanguageSupport(astroLanguage);
}
