import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildParserFile } from "@lezer/generator";

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, "..", "src");
const grammarFile = join(src, "syntax.grammar");

const grammar = readFileSync(grammarFile, "utf8");
const { parser, terms } = buildParserFile(grammar, {
	fileName: grammarFile,
	moduleStyle: "es",
});

writeFileSync(join(src, "parser.js"), parser);
writeFileSync(join(src, "parser.terms.js"), terms);
console.log("✓ grammar built → src/parser.js, src/parser.terms.js");
