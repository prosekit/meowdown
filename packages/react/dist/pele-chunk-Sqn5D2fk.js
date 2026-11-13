import { render } from "pele";
import DOMPurify from "dompurify";

// src/utils/sanitize-svg.ts
/**
* Parses an SVG string and removes anything that can run script. Returns
* `undefined` when no single `<svg>` root remains.
*/
function sanitizeSvg(svg) {
	const fragment = DOMPurify.sanitize(svg, {
		USE_PROFILES: {
			svg: true,
			svgFilters: true
		},
		ADD_ATTR: ["role"],
		RETURN_DOM_FRAGMENT: true
	});
	const element = fragment.firstElementChild;
	if (fragment.childElementCount !== 1 || element?.localName !== "svg") return;
	return element;
}

// src/hooks/pele-chunk.ts
function renderMermaid(source, options) {
	const element = sanitizeSvg(render(source, options).svg);
	if (!element) throw new Error("Invalid SVG output.");
	return element;
}

export { renderMermaid };