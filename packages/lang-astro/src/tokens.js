// External tokenizers for the Astro grammar.
//
// These handle the context-sensitive parts that a plain LR grammar can't:
//   - the leading `---` frontmatter fence (TypeScript block)
//   - balanced `{ ... }` expressions (respecting strings and comments)
//   - `<!-- ... -->` comments
//   - the raw text inside `<script>` / `<style>` (so their JS/CSS bodies are
//     not mis-parsed as markup), stopping before the matching close tag
import { ExternalTokenizer } from '@lezer/lr';
import { Comment, Expression, Frontmatter, RawText } from './parser.terms.js';

const DASH = 45;
const NEWLINE = 10;
const LT = 60; // <
const GT = 62; // >
const SLASH = 47; // /
const BANG = 33; // !
const OPEN_BRACE = 123; // {
const CLOSE_BRACE = 125; // }
const SQUOTE = 39; // '
const DQUOTE = 34; // "
const BACKTICK = 96; // `
const BACKSLASH = 92; // \
const STAR = 42; // *

/** Lowercase an ASCII letter code. */
function lower(ch) {
	return ch | 32;
}

/** Does the stream spell `word` (lowercased) starting at `offset`? */
function matchesWord(input, offset, word) {
	for (let i = 0; i < word.length; i++) {
		if (lower(input.peek(offset + i)) !== word.charCodeAt(i)) return false;
	}
	return true;
}

// `---` … `---`, only at the very start of the document.
export const frontmatterToken = new ExternalTokenizer((input) => {
	if (input.pos !== 0) return;
	if (input.next !== DASH || input.peek(1) !== DASH || input.peek(2) !== DASH) return;
	input.advance(3);
	for (;;) {
		if (input.next < 0) {
			input.acceptToken(Frontmatter);
			return;
		}
		if (
			input.next === NEWLINE &&
			input.peek(1) === DASH &&
			input.peek(2) === DASH &&
			input.peek(3) === DASH
		) {
			input.advance(4); // consume "\n---"
			input.acceptToken(Frontmatter);
			return;
		}
		input.advance();
	}
});

// `<!-- … -->`
export const commentToken = new ExternalTokenizer((input) => {
	if (input.next !== LT || input.peek(1) !== BANG || input.peek(2) !== DASH || input.peek(3) !== DASH) {
		return;
	}
	input.advance(4);
	for (;;) {
		if (input.next < 0) {
			input.acceptToken(Comment);
			return;
		}
		if (input.next === DASH && input.peek(1) === DASH && input.peek(2) === GT) {
			input.advance(3);
			input.acceptToken(Comment);
			return;
		}
		input.advance();
	}
});

// `{ … }` with balanced braces, skipping strings and comments.
export const expressionToken = new ExternalTokenizer((input) => {
	if (input.next !== OPEN_BRACE) return;
	let depth = 0;
	let quote = 0;
	for (;;) {
		const ch = input.next;
		if (ch < 0) {
			input.acceptToken(Expression);
			return;
		}
		if (quote) {
			if (ch === BACKSLASH) {
				input.advance(2);
				continue;
			}
			if (ch === quote) quote = 0;
			input.advance();
			continue;
		}
		if (ch === SQUOTE || ch === DQUOTE || ch === BACKTICK) {
			quote = ch;
			input.advance();
			continue;
		}
		if (ch === SLASH && input.peek(1) === SLASH) {
			while (input.next >= 0 && input.next !== NEWLINE) input.advance();
			continue;
		}
		if (ch === SLASH && input.peek(1) === STAR) {
			input.advance(2);
			while (input.next >= 0 && !(input.next === STAR && input.peek(1) === SLASH)) input.advance();
			if (input.next >= 0) input.advance(2);
			continue;
		}
		if (ch === OPEN_BRACE) {
			depth++;
			input.advance();
			continue;
		}
		if (ch === CLOSE_BRACE) {
			depth--;
			input.advance();
			if (depth === 0) {
				input.acceptToken(Expression);
				return;
			}
			continue;
		}
		input.advance();
	}
});

// Raw body of a `<script>` / `<style>` element, up to (but not including) the
// matching `</script>` / `</style>` close tag.
export const rawTextToken = new ExternalTokenizer((input) => {
	let length = 0;
	for (;;) {
		if (input.next < 0) {
			if (length > 0) input.acceptToken(RawText);
			return;
		}
		if (
			input.next === LT &&
			input.peek(1) === SLASH &&
			(matchesWord(input, 2, 'script') || matchesWord(input, 2, 'style'))
		) {
			if (length > 0) input.acceptToken(RawText);
			return;
		}
		input.advance();
		length++;
	}
});
