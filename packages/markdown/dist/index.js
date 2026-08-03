import { GFM, parser } from "@lezer/markdown";

//#region src/autolink-tld.ts
/**
* Allowed TLDs when they appear in a bare domain (no scheme, no `www.`).
*
* The 10 most-visited TLDs by real Chrome traffic.
* Source: Chrome UX Report https://github.com/zakird/crux-top-lists
*/
const BARE_AUTOLINK_TLDS = /* @__PURE__ */ new Set([
	"com",
	"br",
	"net",
	"jp",
	"org",
	"in",
	"de",
	"ru",
	"it",
	"fr"
]);
const DNS_LABEL_RE = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i;
/** The host portion of a bare candidate: everything before the first `/`. */
function hostFromUrl(text) {
	const slash = text.indexOf("/");
	return slash === -1 ? text : text.slice(0, slash);
}
/**
* True when `host` (no scheme, no `@`, path already stripped) is a bare domain
* meowdown links. Rules:
*
* - at least two dot-separated labels (host + tld)
* - the last label is in `BARE_AUTOLINK_TLDS` (matched case-insensitively)
* - the registrable label (the one before the tld) is at least 3 chars, so
*   `t.co` / `x.io` / `do.so` stay plain text
* - every label is a valid DNS label (alphanumeric, inner hyphens only, <= 63
*   chars), which also rejects IP-like input such as `1.2.3.4` because its last
*   label is not a known tld
*/
function isLinkableBareHost(host) {
	const labels = host.split(".");
	if (labels.length < 2) return false;
	const tld = labels[labels.length - 1].toLowerCase();
	if (!BARE_AUTOLINK_TLDS.has(tld)) return false;
	if (labels[labels.length - 2].length < 3) return false;
	for (const label of labels) if (label.length > 63 || !DNS_LABEL_RE.test(label)) return false;
	return true;
}
/**
* Derive the `href` for an autolink from its visible text:
*
* - a URL with a scheme is used as-is
* - an email becomes `mailto:`
* - a `www.` URL gets an implied `https://`
* - a bare domain on the curated TLD list gets an implied `https://`
* - anything else returns `undefined`
*/
function getAutolinkHref(urlText) {
	if (/^[a-z][a-z0-9+.-]*:/i.test(urlText)) return urlText;
	if (/^[^\s@]+@[^\s@]+$/.test(urlText)) return `mailto:${urlText}`;
	if (/^www\./i.test(urlText)) return `https://${urlText}`;
	if (isLinkableBareHost(hostFromUrl(urlText))) return `https://${urlText}`;
}

//#endregion
//#region src/unicode.ts
const CHAR_LINE_FEED = 10;
const CHAR_CARRIAGE_RETURN = 13;
const CHAR_TAB = 9;
const CHAR_SPACE = 32;
/**
* Check if a char code is a space character.
*
* Ported from https://github.com/lezer-parser/markdown/blob/1.6.3/src/markdown.ts#L233
*/
function isSpaceChar(char) {
	return char === 32 || char === 9 || char === 10 || char === CHAR_CARRIAGE_RETURN;
}

//#endregion
//#region src/bare-autolink.ts
const DOMAIN_RE = /^[a-z0-9-]+(?:\.[a-z0-9-]+)+(?:\/[^\s<]*)?/i;
const BOUNDARY_BEFORE_RE = /[\s(*_~]/;
function isDomainStartChar(code) {
	return code >= 48 && code <= 57 || code >= 65 && code <= 90 || code >= 97 && code <= 122 || code === 45;
}
function countChar(text, end, ch) {
	let count = 0;
	for (let i = 0; i < end; i++) if (text[i] === ch) count++;
	return count;
}
function trimAutolinkEnd(matched) {
	let end = matched.length;
	for (;;) {
		const last = matched[end - 1];
		if (/[?!.,:*_~]/.test(last) || last === ")" && countChar(matched, end, ")") > countChar(matched, end, "(")) end--;
		else if (last === ";") {
			const entity = /&(?:#\d+|#x[a-f\d]+|\w+);$/.exec(matched.slice(0, end));
			if (!entity) break;
			end = entity.index;
		} else break;
	}
	return end;
}
/**
* Inline parser for a bare domain autolink such as `google.com` or
* `sub.domain.io/path` (no scheme, no `www.`). It runs after GFM's own
* `Autolink` so `www.`/scheme/email forms are claimed first and never reach
* here. The domain must pass `isLinkableBareHost` (a curated TLD list plus
* shape rules), which keeps `node.js`, `README.md`, and `i.e.` plain text. It
* emits the shared `URL` node, so the existing mark walk renders it like any
* other autolink.
*/
const bareAutolink = { parseInline: [{
	name: "BareAutolink",
	before: "Link",
	parse(cx, next, pos) {
		if (!isDomainStartChar(next) || cx.hasOpenLink) return -1;
		const before = cx.slice(pos - 1, pos);
		if (before !== "" && !BOUNDARY_BEFORE_RE.test(before)) return -1;
		const match = DOMAIN_RE.exec(cx.slice(pos, cx.end));
		if (!match) return -1;
		const length = trimAutolinkEnd(match[0]);
		if (length === 0) return -1;
		const text = match[0].slice(0, length);
		if (!isLinkableBareHost(hostFromUrl(text))) return -1;
		return cx.addElement(cx.elt("URL", pos, pos + length));
	}
}] };

//#endregion
//#region src/hashtag.ts
/**
* Letters, digits, `-`, `_`. Non-ASCII falls back to a Unicode test;
* surrogate halves fail it, so emoji terminate the tag.
*/
function isTagChar(code) {
	return code >= 48 && code <= 57 || code >= 65 && code <= 90 || code >= 97 && code <= 122 || code === 45 || code === 95 || code > 127 && /[\p{L}\p{N}]/u.test(String.fromCharCode(code));
}
function isLetter(code) {
	return code >= 65 && code <= 90 || code >= 97 && code <= 122 || code > 127 && /\p{L}/u.test(String.fromCharCode(code));
}
/**
* Inline parser for `#tag`: `#` followed by tag chars, at least one of
* them a letter, where the `#` sits at the start of the inline text or
* after whitespace. Mirrors the tag menu's `(?<!\S)#` trigger in
* `@meowdown/react`.
*/
const hashtag = {
	defineNodes: [{ name: "Hashtag" }],
	parseInline: [{
		name: "Hashtag",
		parse(cx, next, pos) {
			if (next !== 35) return -1;
			if (!/\s|^$/.test(cx.slice(pos - 1, pos))) return -1;
			let end = pos + 1;
			let hasLetter = false;
			while (end < cx.end) {
				const code = cx.char(end);
				if (!isTagChar(code)) break;
				hasLetter ||= isLetter(code);
				end++;
			}
			if (!hasLetter) return -1;
			return cx.addElement(cx.elt("Hashtag", pos, end));
		}
	}]
};

//#endregion
//#region src/highlight.ts
const HighlightDelim = {
	resolve: "Highlight",
	mark: "HighlightMark"
};
/**
* CommonMark punctuation class, copied from `@lezer/markdown`'s own
* `Punctuation` regex so highlight flanking decisions match GFM strikethrough.
*/
const PUNCTUATION = /[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~\u{A1}\u{2010}-\u{2027}]/u;
/**
* Inline parser for `==text==` highlight. Emits a `Highlight` node wrapping the
* content, with `HighlightMark` runs for the `==` delimiters, mirroring GFM
* `Strikethrough`. It reuses strikethrough's whitespace/punctuation flanking
* rules so a space-flanked `== ` never opens a highlight (a lone `a == b` stays
* literal), and refuses a third `=` so `===` runs are not consumed.
*/
const highlight = {
	defineNodes: [{ name: "Highlight" }, { name: "HighlightMark" }],
	parseInline: [{
		name: "Highlight",
		after: "Emphasis",
		parse(cx, next, pos) {
			if (next !== 61 || cx.char(pos + 1) !== 61 || cx.char(pos + 2) === 61) return -1;
			const before = cx.slice(pos - 1, pos);
			const after = cx.slice(pos + 2, pos + 3);
			const spaceBefore = /\s|^$/.test(before);
			const spaceAfter = /\s|^$/.test(after);
			const punctBefore = PUNCTUATION.test(before);
			const punctAfter = PUNCTUATION.test(after);
			return cx.addDelimiter(HighlightDelim, pos, pos + 2, !spaceAfter && (!punctAfter || spaceBefore || punctBefore), !spaceBefore && (!punctBefore || spaceAfter || punctAfter));
		}
	}]
};

//#endregion
//#region src/math.ts
function isDigit(code) {
	return code >= 48 && code <= 57;
}
/** A line whose content is exactly `$$`, allowing trailing whitespace. */
function isBlockMathFence(line) {
	if (line.next !== 36) return false;
	if (line.text.charCodeAt(line.pos + 1) !== 36) return false;
	if (line.text.charCodeAt(line.pos + 2) === 36) return false;
	return line.skipSpace(line.pos + 2) === line.text.length;
}
/**
* How many composite contexts (blockquote, list item) the line still sits
* inside. `Line.depth` is not in the public typings (the FencedCode parser
* reads it the same way); if a future upgrade drops it, every line counts as
* still inside, and an unterminated block simply runs longer.
*/
function getLineDepth(line) {
	const depth = line.depth;
	return typeof depth === "number" ? depth : Number.MAX_SAFE_INTEGER;
}
/**
* Inline parser for `$x$` and `$$x$$` TeX math, following Pandoc-style
* delimiter rules: the opening and closing runs must have the same length (1
* or 2 dollars), the content must not start or end with a space, the closing
* run must not be followed by a digit (so `$20,000 and $30,000` stays plain
* text), and the whole expression stays on one line. A backslash-escaped `\$`
* inside the content does not close. Runs are greedy: an opener preceded by
* another dollar never starts a new expression, and the first closing
* candidate decides: if it is invalid the whole expression fails, so an
* unpaired dollar never scans across the rest of the line. Claims the
* element eagerly, so the content is atomic: no nested markdown.
*/
const math = {
	defineNodes: [
		{ name: "InlineMath" },
		{ name: "InlineMathMark" },
		{
			name: "BlockMath",
			block: true
		},
		{ name: "BlockMathMark" }
	],
	parseBlock: [{
		name: "BlockMath",
		before: "FencedCode",
		parse(cx, line) {
			if (!isBlockMathFence(line)) return false;
			const from = cx.lineStart + line.pos;
			const marks = [cx.elt("BlockMathMark", from, from + 2)];
			for (let first = true, empty = true, hasLine = false;; first = false) {
				if (!cx.nextLine() || getLineDepth(line) < cx.depth) break;
				if (isBlockMathFence(line)) {
					if (empty && hasLine) marks.push(cx.elt("CodeText", cx.lineStart - 1, cx.lineStart));
					marks.push(cx.elt("BlockMathMark", cx.lineStart + line.pos, cx.lineStart + line.pos + 2));
					cx.nextLine();
					break;
				}
				hasLine = true;
				if (!first) {
					marks.push(cx.elt("CodeText", cx.lineStart - 1, cx.lineStart));
					empty = false;
				}
				const textFrom = cx.lineStart + line.basePos;
				const textTo = cx.lineStart + line.text.length;
				if (textFrom < textTo) {
					marks.push(cx.elt("CodeText", textFrom, textTo));
					empty = false;
				}
			}
			cx.addElement(cx.elt("BlockMath", from, cx.prevLineEnd(), marks));
			return true;
		},
		endLeaf(_cx, line) {
			return isBlockMathFence(line);
		}
	}],
	parseInline: [{
		name: "InlineMath",
		after: "InlineCode",
		parse(cx, next, pos) {
			if (next !== 36 || cx.char(pos - 1) === 36) return -1;
			const delimLength = cx.char(pos + 1) === 36 ? 2 : 1;
			if (cx.char(pos + delimLength) === 36) return -1;
			const contentFrom = pos + delimLength;
			if (isSpaceChar(cx.char(contentFrom))) return -1;
			for (let i = contentFrom; i < cx.end; i++) {
				const code = cx.char(i);
				if (code === 10) return -1;
				if (code === 92) {
					i++;
					continue;
				}
				if (code !== 36) continue;
				let closeLength = 1;
				while (cx.char(i + closeLength) === 36) closeLength++;
				if (closeLength !== delimLength || isSpaceChar(cx.char(i - 1)) || isDigit(cx.char(i + closeLength))) return -1;
				const end = i + closeLength;
				return cx.addElement(cx.elt("InlineMath", pos, end, [cx.elt("InlineMathMark", pos, contentFrom), cx.elt("InlineMathMark", i, end)]));
			}
			return -1;
		}
	}]
};

//#endregion
//#region src/scheme-autolink.ts
const SCHEME_URI_RE = /^[a-z][a-z0-9+.-]*:\/\/[^\s<]+/i;
function isSchemeStartChar(code) {
	return code >= 65 && code <= 90 || code >= 97 && code <= 122;
}
/**
* Inline parser for a bare custom-scheme URI such as
* `x-devonthink-item://ABCD-1234` or `obsidian://open?vault=notes`. GFM's own
* `Autolink` only recognizes `www.`/`http(s)://`/`mailto:`/`xmpp:`/email
* forms, so an app URI typed or pasted as plain text stayed unlinkified.
*
* Registered `after: 'Autolink'` so GFM keeps first claim on the shapes it
* knows (its `http(s)` domain and end rules stay authoritative); this parser
* only picks up what GFM declines. It follows `bareAutolink`'s boundary rules
* and emits the shared `URL` node, so the existing mark walk renders it like
* any other autolink.
*/
const schemeAutolink = { parseInline: [{
	name: "SchemeAutolink",
	after: "Autolink",
	parse(cx, next, pos) {
		if (!isSchemeStartChar(next) || cx.hasOpenLink) return -1;
		const before = cx.slice(pos - 1, pos);
		if (before !== "" && !BOUNDARY_BEFORE_RE.test(before)) return -1;
		const match = SCHEME_URI_RE.exec(cx.slice(pos, cx.end));
		if (!match) return -1;
		const length = trimAutolinkEnd(match[0]);
		if (length <= match[0].indexOf("://") + 3) return -1;
		return cx.addElement(cx.elt("URL", pos, pos + length));
	}
}] };

//#endregion
//#region src/wiki-embed.ts
/**
* Inline parser for Obsidian-style wiki embeds (`![[target]]`). The target is
* deliberately kept opaque here; classification and optional size parsing
* happen at the host boundary in `parseWikiEmbed`.
*/
const wikiEmbed = {
	defineNodes: [{ name: "WikiEmbed" }, { name: "WikiEmbedMark" }],
	parseInline: [{
		name: "WikiEmbed",
		before: "Link",
		parse(cx, next, pos) {
			if (next !== 33 || cx.char(pos + 1) !== 91 || cx.char(pos + 2) !== 91) return -1;
			let hasContent = false;
			for (let index = pos + 3; index < cx.end - 1; index++) {
				const code = cx.char(index);
				if (code === 93) {
					if (!hasContent || cx.char(index + 1) !== 93) return -1;
					const end = index + 2;
					return cx.addElement(cx.elt("WikiEmbed", pos, end, [cx.elt("WikiEmbedMark", pos, pos + 3), cx.elt("WikiEmbedMark", index, end)]));
				}
				if (code === 91 || code === 10) return -1;
				if (code !== 32 && code !== 9) hasContent = true;
			}
			return -1;
		}
	}]
};

//#endregion
//#region src/wikilink.ts
/**
* Inline parser for `[[target]]`: any chars except `[`, `]` and
* newline, at least one of them not a space/tab. The first `]` must
* pair into `]]`. Registered before `Link` and claims the whole
* element eagerly, so the target is atomic: no nested markdown, no
* tags.
*/
const wikilink = {
	defineNodes: [{ name: "Wikilink" }, { name: "WikilinkMark" }],
	parseInline: [{
		name: "Wikilink",
		before: "Link",
		parse(cx, next, pos) {
			if (next !== 91 || cx.char(pos + 1) !== 91) return -1;
			let hasContent = false;
			for (let i = pos + 2; i < cx.end - 1; i++) {
				const code = cx.char(i);
				if (code === 93) {
					if (!hasContent || cx.char(i + 1) !== 93) return -1;
					const end = i + 2;
					return cx.addElement(cx.elt("Wikilink", pos, end, [cx.elt("WikilinkMark", pos, pos + 2), cx.elt("WikilinkMark", i, end)]));
				}
				if (code === 91 || code === 10) return -1;
				if (code !== 32 && code !== 9) hasContent = true;
			}
			return -1;
		}
	}]
};

//#endregion
//#region src/parser.ts
/**
* Inline-parser entry that immediately claims the entire inline
* region. Returning `cx.end` makes `MarkdownParser.parseInline` exit
* its outer loop on the first iteration, so no other inline parser
* ever runs on a leaf. Used by `gfmBlockOnlyParser` to skip inline
* parsing entirely while keeping the block phase intact.
*/
function consumeAllInline(cx) {
	return cx.end;
}
/**
* `@lezer/markdown` parser configured with GFM (table, strikethrough,
* task list, autolink) plus meowdown's `Hashtag`, `Wikilink`, bare
* domain autolink, bare `scheme://` autolink, `==Highlight==`, and
* `$math$` inline syntax. Use when both block and inline structure must
* be recognized.
*/
const gfmParser = parser.configure([
	GFM,
	hashtag,
	wikiEmbed,
	wikilink,
	bareAutolink,
	schemeAutolink,
	highlight,
	math
]);
/**
* `@lezer/markdown` parser configured with GFM plus a `SkipInline`
* parser that short-circuits the inline phase. The block phase still
* produces all block-level structural marks (HeaderMark, ListMark,
* QuoteMark, CodeMark, CodeText, …), but no Emphasis / Link /
* InlineCode etc. nodes are ever created.
*/
const gfmBlockOnlyParser = gfmParser.configure({ parseInline: [{
	name: "SkipInline",
	before: "Escape",
	parse: consumeAllInline
}] });

//#endregion
//#region src/inline.ts
/**
* Run `gfmParser`'s inline phase on a string and return the top-level
* inline elements. Wraps the cast that's needed because Lezer's
* `parseInline` is typed as returning `Element[]` (with `children`
* marked `@internal`).
*/
function parseInline(text) {
	return gfmParser.parseInline(text, 0);
}
/** Depth-first list of every element matching `test`. */
function collectInlineElements(nodes, test, out = []) {
	for (const node of nodes) {
		if (test(node)) out.push(node);
		collectInlineElements(node.children, test, out);
	}
	return out;
}

//#endregion
//#region src/node-ids.ts
function lezerNodeIdsByName(parser) {
	const ids = {};
	for (const t of parser.nodeSet.types) ids[t.name] = t.id;
	return ids;
}
/**
* Cached node name -> node id lookup for the project-wide `gfmParser`.
*/
const LEZER_NODE_IDS = lezerNodeIdsByName(gfmParser);

//#endregion
export { LEZER_NODE_IDS, collectInlineElements, getAutolinkHref, gfmBlockOnlyParser, gfmParser, isSpaceChar, parseInline };