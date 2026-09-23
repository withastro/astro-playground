import { convertToTsx } from "@astrojs/astro2tsx";
import { describe, expect, it } from "vitest";

describe("Astro to TSX", () => {
	it("emits TSX for the output pane", () => {
		const result = convertToTsx(
			`---\ninterface Props { name: string }\nconst { name } = Astro.props;\n---\n<h1>Hello {name}</h1>`,
			{ filename: "Greeting.astro" },
		);

		expect(result.hasParseErrors).toBe(false);
		expect(result.code).toContain("interface Props");
		expect(result.code).toContain("<h1>Hello {name}</h1>");
		expect(result.code).toContain("GreetingAstroComponent");
	});
});
