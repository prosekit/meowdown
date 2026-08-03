import { Priority, Priority as Priority$1, createMarkBuilders, createNodeBuilders, defineBaseCommands, defineBaseKeymap, defineClipboardSerializer, defineCommands, defineHistory, defineKeymap, defineMarkSpec, defineMarkView, defineNodeAttr, defineNodeSpec, definePlugin, getMarkRange, getMarkType, getNodeType, isAllSelection, isApple, isAtBlockStart, isNodeSelection, isTextSelection, setBlockType, toggleNode, union, unsetBlockType, withPriority, withPriority as withPriority$1, withSkipCodeBlock } from "@prosekit/core";
import { defineCodeBlock, defineCodeBlockHighlight, defineCodeBlockPreviewPlugin, isCodeBlockPreviewHiddenDecoration } from "@prosekit/extensions/code-block";
import { definePlaceholder } from "@prosekit/extensions/placeholder";
import { defineReadonly } from "@prosekit/extensions/readonly";
import { defineSearchCommands, defineSearchQuery, defineSearchStatusHandler, getSearchStatus, getSearchStatus as getSearchStatus$1 } from "@prosekit/extensions/search";
import { LEZER_NODE_IDS, collectInlineElements, getAutolinkHref, gfmBlockOnlyParser, gfmParser, isSpaceChar, parseInline } from "@meowdown/markdown";
import { isElementLike, isHTMLElement, isObject, once } from "@ocavue/utils";
import { defineBlockquote } from "@prosekit/extensions/blockquote";
import { defineDoc } from "@prosekit/extensions/doc";
import { defineGapCursor } from "@prosekit/extensions/gap-cursor";
import { defineModClickPrevention } from "@prosekit/extensions/mod-click-prevention";
import { defineText } from "@prosekit/extensions/text";
import { defineVirtualSelection } from "@prosekit/extensions/virtual-selection";
import { NodeSelection, Plugin, PluginKey, Selection, TextSelection } from "@prosekit/pm/state";
import { Decoration, DecorationSet } from "@prosekit/pm/view";
import { NO_BREAK_SPACE } from "unicode-by-name";
import { defaultHandlers } from "hast-util-to-mdast";
import { defaultHandlers as defaultHandlers$1 } from "mdast-util-to-markdown";
import rehypeParse from "rehype-parse";
import rehypeRemark from "rehype-remark";
import remarkGfm from "remark-gfm";
import remarkStringify from "remark-stringify";
import { unified } from "unified";
import { DOMParser, DOMSerializer, Fragment, Mark, Slice } from "@prosekit/pm/model";
import { defineHeadingCommands, defineHeadingInputRule, defineHeadingSpec } from "@prosekit/extensions/heading";
import { defineParagraphCommands, defineParagraphKeymap } from "@prosekit/extensions/paragraph";
import { LanguageDescription } from "@codemirror/language";
import { languages } from "@codemirror/language-data";
import { classHighlighter, highlightTree } from "@lezer/highlight";
import { createParser } from "prosemirror-highlight/lezer";
import { defineEnterRule, defineTextBlockEnterRule } from "@prosekit/extensions/enter-rule";
import { defineInputRule, defineTextBlockInputRule } from "@prosekit/extensions/input-rule";
import { triggerAutocomplete } from "@prosekit/extensions/autocomplete";
import { defineListCommands, defineListDropIndicator, defineListKeymap, defineListSpec, moveList, toggleList, unwrapList, wrapInList } from "@prosekit/extensions/list";
import { chainCommands, lift } from "@prosekit/pm/commands";
import { defineHorizontalRule } from "@prosekit/extensions/horizontal-rule";
import { AddMarkStep, AddNodeMarkStep, AttrStep, RemoveMarkStep, RemoveNodeMarkStep, ReplaceStep, Step, StepResult, Transform } from "@prosekit/pm/transform";
import { decodeString } from "micromark-util-decode-string";
import { normalizeIdentifier } from "micromark-util-normalize-identifier";
import { createListRenderingPlugin, createSafariInputMethodWorkaroundPlugin, createToggleCollapsedCommand, defaultAttributesGetter, findCheckboxInListItem, handleListMarkerMouseDown, joinListElements, listToDOM, unwrapListSlice, wrappingListInputRule } from "prosemirror-flat-list";
import { defineTableCellSpec, defineTableCommands, defineTableDropIndicator, defineTableEditingPlugin, defineTableHeaderCellSpec, defineTableRowSpec, defineTableSpec, deleteTable, isCellSelection } from "@prosekit/extensions/table";
import { closeHistory } from "@prosekit/pm/history";
import { registerResizableHandleElement, registerResizableRootElement } from "@prosekit/web/resizable";
import { InputRule } from "@prosekit/pm/inputrules";

//#region src/extensions/get-mark-range-at.ts
/**
* The `markName` run covering `pos`, or `undefined` when `pos` is not inside a
* non-code textblock. Centralizes the guard the click finders share: marks only
* carry inline syntax in regular textblocks, never in code blocks. `attrs`
* narrows the match to marks whose attrs contain it, which is how callers pick
* one `mdPack` level out of a nested unit's stack.
*/
function getMarkRangeAt(state, pos, markName, attrs) {
	const size = state.doc.content.size;
	if (pos < 0 || pos > size) return;
	const $pos = state.doc.resolve(pos);
	if (!$pos.parent.isTextblock || $pos.parent.type.spec.code) return;
	return getMarkRange($pos, markName, attrs);
}

//#endregion
//#region src/extensions/mark-mode.ts
const markModeKey = new PluginKey("mark-mode");
function getCurrentMarkMode(state) {
	return markModeKey.getState(state);
}
function createMarkModePlugin(initialMode) {
	return new Plugin({
		key: markModeKey,
		state: {
			init: () => initialMode,
			apply: (tr, value) => tr.getMeta(markModeKey) ?? value
		},
		props: {
			attributes: (state) => {
				return { "data-mark-mode": getCurrentMarkMode(state) ?? initialMode };
			},
			decorations: (state) => {
				const mode = getCurrentMarkMode(state);
				if (mode === "focus") return computeFocusDecorations(state);
				if (mode === "hide") return computeMathRevealDecorations(state);
			}
		}
	});
}
function setMarkMode(mode) {
	return (state, dispatch) => {
		if (getMarkMode(state) === mode) return false;
		dispatch?.(state.tr.setMeta(markModeKey, mode));
		return true;
	};
}
function defineMarkMode(mode) {
	return union(definePlugin(createMarkModePlugin(mode)), defineCommands({ setMarkMode }));
}
/**
* The active mark mode. `defineEditorExtension` always applies
* `defineMarkMode`, so this is `undefined` only for a state built without it.
*/
function getMarkMode(state) {
	return markModeKey.getState(state);
}
/**
* In focus mode, reveal the markdown syntax of the inline unit under the caret.
*
* Every revealable unit (emphasis, strong, code, strikethrough, link, autolink,
* image) carries one `mdPack` mark spanning it, so a single boundary-inclusive
* `getMarkRange` finds the unit, returning the outermost when units nest. One
* decoration over its range flips the hidden punctuation/url/source visible via
* the `.show` CSS rule. Because the range covers the whole unit, a caret at
* either edge (e.g. right after a link's `)`) still reveals it. Wikilink and
* `#tag` carry no `mdPack`, so they never reveal.
*/
function computeFocusDecorations(state) {
	return computeRevealDecorations(state, void 0);
}
/**
* In hide mode, reveal only the math unit under the caret. A math unit hides
* its whole source (content included), so it is the one construct that must
* still reveal in hide mode to stay editable; everything else follows the
* hide-mode contract and never reveals.
*/
function computeMathRevealDecorations(state) {
	return computeRevealDecorations(state, { key: "math" });
}
function computeRevealDecorations(state, packAttrs) {
	const { selection } = state;
	if (!selection.empty) return DecorationSet.empty;
	const $pos = selection.$head;
	const { parent } = $pos;
	if (!parent.isTextblock || parent.type.spec.code) return DecorationSet.empty;
	const range = getMarkRange($pos, getMarkType(state.schema, "mdPack"), packAttrs);
	if (!range) return DecorationSet.empty;
	return DecorationSet.create(state.doc, [Decoration.inline(range.from, range.to, { class: "show" })]);
}

//#endregion
//#region src/extensions/atom-mark-navigation.ts
/**
* The source marks whose mark views hide the raw text behind a rendered
* preview (`.md-atom-view-preview`) and act as one caret stop.
*/
const ATOM_SOURCE_MARK_NAMES = [
	"mdImage",
	"mdWikilink",
	"mdFile"
];
function activeMarkNames(marks, state) {
	const mode = getMarkMode(state);
	if (!mode) return [];
	return marks.flatMap((mark) => mark.modes.includes(mode) ? [mark.name] : []);
}
function getRangeBefore(state, pos, markNames) {
	for (const name of markNames) {
		const range = getMarkRangeAt(state, pos - 1, name);
		if (range && range.to === pos) return range;
	}
}
function getRangeAfter(state, pos, markNames) {
	for (const name of markNames) {
		const range = getMarkRangeAt(state, pos, name);
		if (range && range.from === pos) return range;
	}
}
function getSelectedRange(state, markNames) {
	const { from, to, empty } = state.selection;
	if (empty) return;
	for (const name of markNames) {
		const range = getMarkRangeAt(state, from, name);
		if (range && range.from === from && range.to === to) return range;
	}
}
/**
* The atom source unit the selection exactly spans, or undefined. Inert (like
* the rest of atom navigation) in a state built without a mark mode.
*/
function getSelectedAtomRange(state) {
	if (!getMarkMode(state)) return;
	return getSelectedRange(state, [...ATOM_SOURCE_MARK_NAMES]);
}
function selectRange(state, range) {
	return TextSelection.create(state.doc, range.from, range.to);
}
function findSelectionAcrossBlockBoundary(state, pos, markNames, direction) {
	const $pos = state.doc.resolve(pos);
	if (!(direction === -1 ? $pos.parentOffset === 0 : $pos.parentOffset === $pos.parent.content.size) || $pos.depth === 0) return;
	const nearUnit = direction === -1 ? getRangeAfter(state, pos, markNames) : getRangeBefore(state, pos, markNames);
	const boundary = direction === -1 ? $pos.before() : $pos.after();
	const target = Selection.findFrom(state.doc.resolve(boundary), direction);
	if (!target) return;
	const farUnit = isTextSelection(target) ? direction === -1 ? getRangeBefore(state, target.head, markNames) : getRangeAfter(state, target.head, markNames) : void 0;
	if (nearUnit == null && farUnit == null) return;
	return target;
}
function createArrowRight(marks) {
	return (state, dispatch) => {
		const markNames = activeMarkNames(marks, state);
		if (markNames.length === 0 || !isTextSelection(state.selection)) return false;
		const selection = state.selection;
		if (selection.empty) {
			const after = getRangeAfter(state, selection.from, markNames);
			if (after) {
				dispatch?.(state.tr.setSelection(selectRange(state, after)));
				return true;
			}
			if (getRangeBefore(state, selection.from, markNames) && selection.from < state.doc.resolve(selection.from).end()) {
				dispatch?.(state.tr.setSelection(TextSelection.create(state.doc, selection.from + 1)));
				return true;
			}
			const target = findSelectionAcrossBlockBoundary(state, selection.from, markNames, 1);
			if (!target) return false;
			dispatch?.(state.tr.setSelection(target).scrollIntoView());
			return true;
		}
		const range = getSelectedRange(state, markNames);
		if (!range) return false;
		dispatch?.(state.tr.setSelection(TextSelection.create(state.doc, range.to)));
		return true;
	};
}
function createArrowLeft(marks) {
	return (state, dispatch) => {
		const markNames = activeMarkNames(marks, state);
		if (markNames.length === 0 || !isTextSelection(state.selection)) return false;
		const selection = state.selection;
		if (selection.empty) {
			const before = getRangeBefore(state, selection.from, markNames);
			if (before) {
				dispatch?.(state.tr.setSelection(selectRange(state, before)));
				return true;
			}
			const target = findSelectionAcrossBlockBoundary(state, selection.from, markNames, -1);
			if (!target) return false;
			dispatch?.(state.tr.setSelection(target).scrollIntoView());
			return true;
		}
		const range = getSelectedRange(state, markNames);
		if (!range) return false;
		dispatch?.(state.tr.setSelection(TextSelection.create(state.doc, range.from)));
		return true;
	};
}
function createShiftArrow(marks, direction) {
	return (state, dispatch) => {
		const markNames = activeMarkNames(marks, state);
		if (markNames.length === 0 || !isTextSelection(state.selection)) return false;
		const { anchor, head } = state.selection;
		const unit = direction === -1 ? getRangeBefore(state, head, markNames) : getRangeAfter(state, head, markNames);
		if (unit) {
			const nextHead = direction === -1 ? unit.from : unit.to;
			dispatch?.(state.tr.setSelection(TextSelection.create(state.doc, anchor, nextHead)).scrollIntoView());
			return true;
		}
		const target = findSelectionAcrossBlockBoundary(state, head, markNames, direction);
		if (!target || !isTextSelection(target)) return false;
		dispatch?.(state.tr.setSelection(TextSelection.create(state.doc, anchor, target.head)).scrollIntoView());
		return true;
	};
}
function createBackspace(marks) {
	return (state, dispatch) => {
		const markNames = activeMarkNames(marks, state);
		if (markNames.length === 0 || !state.selection.empty) return false;
		const pos = state.selection.from;
		const before = getRangeBefore(state, pos, markNames);
		if (before) {
			dispatch?.(state.tr.delete(before.from, before.to));
			return true;
		}
		if (!getRangeAfter(state, pos, markNames)) return false;
		if (pos <= state.doc.resolve(pos).start()) return false;
		dispatch?.(state.tr.delete(pos - 1, pos));
		return true;
	};
}
function createForwardDelete(marks) {
	return (state, dispatch) => {
		const markNames = activeMarkNames(marks, state);
		if (markNames.length === 0 || !state.selection.empty) return false;
		const pos = state.selection.from;
		const after = getRangeAfter(state, pos, markNames);
		if (after) {
			dispatch?.(state.tr.delete(after.from, after.to));
			return true;
		}
		if (!getRangeBefore(state, pos, markNames)) return false;
		if (pos >= state.doc.resolve(pos).end()) return false;
		dispatch?.(state.tr.delete(pos, pos + 1));
		return true;
	};
}
const SELECTED_CLASS = "md-atom-selected";
function createSelectionPlugin(marks) {
	return new Plugin({
		key: new PluginKey("atom-mark-selection"),
		props: { decorations: (state) => {
			const markNames = activeMarkNames(marks, state);
			if (markNames.length === 0) return;
			if (isNodeSelection(state.selection)) return;
			const range = getSelectedRange(state, markNames);
			if (range) return DecorationSet.create(state.doc, [Decoration.inline(range.from, range.to, { class: SELECTED_CLASS })]);
			const { from, to, empty } = state.selection;
			if (empty) return null;
			const decorations = [];
			state.doc.nodesBetween(from, to, (node, pos) => {
				if (node.marks.some((mark) => markNames.includes(mark.type.name))) decorations.push(Decoration.inline(pos, pos + node.nodeSize, { class: SELECTED_CLASS }));
			});
			return DecorationSet.create(state.doc, decorations);
		} }
	});
}
/**
* Make a text-backed source unit a single caret stop in the listed mark modes:
* arrowing onto it selects the whole source, Shift-arrowing extends over it
* whole, arrows cross textblock boundaries it touches (which the browser's
* native caret cannot), and Backspace/Delete remove it as a unit.
*/
function defineAtomMarkNavigation({ marks }) {
	return union(withPriority$1(defineKeymap({
		ArrowRight: createArrowRight(marks),
		ArrowLeft: createArrowLeft(marks),
		"Shift-ArrowRight": createShiftArrow(marks, 1),
		"Shift-ArrowLeft": createShiftArrow(marks, -1),
		Backspace: createBackspace(marks),
		Delete: createForwardDelete(marks)
	}), Priority$1.high), definePlugin(createSelectionPlugin(marks)));
}

//#endregion
//#region src/converters/html-to-md.ts
/**
* Convert a `<mark>` element into a `highlight` node. There is no built-in
* `hast-util-to-mdast` handler for `<mark>`, so without this the highlight is
* dropped and only its text survives.
*/
const markToHighlight = (state, element) => {
	const result = {
		type: "highlight",
		children: state.all(element)
	};
	state.patch(element, result);
	return result;
};
/**
* Serialize a `highlight` node as `==text==`. The `==` delimiters are written
* through the construct machinery (not as plain text) so they are never
* escaped: a leading `=` written as text would otherwise become `\=` to guard
* against a setext heading underline. Mirrors `mdast-util-gfm-strikethrough`.
*/
const highlightToMarkdown = (node, _parent, state, info) => {
	const highlight = node;
	const tracker = state.createTracker(info);
	let value = tracker.move("==");
	value += tracker.move(state.containerPhrasing(highlight, {
		...tracker.current(),
		before: value,
		after: "="
	}));
	value += tracker.move("==");
	return value;
};
function isCheckboxInput(node) {
	return node.tagName === "input" && node.properties.type === "checkbox";
}
/** The first checkbox `<input>` before any nested list, if any. */
function findCheckbox(node) {
	for (const child of node.children) {
		if (child.type !== "element") continue;
		if (isCheckboxInput(child)) return child;
		if (child.tagName === "ul" || child.tagName === "ol") continue;
		const nested = findCheckbox(child);
		if (nested) return nested;
	}
}
/**
* Rebuild a ProseMirror-editor task item as the plain GFM shape. Tiptap
* (`<li data-checked="true" data-type="taskItem"><label><input …></label>
* <div><p>text</p></div></li>`) and remirror/Reflect-style (`<li data-checked>`)
* items nest the checkbox inside a `<label>` and the body inside a `<div>`,
* which the default `li` handler does not recognize: the item would serialize
* as a plain bullet whose literal `[ ]` text then gets escaped. Returns
* `undefined` for anything that is not a task item.
*/
function normalizeTaskItem(node) {
	const dataChecked = node.properties.dataChecked;
	const checkbox = findCheckbox(node);
	if (!(dataChecked != null || node.properties.dataType === "taskItem" || node.properties.dataTaskListItem != null || checkbox !== void 0)) return void 0;
	const checked = typeof dataChecked === "string" ? dataChecked !== "false" : Boolean(checkbox?.properties.checked);
	let content = node.children.filter((child) => {
		if (child.type !== "element") return true;
		if (isCheckboxInput(child)) return false;
		if (child.tagName === "label" && findCheckbox(child)) return false;
		return true;
	});
	for (const tagName of ["div", "p"]) {
		const only = content.length === 1 && content[0].type === "element" ? content[0] : void 0;
		if (only?.tagName === tagName) content = only.children;
	}
	const input = {
		type: "element",
		tagName: "input",
		properties: {
			type: "checkbox",
			checked
		},
		children: []
	};
	return {
		...node,
		children: [input, ...content]
	};
}
/** `li` handler that recognizes ProseMirror-style task items, then delegates. */
const taskAwareListItem = (state, element) => {
	return defaultHandlers.li(state, normalizeTaskItem(element) ?? element);
};
/**
* Narrow the stock escaping rules to meowdown's dialect: drop the blanket
* "escape every `[` and `~`" rules, keep the `[`/`]` rules scoped to link
* labels and the line-leading `~` fence guard (a bare `~~~` would open a
* code fence that swallows the following content on reparse).
*/
function toMeowdownUnsafe(unsafe) {
	return unsafe.filter((pattern) => {
		if (pattern.character !== "[" && pattern.character !== "~") return true;
		if (pattern.atBreak) return pattern.character === "~";
		return !(Array.isArray(pattern.inConstruct) ? pattern.inConstruct : pattern.inConstruct ? [pattern.inConstruct] : []).includes("phrasing");
	});
}
/**
* Serialize a text node with the narrowed escaping rules. The default `text`
* handler reads `state.safe` off the state it is given, so passing a clone
* with a filtered `unsafe` scopes the narrowing to text nodes without
* mutating the shared serializer state.
*/
const textToMarkdown = (node, parent, state, info) => {
	return defaultHandlers$1.text(node, parent, {
		...state,
		unsafe: toMeowdownUnsafe(state.unsafe)
	}, info);
};
function createProcessor() {
	return unified().use(rehypeParse).use(rehypeRemark, { handlers: {
		mark: markToHighlight,
		li: taskAwareListItem
	} }).use(remarkGfm).use(remarkStringify, {
		bullet: "-",
		emphasis: "*",
		strong: "*",
		fence: "`",
		fences: true,
		rule: "-",
		ruleRepetition: 3,
		listItemIndent: "one",
		handlers: {
			highlight: highlightToMarkdown,
			text: textToMarkdown
		}
	}).freeze();
}
const getProcessor = once(createProcessor);
/** Convert HTML into Markdown text. */
function htmlToMarkdown(html) {
	return String(getProcessor().processSync(html));
}

//#endregion
//#region src/utils/parse-integer.ts
function parseInteger(raw) {
	if (raw == null) return void 0;
	const value = Number.parseInt(raw, 10);
	return Number.isSafeInteger(value) ? value : void 0;
}
function parsePositiveInteger(raw) {
	const value = parseInteger(raw);
	return value != null && value > 0 ? value : void 0;
}

//#endregion
//#region src/extensions/mark-names.ts
function isMarkOfType(mark, name) {
	return mark.type.name === name;
}
const SYNTAX_MARK_NAMES = /* @__PURE__ */ new Set([
	"mdMark",
	"mdLinkUri",
	"mdLinkTitle"
]);
const ATOM_MARK_NAMES = /* @__PURE__ */ new Set([
	"mdWikilink",
	"mdImage",
	"mdFile",
	"mdMath"
]);

//#endregion
//#region src/extensions/inline-runs.ts
function findAtomMark(marks) {
	return marks.find((mark) => ATOM_MARK_NAMES.has(mark.type.name));
}
function hasSyntaxMark(marks) {
	return marks.some((mark) => SYNTAX_MARK_NAMES.has(mark.type.name));
}
/**
* Group a textblock's text nodes into atom units and plain runs. A unit's
* text nodes share one mark instance (the inline parser creates each unit
* mark once), so instance identity splits adjacent same-attrs units.
*/
function groupInlineRuns(textblock) {
	const runs = [];
	textblock.forEach((child) => {
		if (!child.isText || !child.text) return;
		const atom = findAtomMark(child.marks);
		const last = runs.at(-1);
		if (atom != null && last != null && last.atom === atom) {
			last.text += child.text;
			last.children.push(child);
			return;
		}
		runs.push({
			atom,
			text: child.text,
			children: [child]
		});
	});
	return runs;
}

//#endregion
//#region src/extensions/clipboard/semantic-inline.ts
const SEMANTIC_TAGS = {
	mdStrong: "strong",
	mdEm: "em",
	mdCode: "code",
	mdDel: "del",
	mdHighlight: "mark",
	mdLinkText: "a"
};
/**
* The semantic DOM of one textblock: `data-md` holds the full source text,
* the children are the rendered inline content without syntax characters.
*/
function semanticTextblockDOM(tagName, node, attrs = {}) {
	const element = document.createElement(tagName);
	element.setAttribute("data-md", node.textContent);
	for (const [name, value] of Object.entries(attrs)) if (value != null) element.setAttribute(name, value);
	serializeSemanticInline(node, element);
	return element;
}
/**
* The clipboard parse rule for a textblock: the content comes from the
* `data-md` source text verbatim, the semantic child elements are ignored.
* The inline mark plugin re-derives marks after the paste transaction.
*/
function createSourceTextRule(tag, node, getAttrs) {
	return {
		tag: `${tag}[data-md]`,
		node,
		priority: 100,
		getAttrs,
		getContent: (dom, schema) => {
			const source = (isHTMLElement(dom) ? dom : void 0)?.getAttribute("data-md") ?? "";
			return source ? Fragment.from(schema.text(source)) : Fragment.empty;
		}
	};
}
function serializeSemanticInline(textblock, out) {
	const open = [];
	for (const run of groupInlineRuns(textblock)) {
		if (run.atom != null) {
			open.length = 0;
			out.append(atomUnitToDOM(run.atom, run.text));
			continue;
		}
		for (const child of run.children) {
			if (hasSyntaxMark(child.marks)) continue;
			syncOpenWrappers(open, child.marks.filter((mark) => SEMANTIC_TAGS[mark.type.name]), out);
			appendTextWithBreaks(open.at(-1)?.element ?? out, child.text ?? "");
		}
	}
}
function syncOpenWrappers(open, next, out) {
	let common = 0;
	while (common < open.length && common < next.length && next[common].eq(open[common].mark)) common++;
	open.length = common;
	for (let index = common; index < next.length; index++) {
		const mark = next[index];
		const element = document.createElement(SEMANTIC_TAGS[mark.type.name] ?? "span");
		if (isMarkOfType(mark, "mdLinkText")) element.setAttribute("href", mark.attrs.href);
		(open.at(-1)?.element ?? out).append(element);
		open.push({
			mark,
			element
		});
	}
}
/** A soft break (a literal `\n` in the source) renders as `<br>`. */
function appendTextWithBreaks(parent, text) {
	const lines = text.split("\n");
	for (const [index, line] of lines.entries()) {
		if (index > 0) parent.append(document.createElement("br"));
		if (line) parent.append(document.createTextNode(line));
	}
}
function atomUnitToDOM(atom, sourceText) {
	switch (atom.type.name) {
		case "mdImage": {
			const attrs = atom.attrs;
			const image = document.createElement("img");
			image.setAttribute("src", attrs.src);
			if (attrs.alt) image.setAttribute("alt", attrs.alt);
			if (attrs.title) image.setAttribute("title", attrs.title);
			if (attrs.width != null) image.setAttribute("width", String(attrs.width));
			if (attrs.height != null) image.setAttribute("height", String(attrs.height));
			return image;
		}
		case "mdWikilink": {
			const attrs = atom.attrs;
			return document.createTextNode(attrs.display || attrs.target);
		}
		case "mdFile": {
			const attrs = atom.attrs;
			const anchor = document.createElement("a");
			anchor.setAttribute("href", attrs.href);
			anchor.append(document.createTextNode(attrs.name || attrs.href));
			return anchor;
		}
		default: return document.createTextNode(sourceText);
	}
}

//#endregion
//#region src/extensions/node-names.ts
function isNodeOfType(node, name) {
	return node.type.name === name;
}

//#endregion
//#region src/extensions/heading.ts
/**
* Merge `whitespace: 'pre'` onto the base heading spec. A multi-line setext
* heading keeps a soft line break as a literal `\n`; without `whitespace: 'pre'`
* (and `white-space: pre-wrap` in the stylesheet) a DOM re-read folds it to a
* space, dropping the break. `defineNodeSpec` merges specs of the same name, so
* this adds the single field without re-declaring the heading spec.
*/
function defineHeadingWhitespace() {
	return defineNodeSpec({
		name: "heading",
		whitespace: "pre"
	});
}
/** The clipboard DOM of a heading: semantic inline content plus `data-md`. */
function headingClipboardDOM(node) {
	const attrs = node.attrs;
	return semanticTextblockDOM(`h${attrs.level}`, node, {
		"data-setext-underline": attrs.setextUnderline != null ? String(attrs.setextUnderline) : void 0,
		"data-closing-hashes": attrs.closingHashes != null ? String(attrs.closingHashes) : void 0
	});
}
/** The clipboard parse rules restoring a heading's source text from `data-md`. */
function headingFromDOM() {
	return [
		1,
		2,
		3,
		4,
		5,
		6
	].map((level) => createSourceTextRule(`h${level}`, "heading", (dom) => ({
		level,
		setextUnderline: parsePositiveInteger(dom.getAttribute("data-setext-underline")) ?? null,
		closingHashes: parsePositiveInteger(dom.getAttribute("data-closing-hashes")) ?? null
	})));
}
function defineSetextUnderlineAttr() {
	return defineNodeAttr({
		type: "heading",
		attr: "setextUnderline",
		default: null,
		toDOM: (value) => value != null ? ["data-setext-underline", String(value)] : null,
		parseDOM: (node) => parsePositiveInteger(node.getAttribute("data-setext-underline")) ?? null
	});
}
function defineHeadingClosingHashesAttr() {
	return defineNodeAttr({
		type: "heading",
		attr: "closingHashes",
		default: null,
		toDOM: (value) => value != null ? ["data-closing-hashes", String(value)] : null,
		parseDOM: (node) => parsePositiveInteger(node.getAttribute("data-closing-hashes")) ?? null
	});
}
function toggleHeading(level) {
	return withSkipCodeBlock(toggleNode({
		type: "heading",
		attrs: { level }
	}));
}
const backspaceUnsetHeading = (state, dispatch, view) => {
	const $pos = isAtBlockStart(state, view);
	if ($pos != null && isNodeOfType($pos.parent, "heading")) return unsetBlockType()(state, dispatch, view);
	return false;
};
function defineHeadingKeymap() {
	return defineKeymap({
		"Mod-1": toggleHeading(1),
		"Mod-2": toggleHeading(2),
		"Mod-3": toggleHeading(3),
		"Mod-4": toggleHeading(4),
		"Mod-5": toggleHeading(5),
		"Mod-6": toggleHeading(6),
		Backspace: backspaceUnsetHeading
	});
}
function defineHeading() {
	return union(defineHeadingSpec(), defineHeadingWhitespace(), defineSetextUnderlineAttr(), defineHeadingClosingHashesAttr(), defineHeadingInputRule(), defineHeadingCommands(), defineHeadingKeymap());
}

//#endregion
//#region src/extensions/paragraph.ts
function defineMeowdownParagraphSpec() {
	return defineNodeSpec({
		name: "paragraph",
		content: "inline*",
		group: "block",
		whitespace: "pre",
		parseDOM: [{ tag: "p" }],
		toDOM() {
			return ["p", 0];
		}
	});
}
/** The clipboard DOM of a paragraph: semantic inline content plus `data-md`. */
function paragraphClipboardDOM(node) {
	return semanticTextblockDOM("p", node);
}
/** The clipboard parse rules restoring a paragraph's source text from `data-md`. */
function paragraphFromDOM() {
	return [createSourceTextRule("p", "paragraph")];
}
function defineMeowdownParagraph() {
	return union(withPriority$1(defineMeowdownParagraphSpec(), Priority$1.highest), defineParagraphCommands(), defineParagraphKeymap());
}

//#endregion
//#region src/extensions/clipboard/clipboard-serializer.ts
function withSemanticTextblocks(nodes) {
	return {
		...nodes,
		["paragraph"]: (node) => ({ dom: paragraphClipboardDOM(node) }),
		["heading"]: (node) => ({ dom: headingClipboardDOM(node) })
	};
}
/**
* Serialize copied textblocks as semantic HTML (`<strong>`, `<em>`, real
* `<h1>`..`<h6>`) with the source text preserved in `data-md`, and stamp every
* top-level element with `data-meowdown` so the paste side can tell meowdown's
* own clipboard HTML from foreign HTML even when no textblock is present
* (e.g. a code-block-only copy).
*/
function defineSemanticClipboardSerializer() {
	return defineClipboardSerializer({
		serializeFragmentWrapper: (serializeFragment) => {
			return (...args) => {
				const fragment = serializeFragment(...args);
				for (const child of fragment.children) child.setAttribute("data-meowdown", "");
				return fragment;
			};
		},
		nodesFromSchemaWrapper: (nodesFromSchema) => {
			return (...args) => withSemanticTextblocks(nodesFromSchema(...args));
		}
	});
}
const semanticSerializerCache = /* @__PURE__ */ new WeakMap();
/**
* The semantic serializer as a plain `DOMSerializer`, for callers outside the
* clipboard facet (`defineHTMLPaste` re-serializes converted foreign HTML with
* it, so the intermediate HTML also carries `data-md`).
*/
function getSemanticDOMSerializer(schema) {
	let serializer = semanticSerializerCache.get(schema);
	if (serializer == null) {
		serializer = new DOMSerializer(withSemanticTextblocks(DOMSerializer.nodesFromSchema(schema)), DOMSerializer.marksFromSchema(schema));
		semanticSerializerCache.set(schema, serializer);
	}
	return serializer;
}

//#endregion
//#region src/extensions/html-paste.ts
const htmlPasteKey = new PluginKey("meowdown-html-paste");
/**
* meowdown's own clipboard HTML, which must skip the markdown conversion and
* go to the native `data-md` parse path. Foreign ProseMirror editors also
* write `data-pm-slice`, so the check needs a meowdown-specific signature:
* the `data-meowdown` stamp, or (for HTML copied from an older meowdown) the
* editor DOM's `md-mark` spans next to `data-pm-slice`.
*/
function isMeowdownClipboardHTML(html) {
	if (html.includes("data-meowdown")) return true;
	return html.includes("data-pm-slice") && html.includes("md-mark");
}
/**
* Tags that carry no markdown-representable structure beyond line breaks.
* Code editors wrap copied source lines in styled `div` and `span` elements.
*/
const STYLE_ONLY_TAGS = /* @__PURE__ */ new Set([
	"html",
	"head",
	"body",
	"meta",
	"style",
	"title",
	"div",
	"span",
	"p",
	"br",
	"font",
	"wbr"
]);
/**
* When `html` contains styled line wrappers, return its text with the line
* structure restored (one line per `div`, a blank line between `p`s, `<br>`
* as a newline); return `undefined` for ordinary prose or semantic HTML.
*
* The extracted text is then pasted as markdown *source* instead of being
* round-tripped through the HTML-to-markdown converter, whose escaping would
* turn pasted markdown into `\[ ] task`-style noise.
*/
function extractStyledPlainText(html) {
	const dom = new window.DOMParser().parseFromString(html, "text/html");
	const output = {
		chunks: [],
		hasContent: false,
		trailingNewlines: 0,
		hasStyledLine: false
	};
	if (!appendNodeText(dom.documentElement, output, false)) return void 0;
	if (!output.hasStyledLine) return void 0;
	return output.chunks.join("").replaceAll(NO_BREAK_SPACE, " ");
}
/**
* Pad `output` so it ends with at least `count` newlines, unless it holds no
* content yet (leading separators would just be trimmed again).
*/
function ensureTrailingNewlines(output, count) {
	if (!output.hasContent || output.trailingNewlines >= count) return;
	appendText(output, "\n".repeat(count - output.trailingNewlines));
}
function appendText(output, text) {
	if (!text) return;
	output.chunks.push(text);
	let index = text.length;
	while (index > 0 && text.charCodeAt(index - 1) === 10) index--;
	if (index === 0) output.trailingNewlines += text.length;
	else {
		output.hasContent = true;
		output.trailingNewlines = text.length - index;
	}
}
/** Recursive worker of {@link extractStyledPlainText}. */
function appendNodeText(node, output, insideLine) {
	if (node.nodeType === Node.TEXT_NODE) {
		appendText(output, node.nodeValue ?? "");
		return true;
	}
	if (node.nodeType !== Node.ELEMENT_NODE) return true;
	const element = node;
	const tag = element.tagName;
	if (!STYLE_ONLY_TAGS.has(tag.toLowerCase())) return false;
	insideLine ||= tag === "DIV";
	if (insideLine && element.getAttribute("style")?.trim()) output.hasStyledLine = true;
	if (tag === "BR") {
		appendText(output, "\n");
		return true;
	}
	if (tag === "STYLE" || tag === "TITLE") return true;
	const separator = tag === "DIV" ? 1 : tag === "P" ? 2 : 0;
	if (separator) ensureTrailingNewlines(output, separator);
	for (const child of node.childNodes) if (!appendNodeText(child, output, insideLine)) return false;
	if (separator) ensureTrailingNewlines(output, separator);
	return true;
}
/**
* Paste foreign rich-text HTML as meowdown Markdown. Rewrites the clipboard's
* `text/html` through `transformPastedHTML`: foreign HTML is converted to a
* Markdown string, reparsed into meowdown nodes (literal source text, no marks),
* and re-serialized to HTML so ProseMirror's own clipboard parser inserts it with
* the right open depths. `<strong>bold</strong>` thus lands as the text `**bold**`,
* which the inline-mark plugin renders. The re-serialized HTML carries `data-md`,
* so the textblock contents survive the whitespace-collapsing HTML parse.
*/
function defineHTMLPaste() {
	return definePlugin(new Plugin({
		key: htmlPasteKey,
		props: { transformPastedHTML: (html, view) => {
			if (isMeowdownClipboardHTML(html)) return html;
			const parent = view.state.selection.$from.parent;
			if (!parent.inlineContent || parent.type.spec.code) return html;
			const markdown = extractStyledPlainText(html) ?? htmlToMarkdown(html);
			if (!markdown.trim()) return html;
			const nodes = getNodeBuildersForSchema(view.state.schema);
			const doc = markdownToDoc(markdown, { nodes });
			const serializer = getSemanticDOMSerializer(view.state.schema);
			const container = document.createElement("div");
			container.append(serializer.serializeFragment(doc.content));
			return container.innerHTML;
		} }
	}));
}

//#endregion
//#region src/extensions/clipboard/clipboard-parser.ts
/**
* The clipboard parser: schema rules plus the `data-md` rules that restore a
* textblock's source text from meowdown's own clipboard HTML. Registered as
* `clipboardParser` (not in the schema) so static HTML parsing is unaffected.
*/
function createClipboardParser(schema) {
	return new DOMParser(schema, [
		...paragraphFromDOM(),
		...headingFromDOM(),
		...DOMParser.fromSchema(schema).rules
	]);
}
const clipboardParserKey = new PluginKey("meowdown-clipboard-parser");
function defineClipboardParser() {
	return definePlugin(({ schema }) => {
		return new Plugin({
			key: clipboardParserKey,
			props: { clipboardParser: createClipboardParser(schema) }
		});
	});
}

//#endregion
//#region src/extensions/clipboard/plain-paste.ts
/**
* Parse pasted plain text as markdown: `- [ ] task`, `# heading`, fenced code
* and the other block constructs become real nodes, while inline syntax stays
* literal source text that the inline-mark plugin renders. Newline semantics
* follow `md-to-pm.ts`: a blank line separates paragraphs, a single `\n` stays
* a soft break inside one paragraph, and a run of K blank lines restores K-1
* empty gap paragraphs. Leading and trailing newlines are trimmed.
*/
function plainTextToSlice(schema, raw) {
	const trimmed = raw.replaceAll(/\r\n?/g, "\n").replace(/^\n+/, "").replace(/\n+$/, "");
	if (!trimmed) return Slice.empty;
	const nodes = getNodeBuildersForSchema(schema);
	const doc = markdownToDoc(trimmed, { nodes });
	const paragraph = getNodeType(schema, "paragraph");
	const openStart = doc.childCount > 0 && doc.child(0).type === paragraph ? 1 : 0;
	const openEnd = doc.childCount > 0 && doc.child(doc.childCount - 1).type === paragraph ? 1 : 0;
	return new Slice(doc.content, openStart, openEnd);
}
/**
* ProseMirror's own plain-text handling, kept for Shift-paste: every newline
* run becomes a paragraph break. Mirrors `parseFromClipboard` in
* prosemirror-view, which this prop replaces.
*/
function defaultTextSlice(schema, text, $context) {
	const marks = $context.marks();
	const serializer = DOMSerializer.fromSchema(schema);
	const container = document.createElement("div");
	for (const block of text.split(/(?:\r\n?|\n)+/)) {
		const paragraphDOM = container.appendChild(document.createElement("p"));
		if (block) paragraphDOM.appendChild(serializer.serializeNode(schema.text(block, marks)));
	}
	return DOMParser.fromSchema(schema).parseSlice(container, {
		preserveWhitespace: true,
		context: $context
	});
}
function definePlainTextPaste() {
	let parsedTextSlice;
	return definePlugin(new Plugin({
		key: new PluginKey("meowdown-plain-paste"),
		props: {
			clipboardTextParser: (text, $context, plain, view) => {
				const { schema } = view.state;
				if (plain) return defaultTextSlice(schema, text, $context);
				return parsedTextSlice = plainTextToSlice(schema, text);
			},
			transformPasted: (slice) => {
				if (parsedTextSlice == null) return slice;
				const result = parsedTextSlice;
				parsedTextSlice = void 0;
				return result;
			}
		}
	}));
}

//#endregion
//#region src/utils/backticks.ts
/** Length of the longest run of `charCode` in `text`, at least `min`. */
function longestCharRun(text, charCode, min = 0) {
	let longest = min;
	let run = 0;
	for (let i = 0; i < text.length; i++) if (text.charCodeAt(i) === charCode) {
		run++;
		if (run > longest) longest = run;
	} else run = 0;
	return longest;
}
/** Length of the longest run of backticks in `text`, at least `min`. */
function longestBacktickRun(text, min = 0) {
	return longestCharRun(text, 96, min);
}

//#endregion
//#region src/converters/pm-to-md.ts
/**
* Convert a ProseMirror document into a Markdown string.
*
* Performance design:
* - Output accumulates in a `string[]` buffer; joined once at the end.
*   Avoids per-block intermediate strings while keeping the
*   function-per-node-type readability of a switch dispatch.
* - Indent stack lives as a mutable `linePrefix` on the buffer object,
*   restored via local variables across nested calls - no fresh
*   context objects per recursion.
* - Inline content is walked directly (not via `node.textContent`) to
*   skip one intermediate string allocation per leaf block.
* - Backtick fence width and cell escaping use single linear loops, no
*   regex on the hot path.
*/
function docToMarkdown(node, options = {}) {
	const out = new MdOut();
	if (options.frontmatter) emitFrontmatter(node.attrs.frontmatter, out);
	emit$1(node, out);
	return out.finish();
}
/**
* Emit the document's YAML frontmatter (stored as a `doc` attribute) as a
* leading `---\n{body}\n---` block. `null` (the default) emits nothing; an
* empty body emits `---\n---` with no middle blank line.
*/
function emitFrontmatter(body, out) {
	if (body === null) return;
	out.write("---");
	out.write("\n");
	if (body !== "") {
		out.write(body);
		out.write("\n");
	}
	out.write("---");
	out.closeBlock();
}
/** Heading prefixes indexed by level (1..6). Index 0 is a sentinel. */
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
	const attrs = node.attrs;
	const underline = attrs.setextUnderline;
	if (underline != null && node.content.size > 0 && attrs.level <= 2) {
		emitInlineChildren(node, out);
		const underlineChar = attrs.level === 1 ? "=" : "-";
		out.write("\n" + underlineChar.repeat(Math.max(1, underline)));
		out.closeBlock();
		return;
	}
	out.write(HEADING_PREFIX[attrs.level] ?? "# ");
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
	}
	write(text) {
		if (text === "") return;
		this.emitDeferredBlankLine();
		if (this.atLineStart) {
			this.parts.push(this.pendingFirst ?? this.linePrefix);
			this.pendingFirst = null;
			this.atLineStart = false;
		}
		if (!text.includes("\n")) {
			this.parts.push(text);
			return;
		}
		const lines = text.split("\n");
		for (let i = 0; i < lines.length; i++) {
			if (i > 0) this.parts.push("\n", this.linePrefix);
			if (lines[i] !== "") this.parts.push(lines[i]);
		}
	}
	/**
	* End a block that owns no line of its own (an empty paragraph): flush the
	* blank line owed by the previous block now and owe the next block a fresh
	* one, so each empty block yields one extra blank line. A marker-bearing
	* block (an empty list item's `- `) still owns its first line and falls
	* through to `closeBlock`. At the very start of the output there is no
	* blank line to flush or owe - leading empty blocks vanish, mirroring the
	* parser, which materializes empty paragraphs only between sibling blocks.
	*/
	closeEmptyBlock() {
		if (!this.atLineStart || this.pendingFirst !== null) {
			this.closeBlock();
			return;
		}
		if (this.parts.length === 0) return;
		this.emitDeferredBlankLine();
		this.deferredBlankPrefix = this.linePrefix;
	}
	/** End the current block; the next write gets a blank line before it. */
	closeBlock() {
		if (this.atLineStart && this.pendingFirst !== null) {
			this.emitDeferredBlankLine();
			this.parts.push(this.pendingFirst.trimEnd());
			this.pendingFirst = null;
			this.atLineStart = false;
		}
		if (!this.atLineStart) this.parts.push("\n");
		this.atLineStart = true;
		this.deferredBlankPrefix = this.linePrefix;
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
			this.pendingFirst = base + firstLine;
		}
		fn();
		this.linePrefix = savedLine;
		this.pendingFirst = firstLine !== null ? null : savedFirst;
	}
	finish() {
		return this.parts.join("").replace(/\s+$/, "") + "\n";
	}
	emitDeferredBlankLine() {
		const prefix = this.deferredBlankPrefix;
		if (prefix === null) return;
		this.parts.push(prefix.trimEnd(), "\n");
		this.deferredBlankPrefix = null;
	}
};
function emit$1(node, out) {
	switch (node.type.name) {
		case "doc":
			emitBlockChildren(node, out);
			return;
		case "paragraph":
			if (node.childCount === 0) {
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
			out.withPrefix("> ", "> ", () => emitBlockChildren(node, out));
			out.closeBlock();
			return;
		case "list":
			emitList(node, out, isTightItem(node));
			return;
		case "codeBlock":
			emitCodeBlock(node, out);
			return;
		case "horizontalRule": {
			const { marker } = node.attrs;
			out.write(marker || "---");
			out.closeBlock();
			return;
		}
		case "htmlComment": {
			const { content } = node.attrs;
			out.write(content);
			out.closeBlock();
			return;
		}
		case "table":
			emitTable(node, out);
			return;
		case "text":
			if (node.text) out.write(node.text);
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
function emitBlockChildren(node, out, tightItem = false) {
	const count = node.childCount;
	let index = 0;
	while (index < count) {
		const child = node.child(index);
		if (!isNodeOfType(child, "list")) {
			if (tightItem && index > 0) out.suppressBlank();
			emit$1(child, out);
			index++;
			continue;
		}
		let runEnd = index + 1;
		while (runEnd < count && isNodeOfType(node.child(runEnd), "list")) runEnd++;
		const tightRun = isTightRun(node, index, runEnd);
		for (let item = index; item < runEnd; item++) {
			if (item === index ? tightItem && index > 0 : tightRun) out.suppressBlank();
			emitList(node.child(item), out, tightRun);
		}
		index = runEnd;
	}
}
/**
* A run of sibling `list` nodes serializes tight iff every item is "simple":
* at most one leading paragraph, then only nested lists. Any other shape
* (multiple paragraphs, a blockquote, a code block, …) needs blank-line
* separation inside the item, which per CommonMark makes the whole list
* loose.
*/
function isTightRun(parent, from, to) {
	for (let i = from; i < to; i++) if (!isTightItem(parent.child(i))) return false;
	return true;
}
function isTightItem(item) {
	const count = item.childCount;
	for (let i = 0; i < count; i++) {
		const typeName = item.child(i).type.name;
		if (typeName === "list") continue;
		if (typeName === "paragraph" && i === 0) continue;
		return false;
	}
	return true;
}
/**
* Walk inline children writing text directly. The schema has no marks, so
* every inline child is currently a text node - but going through this
* loop instead of `node.textContent` avoids one intermediate string
* allocation per leaf block (paragraph / heading content).
*/
function emitInlineChildren(node, out) {
	const count = node.childCount;
	for (let i = 0; i < count; i++) {
		const child = node.child(i);
		if (child.isText && child.text) out.write(child.text);
	}
}
function emitList(node, out, tight) {
	const { kind, marker, order, taskMarker, collapsed, markerGap, checked } = node.attrs;
	const bulletMarker = kind === "task" ? marker === "+" ? "+" : marker === "*" ? "*" : "-" : collapsed ? "+" : marker === "*" ? "*" : "-";
	const orderMarker = marker === ")" ? ")" : ".";
	const checkMark = taskMarker === "X" ? "X" : "x";
	const gap = Math.min(Math.max(markerGap ?? 1, 1), 4);
	const prefix = `${kind === "ordered" ? `${order ?? 1}${orderMarker}` : bulletMarker}${" ".repeat(gap)}`;
	const outputMarker = kind === "task" ? `${prefix}[${checked ? checkMark : " "}] ` : prefix;
	const continuation = " ".repeat(prefix.length);
	out.withPrefix(continuation, outputMarker, () => emitBlockChildren(node, out, tight));
	out.closeBlock();
}
function emitCodeBlock(node, out) {
	const attrs = node.attrs;
	const language = attrs.language || "";
	const code = node.textContent;
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
	const minWidth = longestCharRun(code, tilde ? 126 : 96, 2) + 1;
	const fence = (tilde ? "~" : "`").repeat(Math.max(attrs.fenceLength ?? 0, minWidth));
	out.write(fence);
	if (language) out.write(language);
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
* the indented form cannot express (empty content, or a leading or trailing
* blank line), which fall back to a fence. Blank interior lines stay empty so
* a round-trip adds no trailing whitespace; `MdOut.write` still prepends the
* enclosing `linePrefix` (blockquote or list continuation) per line.
*/
function toIndentedCode(code) {
	if (code === "") return void 0;
	const lines = code.split("\n");
	if (lines[0] === "" || lines[lines.length - 1] === "") return void 0;
	for (let i = 0; i < lines.length; i++) if (lines[i] !== "") lines[i] = `    ${lines[i]}`;
	return lines.join("\n");
}
/** Whether any content line would read as a closing `$$` fence. */
function hasDollarFenceLine(code) {
	return code.split("\n").some((line) => line.trim() === "$$");
}
function emitTable(node, out) {
	const rowCount = node.childCount;
	if (rowCount === 0) return;
	const rows = [];
	let colCount = 0;
	let headerIdx = -1;
	for (let r = 0; r < rowCount; r++) {
		const row = node.child(r);
		const cells = [];
		let isHeaderRow = false;
		for (let c = 0; c < row.childCount; c++) {
			const cell = row.child(c);
			if (isNodeOfType(cell, "tableHeaderCell")) isHeaderRow = true;
			cells.push(extractCellText(cell));
		}
		if (isHeaderRow && headerIdx < 0) headerIdx = r;
		if (cells.length > colCount) colCount = cells.length;
		rows.push(cells);
	}
	if (colCount === 0) return;
	const alignmentRow = node.child(headerIdx >= 0 ? headerIdx : 0);
	const delimiters = [];
	for (let c = 0; c < colCount; c++) {
		const cell = c < alignmentRow.childCount ? alignmentRow.child(c) : void 0;
		const align = cell ? cell.attrs.align : void 0;
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
* Why trim: the forward parser (`markdownToDoc`) calls `.trim()`
* on cell text, matching GFM's documented behavior. We must do the same
* here for round-trip stability.
*
* Fast path: if the trimmed text contains no `|` or `\n`, return it as-is
* with no further allocation.
*/
function extractCellText(cell) {
	const raw = cell.textContent.trim();
	if (!raw.includes("|") && !raw.includes("\n")) return raw;
	return raw.replaceAll("|", String.raw`\|`).replaceAll("\n", " ");
}

//#endregion
//#region src/utils/top-level-block-boundary.ts
function isAtTopLevelBlockStart($pos) {
	if ($pos.depth === 0) return true;
	if ($pos.parentOffset !== 0) return false;
	for (let depth = 1; depth < $pos.depth; depth++) if ($pos.index(depth) !== 0) return false;
	return true;
}
function isAtTopLevelBlockEnd($pos) {
	if ($pos.depth === 0) return true;
	if ($pos.parentOffset !== $pos.parent.content.size) return false;
	for (let depth = 1; depth < $pos.depth; depth++) if ($pos.indexAfter(depth) !== $pos.node(depth).childCount) return false;
	return true;
}

//#endregion
//#region src/extensions/clipboard/plain-text.ts
/**
* Serialize a slice to Markdown. A block whose content start is not selected is
* flattened so its opening markers are not synthesized. Incomplete fenced code
* blocks and tables are also flattened because their markers describe the
* entire block. Other intact blocks keep opening markers when their content
* start is selected.
*/
function sliceToMarkdown(schema, slice, selection) {
	const fragment = normalizeOpenEdges(schema, slice, selection);
	let doc;
	try {
		doc = schema.topNodeType.createAndFill(void 0, fragment) ?? void 0;
	} catch {
		doc = void 0;
	}
	if (!doc) return fragment.textBetween(0, fragment.size, "\n", "\n");
	return docToMarkdown(doc).replace(/\n+$/, "");
}
function normalizeOpenEdges(schema, slice, selection) {
	const { content, openStart, openEnd } = slice;
	if (content.childCount === 0 || openStart === 0 && openEnd === 0) return content;
	const includesFirstBlockStart = isTextSelection(selection) && isAtTopLevelBlockStart(selection.$from);
	const includesLastBlockEnd = isTextSelection(selection) && isAtTopLevelBlockEnd(selection.$to);
	const lastIndex = content.childCount - 1;
	const nodes = [];
	content.forEach((node, _offset, index) => {
		const incompleteStart = index === 0 && openStart > 0 && !includesFirstBlockStart;
		const incompleteEnd = index === lastIndex && openEnd > 0 && !includesLastBlockEnd;
		if (incompleteStart) nodes.push(flattenToParagraph(schema, node));
		else if (incompleteEnd) nodes.push(normalizeIncompleteEnd(schema, node, openEnd));
		else nodes.push(node);
	});
	return Fragment.from(nodes);
}
/**
* Follow the open end path and flatten a fenced code block or table found
* there, retaining any selected container prefixes around it. ATX heading and
* blockquote markers are opening structure, so a partial content end does not
* remove them.
*/
function normalizeIncompleteEnd(schema, node, openDepth) {
	if (isNodeOfType(node, "codeBlock") || isNodeOfType(node, "table")) return flattenToParagraph(schema, node);
	if (isNodeOfType(node, "heading")) {
		const attrs = node.attrs;
		if (attrs.setextUnderline != null) return flattenToParagraph(schema, node);
		if (attrs.closingHashes != null) return node.type.create({
			...attrs,
			closingHashes: null
		}, node.content, node.marks);
	}
	if (openDepth <= 1 || node.childCount === 0) return node;
	const lastIndex = node.childCount - 1;
	const child = node.child(lastIndex);
	const normalized = normalizeIncompleteEnd(schema, child, openDepth - 1);
	return normalized === child ? node : node.copy(node.content.replaceChild(lastIndex, normalized));
}
function flattenToParagraph(schema, node) {
	const paragraphType = getNodeType(schema, "paragraph");
	const text = node.textBetween(0, node.content.size, "\n", "\n");
	return paragraphType.create(void 0, text ? schema.text(text) : void 0);
}
/**
* The `text/plain` flavor is Markdown. Opening markers are kept when the
* selection includes their content start; fenced code blocks and tables keep
* structure only when selected completely. The mark mode decides the inline
* layer: hide strips syntax characters, while focus and show keep the source.
*/
function definePlainTextSerializer() {
	return definePlugin(new Plugin({
		key: new PluginKey("meowdown-plain-text-copy"),
		props: { clipboardTextSerializer: (slice, view) => {
			const cleaned = getMarkMode(view.state) === "hide" ? stripHiddenInline(slice) : slice;
			return sliceToMarkdown(view.state.schema, cleaned, view.state.selection);
		} }
	}));
}
/** Drop the inline text a hide-mode editor never shows. */
function stripHiddenInline(slice) {
	return new Slice(mapFragment(slice.content), slice.openStart, slice.openEnd);
}
function mapFragment(fragment) {
	const nodes = [];
	fragment.forEach((node) => {
		nodes.push(node.isTextblock ? filterTextblock(node) : mapChildren(node));
	});
	return Fragment.from(nodes);
}
function mapChildren(node) {
	return node.childCount > 0 ? node.copy(mapFragment(node.content)) : node;
}
/**
* Keep the visible inline text: drop syntax characters, replace a wikilink
* with its display text. An image or math unit renders as a non-text preview,
* so its source is kept whole; stripping it would paste a bare remainder.
*/
function filterTextblock(textblock) {
	const schema = textblock.type.schema;
	const parts = [];
	for (const run of groupInlineRuns(textblock)) {
		const atom = run.atom;
		if (atom != null) {
			if (isMarkOfType(atom, "mdWikilink")) {
				const attrs = atom.attrs;
				const visible = attrs.display || attrs.target;
				if (visible) parts.push(schema.text(visible));
			} else parts.push(...run.children);
			continue;
		}
		for (const child of run.children) if (!hasSyntaxMark(child.marks)) parts.push(child);
	}
	return textblock.copy(Fragment.from(parts));
}

//#endregion
//#region src/extensions/clipboard/clipboard.ts
/**
* The clipboard pipeline: semantic HTML with `data-md` round-trip attributes
* plus a markdown-shaped `text/plain` on copy; the matching `data-md` parser,
* the foreign-HTML markdown conversion, and the blank-line-aware plain text
* parser on paste.
*/
function defineClipboard() {
	return union(defineSemanticClipboardSerializer(), definePlainTextSerializer(), defineClipboardParser(), defineHTMLPaste(), definePlainTextPaste());
}

//#endregion
//#region src/extensions/code-block-highlight.ts
const supportCache = /* @__PURE__ */ new Map();
const parserCache = /* @__PURE__ */ new Map();
const LANGUAGE_ALIASES = { math: "latex" };
async function loadLanguageSupport(language) {
	const cached = supportCache.get(language);
	if (cached !== void 0) return cached;
	const description = LanguageDescription.matchLanguageName(languages, LANGUAGE_ALIASES[language] ?? language, true);
	if (!description) {
		supportCache.set(language, null);
		return null;
	}
	let support = description.support;
	if (!support) try {
		support = await description.load();
	} catch (error) {
		console.error(`[meowdown] Failed to load language "${language}":`, error);
		supportCache.set(language, null);
		return null;
	}
	supportCache.set(language, support);
	return support;
}
function getParser(language, support) {
	const cached = parserCache.get(language);
	if (cached) return cached;
	const parser = createParser({
		parse: (options) => support.language.parser.parse(options.content),
		highlighter: classHighlighter
	});
	parserCache.set(language, parser);
	return parser;
}
const lazyParser = (options) => {
	const language = options.language?.trim();
	if (!language) return [];
	const support = supportCache.get(language);
	if (support === null) return [];
	if (support) return getParser(language, support)(options);
	return loadLanguageSupport(language).then(() => void 0);
};
/**
* Adds syntax highlighting to `codeBlock` nodes, parsing each block with the
* matching CodeMirror/Lezer grammar (loaded on demand from
* `@codemirror/language-data`). Tokens are tagged with `@lezer/highlight`
* `tok-*` classes; the default theme colors them per color scheme.
*/
function defineCodeBlockSyntaxHighlight() {
	return defineCodeBlockHighlight({
		parser: lazyParser,
		nodeTypes: ["codeBlock"]
	});
}
function tokenize(code, support) {
	const tree = support.language.parser.parse(code);
	const tokens = [];
	highlightTree(tree, classHighlighter, (from, to, classes) => {
		tokens.push([
			from,
			to,
			classes
		]);
	});
	return tokens;
}
/**
* Highlight `code` in `language` into `tok-*` token spans, the same classes the
* editor's decorations use. Returns synchronously when the grammar is already
* loaded (the common path, no render flash), and a `Promise` only when a grammar
* must load on demand. Returns `[]` for an empty or unsupported language.
*/
function getCodeTokens(code, language) {
	const trimmed = language.trim();
	if (!trimmed) return [];
	const support = supportCache.get(trimmed);
	if (support === null) return [];
	if (support) return tokenize(code, support);
	return loadLanguageSupport(trimmed).then((loaded) => loaded ? tokenize(code, loaded) : []);
}

//#endregion
//#region src/extensions/code-block.ts
function defineFenceStyleAttr() {
	return defineNodeAttr({
		type: "codeBlock",
		attr: "fenceStyle",
		default: null,
		toDOM: (value) => value != null ? ["data-fence-style", value] : null,
		parseDOM: (node) => {
			const raw = node.getAttribute("data-fence-style");
			return raw === "tilde" || raw === "indented" || raw === "dollar" ? raw : null;
		}
	});
}
function defineFenceLengthAttr() {
	return defineNodeAttr({
		type: "codeBlock",
		attr: "fenceLength",
		default: null,
		toDOM: (value) => value != null ? ["data-fence-length", String(value)] : null,
		parseDOM: (node) => {
			const length = parseInteger(node.getAttribute("data-fence-length"));
			return length != null && length > 3 ? length : null;
		}
	});
}
function getTildeFenceAttrs(match) {
	return {
		language: match[1] || "",
		fenceStyle: "tilde"
	};
}
function defineTildeFenceInputRule() {
	return defineTextBlockInputRule({
		regex: /^~~~(\S*)\s$/,
		type: "codeBlock",
		attrs: getTildeFenceAttrs
	});
}
function defineTildeFenceEnterRule() {
	return defineTextBlockEnterRule({
		regex: /^~~~(\S*)$/,
		type: "codeBlock",
		attrs: getTildeFenceAttrs
	});
}
function defineDollarFenceEnterRule() {
	return defineTextBlockEnterRule({
		regex: /^\$\$$/,
		type: "codeBlock",
		attrs: () => ({
			language: "math",
			fenceStyle: "dollar"
		})
	});
}
function defineCodeBlock$1() {
	return union(defineCodeBlock(), defineFenceStyleAttr(), defineFenceLengthAttr(), defineTildeFenceInputRule(), defineTildeFenceEnterRule(), defineDollarFenceEnterRule());
}

//#endregion
//#region src/extensions/commands.ts
function selectText(anchor, head) {
	return (state, dispatch) => {
		if (dispatch) {
			const selection = TextSelection.create(state.doc, anchor, head);
			dispatch(state.tr.setSelection(selection));
		}
		return true;
	};
}
function selectTextBetween($anchor, $head, bias) {
	return (state, dispatch) => {
		if (dispatch) {
			const selection = TextSelection.between($anchor, $head, bias);
			dispatch(state.tr.setSelection(selection));
		}
		return true;
	};
}
function insertMarkdown(markdown) {
	return (state, dispatch) => {
		if (!markdown.trim()) return false;
		const nodes = getNodeBuildersForSchema(state.schema);
		const content = markdownToDoc(markdown, { nodes }).content;
		if (content.childCount === 0) return false;
		const slice = content.childCount === 1 && isNodeOfType(content.child(0), "paragraph") ? new Slice(content, 1, 1) : new Slice(content, 0, Slice.maxOpen(content).openEnd);
		if (dispatch) {
			const tr = state.tr;
			const selection = tr.selection;
			if (!isTextSelection(selection) || !selection.empty) tr.setSelection(TextSelection.near(selection.$from));
			dispatch(tr.replaceSelection(slice).scrollIntoView());
		}
		return true;
	};
}
/**
* Inserts menu trigger text (`/`, `[[`, `@`, `#`) at the cursor and opens the
* matching autocomplete menu in the same transaction. The menus normally only
* open while the user is typing, so a host inserting the trigger itself (e.g.
* from a toolbar button) must go through this command instead of a plain
* `insertText`. When a non-space character sits right before the caret, a
* space is inserted first so the trigger can match, like a user would type
* it. In a code block, where no menu can open, the command does nothing.
*/
function insertTrigger(text) {
	return (state, dispatch) => {
		if (!text) return false;
		const $from = state.selection.$from;
		if ($from.parent.type.spec.code) return false;
		if (dispatch) {
			const offset = $from.parentOffset;
			const charBefore = offset === 0 ? "" : $from.parent.textBetween(offset - 1, offset);
			const needsSpace = charBefore !== "" && !/\s/u.test(charBefore);
			const tr = state.tr.insertText(needsSpace ? ` ${text}` : text);
			triggerAutocomplete(tr);
			dispatch(tr.scrollIntoView());
		}
		return true;
	};
}
/**
* Turns the current block into plain text, peeling one layer per call: a
* non-paragraph textblock becomes a paragraph, then a paragraph in a list
* loses its marker, then a paragraph in a blockquote lifts out of it.
*/
function turnIntoText() {
	return chainCommands(setBlockType({ type: "paragraph" }), unwrapList(), lift);
}
function scrollIntoView() {
	return (state, dispatch) => {
		if (dispatch) dispatch(state.tr.scrollIntoView());
		return true;
	};
}
function defineEditorCommands() {
	return defineCommands({
		insertMarkdown,
		insertTrigger,
		scrollIntoView,
		selectText,
		selectTextBetween,
		turnIntoText
	});
}

//#endregion
//#region src/extensions/cross-editor-drag.ts
const mountedViews = /* @__PURE__ */ new Set();
function findDragSource(target) {
	for (const view of mountedViews) if (view !== target && !view.isDestroyed && view.editable && view.dragging) return view;
}
function deleteDraggedContent(view, dragging) {
	const tr = view.state.tr;
	if (dragging.node) {
		if (view.state.doc.nodeAt(dragging.node.from) !== dragging.node.node) return;
		dragging.node.replace(tr);
	} else tr.deleteSelection();
	if (!tr.docChanged) return;
	view.dispatch(tr.setMeta("uiEvent", "drop"));
}
function handleCrossEditorDrop(target, event, slice, move) {
	if (move || slice.size === 0) return false;
	const source = findDragSource(target);
	if (!source) return false;
	const dragging = source.dragging;
	if (!dragging) return false;
	if (isApple ? event.altKey : event.ctrlKey) return false;
	source.dragging = null;
	const docBeforeDrop = target.state.doc;
	queueMicrotask(() => {
		if (source.isDestroyed || target.isDestroyed) return;
		if (target.state.doc === docBeforeDrop) return;
		deleteDraggedContent(source, dragging);
	});
	return false;
}
function createCrossEditorDragPlugin() {
	return new Plugin({
		key: new PluginKey("meowdown-cross-editor-drag"),
		view: (view) => {
			mountedViews.add(view);
			return { destroy: () => {
				mountedViews.delete(view);
			} };
		},
		props: { handleDrop: handleCrossEditorDrop }
	});
}
/**
* Dragging a block from one meowdown editor into another one on the same page
* moves it: the block leaves the source document once it lands in the target.
* Hold Alt (Ctrl on Windows and Linux) to copy instead.
*/
function defineCrossEditorDrag() {
	return withPriority$1(definePlugin(createCrossEditorDragPlugin()), Priority$1.high);
}

//#endregion
//#region src/extensions/escape-collapse.ts
/**
* Collapses a non-empty selection to a caret at its head. Leaves an empty
* selection alone so Escape can serve whoever binds it next.
*/
const collapseSelection = (state, dispatch, view) => {
	const { selection } = state;
	if (selection.empty) return false;
	if (view?.composing) return false;
	dispatch?.(state.tr.setSelection(TextSelection.near(selection.$head)));
	return true;
};
/**
* Binds `Escape` to collapse the selection, at low priority so an open menu
* (autocomplete binds Escape at the highest priority) dismisses itself first.
*/
function defineEscapeCollapse() {
	return withPriority$1(defineKeymap({ Escape: collapseSelection }), Priority$1.low);
}

//#endregion
//#region src/extensions/find.ts
const revealActiveMatch = new Plugin({ props: { decorations: (state) => {
	const { from, to, empty } = state.selection;
	if (empty || getSearchStatus$1(state).active === 0) return;
	return DecorationSet.create(state.doc, [Decoration.inline(from, to, { class: "show" })]);
} } });
/**
* Find over the editor's text. `setSearchQuery` highlights every match and
* selects the first one at or after the caret; `findNext` and `findPrev` walk
* the matches and wrap at the document edges. A match sitting in a run the
* current mark mode hides reveals itself while it is the active one.
*/
function defineFind() {
	return union(defineSearchQuery(), defineSearchCommands(), definePlugin(revealActiveMatch));
}

//#endregion
//#region src/extensions/frontmatter.ts
/**
* Stores YAML frontmatter as a non-rendered attribute on the root `doc` node.
*/
function defineDocFrontmatterAttr() {
	return defineNodeAttr({
		type: "doc",
		attr: "frontmatter",
		default: null
	});
}

//#endregion
//#region src/utils/composition.ts
const COMPOSITION_TAIL_MS = 50;
let compositionEndedAt = -1;
let isComposing = false;
if (typeof window !== "undefined") {
	window.addEventListener("compositionstart", () => {
		isComposing = true;
	}, {
		capture: true,
		passive: true
	});
	window.addEventListener("compositionend", () => {
		isComposing = false;
		compositionEndedAt = Date.now();
	}, {
		capture: true,
		passive: true
	});
}
function getIsComposing() {
	return isComposing || compositionEndedAt > 0 && Date.now() - compositionEndedAt <= COMPOSITION_TAIL_MS;
}

//#endregion
//#region src/utils/execute-command.ts
function executeCommand(view, command) {
	return command(view.state, view.dispatch, view);
}

//#endregion
//#region src/extensions/hidden-run.ts
function getCharMarks(state, pos) {
	if (pos < 0 || pos + 1 > state.doc.content.size) return;
	const $pos = state.doc.resolve(pos);
	const child = $pos.parent.maybeChild($pos.index());
	if (child == null || !child.isText) return;
	return child.marks;
}
function isHiddenChar(state, pos) {
	const marks = getCharMarks(state, pos);
	if (marks == null) return false;
	return marks.some((mark) => SYNTAX_MARK_NAMES.has(mark.type.name));
}
function isInsideNonCodeTextblock(state, pos) {
	if (pos < 0 || pos > state.doc.content.size) return false;
	const $pos = state.doc.resolve(pos);
	return $pos.parent.isTextblock && !$pos.parent.type.spec.code;
}
/** The maximal contiguous hidden run ending exactly at `pos`, or undefined. */
function getHiddenRunBefore(state, pos) {
	if (!isInsideNonCodeTextblock(state, pos)) return;
	const blockStart = state.doc.resolve(pos).start();
	let from = pos;
	while (from > blockStart && isHiddenChar(state, from - 1)) from--;
	return from < pos ? {
		from,
		to: pos
	} : void 0;
}
/** The maximal contiguous hidden run starting exactly at `pos`, or undefined. */
function getHiddenRunAfter(state, pos) {
	if (!isInsideNonCodeTextblock(state, pos)) return;
	const blockEnd = state.doc.resolve(pos).end();
	let to = pos;
	while (to < blockEnd && isHiddenChar(state, to)) to++;
	return to > pos ? {
		from: pos,
		to
	} : void 0;
}
function isHiddenRunInterior(state, pos) {
	return isHiddenChar(state, pos - 1) && isHiddenChar(state, pos);
}
/** The full run around an interior position, or undefined for rest positions. */
function getHiddenRunAround(state, pos) {
	if (!isHiddenRunInterior(state, pos)) return;
	const before = getHiddenRunBefore(state, pos);
	if (!before) return;
	const after = getHiddenRunAfter(state, pos);
	if (!after) return;
	return {
		from: before.from,
		to: after.to
	};
}
function charHasMark(state, pos, mark) {
	const marks = getCharMarks(state, pos);
	return marks != null && mark.isInSet(marks);
}
function getInnermostPackRangeAt(state, charPos) {
	const marks = getCharMarks(state, charPos);
	if (marks == null) return;
	const packType = getMarkType(state.schema, "mdPack");
	const packs = marks.filter((mark) => mark.type === packType);
	if (packs.length === 0) return;
	const $pos = state.doc.resolve(charPos);
	const blockStart = $pos.start();
	const blockEnd = $pos.end();
	let innermost;
	for (const pack of packs) {
		let from = charPos;
		while (from > blockStart && charHasMark(state, from - 1, pack)) from--;
		let to = charPos + 1;
		while (to < blockEnd && charHasMark(state, to, pack)) to++;
		if (innermost == null || to - from < innermost.to - innermost.from) innermost = {
			from,
			to
		};
	}
	return innermost;
}
function isPackOuterEdge(state, run, edge) {
	const pack = getInnermostPackRangeAt(state, edge === "from" ? run.from : run.to - 1);
	if (pack == null) return false;
	return edge === "from" ? pack.from === run.from : pack.to === run.to;
}
function getPointerEdge(state, run, pos) {
	const fromIsOuter = isPackOuterEdge(state, run, "from");
	const toIsOuter = isPackOuterEdge(state, run, "to");
	if (fromIsOuter && !toIsOuter) return run.from;
	if (toIsOuter && !fromIsOuter) return run.to;
	return pos - run.from <= run.to - pos ? run.from : run.to;
}
/**
* The rest position for a caret that landed at `newPos`. `oldPos` supplies the
* travel direction for keyboard motion; `isPointer` selects the click rules.
*/
function getRestPosition(state, oldPos, newPos, isPointer) {
	if (!isInsideNonCodeTextblock(state, newPos)) return newPos;
	const run = getHiddenRunAround(state, newPos);
	if (run != null) {
		if (!isPointer) return newPos >= oldPos ? run.to : run.from;
		return getPointerEdge(state, run, newPos);
	}
	if (!isPointer) return newPos;
	const runBefore = getHiddenRunBefore(state, newPos);
	if (runBefore != null && isPackOuterEdge(state, runBefore, "from")) return runBefore.from;
	const runAfter = getHiddenRunAfter(state, newPos);
	if (runAfter != null && isPackOuterEdge(state, runAfter, "to")) return runAfter.to;
	return newPos;
}
function getCaretTail(state, pos) {
	if (!isInsideNonCodeTextblock(state, pos)) return;
	const hiddenBefore = isHiddenChar(state, pos - 1);
	const hiddenAfter = isHiddenChar(state, pos);
	if (hiddenBefore === hiddenAfter) return;
	return hiddenAfter ? "left" : "right";
}
/**
* The leading and trailing hidden runs of the innermost unit whose marker
* character sits at `charPos`, trailing first so callers can delete them in
* order without remapping. A fully hidden unit yields one run.
*/
function getUnitMarkerRuns(state, charPos) {
	const pack = getInnermostPackRangeAt(state, charPos);
	if (pack == null) return [];
	const leading = getHiddenRunAfter(state, pack.from);
	const trailing = getHiddenRunBefore(state, pack.to);
	const runs = [];
	if (trailing != null) runs.push(trailing);
	if (leading != null && (trailing == null || leading.from !== trailing.from)) runs.push(leading);
	return runs;
}

//#endregion
//#region src/extensions/hidden-run-caret.ts
const snapKey = new PluginKey("meowdown-hidden-run-snap");
const beforeInputKey = new PluginKey("meowdown-hidden-run-beforeinput");
function createSnapPlugin() {
	return new Plugin({
		key: snapKey,
		appendTransaction: (transactions, oldState, newState) => {
			if (getIsComposing()) return null;
			if (getMarkMode(newState) !== "hide") return null;
			const selection = newState.selection;
			if (!isTextSelection(selection)) return null;
			const isPointer = transactions.some((tr) => tr.getMeta("pointer") != null);
			if (selection.empty) {
				const next = getRestPosition(newState, oldState.selection.head, selection.head, isPointer);
				if (next === selection.head) return null;
				return newState.tr.setSelection(TextSelection.create(newState.doc, next));
			}
			const from = getHiddenRunAround(newState, selection.from)?.from ?? selection.from;
			const to = getHiddenRunAround(newState, selection.to)?.to ?? selection.to;
			if (from === selection.from && to === selection.to) return null;
			const anchor = selection.anchor === selection.from ? from : to;
			const head = selection.head === selection.from ? from : to;
			return newState.tr.setSelection(TextSelection.create(newState.doc, anchor, head));
		}
	});
}
const relocateEnterSplit = (state, dispatch) => {
	if (getMarkMode(state) !== "hide") return false;
	const selection = state.selection;
	if (!isTextSelection(selection) || !selection.empty) return false;
	const outer = getRestPosition(state, selection.head, selection.head, true);
	if (outer === selection.head) return false;
	dispatch?.(state.tr.setSelection(TextSelection.create(state.doc, outer)));
	return false;
};
function createUnformatCommand(direction) {
	return (state, dispatch) => {
		if (getMarkMode(state) !== "hide") return false;
		const selection = state.selection;
		if (!isTextSelection(selection) || !selection.empty) return false;
		const $head = selection.$head;
		if (!$head.parent.isTextblock || $head.parent.type.spec.code) return false;
		const run = direction === -1 ? getHiddenRunBefore(state, selection.head) : getHiddenRunAfter(state, selection.head);
		if (run == null) return false;
		const markerChar = direction === -1 ? run.to - 1 : run.from;
		const markerRuns = getUnitMarkerRuns(state, markerChar);
		const tr = state.tr;
		if (markerRuns.length === 0) tr.delete(run.from, run.to);
		else for (const markerRun of markerRuns) tr.delete(markerRun.from, markerRun.to);
		dispatch?.(tr);
		return true;
	};
}
const backspaceUnformat = createUnformatCommand(-1);
const deleteUnformat = createUnformatCommand(1);
function createBeforeInputPlugin() {
	return new Plugin({
		key: beforeInputKey,
		props: { handleDOMEvents: { beforeinput: (view, event) => {
			if (view.composing) return false;
			const command = event.inputType === "deleteContentBackward" ? backspaceUnformat : event.inputType === "deleteContentForward" ? deleteUnformat : void 0;
			if (command == null) return false;
			if (!executeCommand(view, command)) return false;
			event.preventDefault();
			return true;
		} } }
	});
}
function defineHiddenRunCaret() {
	return union(definePlugin(createSnapPlugin()), definePlugin(createBeforeInputPlugin()), withPriority$1(defineKeymap({
		Enter: relocateEnterSplit,
		Backspace: backspaceUnformat,
		Delete: deleteUnformat
	}), Priority$1.highest));
}

//#endregion
//#region src/extensions/horizontal-rule.ts
function defineHorizontalRuleMarkerAttr() {
	return defineNodeAttr({
		type: "horizontalRule",
		attr: "marker",
		default: null,
		toDOM: (value) => value ? ["data-hr-marker", value] : null,
		parseDOM: (node) => node.getAttribute("data-hr-marker")
	});
}
function defineMeowdownHorizontalRule() {
	return union(defineHorizontalRule(), defineHorizontalRuleMarkerAttr());
}

//#endregion
//#region src/extensions/html-comment.ts
/**
* A block-level HTML comment (`<!-- ... -->`) as an invisible, atomic node.
*
* Markdown is the source of truth, so a comment must survive a round-trip, but
* a comment is, by definition, not rendered output. Rather than spilling the raw
* `<!-- ... -->` into a paragraph (where it reads as body text), the parser maps
* a `CommentBlock` onto this node: the text rides on the `content` attribute and
* `toDOM` hides it with `display: none`, so it stays in the document and
* serializes back verbatim while never showing in the editor. Useful for
* sentinel markers that tools embed around a region of a note.
*
* Only block-level comments (a `<!-- ... -->` that owns its line) become this
* node. An inline comment in the middle of a paragraph is left as literal text,
* and raw HTML blocks (`<div>…`) stay visible paragraphs — they can carry
* content a reader expects to see.
*
* The node is `atom` (no editable content) and not selectable: it is an opaque,
* invisible marker the cursor steps over rather than a block the user edits.
*/
function defineHTMLComment() {
	return defineNodeSpec({
		name: "htmlComment",
		group: "block",
		atom: true,
		selectable: false,
		attrs: { content: { default: "" } },
		toDOM: (node) => ["div", {
			"data-html-comment": node.attrs.content,
			style: "display: none"
		}],
		parseDOM: [{
			tag: "div[data-html-comment]",
			getAttrs: (dom) => ({ content: dom.getAttribute("data-html-comment") ?? "" })
		}]
	});
}

//#endregion
//#region src/extensions/mark-chunk.ts
function markChunkToJSON(chunk) {
	const [from, to, marks] = chunk;
	return [
		from,
		to,
		marks.map((mark) => mark.toJSON())
	];
}
function markChunkFromJSON(schema, json) {
	const [from, to, marks] = json;
	return [
		from,
		to,
		marks.map((markJSON) => Mark.fromJSON(schema, markJSON))
	];
}

//#endregion
//#region src/extensions/marks-equal.ts
/**
* Position-wise equality on two mark arrays. Returns `true` only when
* the arrays have the same length and `a[i].eq(b[i])` for every index.
*/
function marksEqual(a, b) {
	if (a === b) return true;
	if (a.length !== b.length) return false;
	for (let i = 0; i < a.length; i++) if (!a[i].eq(b[i])) return false;
	return true;
}

//#endregion
//#region src/extensions/batch-set-mark-step.ts
const SPARSE_CHUNK_LIMIT = 32;
/**
* Apply a small batch by visiting each chunk's narrow range independently.
* This avoids rebuilding a shared ancestor when an ordinary edit produces only
* a handful of distant mark changes.
*/
function applySparseChunks(doc, chunks) {
	const docSize = doc.content.size;
	let transform;
	for (const [from, to, unsortedMarks] of chunks) {
		if (from >= to) continue;
		const safeFrom = Math.max(0, Math.min(from, docSize));
		const safeTo = Math.max(safeFrom, Math.min(to, docSize));
		if (safeFrom >= safeTo) continue;
		const expected = Mark.setFrom(unsortedMarks);
		doc.nodesBetween(safeFrom, safeTo, (node, position) => {
			if (!node.isText) return true;
			const nodeFrom = Math.max(safeFrom, position);
			const nodeTo = Math.min(safeTo, position + node.nodeSize);
			if (nodeFrom >= nodeTo || marksEqual(node.marks, expected)) return false;
			transform ??= new Transform(doc);
			for (const mark of node.marks) transform.removeMark(nodeFrom, nodeTo, mark);
			for (const mark of expected) transform.addMark(nodeFrom, nodeTo, mark);
			return false;
		});
	}
	return StepResult.ok(transform?.doc ?? doc);
}
/**
* Apply a dense batch in one ordered tree walk. Reference-link restyles can
* produce hundreds of chunks, where running nodesBetween once per chunk would
* repeatedly descend through the same document branches.
*/
function applySequentialChunks(doc, chunks) {
	const docSize = doc.content.size;
	const sorted = [...chunks].filter(([from, to]) => from < to && from < docSize).sort((left, right) => left[0] - right[0]);
	if (sorted.length === 0) return StepResult.ok(doc);
	const expectedSets = sorted.map(([, , marks]) => Mark.setFrom(marks));
	const first = Math.max(0, sorted[0][0]);
	let last = 0;
	for (const [, to] of sorted) if (to > last) last = to;
	last = Math.min(last, docSize);
	if (first >= last) return StepResult.ok(doc);
	let chunkIndex = 0;
	/**
	* Split one text node at chunk boundaries. A piece with undefined marks keeps
	* the source node's marks; a concrete set replaces them.
	*/
	function rewriteText(node, nodeFrom) {
		const nodeTo = nodeFrom + node.nodeSize;
		while (chunkIndex < sorted.length && sorted[chunkIndex][1] <= nodeFrom) chunkIndex++;
		const pieces = [];
		let cursor = nodeFrom;
		let changed = false;
		for (let index = chunkIndex; index < sorted.length; index++) {
			const [chunkFrom, chunkTo] = sorted[index];
			if (chunkFrom >= nodeTo) break;
			const from = Math.max(chunkFrom, cursor);
			const to = Math.min(chunkTo, nodeTo);
			if (from >= to) continue;
			if (from > cursor) pieces.push({
				from: cursor,
				to: from,
				marks: void 0
			});
			const expected = expectedSets[index];
			const differs = !marksEqual(node.marks, expected);
			if (differs) changed = true;
			pieces.push({
				from,
				to,
				marks: differs ? expected : void 0
			});
			cursor = to;
		}
		if (!changed) return;
		if (cursor < nodeTo) pieces.push({
			from: cursor,
			to: nodeTo,
			marks: void 0
		});
		return pieces.map((piece) => {
			const cut = node.cut(piece.from - nodeFrom, piece.to - nodeFrom);
			return piece.marks == null ? cut : cut.mark(piece.marks);
		});
	}
	/**
	* Rebuild only ancestors containing changed text. Children outside the dense
	* batch's overall span retain their original node identities.
	*/
	function rewriteContent(node, contentFrom) {
		let rebuilt;
		let childFrom = contentFrom;
		for (let index = 0; index < node.childCount; index++) {
			const child = node.child(index);
			const childTo = childFrom + child.nodeSize;
			let replacement = child;
			if (childTo > first && childFrom < last) {
				if (child.isText) replacement = rewriteText(child, childFrom) ?? child;
				else if (child.childCount > 0) {
					const content = rewriteContent(child, childFrom + 1);
					if (content != null) replacement = child.copy(content);
				}
			}
			if (replacement !== child && rebuilt == null) {
				rebuilt = [];
				for (let seen = 0; seen < index; seen++) rebuilt.push(node.child(seen));
			}
			if (rebuilt != null) if (Array.isArray(replacement)) rebuilt.push(...replacement);
			else rebuilt.push(replacement);
			childFrom = childTo;
		}
		return rebuilt == null ? void 0 : Fragment.fromArray(rebuilt);
	}
	const content = rewriteContent(doc, 0);
	return StepResult.ok(content == null ? doc : doc.copy(content));
}
/**
* One ProseMirror Step that applies a batch of `MarkChunk`s in a single
* undo entry.
*/
var BatchSetMarkStep = class BatchSetMarkStep extends Step {
	constructor(chunks) {
		super();
		this.chunks = chunks;
	}
	apply(doc) {
		if (this.chunks.length === 0) return StepResult.ok(doc);
		if (this.chunks.length <= SPARSE_CHUNK_LIMIT) return applySparseChunks(doc, this.chunks);
		return applySequentialChunks(doc, this.chunks);
	}
	invert(doc) {
		if (this.chunks.length === 0) return emptyBatchSetMarkStep;
		const overallFrom = this.chunks[0][0];
		let overallTo = this.chunks[0][1];
		for (const [, to] of this.chunks) if (to > overallTo) overallTo = to;
		const docSize = doc.content.size;
		const safeFrom = Math.max(0, Math.min(overallFrom, docSize));
		const safeTo = Math.max(safeFrom, Math.min(overallTo, docSize));
		const slice = doc.slice(safeFrom, safeTo);
		return new ReplaceStep(safeFrom, safeTo, slice, false);
	}
	/**
	* Returns `null`: in a collaborative-editing rebase the chunk
	* positions may no longer line up with text-block boundaries. The
	* inline-mark plugin re-derives chunks on every `appendTransaction`,
	* so dropping the step on rebase is safe. It will be regenerated on
	* the next dispatch.
	*/
	map(_mapping) {
		return null;
	}
	toJSON() {
		return {
			stepType: "batchSetMark",
			chunks: this.chunks.map(markChunkToJSON)
		};
	}
	static fromJSON(schema, json) {
		const chunks = json.chunks;
		return new BatchSetMarkStep(chunks.map((c) => markChunkFromJSON(schema, c)));
	}
};
Step.jsonID("batchSetMark", BatchSetMarkStep);
const emptyBatchSetMarkStep = new BatchSetMarkStep([]);

//#endregion
//#region src/extensions/magic-comment.ts
const MAGIC_COMMENT_RE = /^<!--\s*(\{[^}]*\})\s*-->$/;
const TRAILING_MAGIC_COMMENT_RE = /<!--\s*\{[^}]*\}\s*-->$/;
/**
* Read the metadata out of a `<!-- {...} -->` comment, or `undefined` when the
* text is not a comment carrying at least one recognized field.
*/
function parseMagicComment(comment) {
	const match = MAGIC_COMMENT_RE.exec(comment.trim());
	if (!match) return;
	let data;
	try {
		data = JSON.parse(match[1]);
	} catch {
		return;
	}
	if (!isObject(data)) return;
	const width = toPositiveNumber(data.width);
	const height = toPositiveNumber(data.height);
	if (!width && !height) return;
	return {
		width,
		height
	};
}
function toPositiveNumber(value) {
	if (typeof value === "number" && Number.isFinite(value) && value > 0) return Math.round(value);
}
/** The canonical comment meowdown writes for the metadata. */
function formatMagicComment(magic) {
	return `<!-- ${JSON.stringify(magic)} -->`;
}
/** Drop a trailing magic comment from the source text. */
function stripMagicComment(source) {
	return source.replace(TRAILING_MAGIC_COMMENT_RE, "");
}

//#endregion
//#region src/extensions/reference-links.ts
const MAX_DEFINITION_LENGTH = 1024;
function normalizeReferenceLabel(label) {
	return normalizeIdentifier(label);
}
function mayBeReferenceDefinition(text) {
	if (text.length > MAX_DEFINITION_LENGTH) return false;
	const first = text.search(/\S/);
	if (first < 0 || text.charCodeAt(first) !== 91) return false;
	return text.includes("]:", first + 1);
}
function getReferenceNode(text) {
	if (!mayBeReferenceDefinition(text)) return;
	const reference = gfmParser.parse(text).topNode.firstChild;
	if (reference?.type.id !== LEZER_NODE_IDS.LinkReference) return;
	if (reference.nextSibling != null) return;
	return reference;
}
function decodeDestination(raw) {
	const value = raw.startsWith("<") && raw.endsWith(">") ? raw.slice(1, -1) : raw;
	return decodeString(value);
}
function decodeTitle(raw) {
	return raw.length < 2 ? "" : decodeString(raw.slice(1, -1));
}
function parseReferenceDefinition(text) {
	const reference = getReferenceNode(text);
	if (reference == null) return;
	const label = reference.getChild("LinkLabel");
	const destination = reference.getChild("URL");
	if (label == null || destination == null) return;
	const key = normalizeReferenceLabel(text.slice(label.from + 1, label.to - 1));
	if (key === "") return;
	const title = reference.getChild("LinkTitle");
	return {
		key,
		href: decodeDestination(text.slice(destination.from, destination.to)),
		title: title == null ? "" : decodeTitle(text.slice(title.from, title.to))
	};
}
function isDefinitionContainer(parent, index) {
	if (parent == null) return true;
	if (isNodeOfType(parent, "tableCell") || isNodeOfType(parent, "tableHeaderCell")) return false;
	return !isNodeOfType(parent, "list") || parent.attrs.kind !== "task" || index > 0;
}
function isDefinitionTextblock(node, parent, index) {
	return isNodeOfType(node, "paragraph") && isDefinitionContainer(parent, index);
}
const definitionCache = /* @__PURE__ */ new WeakMap();
function getDefinition(node, parent, index) {
	if (!isDefinitionTextblock(node, parent, index)) return;
	if (definitionCache.has(node)) return definitionCache.get(node);
	const definition = parseReferenceDefinition(node.textContent);
	definitionCache.set(node, definition);
	return definition;
}
function isReferenceDefinitionNode(node, parent, index) {
	return getDefinition(node, parent, index) != null;
}
function collectReferenceDefinitions(doc) {
	const definitions = /* @__PURE__ */ new Map();
	const nodes = /* @__PURE__ */ new Set();
	doc.descendants((node, _position, parent, index) => {
		if (node.type.spec.code) return false;
		if (!node.isTextblock) return true;
		const definition = getDefinition(node, parent, index);
		if (definition != null) {
			nodes.add(node);
			if (!definitions.has(definition.key)) definitions.set(definition.key, definition);
		}
		return false;
	});
	return {
		definitions,
		nodes
	};
}
function rangeHasDefinitionCandidate(doc, from, to) {
	const docSize = doc.content.size;
	let found = false;
	doc.nodesBetween(Math.max(0, from - 1), Math.min(docSize, to + 1), (node, _position, parent, index) => {
		if (found || node.type.spec.code) return false;
		if (!node.isTextblock) return true;
		if (isDefinitionTextblock(node, parent, index) && (definitionCache.has(node) ? definitionCache.get(node) != null : mayBeReferenceDefinition(node.textContent))) found = true;
		return false;
	});
	return found;
}
function transactionTouchesDefinitions(transaction) {
	if (transaction.steps.some((step) => step instanceof AttrStep && step.attr === "kind")) return true;
	for (const [index, map] of transaction.mapping.maps.entries()) {
		const before = transaction.docs[index];
		const after = index + 1 < transaction.docs.length ? transaction.docs[index + 1] : transaction.doc;
		let touched = false;
		map.forEach((oldStart, oldEnd, newStart, newEnd) => {
			if (touched) return;
			touched = rangeHasDefinitionCandidate(before, oldStart, oldEnd) || rangeHasDefinitionCandidate(after, newStart, newEnd);
		});
		if (touched) return true;
	}
	return false;
}
function updateReferenceDefinitions(previous, transaction, doc) {
	if (!transaction.docChanged || !transactionTouchesDefinitions(transaction)) return previous;
	return collectReferenceDefinitions(doc);
}

//#endregion
//#region src/extensions/wiki-embed.ts
const WIKI_EMBED_SIZE = /^(\d+)(?:x(\d+))?$/i;
function positiveInteger(value) {
	if (!value) return null;
	const parsed = Number.parseInt(value, 10);
	return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}
/** Parse `![[target]]`, `![[target|alias]]`, `![[target|width]]`, or `![[target|widthxheight]]`. */
function parseWikiEmbed(source) {
	const inner = source.replace(/^!\[\[/, "").replace(/\]\]$/, "");
	const pipe = inner.lastIndexOf("|");
	if (pipe < 0) return {
		target: inner.trim(),
		display: "",
		width: null,
		height: null
	};
	const target = inner.slice(0, pipe).trim();
	const suffix = inner.slice(pipe + 1).trim();
	const size = WIKI_EMBED_SIZE.exec(suffix);
	if (!size) return {
		target,
		display: suffix,
		width: null,
		height: null
	};
	const width = positiveInteger(size[1]);
	const height = positiveInteger(size[2]);
	if (width == null || size[2] && height == null) return {
		target,
		display: suffix,
		width: null,
		height: null
	};
	return {
		target,
		display: "",
		width,
		height
	};
}
/** Rewrite a wiki image embed with a persisted display size. */
function formatSizedWikiEmbed(target, width, height) {
	return `![[${target}|${Math.round(width)}x${Math.round(height)}]]`;
}
/** Last path component of a target, with a note heading/block fragment removed. */
function wikiEmbedBasename(target) {
	const path = target.split(/[?#]/, 1)[0];
	const segment = path.split(/[/\\]/).findLast(Boolean) ?? path;
	try {
		return decodeURIComponent(segment);
	} catch {
		return segment;
	}
}

//#endregion
//#region src/extensions/wikilink.ts
/** Splits `[[target]]`/`[[target|alias]]` into its target and display label (the alias, or empty). */
function parseWikilink(text) {
	const inner = text.replace(/^\[\[/, "").replace(/\]\]$/, "");
	const pipe = inner.indexOf("|");
	if (pipe < 0) return {
		target: inner.trim(),
		display: ""
	};
	return {
		target: inner.slice(0, pipe).trim(),
		display: inner.slice(pipe + 1).trim()
	};
}
/**
* Render `mdWikilink` as a non-editable label standing in for the raw source.
* The source stays in `contentDOM` after the label, hidden by `style.css`
* (`.md-atom-view-content`); the whole wikilink is one caret stop owned by
* `defineAtomMarkNavigation`.
*/
function createWikilinkMarkView() {
	return (mark) => {
		const attrs = mark.attrs;
		const dom = document.createElement("span");
		dom.className = "md-wikilink-view md-atom-view";
		const preview = document.createElement("span");
		preview.className = "md-wikilink-view-preview md-atom-view-preview";
		preview.contentEditable = "false";
		preview.dataset.testid = "wikilink";
		dom.appendChild(preview);
		const label = document.createElement("span");
		label.className = "md-wikilink-view-label";
		label.contentEditable = "false";
		label.textContent = attrs.display || attrs.target;
		preview.appendChild(label);
		const contentDOM = document.createElement("span");
		contentDOM.className = "md-wikilink-view-content md-atom-view-content";
		dom.appendChild(contentDOM);
		return {
			dom,
			contentDOM,
			ignoreMutation: (mutation) => !contentDOM.contains(mutation.target)
		};
	};
}
/**
* Render `[[target]]`/`[[target|alias]]` as an immutable inline label (a mark
* view) standing in for the raw source. The single-caret-stop behavior comes
* from the shared `defineAtomMarkNavigation` in the editor extension, which
* treats `mdWikilink` (and `mdImage`) as one unit.
*/
function defineWikilink() {
	return defineMarkView({
		name: "mdWikilink",
		constructor: createWikilinkMarkView()
	});
}

//#endregion
//#region src/extensions/inline-text-to-mark-chunks.ts
/**
* Lookup from Lezer node type id to the ProseMirror mark.
*
* Notable absences:
* - `Link` / `Image` / `Autolink` are wrapper nodes; their syntax
*   characters are emitted by inner `LinkMark` / `URL` children and
*   handled here. Link text gets `mdLinkText` via `walkResolvedLink`.
* - `Escape` / `Entity` / `HardBreak` / `HTMLTag` / `LinkLabel` /
*   `Comment` etc. produce no mark for now - they render as plain text.
*/
const MARK_NAME_BY_TYPE_ID = /* @__PURE__ */ new Map([
	[LEZER_NODE_IDS.Emphasis, "mdEm"],
	[LEZER_NODE_IDS.StrongEmphasis, "mdStrong"],
	[LEZER_NODE_IDS.InlineCode, "mdCode"],
	[LEZER_NODE_IDS.Strikethrough, "mdDel"],
	[LEZER_NODE_IDS.Highlight, "mdHighlight"],
	[LEZER_NODE_IDS.EmphasisMark, "mdMark"],
	[LEZER_NODE_IDS.CodeMark, "mdMark"],
	[LEZER_NODE_IDS.LinkMark, "mdMark"],
	[LEZER_NODE_IDS.StrikethroughMark, "mdMark"],
	[LEZER_NODE_IDS.HighlightMark, "mdMark"],
	[LEZER_NODE_IDS.URL, "mdLinkUri"],
	[LEZER_NODE_IDS.LinkTitle, "mdLinkTitle"],
	[LEZER_NODE_IDS.Hashtag, "mdTag"],
	[LEZER_NODE_IDS.WikilinkMark, "mdMark"]
]);
/**
* Walk a textblock's inline content and produce a list of mark chunks
* with positions relative to the start of `text` (i.e. zero-based).
* Callers shift the chunks into the document's coordinate space.
*/
function inlineTextToMarkChunks(marks, text, options) {
	return inlineTextToMarkChunksWithContext(marks, text, options);
}
function inlineTextToMarkChunksWithContext(marks, text, options, context) {
	const elements = parseInline(text);
	const out = [];
	walk(elements, [], 0, text.length, text, marks, out, options, context);
	return out;
}
/** Drop the surrounding `"" '' ()` delimiters of a `LinkTitle` slice and unescape. */
function unquoteTitle(raw) {
	return raw.slice(1, -1).replaceAll(/\\(.)/g, "$1");
}
function walk(nodes, parentMarks, rangeStart, rangeEnd, text, marks, out, options, context) {
	let pos = rangeStart;
	for (let index = 0; index < nodes.length; index++) {
		const node = nodes[index];
		if (node.from > pos) emit(out, pos, node.from, parentMarks);
		if (node.type === LEZER_NODE_IDS.Image) {
			const trailing = takeMagicComment(node, nodes[index + 1], text);
			walkImage(node, parentMarks, text, marks, out, options, context, trailing);
			if (trailing) index++;
			pos = trailing ? trailing.to : node.to;
			continue;
		}
		walkNode(node, parentMarks, text, marks, out, options, context);
		pos = node.to;
	}
	if (pos < rangeEnd) emit(out, pos, rangeEnd, parentMarks);
}
function walkNode(node, parentMarks, text, marks, out, options, context) {
	switch (node.type) {
		case LEZER_NODE_IDS.Link: return walkLink(node, parentMarks, text, marks, out, options, context);
		case LEZER_NODE_IDS.Wikilink: return walkWikilink(node, parentMarks, text, marks, out);
		case LEZER_NODE_IDS.WikiEmbed: return walkWikiEmbed(node, parentMarks, text, marks, out, options);
		case LEZER_NODE_IDS.InlineMath: return walkMath(node, parentMarks, text, marks, out);
		case LEZER_NODE_IDS.URL: return walkURL(node, parentMarks, text, marks, out);
		default: return walkGenericNode(node, parentMarks, text, marks, out, options, context);
	}
}
/**
* A node with no source-backed atom of its own: it contributes its `mdPack` and
* syntax marks, then recurses into its children.
*/
function walkGenericNode(node, parentMarks, text, marks, out, options, context) {
	const type = node.type;
	let packKey;
	if (type === LEZER_NODE_IDS.Emphasis) packKey = "italic";
	else if (type === LEZER_NODE_IDS.StrongEmphasis) packKey = "bold";
	else if (type === LEZER_NODE_IDS.InlineCode) packKey = "code";
	else if (type === LEZER_NODE_IDS.Strikethrough) packKey = "strike";
	else if (type === LEZER_NODE_IDS.Highlight) packKey = "highlight";
	else if (type === LEZER_NODE_IDS.Autolink) packKey = "autolink";
	const base = packKey ? [...parentMarks, marks.mdPack.create({ key: packKey })] : parentMarks;
	const maybeMarkName = MARK_NAME_BY_TYPE_ID.get(type);
	const childMarks = maybeMarkName ? [...base, marks[maybeMarkName].create()] : base;
	if (node.children.length === 0) emit(out, node.from, node.to, childMarks);
	else walk(node.children, childMarks, node.from, node.to, text, marks, out, options, context);
}
/**
* A standalone `URL` node is a GFM autolink (the address part of a real
* `[text](url)` is handled inside `walkResolvedLink`, not here). Linkify the
* shapes we recognize; anything else keeps the muted `mdLinkUri`.
*/
function walkURL(node, parentMarks, text, marks, out) {
	const href = getAutolinkHref(text.slice(node.from, node.to));
	const mark = href ? marks.mdLinkText.create({ href }) : marks.mdLinkUri.create();
	emit(out, node.from, node.to, [...parentMarks, mark]);
}
function walkLink(node, parentMarks, text, marks, out, options, context) {
	const parts = scanLinkParts(node);
	const resolution = resolveLink(parts, text, context);
	if (resolution == null) {
		walkUnresolvedLink(node, parentMarks, text, marks, out, options, context);
		return;
	}
	const fileMarks = claimFileLink(parts, resolution, parentMarks, text, marks, options);
	if (fileMarks) {
		emit(out, node.from, node.to, fileMarks);
		return;
	}
	walkResolvedLink(node, parts, resolution, parentMarks, text, marks, out, options, context);
}
/**
* Locate the pieces of a `Link` node in Lezer's flat child list:
*   LinkMark `[`, [label children], LinkMark `]`, LinkMark `(`, URL,
*   optional LinkTitle, LinkMark `)`.
*/
function scanLinkParts(node) {
	let labelFrom = -1;
	let labelTo = -1;
	let urlNode = null;
	let titleNode = null;
	let referenceLabelNode = null;
	let bracketCount = 0;
	let linkMarkCount = 0;
	for (const child of node.children) {
		const childType = child.type;
		if (childType === LEZER_NODE_IDS.LinkMark) {
			linkMarkCount++;
			bracketCount++;
			if (bracketCount === 1) labelFrom = child.to;
			if (bracketCount === 2) labelTo = child.from;
		} else if (urlNode == null && childType === LEZER_NODE_IDS.URL) urlNode = child;
		else if (titleNode == null && childType === LEZER_NODE_IDS.LinkTitle) titleNode = child;
		else if (referenceLabelNode == null && childType === LEZER_NODE_IDS.LinkLabel) referenceLabelNode = child;
	}
	return {
		labelFrom,
		labelTo,
		urlNode,
		titleNode,
		referenceLabelNode,
		linkMarkCount
	};
}
function resolveLink(parts, text, context) {
	if (parts.linkMarkCount >= 3) return {
		href: parts.urlNode == null ? "" : text.slice(parts.urlNode.from, parts.urlNode.to),
		title: parts.titleNode == null ? "" : unquoteTitle(text.slice(parts.titleNode.from, parts.titleNode.to)),
		isReference: false
	};
	if (parts.labelFrom < 0 || parts.labelTo < 0) return;
	if (context?.isReferenceDefinition === true) return;
	const visibleLabel = text.slice(parts.labelFrom, parts.labelTo);
	const explicitLabel = parts.referenceLabelNode == null ? visibleLabel : text.slice(parts.referenceLabelNode.from + 1, parts.referenceLabelNode.to - 1) || visibleLabel;
	const key = normalizeReferenceLabel(explicitLabel);
	if (key === "") return;
	context?.referencedKeys?.add(key);
	const definition = context?.referenceDefinitions?.get(key);
	if (definition == null) return;
	return {
		href: definition.href,
		title: definition.title,
		isReference: true
	};
}
function walkUnresolvedLink(node, parentMarks, text, marks, out, options, context) {
	walk(node.children.filter((child) => {
		return child.type !== LEZER_NODE_IDS.LinkMark && child.type !== LEZER_NODE_IDS.LinkLabel;
	}), parentMarks, node.from, node.to, text, marks, out, options, context);
}
/** The last path segment of `href` (query/hash stripped), decoded when possible. */
function hrefBasename(href) {
	const path = href.split(/[?#]/, 1)[0];
	const segment = path.split(/[/\\]/).findLast(Boolean) ?? path;
	try {
		return decodeURIComponent(segment);
	} catch {
		return segment;
	}
}
/**
* The marks for a whole inline or resolved reference link that the host's `resolveFileLink`
* claimed as a file, or `undefined` when the link stays a regular link. The
* resolver is never consulted for a link without a closed label or a non-empty
* destination.
*/
function claimFileLink(parts, resolution, parentMarks, text, marks, options) {
	const resolveFileLink = options?.resolveFileLink;
	if (!resolveFileLink) return void 0;
	const { labelFrom, labelTo } = parts;
	if (labelFrom < 0 || labelTo < 0) return void 0;
	const { href, title } = resolution;
	if (!href) return void 0;
	const label = text.slice(labelFrom, labelTo);
	if (!resolveFileLink({
		href,
		label,
		title
	})) return void 0;
	const name = label || hrefBasename(href);
	return [...parentMarks, marks.mdFile.create({
		href,
		name,
		title
	})];
}
/**
* Special walker for `Link` nodes.
*
* Lezer's flat child list looks like:
*   LinkMark `[` (or `![`), [label children + implicit gaps], LinkMark `]`,
*   LinkMark `(`, URL, optional LinkTitle, LinkMark `)`.
*
* We first scan to locate the second `LinkMark` (the `]` that closes
* the label) and any `URL` node. Everything in the label range gets an
* extra `mdLinkText({ href })` mark; everything outside it falls
* through the regular per-child mark mapping (LinkMark -> mdMark,
* URL -> mdLinkUri).
*
* For Autolink / malformed link with no `]`, `labelEnd` stays at -1
* and the link-text logic stays inert - the walker still emits the
* outer syntax marks correctly.
*/
function walkResolvedLink(node, parts, resolution, parentMarks, text, marks, out, options, context) {
	const { labelTo: labelEnd } = parts;
	const { href, title, isReference } = resolution;
	const linkTextMark = marks.mdLinkText.create({ href });
	const inLabel = (pos) => labelEnd >= 0 && pos < labelEnd;
	const data = isReference ? {
		href,
		title,
		reference: true
	} : {
		href,
		title
	};
	const pack = marks.mdPack.create({
		key: "link",
		data
	});
	const base = [...parentMarks, pack];
	let pos = node.from;
	for (const child of node.children) {
		if (child.from > pos) {
			const childMarks = inLabel(pos) ? [...base, linkTextMark] : base;
			emit(out, pos, child.from, childMarks);
		}
		const baseForChild = inLabel(child.from) ? [...base, linkTextMark] : base;
		if (child.type === LEZER_NODE_IDS.Wikilink) {
			walkWikilink(child, baseForChild, text, marks, out);
			pos = child.to;
			continue;
		}
		if (child.type === LEZER_NODE_IDS.WikiEmbed) {
			walkWikiEmbed(child, baseForChild, text, marks, out, options);
			pos = child.to;
			continue;
		}
		if (child.type === LEZER_NODE_IDS.Image) {
			walkImage(child, baseForChild, text, marks, out, options, context);
			pos = child.to;
			continue;
		}
		if (isReference && child.type === LEZER_NODE_IDS.LinkLabel) {
			emit(out, child.from, child.to, [...baseForChild, marks.mdMark.create()]);
			pos = child.to;
			continue;
		}
		const maybeMarkName = MARK_NAME_BY_TYPE_ID.get(child.type);
		const childMarks = maybeMarkName ? [...baseForChild, marks[maybeMarkName].create()] : baseForChild;
		if (child.children.length === 0) emit(out, child.from, child.to, childMarks);
		else walk(child.children, childMarks, child.from, child.to, text, marks, out, options, context);
		pos = child.to;
	}
	if (pos < node.to) emit(out, pos, node.to, base);
}
function takeMagicComment(image, next, text) {
	if (!next || next.type !== LEZER_NODE_IDS.Comment || next.from !== image.to) return void 0;
	const magic = parseMagicComment(text.slice(next.from, next.to));
	if (!magic) return void 0;
	return {
		magic,
		to: next.to
	};
}
/**
* Special walker for a direct image `![alt](url)`.
*
* A `trailing` magic comment immediately after the image (e.g.
* `<!-- {"width":320} -->`) is folded into the mark range so it round-trips as
* source while supplying the image's `width`.
*/
function walkImage(node, parentMarks, text, marks, out, options, context, trailing) {
	const resolution = resolveLink(scanLinkParts(node), text, context);
	if (resolution == null) {
		walkUnresolvedLink(node, parentMarks, text, marks, out, options, context);
		if (trailing != null) emit(out, node.to, trailing.to, parentMarks);
		return;
	}
	const bracketNodes = node.children.filter((child) => child.type === LEZER_NODE_IDS.LinkMark);
	const src = resolution.href;
	const alt = bracketNodes.length >= 2 ? text.slice(bracketNodes[0].to, bracketNodes[1].from) : "";
	const title = resolution.title;
	const width = trailing?.magic.width ?? null;
	const height = trailing?.magic.height ?? null;
	const to = trailing?.to ?? node.to;
	emit(out, node.from, to, [...parentMarks, marks.mdImage.create({
		src,
		alt,
		title,
		width,
		height,
		syntax: null,
		wikiTarget: null
	})]);
}
/**
* Special walker for inline math `$formula$`/`$$formula$$`.
*
* The whole run carries `mdPack({key:'math'})` (so focus mode reveals it) and
* `mdMath({formula})` (so `MathMarkView` renders it); the dollar runs
* additionally carry `mdMark`, the shared syntax-character mark, so the
* existing hide/reveal CSS applies to them.
*/
function walkMath(node, parentMarks, text, marks, out) {
	const markNodes = node.children.filter((child) => child.type === LEZER_NODE_IDS.InlineMathMark);
	if (markNodes.length < 2) {
		emit(out, node.from, node.to, parentMarks);
		return;
	}
	const formula = text.slice(markNodes[0].to, markNodes[1].from);
	const base = [
		...parentMarks,
		marks.mdPack.create({ key: "math" }),
		marks.mdMath.create({ formula })
	];
	emit(out, node.from, markNodes[0].to, [...base, marks.mdMark.create()]);
	emit(out, markNodes[0].to, markNodes[1].from, base);
	emit(out, markNodes[1].from, node.to, [...base, marks.mdMark.create()]);
}
/**
* Special walker for a wikilink `[[target]]`/`[[target|alias]]`.
*/
function walkWikilink(node, parentMarks, text, marks, out) {
	const { target, display } = parseWikilink(text.slice(node.from, node.to));
	emit(out, node.from, node.to, [...parentMarks, marks.mdWikilink.create({
		target,
		display
	})]);
}
/**
* Resolve `![[target]]` into one of Meowdown's existing source-backed atoms.
* An absent resolver, ambiguity, or any other unresolved target deliberately
* emits plain source text so the embed remains literal and editable.
*/
function walkWikiEmbed(node, parentMarks, text, marks, out, options) {
	const embed = parseWikiEmbed(text.slice(node.from, node.to));
	const resolution = options?.resolveWikiEmbed?.(embed);
	if (!resolution) {
		emit(out, node.from, node.to, parentMarks);
		return;
	}
	if (resolution.kind === "image") {
		const src = resolution.src ?? embed.target;
		const alt = (resolution.alt ?? embed.display) || wikiEmbedBasename(embed.target);
		emit(out, node.from, node.to, [...parentMarks, marks.mdImage.create({
			src,
			alt,
			title: "",
			width: embed.width,
			height: embed.height,
			syntax: "wikiEmbed",
			wikiTarget: embed.target
		})]);
		return;
	}
	if (resolution.kind === "file") {
		const href = resolution.href ?? embed.target;
		const name = (resolution.name ?? embed.display) || wikiEmbedBasename(embed.target);
		emit(out, node.from, node.to, [...parentMarks, marks.mdFile.create({
			href,
			name,
			title: resolution.title ?? ""
		})]);
		return;
	}
	const target = resolution.target ?? embed.target;
	const display = resolution.display ?? embed.display;
	emit(out, node.from, node.to, [...parentMarks, marks.mdWikilink.create({
		target,
		display
	})]);
}
/**
* Push `[from, to, marks]` to `out`, coalescing with the previous chunk
* when both share the same mark set. Coalescing keeps the chunk list
* short, which matters for `BatchSetMarkStep.apply`'s per-chunk diff.
*/
function emit(out, from, to, marks) {
	if (from >= to) return;
	const last = out.at(-1);
	if (last && last[1] === from && marksEqual(last[2], marks)) {
		out[out.length - 1] = [
			last[0],
			to,
			last[2]
		];
		return;
	}
	out.push([
		from,
		to,
		marks
	]);
}

//#endregion
//#region src/extensions/inline-mark-plugin.ts
/**
* Inline-mark plugin
*
* Pipeline per dispatched transaction:
*
*   appendTransaction(transactions, oldState, newState)
*     -> bail if any source transaction came from us (META_KEY)
*     -> compute affected range from step maps (fall back to full doc)
*     -> walk participating textblocks (paragraph / heading etc.) inside that range
*     -> for each: text = node.textContent
*                  chunks = inlineTextToMarkChunks(getMarkBuildersForSchema(schema), text)
*     -> if chunks is non-empty: tr.step(new BatchSetMarkStep(chunks))
*                                  .setMeta(META_KEY, true)
*/
const META_KEY = "inline-marks-applied";
const TRIGGER_KEY = "inline-marks-trigger";
const RESTYLE_KEY = "inline-marks-restyle";
const RESTYLE_DEBOUNCE_MS = 200;
const pluginKey = new PluginKey("inline-mark");
const emptyReferenceKeys = /* @__PURE__ */ new Set();
/**
* Test instrumentation: `chunkCacheParses` / `chunkCacheHits` count
* parses we did and parses we avoided. Exposed via `getCacheStats` /
* `resetCacheStats` for spy tests; never read in production code.
*/
let chunkCacheParses = 0;
let chunkCacheHits = 0;
/**
* Compute the union of all position ranges touched by the given
* transactions, mapped into `newState.doc`'s coordinate space.
*
* Returns the full doc range when no ranges are available (e.g. an
* inert / no-op transaction used to wake the plugin up).
*/
function computeAffectedRange(transactions, newState) {
	let from = Infinity;
	let to = -Infinity;
	for (const tr of transactions) for (const map of tr.mapping.maps) map.forEach((_oldStart, _oldEnd, newStart, newEnd) => {
		if (newStart < from) from = newStart;
		if (newEnd > to) to = newEnd;
	});
	const docSize = newState.doc.content.size;
	if (from > to) return {
		from: 0,
		to: docSize
	};
	return {
		from: Math.max(0, from),
		to: Math.min(docSize, to)
	};
}
function createInlineMarkPlugin(options) {
	const chunkCache = /* @__PURE__ */ new WeakMap();
	function setsIntersect(left, right) {
		for (const value of left) if (right.has(value)) return true;
		return false;
	}
	function shiftChunks(chunks, offset) {
		const shifted = [];
		for (const [from, to, marks] of chunks) shifted.push([
			from + offset,
			to + offset,
			marks
		]);
		return shifted;
	}
	function chunksForTextblock(node, baseOffset, schema, references, changedKeys, isReferenceDefinition) {
		const cached = chunkCache.get(node);
		let relative;
		if (cached?.isReferenceDefinition === isReferenceDefinition && !setsIntersect(cached.referencedKeys, changedKeys)) {
			chunkCacheHits++;
			relative = cached.chunks;
		} else {
			chunkCacheParses++;
			const referencedKeys = /* @__PURE__ */ new Set();
			relative = inlineTextToMarkChunksWithContext(getMarkBuildersForSchema(schema), node.textContent, options, {
				referenceDefinitions: references.definitions,
				isReferenceDefinition,
				referencedKeys
			});
			chunkCache.set(node, {
				isReferenceDefinition,
				referencedKeys,
				chunks: relative
			});
		}
		if (baseOffset === 0) return relative;
		return shiftChunks(relative, baseOffset);
	}
	/**
	* Walk a doc range and collect mark chunks for every participating
	* textblock encountered.
	*
	* The walker uses `nodesBetween` which naturally recurses into
	* containers (blockquote, list, tableCell), so it picks up nested
	* textblocks without each container needing to be listed explicitly.
	*/
	function collectChunks(state, range, references, changedKeys) {
		const chunks = [];
		const processed = [];
		const visit = (node, pos, parent, index) => {
			if (node.type.spec.code) return false;
			if (!node.isTextblock) return true;
			if (node.childCount === 0) return false;
			const cached = chunkCache.get(node);
			const touchesRange = pos <= range.to && pos + node.nodeSize >= range.from;
			const dependsOnChange = cached == null || setsIntersect(cached.referencedKeys, changedKeys);
			if (!touchesRange && !dependsOnChange) return false;
			const nodeChunks = chunksForTextblock(node, pos + 1, state.schema, references, changedKeys, isReferenceDefinitionNode(node, parent, index));
			if (nodeChunks.length > 0) chunks.push(...nodeChunks);
			const updated = chunkCache.get(node);
			if (updated != null) processed.push({
				position: pos,
				cached: updated
			});
			return false;
		};
		if (changedKeys.size === 0) state.doc.nodesBetween(range.from, range.to, visit);
		else state.doc.descendants(visit);
		return {
			chunks,
			processed
		};
	}
	function transferCache(doc, processed) {
		for (const { position, cached } of processed) {
			const node = doc.nodeAt(position);
			if (node?.isTextblock) chunkCache.set(node, cached);
		}
	}
	return new Plugin({
		key: pluginKey,
		state: {
			init(_config, state) {
				return {
					references: collectReferenceDefinitions(state.doc),
					pendingReferenceKeys: emptyReferenceKeys
				};
			},
			apply(transaction, value, _oldState, newState) {
				if (transaction.getMeta(RESTYLE_KEY) === true) return value.pendingReferenceKeys.size === 0 ? value : {
					references: value.references,
					pendingReferenceKeys: emptyReferenceKeys
				};
				if (transaction.getMeta(META_KEY)) return value;
				const references = updateReferenceDefinitions(value.references, transaction, newState.doc);
				if (references === value.references) return value;
				const changedKeys = getChangedReferenceKeys(value.references.definitions, references.definitions);
				if (changedKeys.size === 0) return {
					references,
					pendingReferenceKeys: value.pendingReferenceKeys
				};
				return {
					references,
					pendingReferenceKeys: mergeReferenceKeys(value.pendingReferenceKeys, changedKeys)
				};
			}
		},
		appendTransaction(transactions, oldState, newState) {
			for (const tr of transactions) if (tr.getMeta(META_KEY)) return null;
			const restyle = transactions.some((transaction) => transaction.getMeta(RESTYLE_KEY));
			if (!(restyle || transactions.some((transaction) => {
				return transaction.docChanged || transaction.getMeta(TRIGGER_KEY);
			}))) return null;
			const references = pluginKey.getState(newState)?.references;
			if (references == null) return null;
			const changedKeys = restyle ? pluginKey.getState(oldState)?.pendingReferenceKeys ?? emptyReferenceKeys : emptyReferenceKeys;
			const { chunks, processed } = collectChunks(newState, restyle ? {
				from: 0,
				to: 0
			} : computeAffectedRange(transactions, newState), references, changedKeys);
			if (chunks.length === 0) return null;
			const tr = newState.tr.step(new BatchSetMarkStep(chunks));
			transferCache(tr.doc, processed);
			tr.setMeta(META_KEY, true);
			tr.setMeta("addToHistory", false);
			return tr;
		},
		view(view) {
			view.dispatch(triggerInlineMarks(view.state));
			let timer;
			const flush = (currentView) => {
				timer = void 0;
				if (currentView.isDestroyed) return;
				if ((pluginKey.getState(currentView.state)?.pendingReferenceKeys.size ?? 0) === 0) return;
				currentView.dispatch(currentView.state.tr.setMeta(RESTYLE_KEY, true));
			};
			return {
				update(currentView, previousState) {
					const current = pluginKey.getState(currentView.state);
					if ((current?.pendingReferenceKeys.size ?? 0) === 0) {
						if (timer != null) clearTimeout(timer);
						timer = void 0;
						return;
					}
					if (timer == null || pluginKey.getState(previousState) !== current) {
						if (timer != null) clearTimeout(timer);
						timer = setTimeout(() => flush(currentView), RESTYLE_DEBOUNCE_MS);
					}
				},
				destroy() {
					if (timer != null) clearTimeout(timer);
				}
			};
		}
	});
}
function triggerInlineMarks(state) {
	return state.tr.setMeta(TRIGGER_KEY, true);
}
function definitionsEqual(left, right) {
	return left?.href === right?.href && left?.title === right?.title;
}
function getChangedReferenceKeys(previous, current) {
	if (previous == null) return new Set(current.keys());
	const changed = /* @__PURE__ */ new Set();
	for (const [key, definition] of previous) if (!definitionsEqual(definition, current.get(key))) changed.add(key);
	for (const [key, definition] of current) if (!definitionsEqual(definition, previous.get(key))) changed.add(key);
	return changed;
}
function mergeReferenceKeys(previous, current) {
	if (previous.size === 0) return current;
	const merged = new Set(previous);
	for (const key of current) merged.add(key);
	return merged;
}
function defineInlineMarkPlugin(options) {
	return definePlugin(createInlineMarkPlugin(options));
}

//#endregion
//#region src/extensions/inline-marks.ts
function defineMdImage() {
	return defineMarkSpec({
		name: "mdImage",
		inclusive: false,
		attrs: {
			src: { default: "" },
			alt: { default: "" },
			title: { default: "" },
			width: { default: null },
			height: { default: null },
			syntax: { default: null },
			wikiTarget: { default: null }
		},
		toDOM: () => [
			"span",
			{ class: "md-image" },
			0
		],
		parseDOM: [{ tag: "span.md-image" }]
	});
}
/**
* Syntax characters: `*`, `_`, `` ` ``, `[`, `]`, `(`, `)`, `~`
*/
function defineMdMark() {
	return defineMarkSpec({
		name: "mdMark",
		inclusive: false,
		toDOM: () => [
			"span",
			{ class: "md-mark" },
			0
		],
		parseDOM: [{ tag: "span.md-mark" }]
	});
}
function defineMdEm() {
	return defineMarkSpec({
		name: "mdEm",
		toDOM: () => ["em", 0],
		parseDOM: [{ tag: "em" }]
	});
}
function defineMdStrong() {
	return defineMarkSpec({
		name: "mdStrong",
		toDOM: () => ["strong", 0],
		parseDOM: [{ tag: "strong" }]
	});
}
function defineMdCode() {
	return defineMarkSpec({
		name: "mdCode",
		toDOM: () => ["code", 0],
		parseDOM: [{ tag: "code" }]
	});
}
function defineMdLinkText() {
	return defineMarkSpec({
		name: "mdLinkText",
		inclusive: false,
		attrs: { href: { default: "" } },
		toDOM: (mark) => [
			"a",
			{
				class: "md-link",
				href: mark.attrs.href
			},
			0
		],
		parseDOM: [{
			tag: "a",
			getAttrs: (node) => {
				return { href: node.getAttribute("href") ?? "" };
			}
		}]
	});
}
function defineMdLinkUri() {
	return defineMarkSpec({
		name: "mdLinkUri",
		inclusive: false,
		toDOM: () => [
			"span",
			{ class: "md-link-uri" },
			0
		],
		parseDOM: [{ tag: "span.md-link-uri" }]
	});
}
function defineMdLinkTitle() {
	return defineMarkSpec({
		name: "mdLinkTitle",
		inclusive: false,
		toDOM: () => [
			"span",
			{ class: "md-link-title" },
			0
		],
		parseDOM: [{ tag: "span.md-link-title" }]
	});
}
function defineMdDel() {
	return defineMarkSpec({
		name: "mdDel",
		toDOM: () => ["del", 0],
		parseDOM: [{ tag: "del" }]
	});
}
function defineMdHighlight() {
	return defineMarkSpec({
		name: "mdHighlight",
		toDOM: () => ["mark", 0],
		parseDOM: [{ tag: "mark" }]
	});
}
/**
* Covers the whole `#tag`, `#` included: the `#` is tag content, not
* removable syntax, so it never carries `mdMark`.
*/
function defineMdTag() {
	return defineMarkSpec({
		name: "mdTag",
		toDOM: () => [
			"span",
			{ class: "md-tag" },
			0
		],
		parseDOM: [{ tag: "span.md-tag" }]
	});
}
/** Covers the whole `[[target]]`/`[[target|alias]]` source. */
function defineMdWikilink() {
	return defineMarkSpec({
		name: "mdWikilink",
		inclusive: false,
		attrs: {
			target: { default: "" },
			display: { default: "" }
		},
		toDOM: () => [
			"span",
			{ class: "md-wikilink" },
			0
		],
		parseDOM: [{ tag: "span.md-wikilink" }]
	});
}
function defineMdFile() {
	return defineMarkSpec({
		name: "mdFile",
		inclusive: false,
		attrs: {
			href: { default: "" },
			name: { default: "" },
			title: { default: "" }
		},
		toDOM: () => [
			"span",
			{ class: "md-file" },
			0
		],
		parseDOM: [{ tag: "span.md-file" }]
	});
}
/** Covers the whole `$formula$` source, dollars included. */
function defineMdMath() {
	return defineMarkSpec({
		name: "mdMath",
		inclusive: false,
		attrs: { formula: { default: "" } },
		toDOM: () => [
			"span",
			{ class: "md-math" },
			0
		],
		parseDOM: [{ tag: "span.md-math" }]
	});
}
/**
* Wraps a whole revealable inline unit (emphasis, strong, code, strikethrough,
* link, autolink, image) so focus mode can reveal the unit with one
* `getMarkRange` lookup instead of stitching its punctuation back together.
* `excludes: ''` lets nested units carry two of these marks at once.
*/
function defineMdPack() {
	return defineMarkSpec({
		name: "mdPack",
		excludes: "",
		inclusive: false,
		attrs: {
			key: {},
			data: { default: null }
		},
		toDOM: (mark) => {
			return [
				"span",
				{
					class: "md-pack",
					"data-key": mark.attrs.key
				},
				0
			];
		},
		parseDOM: [{ tag: "span.md-pack" }]
	});
}
function defineInlineMarks() {
	return union(defineMdMark(), defineMdEm(), defineMdStrong(), defineMdCode(), defineMdLinkText(), defineMdLinkUri(), defineMdLinkTitle(), defineMdDel(), defineMdHighlight(), defineMdTag(), defineMdWikilink(), defineMdImage(), defineMdFile(), defineMdMath(), defineMdPack());
}

//#endregion
//#region src/extensions/inline-toggle.ts
const TOGGLE_SPECS = {
	em: {
		node: LEZER_NODE_IDS.Emphasis,
		delim: "*"
	},
	strong: {
		node: LEZER_NODE_IDS.StrongEmphasis,
		delim: "**"
	},
	code: {
		node: LEZER_NODE_IDS.InlineCode,
		delim: "`"
	},
	del: {
		node: LEZER_NODE_IDS.Strikethrough,
		delim: "~~"
	},
	highlight: {
		node: LEZER_NODE_IDS.Highlight,
		delim: "=="
	}
};
const MARKER_IDS = /* @__PURE__ */ new Set([
	LEZER_NODE_IDS.EmphasisMark,
	LEZER_NODE_IDS.CodeMark,
	LEZER_NODE_IDS.LinkMark,
	LEZER_NODE_IDS.StrikethroughMark,
	LEZER_NODE_IDS.HighlightMark
]);
/** The opening and closing delimiter tokens of a toggleable node. */
function delimiters(node) {
	return [node.children[0], node.children.at(-1)];
}
/**
* The range between a node's delimiters where new inline syntax can
* nest, or `null` for atoms it cannot nest inside (code spans,
* autolinks, escapes, entities, raw HTML). For links and images only
* the label part is nestable; the URL part is part of the atom.
*/
function nestableContent(node) {
	const { type, children } = node;
	if (type === LEZER_NODE_IDS.Emphasis || type === LEZER_NODE_IDS.StrongEmphasis || type === LEZER_NODE_IDS.Strikethrough || type === LEZER_NODE_IDS.Highlight) return [children[0].to, children.at(-1).from];
	if (type === LEZER_NODE_IDS.Link || type === LEZER_NODE_IDS.Image) {
		const close = children.find((child, index) => index > 0 && child.type === LEZER_NODE_IDS.LinkMark);
		return close ? [children[0].to, close.from] : null;
	}
	return null;
}
/**
* Grow [from, to] until wrapping it cannot cut anything in half: every
* node is either fully engulfed, untouched, or cleanly contains the
* range inside its nestable content (then its children are checked).
* Straddling a boundary, or touching an atom's interior, swallows the
* node whole and restarts.
*/
function expandForWrap(nodes, from, to) {
	for (const node of nodes) {
		if (node.to <= from || node.from >= to) continue;
		if (from <= node.from && node.to <= to) continue;
		const content = nestableContent(node);
		if (content && content[0] <= from && to <= content[1]) return expandForWrap(node.children, from, to);
		return expandForWrap(nodes, Math.min(from, node.from), Math.max(to, node.to));
	}
	return [from, to];
}
/**
* Grow [from, to] to fully engulf every node it touches. Used when
* splitting a span: the leftover parts get re-wrapped in delimiters,
* so they must not cut through nested elements either.
*/
function engulf(nodes, from, to) {
	for (const node of nodes) {
		if (node.to <= from || node.from >= to) continue;
		if (from > node.from || node.to > to) return engulf(nodes, Math.min(from, node.from), Math.max(to, node.to));
	}
	return [from, to];
}
/** Shrink [from, to] so it starts and ends on non-whitespace. */
function trimRange(text, from, to) {
	while (from < to && isSpaceChar(text.charCodeAt(from))) from++;
	while (to > from && isSpaceChar(text.charCodeAt(to - 1))) to--;
	return [from, to];
}
/**
* Whether every position in [from, to) already renders with `spec`.
* Whitespace and delimiter tokens never count against it, so both
* `**a** **b**` and `***foo***` read as fully strong when selected.
*/
function isInlineActive(text, from, to, spec) {
	const tree = parseInline(text);
	const covered = collectInlineElements(tree, (node) => node.type === spec.node || MARKER_IDS.has(node.type));
	for (let pos = from; pos < to; pos++) {
		if (isSpaceChar(text.charCodeAt(pos))) continue;
		if (covered.every((span) => !(span.from <= pos && pos < span.to))) return false;
	}
	return true;
}
/**
* The edits that toggle `spec` over [from, to]. The range must be
* trimmed and non-empty. `remove` is the caller's block-wide decision:
* a multi-block toggle must apply one direction everywhere.
*/
function toggleInlineEdits(text, from, to, spec, remove) {
	const tree = parseInline(text);
	const spans = collectInlineElements(tree, (node) => node.type === spec.node);
	return remove ? removeEdits(text, spans, from, to) : addEdits(text, tree, spans, from, to, spec);
}
/**
* Wrap [from, to] in new delimiters. Existing same-type spans that
* overlap or touch the range are dissolved into the new one, because
* delimiter runs must not collide: Lezer reads `**a****b**` as a
* single strong with a literal `****` inside.
*/
function addEdits(text, tree, spans, from, to, spec) {
	for (let width = 0; width !== to - from;) {
		width = to - from;
		[from, to] = expandForWrap(tree, from, to);
		for (const span of spans) {
			if (span.to === from) from = span.from;
			if (span.from === to) to = span.to;
		}
	}
	const edits = [];
	for (const span of spans) if (from <= span.from && span.to <= to) {
		const [open, close] = delimiters(span);
		edits.push({
			from: open.from,
			to: open.to,
			insert: ""
		});
		edits.push({
			from: close.from,
			to: close.to,
			insert: ""
		});
	}
	const [open, close] = newDelimiters(text, from, to, edits, spec);
	edits.push({
		from,
		to: from,
		insert: open
	}, {
		from: to,
		to,
		insert: close
	});
	return edits;
}
/**
* Delimiters for a new span. Code needs care: the fence must out-run
* every backtick run left in the content, and content that starts or
* ends with a backtick needs space padding (CommonMark strips one
* leading and trailing space pair).
*/
function newDelimiters(text, from, to, deletions, spec) {
	if (spec.node !== LEZER_NODE_IDS.InlineCode) return [spec.delim, spec.delim];
	let content = text.slice(from, to);
	for (const deletion of [...deletions].sort((left, right) => right.from - left.from)) content = content.slice(0, deletion.from - from) + content.slice(deletion.to - from);
	const fence = "`".repeat(longestBacktickRun(content) + 1);
	const pad = content.startsWith("`") || content.endsWith("`") ? " " : "";
	return [fence + pad, pad + fence];
}
/**
* Strip `spec` spans from [from, to]. Parts of a span left outside the
* range stay formatted: its delimiters move inward, snapping past
* whitespace (a CommonMark delimiter cannot face a space) and around
* nested elements (a split must not cut them in half).
*/
function removeEdits(text, spans, from, to) {
	const edits = [];
	for (const span of spans) {
		if (span.to <= from || span.from >= to) continue;
		const [open, close] = delimiters(span);
		let stripFrom = Math.max(from, open.to);
		let stripTo = Math.min(to, close.from);
		if (stripFrom >= stripTo) [stripFrom, stripTo] = [open.to, close.from];
		[stripFrom, stripTo] = engulf(span.children.slice(1, -1), stripFrom, stripTo);
		while (stripFrom > open.to && isSpaceChar(text.charCodeAt(stripFrom - 1))) stripFrom--;
		while (stripTo < close.from && isSpaceChar(text.charCodeAt(stripTo))) stripTo++;
		if (stripFrom > open.to) edits.push({
			from: stripFrom,
			to: stripFrom,
			insert: text.slice(close.from, close.to)
		});
		else edits.push({
			from: open.from,
			to: open.to,
			insert: ""
		});
		if (stripTo < close.from) edits.push({
			from: stripTo,
			to: stripTo,
			insert: text.slice(open.from, open.to)
		});
		else edits.push({
			from: close.from,
			to: close.to,
			insert: ""
		});
	}
	return edits;
}
/**
* Caret toggles never edit existing spans; they reposition the caret
* or plant an empty delimiter pair for upcoming typing:
*
* - between an empty pair: delete the pair (undoes the toggle)
* - inside a span: hop just past it, so typing leaves the format
* - at a span's edge: hop just inside it, so typing extends it
* - inside an atom, or beside a delimiter character (the insert would
*   fuse with its run): `null`, meaning refuse
* - otherwise: insert `delim + delim` with the caret in the middle;
*   it becomes real formatting the moment content is typed
*/
function caretPlan(text, pos, spec) {
	const { delim } = spec;
	const len = delim.length;
	if (text.slice(pos - len, pos) === delim && text.startsWith(delim, pos) && text[pos - len - 1] !== delim[0] && text[pos + len] !== delim[0]) return {
		kind: "unwrap",
		from: pos - len,
		to: pos + len
	};
	const tree = parseInline(text);
	const span = collectInlineElements(tree, (node) => node.type === spec.node).findLast((candidate) => candidate.from <= pos && pos <= candidate.to);
	if (span) {
		const [open, close] = delimiters(span);
		return {
			kind: "move",
			pos: pos === span.from ? open.to : pos === span.to ? close.from : span.to
		};
	}
	if (insideAtom(tree, pos) || text[pos - 1] === delim[0] || text[pos] === delim[0]) return null;
	return {
		kind: "insert",
		pos
	};
}
/** Whether `pos` sits where inserted syntax could not parse: inside an atom or inside another span's delimiters. */
function insideAtom(nodes, pos) {
	for (const node of nodes) if (node.from < pos && pos < node.to) {
		const content = nestableContent(node);
		if (!content || pos < content[0] || pos > content[1]) return true;
		return insideAtom(node.children, pos);
	}
	return false;
}

//#endregion
//#region src/extensions/inline-toggle-commands.ts
function toggleInline(spec) {
	return (state, dispatch) => {
		if (state.selection.empty) return caretToggle(spec, state, dispatch);
		const { from, to, anchor, head } = state.selection;
		const segments = [];
		state.doc.nodesBetween(from, to, (node, pos) => {
			if (node.type.spec.code) return false;
			if (!node.isTextblock) return true;
			const text = node.textContent;
			const base = pos + 1;
			const [textFrom, textTo] = trimRange(text, Math.max(from - base, 0), Math.min(to - base, text.length));
			if (textFrom < textTo) segments.push({
				text,
				base,
				from: textFrom,
				to: textTo,
				active: isInlineActive(text, textFrom, textTo, spec)
			});
			return false;
		});
		const remove = segments.length > 0 && segments.every((segment) => segment.active);
		const edits = segments.filter((segment) => remove || !segment.active).flatMap((segment) => toggleInlineEdits(segment.text, segment.from, segment.to, spec, remove).map((edit) => ({
			from: edit.from + segment.base,
			to: edit.to + segment.base,
			insert: edit.insert
		})));
		if (edits.length === 0) return false;
		if (dispatch) {
			const tr = state.tr;
			edits.sort((left, right) => right.from - left.from || right.to - left.to);
			for (const edit of edits) if (edit.insert) tr.insertText(edit.insert, edit.from, edit.to);
			else tr.delete(edit.from, edit.to);
			tr.setSelection(TextSelection.create(tr.doc, tr.mapping.map(anchor, anchor <= head ? 1 : -1), tr.mapping.map(head, head < anchor ? 1 : -1)));
			dispatch(tr.scrollIntoView());
		}
		return true;
	};
}
function caretToggle(spec, state, dispatch) {
	const { $from } = state.selection;
	const block = $from.parent;
	if (!block.isTextblock || block.type.spec.code) return false;
	const plan = caretPlan(block.textContent, $from.parentOffset, spec);
	if (!plan) return false;
	if (dispatch) {
		const base = $from.start();
		const tr = state.tr;
		if (plan.kind === "unwrap") tr.delete(base + plan.from, base + plan.to);
		if (plan.kind === "move") tr.setSelection(TextSelection.create(tr.doc, base + plan.pos));
		if (plan.kind === "insert") {
			tr.insertText(spec.delim + spec.delim, base + plan.pos);
			tr.setSelection(TextSelection.create(tr.doc, base + plan.pos + spec.delim.length));
		}
		dispatch(tr.scrollIntoView());
	}
	return true;
}
function defineInlineToggleCommands() {
	return defineCommands({
		toggleEm: () => toggleInline(TOGGLE_SPECS.em),
		toggleStrong: () => toggleInline(TOGGLE_SPECS.strong),
		toggleCode: () => toggleInline(TOGGLE_SPECS.code),
		toggleDel: () => toggleInline(TOGGLE_SPECS.del),
		toggleHighlight: () => toggleInline(TOGGLE_SPECS.highlight)
	});
}
function defineInlineToggleKeymap() {
	return defineKeymap({
		"Mod-b": toggleInline(TOGGLE_SPECS.strong),
		"Mod-i": toggleInline(TOGGLE_SPECS.em),
		"Mod-e": toggleInline(TOGGLE_SPECS.code),
		"Mod-Shift-x": toggleInline(TOGGLE_SPECS.del),
		"Mod-Shift-h": toggleInline(TOGGLE_SPECS.highlight)
	});
}
function defineInlineToggle() {
	return union(defineInlineToggleCommands(), defineInlineToggleKeymap());
}

//#endregion
//#region src/extensions/get-link-unit-at.ts
/**
* The last text run carrying `markName` inside `range`. "Last" so a linked
* image's inner url/title (which comes first) never shadows the link's own.
*/
function lastMarkRunIn(state, range, markName) {
	let found;
	state.doc.nodesBetween(range.from, range.to, (node, nodePos) => {
		if (node.isText && node.marks.some((mark) => isMarkOfType(mark, markName))) found = {
			from: Math.max(nodePos, range.from),
			to: Math.min(nodePos + node.nodeSize, range.to)
		};
		return true;
	});
	return found;
}
/**
* The link covering `pos`, with its sub-ranges (`label`, `dest`) and parsed
* `href`/`title`. The single query the commands and the hover/click handlers
* share, replacing the old `findLinkAt`.
*
* Derived entirely from the marks already on the document (no re-parse): the
* `mdPack` unit gives the shape and carries the `href`/`title` in its `data`, and
* the `mdLinkUri` run locates the `( )` body.
*/
function getLinkUnitAt(state, pos) {
	const linkText = getMarkRangeAt(state, pos, "mdLinkText");
	const pack = getMarkRangeAt(state, pos, "mdPack", { key: "link" }) ?? getMarkRangeAt(state, pos, "mdPack", { key: "autolink" });
	const unit = pack ?? linkText;
	if (!unit) return;
	const packAttrs = pack?.mark.attrs;
	const href = (linkText?.mark.attrs)?.href ?? "";
	if (!pack || packAttrs?.key !== "link") {
		const unitRange = {
			from: unit.from,
			to: unit.to
		};
		return {
			unit: unitRange,
			text: packAttrs?.key === "autolink" ? lastMarkRunIn(state, unitRange, "mdLinkText") ?? {
				from: unit.from + 1,
				to: unit.to - 1
			} : unitRange,
			href,
			title: ""
		};
	}
	if (packAttrs.data.reference === true) {
		const text = linkText == null ? {
			from: unit.from,
			to: unit.to
		} : {
			from: linkText.from + 1,
			to: linkText.to
		};
		return {
			unit: {
				from: unit.from,
				to: unit.to
			},
			text,
			href: packAttrs.data.href,
			title: packAttrs.data.title
		};
	}
	const uri = lastMarkRunIn(state, unit, "mdLinkUri");
	const closeBracket = uri ? uri.from - 2 : unit.to - 3;
	const destFrom = uri ? uri.from : unit.to - 1;
	const label = {
		from: unit.from + 1,
		to: closeBracket
	};
	return {
		unit: {
			from: unit.from,
			to: unit.to
		},
		text: label,
		label,
		dest: {
			from: destFrom,
			to: unit.to - 1
		},
		href: packAttrs.data.href,
		title: packAttrs.data.title
	};
}

//#endregion
//#region src/extensions/link-commands.ts
/** Normalize a typed URL with the existing autolink logic, else keep it verbatim. */
function normalizeHref(raw) {
	const value = raw.trim();
	return value ? getAutolinkHref(value) ?? value : "";
}
/** The `( ... )` body for a link: the href plus an optional CommonMark title. */
function destText(href, title) {
	return href + (title ? ` "${title.replaceAll(/(["\\])/g, String.raw`\$1`)}"` : "");
}
/**
* The range a new link would wrap: the current selection when it is a
* non-empty text selection inside a single non-code textblock, trimmed of
* surrounding whitespace. `undefined` when there is nothing to wrap.
*/
function getWrapRange(state) {
	const { selection } = state;
	const { $from, $to, empty } = selection;
	if (empty || !$from.sameParent($to) || !isTextSelection(selection)) return;
	const block = $from.parent;
	if (!block.isTextblock || block.type.spec.code) return;
	const base = $from.start();
	const [from, to] = trimRange(block.textContent, $from.parentOffset, $to.parentOffset);
	if (from >= to) return;
	return {
		from: base + from,
		to: base + to
	};
}
function insertLink({ href, title, wrapText = true } = {}) {
	return (state, dispatch) => {
		const range = getWrapRange(state);
		if (!range) return false;
		if (dispatch) {
			const { from, to } = range;
			const tr = state.tr;
			const close = `](${destText(normalizeHref(href ?? ""), title ?? "")})`;
			tr.insertText(close, to).insertText("[", from);
			const linkTo = to + 1 + close.length;
			tr.setSelection(wrapText ? TextSelection.create(tr.doc, from, linkTo) : TextSelection.create(tr.doc, linkTo));
			tr.scrollIntoView();
			dispatch(tr);
		}
		return true;
	};
}
/** Rewrite the `( ... )` of the link at the caret/selection. */
function updateLink(attrs) {
	return (state, dispatch) => {
		const link = getLinkUnitAt(state, state.selection.from);
		if (!link?.dest) return false;
		const dest = destText(normalizeHref(attrs.href ?? link.href), attrs.title ?? link.title);
		if (dispatch) dispatch(state.tr.insertText(dest, link.dest.from, link.dest.to).scrollIntoView());
		return true;
	};
}
/** Unwrap the link at the caret: keep the label text, drop the syntax. */
function removeLink() {
	return (state, dispatch) => {
		const link = getLinkUnitAt(state, state.selection.from);
		if (!link?.label) return false;
		if (dispatch) dispatch(state.tr.delete(link.label.to, link.unit.to).delete(link.unit.from, link.label.from).scrollIntoView());
		return true;
	};
}
function defineLinkCommands() {
	return defineCommands({
		insertLink,
		updateLink,
		removeLink
	});
}
function openLinkEdit(onLinkEdit) {
	return (state, dispatch, view) => {
		const link = getLinkUnitAt(state, state.selection.from);
		if (link) {
			if (link.label == null || link.dest == null) return false;
			if (dispatch && view) {
				const { unit: { from, to } } = link;
				dispatch(state.tr.setSelection(TextSelection.create(state.doc, from, to)).scrollIntoView());
				view.focus();
				onLinkEdit({
					from,
					to,
					link
				});
			}
			return true;
		}
		const wrapRange = getWrapRange(state);
		if (wrapRange) {
			if (dispatch && view) {
				const { from, to } = wrapRange;
				dispatch(state.tr.setSelection(TextSelection.create(state.doc, from, to)).scrollIntoView());
				view.focus();
				onLinkEdit({
					from,
					to,
					link: void 0
				});
			}
			return true;
		}
		return false;
	};
}
function defineLinkEditKeymap(onLinkEdit) {
	return defineKeymap({ "Mod-k": openLinkEdit(onLinkEdit) });
}

//#endregion
//#region src/extensions/list.ts
function serializeListMarker(value) {
	return value === ")" || value === "*" || value === "+" ? value : void 0;
}
function serializeTaskMarker(value) {
	return value === "X" ? value : void 0;
}
function serializeMarkerGap(value) {
	return isValidMarkerGap(value) ? String(value) : void 0;
}
function defineListMarkerAttr() {
	return defineNodeAttr({
		type: "list",
		attr: "marker",
		default: null,
		splittable: true,
		toDOM: (value) => {
			const serialized = serializeListMarker(value);
			return serialized == null ? null : ["data-list-marker", serialized];
		},
		parseDOM: (node) => {
			const value = node.getAttribute("data-list-marker");
			if (value === ")" || value === "*" || value === "+") return value;
			else return null;
		}
	});
}
function defineListTaskMarkerAttr() {
	return defineNodeAttr({
		type: "list",
		attr: "taskMarker",
		default: null,
		splittable: true,
		toDOM: (value) => {
			const serialized = serializeTaskMarker(value);
			return serialized == null ? null : ["data-list-task-marker", serialized];
		},
		parseDOM: (node) => {
			return node.getAttribute("data-list-task-marker") === "X" ? "X" : null;
		}
	});
}
function isValidMarkerGap(value) {
	return value === 2 || value === 3 || value === 4;
}
function defineListMarkerGapAttr() {
	return defineNodeAttr({
		type: "list",
		attr: "markerGap",
		default: 1,
		splittable: true,
		toDOM: (value) => {
			const serialized = serializeMarkerGap(value);
			return serialized == null ? null : ["data-list-marker-gap", serialized];
		},
		parseDOM: (node) => {
			const value = Number.parseInt(node.getAttribute("data-list-marker-gap") ?? "", 10);
			return isValidMarkerGap(value) ? value : 1;
		}
	});
}
function getListClipboardAttributes(node) {
	const attrs = node.attrs;
	return {
		...defaultAttributesGetter(node),
		"data-list-marker": serializeListMarker(attrs.marker),
		"data-list-task-marker": serializeTaskMarker(attrs.taskMarker),
		"data-list-marker-gap": serializeMarkerGap(attrs.markerGap)
	};
}
/**
* Serialize copied lists as native `<ul>`/`<ol>` elements, mirroring ProseKit's
* `defineListSerializer`, but with an attribute getter that keeps meowdown's
* marker attrs, which `listToDOM`'s default getter drops. Without them, a round
* task `+ [ ]` copied or dragged into another editor turns into a square
* `- [ ]`.
*/
function defineMeowdownListSerializer() {
	return defineClipboardSerializer({
		serializeFragmentWrapper: (serializeFragment) => {
			return (...args) => {
				const dom = serializeFragment(...args);
				return normalizeElementTree(joinListElements(dom));
			};
		},
		serializeNodeWrapper: (serializeNode) => {
			return (...args) => {
				const dom = serializeNode(...args);
				return isElementLike(dom) ? normalizeElementTree(joinListElements(dom)) : dom;
			};
		},
		nodesFromSchemaWrapper: (nodesFromSchema) => {
			return (...args) => {
				return {
					...nodesFromSchema(...args),
					list: (node) => listToDOM({
						node,
						nativeList: true,
						getAttributes: getListClipboardAttributes
					})
				};
			};
		}
	});
}
function normalizeElementTree(node) {
	if (isElementLike(node)) normalizeTaskList(node);
	for (const child of node.children) normalizeElementTree(child);
	return node;
}
/**
* Modifies the DOM tree for task lists to ensure that the output HTML can be
* parsed by rehype-remark.
*/
function normalizeTaskList(node) {
	if (!node.classList.contains("prosemirror-flat-list") || node.getAttribute("data-list-kind") !== "task" || node.children.length !== 2) return;
	const marker = node.children.item(0);
	if (!marker || !marker.classList.contains("list-marker")) return;
	const checkbox = findCheckboxInListItem(marker);
	if (!checkbox) return;
	const content = node.children.item(1);
	if (!content || !content.classList.contains("list-content")) return;
	const textBlock = content.children.item(0);
	if (!textBlock || ![
		"P",
		"H1",
		"H2",
		"H3",
		"H4",
		"H5",
		"H6"
	].includes(textBlock.tagName)) return;
	node.replaceChildren(...content.children);
	textBlock.prepend(checkbox);
}
const listInputRules = [
	wrappingListInputRule(/^\s?([*-])\s$/, {
		kind: "bullet",
		collapsed: false
	}),
	wrappingListInputRule(/^\s?(\d+)\.\s$/, ({ match }) => {
		const text = match[1];
		const num = text ? parseInt(text, 10) : void 0;
		return {
			kind: "ordered",
			collapsed: false,
			order: num && num >= 2 && Number.isSafeInteger(num) ? num : null
		};
	}),
	wrappingListInputRule(/^\s?\[([\sX]?)\]\s$/i, ({ match }) => {
		return {
			kind: "task",
			checked: ["x", "X"].includes(match[1]),
			collapsed: false
		};
	}),
	wrappingListInputRule(/^\s?\+\s$/, {
		kind: "task",
		marker: "+",
		checked: false,
		collapsed: false
	})
];
function defineMeowdownListInputRules() {
	return union(listInputRules.map(defineInputRule));
}
/** Circle checkbox task: a `task` list item with a `+` marker. */
function wrapInCircleTask() {
	return wrapInList({
		kind: "task",
		marker: "+"
	});
}
/** Square checkbox task: a `task` list item with the canonical `-` marker. */
function wrapInSquareTask() {
	return wrapInList({
		kind: "task",
		marker: null
	});
}
/** The attributes of the closest list node enclosing the selection, if any. */
function getListAttrsAtSelection(state) {
	const { $from } = state.selection;
	for (let depth = $from.depth; depth > 0; depth--) {
		const node = $from.node(depth);
		if (isNodeOfType(node, "list")) return node.attrs;
	}
	return null;
}
/**
* Cycle the selected block between square and circle checkbox tasks.
*
* - A square task becomes a circle task, keeping its checked state;
* - A circle task becomes a square task, keeping its checked state;
* - Other content becomes an unchecked square task.
*/
function cycleCheckableList() {
	return (state, dispatch, view) => {
		const attrs = getListAttrsAtSelection(state);
		return (attrs?.kind !== "task" ? wrapInList({
			kind: "task",
			marker: null,
			checked: false
		}) : attrs.marker === "+" ? wrapInSquareTask() : wrapInCircleTask())(state, dispatch, view);
	};
}
/**
* Cycle the selected block between a bullet list, an ordered list, and no list.
*
* - A bullet list becomes an ordered list;
* - An ordered list unwraps;
* - Other content, including a task, becomes a bullet list.
*/
function cycleBulletOrderedList() {
	return (state, dispatch, view) => {
		const attrs = getListAttrsAtSelection(state);
		const next = attrs?.kind === "bullet" || attrs?.kind === "ordered" ? {
			kind: "ordered",
			marker: null,
			checked: false,
			collapsed: false
		} : {
			kind: "bullet",
			marker: null,
			checked: false,
			collapsed: false
		};
		return toggleList(next)(state, dispatch, view);
	};
}
function toggleListCollapsed() {
	return createToggleCollapsedCommand({ isToggleable: isCollapsibleBullet });
}
function defineMeowdownListCommands() {
	return defineCommands({
		cycleCheckableList,
		cycleBulletOrderedList,
		wrapInCircleTask,
		wrapInSquareTask,
		toggleListCollapsed
	});
}
/**
* Cycle the block under the cursor through the square checkbox task states:
* anything else -> unchecked square -> checked square -> bullet. (Mod-Enter)
*/
function rotateSquareTask() {
	return (state, dispatch, view) => {
		const attrs = getListAttrsAtSelection(state);
		const isSquare = attrs?.kind === "task" && attrs.marker !== "+";
		let next;
		if (isSquare && !attrs?.checked) next = {
			kind: "task",
			marker: attrs?.marker ?? null,
			checked: true
		};
		else if (isSquare && attrs?.checked) next = {
			kind: "bullet",
			marker: null,
			checked: false
		};
		else next = {
			kind: "task",
			marker: null,
			checked: false
		};
		return wrapInList(next)(state, dispatch, view);
	};
}
/**
* Cycle the block under the cursor through the circle checkbox task states:
* anything else -> unchecked circle -> checked circle -> bullet. (Mod-Shift-Enter)
*/
function rotateCircleTask() {
	return (state, dispatch, view) => {
		const attrs = getListAttrsAtSelection(state);
		const isCircle = attrs?.kind === "task" && attrs.marker === "+";
		let next;
		if (isCircle && !attrs?.checked) next = {
			kind: "task",
			marker: "+",
			checked: true
		};
		else if (isCircle && attrs?.checked) next = {
			kind: "bullet",
			marker: null,
			checked: false
		};
		else next = {
			kind: "task",
			marker: "+",
			checked: false
		};
		return wrapInList(next)(state, dispatch, view);
	};
}
/**
* A bullet is collapsible when it has descendants to hide: the first child is the
* item's own content and the rest (a nested list or extra blocks) collapse away.
* Only bullets fold in v1; their fold state round-trips through the `+` marker.
*/
function isCollapsibleBullet(node) {
	return isNodeOfType(node, "list") && node.attrs.kind === "bullet" && node.childCount >= 2 && node.firstChild?.type !== node.type;
}
/**
* Clicking a list marker toggles the checkbox on a task and the fold on a
* collapsible bullet; any other click is a no-op.
*/
const onListClick = (node) => {
	const attrs = node.attrs;
	if (attrs.kind === "task") return {
		...attrs,
		checked: !attrs.checked
	};
	if (isCollapsibleBullet(node)) return {
		...attrs,
		collapsed: !attrs.collapsed
	};
	return attrs;
};
/**
* The list plugins, mirroring ProseKit's `defineListPlugins` but with a marker
* mousedown handler that also folds bullets. ProseKit's default handler swallows
* every marker click, so it must be replaced rather than layered on top.
*/
function defineMeowdownListPlugins() {
	return definePlugin(() => [
		new Plugin({ props: { handleDOMEvents: { mousedown: (view, event) => handleListMarkerMouseDown({
			view,
			event,
			onListClick
		}) } } }),
		createListRenderingPlugin(),
		new Plugin({ props: { transformCopied: unwrapListSlice } }),
		createSafariInputMethodWorkaroundPlugin()
	]);
}
function defineMeowdownListKeymap() {
	return defineKeymap({
		"Mod-Enter": rotateSquareTask(),
		"Mod-Shift-Enter": rotateCircleTask(),
		"Mod-.": createToggleCollapsedCommand({ isToggleable: isCollapsibleBullet }),
		"Mod-Shift-7": toggleList({
			kind: "ordered",
			collapsed: false
		}),
		"Mod-Shift-8": toggleList({
			kind: "bullet",
			collapsed: false
		}),
		"Mod-Shift-9": toggleList({
			kind: "task",
			checked: false,
			collapsed: false
		})
	});
}
function defineMeowdownList() {
	return union(defineListSpec(), defineMeowdownListPlugins(), defineListKeymap(), defineListCommands(), defineMeowdownListSerializer(), defineListDropIndicator(), defineMeowdownListInputRules(), defineMeowdownListKeymap(), defineListMarkerAttr(), defineListTaskMarkerAttr(), defineListMarkerGapAttr(), defineMeowdownListCommands());
}

//#endregion
//#region src/utils/katex.ts
let katexRenderPromise;
/**
* Load KaTeX's render function on first use and cache it. Most documents
* contain no math, so the library stays out of the initial bundle.
*/
function loadKaTeX() {
	katexRenderPromise ??= import("./katex-chunk-CfdGokmi.js").then((module) => module.render);
	return katexRenderPromise;
}
/**
* Render TeX into `element` as native MathML (no KaTeX stylesheet or fonts
* required). `throwOnError: false` renders parse errors as red text; the
* catch covers the rare non-parse error so a bad formula can never crash a
* render.
*/
function renderMathInto(katexRender, element, formula, displayMode) {
	try {
		katexRender(formula, element, {
			displayMode,
			throwOnError: false,
			output: "mathml"
		});
	} catch (error) {
		element.textContent = String(error);
	}
}

//#endregion
//#region src/extensions/math.ts
/**
* Renders one inline math unit: a KaTeX preview next to the editable
* `$formula$` source. CSS decides which of the two is visible; in hide and
* focus modes the source collapses (`font-size: 0`) and the preview shows,
* unless the caret is inside the unit (the `.show` reveal decoration), which
* flips it back.
*/
var MathMarkView = class {
	#dom;
	#contentDOM;
	#preview;
	#formula;
	constructor(mark, view) {
		this.#formula = mark.attrs.formula;
		this.#dom = document.createElement("span");
		this.#dom.className = "md-math-view";
		this.#preview = document.createElement("span");
		this.#preview.className = "md-math-view-preview";
		this.#preview.dataset.testid = "math-preview";
		this.#preview.contentEditable = "false";
		this.#preview.addEventListener("mousedown", (event) => {
			event.preventDefault();
			const pos = view.posAtDOM(this.#contentDOM, 0);
			if (pos < 0) return;
			const selection = TextSelection.near(view.state.doc.resolve(pos), 1);
			view.dispatch(view.state.tr.setSelection(selection));
			view.focus();
		});
		this.#contentDOM = document.createElement("span");
		this.#contentDOM.className = "md-math-view-content";
		this.#dom.appendChild(this.#preview);
		this.#dom.appendChild(this.#contentDOM);
		this.#render();
	}
	get dom() {
		return this.#dom;
	}
	get contentDOM() {
		return this.#contentDOM;
	}
	update(mark) {
		const next = mark.attrs.formula;
		if (next !== this.#formula) {
			this.#formula = next;
			this.#render();
		}
		return true;
	}
	ignoreMutation(mutation) {
		return !this.#contentDOM.contains(mutation.target);
	}
	#render() {
		const formula = this.#formula;
		loadKaTeX().then((katex) => {
			if (formula !== this.#formula) return;
			renderMathInto(katex, this.#preview, formula, false);
		});
	}
};
/** Inline math rendering: a KaTeX preview on the `mdMath` mark. */
function defineMath() {
	return defineMarkView({
		name: "mdMath",
		constructor: (mark, view) => new MathMarkView(mark, view)
	});
}

//#endregion
//#region src/extensions/table-column-align.ts
function parseTableColumnAlign(value) {
	return value === "left" || value === "center" || value === "right" ? value : null;
}
function defineTableCellAlignAttr() {
	return defineNodeAttr({
		type: "tableCell",
		attr: "align",
		default: null,
		toDOM: (value) => value ? ["data-align", value] : null,
		parseDOM: (node) => parseTableColumnAlign(node.getAttribute("data-align"))
	});
}
function defineTableHeaderCellAlignAttr() {
	return defineNodeAttr({
		type: "tableHeaderCell",
		attr: "align",
		default: null,
		toDOM: (value) => value ? ["data-align", value] : null,
		parseDOM: (node) => parseTableColumnAlign(node.getAttribute("data-align"))
	});
}
/**
* The row whose `align` attrs define the column alignment of the whole table:
* the header row, or the first row of a headerless table. Matches the row the
* serializer reads when it writes the delimiter row.
*/
function findAlignmentRowIndex(table) {
	for (let rowIndex = 0; rowIndex < table.childCount; rowIndex++) {
		const row = table.child(rowIndex);
		for (let column = 0; column < row.childCount; column++) if (isNodeOfType(row.child(column), "tableHeaderCell")) return rowIndex;
	}
	return 0;
}
function findAlignmentRow(table) {
	return table.child(findAlignmentRowIndex(table));
}
function getCellAlign(row, column) {
	if (column >= row.childCount) return null;
	return row.child(column).attrs.align ?? null;
}
function syncTableAligns(table, tablePos, tr) {
	if (table.childCount === 0) return;
	const alignmentRow = findAlignmentRow(table);
	let rowPos = tablePos + 1;
	for (let rowIndex = 0; rowIndex < table.childCount; rowIndex++) {
		const row = table.child(rowIndex);
		let cellPos = rowPos + 1;
		for (let column = 0; column < row.childCount; column++) {
			const cell = row.child(column);
			const align = getCellAlign(alignmentRow, column);
			if ((cell.attrs.align ?? null) !== align) tr.setNodeMarkup(cellPos, void 0, {
				...cell.attrs,
				align
			});
			cellPos += cell.nodeSize;
		}
		rowPos += row.nodeSize;
	}
}
/**
* The union of changed ranges across `transactions`, in the coordinates of the
* final document.
*/
function unionOfChangedRanges(transactions) {
	let from;
	let to;
	for (const transaction of transactions) {
		if (!transaction.docChanged) continue;
		if (from != null && to != null) {
			from = transaction.mapping.map(from, -1);
			to = transaction.mapping.map(to, 1);
		}
		const mapping = transaction.mapping;
		for (const [index, stepMap] of mapping.maps.entries()) {
			const remaining = mapping.slice(index + 1);
			stepMap.forEach((_oldStart, _oldEnd, newStart, newEnd) => {
				const start = remaining.map(newStart, -1);
				const end = remaining.map(newEnd, 1);
				from = from == null ? start : Math.min(from, start);
				to = to == null ? end : Math.max(to, end);
			});
		}
	}
	if (from == null || to == null) return void 0;
	return {
		from,
		to
	};
}
function createTableAlignSyncPlugin() {
	return new Plugin({
		key: new PluginKey("table-align-sync"),
		appendTransaction(transactions, _oldState, newState) {
			if (!transactions.some((transaction) => transaction.docChanged)) return;
			const range = unionOfChangedRanges(transactions);
			if (!range) return;
			const doc = newState.doc;
			const from = Math.max(0, Math.min(range.from, doc.content.size));
			const to = Math.max(from, Math.min(range.to, doc.content.size));
			let tr;
			doc.nodesBetween(from, to, (node, pos) => {
				if (!isNodeOfType(node, "table")) return true;
				tr ??= newState.tr;
				syncTableAligns(node, pos, tr);
				return false;
			});
			return tr?.docChanged ? tr : void 0;
		}
	});
}
function defineTableAlignSync() {
	return definePlugin(createTableAlignSyncPlugin());
}
/**
* The table and column range the selection acts on. Cells are always 1x1 in a
* GFM table, so a cell's index within its row is its column index.
*/
function findSelectedColumns(state) {
	const { selection } = state;
	if (isCellSelection(selection)) {
		const { $anchorCell, $headCell } = selection;
		const tableDepth = $anchorCell.depth - 1;
		const anchorColumn = $anchorCell.index();
		const headColumn = $headCell.index();
		return {
			table: $anchorCell.node(tableDepth),
			tablePos: $anchorCell.before(tableDepth),
			firstColumn: Math.min(anchorColumn, headColumn),
			lastColumn: Math.max(anchorColumn, headColumn)
		};
	}
	const { $from } = selection;
	for (let depth = $from.depth; depth > 2; depth--) {
		const name = $from.node(depth).type.name;
		if (name === "tableCell" || name === "tableHeaderCell") {
			const column = $from.index(depth - 1);
			return {
				table: $from.node(depth - 2),
				tablePos: $from.before(depth - 2),
				firstColumn: column,
				lastColumn: column
			};
		}
	}
}
/**
* Set the column alignment of every column the selection touches. Writes only
* the alignment row's cells; the align sync plugin copies the value to the
* data cells in the same dispatch. Pass null to reset a column to the
* unaligned `---` delimiter.
*/
function setTableColumnAlign(align) {
	return (state, dispatch) => {
		const selected = findSelectedColumns(state);
		if (!selected || selected.table.childCount === 0) return false;
		if (dispatch) {
			const { table, tablePos, firstColumn, lastColumn } = selected;
			const rowIndex = findAlignmentRowIndex(table);
			let rowPos = tablePos + 1;
			for (let i = 0; i < rowIndex; i++) rowPos += table.child(i).nodeSize;
			const row = table.child(rowIndex);
			const tr = state.tr;
			let cellPos = rowPos + 1;
			for (let column = 0; column < row.childCount; column++) {
				const cell = row.child(column);
				if (column >= firstColumn && column <= lastColumn && (cell.attrs.align ?? null) !== align) tr.setNodeMarkup(cellPos, void 0, {
					...cell.attrs,
					align
				});
				cellPos += cell.nodeSize;
			}
			dispatch(tr);
		}
		return true;
	};
}
/**
* The column alignment of the table column the selection sits in, or
* undefined when the selection is outside a table or the column has no
* alignment.
*/
function getTableColumnAlign(state) {
	const selected = findSelectedColumns(state);
	if (!selected || selected.table.childCount === 0) return void 0;
	return getCellAlign(findAlignmentRow(selected.table), selected.lastColumn) ?? void 0;
}
function defineTableColumnAlignCommands() {
	return defineCommands({ setTableColumnAlign });
}
function defineTableColumnAlign() {
	return union(defineTableCellAlignAttr(), defineTableHeaderCellAlignAttr(), defineTableAlignSync(), defineTableColumnAlignCommands());
}

//#endregion
//#region src/extensions/table.ts
/**
* Whether the selection sits inside a table cell (data or header). Useful for
* gating block-creating UI, since cells hold inline content only.
*/
function isSelectionInTableCell(state) {
	const { $from } = state.selection;
	for (let depth = $from.depth; depth > 0; depth--) {
		const name = $from.node(depth).type.name;
		if (name === "tableCell" || name === "tableHeaderCell") return true;
	}
	return false;
}
const CELL_CONTENT = "paragraph";
function defineTableCellContent() {
	return union(defineNodeSpec({
		name: "tableCell",
		content: CELL_CONTENT
	}), defineNodeSpec({
		name: "tableHeaderCell",
		content: CELL_CONTENT
	}));
}
const deleteTableOnFullCellSelection = (state, dispatch) => {
	const { selection } = state;
	if (!isCellSelection(selection)) return false;
	if (!selection.isColSelection() || !selection.isRowSelection()) return false;
	return deleteTable(state, dispatch);
};
function defineTableKeymap() {
	return withPriority$1(defineKeymap({
		Backspace: deleteTableOnFullCellSelection,
		Delete: deleteTableOnFullCellSelection
	}), Priority$1.high);
}
function defineTable() {
	return union(defineTableSpec(), defineTableRowSpec(), defineTableCellSpec(), defineTableHeaderCellSpec(), defineTableCellContent(), defineTableColumnAlign(), defineTableEditingPlugin({ allowTableNodeSelection: true }), defineTableCommands(), defineTableDropIndicator(), defineTableKeymap());
}

//#endregion
//#region src/extensions/move-block.ts
/**
* The index of the top-level block holding the whole selection, or undefined
* when the selection spans several top-level blocks or floats between them (a
* gap cursor or a select-all).
*/
function getTopLevelIndex(state) {
	const { selection } = state;
	const { $from, $to } = selection;
	if (isNodeSelection(selection) && $from.depth === 0) return $from.index(0);
	if ($from.depth > 0 && $to.depth > 0 && $from.index(0) === $to.index(0)) return $from.index(0);
}
/**
* Swaps the top-level block holding the selection with its previous (`-1`) or
* next (`1`) sibling, keeping the selection inside the moved block. Inside a
* table cell it does nothing: rows have their own structure, and a cell's
* text should not drag the whole table around.
*/
function swapTopLevelBlock(direction) {
	return (state, dispatch) => {
		if (isSelectionInTableCell(state)) return false;
		const index = getTopLevelIndex(state);
		if (index == null) return false;
		const target = index + direction;
		if (target < 0 || target >= state.doc.childCount) return false;
		if (dispatch) {
			const { selection } = state;
			const first = Math.min(index, target);
			const start = selection.$from.posAtIndex(first, 0);
			const a = state.doc.child(first);
			const b = state.doc.child(first + 1);
			const tr = state.tr.replaceWith(start, start + a.nodeSize + b.nodeSize, [b, a]);
			const delta = direction === -1 ? -a.nodeSize : b.nodeSize;
			const next = isNodeSelection(selection) ? NodeSelection.create(tr.doc, selection.from + delta) : TextSelection.create(tr.doc, selection.anchor + delta, selection.head + delta);
			tr.setSelection(next);
			dispatch(tr.scrollIntoView());
		}
		return true;
	};
}
/**
* Moves the list item under the selection (with its nested children) up or
* down; outside a list, moves the whole top-level block instead, so the
* shortcut behaves uniformly across the document.
*/
function moveBlock(direction) {
	return (state, dispatch, view) => {
		return moveList(direction)(state, dispatch, view) || swapTopLevelBlock(direction === "up" ? -1 : 1)(state, dispatch, view);
	};
}
/**
* Binds `Alt-ArrowUp` / `Alt-ArrowDown` to move the list item or block under
* the selection. Alt-arrow combos produce no printable character, so they are
* safe on non-US layouts.
*/
function defineMoveBlock() {
	return defineKeymap({
		"Alt-ArrowUp": moveBlock("up"),
		"Alt-ArrowDown": moveBlock("down")
	});
}

//#endregion
//#region src/extensions/pending-replacement.ts
const pendingReplacementKey = new PluginKey("meowdownPendingReplacement");
/** The active pending replacement, or null when there is none. */
function getPendingReplacement(state) {
	return pendingReplacementKey.getState(state)?.pending ?? null;
}
function applyMeta(meta, value) {
	switch (meta.type) {
		case "start": return { pending: {
			from: meta.from,
			to: meta.to,
			mode: meta.mode,
			text: ""
		} };
		case "append":
			if (!value.pending) return value;
			return { pending: {
				...value.pending,
				text: value.pending.text + meta.text
			} };
		case "accept":
			if (!value.pending) return value;
			return {
				pending: null,
				ended: {
					pending: value.pending,
					outcome: "accepted"
				}
			};
		case "discard":
			if (!value.pending) return value;
			return {
				pending: null,
				ended: {
					pending: value.pending,
					outcome: "discarded"
				}
			};
	}
}
const pendingReplacementPlugin = new Plugin({
	key: pendingReplacementKey,
	state: {
		init: () => ({ pending: null }),
		apply: (tr, value) => {
			const meta = tr.getMeta(pendingReplacementKey);
			if (meta) return applyMeta(meta, value);
			if (tr.docChanged && value.pending) {
				const fromResult = tr.mapping.mapResult(value.pending.from, 1);
				const toResult = tr.mapping.mapResult(value.pending.to, -1);
				const from = Math.min(fromResult.pos, toResult.pos);
				const to = Math.max(fromResult.pos, toResult.pos);
				if ((fromResult.deletedAfter && toResult.deletedBefore || from >= to) && value.pending.mode === "replace") return {
					pending: null,
					ended: {
						pending: value.pending,
						outcome: "discarded"
					}
				};
				return { pending: {
					...value.pending,
					from,
					to
				} };
			}
			return value;
		}
	},
	props: { decorations: (state) => {
		const pending = getPendingReplacement(state);
		if (!pending || pending.from >= pending.to) return null;
		return DecorationSet.create(state.doc, [Decoration.inline(pending.from, pending.to, { class: "md-pending-replacement" })]);
	} }
});
function startPendingReplacement(options) {
	return (state, dispatch) => {
		const { from, to, mode } = options;
		if (from < 0 || to > state.doc.content.size || from > to) return false;
		if (from === to && mode === "replace") return false;
		dispatch?.(state.tr.setMeta(pendingReplacementKey, {
			type: "start",
			from,
			to,
			mode
		}));
		return true;
	};
}
function appendPendingReplacementText(text) {
	return (state, dispatch) => {
		if (!getPendingReplacement(state)) return false;
		dispatch?.(state.tr.setMeta(pendingReplacementKey, {
			type: "append",
			text
		}));
		return true;
	};
}
function discardPendingReplacement() {
	return (state, dispatch) => {
		if (!getPendingReplacement(state)) return false;
		dispatch?.(state.tr.setMeta(pendingReplacementKey, { type: "discard" }));
		return true;
	};
}
function acceptPendingReplacement(options = {}) {
	return (state, dispatch) => {
		const pending = getPendingReplacement(state);
		if (!pending || !pending.text.trim()) return false;
		if (dispatch) {
			const mode = options.mode ?? pending.mode;
			const nodes = getNodeBuildersForSchema(state.schema);
			const parsed = markdownToDoc(pending.text, { nodes });
			const tr = state.tr;
			tr.setMeta(pendingReplacementKey, { type: "accept" });
			if (mode === "append") {
				const insertPos = state.doc.resolve(pending.to).after(1);
				tr.insert(insertPos, parsed.content);
				tr.setSelection(TextSelection.near(tr.doc.resolve(insertPos + parsed.content.size), -1));
			} else {
				const $from = state.doc.resolve(pending.from);
				const $to = state.doc.resolve(pending.to);
				const paragraph = parsed.childCount === 1 ? parsed.firstChild : null;
				if (paragraph != null && isNodeOfType(paragraph, "paragraph") && $from.sameParent($to) && $from.parent.isTextblock) {
					tr.replaceWith(pending.from, pending.to, paragraph.content);
					tr.setSelection(TextSelection.near(tr.doc.resolve(pending.from + paragraph.content.size), -1));
				} else {
					tr.replaceRange(pending.from, pending.to, new Slice(parsed.content, 0, 0));
					tr.setSelection(TextSelection.near(tr.doc.resolve(tr.mapping.map(pending.to)), -1));
				}
			}
			dispatch(tr.scrollIntoView());
		}
		return true;
	};
}
function definePendingReplacementCommands() {
	return defineCommands({
		startPendingReplacement,
		appendPendingReplacementText,
		acceptPendingReplacement,
		discardPendingReplacement
	});
}
/** Accept on Mod-Enter and discard on Escape, only while a replacement is pending. */
function definePendingReplacementKeymap() {
	return defineKeymap({
		"Mod-Enter": acceptPendingReplacement(),
		Escape: discardPendingReplacement()
	});
}
/**
* The pending-replacement primitive: staged Markdown over a source range,
* previewed without touching the document. `startPendingReplacement` stages a
* range (restarting resets the accumulated text, which is how a retry begins),
* `appendPendingReplacementText` accumulates streamed text,
* `acceptPendingReplacement` applies the result as one transaction — inline
* when a single-paragraph result lands inside one textblock, as blocks
* otherwise — and `discardPendingReplacement` clears the stage without a
* document change. Other edits remap the staged range; a replace stage whose
* source range is deleted is discarded.
*/
function definePendingReplacement() {
	return union(definePlugin(pendingReplacementPlugin), definePendingReplacementCommands(), definePendingReplacementKeymap());
}
/**
* Watches pending-replacement state and reports changes, so a UI layer can
* render the preview and know whether the stage was accepted or discarded.
*/
function definePendingReplacementHandler(handler) {
	return definePlugin(new Plugin({ view: () => ({ update: (view, prevState) => {
		const prev = pendingReplacementKey.getState(prevState);
		const next = pendingReplacementKey.getState(view.state);
		if (!next || prev === next) return;
		if (next.pending) {
			if (next.pending !== prev?.pending) handler({
				type: "update",
				pending: next.pending
			});
		} else if (next.ended && next.ended !== prev?.ended) handler({
			type: "ended",
			pending: next.ended.pending,
			outcome: next.ended.outcome
		});
	} }) }));
}

//#endregion
//#region src/utils/caret-coords.ts
/**
* A dimensionless point: the fallback measurement of a hidden (font-size: 0)
* syntax run. A real caret rect always has line height, and a block-context
* line always has width. WebKit reports the point at the origin, Blink and
* Gecko at the run's baseline.
*/
function isPointRect(rect) {
	return rect.left === rect.right && rect.top === rect.bottom;
}
/**
* `view.coordsAtPos` that returns undefined instead of throwing on an
* out-of-range position or returning a point rect. A position whose `side`
* neighbor is hidden markdown syntax has no visible box on that side and
* measures as a bogus dimensionless point.
*/
function tryCoordsAtPos(view, pos, side) {
	if (pos < 0 || pos > view.state.doc.content.size) return void 0;
	let coords;
	try {
		coords = view.coordsAtPos(pos, side);
	} catch {
		return;
	}
	return isPointRect(coords) ? void 0 : coords;
}

//#endregion
//#region src/extensions/caret-rect.ts
function findNativeCaretRect(view) {
	const selection = view.dom.ownerDocument.getSelection();
	if (selection == null || selection.rangeCount === 0) return void 0;
	if (!view.dom.contains(selection.anchorNode)) return void 0;
	const range = selection.getRangeAt(0).cloneRange();
	range.collapse(true);
	const rects = Array.from(range.getClientRects()).filter((rect) => rect.height > 0);
	if (rects.length === 0) return void 0;
	const rect = rects[rects.length - 1];
	return {
		left: rect.left,
		top: rect.top,
		height: rect.height
	};
}
function findCoordsCaretRect(view) {
	const state = view.state;
	const head = state.selection.head;
	const runBefore = getHiddenRunBefore(state, head);
	const runAfter = getHiddenRunAfter(state, head);
	const $head = state.doc.resolve(head);
	const afterLineBreak = $head.parentOffset > 0 && $head.parent.textBetween($head.parentOffset - 1, $head.parentOffset) === "\n";
	const preferredBeforeSide = runBefore == null && !afterLineBreak;
	const probes = [[head, preferredBeforeSide], [head, !preferredBeforeSide]];
	if (runBefore != null) probes.push([runBefore.from, true]);
	if (runAfter != null) probes.push([runAfter.to, false]);
	for (const [pos, beforeSide] of probes) {
		const coords = tryCoordsAtPos(view, pos, beforeSide ? -1 : 1);
		if (coords != null && coords.bottom > coords.top) return {
			left: coords.left,
			top: coords.top,
			height: coords.bottom - coords.top
		};
	}
}
function findAtomCaretRect(view) {
	const state = view.state;
	const head = state.selection.head;
	for (const markName of ATOM_SOURCE_MARK_NAMES) {
		const range = getMarkRangeAt(state, head, markName);
		if (range == null || range.from !== head && range.to !== head) continue;
		const preview = findAtomPreviewElement(view, range.from + 1);
		if (preview == null) continue;
		const fragments = Array.from(preview.getClientRects()).filter((rect) => rect.height > 0);
		if (fragments.length === 0) continue;
		const atEnd = range.to === head;
		const fragment = atEnd ? fragments[fragments.length - 1] : fragments[0];
		return {
			left: atEnd ? fragment.right : fragment.left,
			top: fragment.top,
			height: fragment.height
		};
	}
}
/**
* The preview fragment rect for a range edge touching an atom unit: the
* visible geometry standing in for source text that measures as nothing.
* `side` points into the range: `1` for a start edge (first line fragment),
* `-1` for an end edge (last line fragment).
*/
function findAtomEdgeRect(view, pos, side) {
	const state = view.state;
	for (const markName of ATOM_SOURCE_MARK_NAMES) {
		const range = getMarkRangeAt(state, pos, markName);
		if (range == null) continue;
		const preview = findAtomPreviewElement(view, range.from + 1);
		if (preview == null) continue;
		const fragments = Array.from(preview.getClientRects()).filter((rect) => rect.height > 0);
		if (fragments.length === 0) continue;
		return side === 1 ? fragments[0] : fragments[fragments.length - 1];
	}
}
function findAtomPreviewElement(view, insidePos) {
	const { node } = view.domAtPos(insidePos, 0);
	return (node instanceof Element ? node : node.parentElement)?.closest(".md-atom-view")?.querySelector(".md-atom-view-preview") ?? void 0;
}
/**
* The caret rect for scroll targeting: the head-anchored subset of the
* geometry the virtual caret draws. Skips the native-selection measurement
* (anchored at the selection start, not the head) and the cosmetic stretch.
* Undefined when the head has no measurable geometry at all.
*/
function measureCaretScrollRect(view) {
	return findCoordsCaretRect(view) ?? findAtomCaretRect(view);
}

//#endregion
//#region src/extensions/scroll-to-selection.ts
const key$1 = new PluginKey("meowdown-scroll-to-selection");
function handleScrollToSelection(view) {
	const selection = view.state.selection;
	if (!isTextSelection(selection)) return false;
	if (tryCoordsAtPos(view, selection.head, 1) != null) return false;
	const caret = measureCaretScrollRect(view);
	if (caret == null) return false;
	const startDOM = view.domAtPos(selection.head).node;
	scrollRectIntoView(view, {
		left: caret.left,
		right: caret.left,
		top: caret.top,
		bottom: caret.top + caret.height
	}, startDOM);
	return true;
}
function getSide(value, side) {
	return typeof value === "number" ? value : value[side];
}
function parentNode(node) {
	const parent = node.assignedSlot ?? node.parentNode;
	return parent?.nodeType === 11 ? parent.host : parent;
}
function windowRect(doc) {
	const viewport = doc.defaultView?.visualViewport;
	if (viewport) return {
		left: 0,
		right: viewport.width,
		top: 0,
		bottom: viewport.height
	};
	return {
		left: 0,
		right: doc.documentElement.clientWidth,
		top: 0,
		bottom: doc.documentElement.clientHeight
	};
}
function clientRect(node) {
	const rect = node.getBoundingClientRect();
	const scaleX = rect.width / node.offsetWidth || 1;
	const scaleY = rect.height / node.offsetHeight || 1;
	return {
		left: rect.left,
		right: rect.left + node.clientWidth * scaleX,
		top: rect.top,
		bottom: rect.top + node.clientHeight * scaleY
	};
}
function scrollRectIntoView(view, rect, startDOM) {
	const scrollThreshold = view.someProp("scrollThreshold") ?? 0;
	const scrollMargin = view.someProp("scrollMargin") ?? 5;
	const doc = view.dom.ownerDocument;
	for (let parent = startDOM; parent;) {
		if (parent.nodeType !== 1) {
			parent = parentNode(parent);
			continue;
		}
		const elt = parent;
		const atTop = elt === doc.body;
		const bounding = atTop ? windowRect(doc) : clientRect(elt);
		let moveX = 0;
		let moveY = 0;
		if (rect.top < bounding.top + getSide(scrollThreshold, "top")) moveY = -(bounding.top - rect.top + getSide(scrollMargin, "top"));
		else if (rect.bottom > bounding.bottom - getSide(scrollThreshold, "bottom")) moveY = rect.bottom - rect.top > bounding.bottom - bounding.top ? rect.top + getSide(scrollMargin, "top") - bounding.top : rect.bottom - bounding.bottom + getSide(scrollMargin, "bottom");
		if (rect.left < bounding.left + getSide(scrollThreshold, "left")) moveX = -(bounding.left - rect.left + getSide(scrollMargin, "left"));
		else if (rect.right > bounding.right - getSide(scrollThreshold, "right")) moveX = rect.right - bounding.right + getSide(scrollMargin, "right");
		if (moveX || moveY) if (atTop) doc.defaultView?.scrollBy(moveX, moveY);
		else {
			const startX = elt.scrollLeft;
			const startY = elt.scrollTop;
			if (moveY) elt.scrollTop += moveY;
			if (moveX) elt.scrollLeft += moveX;
			const dX = elt.scrollLeft - startX;
			const dY = elt.scrollTop - startY;
			rect = {
				left: rect.left - dX,
				top: rect.top - dY,
				right: rect.right - dX,
				bottom: rect.bottom - dY
			};
		}
		const pos = atTop ? "fixed" : getComputedStyle(elt).position;
		if (/^(?:fixed|sticky)$/.test(pos)) break;
		parent = pos === "absolute" ? elt.offsetParent : parentNode(elt);
	}
}
/**
* Scroll to the selection when the default measurement cannot: a caret on an
* atom mark view boundary (wikilink, image, file) has no visible box of its
* own, so `tr.scrollIntoView()` would otherwise silently do nothing there.
*/
function defineScrollToSelection() {
	return definePlugin(new Plugin({
		key: key$1,
		props: { handleScrollToSelection }
	}));
}

//#endregion
//#region src/extensions/select-doc-boundary.ts
function selectDocBoundary(direction, extend) {
	return (state, dispatch) => {
		const boundary = direction < 0 ? Selection.atStart(state.doc) : Selection.atEnd(state.doc);
		const selection = extend ? TextSelection.between(state.selection.$anchor, boundary.$head) : boundary;
		if (!state.selection.eq(selection)) dispatch?.(state.tr.setSelection(selection).scrollIntoView());
		return true;
	};
}
/**
* Binds the macOS document-boundary motions (`Meta-ArrowUp` / `Meta-ArrowDown`
* move the caret to the document start / end; the Shift variants extend the
* selection there). Bound explicitly instead of relying on the browser's
* native handling: WebKit gives up the native move when the document starts
* with a `contenteditable=false` element (a list marker or checkbox).
*
* See also https://bugs.webkit.org/show_bug.cgi?id=108987
*/
function defineSelectDocBoundary() {
	return defineKeymap({
		"Meta-ArrowUp": selectDocBoundary(-1, false),
		"Meta-ArrowDown": selectDocBoundary(1, false),
		"Shift-Meta-ArrowUp": selectDocBoundary(-1, true),
		"Shift-Meta-ArrowDown": selectDocBoundary(1, true)
	});
}

//#endregion
//#region src/extensions/view-attributes.ts
/**
* Add DOM attributes to the editable root. `class` and `style` values from
* every such extension are combined, so applying this more than once adds
* classes instead of replacing them.
*/
function defineViewAttributes(attributes) {
	return definePlugin(new Plugin({ props: { attributes } }));
}

//#endregion
//#region src/extensions/extension.ts
function defineEditorExtensionImpl(options) {
	return union(defineMeowdownParagraph(), defineDoc(), defineDocFrontmatterAttr(), defineText(), defineBlockquote(), defineMeowdownList(), defineHeading(), defineTable(), defineCodeBlock$1(), defineMeowdownHorizontalRule(), defineHTMLComment(), defineInlineMarks(), defineViewAttributes({ class: "meowdown-content" }), defineCodeBlockSyntaxHighlight(), defineCrossEditorDrag(), defineEscapeCollapse(), defineMoveBlock(), defineSelectDocBoundary(), defineInlineMarkPlugin(options), defineInlineToggle(), defineLinkCommands(), defineWikilink(), defineMath(), defineMarkMode(options.markMode ?? "focus"), defineClipboard(), defineScrollToSelection(), defineHiddenRunCaret(), defineAtomMarkNavigation({ marks: ATOM_SOURCE_MARK_NAMES.map((name) => ({
		name,
		modes: [
			"hide",
			"focus",
			"show"
		]
	})) }), defineBaseKeymap(), defineBaseCommands(), defineHistory(), defineGapCursor(), defineVirtualSelection(), defineModClickPrevention(), defineEditorCommands(), definePendingReplacement(), defineFind());
}
function defineEditorExtension(options = {}) {
	return defineEditorExtensionImpl(options);
}

//#endregion
//#region src/extensions/schema.ts
/** The schema shared by every parser and serializer, built once and cached. */
const getSharedSchema = /* @__PURE__ */ once(() => {
	const schema = defineEditorExtension().schema;
	if (schema == null) throw new Error("Unexpected empty schema");
	return schema;
});
/** Typed node builders bound to the shared schema. */
const getNodeBuilders = /* @__PURE__ */ once(() => {
	return createNodeBuilders(getSharedSchema());
});
/** Typed mark builders bound to the shared schema. */
const getMarkBuilders = /* @__PURE__ */ once(() => {
	return createMarkBuilders(getSharedSchema());
});
const MARK_BUILDERS_CACHE_KEY = "meowdown_mark_builders";
/** Typed mark builders bound to a specific schema, cached per schema. */
function getMarkBuildersForSchema(schema) {
	const cached = schema.cached[MARK_BUILDERS_CACHE_KEY];
	if (cached) return cached;
	const builders = createMarkBuilders(schema);
	schema.cached[MARK_BUILDERS_CACHE_KEY] = builders;
	return builders;
}
const NODE_BUILDERS_CACHE_KEY = "meowdown_node_builders";
/** Typed node builders bound to a specific schema, cached per schema. */
function getNodeBuildersForSchema(schema) {
	const cached = schema.cached[NODE_BUILDERS_CACHE_KEY];
	if (cached) return cached;
	const builders = createNodeBuilders(schema);
	schema.cached[NODE_BUILDERS_CACHE_KEY] = builders;
	return builders;
}

//#endregion
//#region src/converters/md-to-pm.ts
/**
* Convert a markdown string into a ProseMirror document node.
*
* By default the document is built with the shared schema's node builders, so
* no editor is required. When the result will be loaded into a specific editor,
* pass that editor's `nodes` so the document uses the editor's own schema
* instance and can be inserted without a JSON round trip.
*
* The output follows the extension set defined in `../extensions/extension.ts`
* (doc, paragraph, text, heading, blockquote, list, codeBlock, table, tableRow,
* tableCell, tableHeaderCell, horizontalRule). The function does not produce
* inline marks because the markdown stays literal text - emphasis / link /
* inline-code characters survive verbatim.
*/
function markdownToDoc(markdown, options = {}) {
	const { nodes = getNodeBuilders(), frontmatter = false } = options;
	let frontmatterBody;
	let rest = markdown;
	if (frontmatter) {
		const [body, matchLength] = matchFrontmatter(markdown);
		frontmatterBody = body;
		if (matchLength) rest = markdown.slice(matchLength);
	}
	const blocks = collectBlocks(nodes, gfmBlockOnlyParser.parse(rest).cursor(), rest);
	return nodes.doc(frontmatterBody === void 0 ? {} : { frontmatter: frontmatterBody }, blocks);
}
/**
* Matches a leading YAML frontmatter block: a `---` fence at offset 0, a body,
* and a closing `---` fence, each fence being exactly three dashes followed by
* optional spaces or tabs. Returns the body (the lines between the fences,
* joined by `\n`, without a trailing newline) and the length of the matched
* region, or undefined when there is no terminated frontmatter block (a lone `---`
* with no closing fence stays a thematic break).
*/
const FRONTMATTER_RE = /^---[ \t]*\r?\n([\s\S]*?\n)?---[ \t]*(?:\r?\n|$)/;
function matchFrontmatter(markdown) {
	const match = FRONTMATTER_RE.exec(markdown);
	if (!match) return [];
	return [(match[1] ?? "").replace(/\r?\n$/, ""), match[0].length];
}
/**
* Walk the current node's children, converting each block-level child
* and flattening any node converter that returns multiple siblings
* (lists are the main case).
*/
function collectBlocks(nodes, cursor, text) {
	const out = [];
	if (!cursor.firstChild()) return out;
	let previousTo;
	do {
		if (previousTo != null) appendGapParagraphs(out, nodes, text, previousTo, cursor.from);
		previousTo = cursor.to;
		out.push(...convertBlock(nodes, cursor, text));
	} while (cursor.nextSibling());
	cursor.parent();
	return out;
}
/**
* Blank lines between two sibling blocks are content: a run of K blank lines
* is one block separator plus K-1 empty paragraphs. The gap slice between the
* siblings' ranges holds only line terminators and structural prefixes
* (indent, blockquote `>`), so counting newlines is enough - the gap has K+1
* of them (the previous block's own terminator plus one per blank line).
*/
function appendGapParagraphs(out, nodes, text, gapFrom, gapTo) {
	let newlineCount = 0;
	for (let i = gapFrom; i < gapTo; i++) if (text.charCodeAt(i) === 10) newlineCount++;
	for (let i = 2; i < newlineCount; i++) out.push(nodes.paragraph());
}
function convertBlock(nodes, cursor, text) {
	switch (cursor.type.id) {
		case LEZER_NODE_IDS.ATXHeading1: return [convertHeading(nodes, cursor, text, 1, false)];
		case LEZER_NODE_IDS.ATXHeading2: return [convertHeading(nodes, cursor, text, 2, false)];
		case LEZER_NODE_IDS.ATXHeading3: return [convertHeading(nodes, cursor, text, 3, false)];
		case LEZER_NODE_IDS.ATXHeading4: return [convertHeading(nodes, cursor, text, 4, false)];
		case LEZER_NODE_IDS.ATXHeading5: return [convertHeading(nodes, cursor, text, 5, false)];
		case LEZER_NODE_IDS.ATXHeading6: return [convertHeading(nodes, cursor, text, 6, false)];
		case LEZER_NODE_IDS.SetextHeading1: return [convertHeading(nodes, cursor, text, 1, true)];
		case LEZER_NODE_IDS.SetextHeading2: return [convertHeading(nodes, cursor, text, 2, true)];
		case LEZER_NODE_IDS.Paragraph: return [convertParagraph(nodes, cursor, text)];
		case LEZER_NODE_IDS.LinkReference: return [convertParagraph(nodes, cursor, text)];
		case LEZER_NODE_IDS.CommentBlock: return [convertHTMLComment(nodes, cursor, text)];
		case LEZER_NODE_IDS.HTMLBlock:
		case LEZER_NODE_IDS.ProcessingInstructionBlock: return [convertParagraph(nodes, cursor, text)];
		case LEZER_NODE_IDS.Blockquote: return [convertBlockquote(nodes, cursor, text)];
		case LEZER_NODE_IDS.BulletList: return convertList(nodes, cursor, text, "bullet");
		case LEZER_NODE_IDS.OrderedList: return convertList(nodes, cursor, text, "ordered");
		case LEZER_NODE_IDS.FencedCode:
		case LEZER_NODE_IDS.CodeBlock: return [convertCodeBlock(nodes, cursor, text)];
		case LEZER_NODE_IDS.BlockMath: return [convertBlockMath(nodes, cursor, text)];
		case LEZER_NODE_IDS.HorizontalRule: {
			const marker = text.slice(cursor.from, cursor.to).trimEnd();
			return [nodes.horizontalRule({ marker: marker === "---" ? null : marker })];
		}
		case LEZER_NODE_IDS.Table: return [convertTable(nodes, cursor, text)];
		case LEZER_NODE_IDS.Task: return [convertParagraph(nodes, cursor, text)];
		default:
			if (text.slice(cursor.from, cursor.to).trim() === "") return [];
			console.warn(`[meowdown] unsupported lezer block "${cursor.type.name}"`);
			return [convertParagraph(nodes, cursor, text)];
	}
}
function convertHeading(nodes, cursor, text, level, isSetext) {
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
			contentEnd = lastFrom;
			trailingMarkFrom = lastFrom;
			trailingMarkTo = lastTo;
		}
		cursor.parent();
	}
	const content = dedentContinuation(text.slice(contentStart, contentEnd), measureContentColumn(text, contentStart)).trim();
	const setextUnderline = isSetext ? countUnderlineChars(text, trailingMarkFrom, trailingMarkTo) || 1 : null;
	const closingHashes = !isSetext && trailingMarkFrom >= 0 ? countHashChars(text, trailingMarkFrom, trailingMarkTo) || null : null;
	return nodes.heading({
		level,
		setextUnderline,
		closingHashes
	}, content);
}
/** Count the `=` / `-` characters in a setext underline run. */
function countUnderlineChars(text, from, to) {
	if (from < 0) return 0;
	let count = 0;
	for (let i = from; i < to; i++) {
		const code = text.charCodeAt(i);
		if (code === 61 || code === 45) count++;
	}
	return count;
}
/** Count the `#` characters between `from` and `to`. */
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
/** Drop a line's leading whitespace up to `column`, counting a tab as `4 - col % 4` columns. */
function sliceColumn(line, column) {
	let col = 0;
	let index = 0;
	while (index < line.length && col < column) {
		const code = line.charCodeAt(index);
		if (code === 32) col += 1;
		else if (code === 9) col += 4 - col % 4;
		else break;
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
* Build a paragraph from raw markdown content, dedenting continuation lines so
* the serializer's own line prefix does not double the indent. A soft line break
* stays a literal `\n` in a single text node; the paragraph spec's
* `whitespace: 'pre'` keeps a DOM re-read from folding it to a space.
*/
function buildParagraph(nodes, content, column) {
	return nodes.paragraph(dedentContinuation(content, column));
}
function convertParagraph(nodes, cursor, text) {
	const from = cursor.from;
	const to = cursor.to;
	const column = measureContentColumn(text, from);
	if (cursor.firstChild()) {
		let content = "";
		let pos = from;
		do
			if (cursor.type.id === LEZER_NODE_IDS.QuoteMark) {
				content += text.slice(pos, cursor.from);
				pos = cursor.to;
				if (isSpaceChar(text.charCodeAt(pos))) pos += 1;
			}
		while (cursor.nextSibling());
		cursor.parent();
		content += text.slice(pos, to);
		return buildParagraph(nodes, content, column);
	}
	return buildParagraph(nodes, text.slice(from, to), column);
}
/**
* Build the invisible `htmlComment` node from a `CommentBlock`. The raw comment
* (delimiters included) is kept verbatim on the node's `content` attribute;
* continuation lines are dedented like a paragraph's so the serializer's own
* line prefix re-applies the container indent instead of doubling it.
*/
function convertHTMLComment(nodes, cursor, text) {
	const column = measureContentColumn(text, cursor.from);
	const content = dedentContinuation(text.slice(cursor.from, cursor.to), column);
	return nodes.htmlComment({ content });
}
function convertBlockquote(nodes, cursor, text) {
	const content = [];
	if (cursor.firstChild()) {
		let previousTo;
		do {
			if (cursor.type.id === LEZER_NODE_IDS.QuoteMark) continue;
			if (previousTo != null) appendGapParagraphs(content, nodes, text, previousTo, cursor.from);
			previousTo = cursor.to;
			content.push(...convertBlock(nodes, cursor, text));
		} while (cursor.nextSibling());
		cursor.parent();
	}
	return nodes.blockquote(content);
}
function convertList(nodes, cursor, text, kind) {
	const items = [];
	if (cursor.firstChild()) {
		do
			if (cursor.type.id === LEZER_NODE_IDS.ListItem) items.push(convertListItem(nodes, cursor, text, kind));
		while (cursor.nextSibling());
		cursor.parent();
	}
	return items;
}
/** The marker style at `cursor`, plus the start number of an ordered item. */
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
function convertTaskItem(nodes, cursor, text) {
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
	if (isSpaceChar(text.charCodeAt(taskStart))) taskStart += 1;
	const paragraph = buildParagraph(nodes, text.slice(taskStart, taskEnd), measureContentColumn(text, taskStart));
	return {
		checked,
		taskMarker,
		paragraph
	};
}
function convertListItem(nodes, cursor, text, kind) {
	const content = [];
	let taskChecked;
	let taskMarker;
	let order;
	let marker;
	let markEndColumn;
	let firstContentColumn;
	if (cursor.firstChild()) {
		do {
			if (cursor.type.id !== LEZER_NODE_IDS.ListMark && firstContentColumn == null) firstContentColumn = measureContentColumn(text, cursor.from);
			if (cursor.type.id === LEZER_NODE_IDS.ListMark) {
				const listMark = readListMark(cursor, text, kind);
				marker = listMark.marker;
				order = listMark.order;
				markEndColumn = measureContentColumn(text, cursor.to);
				continue;
			}
			if (kind === "bullet" && cursor.type.id === LEZER_NODE_IDS.Task) {
				const task = convertTaskItem(nodes, cursor, text);
				taskChecked = task.checked;
				taskMarker = task.taskMarker;
				content.push(task.paragraph);
				continue;
			}
			content.push(...convertBlock(nodes, cursor, text));
		} while (cursor.nextSibling());
		cursor.parent();
	}
	const gap = firstContentColumn != null && markEndColumn != null ? firstContentColumn - markEndColumn : 1;
	const isTask = taskChecked != null;
	const collapsed = !isTask && kind === "bullet" && marker === "+";
	const attrs = {
		kind: isTask ? "task" : kind,
		order: kind === "ordered" ? order ?? 1 : null,
		checked: taskChecked ?? false,
		collapsed,
		marker: collapsed ? null : marker,
		taskMarker,
		markerGap: gap >= 2 && gap <= 4 ? gap : 1
	};
	return nodes.list(attrs, content);
}
function convertCodeBlock(nodes, cursor, text) {
	const indented = cursor.type.id === LEZER_NODE_IDS.CodeBlock;
	let language = "";
	let code = "";
	let fenceStyle = indented ? "indented" : null;
	let fenceLength = null;
	let sawOpeningMark = false;
	if (cursor.firstChild()) {
		do
			switch (cursor.type.id) {
				case LEZER_NODE_IDS.CodeMark: {
					if (sawOpeningMark) break;
					sawOpeningMark = true;
					if (text.charCodeAt(cursor.from) === 126) fenceStyle = "tilde";
					const markLength = cursor.to - cursor.from;
					if (markLength > 3) fenceLength = markLength;
					break;
				}
				case LEZER_NODE_IDS.CodeInfo:
					language = text.slice(cursor.from, cursor.to);
					break;
				case LEZER_NODE_IDS.CodeText: code += text.slice(cursor.from, cursor.to);
			}
		while (cursor.nextSibling());
		cursor.parent();
	}
	return nodes.codeBlock({
		language,
		fenceStyle,
		fenceLength
	}, code);
}
/**
* A `$$` display math block is a code block whose `language` is `math`; the
* `dollar` fence style makes it serialize back to `$$` fences.
*/
function convertBlockMath(nodes, cursor, text) {
	let code = "";
	if (cursor.firstChild()) {
		do
			if (cursor.type.id === LEZER_NODE_IDS.CodeText) code += text.slice(cursor.from, cursor.to);
		while (cursor.nextSibling());
		cursor.parent();
	}
	return nodes.codeBlock({
		language: "math",
		fenceStyle: "dollar",
		fenceLength: null
	}, code);
}
function convertTable(nodes, cursor, text) {
	let aligns = [];
	if (cursor.firstChild()) {
		do
			if (cursor.type.id === LEZER_NODE_IDS.TableDelimiter) aligns = parseDelimiterAligns(text.slice(cursor.from, cursor.to));
		while (cursor.nextSibling());
		cursor.parent();
	}
	const rows = [];
	if (cursor.firstChild()) {
		do {
			const id = cursor.type.id;
			if (id === LEZER_NODE_IDS.TableHeader) rows.push(convertTableRow(nodes, cursor, text, true, aligns));
			else if (id === LEZER_NODE_IDS.TableRow) rows.push(convertTableRow(nodes, cursor, text, false, aligns));
		} while (cursor.nextSibling());
		cursor.parent();
	}
	return nodes.table(rows);
}
function parseDelimiterAligns(separator) {
	return separator.split("|").map((segment) => segment.trim()).filter((segment) => segment !== "").map((segment) => {
		const left = segment.startsWith(":");
		const right = segment.endsWith(":");
		if (left && right) return "center";
		if (left) return "left";
		if (right) return "right";
		return null;
	});
}
function convertTableRow(nodes, cursor, text, isHeader, aligns) {
	const columnCount = aligns.length;
	const cellTexts = Array(columnCount).fill("");
	if (cursor.firstChild()) {
		const hasLeadingPipe = cursor.type.id === LEZER_NODE_IDS.TableDelimiter;
		let delimiterCount = 0;
		do
			if (cursor.type.id === LEZER_NODE_IDS.TableDelimiter) delimiterCount++;
			else if (cursor.type.id === LEZER_NODE_IDS.TableCell) {
				const column = delimiterCount - (hasLeadingPipe ? 1 : 0);
				if (column >= 0 && column < columnCount) cellTexts[column] = text.slice(cursor.from, cursor.to).trim().replaceAll(String.raw`\|`, "|");
			}
		while (cursor.nextSibling());
		cursor.parent();
	}
	const cells = cellTexts.map((cellText, column) => {
		const paragraph = nodes.paragraph(cellText);
		const attrs = { align: aligns[column] };
		return isHeader ? nodes.tableHeaderCell(attrs, paragraph) : nodes.tableCell(attrs, paragraph);
	});
	return nodes.tableRow(cells);
}

//#endregion
//#region src/converters/check-roundtrip.ts
function trimTrailingNewlines(text) {
	return text.replace(/\n+$/u, "");
}
function isBlankLine(line) {
	return /^[\s>]*$/u.test(line);
}
function nonBlankLines(text) {
	return text.split("\n").filter((line) => !isBlankLine(line));
}
function collapseWhitespace(line) {
	return line.trim().replaceAll(/\s+/gu, " ");
}
const DELIMITER_CELL_RE = /^:?-+:?$/u;
function canonicalizeDelimiterCell(cell) {
	const alignsLeft = cell.startsWith(":");
	const alignsRight = cell.endsWith(":");
	if (alignsLeft && alignsRight) return ":-:";
	if (alignsLeft) return ":--";
	if (alignsRight) return "--:";
	return "---";
}
function canonicalizeTableRow(line) {
	if (!line.includes("|")) return void 0;
	const prefix = /^[\s>]*/u.exec(line)?.[0] ?? "";
	const cells = line.slice(prefix.length).trim().replace(/^\|/u, "").replace(/\|$/u, "").split("|").map((cell) => collapseWhitespace(cell));
	return collapseWhitespace(`${prefix} | ${(cells.every((cell) => DELIMITER_CELL_RE.test(cell)) ? cells.map(canonicalizeDelimiterCell) : cells).join(" | ")} |`);
}
function normalizeLine(line) {
	return canonicalizeTableRow(line) ?? collapseWhitespace(line);
}
/** Classify how `markdown` survives the editor's parse-then-serialize round trip. */
function checkRoundTrip(markdown, options = {}) {
	const doc = markdownToDoc(markdown, { frontmatter: options.frontmatter });
	const serialized = docToMarkdown(doc, { frontmatter: options.frontmatter });
	if (trimTrailingNewlines(serialized) === trimTrailingNewlines(markdown)) return "exact";
	const before = nonBlankLines(markdown);
	const after = nonBlankLines(serialized);
	return before.length === after.length && before.every((line, i) => normalizeLine(line) === normalizeLine(after[i])) ? "normalizing" : "lossy";
}

//#endregion
//#region src/extensions/bullet-after-heading.ts
/**
* Claim Enter only when the selection is an empty caret at the very end of the
* document's first heading (the note's title line). Every other Enter (a later
* heading, mid-heading, in a paragraph, inside a list) returns false and falls
* through to the editor's default handling.
*/
const bulletAfterHeadingOnEnter = (state, dispatch) => {
	const { $from, empty } = state.selection;
	if (!empty || $from.depth !== 1 || $from.index(0) !== 0) return false;
	if (!isNodeOfType($from.parent, "heading")) return false;
	if ($from.parentOffset !== $from.parent.content.size) return false;
	if (dispatch) {
		const listType = getNodeType(state.schema, "list");
		const paragraphType = getNodeType(state.schema, "paragraph");
		const bullet = listType.create({ kind: "bullet" }, paragraphType.create());
		const afterHeading = $from.after();
		const tr = state.tr.insert(afterHeading, bullet);
		tr.setSelection(TextSelection.create(tr.doc, afterHeading + 2));
		dispatch(tr.scrollIntoView());
	}
	return true;
};
/**
* "Type a title, press Return, start bullets." When this extension is applied,
* pressing Enter at the end of the document's first heading (the title line)
* drops the caret into a fresh empty bullet instead of a plain paragraph.
*/
function defineBulletAfterHeading() {
	return withPriority$1(defineKeymap({ Enter: bulletAfterHeadingOnEnter }), Priority$1.high);
}

//#endregion
//#region src/extensions/code-block-languages.ts
const excludeLanguages = /* @__PURE__ */ new Set([
	"MscGen",
	"Xù",
	"MsGenny",
	"Angular Template",
	"Brainfuck",
	"Esper",
	"Oz",
	"Factor",
	"Squirrel",
	"Yacas",
	"mIRC",
	"FCL",
	"ECL",
	"MUMPS",
	"Pig",
	"Asterisk",
	"Z80",
	"Mathematica"
]);
const extraLanguages = [
	{
		label: "Plain text",
		value: ""
	},
	{
		label: "Math",
		value: "math"
	},
	{
		label: "Mermaid",
		value: "mermaid"
	}
];
/**
* A list of languages for code block syntax-highlight.
*/
const codeBlockLanguages = languages.map((language) => ({
	label: language.name,
	value: language.name.toLowerCase()
})).filter((language) => !excludeLanguages.has(language.label)).concat(extraLanguages).sort((a, b) => a.label.localeCompare(b.label));

//#endregion
//#region src/utils/prefers-dark-color-scheme.ts
/**
* Whether the user prefers a dark color scheme. Returns `false` in non-browser
* (SSR) environments where `window` is unavailable.
*/
function prefersDarkColorScheme() {
	if (typeof window === "undefined") return false;
	return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

//#endregion
//#region src/extensions/tweet.ts
const TWEET_HOSTS = /^(?:www\.|mobile\.)?(?:twitter\.com|x\.com)$/i;
const STATUS_ID = /\/status(?:es)?\/(\d+)/;
function parseTweetId(src) {
	let url;
	try {
		url = new URL(src);
	} catch {
		return;
	}
	if (!TWEET_HOSTS.test(url.hostname)) return void 0;
	return STATUS_ID.exec(url.pathname)?.[1];
}
const matchTweet = (src) => {
	const tweetId = parseTweetId(src);
	if (!tweetId) return;
	const theme = prefersDarkColorScheme() ? "dark" : "light";
	return {
		kind: "tweet",
		key: `tweet:${tweetId}`,
		src: `https://platform.twitter.com/embed/Tweet.html?id=${tweetId}&theme=${theme}&dnt=true`,
		title: "Tweet",
		className: "md-embed md-embed-tweet",
		testid: "tweet-embed"
	};
};
/**
* `Tweet.html` reports its rendered height via `postMessage`; size the iframe to
* fit and pass each reported height to `onHeight`. Returns a cleanup that
* removes the listener. The cleanup also runs once the iframe leaves the DOM, so
* the editor's DOM mark view (which has no destroy hook) is covered, while a
* React caller can call it on unmount.
*/
function listenForTweetHeight(iframe, onHeight) {
	const onMessage = (event) => {
		if (event.source !== iframe.contentWindow) return;
		try {
			const height = event.data?.["twttr.embed"]?.params?.[0]?.height;
			if (typeof height === "number" && height > 0) {
				applyTweetHeight(iframe, height);
				onHeight?.(height);
			}
		} catch (error) {
			console.warn("[meowdown] failed to parse tweet resize message:", error);
		}
	};
	window.addEventListener("message", onMessage);
	let cleaned = false;
	const cleanup = () => {
		if (cleaned) return;
		cleaned = true;
		window.removeEventListener("message", onMessage);
		observer.disconnect();
	};
	const observer = new MutationObserver(() => {
		if (!iframe.isConnected) cleanup();
	});
	observer.observe(document.body, {
		childList: true,
		subtree: true
	});
	return cleanup;
}
/**
* Size a tweet iframe.
*/
function applyTweetHeight(iframe, height) {
	if (height && height > 0) {
		iframe.style.height = `${height}px`;
		iframe.dataset.sized = "";
	}
}

//#endregion
//#region src/extensions/youtube.ts
const YOUTUBE_HOSTS = /^(?:www\.|m\.)?(?:youtube\.com|youtube-nocookie\.com)$/i;
const YOUTU_BE_HOST = /^(?:www\.)?youtu\.be$/i;
const VIDEO_ID = /^[\w-]{11}$/;
/** Extract `{ videoId, startSeconds? }` from any watch/shorts/embed/live/`youtu.be` URL. */
function parseYouTube(src) {
	let url;
	try {
		url = new URL(src);
	} catch {
		return;
	}
	let videoId = null;
	if (YOUTU_BE_HOST.test(url.hostname)) videoId = url.pathname.slice(1);
	else if (YOUTUBE_HOSTS.test(url.hostname)) {
		const [, firstSegment, secondSegment] = url.pathname.split("/");
		if (url.pathname === "/watch") videoId = url.searchParams.get("v");
		else if (firstSegment === "shorts" || firstSegment === "embed" || firstSegment === "live") videoId = secondSegment ?? null;
	}
	if (!videoId || !VIDEO_ID.test(videoId)) return void 0;
	const timeParam = url.searchParams.get("start") ?? url.searchParams.get("t");
	const startSeconds = timeParam ? parseStartSeconds(timeParam) : void 0;
	return {
		videoId,
		startSeconds
	};
}
/** `90`, `90s`, `1m30s`, `1h2m3s` to seconds. */
function parseStartSeconds(value) {
	if (/^\d+$/.test(value)) return Number(value);
	const matched = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/.exec(value);
	if (!matched || !matched[1] && !matched[2] && !matched[3]) return void 0;
	return Number(matched[1] ?? 0) * 3600 + Number(matched[2] ?? 0) * 60 + Number(matched[3] ?? 0);
}
const matchYouTube = (src) => {
	const parsed = parseYouTube(src);
	if (!parsed) return;
	const query = parsed.startSeconds ? `?start=${parsed.startSeconds}` : "";
	return {
		kind: "youtube",
		key: `youtube:${parsed.videoId}:${parsed.startSeconds ?? 0}`,
		src: `https://www.youtube-nocookie.com/embed/${parsed.videoId}${query}`,
		title: "YouTube video",
		className: "md-embed md-embed-youtube",
		testid: "youtube-embed",
		allow: "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen",
		allowFullscreen: true
	};
};

//#endregion
//#region src/extensions/embed.ts
const EMBED_MATCHERS = [matchYouTube, matchTweet];
/** Detect a tweet/YouTube embed in an image `src`, or `undefined` for a plain image. */
function matchEmbed(src) {
	for (const match of EMBED_MATCHERS) {
		const descriptor = match(src);
		if (descriptor) return descriptor;
	}
}

//#endregion
//#region src/extensions/paste.ts
function getPastedText(event, slice) {
	const fromClipboard = event.clipboardData?.getData("text/plain");
	if (fromClipboard) return fromClipboard;
	return slice.content.textBetween(0, slice.content.size, "\n");
}

//#endregion
//#region src/extensions/embed-paste.ts
const embedPasteKey = new PluginKey("meowdown-embed-paste");
function detectEmbedUrl(text) {
	const trimmed = text.trim();
	if (!trimmed || /\s/.test(trimmed)) return void 0;
	return matchEmbed(trimmed) ? trimmed : void 0;
}
function insertEmbedFromPaste(view, url) {
	const { from, to } = view.state.selection;
	view.dispatch(closeHistory(view.state.tr.insertText(url, from, to)));
	const rewrite = view.state.tr.insertText(`![](${url})`, from, from + url.length);
	view.dispatch(closeHistory(rewrite));
}
/**
* Auto-embed a pasted tweet or YouTube link. When the clipboard holds exactly
* one such URL, the link is rewritten to `![](url)`, which the image pipeline
* renders as a rich embed. Not part of `defineEditorExtension`; the React
* package applies it via the `embedPaste` prop (on by default).
*/
function defineEmbedPaste() {
	return definePlugin(new Plugin({
		key: embedPasteKey,
		props: { handlePaste: (view, event, slice) => {
			const parent = view.state.selection.$from.parent;
			if (!parent.inlineContent || parent.type.spec.code) return false;
			const text = getPastedText(event, slice);
			if (!text) return false;
			const url = detectEmbedUrl(text);
			if (!url) return false;
			insertEmbedFromPaste(view, url);
			return true;
		} }
	}));
}

//#endregion
//#region src/extensions/exit-boundary.ts
const exitBoundaryKey = new PluginKey("meowdown-exit-boundary");
function canMoveBlockwise(state, direction) {
	const { $anchor, $head } = state.selection;
	const $side = direction > 0 ? $anchor.max($head) : $anchor.min($head);
	const $start = !$side.parent.inlineContent ? $side : $side.depth ? state.doc.resolve(direction > 0 ? $side.after() : $side.before()) : void 0;
	return !!($start && Selection.findFrom($start, direction));
}
function canMoveVertically(view, direction) {
	const { state } = view;
	const { selection } = state;
	if (isTextSelection(selection) && !selection.empty) return true;
	if (isAllSelection(selection)) return true;
	if (selection.$from.parent.inlineContent && !view.endOfTextblock(direction < 0 ? "up" : "down")) return true;
	return canMoveBlockwise(state, direction);
}
function createExitBoundaryPlugin(onExitBoundary) {
	return new Plugin({
		key: exitBoundaryKey,
		props: { handleKeyDown: (view, event) => {
			if (event.shiftKey || event.altKey || event.ctrlKey || event.metaKey) return false;
			const dir = event.key === "ArrowUp" ? -1 : event.key === "ArrowDown" ? 1 : void 0;
			if (!dir) return false;
			if (canMoveVertically(view, dir)) return false;
			if (onExitBoundary({
				direction: dir < 0 ? "up" : "down",
				event
			}) === false) return false;
			return true;
		} }
	});
}
/** Call `onExitBoundary` when an arrow key press would leave the document boundary. */
function defineExitBoundaryHandler(onExitBoundary) {
	return withPriority$1(definePlugin(createExitBoundaryPlugin(onExitBoundary)), Priority$1.low);
}

//#endregion
//#region src/extensions/file-click.ts
const fileClickKey = new PluginKey("meowdown-file-click");
function findFileAt(state, pos) {
	const range = getMarkRangeAt(state, pos, "mdFile");
	if (!range) return;
	const { href, name } = range.mark.attrs;
	return {
		href,
		name
	};
}
/**
* Call `onClick` when the user clicks a rendered file pill, with the file's
* `href`, `name`, and the originating `MouseEvent`. The host decides what a
* click does (e.g. open the file in the OS default app).
*/
function defineFileClickHandler(onClick) {
	return definePlugin(new Plugin({
		key: fileClickKey,
		props: { handleClick: (view, _pos, event) => {
			const preview = event.target?.closest?.(".md-file-view-preview");
			if (!preview) return false;
			const content = preview.closest(".md-file-view")?.querySelector(".md-file-view-content");
			if (!content) return false;
			const hit = findFileAt(view.state, view.posAtDOM(content, 0));
			if (!hit) return false;
			onClick({
				href: hit.href,
				name: hit.name,
				event
			});
			return true;
		} }
	}));
}

//#endregion
//#region src/extensions/file-paste.ts
const IMAGE_FILE_EXTENSIONS = /* @__PURE__ */ new Set([
	"avif",
	"bmp",
	"gif",
	"jpeg",
	"jpg",
	"png",
	"svg",
	"webp"
]);
function isImageFile(file) {
	if (file.type?.startsWith("image/")) return true;
	const extensionSeparator = file.name.lastIndexOf(".");
	if (extensionSeparator === -1) return false;
	const extension = file.name.slice(extensionSeparator + 1).toLowerCase();
	return IMAGE_FILE_EXTENSIONS.has(extension);
}
/**
* The markdown a saved file becomes: `![](destination)` for an image (a
* `type` starting with `image/` or a recognized image filename extension), a
* `[name](destination)` link otherwise, with `\`, `[`, and `]` escaped in the
* name. Exported so a host command that inserts file links itself (e.g. an
* attach-file picker) produces markdown byte-identical to a paste/drop.
*/
function buildFileMarkdown(file, destination) {
	return isImageFile(file) ? `![](${destination})` : `[${escapeLinkText(file.name)}](${destination})`;
}
/**
* The files a configured `onFilePaste` can take, in DataTransfer order.
* Without a handler no file is taken, so the event is not consumed and the
* browser's default handling stays in charge.
*/
function takePastedFiles(data, options) {
	if (!data || !options.onFilePaste) return [];
	return Array.from(data.files);
}
const defaultOnFileSaveError = (error) => {
	console.error("[meowdown] failed to save pasted file:", error);
};
/** Escape `\`, `[`, and `]` so a filename stays inside its `[text]` label. */
function escapeLinkText(name) {
	return name.replaceAll(/[\\[\]]/g, String.raw`\$&`);
}
async function insertSavedFiles(view, files, options, at) {
	const { onFilePaste } = options;
	if (!onFilePaste) return;
	const onSaveError = options.onFileSaveError ?? defaultOnFileSaveError;
	let position = at;
	let insertedAny = false;
	for (const file of files) {
		let saved;
		try {
			saved = await onFilePaste(file);
		} catch (error) {
			onSaveError(error, file);
			continue;
		}
		if (!saved || view.isDestroyed) continue;
		const link = buildFileMarkdown(file, saved);
		const markdown = insertedAny ? `\n${link}` : link;
		const transaction = position == null ? view.state.tr.insertText(markdown) : view.state.tr.insertText(markdown, position);
		view.dispatch(transaction);
		insertedAny = true;
		if (position != null) position += markdown.length;
	}
}
function createFilePastePlugin(options) {
	return new Plugin({
		key: new PluginKey("file-paste"),
		props: {
			handlePaste: (view, event) => {
				const files = takePastedFiles(event.clipboardData, options);
				if (files.length === 0) return false;
				insertSavedFiles(view, files, options);
				return true;
			},
			handleDrop: (view, event) => {
				const files = takePastedFiles(event.dataTransfer, options);
				if (files.length === 0) return false;
				insertSavedFiles(view, files, options, view.posAtCoords({
					left: event.clientX,
					top: event.clientY
				})?.pos);
				return true;
			}
		}
	});
}
/**
* Persist pasted/dropped files via `onFilePaste` and insert the returned
* markdown destination: `![](src)` for an image, a `[name](src)` link for any
* other file. Multiple files insert one link per line, in DataTransfer order.
*/
function defineFilePaste(options = {}) {
	return withPriority$1(definePlugin(createFilePastePlugin(options)), Priority$1.high);
}

//#endregion
//#region src/utils/format-file-size.ts
const UNITS = [
	"KB",
	"MB",
	"GB",
	"TB"
];
/**
* Format a byte count for display on a file pill: decimal units (1 KB =
* 1000 B, matching macOS Finder), one decimal below 10, integers otherwise.
*/
function formatFileSize(bytes) {
	let value = bytes;
	let unit = "B";
	for (const next of UNITS) {
		if (value < 999.5) break;
		value /= 1e3;
		unit = next;
	}
	if (unit === "B") return `${Math.round(value)} B`;
	return `${value < 9.95 ? Math.round(value * 10) / 10 : Math.round(value)} ${unit}`;
}

//#endregion
//#region src/extensions/file-view.ts
/** `data-file-kind` values by file extension, for host CSS theming. */
const FILE_KIND_BY_EXTENSION = /* @__PURE__ */ new Map([
	["pdf", "pdf"],
	["zip", "archive"],
	["tar", "archive"],
	["gz", "archive"],
	["tgz", "archive"],
	["rar", "archive"],
	["7z", "archive"],
	["doc", "doc"],
	["docx", "doc"],
	["pages", "doc"],
	["xls", "sheet"],
	["xlsx", "sheet"],
	["csv", "sheet"],
	["numbers", "sheet"],
	["ppt", "slides"],
	["pptx", "slides"],
	["key", "slides"],
	["mp3", "audio"],
	["wav", "audio"],
	["m4a", "audio"],
	["flac", "audio"],
	["ogg", "audio"],
	["mp4", "video"],
	["mov", "video"],
	["mkv", "video"],
	["webm", "video"],
	["txt", "text"],
	["md", "text"]
]);
/** Classify a file destination for the pill's `data-file-kind` attribute. */
function getFileKind(href) {
	const path = href.split(/[?#]/, 1)[0];
	const dot = path.lastIndexOf(".");
	if (dot < 0) return "generic";
	const extension = path.slice(dot + 1).toLowerCase();
	return FILE_KIND_BY_EXTENSION.get(extension) ?? "generic";
}
const SVG_NS = "http://www.w3.org/2000/svg";
/** A minimal document-outline icon, drawn in `currentColor`. */
function buildFileIcon() {
	const svg = document.createElementNS(SVG_NS, "svg");
	svg.setAttribute("class", "md-file-view-icon");
	svg.setAttribute("viewBox", "0 0 24 24");
	svg.setAttribute("aria-hidden", "true");
	for (const shape of ["M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z", "M14 2v4a2 2 0 0 0 2 2h4"]) {
		const path = document.createElementNS(SVG_NS, "path");
		path.setAttribute("d", shape);
		path.setAttribute("fill", "none");
		path.setAttribute("stroke", "currentColor");
		path.setAttribute("stroke-width", "2");
		path.setAttribute("stroke-linecap", "round");
		path.setAttribute("stroke-linejoin", "round");
		svg.appendChild(path);
	}
	return svg;
}
var FileMarkView = class {
	#dom;
	#contentDOM;
	#preview;
	#nameElement;
	#sizeElement;
	#attrs;
	#destroyed = false;
	constructor(mark, options) {
		this.#attrs = mark.attrs;
		this.#dom = document.createElement("span");
		this.#dom.className = "md-file-view md-atom-view";
		this.#preview = document.createElement("span");
		this.#preview.className = "md-file-view-preview md-atom-view-preview";
		this.#preview.contentEditable = "false";
		this.#preview.dataset.testid = "file-pill";
		this.#preview.dataset.fileKind = getFileKind(this.#attrs.href);
		this.#preview.title = this.#attrs.name;
		this.#dom.appendChild(this.#preview);
		this.#preview.appendChild(buildFileIcon());
		this.#nameElement = document.createElement("span");
		this.#nameElement.className = "md-file-view-name";
		this.#nameElement.textContent = this.#attrs.name;
		this.#preview.appendChild(this.#nameElement);
		this.#sizeElement = document.createElement("span");
		this.#sizeElement.className = "md-file-view-size";
		this.#sizeElement.dataset.testid = "file-pill-size";
		this.#preview.appendChild(this.#sizeElement);
		this.#contentDOM = document.createElement("span");
		this.#contentDOM.className = "md-file-view-content md-atom-view-content";
		this.#dom.appendChild(this.#contentDOM);
		this.#loadFileInfo(options.resolveFileInfo);
	}
	get dom() {
		return this.#dom;
	}
	get contentDOM() {
		return this.#contentDOM;
	}
	update(mark) {
		const next = mark.attrs;
		const previous = this.#attrs;
		if (next.href !== previous.href) return false;
		this.#attrs = next;
		if (next.name !== previous.name) {
			this.#nameElement.textContent = next.name;
			this.#preview.title = next.name;
		}
		return true;
	}
	ignoreMutation(mutation) {
		return !this.#contentDOM.contains(mutation.target);
	}
	destroy() {
		this.#destroyed = true;
	}
	/**
	* Fill the size slot once the host resolves it. The `href` of one view
	* instance never changes (`update` rebuilds on an href change), so at most
	* one resolve is in flight and `#destroyed` is the only guard a late
	* result needs.
	*/
	async #loadFileInfo(resolveFileInfo) {
		if (!resolveFileInfo) return;
		let info;
		try {
			info = await resolveFileInfo(this.#attrs.href);
		} catch (error) {
			console.error("[meowdown] resolveFileInfo failed:", error);
			return;
		}
		if (this.#destroyed || !info) return;
		const { size } = info;
		if (size == null || !Number.isFinite(size) || size < 0) return;
		this.#sizeElement.textContent = formatFileSize(size);
	}
};
/**
* Render a claimed file link or wiki embed (the `mdFile` mark) as an inline
* pill: a file-kind icon, the file name, and the size once
* `resolveFileInfo` supplies it. The pill never loads the file's content;
* clicks are reported through `defineFileClickHandler`.
*/
function defineFileView(options = {}) {
	return defineMarkView({
		name: "mdFile",
		constructor: (mark) => new FileMarkView(mark, options)
	});
}

//#endregion
//#region src/extensions/mark-click.ts
/**
* Shared click plumbing for text-backed marks (wikilinks, Markdown links, tags):
* a click anywhere on the rendered mark fires `onClick`.
*/
function defineMarkClickHandler(config) {
	return definePlugin(new Plugin({
		key: config.key,
		props: { handleClick: (view, pos, event) => {
			const element = event.target?.closest?.(config.selector);
			if (!element) return false;
			const payload = config.findPayloadForElement ? config.findPayloadForElement(view, element) : config.findPayloadAt(view.state, pos);
			if (payload == null) return false;
			if (config.preventDefault) event.preventDefault();
			config.onClick(payload, event);
			return true;
		} }
	}));
}

//#endregion
//#region src/extensions/tag-click.ts
const tagClickKey = new PluginKey("meowdown-tag-click");
/**
* The tag covering `pos`, found via the `mdTag` run. The tag name is read from
* the run's own text (the `mdTag` mark carries no attrs), with the leading `#`
* stripped. Exported for tests.
*/
function findTagAt(state, pos) {
	const range = getMarkRangeAt(state, pos, "mdTag");
	if (!range) return;
	const text = state.doc.textBetween(range.from, range.to);
	const tag = text.startsWith("#") ? text.slice(1) : text;
	return {
		from: range.from,
		to: range.to,
		tag
	};
}
function defineTagClickHandler(onClick) {
	return defineMarkClickHandler({
		key: tagClickKey,
		selector: ".md-tag",
		preventDefault: false,
		findPayloadAt: (state, pos) => findTagAt(state, pos)?.tag,
		onClick: (tag, event) => onClick({
			tag,
			event
		})
	});
}

//#endregion
//#region src/extensions/wikilink-click.ts
const wikilinkClickKey = new PluginKey("meowdown-wikilink-click");
/** Exported for tests. */
function findWikilinkAt(state, pos) {
	const range = getMarkRangeAt(state, pos, "mdWikilink");
	if (!range) return;
	const { target } = range.mark.attrs;
	return {
		from: range.from,
		to: range.to,
		target
	};
}
/**
* Resolve the wiki link represented by a visible mark-view element.
*
* The preview label is non-editable and can be much wider than its Markdown
* source. Resolving from click coordinates therefore risks landing on the
* next adjacent mark; the hidden content holder has the exact source position.
*/
function findWikilinkForElement(view, element) {
	const content = element.closest(".md-wikilink-view")?.querySelector(".md-wikilink-view-content");
	if (!content) return;
	return findWikilinkAt(view.state, view.posAtDOM(content, 0));
}
function defineWikilinkClickHandler(onClick) {
	return defineMarkClickHandler({
		key: wikilinkClickKey,
		selector: ".md-wikilink-view-preview",
		preventDefault: false,
		findPayloadAt: (state, pos) => findWikilinkAt(state, pos)?.target,
		findPayloadForElement: (view, element) => findWikilinkForElement(view, element)?.target,
		onClick: (target, event) => onClick({
			target,
			event
		})
	});
}

//#endregion
//#region src/extensions/follow-link.ts
const followLinkKey = new PluginKey("meowdown-follow-link");
function createFollowLinkPlugin(handlers) {
	return new Plugin({
		key: followLinkKey,
		props: { handleKeyDown: (view, event) => {
			if (getIsComposing() || event.key !== "Enter" || event.shiftKey) return false;
			const { state } = view;
			const selectedAtom = getSelectedAtomRange(state);
			if (!(isApple ? event.metaKey : event.ctrlKey) && !selectedAtom) return false;
			const pos = selectedAtom ? selectedAtom.from + 1 : state.selection.head;
			const wikilink = handlers.onWikilinkClick && findWikilinkAt(state, pos);
			if (wikilink) {
				handlers.onWikilinkClick?.({
					target: wikilink.target,
					event
				});
				return true;
			}
			const tag = handlers.onTagClick && findTagAt(state, pos);
			if (tag) {
				handlers.onTagClick?.({
					tag: tag.tag,
					event
				});
				return true;
			}
			const file = handlers.onFileClick && findFileAt(state, pos);
			if (file) {
				handlers.onFileClick?.({
					href: file.href,
					name: file.name,
					event
				});
				return true;
			}
			const link = handlers.onLinkClick && getLinkUnitAt(state, pos);
			if (link) {
				handlers.onLinkClick?.({
					href: link.href,
					event
				});
				return true;
			}
			return false;
		} }
	});
}
/**
* Binds `Mod-Enter` to follow the wikilink, tag, file pill, or Markdown link
* under the caret, and plain `Enter` to follow a selected atom unit, firing
* the same handlers a click does. Off a link, `Mod-Enter` falls through so
* the list keymap keeps cycling checkbox tasks; off a selected unit, `Enter`
* falls through to the regular split. High priority puts this ahead of every
* keymap binding.
*/
function defineFollowLinkHandler(handlers) {
	return withPriority$1(definePlugin(createFollowLinkPlugin(handlers)), Priority$1.high);
}

//#endregion
//#region src/extensions/image-click.ts
const imageClickKey = new PluginKey("meowdown-image-click");
function getClosestImagePreview(target) {
	return target instanceof HTMLElement && target.closest(".md-image-view-preview");
}
function findImageAt(state, pos) {
	const range = getMarkRangeAt(state, pos, "mdImage");
	if (!range) return;
	const { src, alt } = range.mark.attrs;
	return {
		from: range.from,
		to: range.to,
		src,
		alt
	};
}
/**
* Resolve the image hit for a preview element via its content holder, not the
* event's document position: an event on the non-editable preview lands on the
* run boundary, where `getMarkRange` would pick the next adjacent image.
*/
function findImageForPreview(view, preview) {
	const content = preview.closest(".md-image-view")?.querySelector(".md-image-view-content");
	if (!content) return;
	return findImageAt(view.state, view.posAtDOM(content, 0));
}
/** Fingers wander a little during a tap; past this it is a scroll or a drag. */
const TAP_MOVE_TOLERANCE = 10;
function findTouch(touches, identifier) {
	return Array.from(touches).find((touch) => touch.identifier === identifier);
}
function isWithinTapTolerance(pending, touch) {
	return Math.abs(touch.clientX - pending.clientX) <= TAP_MOVE_TOLERANCE && Math.abs(touch.clientY - pending.clientY) <= TAP_MOVE_TOLERANCE;
}
/**
* Call `onClick` when the user clicks or taps a rendered image preview, with
* the image's markdown `src`, `alt`, and the originating event.
*
* Touch taps are handled from `touchend` rather than the synthetic click:
* previews live inside the editor contenteditable, and iOS WebKit's
* tap-to-focus is a native gesture default action that only cancelling the
* `touchend` can suppress — otherwise a tap briefly focuses the editor and
* raises the software keyboard before the handler opens its own surface
* (such as a lightbox).
*/
function defineImageClickHandler(onClick) {
	const pendingTaps = /* @__PURE__ */ new WeakMap();
	const handleTouchEnd = (view, event) => {
		const pending = pendingTaps.get(view);
		pendingTaps.delete(view);
		if (!pending || event.touches.length > 0) return false;
		const touch = findTouch(event.changedTouches, pending.identifier);
		if (!touch || !isWithinTapTolerance(pending, touch)) return false;
		const preview = getClosestImagePreview(event.target);
		if (!preview) return false;
		event.preventDefault();
		const hit = findImageForPreview(view, preview);
		if (hit) onClick({
			src: hit.src,
			alt: hit.alt,
			event
		});
		return true;
	};
	return definePlugin(new Plugin({
		key: imageClickKey,
		props: {
			handleDOMEvents: {
				pointerdown: (view, event) => {
					if (getClosestImagePreview(event.target) && event.pointerType !== "mouse") event.preventDefault();
					return false;
				},
				touchstart: (view, event) => {
					pendingTaps.delete(view);
					if (event.touches.length !== 1) return false;
					if (!getClosestImagePreview(event.target)) return false;
					if (event.target instanceof HTMLElement && event.target.closest(".md-image-resize-handle")) return false;
					const touch = event.changedTouches[0];
					if (!touch) return false;
					pendingTaps.set(view, {
						identifier: touch.identifier,
						clientX: touch.clientX,
						clientY: touch.clientY
					});
					return false;
				},
				touchmove: (view, event) => {
					const pending = pendingTaps.get(view);
					if (!pending) return false;
					const touch = findTouch(event.changedTouches, pending.identifier);
					if (touch && !isWithinTapTolerance(pending, touch)) pendingTaps.delete(view);
					return false;
				},
				touchcancel: (view) => {
					pendingTaps.delete(view);
					return false;
				},
				touchend: handleTouchEnd
			},
			handleClick: (view, _pos, event) => {
				const preview = getClosestImagePreview(event.target);
				if (!preview) return false;
				const hit = findImageForPreview(view, preview);
				if (!hit) return false;
				onClick({
					src: hit.src,
					alt: hit.alt,
					event
				});
				return true;
			}
		}
	}));
}

//#endregion
//#region src/extensions/image.ts
/** Show an `src` as-is when it is an http(s) URL, otherwise skip rendering it. */
function defaultResolveImageUrl(src) {
	return /^https?:\/\//i.test(src) ? src : void 0;
}
/**
* Default cap on an image's displayed height in CSS pixels.
*/
const MAX_DISPLAY_HEIGHT = 500;
/**
* Build the iframe DOM for an embed descriptor and start its height listener.
* A persisted tweet height seeds the iframe before `Tweet.html` reports the
* real one, so a revisited tweet keeps its space instead of shifting layout.
*/
function buildEmbedIframe(embed, height, onHeight) {
	const iframe = document.createElement("iframe");
	iframe.src = embed.src;
	iframe.title = embed.title;
	iframe.className = embed.className;
	iframe.dataset.testid = embed.testid;
	iframe.loading = "lazy";
	iframe.referrerPolicy = "strict-origin-when-cross-origin";
	iframe.setAttribute("frameborder", "0");
	if (embed.allow) iframe.allow = embed.allow;
	if (embed.allowFullscreen) iframe.allowFullscreen = true;
	if (embed.kind === "tweet") {
		applyTweetHeight(iframe, height);
		listenForTweetHeight(iframe, onHeight);
	}
	return iframe;
}
/**
* Write a persisted display size onto a resizable resizable root.
*/
function applySize(root, width, height) {
	if (width != null) root.setAttribute("data-width", String(Math.ceil(width)));
	if (height != null) root.setAttribute("data-height", String(Math.ceil(height)));
}
/**
* Write the display size onto the resizable root. Persisted dimensions win;
* missing ones derive from the image's natural size (capping the height at
* MAX_DISPLAY_HEIGHT, never upscaling). Before the image has loaded, only the
* persisted dimensions are seeded; the load listener fills in the rest.
*/
function applyImageDisplaySize(root, image, width, height) {
	if (width != null && height != null) {
		applySize(root, width, height);
		return;
	}
	const ratio = image.naturalWidth / image.naturalHeight;
	if (!Number.isFinite(ratio) || ratio <= 0) {
		applySize(root, width, height);
		return;
	}
	const displayHeight = width == null ? Math.min(image.naturalHeight, MAX_DISPLAY_HEIGHT) : width / ratio;
	applySize(root, width ?? displayHeight * ratio, displayHeight);
}
/**
* Rewrite only the trailing magic comment of the image source at `range`,
* merging `patch` into the existing metadata and leaving the `![alt](url)`
* source untouched. The inline-mark plugin re-derives the `width`/`height`
* attributes from the new text.
*/
function rewriteMagicComment(view, range, patch, addToHistory) {
	const current = view.state.doc.textBetween(range.from, range.to);
	const base = stripMagicComment(current);
	const commentFrom = range.from + base.length;
	const currentComment = current.slice(base.length);
	const nextComment = formatMagicComment({
		...parseMagicComment(currentComment),
		...patch
	});
	if (nextComment === currentComment) return;
	const transaction = view.state.tr.insertText(nextComment, commentFrom, range.to);
	if (!addToHistory) transaction.setMeta("addToHistory", false);
	view.dispatch(transaction);
}
/** Persist a resized width and height into the trailing magic comment. */
function commitImageSize(view, content, rawWidth, rawHeight) {
	const pos = view.posAtDOM(content, 0);
	const range = getMarkRangeAt(view.state, pos, "mdImage");
	if (!range) return;
	const attrs = range.mark.attrs;
	if (attrs.syntax === "wikiEmbed") {
		const current = view.state.doc.textBetween(range.from, range.to);
		const target = attrs.wikiTarget || parseWikiEmbed(current).target;
		if (!target) return;
		const next = formatSizedWikiEmbed(target, rawWidth, rawHeight);
		if (next !== current) view.dispatch(view.state.tr.insertText(next, range.from, range.to));
		return;
	}
	rewriteMagicComment(view, range, {
		width: Math.round(rawWidth),
		height: Math.round(rawHeight)
	}, true);
}
/**
* Ignore reported tweet heights this close to the persisted one. Fonts, theme,
* and container width nudge the rendered height by a few pixels per device;
* writing those back would churn the document on every open.
*/
const TWEET_HEIGHT_TOLERANCE = 8;
/**
* Persist the height a tweet embed reported, so the next load can seed the
* iframe before the tweet renders. A passive metadata write: outside undo
* history, skipped in read-only views, and skipped inside the tolerance.
*/
function commitTweetHeight(view, content, height) {
	if (!view.editable || !content.isConnected) return;
	const pos = view.posAtDOM(content, 0);
	const range = getMarkRangeAt(view.state, pos, "mdImage");
	if (!range) return;
	const attrs = range.mark.attrs;
	if (attrs.height != null && Math.abs(height - attrs.height) <= TWEET_HEIGHT_TOLERANCE) return;
	rewriteMagicComment(view, range, { height: Math.round(height) }, false);
}
var ImageMarkView = class {
	#dom;
	#contentDOM;
	#view;
	#resolveImageUrl;
	#persistTweetHeight;
	#attrs;
	#resizableRoot;
	#image;
	#tweetIframe;
	constructor(mark, view, options) {
		this.#attrs = mark.attrs;
		this.#view = view;
		this.#resolveImageUrl = options.resolveImageUrl;
		this.#persistTweetHeight = options.persistTweetHeight ?? true;
		this.#dom = document.createElement("span");
		this.#dom.className = "md-image-view md-atom-view";
		this.#contentDOM = document.createElement("span");
		this.#contentDOM.className = "md-image-view-content md-atom-view-content";
		const preview = this.#renderPreview();
		if (preview) {
			preview.contentEditable = "false";
			this.#dom.appendChild(preview);
		}
		this.#dom.appendChild(this.#contentDOM);
	}
	get dom() {
		return this.#dom;
	}
	get contentDOM() {
		return this.#contentDOM;
	}
	update(mark) {
		const next = mark.attrs;
		const previous = this.#attrs;
		if (next.src !== previous.src) return false;
		this.#attrs = next;
		if (this.#image && next.alt !== previous.alt) this.#image.alt = next.alt;
		if (this.#resizableRoot && (next.width !== previous.width || next.height !== previous.height)) if (this.#image) applyImageDisplaySize(this.#resizableRoot, this.#image, next.width, next.height);
		else applySize(this.#resizableRoot, next.width, next.height);
		if (this.#tweetIframe && next.height !== previous.height) applyTweetHeight(this.#tweetIframe, next.height);
		return true;
	}
	ignoreMutation(mutation) {
		return !this.#contentDOM.contains(mutation.target);
	}
	/** Build the inline preview for the image `src`: an embed iframe or a resizable `<img>`. */
	#renderPreview() {
		const { src } = this.#attrs;
		const embed = matchEmbed(src);
		if (embed) {
			const wrapper = document.createElement("span");
			wrapper.className = "md-image-view-preview md-atom-view-preview";
			const onHeight = this.#persistTweetHeight ? (height) => {
				commitTweetHeight(this.#view, this.#contentDOM, height);
			} : void 0;
			const iframe = buildEmbedIframe(embed, this.#attrs.height, onHeight);
			if (embed.kind === "tweet") this.#tweetIframe = iframe;
			wrapper.appendChild(embed.kind === "youtube" ? this.#buildResizableEmbed(iframe) : iframe);
			return wrapper;
		}
		const url = (this.#resolveImageUrl ?? defaultResolveImageUrl)(src);
		if (!url) return void 0;
		const wrapper = document.createElement("span");
		wrapper.className = "md-image-view-preview md-atom-view-preview";
		wrapper.dataset.testid = "image-preview";
		wrapper.appendChild(this.#buildResizableImage(url));
		return wrapper;
	}
	/**
	* A resizable YouTube embed: the same resizable web component as images, with
	* the player's fixed 16:9 ratio, so a drag only ever picks a width. Releasing
	* a drag writes the size into the markdown source as a
	* `<!-- {"width":N,"height":M} -->` comment, exactly like an image.
	*/
	#buildResizableEmbed(iframe) {
		registerResizableRootElement();
		registerResizableHandleElement();
		const root = document.createElement("prosekit-resizable-root");
		root.className = "md-embed-resizable";
		root.dataset.testid = "embed-resizable";
		root.setAttribute("data-aspect-ratio", String(16 / 9));
		applySize(root, this.#attrs.width, this.#attrs.height);
		root.appendChild(iframe);
		const handle = document.createElement("prosekit-resizable-handle");
		handle.className = "md-image-resize-handle";
		handle.setAttribute("position", "bottom-right");
		handle.addEventListener("click", (event) => event.stopPropagation());
		root.appendChild(handle);
		root.addEventListener("resizeEnd", (event) => {
			const { width: nextWidth, height: nextHeight } = event.detail;
			commitImageSize(this.#view, this.#contentDOM, nextWidth, nextHeight);
		});
		this.#resizableRoot = root;
		return root;
	}
	/**
	* A resizable `<img>`: ProseKit's resizable web component wrapping the image,
	* plus a drag handle. Releasing a drag writes the new width and height into
	* the markdown source as a `<!-- {"width":N,"height":M} -->` comment, which
	* the inline-mark plugin re-derives back into the mark's `width`/`height`
	* attributes.
	*/
	#buildResizableImage(url) {
		registerResizableRootElement();
		registerResizableHandleElement();
		const root = document.createElement("prosekit-resizable-root");
		root.className = "md-image-resizable";
		root.dataset.testid = "image-resizable";
		root.setAttribute("data-loading", "");
		const image = document.createElement("img");
		image.src = url;
		image.alt = this.#attrs.alt;
		image.draggable = false;
		applyImageDisplaySize(root, image, this.#attrs.width, this.#attrs.height);
		image.addEventListener("load", () => {
			root.removeAttribute("data-loading");
			const ratio = image.naturalWidth / image.naturalHeight;
			if (!Number.isFinite(ratio) || ratio <= 0) return;
			root.setAttribute("data-aspect-ratio", String(ratio));
			applyImageDisplaySize(root, image, this.#attrs.width, this.#attrs.height);
		});
		image.addEventListener("error", () => {
			root.removeAttribute("data-loading");
		});
		root.appendChild(image);
		const handle = document.createElement("prosekit-resizable-handle");
		handle.className = "md-image-resize-handle";
		handle.setAttribute("position", "bottom-right");
		handle.addEventListener("click", (event) => event.stopPropagation());
		root.appendChild(handle);
		root.addEventListener("resizeEnd", (event) => {
			const { width: nextWidth, height: nextHeight } = event.detail;
			commitImageSize(this.#view, this.#contentDOM, nextWidth, nextHeight);
		});
		this.#resizableRoot = root;
		this.#image = image;
		return root;
	}
};
/** Inline image/embed rendering: a mark view on the `mdImage` mark. */
function defineImage(options = {}) {
	return defineMarkView({
		name: "mdImage",
		constructor: (mark, view) => new ImageMarkView(mark, view, options)
	});
}

//#endregion
//#region src/extensions/key-bindings.ts
/** Human-readable descriptions of the editor's formatting and heading shortcuts. */
const EDITOR_KEY_BINDINGS = {
	"Mod-b": "Bold",
	"Mod-i": "Italic",
	"Mod-e": "Inline code",
	"Mod-Shift-x": "Strikethrough",
	"Mod-Shift-h": "Highlight",
	"Mod-k": "Link",
	"Mod-Shift-k": "Insert a wikilink",
	"Mod-1": "Heading 1",
	"Mod-2": "Heading 2",
	"Mod-3": "Heading 3",
	"Mod-4": "Heading 4",
	"Mod-5": "Heading 5",
	"Mod-6": "Heading 6",
	"Mod-.": "Fold or unfold a bullet",
	"Mod-Enter": "Follow the link under the caret, or cycle a checkbox task",
	"Mod-Shift-Enter": "Cycle a circle checkbox task",
	"Mod-Shift-7": "Ordered list",
	"Mod-Shift-8": "Bullet list",
	"Mod-Shift-9": "Checkbox task list",
	"Alt-ArrowUp": "Move the block or list item up",
	"Alt-ArrowDown": "Move the block or list item down",
	"Meta-ArrowUp": "Move the caret to the document start",
	"Meta-ArrowDown": "Move the caret to the document end",
	"Shift-Meta-ArrowUp": "Select to the document start",
	"Shift-Meta-ArrowDown": "Select to the document end",
	Escape: "Collapse the selection"
};

//#endregion
//#region src/extensions/link-click.ts
const linkClickKey = new PluginKey("meowdown-link-click");
function defineLinkClickHandler(onClick) {
	return defineMarkClickHandler({
		key: linkClickKey,
		selector: ".md-link",
		preventDefault: true,
		findPayloadAt: (state, pos) => getLinkUnitAt(state, pos)?.href,
		onClick: (href, event) => onClick({
			href,
			event
		})
	});
}

//#endregion
//#region src/extensions/mark-hover.ts
/**
* Delegate hover tracking for a rendered mark to the editor root.
*
* Movement within a mark is de-duplicated. The active hit is also revalidated
* after every editor update, so deleting, replacing, or rewriting a hovered
* mark emits leave even when the pointer itself never moves. Destroying the
* editor or removing the extension emits leave as well.
*/
function defineMarkHoverHandler(config) {
	let current;
	const findPayloadForElement = (view, element) => {
		return config.findPayloadForElement ? config.findPayloadForElement(view, element) : config.findPayloadAt(view.state, view.posAtDOM(element, 0));
	};
	const leave = () => {
		if (!current) return;
		current = void 0;
		config.onHoverChange(void 0);
	};
	const handleOver = (view, event) => {
		const target = event.target;
		if (!target || !isElementLike(target)) return;
		const element = target.closest(config.selector);
		if (!element || !view.dom.contains(element) || element === current?.element) return;
		leave();
		const payload = findPayloadForElement(view, element);
		if (payload == null) return;
		current = {
			payload,
			element
		};
		config.onHoverChange(current);
	};
	const handleOut = (event) => {
		if (!current) return;
		const related = event.relatedTarget;
		if (related instanceof Node && current.element.contains(related)) return;
		leave();
	};
	return definePlugin(new Plugin({
		key: config.key,
		props: { handleDOMEvents: {
			mouseover: (view, event) => {
				handleOver(view, event);
				return false;
			},
			mouseout: (_view, event) => {
				handleOut(event);
				return false;
			}
		} },
		view: () => ({
			update: (view) => {
				if (!current) return;
				if (!current.element.isConnected || !view.dom.contains(current.element)) {
					leave();
					return;
				}
				const payload = findPayloadForElement(view, current.element);
				if (payload == null || !config.isSamePayload(current.payload, payload)) {
					leave();
					return;
				}
				current = {
					...current,
					payload
				};
			},
			destroy: leave
		})
	}));
}

//#endregion
//#region src/extensions/link-hover.ts
const linkHoverKey = new PluginKey("meowdown-link-hover");
function defineLinkHoverHandler(onHoverChange) {
	return defineMarkHoverHandler({
		key: linkHoverKey,
		selector: ".md-link",
		findPayloadAt: (state, pos) => {
			return getLinkUnitAt(state, pos);
		},
		isSamePayload: (previous, next) => {
			return previous.href === next.href && previous.title === next.title;
		},
		onHoverChange
	});
}

//#endregion
//#region src/extensions/link-paste.ts
const linkPasteKey = new PluginKey("meowdown-link-paste");
/**
* The pasted text as a link `href` when the clipboard holds exactly one URL:
* a `scheme:` URI, a `www.`/bare-domain URL (implied `https://`), or an email
* (implied `mailto:`) — the same shapes autolinking recognizes.
*/
function detectLinkUrl(text) {
	const trimmed = text.trim();
	if (!trimmed || /\s/.test(trimmed)) return void 0;
	return getAutolinkHref(trimmed);
}
/**
* Paste a URL over selected text to wrap the selection as a Markdown link
* `[selected text](url)`. Only fires when the clipboard holds exactly one URL
* and the selection is a non-empty text selection inside a single non-code
* textblock; otherwise the paste falls through to the other handlers
* (embed paste, plain paste). One undo restores the plain selected text.
*
* Registered with `Priority.high` so its `handlePaste` runs before
* `defineEmbedPaste`'s: pasting an embeddable URL (tweet/YouTube) over a
* selection keeps the selected text as a link instead of discarding it for an
* embed. Not part of `defineEditorExtension`; the React package applies it via
* the `linkPaste` prop (on by default).
*/
function defineLinkPaste() {
	return withPriority$1(definePlugin(new Plugin({
		key: linkPasteKey,
		props: { handlePaste: (view, event, slice) => {
			const text = getPastedText(event, slice);
			if (!text) return false;
			const href = detectLinkUrl(text);
			if (!href) return false;
			return executeCommand(view, insertLink({
				href,
				wrapText: false
			}));
		} }
	})), Priority$1.high);
}

//#endregion
//#region src/utils/is-mark-step.ts
function isMarkStep(step) {
	return step instanceof AddMarkStep || step instanceof AddNodeMarkStep || step instanceof RemoveMarkStep || step instanceof RemoveNodeMarkStep || step instanceof BatchSetMarkStep;
}

//#endregion
//#region src/extensions/spell-check.ts
const SPELL_CHECK_PAUSE_TIMEOUT = 1200;
function hasContentChanged(transactions) {
	for (const tr of transactions) for (const step of tr.steps) if (!isMarkStep(step)) return true;
	return false;
}
/**
* Stop macOS from rewriting straight punctuation into "smart" punctuation as
* the user types.
*
* On macOS, WebKit applies the system "smart quotes and dashes" substitution
* inside `contenteditable` when `spellcheck` is true. Typing right after the hidden
* `<!-- {"width":..,"height":..} -->` sizing comment that backs an image lets
* it rewrite the `--` in `-->` into an em dash. which invalidates the comment so
* meowdown can no longer parse it and it leaks into the note as literal text.
*
* We disable the `spellcheck` attribute for a few seconds before any doc
* change transaction. This would prevent the smart punctuation substitution from happening.
*/
function createSpellCheckPluginState(spellCheck) {
	let view;
	let timeoutId;
	let paused = false;
	let currentValue;
	const update = () => {
		const dom = view && !view.isDestroyed && view.dom;
		if (!dom) return;
		const newValue = spellCheck && !paused;
		if (newValue !== currentValue) {
			currentValue = newValue;
			dom.spellcheck = newValue;
		}
	};
	const pause = () => {
		if (timeoutId) clearTimeout(timeoutId);
		paused = true;
		update();
		timeoutId = setTimeout(() => {
			paused = false;
			update();
		}, SPELL_CHECK_PAUSE_TIMEOUT);
	};
	return {
		pause,
		apply(transactions) {
			if (hasContentChanged(transactions)) pause();
		},
		view(editorView) {
			view = editorView;
			return { destroy() {
				view = void 0;
			} };
		}
	};
}
function createSpellCheckPlugin(spellCheck) {
	const spellCheckKey = new PluginKey("spell-check");
	return new Plugin({
		key: spellCheckKey,
		state: {
			init: () => {
				return createSpellCheckPluginState(spellCheck);
			},
			apply: (tr, pluginState) => {
				return pluginState;
			}
		},
		view(view) {
			return spellCheckKey.getState(view.state)?.view(view) || {};
		},
		props: { handleDOMEvents: { beforeinput: (view) => {
			spellCheckKey.getState(view.state)?.pause();
		} } },
		appendTransaction(transactions, state) {
			spellCheckKey.getState(state)?.apply(transactions);
		}
	});
}
function defineSpellCheckPlugin(spellCheck) {
	return definePlugin(createSpellCheckPlugin(spellCheck));
}

//#endregion
//#region src/extensions/substitution.ts
const SUBSTITUTION_RULES = [
	[/<-/, "←"],
	[/(?<!-)->/, "→"],
	[/\(c\)/, "©"],
	[/\(r\)/, "®"],
	[/1\/2/, "½"],
	[/\+\/-/, "±"],
	[/!=/, "≠"],
	[/<</, "«"],
	[/>>/, "»"],
	[/(?<!<!)(?<!^(?:-[ \t]*)+)--/, "—"]
];
const substitutionUndoKey = new PluginKey("meowdown-substitution-undo");
function isInlineCode(state, from, to) {
	const type = getMarkType(state.schema, "mdCode");
	return state.doc.rangeHasMark(from, to, type);
}
function applySubstitution(state, from, to, rule, undoText) {
	if (isInlineCode(state, from, to)) return null;
	const [, replacement] = rule;
	const text = undoText == null ? replacement : `${replacement} `;
	const tr = state.tr.replaceWith(from, to, state.schema.text(text));
	if (undoText != null) tr.setMeta(substitutionUndoKey, {
		from,
		to: from + text.length,
		before: undoText,
		after: text
	});
	return tr;
}
function defineSubstitutionInputRules() {
	return union(SUBSTITUTION_RULES.map((rule) => {
		const inputRegexp = new RegExp(String.raw`(?:${rule[0].source})\s$`);
		return defineInputRule(new InputRule(inputRegexp, (state, match, start, end) => {
			return applySubstitution(state, start, end, rule, match[0]);
		}));
	}));
}
function defineSubstitutionUndoPlugin() {
	return definePlugin(new Plugin({
		key: substitutionUndoKey,
		state: {
			init: () => null,
			apply: (tr, previous) => {
				const meta = tr.getMeta(substitutionUndoKey);
				if (meta !== void 0) return meta;
				if (!previous) return null;
				const from = tr.mapping.map(previous.from);
				const to = tr.mapping.map(previous.to);
				return tr.selection.empty && tr.selection.from === to && tr.doc.textBetween(from, to) === previous.after ? {
					...previous,
					from,
					to
				} : null;
			}
		}
	}));
}
function defineSubstitutionUndoKeymap() {
	return withPriority$1(defineKeymap({ Backspace: (state, dispatch) => {
		const undo = substitutionUndoKey.getState(state);
		if (!undo) return false;
		dispatch?.(state.tr.replaceWith(undo.from, undo.to, state.schema.text(undo.before)).setMeta(substitutionUndoKey, null));
		return true;
	} }), Priority$1.highest);
}
function defineSubstitutionUndo() {
	return union(defineSubstitutionUndoPlugin(), defineSubstitutionUndoKeymap());
}
function defineSubstitutionEnterRules() {
	return union(SUBSTITUTION_RULES.map((rule) => {
		return defineEnterRule({
			regex: new RegExp(`(?:${rule[0].source})$`),
			handler: ({ state, from, to }) => applySubstitution(state, from, to, rule)
		});
	}));
}
/** Apply the editor's automatic plain-text substitutions. */
function defineSubstitution() {
	return union(defineSubstitutionInputRules(), defineSubstitutionUndo(), defineSubstitutionEnterRules());
}

//#endregion
//#region src/utils/force-reflow.ts
function forceReflow(element) {
	element.offsetWidth;
}

//#endregion
//#region src/extensions/virtual-caret.ts
const key = new PluginKey("meowdown-virtual-caret");
const BLINK_ANIMATIONS = ["md-virtual-caret-blink", "md-virtual-caret-blink2"];
const DATA_ATTRIBUTE = "data-meowdown-virtual-caret";
function stretchCaretRect(rect) {
	const extra = rect.height * .19999999999999996;
	return {
		left: rect.left,
		top: rect.top - extra / 2,
		height: rect.height + extra
	};
}
function measureCaretRect(view) {
	const rect = findNativeCaretRect(view) ?? findCoordsCaretRect(view);
	if (rect != null) return stretchCaretRect(rect);
	return findAtomCaretRect(view);
}
function sameRect(left, right) {
	if (left == null || right == null) return left === right;
	return left.left === right.left && left.top === right.top && left.height === right.height;
}
var VirtualCaretView = class {
	#view;
	#layer;
	#caret;
	#document;
	#resizeObserver;
	#lastRect;
	#lastTail;
	#blinkIndex = 0;
	constructor(view, layer) {
		this.#view = view;
		this.#document = view.dom.ownerDocument;
		this.#layer = layer;
		this.#layer.classList.add("md-virtual-caret-layer");
		this.#caret = this.#layer.appendChild(this.#document.createElement("div"));
		this.#caret.className = "md-virtual-caret";
		this.#caret.dataset.testid = "virtual-caret";
		this.#document.addEventListener("selectionchange", this.#reposition);
		view.dom.addEventListener("focus", this.#handleFocus);
		view.dom.addEventListener("blur", this.#handleBlur);
		if (typeof ResizeObserver !== "undefined") {
			this.#resizeObserver = new ResizeObserver(this.#reposition);
			this.#resizeObserver.observe(view.dom);
		}
		if (view.hasFocus()) this.#handleFocus();
		this.#reposition();
	}
	update(view, prevState) {
		if (!view.state.selection.eq(prevState.selection)) this.#restartBlink();
		this.#reposition();
	}
	destroy() {
		this.#document.removeEventListener("selectionchange", this.#reposition);
		this.#view.dom.removeEventListener("focus", this.#handleFocus);
		this.#view.dom.removeEventListener("blur", this.#handleBlur);
		this.#resizeObserver?.disconnect();
		this.#caret.remove();
		this.#layer.classList.remove("md-virtual-caret-layer");
		delete this.#layer.dataset.focused;
		this.#view.dom.removeAttribute(DATA_ATTRIBUTE);
	}
	#handleFocus = () => {
		this.#layer.dataset.focused = "";
	};
	#handleBlur = () => {
		delete this.#layer.dataset.focused;
	};
	#restartBlink() {
		this.#blinkIndex = 1 - this.#blinkIndex;
		this.#caret.style.animationName = BLINK_ANIMATIONS[this.#blinkIndex];
	}
	#reposition = () => {
		const view = this.#view;
		if (view.isDestroyed) return;
		const state = view.state;
		const selection = state.selection;
		const viewportRect = isTextSelection(selection) && selection.empty ? measureCaretRect(view) : void 0;
		let rect;
		if (viewportRect != null) {
			const layerRect = this.#layer.getBoundingClientRect();
			rect = {
				left: viewportRect.left - layerRect.left,
				top: viewportRect.top - layerRect.top,
				height: viewportRect.height
			};
		}
		const tail = rect != null && getMarkMode(state) === "hide" ? getCaretTail(state, selection.head) : void 0;
		if (sameRect(rect, this.#lastRect) && tail === this.#lastTail) return;
		const wasHidden = this.#lastRect == null;
		this.#lastRect = rect;
		this.#lastTail = tail;
		if (tail == null) delete this.#caret.dataset.tail;
		else this.#caret.dataset.tail = tail;
		if (rect == null) {
			this.#caret.style.visibility = "hidden";
			view.dom.removeAttribute(DATA_ATTRIBUTE);
			return;
		}
		if (wasHidden) this.#caret.style.transitionProperty = "none";
		this.#caret.style.visibility = "";
		this.#caret.style.left = `${rect.left}px`;
		this.#caret.style.top = `${rect.top}px`;
		this.#caret.style.height = `${rect.height}px`;
		view.dom.setAttribute(DATA_ATTRIBUTE, "");
		if (wasHidden) {
			forceReflow(this.#caret);
			this.#caret.style.transitionProperty = "";
		}
	};
};
/**
* Draws the caret as an overlay element and hides the native caret via CSS
* (`caret-color: transparent`). The native DOM selection stays fully alive,
* so IME, clicks, and typing keep their native behavior; only the caret pixels
* are ours. Applies to every mark mode.
*
* `layer` is the element the caret draws into. The host owns its placement:
* it must live outside the contenteditable and scroll together with the
* content.
*/
function defineVirtualCaret(layer) {
	return definePlugin(new Plugin({
		key,
		view: (view) => new VirtualCaretView(view, layer)
	}));
}

//#endregion
//#region src/extensions/wikilink-hover.ts
const wikilinkHoverKey = new PluginKey("meowdown-wikilink-hover");
/**
* Track the wikilink under the pointer without attaching per-link listeners.
*
* The handler is revalidated after document transactions and receives leave
* when the hovered link is deleted, replaced, or changes target. Moving among
* descendants of one label is de-duplicated.
*/
function defineWikilinkHoverHandler(onHoverChange) {
	return defineMarkHoverHandler({
		key: wikilinkHoverKey,
		selector: ".md-wikilink-view-preview",
		findPayloadAt: findWikilinkAt,
		findPayloadForElement: findWikilinkForElement,
		isSamePayload: (previous, next) => previous.target === next.target,
		onHoverChange: (hit) => {
			onHoverChange(hit ? {
				...hit.payload,
				element: hit.element
			} : void 0);
		}
	});
}

//#endregion
//#region src/utils/clean-text.ts
/**
* Projects a document slice to syntax-clean text, omitting inline markers and
* hidden link destinations. Set `preserveMathSource` when the result must keep
* complete `$...$` expressions rather than only their formula text.
*/
function cleanTextFromSlice(slice, options = {}) {
	const blocks = [];
	slice.content.forEach((blockNode) => {
		const parts = [];
		blockNode.descendants((textNode) => {
			if (!textNode.isText || !textNode.text) return true;
			const textNodeMarks = textNode.marks.map((mark) => mark.type.name);
			if (!(textNodeMarks.some((markName) => SYNTAX_MARK_NAMES.has(markName)) && !(options.preserveMathSource && textNodeMarks.includes("mdMath")))) parts.push(textNode.text);
			return false;
		});
		blocks.push(parts.join(""));
	});
	return blocks.join("\n");
}

//#endregion
//#region src/extensions/wikilink-trigger.ts
const WIKILINK_OPEN = "[[";
/**
* Inserts the `[[` wikilink trigger at the cursor and opens the wikilink menu.
* Any selected visible text becomes the initial query, so selecting bold
* "Cat naps" and running this yields `[[Cat naps` without the hidden `**`
* markers. A leading `[` in the selection is dropped; a selection that already
* starts with `[[`, that spans more than one block, or that sits in a code block
* is left untouched.
*/
function openWikilinkMenu({ allowEmpty }) {
	return (state, dispatch) => {
		const { selection } = state;
		if (!isTextSelection(selection)) return false;
		if (!allowEmpty && selection.empty) return false;
		if (!selection.$head.sameParent(selection.$anchor)) return false;
		if (selection.$head.parent.type.spec.code) return false;
		let query = cleanTextFromSlice(selection.content());
		if (query.startsWith(WIKILINK_OPEN)) return false;
		if (query.startsWith("[")) query = query.slice(1);
		const text = WIKILINK_OPEN + query;
		if (dispatch) {
			const tr = state.tr.insertText(text, selection.from, selection.to);
			tr.setSelection(TextSelection.create(tr.doc, selection.from + text.length));
			triggerAutocomplete(tr);
			dispatch(tr.scrollIntoView());
		}
		return true;
	};
}
/**
* Binds `Mod-Shift-k` to open the wikilink menu, and `[` to wrap a selected
* phrase into an open wikilink (`[[phrase`) with the menu searching it.
*/
function defineWikilinkTrigger() {
	return defineKeymap({
		"Mod-Shift-k": openWikilinkMenu({ allowEmpty: true }),
		"[": openWikilinkMenu({ allowEmpty: false })
	});
}

//#endregion
//#region src/utils/display-text.ts
function getAtomDisplayText(atom) {
	switch (atom.type.name) {
		case "mdWikilink": {
			const attrs = atom.attrs;
			return attrs.display || attrs.target;
		}
		case "mdImage": return atom.attrs.alt;
		case "mdFile": return atom.attrs.name;
		case "mdMath": return atom.attrs.formula;
		default: return "";
	}
}
/**
* The textblock as its live-preview marks display it: syntax runs are
* omitted and each atom unit is replaced by its display text.
*/
function getTextblockDisplayText(textblock) {
	let output = "";
	for (const run of groupInlineRuns(textblock)) {
		if (run.atom != null) {
			output += getAtomDisplayText(run.atom);
			continue;
		}
		for (const child of run.children) if (!hasSyntaxMark(child.marks)) output += child.text ?? "";
	}
	return output;
}

//#endregion
//#region src/utils/selected-text.ts
/**
* The current selection as Markdown: block structure (list markers, headings,
* blockquotes) is serialized, and inline Markdown syntax is already literal
* text in the document. A selection inside one textblock comes back as its
* bare text; a multi-block selection keeps its block markers, so downstream
* consumers (e.g. an AI prompt) see the same Markdown the user would.
*/
function getSelectedText(state) {
	const { selection, schema } = state;
	if (selection.empty) return "";
	const fragment = selection.content().content;
	try {
		const doc = schema.topNodeType.create(null, fragment);
		return docToMarkdown(doc).replace(/\n+$/, "");
	} catch {
		return state.doc.textBetween(selection.from, selection.to, "\n\n");
	}
}

//#endregion
//#region src/utils/virtual-element.ts
function tryHiddenRunCoords(view, pos, side) {
	if (side === 1) {
		const run = getHiddenRunAfter(view.state, pos);
		return run && tryCoordsAtPos(view, run.to, side);
	} else {
		const run = getHiddenRunBefore(view.state, pos);
		return run && tryCoordsAtPos(view, run.from, -1);
	}
}
/**
* Returns a Floating-UI virtual element tracking a document range.
*
* Positioning libraries re-measure asynchronously (resize observers, animation
* frames), so a measurement can fire after the view is destroyed or the range
* no longer resolves; those return the last known rect instead of throwing.
*/
function getVirtualElementFromRange(view, range) {
	let lastRect = new DOMRect(0, 0, 0, 0);
	const getBoundingClientRect = () => {
		if (view.isDestroyed) return lastRect;
		const start = tryCoordsAtPos(view, range.from, 1) ?? findAtomEdgeRect(view, range.from, 1) ?? tryHiddenRunCoords(view, range.from, 1) ?? tryCoordsAtPos(view, range.from, -1);
		if (start == null) return lastRect;
		const end = tryCoordsAtPos(view, range.to, -1) ?? findAtomEdgeRect(view, range.to, -1) ?? tryHiddenRunCoords(view, range.to, -1) ?? tryCoordsAtPos(view, range.to, 1);
		if (end == null) return lastRect;
		const left = Math.min(start.left, end.left);
		const right = Math.max(start.right, end.right);
		const top = Math.min(start.top, end.top);
		const bottom = Math.max(start.bottom, end.bottom);
		lastRect = new DOMRect(left, top, right - left, bottom - top);
		return lastRect;
	};
	return {
		getBoundingClientRect,
		getClientRects: () => [getBoundingClientRect()]
	};
}

//#endregion
export { EDITOR_KEY_BINDINGS, Priority, buildFileMarkdown, checkRoundTrip, codeBlockLanguages, collectReferenceDefinitions, defaultResolveImageUrl, defineBulletAfterHeading, defineCodeBlockPreviewPlugin, defineCodeBlockSyntaxHighlight, defineEditorExtension, defineEmbedPaste, defineExitBoundaryHandler, defineFileClickHandler, defineFilePaste, defineFileView, defineFollowLinkHandler, defineHTMLComment, defineImage, defineImageClickHandler, defineLinkClickHandler, defineLinkCommands, defineLinkEditKeymap, defineLinkHoverHandler, defineLinkPaste, defineMath, definePendingReplacementHandler, definePlaceholder, defineReadonly, defineSearchStatusHandler, defineSpellCheckPlugin, defineSubstitution, defineTagClickHandler, defineViewAttributes, defineVirtualCaret, defineWikilinkClickHandler, defineWikilinkHoverHandler, defineWikilinkTrigger, docToMarkdown, formatFileSize, formatSizedWikiEmbed, getCodeTokens, getFileKind, getIsComposing, getLinkUnitAt, getMarkBuilders, getPendingReplacement, getSearchStatus, getSelectedText, getTableColumnAlign, getTextblockDisplayText, getVirtualElementFromRange, inlineTextToMarkChunks, inlineTextToMarkChunksWithContext, insertLink, isCodeBlockPreviewHiddenDecoration, isMarkOfType, isNodeOfType, isSelectionInTableCell, listenForTweetHeight, loadKaTeX, markdownToDoc, matchEmbed, parseWikiEmbed, removeLink, renderMathInto, updateLink, wikiEmbedBasename, withPriority };