import { GFM, parser } from "@lezer/markdown";
import { parseXPostId } from "@post-embed/schema";

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
/**
* The host portion of a bare candidate: everything before the first `/`.
*/
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
/**
* A line whose content is exactly `$$`, allowing trailing whitespace.
*/
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
//#region src/collect-images.ts
/**
* The destinations of the inline `![alt](src)` images in `markdown`, in
* document order. Reference images are not resolved.
*/
function collectImages(markdown) {
	const sources = [];
	gfmParser.parse(markdown).iterate({ enter: (node) => {
		if (node.type.id !== LEZER_NODE_IDS.Image) return true;
		let linkMarkCount = 0;
		for (let child = node.node.firstChild; child != null; child = child.nextSibling) if (child.type.id === LEZER_NODE_IDS.LinkMark) linkMarkCount++;
		else if (linkMarkCount >= 2 && child.type.id === LEZER_NODE_IDS.URL) sources.push(markdown.slice(child.from, child.to));
		return false;
	} });
	return sources;
}

//#endregion
//#region src/safe-parse-url.ts
function safeParseURL(src) {
	try {
		return new URL(src);
	} catch {
		return;
	}
}

//#endregion
//#region src/embed.ts
const YOUTUBE_HOSTS = /^(?:www\.|m\.)?(?:youtube\.com|youtube-nocookie\.com)$/i;
const YOUTU_BE_HOST = /^(?:www\.)?youtu\.be$/i;
const VIDEO_ID = /^[\w-]{11}$/;
function isYouTubeVideo(src) {
	const url = safeParseURL(src);
	if (!url) return false;
	let videoId = null;
	if (YOUTU_BE_HOST.test(url.hostname)) videoId = url.pathname.slice(1);
	else if (YOUTUBE_HOSTS.test(url.hostname)) {
		const [, firstSegment, secondSegment] = url.pathname.split("/");
		if (url.pathname === "/watch") videoId = url.searchParams.get("v");
		else if (firstSegment === "shorts" || firstSegment === "embed" || firstSegment === "live") videoId = secondSegment ?? null;
	}
	return videoId !== null && VIDEO_ID.test(videoId);
}
/**
* The embed card an image `src` renders as, or `undefined` for a plain image.
*/
function matchEmbed(src) {
	if (parseXPostId(src) !== void 0) return "x-post";
	if (isYouTubeVideo(src)) return "youtube-video";
}

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
/**
* Depth-first list of every element matching `test`.
*/
function collectInlineElements(nodes, test, out = []) {
	for (const node of nodes) {
		if (test(node)) out.push(node);
		collectInlineElements(node.children, test, out);
	}
	return out;
}

//#endregion
//#region src/ast/code.ts
/**
* The narrowest fence that can hold `code`: wider than every line of it that
* would close the fence early, and never under CommonMark's minimum of three. A
* closing fence is a run of the fence character alone on its line; a run with
* anything else on the line (`` a ``` ``, `` ``` x ``) or four columns in closes
* nothing, so the fence holds it as it is.
*/
function minFenceLength(code, tilde) {
	const fenceChar = tilde ? 126 : 96;
	let longest = 2;
	let lineStart = 0;
	while (lineStart <= code.length) {
		let lineEnd = code.indexOf("\n", lineStart);
		if (lineEnd < 0) lineEnd = code.length;
		let index = lineStart;
		while (index < lineEnd && code.charCodeAt(index) === 32) index++;
		if (index - lineStart < 4) {
			const runStart = index;
			while (index < lineEnd && code.charCodeAt(index) === fenceChar) index++;
			const run = index - runStart;
			while (index < lineEnd && isSpaceOrTab$1(code.charCodeAt(index))) index++;
			if (index === lineEnd && run > longest) longest = run;
		}
		lineStart = lineEnd + 1;
	}
	return longest + 1;
}
function isSpaceOrTab$1(char) {
	return char === 32 || char === 9;
}
/**
* Whether indentation can spell `code` as an indented code block. There is no
* line to carry the four columns of a block with no content at all, and none to
* carry a blank line at either end.
*/
function canIndentCode(code) {
	return code !== "" && !code.startsWith("\n") && !code.endsWith("\n");
}

//#endregion
//#region src/ast/path.ts
function* visit(entry) {
	yield entry;
	const children = entry.node.children;
	if (!children) return;
	for (let index = 0; index < children.length; index++) yield* visit({
		node: children[index],
		parent: entry.node,
		index,
		path: [...entry.path, index]
	});
}
/**
* Visit the root and every descendant, including table rows and cells, in document order.
*/
function* walkMarkdownAst(root) {
	yield* visit({
		node: root,
		parent: void 0,
		index: void 0,
		path: []
	});
}
/**
* Resolve an address against its original tree; malformed or missing addresses return undefined.
*/
function resolveMarkdownAstPath(root, path) {
	let node = root;
	let parent;
	let index;
	for (const childIndex of path) {
		if (!Number.isSafeInteger(childIndex) || childIndex < 0) return;
		const child = node.children?.[childIndex];
		if (!child) return;
		parent = node;
		index = childIndex;
		node = child;
	}
	return {
		node,
		parent,
		index,
		path: [...path]
	};
}

//#endregion
//#region src/ast/parse.ts
/**
* Parse Markdown blocks, retaining inline syntax as literal strings. `\r\n` and
* `\r` are read as `\n`, and positions index the text with `\n` line endings.
*/
function parseMarkdownAst(markdown, options = {}) {
	if (markdown.includes("\r")) markdown = markdown.replaceAll(/\r\n?/g, "\n");
	let frontmatterBody;
	let base = 0;
	if (options.frontmatter) {
		const [body, matchLength] = matchFrontmatter(markdown);
		frontmatterBody = body;
		base = matchLength ?? 0;
	}
	const rest = base ? markdown.slice(base) : markdown;
	const tree = gfmBlockOnlyParser.parse(rest);
	const document = {
		type: "document",
		frontmatter: frontmatterBody,
		children: collectBlocks(tree.cursor(), rest, 0, base > 0)
	};
	if (base) relocatePositions(document, base);
	clearContinuedOrders(document);
	return document;
}
/**
* Only the first item of an ordered list sets its number, so the number on an
* item that continues the list above it carries no meaning and is dropped.
*/
function clearContinuedOrders(document) {
	for (const { node } of walkMarkdownAst(document)) {
		if (!("children" in node) || !node.children) continue;
		const children = node.children;
		for (let i = children.length - 1; i > 0; i--) {
			const child = children[i];
			const previous = children[i - 1];
			if (child.type === "listItem" && child.kind === "ordered" && previous.type === "listItem" && previous.kind === "ordered" && child.marker === ")" === (previous.marker === ")")) child.order = void 0;
		}
	}
}
/**
* Positions are measured in the parsed text: the source minus its frontmatter.
* Move them onto the source.
*/
function relocatePositions(document, base) {
	for (const { node } of walkMarkdownAst(document)) {
		if (!("position" in node) || !node.position) continue;
		node.position = {
			from: node.position.from + base,
			to: node.position.to + base
		};
	}
}
/**
* Matches a leading YAML frontmatter block: a `---` fence at offset 0, a body,
* and a closing `---` fence, each fence being exactly three dashes followed by
* optional spaces or tabs. Returns the body (the lines between the fences,
* joined by `\n`, without a trailing newline) and the length of the matched
* region, or undefined when there is no terminated frontmatter block (a lone `---`
* with no closing fence stays a thematic break).
*/
const FRONTMATTER_RE = /^---[ \t]*\n([\s\S]*?\n)?---[ \t]*(?:\n|$)/;
function matchFrontmatter(markdown) {
	const match = FRONTMATTER_RE.exec(markdown);
	if (!match) return [];
	return [(match[1] ?? "").replace(/\n$/, ""), match[0].length];
}
/**
* Walk the document's children, converting each block-level child and
* flattening any node converter that returns multiple siblings (lists are the
* main case). Blank lines before the first block and after the last one are
* content too, one empty paragraph each; when a frontmatter block was peeled
* off ahead of `text`, the first leading blank line is that block's separator.
*/
function collectBlocks(cursor, text, column, afterFrontmatter) {
	const out = [];
	if (!cursor.firstChild()) {
		appendBlankLineParagraphs(out, text, 0, text.length, 0, false);
		if (out.length === 0) out.push(buildEmptyParagraph(lineEndAt(text, 0)));
		return out;
	}
	appendBlankLineParagraphs(out, text, 0, cursor.from, afterFrontmatter ? 1 : 0, false);
	let previousTo;
	do {
		if (previousTo != null) appendGapParagraphs(out, text, previousTo, cursor.from);
		previousTo = cursor.to;
		appendBlocks(out, convertBlock(cursor, text, column));
	} while (cursor.nextSibling());
	cursor.parent();
	const end = text.endsWith("\n") ? text.length - 1 : text.length;
	appendBlankLineParagraphs(out, text, previousTo, end, 1, true);
	return out;
}
/**
* Append `blocks`, dropping the indented spelling from a code block that lands
* right after a list: four columns of indentation would put it inside the item
* above instead of after it, so it can only be written as a fence.
*/
function appendBlocks(out, blocks) {
	for (const block of blocks) {
		if (block.type === "codeBlock" && block.fenceStyle === "indented" && out.at(-1)?.type === "listItem") {
			out.push({
				...block,
				fenceStyle: void 0
			});
			continue;
		}
		out.push(block);
	}
}
/**
* Blank lines between two sibling blocks are content: a run of K blank lines
* is one block separator plus K-1 empty paragraphs. The gap slice between the
* siblings' ranges holds only line terminators and structural prefixes
* (indent, blockquote `>`), so counting newlines is enough - the gap has K+1
* of them (the previous block's own terminator plus one per blank line).
*/
function appendGapParagraphs(out, text, gapFrom, gapTo) {
	appendBlankLineParagraphs(out, text, gapFrom, gapTo, 2, false);
}
/**
* One empty paragraph per blank line, positioned at the end of its line. Every
* newline inside `from`..`to` ends a line; the first `skip` of them end lines
* that are not blank lines of their own (a block's last line, the separator
* before the next block). The line `to` is on has no newline inside the slice:
* `openLast` counts it as a blank line too, provided the slice held the lines
* it was asked to skip.
*/
function appendBlankLineParagraphs(out, text, from, to, skip, openLast) {
	let count = 0;
	for (let index = from; index < to; index++) {
		if (text.charCodeAt(index) !== 10) continue;
		count++;
		if (count > skip) out.push(buildEmptyParagraph(index));
	}
	if (openLast && count >= skip) out.push(buildEmptyParagraph(lineEndAt(text, to)));
}
function buildEmptyParagraph(offset) {
	return {
		type: "paragraph",
		value: "",
		position: {
			from: offset,
			to: offset
		}
	};
}
/**
* The end of the line `offset` is on: its newline, or the end of the text.
*/
function lineEndAt(text, offset) {
	const end = text.indexOf("\n", offset);
	return end < 0 ? text.length : end;
}
function positionOf(cursor) {
	return {
		from: cursor.from,
		to: cursor.to
	};
}
function convertBlock(cursor, text, column) {
	switch (cursor.type.id) {
		case LEZER_NODE_IDS.ATXHeading1: return [convertHeading(cursor, text, column, 1, false)];
		case LEZER_NODE_IDS.ATXHeading2: return [convertHeading(cursor, text, column, 2, false)];
		case LEZER_NODE_IDS.ATXHeading3: return [convertHeading(cursor, text, column, 3, false)];
		case LEZER_NODE_IDS.ATXHeading4: return [convertHeading(cursor, text, column, 4, false)];
		case LEZER_NODE_IDS.ATXHeading5: return [convertHeading(cursor, text, column, 5, false)];
		case LEZER_NODE_IDS.ATXHeading6: return [convertHeading(cursor, text, column, 6, false)];
		case LEZER_NODE_IDS.SetextHeading1: return [convertHeading(cursor, text, column, 1, true)];
		case LEZER_NODE_IDS.SetextHeading2: return [convertHeading(cursor, text, column, 2, true)];
		case LEZER_NODE_IDS.Paragraph: return [convertParagraph(cursor, text, column)];
		case LEZER_NODE_IDS.LinkReference: return [convertParagraph(cursor, text, column)];
		case LEZER_NODE_IDS.CommentBlock: return [convertHTMLComment(cursor, text, column)];
		case LEZER_NODE_IDS.HTMLBlock:
		case LEZER_NODE_IDS.ProcessingInstructionBlock: return [convertParagraph(cursor, text, column)];
		case LEZER_NODE_IDS.Blockquote: return [convertBlockquote(cursor, text)];
		case LEZER_NODE_IDS.BulletList: return convertList(cursor, text, column, "bullet");
		case LEZER_NODE_IDS.OrderedList: return convertList(cursor, text, column, "ordered");
		case LEZER_NODE_IDS.FencedCode:
		case LEZER_NODE_IDS.CodeBlock: return [convertCodeBlock(cursor, text)];
		case LEZER_NODE_IDS.BlockMath: return [convertBlockMath(cursor, text)];
		case LEZER_NODE_IDS.HorizontalRule: {
			const marker = text.slice(cursor.from, cursor.to).trimEnd();
			return [{
				type: "horizontalRule",
				marker: marker === "---" ? void 0 : marker,
				position: positionOf(cursor)
			}];
		}
		case LEZER_NODE_IDS.Table: return [convertTable(cursor, text)];
		case LEZER_NODE_IDS.Task: return [convertParagraph(cursor, text, column)];
		default:
			if (text.slice(cursor.from, cursor.to).trim() === "") return [];
			console.warn(`[meowdown] unsupported lezer block "${cursor.type.name}"`);
			return [convertParagraph(cursor, text, column)];
	}
}
function convertHeading(cursor, text, column, level, isSetext) {
	const position = positionOf(cursor);
	const headingFrom = cursor.from;
	let contentStart = cursor.from;
	let contentEnd = cursor.to;
	let trailingMarkFrom = -1;
	let trailingMarkTo = -1;
	if (cursor.firstChild()) {
		if (cursor.type.id === LEZER_NODE_IDS.HeaderMark && cursor.from === headingFrom) contentStart = cursor.to;
		let lastId = -1;
		let lastFrom = -1;
		let lastTo = -1;
		do {
			lastId = cursor.type.id;
			lastFrom = cursor.from;
			lastTo = cursor.to;
		} while (cursor.nextSibling());
		if (lastId === LEZER_NODE_IDS.HeaderMark && lastFrom > contentStart) {
			contentEnd = isSetext ? text.lastIndexOf("\n", lastFrom - 1) : lastFrom;
			trailingMarkFrom = lastFrom;
			trailingMarkTo = lastTo;
		}
		cursor.parent();
	}
	const raw = dedentContinuation(readLeafText(cursor, text, contentStart, contentEnd), column);
	const content = isSetext ? raw : trimGap(raw);
	return {
		type: "heading",
		level,
		setextUnderline: isSetext ? countUnderlineChars(text, trailingMarkFrom, trailingMarkTo) || 1 : void 0,
		closingHashes: !isSetext && trailingMarkFrom >= 0 ? countHashChars(text, trailingMarkFrom, trailingMarkTo) || void 0 : void 0,
		value: content,
		position
	};
}
/**
* Trim the whitespace lezer's marker gap can contain: space, tab and the line
* ends (`space` in `@lezer/markdown`, matching `isSpaceChar`). A plain
* `String.prototype.trim` would also take a no-break or an ideographic space,
* which lezer reads as heading text - and a `#` left standing next to one flips
* into a closing run on the way back (`# #\u{A0}`).
*/
function trimGap(text) {
	let start = 0;
	let end = text.length;
	while (start < end && isSpaceChar(text.charCodeAt(start))) start++;
	while (end > start && isSpaceChar(text.charCodeAt(end - 1))) end--;
	return text.slice(start, end);
}
/**
* Count the `=` / `-` characters in a setext underline run.
*/
function countUnderlineChars(text, from, to) {
	if (from < 0) return 0;
	let count = 0;
	for (let i = from; i < to; i++) {
		const code = text.charCodeAt(i);
		if (code === 61 || code === 45) count++;
	}
	return count;
}
/**
* Count the `#` characters between `from` and `to`.
*/
function countHashChars(text, from, to) {
	if (from < 0) return 0;
	let count = 0;
	for (let i = from; i < to; i++) if (text.charCodeAt(i) === 35) count++;
	return count;
}
/**
* The column at which content begins on the line containing `from` (i.e. the
* enclosing container's content column). Columns count a tab as a CommonMark
* tab stop of 4 (`4 - col % 4`), matching how lezer measures indentation.
*/
function measureContentColumn(text, from) {
	const lineStart = text.lastIndexOf("\n", from - 1) + 1;
	let col = 0;
	for (let index = lineStart; index < from; index++) col += text.charCodeAt(index) === 9 ? 4 - col % 4 : 1;
	return col;
}
/**
* Drop a line's leading whitespace up to `column`, counting a tab as `4 - col % 4`
* columns. Whitespace the container never wrote is left alone: a tab that would
* reach past `column` stands for more columns than the container takes, and a
* line whose indentation stops short of `column` was written lazily, without any
* prefix at all.
*/
function sliceColumn(line, column) {
	let col = 0;
	let index = 0;
	while (col < column) {
		const code = line.charCodeAt(index);
		if (code === 32) col += 1;
		else if (code === 9) {
			const width = 4 - col % 4;
			if (col + width > column) break;
			col += width;
		} else return line;
		index++;
	}
	return line.slice(index);
}
/**
* Strip a leaf block's structural continuation indent.
*
* lezer keeps the indent of a multi-line block's continuation lines inside the
* source span (its `scrub` pads each line's container prefix to equal-width
* whitespace to preserve positions). CommonMark and lezer require every
* continuation line to be indented to the same content `column`, which equals
* the block's first-line column. The first line is already past its indent, so
* only lines 2..n are dedented. Returns `content` untouched at column 0 (a
* top-level block) or when there is no continuation line.
*/
function dedentContinuation(content, column) {
	if (column === 0 || !content.includes("\n")) return content;
	return content.split("\n").map((line, index) => index === 0 ? line : sliceColumn(line, column)).join("\n");
}
/**
* The blockquote markers inside `from`..`to`, as a flat run of `from, to` pairs
* in document order. A marker can sit at any depth: a paragraph carries its own,
* while a link reference's lands inside the `LinkLabel` that spans the break.
* The cursor ends where it started.
*/
function collectQuoteMarks(cursor, marks, from, to) {
	if (!cursor.firstChild()) return;
	do {
		if (cursor.from >= to) break;
		if (cursor.to <= from) continue;
		if (cursor.type.id === LEZER_NODE_IDS.QuoteMark) {
			marks.push(cursor.from, cursor.to);
			continue;
		}
		collectQuoteMarks(cursor, marks, from, to);
	} while (cursor.nextSibling());
	cursor.parent();
}
/**
* The source between `from` and `to`, minus the blockquote markers inside it.
*
* In block-only parsing a leaf block has no inline children, with one
* exception: lezer leaves the `QuoteMark` of every continuation line of a
* multi-line block (`> l1\n> l2`) inside the block's own span. A marker takes
* the whole line prefix with it, the single space after it included, exactly as
* the serializer's own prefix puts it back. Only a space: a tab after the marker
* stands for the columns up to the next tab stop, more than the prefix writes
* back, so it stays in the text as the indentation it is. A line with no marker
* carried no prefix at all - it is a lazy continuation, and every column on it
* is its own. Markers outside `from`..`to` (an ATX heading's own marks, a setext
* underline's line) are left alone. The cursor ends where it started.
*/
function readLeafText(cursor, text, from, to) {
	const lineBreak = text.indexOf("\n", from);
	if (lineBreak < 0 || lineBreak >= to) return text.slice(from, to);
	const marks = [];
	collectQuoteMarks(cursor, marks, from, to);
	let content = "";
	let pos = from;
	for (let index = 0; index < marks.length; index += 2) {
		content += text.slice(pos, Math.max(pos, text.lastIndexOf("\n", marks[index]) + 1));
		pos = marks[index + 1];
		if (text.charCodeAt(pos) === 32) pos += 1;
	}
	return trimTrailingBlankLines(content + text.slice(pos, to));
}
/**
* Drop the blank lines a block ends with, the line break in front of them
* included. A raw HTML or processing-instruction block with no closing sequence
* runs its span to the end of the document and swallows them; a leaf block's
* text ends where its last line does, which is where the serializer ends its
* own output (`MdOut.finish`), so recording more would lose it on the way back.
*/
function trimTrailingBlankLines(content) {
	let end = content.length;
	for (let index = end - 1; index >= 0; index--) {
		const code = content.charCodeAt(index);
		if (code === 10) end = index;
		else if (code !== 32 && code !== 9) break;
	}
	return content.slice(0, end);
}
/**
* Build a paragraph from raw markdown content, dedenting continuation lines so
* the serializer's own line prefix does not double the indent. A soft line break
* stays a literal `\n` in the paragraph value.
*/
function buildParagraph(content, column, position) {
	return {
		type: "paragraph",
		value: dedentContinuation(content, column),
		position
	};
}
function convertParagraph(cursor, text, column) {
	return buildParagraph(readLeafText(cursor, text, cursor.from, cursor.to), column, positionOf(cursor));
}
/**
* Build the invisible `htmlComment` node from a `CommentBlock`. The raw comment
* (delimiters included) is kept verbatim on the node's `content` attribute;
* continuation lines are dedented like a paragraph's so the serializer's own
* line prefix re-applies the container indent instead of doubling it.
*/
function convertHTMLComment(cursor, text, column) {
	return {
		type: "htmlComment",
		value: dedentContinuation(readLeafText(cursor, text, cursor.from, cursor.to), column),
		position: positionOf(cursor)
	};
}
/**
* A blockquote's children start at column 0: every column an enclosing container
* wrote sits in front of the `> ` marker on the line, and comes off with it.
*
* Blank quote lines before the first block and after the last one are empty
* paragraphs, like the document's own edges. The quote's range ends on its last
* line rather than after it, so every newline in the trailing slice is a blank
* line, and a quote made of markers only has one more line than newlines.
*/
function convertBlockquote(cursor, text) {
	const content = [];
	const position = positionOf(cursor);
	const from = cursor.from;
	const to = cursor.to;
	let previousTo;
	if (cursor.firstChild()) {
		do {
			if (cursor.type.id === LEZER_NODE_IDS.QuoteMark) continue;
			if (previousTo == null) appendBlankLineParagraphs(content, text, from, cursor.from, 0, false);
			else appendGapParagraphs(content, text, previousTo, cursor.from);
			previousTo = cursor.to;
			appendBlocks(content, convertBlock(cursor, text, 0));
		} while (cursor.nextSibling());
		cursor.parent();
	}
	if (previousTo == null) appendBlankLineParagraphs(content, text, from, to, 0, true);
	else appendBlankLineParagraphs(content, text, previousTo, to, 1, true);
	return {
		type: "blockquote",
		children: content,
		position
	};
}
function convertList(cursor, text, column, kind) {
	const out = [];
	if (cursor.firstChild()) {
		let previousContentEnd;
		do {
			if (cursor.type.id !== LEZER_NODE_IDS.ListItem) continue;
			if (previousContentEnd != null) appendGapParagraphs(out, text, previousContentEnd, cursor.from);
			const [item, contentEnd] = convertListItem(cursor, text, column, kind);
			out.push(item);
			previousContentEnd = contentEnd;
		} while (cursor.nextSibling());
		cursor.parent();
	}
	return out;
}
/**
* The marker style at `cursor`, plus the start number of an ordered item.
*/
function readListMark(cursor, text, kind) {
	if (kind === "ordered") {
		const delimiterCode = text.charCodeAt(cursor.to - 1);
		let marker;
		if (delimiterCode === 41) marker = ")";
		else if (delimiterCode === 46) marker = ".";
		const number = Number.parseInt(text.slice(cursor.from, cursor.to), 10);
		return {
			marker,
			order: Number.isFinite(number) ? number : 1
		};
	}
	const code = text.charCodeAt(cursor.from);
	return {
		marker: code === 42 ? "*" : code === 43 ? "+" : "-",
		order: void 0
	};
}
/**
* A GFM `Task` leaf (`[ ] text` / `[x] text`, after the list mark). The checkbox
* becomes the item's own attributes; the text after it becomes its paragraph.
*/
function convertTaskItem(cursor, text, column) {
	let taskStart = cursor.from;
	const taskEnd = cursor.to;
	let checked = false;
	let taskMarker;
	if (cursor.firstChild()) {
		if (cursor.type.id === LEZER_NODE_IDS.TaskMarker) {
			const taskMarkerCode = text.charCodeAt(cursor.from + 1);
			if (taskMarkerCode === 120) {
				checked = true;
				taskMarker = "x";
			} else if (taskMarkerCode === 88) {
				checked = true;
				taskMarker = "X";
			}
			taskStart = cursor.to;
		}
		cursor.parent();
	}
	if (taskStart < taskEnd && isSpaceChar(text.charCodeAt(taskStart))) taskStart += 1;
	const paragraph = buildParagraph(readLeafText(cursor, text, taskStart, taskEnd), column, {
		from: taskStart,
		to: taskEnd
	});
	return {
		checked,
		taskMarker,
		paragraph
	};
}
/**
* The gap between a list marker ending at `markTo` and the item's first content
* at `contentFrom`. Only content that opens on the marker's own line measures a
* gap; an item whose content starts on the next line takes the canonical single
* space, the column its own continuation lines are indented to. A gap of 5+ is
* indented code (a different node, so the content's column would be the code
* block's), and 1 is the canonical default; only a 2-4 space gap is a faithful,
* content-preserving variation.
*/
function measureMarkerGap(text, contentFrom, markTo, markEndColumn) {
	const gap = markTo != null && text.lastIndexOf("\n", contentFrom - 1) < markTo ? measureContentColumn(text, contentFrom) - markEndColumn : 1;
	return gap >= 2 && gap <= 4 ? gap : 1;
}
function convertListItem(cursor, text, column, kind) {
	const content = [];
	let taskChecked;
	let taskMarker;
	let order;
	let marker;
	let markWidth = 1;
	let markTo;
	let markEndColumn = 0;
	let markerGap = 1;
	let contentColumn = column + markWidth + markerGap;
	let previousTo;
	if (cursor.firstChild()) {
		do {
			if (cursor.type.id === LEZER_NODE_IDS.QuoteMark) continue;
			if (cursor.type.id === LEZER_NODE_IDS.ListMark) {
				const listMark = readListMark(cursor, text, kind);
				marker = listMark.marker;
				order = listMark.order;
				markWidth = cursor.to - cursor.from;
				markTo = cursor.to;
				markEndColumn = measureContentColumn(text, cursor.to);
				continue;
			}
			if (previousTo == null) {
				markerGap = measureMarkerGap(text, cursor.from, markTo, markEndColumn);
				contentColumn = column + markWidth + markerGap;
			} else appendGapParagraphs(content, text, previousTo, cursor.from);
			previousTo = cursor.to;
			if (kind === "bullet" && cursor.type.id === LEZER_NODE_IDS.Task) {
				const task = convertTaskItem(cursor, text, contentColumn);
				taskChecked = task.checked;
				taskMarker = task.taskMarker;
				content.push(task.paragraph);
				continue;
			}
			appendBlocks(content, convertBlock(cursor, text, contentColumn));
		} while (cursor.nextSibling());
		cursor.parent();
	}
	const itemEnd = closeListItem(content, lineEndAt(text, markTo ?? cursor.from));
	const isTask = taskChecked != null;
	const collapsed = !isTask && kind === "bullet" && marker === "+";
	return [{
		type: "listItem",
		children: content,
		kind: isTask ? "task" : kind,
		order: kind === "ordered" ? order ?? 1 : void 0,
		checked: taskChecked ?? false,
		collapsed,
		marker: collapsed ? void 0 : marker,
		taskMarker,
		markerGap,
		position: {
			from: cursor.from,
			to: itemEnd
		}
	}, previousTo ?? cursor.to];
}
/**
* An item with nothing after its marker (`-` alone on a line) still owns that
* line. Give it the empty paragraph the editor's schema forces on it, so the
* AST matches what the editor reads back and the serializer writes the marker
* instead of dropping the item. Returns where the item ends: at its last block,
* not at the lezer range, which in a blockquote swallows the `>` of the blank
* lines after the item.
*/
function closeListItem(content, lineEnd) {
	const last = content.at(-1);
	if (!last) content.push(buildEmptyParagraph(lineEnd));
	return last?.position?.to ?? lineEnd;
}
function convertCodeBlock(cursor, text) {
	const indented = cursor.type.id === LEZER_NODE_IDS.CodeBlock;
	const position = positionOf(cursor);
	const blockTo = cursor.to;
	let language = "";
	let code = "";
	let fenceStyle = indented ? "indented" : void 0;
	let fenceLength;
	let sawOpeningMark = false;
	let pos = cursor.from;
	if (cursor.firstChild()) {
		do {
			code += uncoveredCode(text, pos, cursor.from);
			pos = cursor.to;
			switch (cursor.type.id) {
				case LEZER_NODE_IDS.CodeMark:
					if (sawOpeningMark) break;
					sawOpeningMark = true;
					if (text.charCodeAt(cursor.from) === 126) fenceStyle = "tilde";
					fenceLength = cursor.to - cursor.from;
					break;
				case LEZER_NODE_IDS.CodeInfo:
					language = text.slice(cursor.from, cursor.to);
					break;
				case LEZER_NODE_IDS.CodeText: code += text.slice(cursor.from, cursor.to);
			}
		} while (cursor.nextSibling());
		cursor.parent();
		code += uncoveredCode(text, pos, blockTo);
	}
	if (fenceStyle === "indented" && !canIndentCode(code)) fenceStyle = void 0;
	if (fenceLength != null && fenceLength <= minFenceLength(code, fenceStyle === "tilde")) fenceLength = void 0;
	return {
		type: "codeBlock",
		language,
		fenceStyle,
		fenceLength,
		value: code,
		position
	};
}
/**
* Text inside a code block that no child node covers is the whitespace in
* front of a line's content: indentation, marker spaces, line breaks. The one
* exception is a quote marker indented with a tab (`>\t \n\t>2`), where lezer
* leaves the content after the marker uncovered too, so anything from a gap's
* first non-whitespace character on is code the child list dropped.
*/
function uncoveredCode(text, from, to) {
	for (let index = from; index < to; index++) if (!isSpaceChar(text.charCodeAt(index))) return text.slice(index, to);
	return "";
}
/**
* A `$$` display math block is a code block whose `language` is `math`; the
* `dollar` fence style makes it serialize back to `$$` fences.
*/
function convertBlockMath(cursor, text) {
	const position = positionOf(cursor);
	let code = "";
	if (cursor.firstChild()) {
		do
			if (cursor.type.id === LEZER_NODE_IDS.CodeText) code += text.slice(cursor.from, cursor.to);
		while (cursor.nextSibling());
		cursor.parent();
	}
	return {
		type: "codeBlock",
		language: "math",
		fenceStyle: "dollar",
		value: code,
		position
	};
}
function convertTable(cursor, text) {
	const position = positionOf(cursor);
	let aligns = [];
	if (cursor.firstChild()) {
		do
			if (cursor.type.id === LEZER_NODE_IDS.TableDelimiter) aligns = parseDelimiterAligns(text.slice(cursor.from, cursor.to));
		while (cursor.nextSibling());
		cursor.parent();
	}
	const rows = [];
	let columnCount = aligns.length;
	if (cursor.firstChild()) {
		do {
			const id = cursor.type.id;
			if (id !== LEZER_NODE_IDS.TableHeader && id !== LEZER_NODE_IDS.TableRow) continue;
			const header = id === LEZER_NODE_IDS.TableHeader;
			const cells = readTableCells(cursor, text, header);
			if (cells.length > columnCount) columnCount = cells.length;
			rows.push({
				header,
				cells,
				position: positionOf(cursor)
			});
		} while (cursor.nextSibling());
		cursor.parent();
	}
	return {
		type: "table",
		children: rows.map(({ header, cells, position: rowPosition }) => {
			const built = [];
			for (let column = 0; column < columnCount; column++) {
				const cell = cells[column] ?? buildEmptyTableCell(header, rowPosition.to);
				cell.align = aligns[column];
				built.push(cell);
			}
			return {
				type: "tableRow",
				children: built,
				position: rowPosition
			};
		}),
		position
	};
}
function buildEmptyTableCell(header, offset) {
	return {
		type: "tableCell",
		header,
		children: [buildEmptyParagraph(offset)],
		position: {
			from: offset,
			to: offset
		}
	};
}
function parseDelimiterAligns(separator) {
	return separator.split("|").map((segment) => segment.trim()).filter((segment) => segment !== "").map((segment) => {
		const left = segment.startsWith(":");
		const right = segment.endsWith(":");
		if (left && right) return "center";
		if (left) return "left";
		if (right) return "right";
	});
}
/**
* A row's cells, indexed by column, without alignment. `@lezer/markdown` emits
* no `TableCell` for an empty cell, so an empty cell is recognized by the pipe
* that closes its column, and positioned there.
*/
function readTableCells(cursor, text, header) {
	const cells = [];
	if (!cursor.firstChild()) return cells;
	let column = cursor.type.id === LEZER_NODE_IDS.TableDelimiter ? -1 : 0;
	do {
		if (cursor.type.id === LEZER_NODE_IDS.TableDelimiter) {
			if (cells.length === column) cells.push(buildEmptyTableCell(header, cursor.from));
			column++;
			continue;
		}
		if (cursor.type.id !== LEZER_NODE_IDS.TableCell) continue;
		const value = text.slice(cursor.from, cursor.to).trim().replaceAll(String.raw`\|`, "|");
		cells.push({
			type: "tableCell",
			header,
			children: [{
				type: "paragraph",
				value,
				position: positionOf(cursor)
			}],
			position: positionOf(cursor)
		});
	} while (cursor.nextSibling());
	cursor.parent();
	return cells;
}

//#endregion
//#region src/ast/serialize.ts
/**
* Serialize a block AST using Meowdown's normalization rules, not a lossless source printer.
*
* Performance design:
* - Output accumulates in a `string[]` buffer; joined once at the end.
*   Avoids per-block intermediate strings while keeping the
*   function-per-node-type readability of a switch dispatch.
* - Indent stack lives as a mutable `linePrefix` on the buffer object,
*   restored via local variables across nested calls - no fresh
*   context objects per recursion.
* - Inline strings are written directly; optional editor segments retain
*   continuation behavior across text boundaries.
* - Backtick fence width and cell escaping use single linear loops, no
*   regex on the hot path.
*/
function serializeMarkdownAst(node, options = {}) {
	const out = new MdOut();
	if (options.frontmatter) emitFrontmatter(node.type === "document" ? node.frontmatter : void 0, out);
	const child = node.children?.length === 1 ? node.children[0] : void 0;
	if (!(node.type === "document" && child?.type === "paragraph" && !hasInlineContent(child))) emit(node, out);
	return out.finish();
}
/**
* Emit the document's YAML frontmatter (stored on the document) as a
* leading `---\n{body}\n---` block. `undefined` (the default) emits nothing; an
* empty body emits `---\n---` with no middle blank line.
*/
function emitFrontmatter(body, out) {
	if (body == null) return;
	out.write("---");
	out.write("\n");
	if (body !== "") {
		out.write(body);
		out.write("\n");
	}
	out.write("---");
	out.closeBlock();
}
/**
* Heading prefixes indexed by level (1..6). Index 0 is a sentinel.
*/
const HEADING_PREFIX = [
	"",
	"# ",
	"## ",
	"### ",
	"#### ",
	"##### ",
	"###### "
];
function emitHeading(node, out) {
	const attrs = node;
	const underline = attrs.setextUnderline;
	if (underline != null && hasInlineContent(node) && attrs.level <= 2) {
		emitInlineChildren(node, out);
		const underlineChar = attrs.level === 1 ? "=" : "-";
		out.write("\n" + underlineChar.repeat(Math.max(1, underline)));
		out.closeBlock();
		return;
	}
	const prefix = HEADING_PREFIX[attrs.level] ?? "# ";
	out.write(hasInlineContent(node) ? prefix : prefix.slice(0, -1));
	emitInlineChildren(node, out);
	const closingHashes = attrs.closingHashes;
	if (closingHashes != null && closingHashes > 0) out.write(" " + "#".repeat(closingHashes));
	out.closeBlock();
}
var MdOut = class {
	constructor() {
		this.parts = [];
		this.linePrefix = "";
		this.pendingFirst = null;
		this.atLineStart = true;
		this.deferredBlankPrefix = null;
		this.contentLength = 0;
		this.length = 0;
	}
	/**
	* Write `text`, opening each embedded line with the current line prefix.
	*
	* `lazyLines` lets a line the prefix would change the meaning of - a setext
	* underline, a tab-indented line under a blockquote, a block opener - go out
	* as a lazy continuation instead (see `continuationPrefix`). Markdown keeps
	* such a line as text only when it arrives lazily, and the container picks
	* the paragraph up again on the next line. Only paragraph-like text may ask
	* for this: an unprefixed line would fall out of a code block, an html
	* comment, or an HTML block.
	*/
	write(text, lazyLines = false) {
		if (text === "") return;
		this.emitDeferredBlankLine();
		if (this.atLineStart) {
			if (this.pendingFirst !== null && isThematicBreak(this.pendingFirst + text)) this.breakMarkerLine();
			this.push(this.pendingFirst ?? this.linePrefix);
			this.pendingFirst = null;
			this.atLineStart = false;
		}
		if (!text.includes("\n")) {
			this.push(text);
			return;
		}
		const lines = text.split("\n");
		const lazy = lazyLines && this.linePrefix !== "";
		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];
			if (i > 0) {
				this.push("\n");
				this.push(lazy ? continuationPrefix(line, this.linePrefix) : this.linePrefix);
			}
			this.push(line);
		}
	}
	/**
	* Append one part. An empty string (the top level's line prefix, an empty
	* line) is skipped: it would only lengthen the final join.
	*/
	push(text) {
		if (text === "") return;
		this.parts.push(text);
		this.length += text.length;
	}
	/**
	* End a block that owns no line of its own (an empty paragraph): it is one
	* blank line. After another block, the blank line that block owes is this
	* one, and the next block is owed a fresh one, so each empty block adds a
	* blank line to the separator. With nothing owed (the start of the output)
	* the line is written directly and nothing is owed after it: a leading empty
	* block is a blank line, not a separator. A marker-bearing block (an empty
	* list item's `- `, an empty quote line's `>`) writes its marker as the line.
	*/
	closeEmptyBlock() {
		if (!this.atLineStart) {
			this.closeBlock();
			return;
		}
		if (this.pendingFirst !== null) {
			this.emitDeferredBlankLine();
			const marker = this.pendingFirst;
			this.push(marker.endsWith("] ") ? marker : marker.trimEnd());
			this.push("\n");
			this.pendingFirst = null;
			return;
		}
		if (this.deferredBlankPrefix === null) {
			this.push(this.linePrefix.trimEnd());
			this.push("\n");
			return;
		}
		this.emitDeferredBlankLine();
		this.deferredBlankPrefix = this.linePrefix;
	}
	/**
	* End the current block; the next write gets a blank line before it.
	*/
	closeBlock() {
		if (this.atLineStart && this.pendingFirst !== null) {
			this.emitDeferredBlankLine();
			const marker = this.pendingFirst;
			this.push(marker.endsWith("] ") ? marker : marker.trimEnd());
			this.pendingFirst = null;
			this.atLineStart = false;
		}
		if (!this.atLineStart) {
			this.push("\n");
			this.contentLength = this.length;
		}
		this.atLineStart = true;
		this.deferredBlankPrefix = this.linePrefix;
	}
	/**
	* Give the markers pending on this line a line of their own, so what comes
	* next opens a new one. Unlike `closeBlock` this owes no blank line: the
	* items are still part of the same tight list.
	*/
	breakMarkerLine() {
		if (this.pendingFirst === null) return;
		this.emitDeferredBlankLine();
		this.push(this.pendingFirst.trimEnd());
		this.push("\n");
		this.pendingFirst = null;
		this.atLineStart = true;
	}
	/**
	* Cancel the blank line deferred by the last `closeBlock`, so the next
	* write starts directly on the following line. Used between the blocks of
	* a tight list, where markdown separates items (and an item's paragraph
	* from its nested list) with a single newline.
	*/
	suppressBlank() {
		this.deferredBlankPrefix = null;
	}
	get atContentStart() {
		return this.atLineStart && !this.pendingFirst?.endsWith("] ");
	}
	/**
	* Run `fn` with `linePrefix` extended by `continuation`.
	* If `firstLine` is given, it replaces the prefix on the NEXT line only -
	* used for list items where the marker (`- `) only appears on line 1.
	* Composes with any outer one-shot prefix: a blockquote inside a list
	* item should emit "- > " on the first line, not just "> ".
	*/
	withPrefix(continuation, firstLine, fn) {
		const savedLine = this.linePrefix;
		const savedFirst = this.pendingFirst;
		this.linePrefix = savedLine + continuation;
		if (firstLine !== null) {
			const base = savedFirst ?? savedLine;
			if (savedFirst !== null && isThematicBreak(base + firstLine)) {
				this.breakMarkerLine();
				this.pendingFirst = savedLine + firstLine;
			} else this.pendingFirst = base + firstLine;
		}
		fn();
		this.linePrefix = savedLine;
		this.pendingFirst = firstLine !== null ? null : savedFirst;
	}
	finish() {
		const output = this.parts.join("");
		let cut = this.contentLength;
		for (let i = cut - 1; i >= 0; i--) {
			const code = output.charCodeAt(i);
			if (code === 10) cut = i;
			else if (code !== 32 && code !== 9) break;
		}
		return (cut === 0 ? "" : output.slice(0, cut) + "\n") + output.slice(this.contentLength) || "\n";
	}
	emitDeferredBlankLine() {
		const prefix = this.deferredBlankPrefix;
		if (prefix === null) return;
		this.push(prefix.trimEnd());
		this.push("\n");
		this.deferredBlankPrefix = null;
	}
};
function emit(node, out) {
	switch (node.type) {
		case "document":
			emitBlockChildren(node.children, out);
			return;
		case "paragraph":
			if (!hasInlineContent(node)) {
				out.closeEmptyBlock();
				return;
			}
			emitInlineChildren(node, out);
			out.closeBlock();
			return;
		case "heading":
			emitHeading(node, out);
			return;
		case "blockquote":
			out.withPrefix("> ", "> ", () => emitBlockChildren(node.children, out));
			out.closeBlock();
			return;
		case "listItem":
			emitList(node, out, isTightItem(node), node.order ?? 1);
			return;
		case "codeBlock":
			emitCodeBlock(node, out);
			return;
		case "horizontalRule": {
			const { marker } = node;
			out.write(marker || "---");
			out.closeBlock();
			return;
		}
		case "htmlComment": {
			const content = node.value;
			out.write(content);
			out.closeBlock();
			return;
		}
		case "table":
			emitTable(node, out);
			return;
		case "text":
			if (node.value) out.write(node.value);
			return;
	}
}
/**
* Emit block-level children. Consecutive `list` children form one markdown
* list ("run") whose tightness is decided once for the whole run, matching
* CommonMark's list-wide loose/tight semantics.
*
* `tightItem` is true when `node` is a list item inside a tight run: its
* blocks (a paragraph followed by nested lists) are then separated by single
* newlines instead of blank lines.
*/
function emitBlockChildren(children, out, tightItem = false) {
	const count = children.length;
	let index = 0;
	while (index < count) {
		const child = children[index];
		if (child.type !== "listItem") {
			if (tightItem && index > 0) out.suppressBlank();
			emit(child, out);
			index++;
			continue;
		}
		let runEnd = index + 1;
		while (runEnd < count && children[runEnd].type === "listItem") runEnd++;
		const tightRun = isTightRun(children, index, runEnd);
		let order = 1;
		for (let item = index; item < runEnd; item++) {
			const child = children[item];
			if (child.type !== "listItem") continue;
			const isRunStart = item === index;
			const tight = isRunStart ? tightItem && index > 0 : tightRun;
			const carriesOn = !isRunStart && listMarkerChar(children[item - 1]) === listMarkerChar(child);
			if (tight && (carriesOn || canInterruptParagraph(child))) out.suppressBlank();
			order = carriesOn ? Math.min(order + 1, MAX_LIST_ORDER) : child.order ?? 1;
			emitList(child, out, tightRun, order);
		}
		index = runEnd;
	}
}
/**
* Whether `list`'s marker line still opens an item when the line above it is a
* paragraph. CommonMark lets a list interrupt a paragraph only when the item
* carries content and, if ordered, is numbered 1; anything else reads as more of
* the paragraph, so the blank line before it is what keeps it a list at all.
*/
function canInterruptParagraph(list) {
	const attrs = list;
	if (attrs.kind === "ordered" && (attrs.order ?? 1) !== 1) return false;
	return attrs.kind === "task" || list.children.length > 0 && hasBlockContent(list.children[0]);
}
/**
* The character a list item's marker ends with: the bullet itself, or the
* delimiter after an ordered item's number. A markdown list runs for as long as
* this stays the same, and a different one opens a new list.
*/
function listMarkerChar(node) {
	if (node.type !== "listItem") return "";
	const { kind, marker, collapsed } = node;
	if (kind === "ordered") return marker === ")" ? ")" : ".";
	if (kind === "task") return marker === "+" ? "+" : marker === "*" ? "*" : "-";
	return collapsed ? "+" : marker === "*" ? "*" : "-";
}
/**
* A run of sibling `list` nodes serializes tight iff every item is "simple":
* at most one leading paragraph, then only nested lists. Any other shape
* (multiple paragraphs, a blockquote, a code block, …) needs blank-line
* separation inside the item, which per CommonMark makes the whole list
* loose.
*/
function isTightRun(children, from, to) {
	for (let i = from; i < to; i++) {
		const item = children[i];
		if (item.type !== "listItem" || !isTightItem(item)) return false;
	}
	return true;
}
function isTightItem(item) {
	const count = item.children.length;
	for (let i = 0; i < count; i++) {
		const typeName = item.children[i].type;
		if (typeName === "listItem") continue;
		if (typeName === "paragraph" && i === 0) continue;
		return false;
	}
	return true;
}
/**
* The prefix a leaf's continuation line goes out with. The container's full
* `prefix` is the default. A line the full prefix would change the meaning of -
* a setext underline, a tab whose columns the prefix shrinks below the four
* that kept it inert, a block opener the source kept inert with indentation the
* parser dedented away - needs a lazy spelling instead: without its `>` marker
* the line can only continue the paragraph, because no block may start on a
* lazy line.
*
* The lazy spelling carries `lazyIndent(prefix)`, the columns the parser
* dedents an unmarked line by, so the text comes back exactly. It goes out bare
* only when the dedent would leave it alone anyway and its own whitespace
* measures four columns flush left (or it is a setext underline, which nothing
* at the top level turns back into an underline).
*/
function continuationPrefix(line, prefix) {
	if (measureIndent(line, prefix.length) >= 4) return prefix;
	const shrunk = measureIndent(line, 0) >= 4;
	const underline = isSetextUnderline(line);
	const opens = !shrunk && lineOpensBlock(line);
	if (!shrunk && !underline && !opens) return prefix;
	const lazy = lazyIndent(prefix);
	return !opens && dedentKeepsLine(line, lazy.length) ? "" : lazy;
}
/**
* The lazy spelling's indent: the whitespace the containers write after the
* last `>` marker, which is also the columns the parser dedents an unmarked
* continuation line by (`sliceColumn` in `md-to-pm.ts`). The single space
* directly after the `>` belongs to the marker, not to the indent. A prefix
* with no `>` to drop has flush left as its only lazy spelling: its columns
* are the list's own indent, and writing them would just re-match the item.
*/
function lazyIndent(prefix) {
	let start = prefix.length;
	while (start > 0 && prefix.charCodeAt(start - 1) === 32) start--;
	if (start === 0 || prefix.charCodeAt(start - 1) !== 62) return "";
	return prefix.slice(start + 1);
}
/**
* Whether the parser's dedent (`sliceColumn` at `column`) returns `line`
* unchanged: its leading whitespace stops short of the column, or a tab in it
* reaches past. Such a line round-trips byte-exact when written bare.
*/
function dedentKeepsLine(line, column) {
	let col = 0;
	for (let index = 0; col < column; index++) {
		const code = line.charCodeAt(index);
		if (code === 32) col += 1;
		else if (code === 9) {
			const width = 4 - col % 4;
			if (col + width > column) return true;
			col += width;
		} else return true;
	}
	return false;
}
/**
* The line patterns that open an HTML block, the openers of `HTMLBlockStyle`
* in `@lezer/markdown`: script/pre/style, a comment, a processing instruction,
* a declaration, CDATA, a known block-level tag, and a complete tag alone on
* its line. Leading whitespace is stripped before matching.
*/
const HTML_BLOCK_OPEN = [
	/^<(?:script|pre|style)(?:\s|>|$)/i,
	/^<!--/,
	/^<\?/,
	/^<![A-Z]/,
	/^<!\[CDATA\[/,
	/^<\/?(?:address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|frame|frameset|h1|h2|h3|h4|h5|h6|head|header|hr|html|iframe|legend|li|link|main|menu|menuitem|nav|noframes|ol|optgroup|option|p|param|section|source|summary|table|tbody|td|tfoot|th|thead|title|tr|track|ul)(?:\s|\/?>|$)/i,
	/^(?:<\/[a-z][\w-]*\s*>|<[a-z][\w-]*(\s+[a-z:_][\w.-]*(?:\s*=\s*(?:[^\s"'=<>`]+|'[^']*'|"[^"]*"))?)*\s*>)\s*$/i
];
/**
* Whether `text`'s first line opens an HTML block. The last pattern (a
* complete tag) cannot interrupt a paragraph, but a lazy spelling of such a
* line round-trips all the same, so one check serves both callers.
*/
function opensHTMLBlock(text) {
	if (text.charCodeAt(0) !== 60) return false;
	const lineEnd = text.indexOf("\n");
	const line = lineEnd < 0 ? text : text.slice(0, lineEnd);
	for (const pattern of HTML_BLOCK_OPEN) if (pattern.test(line)) return true;
	return false;
}
/**
* Whether `line`, at the start of a container's content, opens a block instead
* of continuing the paragraph above it: a blockquote, an ATX heading, a fence,
* `$$` math, an HTML block, a thematic break, a bullet item (even an empty
* one), and an ordered item that carries content and is numbered 1.
*/
function lineOpensBlock(line) {
	let index = 0;
	while (isSpaceOrTab(line.charCodeAt(index))) index++;
	const first = line.charCodeAt(index);
	switch (first) {
		case 62: return true;
		case 60: return opensHTMLBlock(index === 0 ? line : line.slice(index));
		case 35: {
			let end = index + 1;
			while (line.charCodeAt(end) === 35) end++;
			return end - index <= 6 && (end === line.length || isSpaceOrTab(line.charCodeAt(end)));
		}
		case 96:
		case 126: {
			let end = index + 1;
			while (line.charCodeAt(end) === first) end++;
			return end - index >= 3;
		}
		case 36: return line.charCodeAt(index + 1) === 36;
		case 95: return isUnderscoreBreak(line, index);
		case 42:
		case 45:
		case 43: return isThematicBreak(line) || index + 1 >= line.length || isSpaceOrTab(line.charCodeAt(index + 1));
		case 49: {
			const delimiter = line.charCodeAt(index + 1);
			return (delimiter === 46 || delimiter === 41) && startsNonEmptyItem(line, index + 1);
		}
		default: return false;
	}
}
/**
* A `___` thematic break: three or more underscores with nothing but spaces
* and tabs between them. (`isThematicBreak` covers `-` and `*`, the two break
* characters that double as list bullets.)
*/
function isUnderscoreBreak(line, index) {
	let count = 0;
	for (; index < line.length; index++) {
		const code = line.charCodeAt(index);
		if (code === 95) count++;
		else if (!isSpaceOrTab(code)) return false;
	}
	return count >= 3;
}
/**
* Whether the list delimiter at `index` is followed by the gap and content
* (`1. x`) that let an ordered item interrupt a paragraph.
*/
function startsNonEmptyItem(line, index) {
	if (!isSpaceOrTab(line.charCodeAt(index + 1))) return false;
	for (let i = index + 2; i < line.length; i++) if (!isSpaceOrTab(line.charCodeAt(i))) return true;
	return false;
}
/**
* The columns of leading whitespace `line` stands for when it starts at column
* `start`, where a tab reaches the next multiple of four.
*/
function measureIndent(line, start) {
	let col = start;
	for (let i = 0; i < line.length; i++) {
		const code = line.charCodeAt(i);
		if (code === 32) col += 1;
		else if (code === 9) col += 4 - col % 4;
		else break;
	}
	return col - start;
}
/**
* Whether `line` is a run of one character, `=` or `-`, and so would read as a
* setext underline under a container's line prefix. Surrounding whitespace does
* not save it: an underline may carry any indentation the prefix leaves under
* four columns, and any trailing spaces at all.
*/
function isSetextUnderline(line) {
	let start = 0;
	while (start < line.length && isSpaceChar(line.charCodeAt(start))) start++;
	const first = line.charCodeAt(start);
	if (first !== 61 && first !== 45) return false;
	let end = line.length;
	while (isSpaceChar(line.charCodeAt(end - 1))) end--;
	for (let i = start + 1; i < end; i++) if (line.charCodeAt(i) !== first) return false;
	return true;
}
/**
* Write raw inline text, preserving optional editor text boundaries.
*/
function emitInlineChildren(node, out) {
	const chunks = node.segments?.value === node.value ? node.segments.chunks : void 0;
	const first = chunks ? chunks[0] : node.value;
	const lazy = first == null || !out.atContentStart || !opensHTMLBlock(first);
	if (chunks) {
		for (const chunk of chunks) if (chunk) out.write(chunk, lazy);
	} else if (node.value) out.write(node.value, lazy);
}
function hasInlineContent(node) {
	return node.segments?.value === node.value ? node.segments.chunks.length > 0 : node.value !== "";
}
function hasBlockContent(node) {
	if (node.children) return node.children.length > 0;
	if (node.type === "ignored") return node.hasContent;
	if (node.type === "paragraph" || node.type === "heading") return hasInlineContent(node);
	return node.type === "codeBlock" && node.value !== "";
}
const MAX_LIST_ORDER = 999999999;
function emitList(node, out, tight, order) {
	const { kind, taskMarker, markerGap, checked } = node;
	const markerChar = listMarkerChar(node);
	const checkMark = taskMarker === "X" ? "X" : "x";
	const gap = Math.min(Math.max(markerGap ?? 1, 1), 4);
	const prefix = `${kind === "ordered" ? `${order}${markerChar}` : markerChar}${" ".repeat(gap)}`;
	const outputMarker = kind === "task" ? `${prefix}[${checked ? checkMark : " "}] ` : prefix;
	const continuation = " ".repeat(prefix.length);
	out.withPrefix(continuation, outputMarker, () => emitBlockChildren(node.children, out, tight));
	out.closeBlock();
}
/**
* Whether a line of list markers reads as a thematic break: three or more `-`
* or `*`, all the same character, with nothing but spaces, tabs and blockquote
* markers around them.
*/
function isThematicBreak(line) {
	let breakChar = 0;
	let count = 0;
	for (let i = 0; i < line.length; i++) {
		const code = line.charCodeAt(i);
		if (code === 10) break;
		if (code === 32 || code === 9) continue;
		if (code === 62 && count === 0) continue;
		if (code !== 45 && code !== 42) return false;
		if (breakChar === 0) breakChar = code;
		else if (code !== breakChar) return false;
		count++;
	}
	return count >= 3;
}
function emitCodeBlock(node, out) {
	const attrs = node;
	const language = attrs.language || "";
	const code = node.value;
	if (attrs.fenceStyle === "indented" && !language) {
		const indentedCode = toIndentedCode(code);
		if (indentedCode != null) {
			out.write(indentedCode);
			out.closeBlock();
			return;
		}
	}
	if (attrs.fenceStyle === "dollar" && language === "math" && !hasDollarFenceLine(code)) {
		out.write("$$");
		out.write("\n");
		if (code) {
			out.write(code);
			out.write("\n");
		}
		out.write("$$");
		out.closeBlock();
		return;
	}
	const tilde = attrs.fenceStyle === "tilde";
	const fence = (tilde ? "~" : "`").repeat(Math.max(attrs.fenceLength ?? 0, minFenceLength(code, tilde)));
	out.write(fence);
	if (language) out.write(language.startsWith(tilde ? "~" : "`") ? " " + language : language);
	out.write("\n");
	if (code) {
		out.write(code);
		out.write("\n");
	}
	out.write(fence);
	out.closeBlock();
}
/**
* Indent `code` for an indented code block, or return `undefined` for shapes
* the indented form cannot express, which fall back to a fence. Blank interior
* lines stay empty so a round-trip adds no trailing whitespace; `MdOut.write`
* still prepends the enclosing `linePrefix` (blockquote or list continuation)
* per line.
*/
function toIndentedCode(code) {
	if (!canIndentCode(code)) return void 0;
	const lines = code.split("\n");
	for (let i = 0; i < lines.length; i++) if (lines[i] !== "") lines[i] = `    ${lines[i]}`;
	return lines.join("\n");
}
/**
* Whether any content line would read as a closing `$$` fence.
*/
function hasDollarFenceLine(code) {
	return code.split("\n").some((line) => line.trim() === "$$");
}
function emitTable(node, out) {
	const rowCount = node.children.length;
	if (rowCount === 0) return;
	const rows = [];
	let colCount = 0;
	let headerIdx = -1;
	for (let r = 0; r < rowCount; r++) {
		const row = node.children[r];
		const cells = [];
		let isHeaderRow = false;
		for (let c = 0; c < row.children.length; c++) {
			const cell = row.children[c];
			if (cell.header) isHeaderRow = true;
			cells.push(extractCellText(cell));
		}
		if (isHeaderRow && headerIdx < 0) headerIdx = r;
		if (cells.length > colCount) colCount = cells.length;
		rows.push(cells);
	}
	if (colCount === 0) return;
	const alignmentRow = node.children[headerIdx >= 0 ? headerIdx : 0];
	const delimiters = [];
	for (let c = 0; c < colCount; c++) {
		const cell = c < alignmentRow.children.length ? alignmentRow.children[c] : void 0;
		const align = cell ? cell.align : void 0;
		delimiters.push(formatDelimiter(align));
	}
	const separator = "| " + delimiters.join(" | ") + " |";
	const headRow = headerIdx >= 0 ? rows[headerIdx] : new Array(colCount).fill("");
	out.write(formatTableRow(headRow, colCount));
	out.write("\n");
	out.write(separator);
	for (let r = 0; r < rowCount; r++) {
		if (r === headerIdx) continue;
		out.write("\n");
		out.write(formatTableRow(rows[r], colCount));
	}
	out.closeBlock();
}
function formatDelimiter(align) {
	switch (align) {
		case "left": return ":--";
		case "center": return ":-:";
		case "right": return "--:";
		default: return "---";
	}
}
function formatTableRow(cells, colCount) {
	let s = "|";
	for (let c = 0; c < colCount; c++) s += " " + (cells[c] ?? "") + " |";
	return s;
}
/**
* Trim cell text and escape pipes / collapse newlines into spaces.
*
* Why trim: the forward parser (`parseMarkdownAst`) calls `.trim()`
* on cell text, matching GFM's documented behavior. We must do the same
* here for round-trip stability.
*
* Fast path: if the trimmed text contains no `|` or `\n`, return it as-is
* with no further allocation.
*/
function extractCellText(cell) {
	const raw = collectText(cell).trim();
	if (!raw.includes("|") && !raw.includes("\n")) return raw;
	return raw.replaceAll("|", String.raw`\|`).replaceAll("\n", " ");
}
/**
* Descendant text; comments and other leaf blocks have no text content.
*/
function collectText(node) {
	if (node.children) return node.children.map(collectText).join("");
	if (node.type === "htmlComment" || node.type === "horizontalRule") return "";
	if ((node.type === "paragraph" || node.type === "heading") && node.segments?.value === node.value) return node.segments.textContent ?? node.value;
	return node.value;
}
function isSpaceOrTab(char) {
	return char === 32 || char === 9;
}

//#endregion
//#region src/ast/check-roundtrip.ts
function trimTrailingNewlines(text) {
	let end = text.length;
	while (end > 0 && text.charCodeAt(end - 1) === 10) end--;
	return text.slice(0, end);
}
/**
* Classify how `markdown` survives the parse-then-serialize round trip. The
* editor reads and writes through the same two functions, so this is also how
* faithfully it would save the text back.
*/
function checkRoundTrip(markdown, options = {}) {
	const { frontmatter } = options;
	const ast = parseMarkdownAst(markdown, { frontmatter });
	let serialized = serializeMarkdownAst(ast, { frontmatter });
	if (markdown === serialized) return "exact";
	markdown = trimTrailingNewlines(markdown);
	serialized = trimTrailingNewlines(serialized);
	if (markdown === serialized) return "exact";
	markdown = removeListNumbers(markdown);
	serialized = removeListNumbers(serialized);
	if (markdown === serialized) return "normalizing";
	markdown = removeMarkdownStructure(markdown);
	serialized = removeMarkdownStructure(serialized);
	if (markdown === serialized) return "normalizing";
	markdown = removeNumberZeroPrefix(markdown);
	serialized = removeNumberZeroPrefix(serialized);
	if (markdown === serialized) return "normalizing";
	markdown = removeMathCodeBlockLanguage(markdown);
	serialized = removeMathCodeBlockLanguage(serialized);
	if (markdown === serialized) return "normalizing";
	return "lossy";
}
function removeListNumbers(markdown) {
	return markdown.replaceAll(/\d{1,9}(?=[.)])/gu, "");
}
function removeMarkdownStructure(markdown) {
	return markdown.replaceAll(/[-+=_:|\\/[\]<>()`~$*#\s!]+/gu, "");
}
function removeNumberZeroPrefix(markdown) {
	return markdown.replaceAll(/0+/gu, "");
}
function removeMathCodeBlockLanguage(markdown) {
	return markdown.replaceAll(/math|latex/giu, "");
}

//#endregion
//#region src/ast/equal.ts
/**
* Whether two trees hold the same nodes with the same fields, level by level.
* An absent optional field equals one set to `undefined`. Positions are not
* compared.
*/
function isMarkdownAstEqual(a, b) {
	const queue = [[a, b]];
	for (let i = 0; i < queue.length; i++) {
		const [left, right] = queue[i];
		if (!isNodeEqual(left, right)) return false;
		const leftChildren = left.children;
		const rightChildren = right.children;
		if (leftChildren?.length !== rightChildren?.length) return false;
		if (!leftChildren || !rightChildren) continue;
		for (let index = 0; index < leftChildren.length; index++) queue.push([leftChildren[index], rightChildren[index]]);
	}
	return true;
}
function isInlineEqual(a, b) {
	if (a.value !== b.value) return false;
	const left = a.segments;
	const right = b.segments;
	if (!left || !right) return left === right;
	return left.value === right.value && left.textContent === right.textContent && left.chunks.length === right.chunks.length && left.chunks.every((chunk, i) => chunk === right.chunks[i]);
}
function isHeadingEqual(a, b) {
	return a.level === b.level && a.setextUnderline === b.setextUnderline && a.closingHashes === b.closingHashes && isInlineEqual(a, b);
}
function isListItemEqual(a, b) {
	return a.kind === b.kind && a.order === b.order && a.checked === b.checked && a.collapsed === b.collapsed && a.marker === b.marker && a.taskMarker === b.taskMarker && a.markerGap === b.markerGap;
}
function isCodeBlockEqual(a, b) {
	return a.value === b.value && a.language === b.language && a.fenceStyle === b.fenceStyle && a.fenceLength === b.fenceLength;
}
/**
* Compare the fields of two nodes, without their children and positions.
*/
function isNodeEqual(a, b) {
	switch (a.type) {
		case "document": return b.type === a.type && a.frontmatter === b.frontmatter;
		case "paragraph": return b.type === a.type && isInlineEqual(a, b);
		case "heading": return b.type === a.type && isHeadingEqual(a, b);
		case "listItem": return b.type === a.type && isListItemEqual(a, b);
		case "codeBlock": return b.type === a.type && isCodeBlockEqual(a, b);
		case "horizontalRule": return b.type === a.type && a.marker === b.marker;
		case "tableCell": return b.type === a.type && a.header === b.header && a.align === b.align;
		case "ignored": return b.type === a.type && a.value === b.value && a.hasContent === b.hasContent;
		case "htmlComment":
		case "text": return b.type === a.type && a.value === b.value;
		case "blockquote":
		case "table":
		case "tableRow": return b.type === a.type;
	}
}

//#endregion
export { LEZER_NODE_IDS, checkRoundTrip, collectImages, collectInlineElements, getAutolinkHref, gfmBlockOnlyParser, gfmParser, isMarkdownAstEqual, isSpaceChar, matchEmbed, parseInline, parseMarkdownAst, parseXPostId, resolveMarkdownAstPath, serializeMarkdownAst, walkMarkdownAst };