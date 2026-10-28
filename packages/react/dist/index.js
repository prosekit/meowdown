import { c } from "react/compiler-runtime";
import { clsx } from "clsx/lite";
import { Fragment, ViewTransition, cloneElement, createContext, createElement, memo, startTransition, use, useDeferredValue, useEffect, useImperativeHandle, useLayoutEffect, useReducer, useRef, useState } from "react";
import { buildFileMarkdown, codeBlockLanguages, collectReferenceDefinitions, defaultResolveImageUrl, defaultResolveXPost, defaultResolveYouTubeVideo, defineCodeBlockPreviewPlugin, defineEditorExtension, defineLinkEditKeymap, defineLinkHoverHandler, definePendingReplacementHandler, defineSearchStatusHandler, defineVirtualCaret, defineWikilinkHoverHandler, dismissLinkHover, docToMarkdown, docToParagraphMarkdown, formatFileSize, getCodeTokens, getFileKind, getLinkText, getMarkBuilders, getPendingReplacement, getSearchStatus, getSelectedText, getTableColumnAlign, getTextblockDisplayText, getVirtualElementFromRange, inlineTextToMarkChunksWithContext, isCodeBlockPreviewHiddenDecoration, isLinkTextForHref, isModEvent, isNodeOfType, isReferenceDefinitionNode, isSelectionInTableCell, loadKaTeX, markdownToDoc, normalizeHref, paragraphMarkdownToDoc, parsePostEmbedSnapshot, renderMathInto, updateEditorConfig } from "@meowdown/core";
import { clamp } from "@ocavue/utils";
import { canUseRegexLookbehind, createEditor, defineDocChangeHandler, defineUpdateHandler, isTextSelection, union } from "@prosekit/core";
import { Selection, TextSelection } from "@prosekit/pm/state";
import { ProseKit, defineReactNodeView, useEditor, useEditor as useEditor$1, useEditorDerivedValue, useExtension, useExtension as useExtension$1, useKeymap } from "@prosekit/react";
import GithubSlugger from "github-slugger";
import { Combobox } from "@base-ui/react/combobox";
import { CheckIcon, ChevronsUpDownIcon, CopyIcon, Globe2Icon, GripHorizontalIcon, GripVerticalIcon, PencilIcon, SparklesIcon, UnlinkIcon } from "lucide-react";
import { Fragment as Fragment$1, jsx, jsxs } from "react/jsx-runtime";
import { BlockHandleDraggable, BlockHandlePopup, BlockHandlePositioner, BlockHandleRoot } from "@prosekit/react/block-handle";
import { DropIndicator } from "@prosekit/react/drop-indicator";
import { Popover } from "@base-ui/react/popover";
import { queueExtension } from "@prosekit/web";
import { AutocompleteEmpty, AutocompleteItem, AutocompletePopup, AutocompletePositioner, AutocompleteRoot } from "@prosekit/react/autocomplete";
import { MenuItem, MenuPopup, MenuPositioner } from "@prosekit/react/menu";
import { TableHandleColumnMenuRoot, TableHandleColumnMenuTrigger, TableHandleColumnPopup, TableHandleColumnPositioner, TableHandleDragPreview, TableHandleDropIndicator, TableHandleRoot, TableHandleRowMenuRoot, TableHandleRowMenuTrigger, TableHandleRowPopup, TableHandleRowPositioner } from "@prosekit/react/table-handle";
import { X_POST_MEDIA_CLICK, registerXPost } from "@meowdown/embed/x";
import { YOUTUBE_VIDEO_CLICK, registerYouTubeVideo } from "@meowdown/embed/youtube";
import { matchEmbed } from "@meowdown/markdown";
import { Mark } from "@prosekit/pm/model";
import { BOOLEAN, OVERLOADED_BOOLEAN, getPropertyInfo, possibleStandardNames } from "react-property";
import { PreviewCard } from "@base-ui/react/preview-card";

// src/hooks/use-beautiful-mermaid.ts
let beautifulMermaidPromise;
function loadBeautifulMermaid() {
	beautifulMermaidPromise ??= import("./beautiful-mermaid-chunk-Cc6FHgAa.js").then((module) => module.renderMermaidSVG).catch((error) => {
		console.error("[meowdown] Failed to load beautiful-mermaid.", error);
		throw error;
	});
	return beautifulMermaidPromise;
}
function useBeautifulMermaid(enabled) {
	const $ = c(4);
	const [renderer, setRenderer] = useState(void 0);
	let t0;
	let t1;
	if ($[0] !== enabled || $[1] !== renderer) {
		t0 = () => {
			if (!enabled || renderer) return;
			let cancelled = false;
			loadBeautifulMermaid().then((loadedRenderer) => {
				if (!cancelled) setRenderer(() => loadedRenderer);
			});
			return () => {
				cancelled = true;
			};
		};
		t1 = [enabled, renderer];
		$[0] = enabled;
		$[1] = renderer;
		$[2] = t0;
		$[3] = t1;
	} else {
		t0 = $[2];
		t1 = $[3];
	}
	useEffect(t0, t1);
	return renderer;
}

// src/hooks/use-katex.ts
/**
* The lazily loaded KaTeX render function, or `undefined` while it loads (or when
* `enabled` is false, so a document without math never loads it).
*/
function useKaTeX(enabled) {
	const $ = c(4);
	const [katex, setKaTeX] = useState(void 0);
	let t0;
	let t1;
	if ($[0] !== enabled || $[1] !== katex) {
		t0 = () => {
			if (!enabled || katex) return;
			let cancelled = false;
			loadKaTeX().then((render) => {
				if (!cancelled) setKaTeX(() => render);
			});
			return () => {
				cancelled = true;
			};
		};
		t1 = [enabled, katex];
		$[0] = enabled;
		$[1] = katex;
		$[2] = t0;
		$[3] = t1;
	} else {
		t0 = $[2];
		t1 = $[3];
	}
	useEffect(t0, t1);
	return katex;
}

// src/utils/non-prose-props.ts
const NON_PROSE_PROPS = {
	spellCheck: false,
	autoCorrect: "off",
	autoCapitalize: "off",
	writingsuggestions: "false"
};

// src/components/code-block-view.module.css
var code_block_view_module_default = {
	"CopyButton": "meow_CopyButton_U9Fqfa",
	"Empty": "meow_Empty_U9Fqfa",
	"Item": "meow_Item_U9Fqfa",
	"ItemIndicator": "meow_ItemIndicator_U9Fqfa",
	"ItemText": "meow_ItemText_U9Fqfa",
	"List": "meow_List_U9Fqfa",
	"MermaidPreview": "meow_MermaidPreview_U9Fqfa",
	"Popup": "meow_Popup_U9Fqfa",
	"Positioner": "meow_Positioner_U9Fqfa",
	"Preview": "meow_Preview_U9Fqfa",
	"Root": "meow_Root_U9Fqfa",
	"Search": "meow_Search_U9Fqfa",
	"SearchRow": "meow_SearchRow_U9Fqfa",
	"Toolbar": "meow_Toolbar_U9Fqfa",
	"Trigger": "meow_Trigger_U9Fqfa",
	"TriggerIcon": "meow_TriggerIcon_U9Fqfa"
};

// src/components/collision-boundary.ts
/**
* See `EditorProps.collisionBoundary`.
*/
const CollisionBoundaryContext = createContext(void 0);
/**
* Converts a {@link CollisionBoundary} to the `boundary` prop of ProseKit
* positioners, which spell the keyword the floating-ui way.
*/
function toFloatingBoundary(boundary) {
	return boundary === "clipping-ancestors" ? "clippingAncestors" : boundary;
}

// src/components/copy-button.tsx
const COPIED_RESET_MS = 1500;
/**
* A copy-to-clipboard button with "copied" feedback. Shared by the code block
* toolbar and the link popover.
*/
function CopyButton(t0) {
	const $ = c(19);
	let className;
	let getText;
	let label;
	let onCopy;
	let rest;
	if ($[0] !== t0) {
		({getText, label, onCopy, className, ...rest} = t0);
		$[0] = t0;
		$[1] = className;
		$[2] = getText;
		$[3] = label;
		$[4] = onCopy;
		$[5] = rest;
	} else {
		className = $[1];
		getText = $[2];
		label = $[3];
		onCopy = $[4];
		rest = $[5];
	}
	const [copied, setCopied] = useState(false);
	const resetTimerRef = useRef(void 0);
	let t1;
	if ($[6] !== getText || $[7] !== onCopy) {
		t1 = async () => {
			try {
				await navigator.clipboard.writeText(getText());
			} catch (t2) {
				console.warn("[meowdown] Failed to copy:", t2);
				return;
			}
			setCopied(true);
			clearTimeout(resetTimerRef.current);
			resetTimerRef.current = setTimeout(() => setCopied(false), COPIED_RESET_MS);
			onCopy?.();
		};
		$[6] = getText;
		$[7] = onCopy;
		$[8] = t1;
	} else t1 = $[8];
	const copy = t1;
	const t2 = copied ? "" : void 0;
	const t3 = copied ? "Copied" : label;
	const t4 = copied ? "Copied" : label;
	let t5;
	if ($[9] !== copied) {
		t5 = copied ? /* @__PURE__ */ jsx(CheckIcon, {}) : /* @__PURE__ */ jsx(CopyIcon, {});
		$[9] = copied;
		$[10] = t5;
	} else t5 = $[10];
	let t6;
	if ($[11] !== className || $[12] !== copy || $[13] !== rest || $[14] !== t2 || $[15] !== t3 || $[16] !== t4 || $[17] !== t5) {
		t6 = /* @__PURE__ */ jsx("button", {
			type: "button",
			className,
			"data-copied": t2,
			"aria-label": t3,
			title: t4,
			onMouseDown: _temp$4,
			onClick: copy,
			...rest,
			children: t5
		});
		$[11] = className;
		$[12] = copy;
		$[13] = rest;
		$[14] = t2;
		$[15] = t3;
		$[16] = t4;
		$[17] = t5;
		$[18] = t6;
	} else t6 = $[18];
	return t6;
}
function _temp$4(event) {
	return event.preventDefault();
}

// src/components/math-render.tsx
/**
* KaTeX output rendered into a real element, the same way the editor's
* `MathMarkView` does. A span host matches KaTeX's own output shape; display
* mode emits a block-level `math[display="block"]` element.
*/
function MathRender(props) {
	const $ = c(9);
	const { katex, formula, displayMode, className, onMouseDown } = props;
	const ref = useRef(null);
	let t0;
	let t1;
	if ($[0] !== displayMode || $[1] !== formula || $[2] !== katex) {
		t0 = () => {
			const element = ref.current;
			if (!element) return;
			renderMathInto(katex, element, formula, displayMode);
		};
		t1 = [
			katex,
			formula,
			displayMode
		];
		$[0] = displayMode;
		$[1] = formula;
		$[2] = katex;
		$[3] = t0;
		$[4] = t1;
	} else {
		t0 = $[3];
		t1 = $[4];
	}
	useLayoutEffect(t0, t1);
	const t2 = props["data-testid"];
	let t3;
	if ($[5] !== className || $[6] !== onMouseDown || $[7] !== t2) {
		t3 = /* @__PURE__ */ jsx("span", {
			ref,
			className,
			contentEditable: false,
			"data-testid": t2,
			onMouseDown
		});
		$[5] = className;
		$[6] = onMouseDown;
		$[7] = t2;
		$[8] = t3;
	} else t3 = $[8];
	return t3;
}

// src/components/mermaid-render.tsx
const MERMAID_OPTIONS = {
	bg: "var(--meowdown-mermaid-bg)",
	fg: "var(--meowdown-mermaid-fg)",
	line: "var(--meowdown-mermaid-line)",
	accent: "var(--meowdown-mermaid-accent)",
	muted: "var(--meowdown-mermaid-muted)",
	surface: "var(--meowdown-mermaid-surface)",
	border: "var(--meowdown-mermaid-border)",
	transparent: true,
	interactive: false
};
function renderMermaid(renderer, source) {
	try {
		const svg = renderer(source, MERMAID_OPTIONS);
		const document = new DOMParser().parseFromString(svg, "image/svg+xml");
		const element = document.documentElement;
		if (document.querySelector("parsererror") || element.localName !== "svg" || element.namespaceURI !== "http://www.w3.org/2000/svg") return { error: "Invalid SVG output." };
		return { element };
	} catch (error) {
		return { error: error instanceof Error ? error.message : String(error) };
	}
}
function MermaidRender(props) {
	const $ = c(16);
	const { renderer, source, className, onMouseDown } = props;
	let t0;
	if ($[0] !== renderer || $[1] !== source) {
		t0 = renderMermaid(renderer, source);
		$[0] = renderer;
		$[1] = source;
		$[2] = t0;
	} else t0 = $[2];
	const output = t0;
	const ref = useRef(null);
	let t1;
	if ($[3] !== output.element) {
		t1 = () => {
			const host = ref.current;
			if (!host || !output.element) return;
			host.replaceChildren(window.document.importNode(output.element, true));
		};
		$[3] = output.element;
		$[4] = t1;
	} else t1 = $[4];
	let t2;
	if ($[5] !== output) {
		t2 = [output];
		$[5] = output;
		$[6] = t2;
	} else t2 = $[6];
	useLayoutEffect(t1, t2);
	if (output.error) {
		const t3 = props["data-testid"];
		let t4;
		if ($[7] !== className || $[8] !== onMouseDown || $[9] !== output.error || $[10] !== t3) {
			t4 = /* @__PURE__ */ jsx("span", {
				className,
				contentEditable: false,
				"data-error": true,
				"data-testid": t3,
				onMouseDown,
				children: output.error
			}, "error");
			$[7] = className;
			$[8] = onMouseDown;
			$[9] = output.error;
			$[10] = t3;
			$[11] = t4;
		} else t4 = $[11];
		return t4;
	}
	const t3 = props["data-testid"];
	let t4;
	if ($[12] !== className || $[13] !== onMouseDown || $[14] !== t3) {
		t4 = /* @__PURE__ */ jsx("span", {
			ref,
			className,
			contentEditable: false,
			"data-testid": t3,
			onMouseDown
		}, "svg");
		$[12] = className;
		$[13] = onMouseDown;
		$[14] = t3;
		$[15] = t4;
	} else t4 = $[15];
	return t4;
}

// src/components/code-block-view.tsx
function CodeBlockView(props) {
	const $ = c(36);
	const { node, view, getPos, decorations, selected, setAttrs, contentRef } = props;
	const language = node.attrs.language || "";
	const isMath = language === "math";
	const isMermaid = language === "mermaid";
	const code = node.textContent;
	let t0;
	if ($[0] !== decorations) {
		t0 = decorations.some(isCodeBlockPreviewHiddenDecoration);
		$[0] = decorations;
		$[1] = t0;
	} else t0 = $[1];
	const caretInside = t0;
	const katex = useKaTeX(isMath);
	const mermaid = useBeautifulMermaid(isMermaid);
	const showMathPreview = isMath && katex != null;
	const showMermaidPreview = isMermaid && mermaid != null;
	const showPreview = showMathPreview || showMermaidPreview;
	const previewCode = useDeferredValue(showPreview ? code : "");
	let t1;
	if ($[2] !== caretInside || $[3] !== code || $[4] !== showPreview) {
		t1 = showPreview && !caretInside && code.trim() !== "";
		$[2] = caretInside;
		$[3] = code;
		$[4] = showPreview;
		$[5] = t1;
	} else t1 = $[5];
	const previewOnly = t1;
	let t2;
	if ($[6] !== getPos || $[7] !== view) {
		t2 = (event) => {
			event.preventDefault();
			const pos = getPos();
			if (pos == null) return;
			const selection = TextSelection.near(view.state.doc.resolve(pos + 1), 1);
			view.dispatch(view.state.tr.setSelection(selection));
			view.focus();
		};
		$[6] = getPos;
		$[7] = view;
		$[8] = t2;
	} else t2 = $[8];
	const focusSource = t2;
	let t3;
	if ($[9] !== setAttrs) {
		t3 = (language_0) => {
			setAttrs({ language: language_0 });
		};
		$[9] = setAttrs;
		$[10] = t3;
	} else t3 = $[10];
	const setLanguage = t3;
	const t4 = previewOnly || void 0;
	const t5 = selected || void 0;
	let t6;
	if ($[11] !== contentRef || $[12] !== language) {
		t6 = /* @__PURE__ */ jsx("pre", {
			ref: contentRef,
			"data-language": language,
			...NON_PROSE_PROPS
		});
		$[11] = contentRef;
		$[12] = language;
		$[13] = t6;
	} else t6 = $[13];
	let t7;
	if ($[14] !== code || $[15] !== language || $[16] !== selected || $[17] !== setLanguage) {
		t7 = selected ? null : /* @__PURE__ */ jsx(CodeBlockToolbar, {
			code,
			language,
			setLanguage
		});
		$[14] = code;
		$[15] = language;
		$[16] = selected;
		$[17] = setLanguage;
		$[18] = t7;
	} else t7 = $[18];
	let t8;
	if ($[19] !== focusSource || $[20] !== katex || $[21] !== previewCode || $[22] !== showMathPreview) {
		t8 = showMathPreview && /* @__PURE__ */ jsx(MathRender, {
			katex,
			formula: previewCode,
			displayMode: true,
			className: code_block_view_module_default.Preview,
			"data-testid": "code-block-math-preview",
			onMouseDown: focusSource
		});
		$[19] = focusSource;
		$[20] = katex;
		$[21] = previewCode;
		$[22] = showMathPreview;
		$[23] = t8;
	} else t8 = $[23];
	let t9;
	if ($[24] !== focusSource || $[25] !== mermaid || $[26] !== previewCode || $[27] !== showMermaidPreview) {
		t9 = showMermaidPreview && /* @__PURE__ */ jsx(MermaidRender, {
			renderer: mermaid,
			source: previewCode,
			className: `${code_block_view_module_default.Preview} ${code_block_view_module_default.MermaidPreview}`,
			"data-testid": "code-block-mermaid-preview",
			onMouseDown: focusSource
		});
		$[24] = focusSource;
		$[25] = mermaid;
		$[26] = previewCode;
		$[27] = showMermaidPreview;
		$[28] = t9;
	} else t9 = $[28];
	let t10;
	if ($[29] !== t4 || $[30] !== t5 || $[31] !== t6 || $[32] !== t7 || $[33] !== t8 || $[34] !== t9) {
		t10 = /* @__PURE__ */ jsxs("div", {
			className: code_block_view_module_default.Root,
			"data-preview": t4,
			"data-selected": t5,
			"data-testid": "code-block",
			children: [
				t6,
				t7,
				t8,
				t9
			]
		});
		$[29] = t4;
		$[30] = t5;
		$[31] = t6;
		$[32] = t7;
		$[33] = t8;
		$[34] = t9;
		$[35] = t10;
	} else t10 = $[35];
	return t10;
}
function CodeBlockToolbar(t0) {
	const $ = c(9);
	const { code, language, setLanguage } = t0;
	const [comboboxOpen, setComboboxOpen] = useState(false);
	const t1 = comboboxOpen || void 0;
	let t2;
	if ($[0] !== language || $[1] !== setLanguage) {
		t2 = /* @__PURE__ */ jsx(CodeBlockLanguagePickerMemo, {
			language,
			setLanguage,
			onShownChange: setComboboxOpen
		});
		$[0] = language;
		$[1] = setLanguage;
		$[2] = t2;
	} else t2 = $[2];
	let t3;
	if ($[3] !== code) {
		t3 = /* @__PURE__ */ jsx(CopyButton, {
			getText: () => code,
			label: "Copy code",
			className: code_block_view_module_default.CopyButton,
			"data-testid": "code-block-copy"
		});
		$[3] = code;
		$[4] = t3;
	} else t3 = $[4];
	let t4;
	if ($[5] !== t1 || $[6] !== t2 || $[7] !== t3) {
		t4 = /* @__PURE__ */ jsxs("div", {
			className: code_block_view_module_default.Toolbar,
			contentEditable: false,
			"data-open": t1,
			children: [t2, t3]
		});
		$[5] = t1;
		$[6] = t2;
		$[7] = t3;
		$[8] = t4;
	} else t4 = $[8];
	return t4;
}
function CodeBlockLanguagePicker(t0) {
	const $ = c(22);
	const { language, setLanguage, onShownChange } = t0;
	const collisionBoundary = use(CollisionBoundaryContext);
	let t1;
	if ($[0] !== language) {
		t1 = codeBlockLanguages.find((item) => item.value === language) ?? {
			value: language,
			label: language
		};
		$[0] = language;
		$[1] = t1;
	} else t1 = $[1];
	const selected = t1;
	const [query, setQuery] = useState("");
	let t2;
	if ($[2] !== query) {
		bb0: {
			const value = query.trim();
			if (!value) {
				t2 = codeBlockLanguages;
				break bb0;
			}
			const lowercased = value.toLowerCase();
			t2 = codeBlockLanguages.some((item_0) => item_0.value.toLowerCase() === lowercased || item_0.label.toLowerCase() === lowercased) ? codeBlockLanguages : [...codeBlockLanguages, {
				value,
				label: `Use "${value}"`
			}];
		}
		$[2] = query;
		$[3] = t2;
	} else t2 = $[3];
	const itemsForView = t2;
	let t3;
	if ($[4] !== setLanguage) {
		t3 = (item_1) => setLanguage(item_1?.value ?? "");
		$[4] = setLanguage;
		$[5] = t3;
	} else t3 = $[5];
	let t4;
	let t5;
	if ($[6] !== onShownChange) {
		t4 = (open) => {
			if (open) onShownChange(true);
			else setQuery("");
		};
		t5 = (open_0) => {
			if (!open_0) onShownChange(false);
		};
		$[6] = onShownChange;
		$[7] = t4;
		$[8] = t5;
	} else {
		t4 = $[7];
		t5 = $[8];
	}
	let t6;
	if ($[9] === Symbol.for("react.memo_cache_sentinel")) {
		t6 = /* @__PURE__ */ jsx(Combobox.Value, { placeholder: "Plain Text" });
		$[9] = t6;
	} else t6 = $[9];
	let t7;
	if ($[10] === Symbol.for("react.memo_cache_sentinel")) {
		t7 = /* @__PURE__ */ jsxs(Combobox.Trigger, {
			className: code_block_view_module_default.Trigger,
			"data-testid": "code-block-language",
			children: [t6, /* @__PURE__ */ jsx(Combobox.Icon, {
				className: code_block_view_module_default.TriggerIcon,
				children: /* @__PURE__ */ jsx(ChevronsUpDownIcon, {})
			})]
		});
		$[10] = t7;
	} else t7 = $[10];
	let t8;
	if ($[11] === Symbol.for("react.memo_cache_sentinel")) {
		t8 = /* @__PURE__ */ jsxs(Combobox.Popup, {
			className: code_block_view_module_default.Popup,
			children: [
				/* @__PURE__ */ jsx("div", {
					className: code_block_view_module_default.SearchRow,
					children: /* @__PURE__ */ jsx(Combobox.Input, {
						className: code_block_view_module_default.Search,
						placeholder: "Search or type a language",
						"data-testid": "code-block-language-search"
					})
				}),
				/* @__PURE__ */ jsx(Combobox.Empty, {
					className: code_block_view_module_default.Empty,
					children: "No languages found."
				}),
				/* @__PURE__ */ jsx(Combobox.List, {
					className: code_block_view_module_default.List,
					children: _temp$3
				})
			]
		});
		$[11] = t8;
	} else t8 = $[11];
	let t9;
	if ($[12] !== collisionBoundary) {
		t9 = /* @__PURE__ */ jsx(Combobox.Portal, { children: /* @__PURE__ */ jsx(Combobox.Positioner, {
			className: code_block_view_module_default.Positioner,
			sideOffset: 4,
			collisionBoundary,
			children: t8
		}) });
		$[12] = collisionBoundary;
		$[13] = t9;
	} else t9 = $[13];
	let t10;
	if ($[14] !== itemsForView || $[15] !== query || $[16] !== selected || $[17] !== t3 || $[18] !== t4 || $[19] !== t5 || $[20] !== t9) {
		t10 = /* @__PURE__ */ jsxs(Combobox.Root, {
			items: itemsForView,
			value: selected,
			onValueChange: t3,
			inputValue: query,
			onInputValueChange: setQuery,
			onOpenChange: t4,
			onOpenChangeComplete: t5,
			children: [t7, t9]
		});
		$[14] = itemsForView;
		$[15] = query;
		$[16] = selected;
		$[17] = t3;
		$[18] = t4;
		$[19] = t5;
		$[20] = t9;
		$[21] = t10;
	} else t10 = $[21];
	return t10;
}
function _temp$3(item_2) {
	return /* @__PURE__ */ jsxs(Combobox.Item, {
		value: item_2,
		className: code_block_view_module_default.Item,
		children: [/* @__PURE__ */ jsx(Combobox.ItemIndicator, {
			className: code_block_view_module_default.ItemIndicator,
			children: /* @__PURE__ */ jsx(CheckIcon, {})
		}), /* @__PURE__ */ jsx("span", {
			className: code_block_view_module_default.ItemText,
			children: item_2.label
		})]
	}, item_2.label);
}
const CodeBlockLanguagePickerMemo = /* @__PURE__ */ memo(CodeBlockLanguagePicker);

// src/extensions/code-block-view.ts
function defineCodeBlockView(component = CodeBlockView) {
	return union(defineReactNodeView({
		name: "codeBlock",
		contentAs: "code",
		component
	}), defineCodeBlockPreviewPlugin());
}

// src/components/block-handle.module.css
var block_handle_module_default = {
	"Draggable": "meow_Draggable_3uJCGG",
	"Popup": "meow_Popup_3uJCGG",
	"Positioner": "meow_Positioner_3uJCGG"
};

// src/components/block-handle.tsx
function BlockHandle() {
	const $ = c(1);
	let t0;
	if ($[0] === Symbol.for("react.memo_cache_sentinel")) {
		t0 = /* @__PURE__ */ jsx(BlockHandleRoot, { children: /* @__PURE__ */ jsx(BlockHandlePositioner, {
			className: block_handle_module_default.Positioner,
			children: /* @__PURE__ */ jsx(BlockHandlePopup, {
				className: block_handle_module_default.Popup,
				"data-testid": "block-handle",
				children: /* @__PURE__ */ jsx(BlockHandleDraggable, {
					className: block_handle_module_default.Draggable,
					"data-testid": "block-handle-drag",
					children: /* @__PURE__ */ jsx(GripVerticalIcon, {})
				})
			})
		}) });
		$[0] = t0;
	} else t0 = $[0];
	return t0;
}

// src/components/drop-indicator.module.css
var drop_indicator_module_default = { "DropIndicator": "meow_DropIndicator_dZ-6sG" };

// src/components/drop-indicator.tsx
function DropIndicator$1() {
	const $ = c(1);
	let t0;
	if ($[0] === Symbol.for("react.memo_cache_sentinel")) {
		t0 = /* @__PURE__ */ jsx(DropIndicator, {
			className: drop_indicator_module_default.DropIndicator,
			"data-testid": "drop-indicator"
		});
		$[0] = t0;
	} else t0 = $[0];
	return t0;
}

// src/components/editor-extensions.tsx
function EditorExtensions(t0) {
	const $ = c(14);
	const { config, searchQuery, onDocChange, onSearchChange } = t0;
	const editor = useEditor$1();
	let t1;
	let t2;
	if ($[0] !== config || $[1] !== editor) {
		t1 = () => {
			const timer = setTimeout(() => updateEditorConfig(editor, config));
			return () => clearTimeout(timer);
		};
		t2 = [editor, config];
		$[0] = config;
		$[1] = editor;
		$[2] = t1;
		$[3] = t2;
	} else {
		t1 = $[2];
		t2 = $[3];
	}
	useEffect(t1, t2);
	const deferredSearchQuery = useDeferredValue(searchQuery);
	let t3;
	if ($[4] !== deferredSearchQuery || $[5] !== editor.commands) {
		t3 = () => {
			editor.commands.setSearchQuery({
				search: deferredSearchQuery,
				literal: true
			});
		};
		$[4] = deferredSearchQuery;
		$[5] = editor.commands;
		$[6] = t3;
	} else t3 = $[6];
	let t4;
	if ($[7] !== deferredSearchQuery || $[8] !== editor) {
		t4 = [editor, deferredSearchQuery];
		$[7] = deferredSearchQuery;
		$[8] = editor;
		$[9] = t4;
	} else t4 = $[9];
	useEffect(t3, t4);
	let t5;
	if ($[10] !== onDocChange) {
		t5 = onDocChange ? defineDocChangeHandler(onDocChange) : null;
		$[10] = onDocChange;
		$[11] = t5;
	} else t5 = $[11];
	useExtension$1(t5);
	let t6;
	if ($[12] !== onSearchChange) {
		t6 = onSearchChange ? defineSearchStatusHandler(onSearchChange) : null;
		$[12] = onSearchChange;
		$[13] = t6;
	} else t6 = $[13];
	useExtension$1(t6);
	return null;
}

// src/components/link-menu-state.ts
const LINK_MENU_IDLE = { kind: "idle" };
/**
* What the popup renders: the open view, or the closing one during the exit
* animation.
*/
function getLinkMenuView(state) {
	switch (state.kind) {
		case "idle": return;
		case "closing": return state.view;
		default: return state;
	}
}
function reduceLinkMenu(state, event) {
	switch (event.type) {
		case "hover":
			if (state.kind === "edit") return state;
			if (event.link) return {
				kind: "preview",
				link: event.link
			};
			return state.kind === "preview" ? {
				kind: "closing",
				view: state
			} : state;
		case "edit": return {
			kind: "edit",
			edit: event.edit
		};
		case "close": return state.kind === "preview" || state.kind === "edit" ? {
			kind: "closing",
			view: state
		} : state;
		case "closed": return state.kind === "closing" ? LINK_MENU_IDLE : state;
	}
}

// src/components/link-menu.module.css
var link_menu_module_default = {
	"Actions": "meow_Actions_0GRvpq",
	"Button": "meow_Button_0GRvpq",
	"Description": "meow_Description_0GRvpq",
	"Field": "meow_Field_0GRvpq",
	"Form": "meow_Form_0GRvpq",
	"FormActions": "meow_FormActions_0GRvpq",
	"Host": "meow_Host_0GRvpq",
	"Icon": "meow_Icon_0GRvpq",
	"Input": "meow_Input_0GRvpq",
	"Popup": "meow_Popup_0GRvpq",
	"Positioner": "meow_Positioner_0GRvpq",
	"Preview": "meow_Preview_0GRvpq",
	"PreviewBody": "meow_PreviewBody_0GRvpq",
	"pulse": "meow_pulse_0GRvpq",
	"RemoveButton": "meow_RemoveButton_0GRvpq",
	"ReplaceButton": "meow_ReplaceButton_0GRvpq",
	"ReplaceRow": "meow_ReplaceRow_0GRvpq",
	"Row": "meow_Row_0GRvpq",
	"SaveButton": "meow_SaveButton_0GRvpq",
	"Skeleton": "meow_Skeleton_0GRvpq",
	"SkeletonLine": "meow_SkeletonLine_0GRvpq",
	"SkeletonLineShort": "meow_SkeletonLineShort_0GRvpq",
	"Title": "meow_Title_0GRvpq",
	"Url": "meow_Url_0GRvpq",
	"UseTitleButton": "meow_UseTitleButton_0GRvpq"
};

// src/components/link-menu.tsx
function useLinkPreview(href, resolveLinkPreview) {
	const $ = c(8);
	const [settled, setSettled] = useState();
	let t0;
	let t1;
	if ($[0] !== href || $[1] !== resolveLinkPreview) {
		t0 = () => {
			if (!href || !resolveLinkPreview || !isWebHref(href)) return;
			let stale = false;
			Promise.resolve().then(() => resolveLinkPreview(href)).then((preview) => {
				if (!stale) setSettled({
					href,
					result: preview ? {
						status: "resolved",
						preview
					} : { status: "failed" }
				});
			}).catch(() => {
				if (!stale) setSettled({
					href,
					result: { status: "failed" }
				});
			});
			return () => {
				stale = true;
			};
		};
		t1 = [href, resolveLinkPreview];
		$[0] = href;
		$[1] = resolveLinkPreview;
		$[2] = t0;
		$[3] = t1;
	} else {
		t0 = $[2];
		t1 = $[3];
	}
	useEffect(t0, t1);
	if (!href || !resolveLinkPreview || !isWebHref(href)) {
		let t2;
		if ($[4] === Symbol.for("react.memo_cache_sentinel")) {
			t2 = { status: "idle" };
			$[4] = t2;
		} else t2 = $[4];
		return t2;
	}
	let t2;
	if ($[5] !== href || $[6] !== settled) {
		t2 = settled?.href === href ? settled.result : { status: "loading" };
		$[5] = href;
		$[6] = settled;
		$[7] = t2;
	} else t2 = $[7];
	return t2;
}
function isWebHref(href) {
	try {
		const protocol = new URL(href).protocol;
		return protocol === "https:" || protocol === "http:";
	} catch {
		return false;
	}
}
function selectLinkUnit(editor, link) {
	editor.commands.selectText(link.unit.from, link.unit.to);
	editor.focus();
}
function LinkPopover(t0) {
	const $ = c(20);
	const { anchor, open, onClose, onCloseComplete, onPopupHover, children } = t0;
	const collisionBoundary = use(CollisionBoundaryContext);
	let t1;
	if ($[0] !== onClose) {
		t1 = (open_0) => {
			if (!open_0) onClose();
		};
		$[0] = onClose;
		$[1] = t1;
	} else t1 = $[1];
	let t2;
	if ($[2] !== onCloseComplete) {
		t2 = (open_1) => {
			if (!open_1) onCloseComplete?.();
		};
		$[2] = onCloseComplete;
		$[3] = t2;
	} else t2 = $[3];
	let t3;
	let t4;
	if ($[4] !== onPopupHover) {
		t3 = () => onPopupHover?.(true);
		t4 = () => onPopupHover?.(false);
		$[4] = onPopupHover;
		$[5] = t3;
		$[6] = t4;
	} else {
		t3 = $[5];
		t4 = $[6];
	}
	let t5;
	if ($[7] !== children || $[8] !== t3 || $[9] !== t4) {
		t5 = /* @__PURE__ */ jsx(Popover.Popup, {
			className: link_menu_module_default.Popup,
			"data-testid": "link-popover",
			initialFocus: false,
			finalFocus: false,
			onMouseEnter: t3,
			onMouseLeave: t4,
			children
		});
		$[7] = children;
		$[8] = t3;
		$[9] = t4;
		$[10] = t5;
	} else t5 = $[10];
	let t6;
	if ($[11] !== anchor || $[12] !== collisionBoundary || $[13] !== t5) {
		t6 = /* @__PURE__ */ jsx(Popover.Portal, { children: /* @__PURE__ */ jsx(Popover.Positioner, {
			anchor,
			side: "bottom",
			sideOffset: 8,
			collisionBoundary,
			className: link_menu_module_default.Positioner,
			children: t5
		}) });
		$[11] = anchor;
		$[12] = collisionBoundary;
		$[13] = t5;
		$[14] = t6;
	} else t6 = $[14];
	let t7;
	if ($[15] !== open || $[16] !== t1 || $[17] !== t2 || $[18] !== t6) {
		t7 = /* @__PURE__ */ jsx(Popover.Root, {
			open,
			onOpenChange: t1,
			onOpenChangeComplete: t2,
			children: t6
		});
		$[15] = open;
		$[16] = t1;
		$[17] = t2;
		$[18] = t6;
		$[19] = t7;
	} else t7 = $[19];
	return t7;
}
function LinkAnchor(t0) {
	const $ = c(8);
	const { href, className, onLinkClick, children } = t0;
	let t1;
	if ($[0] !== href || $[1] !== onLinkClick) {
		t1 = (event) => {
			if (!onLinkClick) return;
			event.preventDefault();
			onLinkClick({
				href,
				event: event.nativeEvent,
				mod: isModEvent(event)
			});
		};
		$[0] = href;
		$[1] = onLinkClick;
		$[2] = t1;
	} else t1 = $[2];
	let t2;
	if ($[3] !== children || $[4] !== className || $[5] !== href || $[6] !== t1) {
		t2 = /* @__PURE__ */ jsx("a", {
			className,
			href,
			title: href,
			target: "_blank",
			rel: "noopener noreferrer",
			onClick: t1,
			children
		});
		$[3] = children;
		$[4] = className;
		$[5] = href;
		$[6] = t1;
		$[7] = t2;
	} else t2 = $[7];
	return t2;
}
function LinkActions(t0) {
	const $ = c(16);
	const { href, onLinkCopy, onEdit, onRemove } = t0;
	let t1;
	if ($[0] !== href) {
		t1 = () => href;
		$[0] = href;
		$[1] = t1;
	} else t1 = $[1];
	let t2;
	if ($[2] !== href || $[3] !== onLinkCopy) {
		t2 = () => onLinkCopy?.({ href });
		$[2] = href;
		$[3] = onLinkCopy;
		$[4] = t2;
	} else t2 = $[4];
	let t3;
	if ($[5] !== t1 || $[6] !== t2) {
		t3 = /* @__PURE__ */ jsx(CopyButton, {
			getText: t1,
			label: "Copy link",
			className: link_menu_module_default.Button,
			onCopy: t2
		});
		$[5] = t1;
		$[6] = t2;
		$[7] = t3;
	} else t3 = $[7];
	let t4;
	if ($[8] !== onEdit) {
		t4 = onEdit && /* @__PURE__ */ jsx("button", {
			type: "button",
			className: link_menu_module_default.Button,
			title: "Edit link",
			"aria-label": "Edit link",
			onClick: onEdit,
			children: /* @__PURE__ */ jsx(PencilIcon, {})
		});
		$[8] = onEdit;
		$[9] = t4;
	} else t4 = $[9];
	let t5;
	if ($[10] !== onRemove) {
		t5 = onRemove && /* @__PURE__ */ jsx("button", {
			type: "button",
			className: link_menu_module_default.Button,
			title: "Remove link",
			"aria-label": "Remove link",
			onClick: onRemove,
			children: /* @__PURE__ */ jsx(UnlinkIcon, {})
		});
		$[10] = onRemove;
		$[11] = t5;
	} else t5 = $[11];
	let t6;
	if ($[12] !== t3 || $[13] !== t4 || $[14] !== t5) {
		t6 = /* @__PURE__ */ jsxs("div", {
			className: link_menu_module_default.Actions,
			children: [
				t3,
				t4,
				t5
			]
		});
		$[12] = t3;
		$[13] = t4;
		$[14] = t5;
		$[15] = t6;
	} else t6 = $[15];
	return t6;
}
function PreviewIcon(t0) {
	const $ = c(4);
	const { preview } = t0;
	const [failed, setFailed] = useState(false);
	if (!preview.iconSrc || failed) {
		let t1;
		if ($[0] === Symbol.for("react.memo_cache_sentinel")) {
			t1 = /* @__PURE__ */ jsx(Globe2Icon, { "aria-hidden": "true" });
			$[0] = t1;
		} else t1 = $[0];
		return t1;
	}
	let t1;
	if ($[1] === Symbol.for("react.memo_cache_sentinel")) {
		t1 = () => setFailed(true);
		$[1] = t1;
	} else t1 = $[1];
	let t2;
	if ($[2] !== preview.iconSrc) {
		t2 = /* @__PURE__ */ jsx("img", {
			src: preview.iconSrc,
			alt: "",
			onError: t1
		});
		$[2] = preview.iconSrc;
		$[3] = t2;
	} else t2 = $[3];
	return t2;
}
function getHostname(href) {
	try {
		return new URL(href).hostname;
	} catch {
		return href;
	}
}
function LinkInfoContent(t0) {
	const $ = c(47);
	const { href, previewState, onLinkClick, onLinkCopy, onEdit, onRemove, onUseTitle } = t0;
	if (previewState.status === "resolved") {
		const { preview } = previewState;
		let t1;
		if ($[0] !== preview) {
			t1 = /* @__PURE__ */ jsx("div", {
				className: link_menu_module_default.Icon,
				children: /* @__PURE__ */ jsx(PreviewIcon, { preview }, preview.iconSrc)
			});
			$[0] = preview;
			$[1] = t1;
		} else t1 = $[1];
		let t2;
		if ($[2] !== href || $[3] !== onLinkClick || $[4] !== preview.title) {
			t2 = /* @__PURE__ */ jsx(LinkAnchor, {
				href,
				className: link_menu_module_default.Title,
				onLinkClick,
				children: preview.title
			});
			$[2] = href;
			$[3] = onLinkClick;
			$[4] = preview.title;
			$[5] = t2;
		} else t2 = $[5];
		let t3;
		if ($[6] !== href) {
			t3 = getHostname(href);
			$[6] = href;
			$[7] = t3;
		} else t3 = $[7];
		let t4;
		if ($[8] !== t3) {
			t4 = /* @__PURE__ */ jsx("div", {
				className: link_menu_module_default.Host,
				children: t3
			});
			$[8] = t3;
			$[9] = t4;
		} else t4 = $[9];
		let t5;
		if ($[10] !== t2 || $[11] !== t4) {
			t5 = /* @__PURE__ */ jsxs("div", {
				className: link_menu_module_default.PreviewBody,
				children: [t2, t4]
			});
			$[10] = t2;
			$[11] = t4;
			$[12] = t5;
		} else t5 = $[12];
		let t6;
		if ($[13] !== href || $[14] !== onEdit || $[15] !== onLinkCopy || $[16] !== onRemove) {
			t6 = /* @__PURE__ */ jsx(LinkActions, {
				href,
				onLinkCopy,
				onEdit,
				onRemove
			});
			$[13] = href;
			$[14] = onEdit;
			$[15] = onLinkCopy;
			$[16] = onRemove;
			$[17] = t6;
		} else t6 = $[17];
		let t7;
		if ($[18] !== t1 || $[19] !== t5 || $[20] !== t6) {
			t7 = /* @__PURE__ */ jsxs("div", {
				className: link_menu_module_default.Preview,
				children: [
					t1,
					t5,
					t6
				]
			});
			$[18] = t1;
			$[19] = t5;
			$[20] = t6;
			$[21] = t7;
		} else t7 = $[21];
		let t8;
		if ($[22] !== preview.description) {
			t8 = preview.description && /* @__PURE__ */ jsx("p", {
				className: link_menu_module_default.Description,
				children: preview.description
			});
			$[22] = preview.description;
			$[23] = t8;
		} else t8 = $[23];
		let t9;
		if ($[24] !== onUseTitle || $[25] !== preview.title) {
			t9 = onUseTitle && /* @__PURE__ */ jsxs("div", {
				className: link_menu_module_default.ReplaceRow,
				children: [
					/* @__PURE__ */ jsx(SparklesIcon, { "aria-hidden": "true" }),
					/* @__PURE__ */ jsx("span", { children: "Replace URL with its title?" }),
					/* @__PURE__ */ jsx("button", {
						type: "button",
						className: link_menu_module_default.ReplaceButton,
						"aria-label": "Replace URL with its title",
						onClick: () => onUseTitle(preview.title),
						children: "Yes"
					})
				]
			});
			$[24] = onUseTitle;
			$[25] = preview.title;
			$[26] = t9;
		} else t9 = $[26];
		let t10;
		if ($[27] !== t7 || $[28] !== t8 || $[29] !== t9) {
			t10 = /* @__PURE__ */ jsxs("div", {
				"data-testid": "link-popover-info",
				children: [
					t7,
					t8,
					t9
				]
			});
			$[27] = t7;
			$[28] = t8;
			$[29] = t9;
			$[30] = t10;
		} else t10 = $[30];
		return t10;
	}
	let t1;
	if ($[31] !== href || $[32] !== onLinkClick) {
		t1 = /* @__PURE__ */ jsx(LinkAnchor, {
			href,
			className: link_menu_module_default.Url,
			onLinkClick,
			children: href
		});
		$[31] = href;
		$[32] = onLinkClick;
		$[33] = t1;
	} else t1 = $[33];
	let t2;
	if ($[34] !== href || $[35] !== onEdit || $[36] !== onLinkCopy || $[37] !== onRemove) {
		t2 = /* @__PURE__ */ jsx(LinkActions, {
			href,
			onLinkCopy,
			onEdit,
			onRemove
		});
		$[34] = href;
		$[35] = onEdit;
		$[36] = onLinkCopy;
		$[37] = onRemove;
		$[38] = t2;
	} else t2 = $[38];
	let t3;
	if ($[39] !== t1 || $[40] !== t2) {
		t3 = /* @__PURE__ */ jsxs("div", {
			className: link_menu_module_default.Row,
			children: [t1, t2]
		});
		$[39] = t1;
		$[40] = t2;
		$[41] = t3;
	} else t3 = $[41];
	let t4;
	if ($[42] !== previewState.status) {
		t4 = previewState.status === "loading" && /* @__PURE__ */ jsxs("div", {
			className: link_menu_module_default.Skeleton,
			"data-testid": "link-popover-loading",
			role: "status",
			"aria-label": "Loading link preview",
			children: [/* @__PURE__ */ jsx("div", { className: link_menu_module_default.SkeletonLine }), /* @__PURE__ */ jsx("div", { className: link_menu_module_default.SkeletonLineShort })]
		});
		$[42] = previewState.status;
		$[43] = t4;
	} else t4 = $[43];
	let t5;
	if ($[44] !== t3 || $[45] !== t4) {
		t5 = /* @__PURE__ */ jsxs("div", {
			"data-testid": "link-popover-info",
			children: [t3, t4]
		});
		$[44] = t3;
		$[45] = t4;
		$[46] = t5;
	} else t5 = $[46];
	return t5;
}
function LinkEditContent(t0) {
	const $ = c(47);
	const { edit, resolveLinkPreview, onSubmit, onRemove } = t0;
	const [text, setText] = useState(edit.text);
	const [href, setHref] = useState(edit.link?.href ?? "");
	let t1;
	if ($[0] !== href) {
		t1 = href.trim();
		$[0] = href;
		$[1] = t1;
	} else t1 = $[1];
	const [debouncedHref, setDebouncedHref] = useState(t1);
	const hrefInputRef = useRef(null);
	let t2;
	if ($[2] !== debouncedHref) {
		t2 = normalizeHref(debouncedHref);
		$[2] = debouncedHref;
		$[3] = t2;
	} else t2 = $[3];
	const previewHref = t2;
	const previewState = useLinkPreview(previewHref || void 0, resolveLinkPreview);
	let t3;
	if ($[4] !== debouncedHref || $[5] !== edit.link || $[6] !== href || $[7] !== previewHref || $[8] !== text) {
		t3 = !!edit.link && debouncedHref === href.trim() && isLinkTextForHref(text, previewHref);
		$[4] = debouncedHref;
		$[5] = edit.link;
		$[6] = href;
		$[7] = previewHref;
		$[8] = text;
		$[9] = t3;
	} else t3 = $[9];
	const canUseTitle = t3;
	let t4;
	if ($[10] !== href || $[11] !== text) {
		t4 = text.trim() !== "" && href.trim() !== "";
		$[10] = href;
		$[11] = text;
		$[12] = t4;
	} else t4 = $[12];
	const canSave = t4;
	let t5;
	let t6;
	if ($[13] !== href) {
		t5 = () => {
			const timer = window.setTimeout(() => setDebouncedHref(href.trim()), 400);
			return () => window.clearTimeout(timer);
		};
		t6 = [href];
		$[13] = href;
		$[14] = t5;
		$[15] = t6;
	} else {
		t5 = $[14];
		t6 = $[15];
	}
	useEffect(t5, t6);
	let t7;
	let t8;
	if ($[16] === Symbol.for("react.memo_cache_sentinel")) {
		t7 = () => {
			hrefInputRef.current?.focus();
			hrefInputRef.current?.select();
		};
		t8 = [];
		$[16] = t7;
		$[17] = t8;
	} else {
		t7 = $[16];
		t8 = $[17];
	}
	useEffect(t7, t8);
	let t9;
	if ($[18] !== canSave || $[19] !== href || $[20] !== onSubmit || $[21] !== text) {
		t9 = (event) => {
			event.preventDefault();
			if (canSave) onSubmit(text, href);
		};
		$[18] = canSave;
		$[19] = href;
		$[20] = onSubmit;
		$[21] = text;
		$[22] = t9;
	} else t9 = $[22];
	let t10;
	if ($[23] === Symbol.for("react.memo_cache_sentinel")) {
		t10 = /* @__PURE__ */ jsx("span", { children: "Text" });
		$[23] = t10;
	} else t10 = $[23];
	let t11;
	if ($[24] === Symbol.for("react.memo_cache_sentinel")) {
		t11 = (event_0) => setText(event_0.target.value);
		$[24] = t11;
	} else t11 = $[24];
	let t12;
	if ($[25] !== text) {
		t12 = /* @__PURE__ */ jsxs("label", {
			className: link_menu_module_default.Field,
			children: [t10, /* @__PURE__ */ jsx("input", {
				className: link_menu_module_default.Input,
				value: text,
				"data-testid": "link-popover-text-input",
				onChange: t11
			})]
		});
		$[25] = text;
		$[26] = t12;
	} else t12 = $[26];
	let t13;
	if ($[27] === Symbol.for("react.memo_cache_sentinel")) {
		t13 = /* @__PURE__ */ jsx("span", { children: "Link" });
		$[27] = t13;
	} else t13 = $[27];
	let t14;
	if ($[28] === Symbol.for("react.memo_cache_sentinel")) {
		t14 = (event_1) => setHref(event_1.target.value);
		$[28] = t14;
	} else t14 = $[28];
	let t15;
	if ($[29] !== href) {
		t15 = /* @__PURE__ */ jsxs("label", {
			className: link_menu_module_default.Field,
			children: [t13, /* @__PURE__ */ jsx("input", {
				ref: hrefInputRef,
				className: link_menu_module_default.Input,
				value: href,
				placeholder: "Paste link…",
				"data-testid": "link-popover-input",
				onChange: t14
			})]
		});
		$[29] = href;
		$[30] = t15;
	} else t15 = $[30];
	let t16;
	if ($[31] !== onRemove) {
		t16 = onRemove && /* @__PURE__ */ jsx("button", {
			type: "button",
			className: link_menu_module_default.RemoveButton,
			onClick: onRemove,
			children: "Remove link"
		});
		$[31] = onRemove;
		$[32] = t16;
	} else t16 = $[32];
	let t17;
	if ($[33] !== canUseTitle || $[34] !== previewState) {
		t17 = canUseTitle && previewState.status === "resolved" && /* @__PURE__ */ jsx("button", {
			type: "button",
			className: link_menu_module_default.UseTitleButton,
			onClick: () => setText(previewState.preview.title),
			children: "Use page title"
		});
		$[33] = canUseTitle;
		$[34] = previewState;
		$[35] = t17;
	} else t17 = $[35];
	const t18 = !canSave;
	let t19;
	if ($[36] !== t18) {
		t19 = /* @__PURE__ */ jsx("button", {
			type: "submit",
			className: link_menu_module_default.SaveButton,
			disabled: t18,
			"data-testid": "link-popover-submit",
			children: "Save"
		});
		$[36] = t18;
		$[37] = t19;
	} else t19 = $[37];
	let t20;
	if ($[38] !== t16 || $[39] !== t17 || $[40] !== t19) {
		t20 = /* @__PURE__ */ jsxs("div", {
			className: link_menu_module_default.FormActions,
			children: [
				t16,
				t17,
				t19
			]
		});
		$[38] = t16;
		$[39] = t17;
		$[40] = t19;
		$[41] = t20;
	} else t20 = $[41];
	let t21;
	if ($[42] !== t12 || $[43] !== t15 || $[44] !== t20 || $[45] !== t9) {
		t21 = /* @__PURE__ */ jsxs("form", {
			className: link_menu_module_default.Form,
			"data-testid": "link-popover-edit",
			noValidate: true,
			onSubmit: t9,
			children: [
				t12,
				t15,
				t20
			]
		});
		$[42] = t12;
		$[43] = t15;
		$[44] = t20;
		$[45] = t9;
		$[46] = t21;
	} else t21 = $[46];
	return t21;
}
function LinkMenu(t0) {
	const $ = c(58);
	const { onLinkClick, onLinkCopy, resolveLinkPreview, readOnly: t1 } = t0;
	const readOnly = t1 === void 0 ? false : t1;
	const editor = useEditor$1();
	const [state, dispatch] = useReducer(reduceLinkMenu, LINK_MENU_IDLE);
	const isPointerOverPopupRef = useRef(false);
	let t2;
	let t3;
	if ($[0] !== editor) {
		t2 = () => {
			const canLeave = () => !isPointerOverPopupRef.current;
			const linkHoverExtension = defineLinkHoverHandler((hit) => dispatch({
				type: "hover",
				link: hit?.payload
			}), { canLeave });
			return queueExtension(editor, linkHoverExtension);
		};
		t3 = [editor];
		$[0] = editor;
		$[1] = t2;
		$[2] = t3;
	} else {
		t2 = $[1];
		t3 = $[2];
	}
	useEffect(t2, t3);
	let t4;
	let t5;
	if ($[3] !== editor || $[4] !== readOnly) {
		t4 = () => {
			if (readOnly) return;
			const linkEditExtension = defineLinkEditKeymap((edit) => dispatch({
				type: "edit",
				edit
			}));
			return queueExtension(editor, linkEditExtension);
		};
		t5 = [editor, readOnly];
		$[3] = editor;
		$[4] = readOnly;
		$[5] = t4;
		$[6] = t5;
	} else {
		t4 = $[5];
		t5 = $[6];
	}
	useEffect(t4, t5);
	let t6;
	if ($[7] === Symbol.for("react.memo_cache_sentinel")) {
		t6 = (over) => {
			isPointerOverPopupRef.current = over;
		};
		$[7] = t6;
	} else t6 = $[7];
	const handlePointerHover = t6;
	let t7;
	if ($[8] !== editor.state) {
		t7 = () => {
			isPointerOverPopupRef.current = false;
			dismissLinkHover(editor.state);
			dispatch({ type: "close" });
		};
		$[8] = editor.state;
		$[9] = t7;
	} else t7 = $[9];
	const close = t7;
	let t8;
	if ($[10] !== state) {
		t8 = getLinkMenuView(state);
		$[10] = state;
		$[11] = t8;
	} else t8 = $[11];
	const view = t8;
	const edit_0 = view?.kind === "edit" ? view.edit : void 0;
	const link = view?.kind === "preview" ? view.link : void 0;
	let t9;
	if ($[12] !== close || $[13] !== editor.commands) {
		t9 = () => {
			editor.commands.removeLink();
			close();
		};
		$[12] = close;
		$[13] = editor.commands;
		$[14] = t9;
	} else t9 = $[14];
	const handleEditRemove = t9;
	let t10;
	if ($[15] !== close || $[16] !== edit_0 || $[17] !== editor.commands) {
		t10 = (text, href) => {
			if (!edit_0) return;
			if (edit_0.link) editor.commands.updateLink({
				text: text === edit_0.text ? void 0 : text,
				href,
				title: edit_0.link.title
			});
			else editor.commands.insertLink({
				text,
				href
			});
			close();
		};
		$[15] = close;
		$[16] = edit_0;
		$[17] = editor.commands;
		$[18] = t10;
	} else t10 = $[18];
	const handleEditSubmit = t10;
	const mutable = link != null && !readOnly && link.form !== "reference";
	let t11;
	if ($[19] !== link) {
		t11 = link ? getLinkText(link) : "";
		$[19] = link;
		$[20] = t11;
	} else t11 = $[20];
	const linkText = t11;
	let t12;
	if ($[21] !== editor || $[22] !== link || $[23] !== linkText) {
		t12 = () => {
			if (!link) return;
			selectLinkUnit(editor, link);
			dispatch({
				type: "edit",
				edit: {
					from: link.unit.from,
					to: link.unit.to,
					link,
					text: linkText
				}
			});
		};
		$[21] = editor;
		$[22] = link;
		$[23] = linkText;
		$[24] = t12;
	} else t12 = $[24];
	const editLink = t12;
	let t13;
	if ($[25] !== close || $[26] !== editor || $[27] !== link) {
		t13 = () => {
			if (!link) return;
			selectLinkUnit(editor, link);
			editor.commands.removeLink();
			close();
		};
		$[25] = close;
		$[26] = editor;
		$[27] = link;
		$[28] = t13;
	} else t13 = $[28];
	const removeLink = t13;
	let t14;
	bb0: {
		if (!link || !mutable || !isLinkTextForHref(linkText, link.href)) {
			t14 = void 0;
			break bb0;
		}
		let t15;
		if ($[29] !== close || $[30] !== editor || $[31] !== link) {
			t15 = (title) => {
				selectLinkUnit(editor, link);
				editor.commands.updateLink({ text: title });
				close();
			};
			$[29] = close;
			$[30] = editor;
			$[31] = link;
			$[32] = t15;
		} else t15 = $[32];
		t14 = t15;
	}
	const handleUseTitle = t14;
	const previewState = useLinkPreview(link?.href, resolveLinkPreview);
	const range = edit_0 ? edit_0.link?.text ?? edit_0 : link?.text;
	let t15;
	bb1: {
		if (!range) {
			t15 = void 0;
			break bb1;
		}
		let t16;
		if ($[33] !== editor.view || $[34] !== range) {
			t16 = getVirtualElementFromRange(editor.view, range);
			$[33] = editor.view;
			$[34] = range;
			$[35] = t16;
		} else t16 = $[35];
		t15 = t16;
	}
	const anchor = t15;
	const t16 = state.kind === "preview" || state.kind === "edit";
	let t17;
	if ($[36] !== edit_0 || $[37] !== editor) {
		t17 = () => {
			if (edit_0) editor.focus();
			dispatch({ type: "closed" });
		};
		$[36] = edit_0;
		$[37] = editor;
		$[38] = t17;
	} else t17 = $[38];
	let t18;
	if ($[39] !== editLink || $[40] !== edit_0 || $[41] !== handleEditRemove || $[42] !== handleEditSubmit || $[43] !== handleUseTitle || $[44] !== link || $[45] !== mutable || $[46] !== onLinkClick || $[47] !== onLinkCopy || $[48] !== previewState || $[49] !== removeLink || $[50] !== resolveLinkPreview) {
		t18 = edit_0 ? /* @__PURE__ */ jsx(LinkEditContent, {
			edit: edit_0,
			resolveLinkPreview,
			onRemove: edit_0.link ? handleEditRemove : void 0,
			onSubmit: handleEditSubmit
		}, `${edit_0.from}:${edit_0.to}`) : link ? /* @__PURE__ */ jsx(LinkInfoContent, {
			href: link.href,
			previewState,
			onLinkClick,
			onLinkCopy,
			onEdit: mutable ? editLink : void 0,
			onRemove: mutable ? removeLink : void 0,
			onUseTitle: handleUseTitle
		}) : void 0;
		$[39] = editLink;
		$[40] = edit_0;
		$[41] = handleEditRemove;
		$[42] = handleEditSubmit;
		$[43] = handleUseTitle;
		$[44] = link;
		$[45] = mutable;
		$[46] = onLinkClick;
		$[47] = onLinkCopy;
		$[48] = previewState;
		$[49] = removeLink;
		$[50] = resolveLinkPreview;
		$[51] = t18;
	} else t18 = $[51];
	let t19;
	if ($[52] !== anchor || $[53] !== close || $[54] !== t16 || $[55] !== t17 || $[56] !== t18) {
		t19 = /* @__PURE__ */ jsx(LinkPopover, {
			anchor,
			open: t16,
			onClose: close,
			onCloseComplete: t17,
			onPopupHover: handlePointerHover,
			children: t18
		});
		$[52] = anchor;
		$[53] = close;
		$[54] = t16;
		$[55] = t17;
		$[56] = t18;
		$[57] = t19;
	} else t19 = $[57];
	return t19;
}

// src/components/pending-replacement-preview.module.css
var pending_replacement_preview_module_default = {
	"AcceptButton": "meow_AcceptButton_xfEgeG",
	"Button": "meow_Button_xfEgeG",
	"Footer": "meow_Footer_xfEgeG",
	"Popup": "meow_Popup_xfEgeG",
	"Positioner": "meow_Positioner_xfEgeG",
	"Spacer": "meow_Spacer_xfEgeG",
	"Text": "meow_Text_xfEgeG",
	"Waiting": "meow_Waiting_xfEgeG"
};

// src/components/pending-replacement-preview.tsx
/**
* Vertical room (px) the popover needs under its anchor: the text area's
* 14rem max-height plus the footer, borders, and the anchor offset.
*/
const PREVIEW_CLEARANCE = 320;
/**
* Minimum gap (px) kept above the anchor line when scrolling to make room.
*/
const SCROLL_TOP_MARGIN = 16;
/**
* The nearest ancestor that can scroll vertically, or the page scroller.
*/
function closestScrollable(element) {
	for (let node = element.parentElement; node; node = node.parentElement) {
		const { overflowY } = getComputedStyle(node);
		if ((overflowY === "auto" || overflowY === "scroll" || overflowY === "overlay") && node.scrollHeight > node.clientHeight) return node;
	}
	return document.scrollingElement;
}
/**
* The preview for a staged (pending) replacement: a popover anchored to the
* end of the source range showing the accumulated text, with a Discard control
* and an accept control labeled by what accepting does ("Replace selection" or
* "Insert below", per the staged mode), plus a host-provided `actions` slot.
* Dismissing the popover (Escape or an outside press) discards the stage; the
* document is only touched on accept.
*/
function PendingReplacementPreview(t0) {
	const $ = c(41);
	const { actions, onResolve } = t0;
	const editor = useEditor$1();
	const [pending, setPending] = useState(null);
	let t1;
	if ($[0] !== onResolve) {
		t1 = definePendingReplacementHandler((event) => {
			if (event.type === "update") setPending(event.pending);
			else {
				setPending(null);
				onResolve?.(event.outcome, event.pending);
			}
		});
		$[0] = onResolve;
		$[1] = t1;
	} else t1 = $[1];
	useExtension$1(t1);
	const to = pending?.to;
	let t2;
	bb0: {
		if (to == null) {
			t2 = void 0;
			break bb0;
		}
		let t3;
		if ($[2] !== editor.view || $[3] !== to) {
			t3 = getVirtualElementFromRange(editor.view, {
				from: to,
				to
			});
			$[2] = editor.view;
			$[3] = to;
			$[4] = t3;
		} else t3 = $[4];
		t2 = t3;
	}
	const anchor = t2;
	const staged = pending !== null;
	let t3;
	let t4;
	if ($[5] !== editor || $[6] !== staged) {
		t3 = () => {
			if (!staged) return;
			const view = editor.view;
			const position = getPendingReplacement(view.state)?.to;
			if (position == null) return;
			const clearanceBottom = window.innerHeight - PREVIEW_CLEARANCE;
			let coords = view.coordsAtPos(position);
			if (coords.top >= 0 && coords.bottom <= clearanceBottom) return;
			const { node } = view.domAtPos(position);
			const element = node instanceof Element ? node : node.parentElement;
			if (!element) return;
			element.scrollIntoView({ block: "center" });
			coords = view.coordsAtPos(position);
			const overflow = coords.bottom - clearanceBottom;
			const nudge = Math.min(overflow, Math.max(0, coords.top - SCROLL_TOP_MARGIN));
			if (nudge > 0) {
				const scroller = closestScrollable(element);
				if (scroller) scroller.scrollTop = scroller.scrollTop + nudge;
			}
		};
		t4 = [staged, editor];
		$[5] = editor;
		$[6] = staged;
		$[7] = t3;
		$[8] = t4;
	} else {
		t3 = $[7];
		t4 = $[8];
	}
	useEffect(t3, t4);
	if (!pending) return null;
	let t5;
	if ($[9] !== editor) {
		t5 = () => {
			editor.commands.discardPendingReplacement();
			editor.focus();
		};
		$[9] = editor;
		$[10] = t5;
	} else t5 = $[10];
	const discard = t5;
	let t6;
	if ($[11] !== editor) {
		t6 = () => {
			editor.commands.acceptPendingReplacement();
			editor.focus();
		};
		$[11] = editor;
		$[12] = t6;
	} else t6 = $[12];
	const accept = t6;
	let t7;
	if ($[13] !== discard) {
		t7 = (next) => {
			if (!next) discard();
		};
		$[13] = discard;
		$[14] = t7;
	} else t7 = $[14];
	let t8;
	if ($[15] !== pending.text) {
		t8 = pending.text || /* @__PURE__ */ jsx("span", {
			className: pending_replacement_preview_module_default.Waiting,
			children: "Waiting for text..."
		});
		$[15] = pending.text;
		$[16] = t8;
	} else t8 = $[16];
	let t9;
	if ($[17] !== t8) {
		t9 = /* @__PURE__ */ jsx("div", {
			className: pending_replacement_preview_module_default.Text,
			"data-testid": "pending-replacement-text",
			children: t8
		});
		$[17] = t8;
		$[18] = t9;
	} else t9 = $[18];
	let t10;
	if ($[19] === Symbol.for("react.memo_cache_sentinel")) {
		t10 = /* @__PURE__ */ jsx("span", { className: pending_replacement_preview_module_default.Spacer });
		$[19] = t10;
	} else t10 = $[19];
	let t11;
	if ($[20] !== discard) {
		t11 = /* @__PURE__ */ jsx("button", {
			type: "button",
			className: pending_replacement_preview_module_default.Button,
			"data-testid": "pending-replacement-discard",
			onClick: discard,
			children: "Discard"
		});
		$[20] = discard;
		$[21] = t11;
	} else t11 = $[21];
	let t12;
	if ($[22] !== pending.text) {
		t12 = pending.text.trim();
		$[22] = pending.text;
		$[23] = t12;
	} else t12 = $[23];
	const t13 = !t12;
	const t14 = pending.mode === "replace" ? "Replace selection" : "Insert below";
	let t15;
	if ($[24] !== accept || $[25] !== t13 || $[26] !== t14) {
		t15 = /* @__PURE__ */ jsx("button", {
			type: "button",
			className: pending_replacement_preview_module_default.AcceptButton,
			"data-testid": "pending-replacement-accept",
			disabled: t13,
			onClick: accept,
			children: t14
		});
		$[24] = accept;
		$[25] = t13;
		$[26] = t14;
		$[27] = t15;
	} else t15 = $[27];
	let t16;
	if ($[28] !== actions || $[29] !== t11 || $[30] !== t15) {
		t16 = /* @__PURE__ */ jsxs("div", {
			className: pending_replacement_preview_module_default.Footer,
			children: [
				actions,
				t10,
				t11,
				t15
			]
		});
		$[28] = actions;
		$[29] = t11;
		$[30] = t15;
		$[31] = t16;
	} else t16 = $[31];
	let t17;
	if ($[32] !== t16 || $[33] !== t9) {
		t17 = /* @__PURE__ */ jsxs(Popover.Popup, {
			className: pending_replacement_preview_module_default.Popup,
			"data-testid": "pending-replacement",
			initialFocus: false,
			finalFocus: false,
			children: [t9, t16]
		});
		$[32] = t16;
		$[33] = t9;
		$[34] = t17;
	} else t17 = $[34];
	let t18;
	if ($[35] !== anchor || $[36] !== t17) {
		t18 = /* @__PURE__ */ jsx(Popover.Portal, { children: /* @__PURE__ */ jsx(Popover.Positioner, {
			anchor,
			side: "bottom",
			sideOffset: 8,
			className: pending_replacement_preview_module_default.Positioner,
			children: t17
		}) });
		$[35] = anchor;
		$[36] = t17;
		$[37] = t18;
	} else t18 = $[37];
	let t19;
	if ($[38] !== t18 || $[39] !== t7) {
		t19 = /* @__PURE__ */ jsx(Popover.Root, {
			open: true,
			onOpenChange: t7,
			children: t18
		});
		$[38] = t18;
		$[39] = t7;
		$[40] = t19;
	} else t19 = $[40];
	return t19;
}

// src/hooks/use-delayed-flag.ts
/**
* Delay before the flag opens, in ms.
*/
const OPEN_DELAY = 300;
/**
* Grace before the flag closes, in ms. The window lets a pointer travel from
*  the hovered link onto the popover it anchors.
*/
const CLOSE_DELAY = 100;
/**
* Mirrors `value` into a boolean that flips true `openDelay`ms after `value`
* becomes true and false `closeDelay`ms after it becomes false, cancelling any
* pending flip on each change.
*/
function useDelayedFlag(value, t0, t1) {
	const $ = c(5);
	const openDelay = t0 === void 0 ? OPEN_DELAY : t0;
	const closeDelay = t1 === void 0 ? CLOSE_DELAY : t1;
	const [flag, setFlag] = useState(false);
	const timerRef = useRef(void 0);
	let t2;
	let t3;
	if ($[0] !== closeDelay || $[1] !== openDelay || $[2] !== value) {
		t2 = () => {
			clearTimeout(timerRef.current);
			timerRef.current = setTimeout(() => setFlag(value), value ? openDelay : closeDelay);
			return () => clearTimeout(timerRef.current);
		};
		t3 = [
			value,
			openDelay,
			closeDelay
		];
		$[0] = closeDelay;
		$[1] = openDelay;
		$[2] = value;
		$[3] = t2;
		$[4] = t3;
	} else {
		t2 = $[3];
		t3 = $[4];
	}
	useEffect(t2, t3);
	return flag;
}

// src/components/selection-menu.module.css
var selection_menu_module_default = {
	"AffordanceButton": "meow_AffordanceButton_PMURHG",
	"AffordancePopup": "meow_AffordancePopup_PMURHG",
	"AffordancePositioner": "meow_AffordancePositioner_PMURHG",
	"Detail": "meow_Detail_PMURHG",
	"Empty": "meow_Empty_PMURHG",
	"Input": "meow_Input_PMURHG",
	"Item": "meow_Item_PMURHG",
	"Label": "meow_Label_PMURHG",
	"List": "meow_List_PMURHG",
	"Popup": "meow_Popup_PMURHG",
	"Positioner": "meow_Positioner_PMURHG"
};

// src/components/selection-menu.tsx
/**
* A command menu over the current selection: a popover with a filter input and
* host-supplied rows, anchored to the selected range. Opened imperatively (via
* `EditorHandle.openSelectionMenu`) or from the selection affordance, a small
* floating button that appears on a non-empty selection.
*/
function SelectionMenu(t0) {
	const $ = c(31);
	const { onSelectionMenuSearch, context, onOpen, onClose, affordance: t1 } = t0;
	const affordance = t1 === void 0 ? true : t1;
	const editor = useEditor$1();
	const collisionBoundary = use(CollisionBoundaryContext);
	const [selection, setSelection] = useState();
	let t2;
	if ($[0] === Symbol.for("react.memo_cache_sentinel")) {
		t2 = defineUpdateHandler((view) => {
			const { from, to, empty } = view.state.selection;
			const anchorable = !empty && isTextSelection(view.state.selection) && !getPendingReplacement(view.state) && getSearchStatus(view.state).active === 0;
			setSelection((previous) => {
				if (!anchorable) return;
				if (previous?.from === from && previous?.to === to) return previous;
				return {
					from,
					to
				};
			});
		});
		$[0] = t2;
	} else t2 = $[0];
	useExtension$1(t2);
	let t3;
	if ($[1] !== editor || $[2] !== onClose) {
		t3 = () => {
			onClose();
			editor.focus();
		};
		$[1] = editor;
		$[2] = onClose;
		$[3] = t3;
	} else t3 = $[3];
	const close = t3;
	let t4;
	bb0: {
		if (!context) {
			t4 = void 0;
			break bb0;
		}
		let t5;
		if ($[4] !== context.from || $[5] !== context.to || $[6] !== editor.view) {
			t5 = getMenuAnchor(editor.view, context.from, context.to);
			$[4] = context.from;
			$[5] = context.to;
			$[6] = editor.view;
			$[7] = t5;
		} else t5 = $[7];
		t4 = t5;
	}
	const menuAnchor = t4;
	const showAffordance = affordance && !!!context && !!selection;
	const affordanceVisible = useDelayedFlag(showAffordance, 250, 0);
	let t5;
	bb1: {
		if (!showAffordance || !selection) {
			t5 = void 0;
			break bb1;
		}
		let t6;
		if ($[8] !== editor.view || $[9] !== selection.to) {
			t6 = getVirtualElementFromRange(editor.view, {
				from: selection.to,
				to: selection.to
			});
			$[8] = editor.view;
			$[9] = selection.to;
			$[10] = t6;
		} else t6 = $[10];
		t5 = t6;
	}
	const affordanceAnchor = t5;
	if (context) {
		let t6;
		if ($[11] !== close) {
			t6 = (next) => {
				if (!next) close();
			};
			$[11] = close;
			$[12] = t6;
		} else t6 = $[12];
		let t7;
		if ($[13] !== close || $[14] !== context || $[15] !== onSelectionMenuSearch) {
			t7 = /* @__PURE__ */ jsx(Popover.Popup, {
				className: selection_menu_module_default.Popup,
				"data-testid": "selection-menu",
				finalFocus: false,
				children: /* @__PURE__ */ jsx(SelectionMenuPopup, {
					onSelectionMenuSearch,
					context,
					onClose: close
				})
			});
			$[13] = close;
			$[14] = context;
			$[15] = onSelectionMenuSearch;
			$[16] = t7;
		} else t7 = $[16];
		let t8;
		if ($[17] !== collisionBoundary || $[18] !== menuAnchor || $[19] !== t7) {
			t8 = /* @__PURE__ */ jsx(Popover.Portal, { children: /* @__PURE__ */ jsx(Popover.Positioner, {
				anchor: menuAnchor,
				side: "bottom",
				sideOffset: 8,
				collisionBoundary,
				className: selection_menu_module_default.Positioner,
				children: t7
			}) });
			$[17] = collisionBoundary;
			$[18] = menuAnchor;
			$[19] = t7;
			$[20] = t8;
		} else t8 = $[20];
		let t9;
		if ($[21] !== t6 || $[22] !== t8) {
			t9 = /* @__PURE__ */ jsx(Popover.Root, {
				open: true,
				onOpenChange: t6,
				children: t8
			});
			$[21] = t6;
			$[22] = t8;
			$[23] = t9;
		} else t9 = $[23];
		return t9;
	}
	if (affordanceVisible && showAffordance) {
		let t6;
		if ($[24] === Symbol.for("react.memo_cache_sentinel")) {
			t6 = /* @__PURE__ */ jsx(SparklesIcon, {});
			$[24] = t6;
		} else t6 = $[24];
		let t7;
		if ($[25] !== onOpen) {
			t7 = /* @__PURE__ */ jsx(Popover.Popup, {
				className: selection_menu_module_default.AffordancePopup,
				"data-testid": "selection-menu-affordance",
				initialFocus: false,
				finalFocus: false,
				children: /* @__PURE__ */ jsx("button", {
					type: "button",
					className: selection_menu_module_default.AffordanceButton,
					title: "Selection commands",
					"aria-label": "Selection commands",
					onPointerDown: _temp2,
					onClick: onOpen,
					children: t6
				})
			});
			$[25] = onOpen;
			$[26] = t7;
		} else t7 = $[26];
		let t8;
		if ($[27] !== affordanceAnchor || $[28] !== collisionBoundary || $[29] !== t7) {
			t8 = /* @__PURE__ */ jsx(Popover.Root, {
				open: true,
				onOpenChange: _temp$2,
				children: /* @__PURE__ */ jsx(Popover.Portal, { children: /* @__PURE__ */ jsx(Popover.Positioner, {
					anchor: affordanceAnchor,
					side: "bottom",
					sideOffset: 4,
					collisionBoundary,
					className: selection_menu_module_default.AffordancePositioner,
					children: t7
				}) })
			});
			$[27] = affordanceAnchor;
			$[28] = collisionBoundary;
			$[29] = t7;
			$[30] = t8;
		} else t8 = $[30];
		return t8;
	}
	return null;
}
function _temp2(event) {
	return event.preventDefault();
}
function _temp$2() {}
/**
* Anchors the menu to the selected range, or to the range's end when the range
* is taller than a third of the visible height: such a range leaves no room
* for the menu above or below it.
*/
function getMenuAnchor(view, from, to) {
	const range = getVirtualElementFromRange(view, {
		from,
		to
	});
	if (from === to) return range;
	const end = getVirtualElementFromRange(view, {
		from: to,
		to
	});
	const pickAnchor = () => {
		const visibleHeight = view.dom.ownerDocument.defaultView?.visualViewport?.height ?? Infinity;
		return range.getBoundingClientRect().height > visibleHeight / 3 ? end : range;
	};
	return {
		getBoundingClientRect: () => pickAnchor().getBoundingClientRect(),
		contextElement: view.dom
	};
}
/**
* The menu content. Mounted only while the menu is open, so its filter state
*  resets naturally on close.
*/
function SelectionMenuPopup(t0) {
	const $ = c(35);
	const { onSelectionMenuSearch, context, onClose } = t0;
	const [query, setQuery] = useState("");
	let t1;
	if ($[0] === Symbol.for("react.memo_cache_sentinel")) {
		t1 = [];
		$[0] = t1;
	} else t1 = $[0];
	const [items, setItems] = useState(t1);
	const [loading, setLoading] = useState(false);
	const [activeIndex, setActiveIndex] = useState(0);
	let t2;
	if ($[1] !== context || $[2] !== onSelectionMenuSearch) {
		t2 = async (query_0, signal) => {
			if (signal.aborted) return;
			setLoading(true);
			const result = await onSelectionMenuSearch(query_0, context);
			if (signal.aborted) return;
			setItems(result);
			setActiveIndex(0);
			setLoading(false);
		};
		$[1] = context;
		$[2] = onSelectionMenuSearch;
		$[3] = t2;
	} else t2 = $[3];
	const fetchItems = t2;
	let t3;
	let t4;
	if ($[4] !== fetchItems || $[5] !== query) {
		t3 = () => {
			const controller = new AbortController();
			queueMicrotask(() => {
				fetchItems(query, controller.signal);
			});
			return () => {
				controller.abort();
			};
		};
		t4 = [query, fetchItems];
		$[4] = fetchItems;
		$[5] = query;
		$[6] = t3;
		$[7] = t4;
	} else {
		t3 = $[6];
		t4 = $[7];
	}
	useEffect(t3, t4);
	let t5;
	if ($[8] !== context || $[9] !== onClose) {
		t5 = (item) => {
			onClose();
			item.onSelect(context);
		};
		$[8] = context;
		$[9] = onClose;
		$[10] = t5;
	} else t5 = $[10];
	const selectItem = t5;
	let t6;
	if ($[11] !== activeIndex || $[12] !== items || $[13] !== selectItem) {
		t6 = function onInputKeyDown(event) {
			if (event.key === "ArrowDown") {
				event.preventDefault();
				setActiveIndex((index) => Math.min(index + 1, Math.max(items.length - 1, 0)));
			} else if (event.key === "ArrowUp") {
				event.preventDefault();
				setActiveIndex(_temp3);
			} else if (event.key === "Enter") {
				event.preventDefault();
				const item_0 = items[activeIndex];
				if (item_0) selectItem(item_0);
			}
		};
		$[11] = activeIndex;
		$[12] = items;
		$[13] = selectItem;
		$[14] = t6;
	} else t6 = $[14];
	const onInputKeyDown = t6;
	let t7;
	if ($[15] === Symbol.for("react.memo_cache_sentinel")) {
		t7 = (event_0) => setQuery(event_0.target.value);
		$[15] = t7;
	} else t7 = $[15];
	let t8;
	if ($[16] !== onInputKeyDown || $[17] !== query) {
		t8 = /* @__PURE__ */ jsx("input", {
			autoFocus: true,
			className: selection_menu_module_default.Input,
			value: query,
			placeholder: "Filter commands...",
			"data-testid": "selection-menu-input",
			onChange: t7,
			onKeyDown: onInputKeyDown
		});
		$[16] = onInputKeyDown;
		$[17] = query;
		$[18] = t8;
	} else t8 = $[18];
	let t9;
	if ($[19] !== activeIndex || $[20] !== items || $[21] !== selectItem) {
		let t10;
		if ($[23] !== activeIndex || $[24] !== selectItem) {
			t10 = (item_1, index_1) => /* @__PURE__ */ jsxs("button", {
				type: "button",
				role: "option",
				"aria-selected": index_1 === activeIndex,
				className: selection_menu_module_default.Item,
				"data-active": index_1 === activeIndex || void 0,
				onPointerEnter: () => setActiveIndex(index_1),
				onClick: () => selectItem(item_1),
				children: [/* @__PURE__ */ jsx("span", {
					className: selection_menu_module_default.Label,
					children: item_1.label
				}), item_1.detail ? /* @__PURE__ */ jsx("span", {
					className: selection_menu_module_default.Detail,
					children: item_1.detail
				}) : null]
			}, item_1.id);
			$[23] = activeIndex;
			$[24] = selectItem;
			$[25] = t10;
		} else t10 = $[25];
		t9 = items.map(t10);
		$[19] = activeIndex;
		$[20] = items;
		$[21] = selectItem;
		$[22] = t9;
	} else t9 = $[22];
	let t10;
	if ($[26] !== items.length || $[27] !== loading) {
		t10 = items.length === 0 ? /* @__PURE__ */ jsx("div", {
			className: selection_menu_module_default.Empty,
			children: loading ? "Loading..." : "No commands"
		}) : null;
		$[26] = items.length;
		$[27] = loading;
		$[28] = t10;
	} else t10 = $[28];
	let t11;
	if ($[29] !== t10 || $[30] !== t9) {
		t11 = /* @__PURE__ */ jsxs("div", {
			role: "listbox",
			className: selection_menu_module_default.List,
			children: [t9, t10]
		});
		$[29] = t10;
		$[30] = t9;
		$[31] = t11;
	} else t11 = $[31];
	let t12;
	if ($[32] !== t11 || $[33] !== t8) {
		t12 = /* @__PURE__ */ jsxs(Fragment$1, { children: [t8, t11] });
		$[32] = t11;
		$[33] = t8;
		$[34] = t12;
	} else t12 = $[34];
	return t12;
}
function _temp3(index_0) {
	return Math.max(index_0 - 1, 0);
}

// src/utils/date-format.ts
/**
* Formats the current wall-clock time for the `/now` slash command.
*/
function formatNowTime(timeFormat) {
	return formatTime(/* @__PURE__ */ new Date(), timeFormat);
}
/**
* Formats a given time as `3:45pm` ('12') or `15:45` ('24').
*/
function formatTime(date, timeFormat) {
	return timeFormat === "12" ? formatTime12(date) : formatTime24(date);
}
function formatTime12(date) {
	return `${date.getHours() % 12 || 12}:${date.getMinutes().toString().padStart(2, "0")}${date.getHours() >= 12 ? "pm" : "am"}`;
}
function formatTime24(date) {
	return `${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`;
}

// src/components/autocomplete-menu.module.css
var autocomplete_menu_module_default = {
	"Detail": "meow_Detail_ZNR7tq",
	"Item": "meow_Item_ZNR7tq",
	"Label": "meow_Label_ZNR7tq",
	"Popup": "meow_Popup_ZNR7tq",
	"Positioner": "meow_Positioner_ZNR7tq"
};

// src/components/slash-menu.tsx
const regex$2 = new RegExp((canUseRegexLookbehind() ? String.raw`(?<!\S)` : "") + String.raw`\/(?!\/)(\S.*)?$`, "u");
const defaultOnFileSaveError = (error) => {
	console.error("[meowdown] failed to save attached file:", error);
};
function SlashMenuItem(t0) {
	const $ = c(18);
	const { label, keywords, detail, kbd, onSelect } = t0;
	let t1;
	if ($[0] !== keywords) {
		t1 = keywords ?? [];
		$[0] = keywords;
		$[1] = t1;
	} else t1 = $[1];
	let t2;
	if ($[2] !== label || $[3] !== t1) {
		t2 = [label, ...t1];
		$[2] = label;
		$[3] = t1;
		$[4] = t2;
	} else t2 = $[4];
	const t3 = t2.join(" ");
	const t4 = detail ? autocomplete_menu_module_default.Label : void 0;
	let t5;
	if ($[5] !== label || $[6] !== t4) {
		t5 = /* @__PURE__ */ jsx("span", {
			className: t4,
			children: label
		});
		$[5] = label;
		$[6] = t4;
		$[7] = t5;
	} else t5 = $[7];
	let t6;
	if ($[8] !== detail) {
		t6 = detail ? /* @__PURE__ */ jsx("span", {
			className: autocomplete_menu_module_default.Detail,
			children: detail
		}) : null;
		$[8] = detail;
		$[9] = t6;
	} else t6 = $[9];
	let t7;
	if ($[10] !== kbd) {
		t7 = kbd && /* @__PURE__ */ jsx("kbd", { children: kbd });
		$[10] = kbd;
		$[11] = t7;
	} else t7 = $[11];
	let t8;
	if ($[12] !== onSelect || $[13] !== t3 || $[14] !== t5 || $[15] !== t6 || $[16] !== t7) {
		t8 = /* @__PURE__ */ jsxs(AutocompleteItem, {
			value: t3,
			className: autocomplete_menu_module_default.Item,
			onSelect,
			children: [
				t5,
				t6,
				t7
			]
		});
		$[12] = onSelect;
		$[13] = t3;
		$[14] = t5;
		$[15] = t6;
		$[16] = t7;
		$[17] = t8;
	} else t8 = $[17];
	return t8;
}
function selectionInTableCell(editor) {
	return isSelectionInTableCell(editor.state);
}
function BuiltinSlashMenuItems(t0) {
	const $ = c(12);
	const { editor, timeFormat, onAttachFile } = t0;
	const inTableCell = useEditorDerivedValue(selectionInTableCell);
	let t1;
	if ($[0] !== editor.commands || $[1] !== inTableCell) {
		t1 = !inTableCell && /* @__PURE__ */ jsxs(Fragment$1, { children: [
			/* @__PURE__ */ jsx(SlashMenuItem, {
				label: "Text",
				keywords: ["paragraph", "plain"],
				onSelect: () => editor.commands.turnIntoText()
			}),
			/* @__PURE__ */ jsx(SlashMenuItem, {
				label: "Heading 1",
				keywords: ["h1"],
				kbd: "#",
				onSelect: () => editor.commands.setHeading({ level: 1 })
			}),
			/* @__PURE__ */ jsx(SlashMenuItem, {
				label: "Heading 2",
				keywords: ["h2"],
				kbd: "##",
				onSelect: () => editor.commands.setHeading({ level: 2 })
			}),
			/* @__PURE__ */ jsx(SlashMenuItem, {
				label: "Heading 3",
				keywords: ["h3"],
				kbd: "###",
				onSelect: () => editor.commands.setHeading({ level: 3 })
			}),
			/* @__PURE__ */ jsx(SlashMenuItem, {
				label: "Heading 4",
				keywords: ["h4"],
				kbd: "####",
				onSelect: () => editor.commands.setHeading({ level: 4 })
			}),
			/* @__PURE__ */ jsx(SlashMenuItem, {
				label: "Blockquote",
				kbd: ">",
				onSelect: () => editor.commands.setBlockquote()
			}),
			/* @__PURE__ */ jsx(SlashMenuItem, {
				label: "Bullet list",
				kbd: "-",
				onSelect: () => editor.commands.wrapInList({ kind: "bullet" })
			}),
			/* @__PURE__ */ jsx(SlashMenuItem, {
				label: "Ordered list",
				kbd: "1.",
				onSelect: () => editor.commands.wrapInList({ kind: "ordered" })
			}),
			/* @__PURE__ */ jsx(SlashMenuItem, {
				label: "Task list",
				kbd: "+ [ ] ",
				onSelect: () => editor.commands.wrapInCircleTask()
			}),
			/* @__PURE__ */ jsx(SlashMenuItem, {
				label: "Checkbox list",
				kbd: "- [ ] ",
				onSelect: () => editor.commands.wrapInSquareTask()
			}),
			/* @__PURE__ */ jsx(SlashMenuItem, {
				label: "Code block",
				kbd: "```",
				onSelect: () => editor.commands.setCodeBlock()
			}),
			/* @__PURE__ */ jsx(SlashMenuItem, {
				label: "Math",
				keywords: ["latex"],
				kbd: "```math",
				onSelect: () => editor.commands.insertMarkdown("```math\n```")
			}),
			/* @__PURE__ */ jsx(SlashMenuItem, {
				label: "Table",
				onSelect: () => editor.commands.insertTable({
					row: 3,
					col: 3,
					header: true
				})
			})
		] });
		$[0] = editor.commands;
		$[1] = inTableCell;
		$[2] = t1;
	} else t1 = $[2];
	let t2;
	if ($[3] !== editor.commands || $[4] !== timeFormat) {
		t2 = /* @__PURE__ */ jsx(SlashMenuItem, {
			label: "Now",
			onSelect: () => editor.commands.insertText({ text: formatNowTime(timeFormat) })
		});
		$[3] = editor.commands;
		$[4] = timeFormat;
		$[5] = t2;
	} else t2 = $[5];
	let t3;
	if ($[6] !== onAttachFile) {
		t3 = onAttachFile ? /* @__PURE__ */ jsx(SlashMenuItem, {
			label: "Attach file",
			keywords: [
				"attachment",
				"file",
				"upload"
			],
			onSelect: onAttachFile
		}) : null;
		$[6] = onAttachFile;
		$[7] = t3;
	} else t3 = $[7];
	let t4;
	if ($[8] !== t1 || $[9] !== t2 || $[10] !== t3) {
		t4 = /* @__PURE__ */ jsxs(Fragment$1, { children: [
			t1,
			t2,
			t3
		] });
		$[8] = t1;
		$[9] = t2;
		$[10] = t3;
		$[11] = t4;
	} else t4 = $[11];
	return t4;
}
const BuiltinSlashMenuItemsMemo = /* @__PURE__ */ memo(BuiltinSlashMenuItems);
function SlashMenu(t0) {
	const $ = c(36);
	const { timeFormat: t1, onSlashMenuSearch, onFilePaste, onFileSaveError } = t0;
	const timeFormat = t1 === void 0 ? "12" : t1;
	const editor = useEditor$1();
	const collisionBoundary = use(CollisionBoundaryContext);
	const fileInputRef = useRef(null);
	const [open, setOpen] = useState(false);
	const [query, setQuery] = useState("");
	let t2;
	if ($[0] === Symbol.for("react.memo_cache_sentinel")) {
		t2 = [];
		$[0] = t2;
	} else t2 = $[0];
	const [hostItems, setHostItems] = useState(t2);
	let t3;
	if ($[1] !== onSlashMenuSearch) {
		t3 = async (query_0, signal) => {
			if (!onSlashMenuSearch || signal.aborted) return;
			const result = await onSlashMenuSearch(query_0);
			if (signal.aborted) return;
			setHostItems(result);
		};
		$[1] = onSlashMenuSearch;
		$[2] = t3;
	} else t3 = $[2];
	const fetchHostItems = t3;
	let t4;
	let t5;
	if ($[3] !== fetchHostItems || $[4] !== open || $[5] !== query) {
		t4 = () => {
			if (!open) return;
			const controller = new AbortController();
			queueMicrotask(() => {
				fetchHostItems(query, controller.signal);
			});
			return () => {
				controller.abort();
			};
		};
		t5 = [
			open,
			query,
			fetchHostItems
		];
		$[3] = fetchHostItems;
		$[4] = open;
		$[5] = query;
		$[6] = t4;
		$[7] = t5;
	} else {
		t4 = $[6];
		t5 = $[7];
	}
	useEffect(t4, t5);
	let t6;
	if ($[8] === Symbol.for("react.memo_cache_sentinel")) {
		t6 = () => {
			fileInputRef.current?.click();
		};
		$[8] = t6;
	} else t6 = $[8];
	const openFilePicker = t6;
	let t7;
	if ($[9] !== editor || $[10] !== onFilePaste || $[11] !== onFileSaveError) {
		t7 = async (event) => {
			const input = event.currentTarget;
			const files = Array.from(input.files ?? []);
			input.value = "";
			if (!onFilePaste || files.length === 0) return;
			const onSaveError = onFileSaveError ?? defaultOnFileSaveError;
			const markdown = [];
			for (const file of files) try {
				const destination = await onFilePaste(file);
				if (destination) markdown.push(buildFileMarkdown(file, destination));
			} catch (t8) {
				onSaveError(t8, file);
			}
			if (markdown.length === 0) return;
			editor.focus();
			editor.commands.insertText({ text: markdown.join("\n") });
		};
		$[9] = editor;
		$[10] = onFilePaste;
		$[11] = onFileSaveError;
		$[12] = t7;
	} else t7 = $[12];
	const handleFileInputChange = t7;
	let t8;
	let t9;
	if ($[13] === Symbol.for("react.memo_cache_sentinel")) {
		t8 = (event_0) => setOpen(event_0.detail);
		t9 = (event_1) => setQuery(event_1.detail);
		$[13] = t8;
		$[14] = t9;
	} else {
		t8 = $[13];
		t9 = $[14];
	}
	let t10;
	if ($[15] !== handleFileInputChange || $[16] !== onFilePaste) {
		t10 = onFilePaste ? /* @__PURE__ */ jsx("input", {
			ref: fileInputRef,
			"data-testid": "slash-menu-file-input",
			type: "file",
			multiple: true,
			hidden: true,
			onChange: handleFileInputChange
		}) : null;
		$[15] = handleFileInputChange;
		$[16] = onFilePaste;
		$[17] = t10;
	} else t10 = $[17];
	let t11;
	if ($[18] !== collisionBoundary) {
		t11 = toFloatingBoundary(collisionBoundary);
		$[18] = collisionBoundary;
		$[19] = t11;
	} else t11 = $[19];
	const t12 = onFilePaste ? openFilePicker : void 0;
	let t13;
	if ($[20] !== editor || $[21] !== t12 || $[22] !== timeFormat) {
		t13 = /* @__PURE__ */ jsx(BuiltinSlashMenuItemsMemo, {
			editor,
			timeFormat,
			onAttachFile: t12
		});
		$[20] = editor;
		$[21] = t12;
		$[22] = timeFormat;
		$[23] = t13;
	} else t13 = $[23];
	let t14;
	if ($[24] !== hostItems) {
		t14 = hostItems.map(_temp$1);
		$[24] = hostItems;
		$[25] = t14;
	} else t14 = $[25];
	let t15;
	if ($[26] === Symbol.for("react.memo_cache_sentinel")) {
		t15 = /* @__PURE__ */ jsx(AutocompleteEmpty, {
			className: autocomplete_menu_module_default.Item,
			children: "No results"
		});
		$[26] = t15;
	} else t15 = $[26];
	let t16;
	if ($[27] !== t13 || $[28] !== t14) {
		t16 = /* @__PURE__ */ jsxs(AutocompletePopup, {
			className: autocomplete_menu_module_default.Popup,
			"data-testid": "slash-menu",
			children: [
				t13,
				t14,
				t15
			]
		});
		$[27] = t13;
		$[28] = t14;
		$[29] = t16;
	} else t16 = $[29];
	let t17;
	if ($[30] !== t11 || $[31] !== t16) {
		t17 = /* @__PURE__ */ jsx(AutocompletePositioner, {
			className: autocomplete_menu_module_default.Positioner,
			boundary: t11,
			children: t16
		});
		$[30] = t11;
		$[31] = t16;
		$[32] = t17;
	} else t17 = $[32];
	let t18;
	if ($[33] !== t10 || $[34] !== t17) {
		t18 = /* @__PURE__ */ jsxs(AutocompleteRoot, {
			regex: regex$2,
			onOpenChange: t8,
			onQueryChange: t9,
			children: [t10, t17]
		});
		$[33] = t10;
		$[34] = t17;
		$[35] = t18;
	} else t18 = $[35];
	return t18;
}
function _temp$1(item) {
	return /* @__PURE__ */ jsx(SlashMenuItem, {
		label: item.label,
		keywords: item.keywords,
		detail: item.detail,
		onSelect: item.onSelect
	}, item.id ?? item.label);
}

// src/components/table-handle.module.css
var table_handle_module_default = {
	"ColumnPopup": "meow_ColumnPopup_IPrN6a",
	"MenuItem": "meow_MenuItem_IPrN6a",
	"MenuPopup": "meow_MenuPopup_IPrN6a",
	"MenuPositioner": "meow_MenuPositioner_IPrN6a",
	"Positioner": "meow_Positioner_IPrN6a",
	"RowPopup": "meow_RowPopup_IPrN6a",
	"Trigger": "meow_Trigger_IPrN6a"
};

// src/components/table-handle.tsx
function TableHandleItem(t0) {
	const $ = c(6);
	const { children, onSelect, testId, active: t1, danger: t2 } = t0;
	const active = t1 === void 0 ? false : t1;
	const danger = t2 === void 0 ? false : t2;
	const t3 = active ? "" : void 0;
	const t4 = danger ? "" : void 0;
	let t5;
	if ($[0] !== children || $[1] !== onSelect || $[2] !== t3 || $[3] !== t4 || $[4] !== testId) {
		t5 = /* @__PURE__ */ jsx(MenuItem, {
			className: table_handle_module_default.MenuItem,
			onSelect,
			"data-testid": testId,
			"data-active": t3,
			"data-danger": t4,
			children
		});
		$[0] = children;
		$[1] = onSelect;
		$[2] = t3;
		$[3] = t4;
		$[4] = testId;
		$[5] = t5;
	} else t5 = $[5];
	return t5;
}
function canInsertLeft(editor) {
	return editor.commands.addTableColumnBefore.canExec();
}
function runInsertLeft(editor) {
	editor.commands.addTableColumnBefore();
}
function TableMenuInsertLeft(t0) {
	const $ = c(5);
	const { editor } = t0;
	const canExec = useEditorDerivedValue(canInsertLeft);
	let t1;
	if ($[0] !== editor) {
		t1 = () => runInsertLeft(editor);
		$[0] = editor;
		$[1] = t1;
	} else t1 = $[1];
	const handler = t1;
	let t2;
	if ($[2] !== canExec || $[3] !== handler) {
		t2 = canExec ? /* @__PURE__ */ jsx(TableHandleItem, {
			testId: "table-insert-left",
			onSelect: handler,
			children: /* @__PURE__ */ jsx("span", { children: "Insert Left" })
		}) : null;
		$[2] = canExec;
		$[3] = handler;
		$[4] = t2;
	} else t2 = $[4];
	return t2;
}
function canInsertRight(editor) {
	return editor.commands.addTableColumnAfter.canExec();
}
function runInsertRight(editor) {
	editor.commands.addTableColumnAfter();
}
function TableMenuInsertRight(t0) {
	const $ = c(5);
	const { editor } = t0;
	const canExec = useEditorDerivedValue(canInsertRight);
	let t1;
	if ($[0] !== editor) {
		t1 = () => runInsertRight(editor);
		$[0] = editor;
		$[1] = t1;
	} else t1 = $[1];
	const handler = t1;
	let t2;
	if ($[2] !== canExec || $[3] !== handler) {
		t2 = canExec ? /* @__PURE__ */ jsx(TableHandleItem, {
			testId: "table-insert-right",
			onSelect: handler,
			children: /* @__PURE__ */ jsx("span", { children: "Insert Right" })
		}) : null;
		$[2] = canExec;
		$[3] = handler;
		$[4] = t2;
	} else t2 = $[4];
	return t2;
}
function canAlign(editor) {
	return editor.commands.setTableColumnAlign.canExec("left");
}
function getActiveAlign(editor) {
	return getTableColumnAlign(editor.state);
}
function runAlign(editor, align, active) {
	editor.commands.setTableColumnAlign(active ? null : align);
}
function TableMenuAlignItem(t0) {
	const $ = c(14);
	const { label, editor, align, activeAlign } = t0;
	const active = activeAlign === align;
	let t1;
	if ($[0] !== active || $[1] !== align || $[2] !== editor) {
		t1 = () => runAlign(editor, align, active);
		$[0] = active;
		$[1] = align;
		$[2] = editor;
		$[3] = t1;
	} else t1 = $[3];
	const handler = t1;
	const t2 = `table-align-${align}`;
	let t3;
	if ($[4] !== label) {
		t3 = /* @__PURE__ */ jsx("span", { children: label });
		$[4] = label;
		$[5] = t3;
	} else t3 = $[5];
	let t4;
	if ($[6] !== active) {
		t4 = active && /* @__PURE__ */ jsx(CheckIcon, {});
		$[6] = active;
		$[7] = t4;
	} else t4 = $[7];
	let t5;
	if ($[8] !== active || $[9] !== handler || $[10] !== t2 || $[11] !== t3 || $[12] !== t4) {
		t5 = /* @__PURE__ */ jsxs(TableHandleItem, {
			testId: t2,
			active,
			onSelect: handler,
			children: [t3, t4]
		});
		$[8] = active;
		$[9] = handler;
		$[10] = t2;
		$[11] = t3;
		$[12] = t4;
		$[13] = t5;
	} else t5 = $[13];
	return t5;
}
function TableMenuAlignItems(t0) {
	const $ = c(3);
	const { editor } = t0;
	const activeAlign = useEditorDerivedValue(getActiveAlign);
	let t1;
	if ($[0] !== activeAlign || $[1] !== editor) {
		t1 = /* @__PURE__ */ jsxs(Fragment$1, { children: [
			/* @__PURE__ */ jsx(TableMenuAlignItem, {
				align: "left",
				label: "Align Left",
				editor,
				activeAlign
			}),
			/* @__PURE__ */ jsx(TableMenuAlignItem, {
				align: "center",
				label: "Align Center",
				editor,
				activeAlign
			}),
			/* @__PURE__ */ jsx(TableMenuAlignItem, {
				align: "right",
				label: "Align Right",
				editor,
				activeAlign
			})
		] });
		$[0] = activeAlign;
		$[1] = editor;
		$[2] = t1;
	} else t1 = $[2];
	return t1;
}
function TableMenuAlign(t0) {
	const $ = c(3);
	const { editor } = t0;
	const canExec = useEditorDerivedValue(canAlign);
	let t1;
	if ($[0] !== canExec || $[1] !== editor) {
		t1 = canExec ? /* @__PURE__ */ jsx(TableMenuAlignItems, { editor }) : null;
		$[0] = canExec;
		$[1] = editor;
		$[2] = t1;
	} else t1 = $[2];
	return t1;
}
function canClearContents(editor) {
	return editor.commands.deleteCellSelection.canExec();
}
function runClearContents(editor) {
	editor.commands.deleteCellSelection();
}
function TableMenuClearContents(t0) {
	const $ = c(6);
	const { editor, testId } = t0;
	const canExec = useEditorDerivedValue(canClearContents);
	let t1;
	if ($[0] !== editor) {
		t1 = () => runClearContents(editor);
		$[0] = editor;
		$[1] = t1;
	} else t1 = $[1];
	const handler = t1;
	let t2;
	if ($[2] !== canExec || $[3] !== handler || $[4] !== testId) {
		t2 = canExec ? /* @__PURE__ */ jsxs(TableHandleItem, {
			testId,
			onSelect: handler,
			children: [/* @__PURE__ */ jsx("span", { children: "Clear Contents" }), /* @__PURE__ */ jsx("kbd", { children: "Del" })]
		}) : null;
		$[2] = canExec;
		$[3] = handler;
		$[4] = testId;
		$[5] = t2;
	} else t2 = $[5];
	return t2;
}
function canDeleteColumn(editor) {
	return editor.commands.deleteTableColumn.canExec();
}
function runDeleteColumn(editor) {
	editor.commands.deleteTableColumn();
}
function TableMenuDeleteColumn(t0) {
	const $ = c(5);
	const { editor } = t0;
	const canExec = useEditorDerivedValue(canDeleteColumn);
	let t1;
	if ($[0] !== editor) {
		t1 = () => runDeleteColumn(editor);
		$[0] = editor;
		$[1] = t1;
	} else t1 = $[1];
	const handler = t1;
	let t2;
	if ($[2] !== canExec || $[3] !== handler) {
		t2 = canExec ? /* @__PURE__ */ jsx(TableHandleItem, {
			testId: "table-delete-column",
			onSelect: handler,
			children: /* @__PURE__ */ jsx("span", { children: "Delete Column" })
		}) : null;
		$[2] = canExec;
		$[3] = handler;
		$[4] = t2;
	} else t2 = $[4];
	return t2;
}
function canInsertAbove(editor) {
	return editor.commands.addTableRowAbove.canExec();
}
function runInsertAbove(editor) {
	editor.commands.addTableRowAbove();
}
function TableMenuInsertAbove(t0) {
	const $ = c(5);
	const { editor } = t0;
	const canExec = useEditorDerivedValue(canInsertAbove);
	let t1;
	if ($[0] !== editor) {
		t1 = () => runInsertAbove(editor);
		$[0] = editor;
		$[1] = t1;
	} else t1 = $[1];
	const handler = t1;
	let t2;
	if ($[2] !== canExec || $[3] !== handler) {
		t2 = canExec ? /* @__PURE__ */ jsx(TableHandleItem, {
			testId: "table-insert-above",
			onSelect: handler,
			children: /* @__PURE__ */ jsx("span", { children: "Insert Above" })
		}) : null;
		$[2] = canExec;
		$[3] = handler;
		$[4] = t2;
	} else t2 = $[4];
	return t2;
}
function canInsertBelow(editor) {
	return editor.commands.addTableRowBelow.canExec();
}
function runInsertBelow(editor) {
	editor.commands.addTableRowBelow();
}
function TableMenuInsertBelow(t0) {
	const $ = c(5);
	const { editor } = t0;
	const canExec = useEditorDerivedValue(canInsertBelow);
	let t1;
	if ($[0] !== editor) {
		t1 = () => runInsertBelow(editor);
		$[0] = editor;
		$[1] = t1;
	} else t1 = $[1];
	const handler = t1;
	let t2;
	if ($[2] !== canExec || $[3] !== handler) {
		t2 = canExec ? /* @__PURE__ */ jsx(TableHandleItem, {
			testId: "table-insert-below",
			onSelect: handler,
			children: /* @__PURE__ */ jsx("span", { children: "Insert Below" })
		}) : null;
		$[2] = canExec;
		$[3] = handler;
		$[4] = t2;
	} else t2 = $[4];
	return t2;
}
function canDeleteRow(editor) {
	return editor.commands.deleteTableRow.canExec();
}
function runDeleteRow(editor) {
	editor.commands.deleteTableRow();
}
function TableMenuDeleteRow(t0) {
	const $ = c(5);
	const { editor } = t0;
	const canExec = useEditorDerivedValue(canDeleteRow);
	let t1;
	if ($[0] !== editor) {
		t1 = () => runDeleteRow(editor);
		$[0] = editor;
		$[1] = t1;
	} else t1 = $[1];
	const handler = t1;
	let t2;
	if ($[2] !== canExec || $[3] !== handler) {
		t2 = canExec ? /* @__PURE__ */ jsx(TableHandleItem, {
			testId: "table-delete-row",
			onSelect: handler,
			children: /* @__PURE__ */ jsx("span", { children: "Delete Row" })
		}) : null;
		$[2] = canExec;
		$[3] = handler;
		$[4] = t2;
	} else t2 = $[4];
	return t2;
}
function canDeleteTable(editor) {
	return editor.commands.deleteTable.canExec();
}
function runDeleteTable(editor) {
	editor.commands.deleteTable();
}
function TableMenuDeleteTable(t0) {
	const $ = c(6);
	const { editor, testId } = t0;
	const canExec = useEditorDerivedValue(canDeleteTable);
	let t1;
	if ($[0] !== editor) {
		t1 = () => runDeleteTable(editor);
		$[0] = editor;
		$[1] = t1;
	} else t1 = $[1];
	const handler = t1;
	let t2;
	if ($[2] !== canExec || $[3] !== handler || $[4] !== testId) {
		t2 = canExec ? /* @__PURE__ */ jsx(TableHandleItem, {
			testId,
			danger: true,
			onSelect: handler,
			children: /* @__PURE__ */ jsx("span", { children: "Delete Table" })
		}) : null;
		$[2] = canExec;
		$[3] = handler;
		$[4] = testId;
		$[5] = t2;
	} else t2 = $[5];
	return t2;
}
function TableHandle() {
	const $ = c(11);
	const editor = useEditor$1();
	let t0;
	let t1;
	if ($[0] === Symbol.for("react.memo_cache_sentinel")) {
		t0 = /* @__PURE__ */ jsx(TableHandleDragPreview, {});
		t1 = /* @__PURE__ */ jsx(TableHandleDropIndicator, {});
		$[0] = t0;
		$[1] = t1;
	} else {
		t0 = $[0];
		t1 = $[1];
	}
	let t2;
	if ($[2] === Symbol.for("react.memo_cache_sentinel")) {
		t2 = /* @__PURE__ */ jsx(TableHandleColumnMenuTrigger, {
			className: table_handle_module_default.Trigger,
			"data-testid": "table-handle-column",
			children: /* @__PURE__ */ jsx(GripHorizontalIcon, {})
		});
		$[2] = t2;
	} else t2 = $[2];
	let t3;
	if ($[3] !== editor) {
		t3 = /* @__PURE__ */ jsx(TableHandleColumnPositioner, {
			className: table_handle_module_default.Positioner,
			children: /* @__PURE__ */ jsx(TableHandleColumnPopup, {
				className: table_handle_module_default.ColumnPopup,
				children: /* @__PURE__ */ jsxs(TableHandleColumnMenuRoot, { children: [t2, /* @__PURE__ */ jsx(MenuPositioner, {
					className: table_handle_module_default.MenuPositioner,
					children: /* @__PURE__ */ jsxs(MenuPopup, {
						className: table_handle_module_default.MenuPopup,
						"data-testid": "table-handle-column-menu",
						children: [
							/* @__PURE__ */ jsx(TableMenuInsertLeft, { editor }),
							/* @__PURE__ */ jsx(TableMenuInsertRight, { editor }),
							/* @__PURE__ */ jsx(TableMenuAlign, { editor }),
							/* @__PURE__ */ jsx(TableMenuClearContents, {
								editor,
								testId: "table-clear-column"
							}),
							/* @__PURE__ */ jsx(TableMenuDeleteColumn, { editor }),
							/* @__PURE__ */ jsx(TableMenuDeleteTable, {
								editor,
								testId: "table-delete-table-column"
							})
						]
					})
				})] })
			})
		});
		$[3] = editor;
		$[4] = t3;
	} else t3 = $[4];
	let t4;
	if ($[5] === Symbol.for("react.memo_cache_sentinel")) {
		t4 = /* @__PURE__ */ jsx(TableHandleRowMenuTrigger, {
			className: table_handle_module_default.Trigger,
			"data-testid": "table-handle-row",
			children: /* @__PURE__ */ jsx(GripVerticalIcon, {})
		});
		$[5] = t4;
	} else t4 = $[5];
	let t5;
	if ($[6] !== editor) {
		t5 = /* @__PURE__ */ jsx(TableHandleRowPositioner, {
			className: table_handle_module_default.Positioner,
			children: /* @__PURE__ */ jsx(TableHandleRowPopup, {
				className: table_handle_module_default.RowPopup,
				children: /* @__PURE__ */ jsxs(TableHandleRowMenuRoot, { children: [t4, /* @__PURE__ */ jsx(MenuPositioner, {
					className: table_handle_module_default.MenuPositioner,
					children: /* @__PURE__ */ jsxs(MenuPopup, {
						className: table_handle_module_default.MenuPopup,
						"data-testid": "table-handle-row-menu",
						children: [
							/* @__PURE__ */ jsx(TableMenuInsertAbove, { editor }),
							/* @__PURE__ */ jsx(TableMenuInsertBelow, { editor }),
							/* @__PURE__ */ jsx(TableMenuClearContents, {
								editor,
								testId: "table-clear-row"
							}),
							/* @__PURE__ */ jsx(TableMenuDeleteRow, { editor }),
							/* @__PURE__ */ jsx(TableMenuDeleteTable, {
								editor,
								testId: "table-delete-table-row"
							})
						]
					})
				})] })
			})
		});
		$[6] = editor;
		$[7] = t5;
	} else t5 = $[7];
	let t6;
	if ($[8] !== t3 || $[9] !== t5) {
		t6 = /* @__PURE__ */ jsxs(TableHandleRoot, { children: [
			t0,
			t1,
			t3,
			t5
		] });
		$[8] = t3;
		$[9] = t5;
		$[10] = t6;
	} else t6 = $[10];
	return t6;
}

// src/utils/returns-true.ts
function returnsTrue() {
	return true;
}

// src/components/tag-menu.tsx
const regex$1 = new RegExp((canUseRegexLookbehind() ? String.raw`(?<!\S)` : "") + String.raw`#[\da-z]+$`, "iu");
function TagMenu(t0) {
	const $ = c(25);
	const { onTagSearch } = t0;
	const editor = useEditor$1();
	const collisionBoundary = use(CollisionBoundaryContext);
	const [open, setOpen] = useState(false);
	const [query, setQuery] = useState("");
	let t1;
	if ($[0] === Symbol.for("react.memo_cache_sentinel")) {
		t1 = [];
		$[0] = t1;
	} else t1 = $[0];
	const [items, setItems] = useState(t1);
	const [loading, setLoading] = useState(false);
	let t2;
	if ($[1] !== onTagSearch) {
		t2 = async (query_0, signal) => {
			if (signal.aborted) return;
			setLoading(true);
			const result = await onTagSearch(query_0);
			if (signal.aborted) return;
			setItems(result);
			setLoading(false);
		};
		$[1] = onTagSearch;
		$[2] = t2;
	} else t2 = $[2];
	const fetchItems = t2;
	let t3;
	let t4;
	if ($[3] !== fetchItems || $[4] !== open || $[5] !== query) {
		t3 = () => {
			if (!open) return;
			const controller = new AbortController();
			queueMicrotask(() => {
				fetchItems(query, controller.signal);
			});
			return () => {
				controller.abort();
			};
		};
		t4 = [
			open,
			query,
			fetchItems
		];
		$[3] = fetchItems;
		$[4] = open;
		$[5] = query;
		$[6] = t3;
		$[7] = t4;
	} else {
		t3 = $[6];
		t4 = $[7];
	}
	useEffect(t3, t4);
	let t5;
	let t6;
	if ($[8] === Symbol.for("react.memo_cache_sentinel")) {
		t5 = (event) => setOpen(event.detail);
		t6 = (event_0) => setQuery(event_0.detail);
		$[8] = t5;
		$[9] = t6;
	} else {
		t5 = $[8];
		t6 = $[9];
	}
	let t7;
	if ($[10] !== collisionBoundary) {
		t7 = toFloatingBoundary(collisionBoundary);
		$[10] = collisionBoundary;
		$[11] = t7;
	} else t7 = $[11];
	let t8;
	if ($[12] !== editor || $[13] !== items) {
		let t9;
		if ($[15] !== editor) {
			t9 = (item) => /* @__PURE__ */ jsxs(AutocompleteItem, {
				value: item.tag,
				className: autocomplete_menu_module_default.Item,
				onSelect: () => {
					editor.commands.insertText({ text: `#${item.tag} ` });
					item.onSelect?.();
				},
				children: [/* @__PURE__ */ jsx("span", {
					className: autocomplete_menu_module_default.Label,
					children: item.label ?? `#${item.tag}`
				}), item.detail ? /* @__PURE__ */ jsx("span", {
					className: autocomplete_menu_module_default.Detail,
					children: item.detail
				}) : null]
			}, item.tag);
			$[15] = editor;
			$[16] = t9;
		} else t9 = $[16];
		t8 = items.map(t9);
		$[12] = editor;
		$[13] = items;
		$[14] = t8;
	} else t8 = $[14];
	const t9 = loading ? "Loading..." : "No tags found";
	let t10;
	if ($[17] !== t9) {
		t10 = /* @__PURE__ */ jsx(AutocompleteEmpty, {
			className: autocomplete_menu_module_default.Item,
			children: t9
		});
		$[17] = t9;
		$[18] = t10;
	} else t10 = $[18];
	let t11;
	if ($[19] !== t10 || $[20] !== t8) {
		t11 = /* @__PURE__ */ jsxs(AutocompletePopup, {
			className: autocomplete_menu_module_default.Popup,
			"data-testid": "tag-menu",
			children: [t8, t10]
		});
		$[19] = t10;
		$[20] = t8;
		$[21] = t11;
	} else t11 = $[21];
	let t12;
	if ($[22] !== t11 || $[23] !== t7) {
		t12 = /* @__PURE__ */ jsx(AutocompleteRoot, {
			regex: regex$1,
			filter: returnsTrue,
			onOpenChange: t5,
			onQueryChange: t6,
			children: /* @__PURE__ */ jsx(AutocompletePositioner, {
				className: autocomplete_menu_module_default.Positioner,
				boundary: t7,
				children: t11
			})
		});
		$[22] = t11;
		$[23] = t7;
		$[24] = t12;
	} else t12 = $[24];
	return t12;
}

// src/components/virtual-caret.tsx
function VirtualCaret() {
	const $ = c(3);
	const [layer, setLayer] = useState(null);
	let t0;
	if ($[0] !== layer) {
		t0 = layer == null ? null : defineVirtualCaret(layer);
		$[0] = layer;
		$[1] = t0;
	} else t0 = $[1];
	useExtension$1(t0);
	let t1;
	if ($[2] === Symbol.for("react.memo_cache_sentinel")) {
		t1 = /* @__PURE__ */ jsx("div", { ref: setLayer });
		$[2] = t1;
	} else t1 = $[2];
	return t1;
}

// src/components/wikilink-menu.tsx
const regex = new RegExp(String.raw`(?:\[\[[^[\]]*|` + (canUseRegexLookbehind() ? String.raw`(?<!\S)` : "") + String.raw`@(?:[^[\]\s][^[\]]*)?)$`, "u");
function queryFromRegexMatch(match) {
	return match[0].replace(/^(?:\[\[|@)/, "").trim();
}
function WikilinkMenu(t0) {
	const $ = c(25);
	const { onWikilinkSearch } = t0;
	const editor = useEditor$1();
	const collisionBoundary = use(CollisionBoundaryContext);
	const [open, setOpen] = useState(false);
	const [query, setQuery] = useState("");
	let t1;
	if ($[0] === Symbol.for("react.memo_cache_sentinel")) {
		t1 = [];
		$[0] = t1;
	} else t1 = $[0];
	const [items, setItems] = useState(t1);
	const [loading, setLoading] = useState(false);
	let t2;
	if ($[1] !== onWikilinkSearch) {
		t2 = async (query_0, signal) => {
			if (signal.aborted) return;
			setLoading(true);
			const result = await onWikilinkSearch(query_0);
			if (signal.aborted) return;
			setItems(result);
			setLoading(false);
		};
		$[1] = onWikilinkSearch;
		$[2] = t2;
	} else t2 = $[2];
	const fetchItems = t2;
	let t3;
	let t4;
	if ($[3] !== fetchItems || $[4] !== open || $[5] !== query) {
		t3 = () => {
			if (!open) return;
			const controller = new AbortController();
			queueMicrotask(() => {
				fetchItems(query, controller.signal);
			});
			return () => {
				controller.abort();
			};
		};
		t4 = [
			open,
			query,
			fetchItems
		];
		$[3] = fetchItems;
		$[4] = open;
		$[5] = query;
		$[6] = t3;
		$[7] = t4;
	} else {
		t3 = $[6];
		t4 = $[7];
	}
	useEffect(t3, t4);
	let t5;
	let t6;
	if ($[8] === Symbol.for("react.memo_cache_sentinel")) {
		t5 = (event) => setOpen(event.detail);
		t6 = (event_0) => setQuery(event_0.detail);
		$[8] = t5;
		$[9] = t6;
	} else {
		t5 = $[8];
		t6 = $[9];
	}
	let t7;
	if ($[10] !== collisionBoundary) {
		t7 = toFloatingBoundary(collisionBoundary);
		$[10] = collisionBoundary;
		$[11] = t7;
	} else t7 = $[11];
	let t8;
	if ($[12] !== editor || $[13] !== items) {
		let t9;
		if ($[15] !== editor) {
			t9 = (item) => /* @__PURE__ */ jsxs(AutocompleteItem, {
				value: item.target,
				className: autocomplete_menu_module_default.Item,
				onSelect: () => {
					editor.commands.insertText({ text: `[[${item.target}]]` });
					item.onSelect?.();
				},
				children: [/* @__PURE__ */ jsx("span", {
					className: autocomplete_menu_module_default.Label,
					children: item.label ?? item.target
				}), item.detail ? /* @__PURE__ */ jsx("span", {
					className: autocomplete_menu_module_default.Detail,
					title: item.detail,
					children: item.detail
				}) : null]
			}, item.target);
			$[15] = editor;
			$[16] = t9;
		} else t9 = $[16];
		t8 = items.map(t9);
		$[12] = editor;
		$[13] = items;
		$[14] = t8;
	} else t8 = $[14];
	const t9 = loading ? "Loading..." : "No notes found";
	let t10;
	if ($[17] !== t9) {
		t10 = /* @__PURE__ */ jsx(AutocompleteEmpty, {
			className: autocomplete_menu_module_default.Item,
			children: t9
		});
		$[17] = t9;
		$[18] = t10;
	} else t10 = $[18];
	let t11;
	if ($[19] !== t10 || $[20] !== t8) {
		t11 = /* @__PURE__ */ jsxs(AutocompletePopup, {
			className: autocomplete_menu_module_default.Popup,
			"data-testid": "wikilink-menu",
			children: [t8, t10]
		});
		$[19] = t10;
		$[20] = t8;
		$[21] = t11;
	} else t11 = $[21];
	let t12;
	if ($[22] !== t11 || $[23] !== t7) {
		t12 = /* @__PURE__ */ jsx(AutocompleteRoot, {
			regex,
			filter: returnsTrue,
			followCursor: true,
			queryBuilder: queryFromRegexMatch,
			onOpenChange: t5,
			onQueryChange: t6,
			children: /* @__PURE__ */ jsx(AutocompletePositioner, {
				className: autocomplete_menu_module_default.Positioner,
				boundary: t7,
				children: t11
			})
		});
		$[22] = t11;
		$[23] = t7;
		$[24] = t12;
	} else t12 = $[24];
	return t12;
}

// src/components/prosekit-editor.tsx
function resolveSelection(doc, selection) {
	if (selection === "start") return Selection.atStart(doc);
	if (selection === "end") return Selection.atEnd(doc);
	try {
		return Selection.fromJSON(doc, selection);
	} catch {
		const size = doc.content.size;
		const anchor = clamp(selection.anchor ?? 0, 0, size);
		const head = clamp(selection.head ?? anchor, 0, size);
		return TextSelection.between(doc.resolve(anchor), doc.resolve(head));
	}
}
function decodeHeadingFragment(fragment) {
	const source = fragment.startsWith("#") ? fragment.slice(1) : fragment;
	try {
		return decodeURIComponent(source);
	} catch {
		return source;
	}
}
function headingLookupKey(value) {
	return value.normalize("NFKC").trim().replaceAll(/\s+/g, " ").toLowerCase();
}
function findHeadingPosition(doc, fragment) {
	const decodedTarget = decodeHeadingFragment(fragment);
	const target = headingLookupKey(decodedTarget);
	if (!target) return;
	const slugTarget = decodedTarget.normalize("NFKC").toLowerCase();
	const slugger = new GithubSlugger();
	let match;
	doc.descendants((node, pos) => {
		if (match != null) return false;
		if (!isNodeOfType(node, "heading")) return true;
		const displayText = getTextblockDisplayText(node);
		const slug = slugger.slug(displayText);
		if (headingLookupKey(node.textContent) === target || headingLookupKey(displayText) === target || slug === slugTarget) {
			match = pos + 1;
			return false;
		}
		return true;
	});
	return match;
}
function ProseKitEditor(t0) {
	const $ = c(117);
	const { markMode: t1, initialMarkdown, singleParagraph: t2, referenceDefinitions, onDocChange, onSlashMenuSearch, onTagSearch, onWikilinkSearch, onSelectionMenuSearch, selectionMenuAffordance: t3, collisionBoundary, pendingReplacementActions, onPendingReplacementResolve, onWikilinkClick, onLinkClick, onLinkCopy, resolveLinkPreview, onTagClick, onExitBoundary, resolveImageUrl, resolveFileLink, resolveWikiEmbed, resolveWikilink, resolveFileInfo, resolveXPost, mediaUrlProtocols, resolveYouTubeVideo, onFileClick, onFilePaste, onFileSaveError, onImageClick, onXPostMediaClick, onYouTubeVideoClick, embedPaste, linkPaste, bulletAfterHeading, backspaceDeletesEmptyFirstBlock, substitution: t4, frontmatter: t5, blockHandle: t6, placeholder, readOnly, spellCheck, writingSuggestions, autoCorrect, autoCapitalize, enterKeyHint, dir, lang, ariaLabel, searchQuery: t7, onSearchChange, timeFormat, editorClassName, CodeBlockView, ref, children } = t0;
	const markMode = t1 === void 0 ? "focus" : t1;
	const singleParagraph = t2 === void 0 ? false : t2;
	const selectionMenuAffordance = t3 === void 0 ? true : t3;
	const substitution = t4 === void 0 ? true : t4;
	const frontmatter = t5 === void 0 ? false : t5;
	const blockHandle = t6 === void 0 ? true : t6;
	const searchQuery = t7 === void 0 ? "" : t7;
	const suppressDocChangeRef = useRef(false);
	let t8;
	bb0: {
		if (!onDocChange) {
			t8 = void 0;
			break bb0;
		}
		let t9;
		if ($[0] !== onDocChange) {
			t9 = () => {
				if (suppressDocChangeRef.current) return;
				onDocChange();
			};
			$[0] = onDocChange;
			$[1] = t9;
		} else t9 = $[1];
		t8 = t9;
	}
	const handleDocChange = t8;
	const wikilinkEnabled = !!onWikilinkSearch;
	let t9;
	if ($[2] !== ariaLabel || $[3] !== autoCapitalize || $[4] !== autoCorrect || $[5] !== backspaceDeletesEmptyFirstBlock || $[6] !== bulletAfterHeading || $[7] !== dir || $[8] !== editorClassName || $[9] !== embedPaste || $[10] !== enterKeyHint || $[11] !== lang || $[12] !== linkPaste || $[13] !== markMode || $[14] !== mediaUrlProtocols || $[15] !== onExitBoundary || $[16] !== onFileClick || $[17] !== onFilePaste || $[18] !== onFileSaveError || $[19] !== onImageClick || $[20] !== onLinkClick || $[21] !== onTagClick || $[22] !== onWikilinkClick || $[23] !== onXPostMediaClick || $[24] !== onYouTubeVideoClick || $[25] !== placeholder || $[26] !== readOnly || $[27] !== referenceDefinitions || $[28] !== resolveFileInfo || $[29] !== resolveFileLink || $[30] !== resolveImageUrl || $[31] !== resolveWikiEmbed || $[32] !== resolveWikilink || $[33] !== resolveXPost || $[34] !== resolveYouTubeVideo || $[35] !== singleParagraph || $[36] !== spellCheck || $[37] !== substitution || $[38] !== wikilinkEnabled || $[39] !== writingSuggestions) {
		t9 = {
			markMode,
			resolveFileLink,
			resolveWikiEmbed,
			resolveWikilink,
			onWikilinkClick,
			onLinkClick,
			onTagClick,
			onExitBoundary,
			resolveImageUrl,
			resolveFileInfo,
			resolveXPost,
			mediaUrlProtocols,
			resolveYouTubeVideo,
			onFileClick,
			onFilePaste,
			onFileSaveError,
			onImageClick,
			onXPostMediaClick,
			onYouTubeVideoClick,
			embedPaste,
			linkPaste,
			bulletAfterHeading,
			backspaceDeletesEmptyFirstBlock,
			substitution,
			singleParagraph,
			placeholder,
			readOnly,
			spellCheck,
			writingSuggestions,
			autoCorrect,
			autoCapitalize,
			enterKeyHint,
			dir,
			lang,
			ariaLabel,
			editorClassName,
			wikilinkEnabled,
			referenceDefinitions
		};
		$[2] = ariaLabel;
		$[3] = autoCapitalize;
		$[4] = autoCorrect;
		$[5] = backspaceDeletesEmptyFirstBlock;
		$[6] = bulletAfterHeading;
		$[7] = dir;
		$[8] = editorClassName;
		$[9] = embedPaste;
		$[10] = enterKeyHint;
		$[11] = lang;
		$[12] = linkPaste;
		$[13] = markMode;
		$[14] = mediaUrlProtocols;
		$[15] = onExitBoundary;
		$[16] = onFileClick;
		$[17] = onFilePaste;
		$[18] = onFileSaveError;
		$[19] = onImageClick;
		$[20] = onLinkClick;
		$[21] = onTagClick;
		$[22] = onWikilinkClick;
		$[23] = onXPostMediaClick;
		$[24] = onYouTubeVideoClick;
		$[25] = placeholder;
		$[26] = readOnly;
		$[27] = referenceDefinitions;
		$[28] = resolveFileInfo;
		$[29] = resolveFileLink;
		$[30] = resolveImageUrl;
		$[31] = resolveWikiEmbed;
		$[32] = resolveWikilink;
		$[33] = resolveXPost;
		$[34] = resolveYouTubeVideo;
		$[35] = singleParagraph;
		$[36] = spellCheck;
		$[37] = substitution;
		$[38] = wikilinkEnabled;
		$[39] = writingSuggestions;
		$[40] = t9;
	} else t9 = $[40];
	const config = t9;
	let t10;
	if ($[41] !== CodeBlockView || $[42] !== config || $[43] !== frontmatter || $[44] !== initialMarkdown || $[45] !== singleParagraph) {
		t10 = () => {
			const baseExtension = defineEditorExtension(config);
			const extension = CodeBlockView === false ? baseExtension : union(baseExtension, defineCodeBlockView(CodeBlockView));
			const editor = createEditor({ extension });
			if (initialMarkdown || singleParagraph) editor.setContent(singleParagraph ? paragraphMarkdownToDoc(initialMarkdown ?? "", editor.nodes) : markdownToDoc(initialMarkdown ?? "", {
				nodes: editor.nodes,
				frontmatter
			}));
			return editor;
		};
		$[41] = CodeBlockView;
		$[42] = config;
		$[43] = frontmatter;
		$[44] = initialMarkdown;
		$[45] = singleParagraph;
		$[46] = t10;
	} else t10 = $[46];
	const [editor_0] = useState(t10);
	const [selectionMenuContext, setSelectionMenuContext] = useState();
	const hasSelectionMenu = !!onSelectionMenuSearch;
	let t11;
	if ($[47] !== editor_0) {
		t11 = () => {
			const { state } = editor_0;
			const { from, to, empty } = state.selection;
			if (empty) return;
			setSelectionMenuContext({
				selectedText: getSelectedText(state),
				from,
				to
			});
		};
		$[47] = editor_0;
		$[48] = t11;
	} else t11 = $[48];
	const openSelectionMenu = t11;
	let t12;
	if ($[49] === Symbol.for("react.memo_cache_sentinel")) {
		t12 = () => {
			setSelectionMenuContext(void 0);
		};
		$[49] = t12;
	} else t12 = $[49];
	const closeSelectionMenu = t12;
	let t13;
	let t14;
	if ($[50] !== editor_0 || $[51] !== frontmatter || $[52] !== hasSelectionMenu || $[53] !== openSelectionMenu || $[54] !== singleParagraph) {
		t13 = () => {
			const getMarkdown = function getMarkdown() {
				return singleParagraph ? docToParagraphMarkdown(editor_0.state.doc) : docToMarkdown(editor_0.state.doc, { frontmatter });
			};
			const getSelection = function getSelection() {
				return editor_0.state.selection.toJSON();
			};
			const getState = function getState() {
				return [getMarkdown(), getSelection()];
			};
			const replaceState = function replaceState(markdown, selection, t15, t16) {
				const addToHistory = t15 === void 0 ? true : t15;
				const forceMarkdown = t16 === void 0 ? false : t16;
				if (markdown == null && !selection) return;
				const transaction = editor_0.state.tr;
				if (markdown != null) {
					const doc = singleParagraph ? paragraphMarkdownToDoc(markdown, editor_0.nodes) : markdownToDoc(markdown, {
						nodes: editor_0.nodes,
						frontmatter
					});
					const currentMarkdown = docToMarkdown(transaction.doc, { frontmatter });
					const nextMarkdown = docToMarkdown(doc, { frontmatter });
					if (forceMarkdown || currentMarkdown !== nextMarkdown) transaction.replaceWith(0, transaction.doc.content.size, doc.content);
					else if (!selection) return;
				}
				if (selection) transaction.setSelection(resolveSelection(transaction.doc, selection)).scrollIntoView();
				if (!addToHistory) transaction.setMeta("addToHistory", false);
				suppressDocChangeRef.current = true;
				try {
					editor_0.view.dispatch(transaction);
					suppressDocChangeRef.current = false;
				} catch (t17) {
					const error = t17;
					suppressDocChangeRef.current = false;
					throw error;
				}
			};
			const setState = function setState(markdown_0, selection_0) {
				replaceState(markdown_0, selection_0);
			};
			return {
				getMarkdown,
				setMarkdown: function setMarkdown(markdown_1) {
					setState(markdown_1);
				},
				insertMarkdown: function insertMarkdown(markdown_3) {
					editor_0.commands.insertMarkdown(markdown_3);
				},
				getState,
				setState,
				refreshMarkdownRendering: function refreshMarkdownRendering() {
					const [markdown_2, selection_1] = getState();
					replaceState(markdown_2, selection_1, false, true);
				},
				getSelection,
				setSelection: function setSelection(selection_2) {
					setState(void 0, selection_2);
				},
				focus: function focus() {
					editor_0.focus();
				},
				isAtTextblockBoundary: function isAtTextblockBoundary(direction) {
					return editor_0.mounted && editor_0.view.endOfTextblock(direction);
				},
				scrollIntoView: function scrollIntoView() {
					editor_0.commands.scrollIntoView();
				},
				revealHeading: function revealHeading(fragment) {
					const position = findHeadingPosition(editor_0.state.doc, fragment);
					if (position == null) return false;
					const selection_3 = TextSelection.near(editor_0.state.doc.resolve(position));
					editor_0.view.dispatch(editor_0.state.tr.setSelection(selection_3).scrollIntoView());
					return true;
				},
				getSelectedText: function getSelectedTextFromState() {
					return getSelectedText(editor_0.state);
				},
				openSelectionMenu: function openSelectionMenuFromHandle() {
					if (!hasSelectionMenu) return;
					openSelectionMenu();
				},
				startPendingReplacement: function startPendingReplacement(options) {
					return editor_0.commands.startPendingReplacement(options);
				},
				appendPendingReplacementText: function appendPendingReplacementText(text) {
					editor_0.commands.appendPendingReplacementText(text);
				},
				acceptPendingReplacement: function acceptPendingReplacement(options_0) {
					editor_0.commands.acceptPendingReplacement(options_0 ?? {});
				},
				discardPendingReplacement: function discardPendingReplacement() {
					editor_0.commands.discardPendingReplacement();
				},
				findNext: function findNext() {
					editor_0.commands.findNext();
				},
				findPrevious: function findPrevious() {
					editor_0.commands.findPrev();
				},
				getEditor: () => editor_0
			};
		};
		t14 = [
			editor_0,
			frontmatter,
			hasSelectionMenu,
			openSelectionMenu,
			singleParagraph
		];
		$[50] = editor_0;
		$[51] = frontmatter;
		$[52] = hasSelectionMenu;
		$[53] = openSelectionMenu;
		$[54] = singleParagraph;
		$[55] = t13;
		$[56] = t14;
	} else {
		t13 = $[55];
		t14 = $[56];
	}
	useImperativeHandle(ref, t13, t14);
	let t15;
	if ($[57] !== editor_0) {
		t15 = (element) => editor_0.mount(element);
		$[57] = editor_0;
		$[58] = t15;
	} else t15 = $[58];
	const mount = t15;
	let t16;
	if ($[59] === Symbol.for("react.memo_cache_sentinel")) {
		t16 = /* @__PURE__ */ jsx(VirtualCaret, {});
		$[59] = t16;
	} else t16 = $[59];
	let t17;
	if ($[60] !== mount) {
		t17 = /* @__PURE__ */ jsx("div", { ref: mount });
		$[60] = mount;
		$[61] = t17;
	} else t17 = $[61];
	let t18;
	if ($[62] !== config || $[63] !== handleDocChange || $[64] !== onSearchChange || $[65] !== searchQuery) {
		t18 = /* @__PURE__ */ jsx(EditorExtensions, {
			config,
			searchQuery,
			onDocChange: handleDocChange,
			onSearchChange
		});
		$[62] = config;
		$[63] = handleDocChange;
		$[64] = onSearchChange;
		$[65] = searchQuery;
		$[66] = t18;
	} else t18 = $[66];
	let t19;
	if ($[67] !== blockHandle || $[68] !== readOnly) {
		t19 = blockHandle && !readOnly && /* @__PURE__ */ jsx(BlockHandle, {});
		$[67] = blockHandle;
		$[68] = readOnly;
		$[69] = t19;
	} else t19 = $[69];
	let t20;
	if ($[70] !== readOnly) {
		t20 = !readOnly && /* @__PURE__ */ jsx(TableHandle, {});
		$[70] = readOnly;
		$[71] = t20;
	} else t20 = $[71];
	let t21;
	if ($[72] !== blockHandle || $[73] !== readOnly) {
		t21 = blockHandle && !readOnly && /* @__PURE__ */ jsx(DropIndicator$1, {});
		$[72] = blockHandle;
		$[73] = readOnly;
		$[74] = t21;
	} else t21 = $[74];
	let t22;
	if ($[75] !== onFilePaste || $[76] !== onFileSaveError || $[77] !== onSlashMenuSearch || $[78] !== timeFormat) {
		t22 = /* @__PURE__ */ jsx(SlashMenu, {
			timeFormat,
			onSlashMenuSearch,
			onFilePaste,
			onFileSaveError
		});
		$[75] = onFilePaste;
		$[76] = onFileSaveError;
		$[77] = onSlashMenuSearch;
		$[78] = timeFormat;
		$[79] = t22;
	} else t22 = $[79];
	const t23 = String(readOnly);
	let t24;
	if ($[80] !== onLinkClick || $[81] !== onLinkCopy || $[82] !== readOnly || $[83] !== resolveLinkPreview || $[84] !== t23) {
		t24 = /* @__PURE__ */ jsx(LinkMenu, {
			onLinkClick,
			onLinkCopy,
			resolveLinkPreview,
			readOnly
		}, t23);
		$[80] = onLinkClick;
		$[81] = onLinkCopy;
		$[82] = readOnly;
		$[83] = resolveLinkPreview;
		$[84] = t23;
		$[85] = t24;
	} else t24 = $[85];
	let t25;
	if ($[86] !== onTagSearch) {
		t25 = onTagSearch && /* @__PURE__ */ jsx(TagMenu, { onTagSearch });
		$[86] = onTagSearch;
		$[87] = t25;
	} else t25 = $[87];
	let t26;
	if ($[88] !== onWikilinkSearch) {
		t26 = onWikilinkSearch && /* @__PURE__ */ jsx(WikilinkMenu, { onWikilinkSearch });
		$[88] = onWikilinkSearch;
		$[89] = t26;
	} else t26 = $[89];
	let t27;
	if ($[90] !== onSelectionMenuSearch || $[91] !== openSelectionMenu || $[92] !== readOnly || $[93] !== selectionMenuAffordance || $[94] !== selectionMenuContext) {
		t27 = onSelectionMenuSearch && !readOnly && /* @__PURE__ */ jsx(SelectionMenu, {
			onSelectionMenuSearch,
			context: selectionMenuContext,
			onOpen: openSelectionMenu,
			onClose: closeSelectionMenu,
			affordance: selectionMenuAffordance
		});
		$[90] = onSelectionMenuSearch;
		$[91] = openSelectionMenu;
		$[92] = readOnly;
		$[93] = selectionMenuAffordance;
		$[94] = selectionMenuContext;
		$[95] = t27;
	} else t27 = $[95];
	let t28;
	if ($[96] !== onPendingReplacementResolve || $[97] !== pendingReplacementActions || $[98] !== readOnly) {
		t28 = !readOnly && /* @__PURE__ */ jsx(PendingReplacementPreview, {
			actions: pendingReplacementActions,
			onResolve: onPendingReplacementResolve
		});
		$[96] = onPendingReplacementResolve;
		$[97] = pendingReplacementActions;
		$[98] = readOnly;
		$[99] = t28;
	} else t28 = $[99];
	let t29;
	if ($[100] !== children || $[101] !== editor_0 || $[102] !== t17 || $[103] !== t18 || $[104] !== t19 || $[105] !== t20 || $[106] !== t21 || $[107] !== t22 || $[108] !== t24 || $[109] !== t25 || $[110] !== t26 || $[111] !== t27 || $[112] !== t28) {
		t29 = /* @__PURE__ */ jsxs(ProseKit, {
			editor: editor_0,
			children: [
				t16,
				t17,
				t18,
				t19,
				t20,
				t21,
				t22,
				t24,
				t25,
				t26,
				t27,
				t28,
				children
			]
		});
		$[100] = children;
		$[101] = editor_0;
		$[102] = t17;
		$[103] = t18;
		$[104] = t19;
		$[105] = t20;
		$[106] = t21;
		$[107] = t22;
		$[108] = t24;
		$[109] = t25;
		$[110] = t26;
		$[111] = t27;
		$[112] = t28;
		$[113] = t29;
	} else t29 = $[113];
	let t30;
	if ($[114] !== collisionBoundary || $[115] !== t29) {
		t30 = /* @__PURE__ */ jsx(CollisionBoundaryContext, {
			value: collisionBoundary,
			children: t29
		});
		$[114] = collisionBoundary;
		$[115] = t29;
		$[116] = t30;
	} else t30 = $[116];
	return t30;
}

// src/components/editor.tsx
const CARET_GLIDE_OFF = { "--meowdown-caret-glide": "0ms" };
/**
* A hybrid live-preview Markdown editor: the document stays Markdown text,
* rendered in place as rich content.
*
* Callbacks and resolvers should be stable; pass them via `useCallback`.
*/
function MarkdownEditor(t0) {
	const $ = c(65);
	const { mode: t1, initialMarkdown, singleParagraph, referenceDefinitions, onDocChange, onSlashMenuSearch, onTagSearch, onWikilinkSearch, onSelectionMenuSearch, selectionMenuAffordance: t2, collisionBoundary, pendingReplacementActions, onPendingReplacementResolve, onWikilinkClick, onLinkClick, onLinkCopy, resolveLinkPreview, onTagClick, onExitBoundary, resolveImageUrl, resolveFileLink, resolveWikiEmbed, resolveWikilink, resolveFileInfo, resolveXPost, mediaUrlProtocols, resolveYouTubeVideo, onFileClick, onFilePaste, onFileSaveError, onImageClick, onXPostMediaClick, onYouTubeVideoClick, embedPaste: t3, linkPaste: t4, bulletAfterHeading: t5, backspaceDeletesEmptyFirstBlock: t6, substitution: t7, frontmatter: t8, blockHandle: t9, caretGlide: t10, placeholder, readOnly, spellCheck, writingSuggestions, autoCorrect, autoCapitalize, enterKeyHint, dir, lang, ariaLabel, searchQuery, onSearchChange, timeFormat, editorClassName, wrapperClassName, CodeBlockView, handleRef, children } = t0;
	const mode = t1 === void 0 ? "focus" : t1;
	const selectionMenuAffordance = t2 === void 0 ? true : t2;
	const embedPaste = t3 === void 0 ? true : t3;
	const linkPaste = t4 === void 0 ? true : t4;
	const bulletAfterHeading = t5 === void 0 ? false : t5;
	const backspaceDeletesEmptyFirstBlock = t6 === void 0 ? false : t6;
	const substitution = t7 === void 0 ? true : t7;
	const frontmatter = t8 === void 0 ? false : t8;
	const blockHandle = t9 === void 0 ? true : t9;
	const caretGlide = t10 === void 0 ? true : t10;
	const childRef = useRef(null);
	let t11;
	let t12;
	if ($[0] === Symbol.for("react.memo_cache_sentinel")) {
		t11 = () => {
			return {
				getMarkdown: function getMarkdown() {
					return childRef.current?.getMarkdown() ?? "";
				},
				setMarkdown: function setMarkdown(markdown) {
					childRef.current?.setMarkdown(markdown);
				},
				insertMarkdown: function insertMarkdown(markdown_0) {
					childRef.current?.insertMarkdown(markdown_0);
				},
				getState: function getState() {
					return childRef.current?.getState() ?? ["", {
						type: "text",
						anchor: 0,
						head: 0
					}];
				},
				setState: function setState(markdown_1, selection) {
					childRef.current?.setState(markdown_1, selection);
				},
				refreshMarkdownRendering: function refreshMarkdownRendering() {
					childRef.current?.refreshMarkdownRendering();
				},
				getSelection: function getSelection() {
					return childRef.current?.getSelection() ?? {
						type: "text",
						anchor: 0,
						head: 0
					};
				},
				setSelection: function setSelection(selection_0) {
					childRef.current?.setSelection(selection_0);
				},
				focus: function focus() {
					childRef.current?.focus();
				},
				isAtTextblockBoundary: function isAtTextblockBoundary(direction) {
					return childRef.current?.isAtTextblockBoundary(direction) ?? false;
				},
				scrollIntoView: function scrollIntoView() {
					childRef.current?.scrollIntoView();
				},
				revealHeading: function revealHeading(fragment) {
					return childRef.current?.revealHeading(fragment) ?? false;
				},
				getSelectedText: function getSelectedText() {
					return childRef.current?.getSelectedText() ?? "";
				},
				openSelectionMenu: function openSelectionMenu() {
					childRef.current?.openSelectionMenu();
				},
				startPendingReplacement: function startPendingReplacement(options) {
					return childRef.current?.startPendingReplacement(options) ?? false;
				},
				appendPendingReplacementText: function appendPendingReplacementText(text) {
					childRef.current?.appendPendingReplacementText(text);
				},
				acceptPendingReplacement: function acceptPendingReplacement(options_0) {
					childRef.current?.acceptPendingReplacement(options_0);
				},
				discardPendingReplacement: function discardPendingReplacement() {
					childRef.current?.discardPendingReplacement();
				},
				findNext: function findNext() {
					childRef.current?.findNext();
				},
				findPrevious: function findPrevious() {
					childRef.current?.findPrevious();
				},
				getEditor: function getEditor() {
					return childRef.current?.getEditor();
				}
			};
		};
		t12 = [];
		$[0] = t11;
		$[1] = t12;
	} else {
		t11 = $[0];
		t12 = $[1];
	}
	useImperativeHandle(handleRef, t11, t12);
	let t13;
	if ($[2] !== wrapperClassName) {
		t13 = clsx("meowdown", wrapperClassName);
		$[2] = wrapperClassName;
		$[3] = t13;
	} else t13 = $[3];
	const t14 = caretGlide ? void 0 : CARET_GLIDE_OFF;
	let t15;
	if ($[4] !== CodeBlockView || $[5] !== ariaLabel || $[6] !== autoCapitalize || $[7] !== autoCorrect || $[8] !== backspaceDeletesEmptyFirstBlock || $[9] !== blockHandle || $[10] !== bulletAfterHeading || $[11] !== children || $[12] !== collisionBoundary || $[13] !== dir || $[14] !== editorClassName || $[15] !== embedPaste || $[16] !== enterKeyHint || $[17] !== frontmatter || $[18] !== initialMarkdown || $[19] !== lang || $[20] !== linkPaste || $[21] !== mediaUrlProtocols || $[22] !== mode || $[23] !== onDocChange || $[24] !== onExitBoundary || $[25] !== onFileClick || $[26] !== onFilePaste || $[27] !== onFileSaveError || $[28] !== onImageClick || $[29] !== onLinkClick || $[30] !== onLinkCopy || $[31] !== onPendingReplacementResolve || $[32] !== onSearchChange || $[33] !== onSelectionMenuSearch || $[34] !== onSlashMenuSearch || $[35] !== onTagClick || $[36] !== onTagSearch || $[37] !== onWikilinkClick || $[38] !== onWikilinkSearch || $[39] !== onXPostMediaClick || $[40] !== onYouTubeVideoClick || $[41] !== pendingReplacementActions || $[42] !== placeholder || $[43] !== readOnly || $[44] !== referenceDefinitions || $[45] !== resolveFileInfo || $[46] !== resolveFileLink || $[47] !== resolveImageUrl || $[48] !== resolveLinkPreview || $[49] !== resolveWikiEmbed || $[50] !== resolveWikilink || $[51] !== resolveXPost || $[52] !== resolveYouTubeVideo || $[53] !== searchQuery || $[54] !== selectionMenuAffordance || $[55] !== singleParagraph || $[56] !== spellCheck || $[57] !== substitution || $[58] !== timeFormat || $[59] !== writingSuggestions) {
		t15 = /* @__PURE__ */ jsx(ProseKitEditor, {
			ref: childRef,
			markMode: mode,
			initialMarkdown,
			singleParagraph,
			referenceDefinitions,
			onDocChange,
			onSlashMenuSearch,
			onTagSearch,
			onWikilinkSearch,
			onSelectionMenuSearch,
			selectionMenuAffordance,
			collisionBoundary,
			pendingReplacementActions,
			onPendingReplacementResolve,
			onWikilinkClick,
			onLinkClick,
			onLinkCopy,
			resolveLinkPreview,
			onTagClick,
			onExitBoundary,
			resolveImageUrl,
			resolveFileLink,
			resolveWikiEmbed,
			resolveWikilink,
			resolveFileInfo,
			resolveXPost,
			mediaUrlProtocols,
			resolveYouTubeVideo,
			onFileClick,
			onFilePaste,
			onFileSaveError,
			onImageClick,
			onXPostMediaClick,
			onYouTubeVideoClick,
			embedPaste,
			linkPaste,
			bulletAfterHeading,
			backspaceDeletesEmptyFirstBlock,
			substitution,
			frontmatter,
			blockHandle,
			placeholder,
			readOnly,
			spellCheck,
			writingSuggestions,
			autoCorrect,
			autoCapitalize,
			enterKeyHint,
			dir,
			lang,
			ariaLabel,
			searchQuery,
			onSearchChange,
			timeFormat,
			editorClassName,
			CodeBlockView,
			children
		});
		$[4] = CodeBlockView;
		$[5] = ariaLabel;
		$[6] = autoCapitalize;
		$[7] = autoCorrect;
		$[8] = backspaceDeletesEmptyFirstBlock;
		$[9] = blockHandle;
		$[10] = bulletAfterHeading;
		$[11] = children;
		$[12] = collisionBoundary;
		$[13] = dir;
		$[14] = editorClassName;
		$[15] = embedPaste;
		$[16] = enterKeyHint;
		$[17] = frontmatter;
		$[18] = initialMarkdown;
		$[19] = lang;
		$[20] = linkPaste;
		$[21] = mediaUrlProtocols;
		$[22] = mode;
		$[23] = onDocChange;
		$[24] = onExitBoundary;
		$[25] = onFileClick;
		$[26] = onFilePaste;
		$[27] = onFileSaveError;
		$[28] = onImageClick;
		$[29] = onLinkClick;
		$[30] = onLinkCopy;
		$[31] = onPendingReplacementResolve;
		$[32] = onSearchChange;
		$[33] = onSelectionMenuSearch;
		$[34] = onSlashMenuSearch;
		$[35] = onTagClick;
		$[36] = onTagSearch;
		$[37] = onWikilinkClick;
		$[38] = onWikilinkSearch;
		$[39] = onXPostMediaClick;
		$[40] = onYouTubeVideoClick;
		$[41] = pendingReplacementActions;
		$[42] = placeholder;
		$[43] = readOnly;
		$[44] = referenceDefinitions;
		$[45] = resolveFileInfo;
		$[46] = resolveFileLink;
		$[47] = resolveImageUrl;
		$[48] = resolveLinkPreview;
		$[49] = resolveWikiEmbed;
		$[50] = resolveWikilink;
		$[51] = resolveXPost;
		$[52] = resolveYouTubeVideo;
		$[53] = searchQuery;
		$[54] = selectionMenuAffordance;
		$[55] = singleParagraph;
		$[56] = spellCheck;
		$[57] = substitution;
		$[58] = timeFormat;
		$[59] = writingSuggestions;
		$[60] = t15;
	} else t15 = $[60];
	let t16;
	if ($[61] !== t13 || $[62] !== t14 || $[63] !== t15) {
		t16 = /* @__PURE__ */ jsx("div", {
			className: t13,
			style: t14,
			children: t15
		});
		$[61] = t13;
		$[62] = t14;
		$[63] = t15;
		$[64] = t16;
	} else t16 = $[64];
	return t16;
}

// src/hooks/use-maybe-promise.ts
/**
* The settled value of `input`: `input` itself when it is not a `Promise`,
* otherwise `undefined` until it resolves. A rejection stays `undefined` and is
* reported with `console.warn`, since the caller has no other way to see it. A
* new `input` discards the previous `Promise`'s result at once, so a stale
* value never shows for a newer input. Callers memoize `input`, or a fresh
* `Promise` on every render never settles.
*/
function useMaybePromise(input) {
	const $ = c(3);
	const [settled, setSettled] = useState(null);
	let t0;
	let t1;
	if ($[0] !== input) {
		t0 = () => {
			if (!(input instanceof Promise)) return;
			let active = true;
			input.then((value) => {
				if (active) setSettled({
					input,
					value
				});
			}, (error) => {
				if (active) console.warn("[meowdown] useMaybePromise input rejected:", error);
			});
			return () => {
				active = false;
			};
		};
		t1 = [input];
		$[0] = input;
		$[1] = t0;
		$[2] = t1;
	} else {
		t0 = $[1];
		t1 = $[2];
	}
	useEffect(t0, t1);
	if (!(input instanceof Promise)) return input;
	return settled?.input === input ? settled.value : void 0;
}

// src/components/attributes-to-props.ts
const UNCONTROLLED_COMPONENT_ATTRIBUTES = ["checked", "value"];
const UNCONTROLLED_COMPONENT_NAMES = [
	"input",
	"select",
	"textarea"
];
/**
* Converts HTML/SVG DOM attributes to React props.
*
* @param attributes - HTML/SVG DOM attributes.
* @param nodeName - DOM node name.
* @returns - React props.
*/
function attributesToProps(attributes = {}, nodeName) {
	const props = {};
	const isInputValueOnly = nodeName === "input" || !!attributes["reset"] || !!attributes["submit"];
	for (const [attributeName, attributeValue] of Object.entries(attributes)) {
		if (attributeValue === void 0) continue;
		const attributeNameLowerCased = attributeName.toLowerCase();
		if (attributeNameLowerCased === "style") continue;
		if (attributeNameLowerCased === "contenteditable") continue;
		if (attributeNameLowerCased.startsWith("aria-") || attributeNameLowerCased.startsWith("data-")) {
			props[attributeName] = attributeValue;
			continue;
		}
		let propName = getPropName(attributeNameLowerCased);
		if (propName) {
			const propertyInfo = getPropertyInfo(propName);
			if (!isInputValueOnly && UNCONTROLLED_COMPONENT_ATTRIBUTES.includes(propName) && UNCONTROLLED_COMPONENT_NAMES.includes(nodeName)) propName = getPropName("default" + attributeNameLowerCased);
			props[propName] = attributeValue;
			switch (propertyInfo?.type) {
				case BOOLEAN:
					props[propName] = true;
					break;
				case OVERLOADED_BOOLEAN: if (attributeValue === "") props[propName] = true;
			}
			continue;
		}
		props[attributeName] = attributeValue;
	}
	return props;
}
/**
* Gets prop name from lowercased attribute name.
*
* @param attributeName - Lowercased attribute name.
* @returns - Prop name.
*/
function getPropName(attributeName) {
	return possibleStandardNames[attributeName];
}

// src/components/dom-output-spec.tsx
function normalizeDOMOutputSpec(domSpec) {
	const spec = domSpec;
	if (!spec || !Array.isArray(spec)) return;
	const tag = spec[0];
	let childStart = 1;
	let attrs;
	const second = spec[1];
	if (second != null && second !== 0 && typeof second === "object" && !Array.isArray(second)) {
		attrs = second;
		childStart = 2;
	}
	const rest = spec.slice(childStart);
	return [
		tag,
		attrs,
		rest
	];
}

// src/components/markdown-view.tsx
/**
* Convert a ProseMirror `DOMOutputSpec` into a React node, substituting `content`
* for the spec's content hole (`0`). Reused for every node/mark spec the static
* walker does not special-case, so blocks and plain marks render off their real
* `toDOM`, exactly as the editor serializes them.
*/
function outputSpecToReact(spec, content, context) {
	const key = context.keyCounter.value++;
	if (typeof spec === "string") return spec;
	if (spec === 0) return /* @__PURE__ */ jsx(Fragment, { children: content }, key);
	const normalized = normalizeDOMOutputSpec(spec);
	if (!normalized) return null;
	const [tag, attrs, rest] = normalized;
	const reactProps = { ...attributesToProps(attrs, tag) };
	reactProps.key = `${key} ${JSON.stringify(attrs)}`;
	if (tag === "input" && attrs?.["type"] === "checkbox") {
		reactProps.readOnly = true;
		if (!context.interactive) {
			reactProps.disabled = true;
			reactProps.tabIndex = -1;
		}
	}
	const reactChildren = rest.map((child) => outputSpecToReact(child, content, context));
	return createElement(tag, reactProps, ...reactChildren);
}
function WikilinkChip(props) {
	const $ = c(13);
	const { target, display, onWikilinkClick, children } = props;
	let t0;
	if ($[0] !== onWikilinkClick || $[1] !== target) {
		t0 = onWikilinkClick ? (event) => onWikilinkClick({
			target,
			event: event.nativeEvent,
			mod: isModEvent(event)
		}) : void 0;
		$[0] = onWikilinkClick;
		$[1] = target;
		$[2] = t0;
	} else t0 = $[2];
	const handleClick = t0;
	const t1 = display || target;
	let t2;
	if ($[3] !== t1) {
		t2 = /* @__PURE__ */ jsx("span", {
			className: "md-wikilink-view-label",
			contentEditable: false,
			children: t1
		});
		$[3] = t1;
		$[4] = t2;
	} else t2 = $[4];
	let t3;
	if ($[5] !== handleClick || $[6] !== t2) {
		t3 = /* @__PURE__ */ jsx("span", {
			className: "md-wikilink-view-preview md-atom-view-preview",
			"data-testid": "wikilink",
			contentEditable: false,
			onClick: handleClick,
			children: t2
		});
		$[5] = handleClick;
		$[6] = t2;
		$[7] = t3;
	} else t3 = $[7];
	let t4;
	if ($[8] !== children) {
		t4 = /* @__PURE__ */ jsx("span", {
			className: "md-wikilink-view-content md-atom-view-content",
			children
		});
		$[8] = children;
		$[9] = t4;
	} else t4 = $[9];
	let t5;
	if ($[10] !== t3 || $[11] !== t4) {
		t5 = /* @__PURE__ */ jsxs("span", {
			className: "md-wikilink-view md-atom-view",
			children: [t3, t4]
		});
		$[10] = t3;
		$[11] = t4;
		$[12] = t5;
	} else t5 = $[12];
	return t5;
}
function PostEmbed(props) {
	const $ = c(18);
	const { kind, src, width, snapshot, resolveXPost, mediaUrlProtocols, resolveYouTubeVideo } = props;
	registerXPost();
	registerYouTubeVideo();
	let t0;
	let t1;
	let t2;
	let t3;
	let t4;
	if ($[0] !== kind || $[1] !== mediaUrlProtocols || $[2] !== resolveXPost || $[3] !== resolveYouTubeVideo || $[4] !== snapshot || $[5] !== src || $[6] !== width) {
		const saved = snapshot == null ? void 0 : parsePostEmbedSnapshot(snapshot);
		t0 = "md-image-view-preview md-atom-view-preview";
		t1 = false;
		t2 = `${kind}-embed`;
		t3 = kind;
		t4 = kind === "x-post" ? createElement("meowdown-embed-x", {
			data: null,
			url: src,
			resolver: resolveXPost ?? defaultResolveXPost,
			mediaUrlProtocols: mediaUrlProtocols ?? null
		}) : createElement("meowdown-embed-youtube", {
			data: saved?.kind === "youtube-video" ? saved.data : null,
			url: src,
			resolver: resolveYouTubeVideo,
			playback: "inline",
			style: width == null ? void 0 : {
				width,
				maxWidth: "none"
			}
		});
		$[0] = kind;
		$[1] = mediaUrlProtocols;
		$[2] = resolveXPost;
		$[3] = resolveYouTubeVideo;
		$[4] = snapshot;
		$[5] = src;
		$[6] = width;
		$[7] = t0;
		$[8] = t1;
		$[9] = t2;
		$[10] = t3;
		$[11] = t4;
	} else {
		t0 = $[7];
		t1 = $[8];
		t2 = $[9];
		t3 = $[10];
		t4 = $[11];
	}
	let t5;
	if ($[12] !== t0 || $[13] !== t1 || $[14] !== t2 || $[15] !== t3 || $[16] !== t4) {
		t5 = /* @__PURE__ */ jsx("span", {
			className: t0,
			contentEditable: t1,
			"data-testid": t2,
			"data-post-embed": t3,
			children: t4
		});
		$[12] = t0;
		$[13] = t1;
		$[14] = t2;
		$[15] = t3;
		$[16] = t4;
		$[17] = t5;
	} else t5 = $[17];
	return t5;
}
function ImagePreview(props) {
	const $ = c(28);
	const { src, alt, width, height, snapshot, resolveImageUrl, resolveXPost, mediaUrlProtocols, resolveYouTubeVideo, onImageClick, interactive } = props;
	let t0;
	if ($[0] !== src) {
		t0 = matchEmbed(src);
		$[0] = src;
		$[1] = t0;
	} else t0 = $[1];
	const kind = t0;
	let t1;
	if ($[2] !== kind || $[3] !== resolveImageUrl || $[4] !== src) {
		t1 = kind ? void 0 : (resolveImageUrl ?? defaultResolveImageUrl)(src);
		$[2] = kind;
		$[3] = resolveImageUrl;
		$[4] = src;
		$[5] = t1;
	} else t1 = $[5];
	const resolved = t1;
	const url = useMaybePromise(resolved);
	if (kind) {
		if (!interactive) return null;
		const t2 = resolveYouTubeVideo ?? defaultResolveYouTubeVideo;
		let t3;
		if ($[6] !== kind || $[7] !== mediaUrlProtocols || $[8] !== resolveXPost || $[9] !== snapshot || $[10] !== src || $[11] !== t2 || $[12] !== width) {
			t3 = /* @__PURE__ */ jsx(PostEmbed, {
				kind,
				src,
				width,
				snapshot,
				resolveXPost,
				mediaUrlProtocols,
				resolveYouTubeVideo: t2
			}, src);
			$[6] = kind;
			$[7] = mediaUrlProtocols;
			$[8] = resolveXPost;
			$[9] = snapshot;
			$[10] = src;
			$[11] = t2;
			$[12] = width;
			$[13] = t3;
		} else t3 = $[13];
		return t3;
	}
	if (!url) {
		if (resolved instanceof Promise && width != null && height != null) {
			const t2 = `${width}px`;
			const t3 = `${height}px`;
			let t4;
			if ($[14] !== t2 || $[15] !== t3) {
				t4 = /* @__PURE__ */ jsx("span", {
					className: "md-image-view-preview md-atom-view-preview",
					"data-testid": "image-preview",
					contentEditable: false,
					children: /* @__PURE__ */ jsx("span", {
						className: "md-image-resizable",
						"data-testid": "image-resizable",
						"data-loading": "",
						style: {
							width: t2,
							height: t3
						}
					})
				});
				$[14] = t2;
				$[15] = t3;
				$[16] = t4;
			} else t4 = $[16];
			return t4;
		}
		return null;
	}
	let t2;
	if ($[17] !== alt || $[18] !== onImageClick || $[19] !== src) {
		t2 = onImageClick ? (event) => onImageClick({
			src,
			alt,
			event: event.nativeEvent,
			element: event.currentTarget,
			mod: isModEvent(event)
		}) : void 0;
		$[17] = alt;
		$[18] = onImageClick;
		$[19] = src;
		$[20] = t2;
	} else t2 = $[20];
	const handleClick = t2;
	let t3;
	if ($[21] !== width) {
		t3 = width == null ? void 0 : { width: `${width}px` };
		$[21] = width;
		$[22] = t3;
	} else t3 = $[22];
	let t4;
	if ($[23] !== alt || $[24] !== handleClick || $[25] !== t3 || $[26] !== url) {
		t4 = /* @__PURE__ */ jsx("span", {
			className: "md-image-view-preview md-atom-view-preview",
			"data-testid": "image-preview",
			contentEditable: false,
			children: /* @__PURE__ */ jsx("img", {
				src: url,
				alt,
				draggable: false,
				onClick: handleClick,
				style: t3
			})
		});
		$[23] = alt;
		$[24] = handleClick;
		$[25] = t3;
		$[26] = url;
		$[27] = t4;
	} else t4 = $[27];
	return t4;
}
function ImageView(props) {
	const $ = c(17);
	const { src, alt, width, height, snapshot, context, children } = props;
	let t0;
	if ($[0] !== alt || $[1] !== context.interactive || $[2] !== context.mediaUrlProtocols || $[3] !== context.onImageClick || $[4] !== context.resolveImageUrl || $[5] !== context.resolveXPost || $[6] !== context.resolveYouTubeVideo || $[7] !== height || $[8] !== snapshot || $[9] !== src || $[10] !== width) {
		t0 = /* @__PURE__ */ jsx(ImagePreview, {
			src,
			alt,
			width,
			height,
			snapshot,
			resolveImageUrl: context.resolveImageUrl,
			resolveXPost: context.resolveXPost,
			mediaUrlProtocols: context.mediaUrlProtocols,
			resolveYouTubeVideo: context.resolveYouTubeVideo,
			onImageClick: context.onImageClick,
			interactive: context.interactive
		});
		$[0] = alt;
		$[1] = context.interactive;
		$[2] = context.mediaUrlProtocols;
		$[3] = context.onImageClick;
		$[4] = context.resolveImageUrl;
		$[5] = context.resolveXPost;
		$[6] = context.resolveYouTubeVideo;
		$[7] = height;
		$[8] = snapshot;
		$[9] = src;
		$[10] = width;
		$[11] = t0;
	} else t0 = $[11];
	let t1;
	if ($[12] !== children) {
		t1 = /* @__PURE__ */ jsx("span", {
			className: "md-image-view-content md-atom-view-content",
			children
		});
		$[12] = children;
		$[13] = t1;
	} else t1 = $[13];
	let t2;
	if ($[14] !== t0 || $[15] !== t1) {
		t2 = /* @__PURE__ */ jsxs("span", {
			className: "md-image-view md-atom-view",
			children: [t0, t1]
		});
		$[14] = t0;
		$[15] = t1;
		$[16] = t2;
	} else t2 = $[16];
	return t2;
}
function FileView(props) {
	const $ = c(26);
	const { href, name, context, children } = props;
	const resolveFileInfo = context.resolveFileInfo;
	const [resolvedSize, setResolvedSize] = useState();
	let t0;
	let t1;
	if ($[0] !== href || $[1] !== resolveFileInfo) {
		t0 = () => {
			if (!resolveFileInfo) return;
			let active = true;
			const load = async () => {
				let info;
				try {
					info = await resolveFileInfo(href);
				} catch (t2) {
					console.error("[meowdown] resolveFileInfo failed:", t2);
					return;
				}
				if (!active || info?.size == null || !Number.isFinite(info.size) || info.size < 0) return;
				setResolvedSize({
					href,
					resolver: resolveFileInfo,
					text: formatFileSize(info.size)
				});
			};
			load();
			return () => {
				active = false;
			};
		};
		t1 = [resolveFileInfo, href];
		$[0] = href;
		$[1] = resolveFileInfo;
		$[2] = t0;
		$[3] = t1;
	} else {
		t0 = $[2];
		t1 = $[3];
	}
	useEffect(t0, t1);
	const size = resolvedSize?.href === href && resolvedSize.resolver === resolveFileInfo ? resolvedSize.text : "";
	let t2;
	if ($[4] !== context || $[5] !== href || $[6] !== name) {
		t2 = context.onFileClick ? (event) => {
			context.onFileClick?.({
				href,
				name,
				event: event.nativeEvent,
				mod: isModEvent(event)
			});
		} : void 0;
		$[4] = context;
		$[5] = href;
		$[6] = name;
		$[7] = t2;
	} else t2 = $[7];
	const handleClick = t2;
	let t3;
	if ($[8] !== href) {
		t3 = getFileKind(href);
		$[8] = href;
		$[9] = t3;
	} else t3 = $[9];
	let t4;
	if ($[10] === Symbol.for("react.memo_cache_sentinel")) {
		t4 = /* @__PURE__ */ jsxs("svg", {
			className: "md-file-view-icon",
			viewBox: "0 0 24 24",
			"aria-hidden": "true",
			fill: "none",
			stroke: "currentColor",
			strokeWidth: "2",
			strokeLinecap: "round",
			strokeLinejoin: "round",
			children: [/* @__PURE__ */ jsx("path", { d: "M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" }), /* @__PURE__ */ jsx("path", { d: "M14 2v4a2 2 0 0 0 2 2h4" })]
		});
		$[10] = t4;
	} else t4 = $[10];
	let t5;
	if ($[11] !== name) {
		t5 = /* @__PURE__ */ jsx("span", {
			className: "md-file-view-name",
			children: name
		});
		$[11] = name;
		$[12] = t5;
	} else t5 = $[12];
	let t6;
	if ($[13] !== size) {
		t6 = /* @__PURE__ */ jsx("span", {
			className: "md-file-view-size",
			"data-testid": "file-pill-size",
			children: size
		});
		$[13] = size;
		$[14] = t6;
	} else t6 = $[14];
	let t7;
	if ($[15] !== handleClick || $[16] !== name || $[17] !== t3 || $[18] !== t5 || $[19] !== t6) {
		t7 = /* @__PURE__ */ jsxs("span", {
			className: "md-file-view-preview md-atom-view-preview",
			"data-testid": "file-pill",
			"data-file-kind": t3,
			contentEditable: false,
			title: name,
			onClick: handleClick,
			children: [
				t4,
				t5,
				t6
			]
		});
		$[15] = handleClick;
		$[16] = name;
		$[17] = t3;
		$[18] = t5;
		$[19] = t6;
		$[20] = t7;
	} else t7 = $[20];
	let t8;
	if ($[21] !== children) {
		t8 = /* @__PURE__ */ jsx("span", {
			className: "md-file-view-content md-atom-view-content",
			children
		});
		$[21] = children;
		$[22] = t8;
	} else t8 = $[22];
	let t9;
	if ($[23] !== t7 || $[24] !== t8) {
		t9 = /* @__PURE__ */ jsxs("span", {
			className: "md-file-view md-atom-view",
			children: [t7, t8]
		});
		$[23] = t7;
		$[24] = t8;
		$[25] = t9;
	} else t9 = $[25];
	return t9;
}
function renderTokens(code, tokens) {
	const out = [];
	let pos = 0;
	let index = 0;
	for (const [from, to, classes] of tokens) {
		if (from > pos) out.push(/* @__PURE__ */ jsx(Fragment, { children: code.slice(pos, from) }, `gap-${index}`));
		out.push(/* @__PURE__ */ jsx("span", {
			className: classes,
			children: code.slice(from, to)
		}, index));
		pos = to;
		index++;
	}
	if (pos < code.length) out.push(/* @__PURE__ */ jsx(Fragment, { children: code.slice(pos) }, "tail"));
	return out;
}
function CodeBlock(t0) {
	const $ = c(11);
	const { code, language } = t0;
	let t1;
	if ($[0] !== code || $[1] !== language) {
		t1 = getCodeTokens(code, language);
		$[0] = code;
		$[1] = language;
		$[2] = t1;
	} else t1 = $[2];
	const tokens = useMaybePromise(t1) ?? [];
	const t2 = language || void 0;
	let t3;
	if ($[3] !== code || $[4] !== tokens) {
		t3 = tokens.length > 0 ? renderTokens(code, tokens) : code;
		$[3] = code;
		$[4] = tokens;
		$[5] = t3;
	} else t3 = $[5];
	let t4;
	if ($[6] !== t3) {
		t4 = /* @__PURE__ */ jsx("code", { children: t3 });
		$[6] = t3;
		$[7] = t4;
	} else t4 = $[7];
	let t5;
	if ($[8] !== t2 || $[9] !== t4) {
		t5 = /* @__PURE__ */ jsx("pre", {
			"data-language": t2,
			children: t4
		});
		$[8] = t2;
		$[9] = t4;
		$[10] = t5;
	} else t5 = $[10];
	return t5;
}
/**
* Mirrors the editor's `MathMarkView` DOM: a KaTeX preview next to the source
* text, flipped by the same mode CSS (the read-only view has no caret, so the
* preview always shows in hide/focus modes).
*/
function MathView(props) {
	const $ = c(10);
	const { formula, children } = props;
	const katex = useKaTeX(true);
	if (!katex) {
		let t0;
		if ($[0] !== formula) {
			t0 = /* @__PURE__ */ jsx("span", { children: formula });
			$[0] = formula;
			$[1] = t0;
		} else t0 = $[1];
		return t0;
	}
	let t0;
	if ($[2] !== formula || $[3] !== katex) {
		t0 = /* @__PURE__ */ jsx(MathRender, {
			katex,
			formula,
			displayMode: false,
			className: "md-math-view-preview",
			"data-testid": "math-preview"
		});
		$[2] = formula;
		$[3] = katex;
		$[4] = t0;
	} else t0 = $[4];
	let t1;
	if ($[5] !== children) {
		t1 = /* @__PURE__ */ jsx("span", {
			className: "md-math-view-content",
			children
		});
		$[5] = children;
		$[6] = t1;
	} else t1 = $[6];
	let t2;
	if ($[7] !== t0 || $[8] !== t1) {
		t2 = /* @__PURE__ */ jsxs("span", {
			className: "md-math-view",
			children: [t0, t1]
		});
		$[7] = t0;
		$[8] = t1;
		$[9] = t2;
	} else t2 = $[9];
	return t2;
}
/**
* A `math` code block: the rendered formula alone, the source while KaTeX loads.
*/
function MathCodeBlock(t0) {
	const $ = c(5);
	const { code } = t0;
	const katex = useKaTeX(true);
	if (!katex) {
		let t1;
		if ($[0] !== code) {
			t1 = /* @__PURE__ */ jsx(CodeBlock, {
				code,
				language: "math"
			});
			$[0] = code;
			$[1] = t1;
		} else t1 = $[1];
		return t1;
	}
	let t1;
	if ($[2] !== code || $[3] !== katex) {
		t1 = /* @__PURE__ */ jsx(MathRender, {
			katex,
			formula: code,
			displayMode: true,
			className: code_block_view_module_default.Preview,
			"data-testid": "code-block-math-preview"
		});
		$[2] = code;
		$[3] = katex;
		$[4] = t1;
	} else t1 = $[4];
	return t1;
}
function MermaidCodeBlock(t0) {
	const $ = c(5);
	const { code } = t0;
	const renderer = useBeautifulMermaid(true);
	if (!renderer || code.trim() === "") {
		let t1;
		if ($[0] !== code) {
			t1 = /* @__PURE__ */ jsx(CodeBlock, {
				code,
				language: "mermaid"
			});
			$[0] = code;
			$[1] = t1;
		} else t1 = $[1];
		return t1;
	}
	let t1;
	if ($[2] !== code || $[3] !== renderer) {
		t1 = /* @__PURE__ */ jsx(MermaidRender, {
			renderer,
			source: code,
			className: `${code_block_view_module_default.Preview} ${code_block_view_module_default.MermaidPreview}`,
			"data-testid": "code-block-mermaid-preview"
		});
		$[2] = code;
		$[3] = renderer;
		$[4] = t1;
	} else t1 = $[4];
	return t1;
}
/**
* Wrap inline `children` in one mark, special-casing the view/link marks.
*/
function wrapMark(mark, children, context) {
	switch (mark.type.name) {
		case "mdWikilink": {
			const attrs = mark.attrs;
			return /* @__PURE__ */ jsx(WikilinkChip, {
				target: attrs.target,
				display: attrs.display,
				onWikilinkClick: context.onWikilinkClick,
				children
			});
		}
		case "mdImage": {
			const attrs = mark.attrs;
			return /* @__PURE__ */ jsx(ImageView, {
				src: attrs.src,
				alt: attrs.alt,
				width: attrs.width,
				height: attrs.height,
				snapshot: attrs.snapshot,
				context,
				children
			});
		}
		case "mdFile": {
			const attrs = mark.attrs;
			return /* @__PURE__ */ jsx(FileView, {
				href: attrs.href,
				name: attrs.name,
				context,
				children
			});
		}
		case "mdMath": {
			const attrs = mark.attrs;
			return /* @__PURE__ */ jsx(MathView, {
				formula: attrs.formula,
				children
			});
		}
		case "mdLinkText": {
			const attrs = mark.attrs;
			if (!context.interactive) return /* @__PURE__ */ jsx("span", {
				className: "md-link",
				children
			});
			const handleClick = context.onLinkClick ? (event) => {
				event.preventDefault();
				context.onLinkClick?.({
					href: attrs.href,
					event: event.nativeEvent,
					mod: isModEvent(event)
				});
			} : void 0;
			return /* @__PURE__ */ jsx("a", {
				className: "md-link",
				href: attrs.href,
				onClick: handleClick,
				children
			});
		}
		default: {
			const toDOM = mark.type.spec.toDOM;
			if (!toDOM) return children;
			return outputSpecToReact(toDOM(mark, true), children, context);
		}
	}
}
/**
* Render a run of inline pieces, sharing a parent element across adjacent pieces
* that have the same mark at `depth`. This mirrors ProseMirror's DOM
* serialization, which keeps a mark element open across consecutive content (so
* `**bold**` is one `<strong>` wrapping `**`, `bold`, `**`, not three).
*/
function renderRuns(runs, depth, context) {
	const out = [];
	let index = 0;
	let key = 0;
	while (index < runs.length) {
		const run = runs[index];
		if (run.marks.length <= depth) {
			out.push(/* @__PURE__ */ jsx(Fragment, { children: run.text }, key++));
			index++;
			continue;
		}
		const mark = run.marks[depth];
		let end = index + 1;
		while (end < runs.length && runs[end].marks.length > depth && runs[end].marks[depth].eq(mark)) end++;
		const inner = renderRuns(runs.slice(index, end), depth + 1, context);
		out.push(/* @__PURE__ */ jsx(Fragment, { children: wrapMark(mark, inner, context) }, key++));
		index = end;
	}
	return out;
}
function renderInline(node, context) {
	const text = node.textContent;
	if (!text) return null;
	return renderRuns(inlineTextToMarkChunksWithContext(getMarkBuilders(), text, {
		resolveFileLink: context.resolveFileLink,
		resolveWikiEmbed: context.resolveWikiEmbed,
		resolveWikilink: context.resolveWikilink
	}, { referenceDefinitions: context.referenceDefinitions }).map(([from, to, marks]) => ({
		text: text.slice(from, to),
		marks: Mark.setFrom(marks)
	})), 0, context);
}
/**
* A collapsed list renders as an expanded one
*/
function expandCollapsedList(node) {
	const attrs = node.attrs;
	if (!attrs.collapsed) return node;
	return node.type.create({
		...attrs,
		collapsed: false
	}, node.content, node.marks);
}
function createTaskClickHandler(node, context) {
	const attrs = node.attrs;
	const { onTaskClick } = context;
	if (attrs.kind !== "task" || !onTaskClick) return void 0;
	const index = context.taskCounter.value++;
	const checked = attrs.checked === true;
	const marker = attrs.marker ?? null;
	const text = node.firstChild?.isTextblock ? node.firstChild.textContent.split("\n", 1)[0] ?? "" : "";
	return (event) => {
		event.preventDefault();
		onTaskClick({
			index,
			checked,
			marker,
			text,
			event: event.nativeEvent
		});
	};
}
function renderCodeBlock(node, key) {
	const attrs = node.attrs;
	const language = typeof attrs.language === "string" ? attrs.language : "";
	if (language === "math") return /* @__PURE__ */ jsx(MathCodeBlock, { code: node.textContent }, key);
	if (language === "mermaid") return /* @__PURE__ */ jsx(MermaidCodeBlock, { code: node.textContent }, key);
	return /* @__PURE__ */ jsx(CodeBlock, {
		code: node.textContent,
		language
	}, key);
}
function renderBlock(node, context, parent, index) {
	if (!context.singleParagraph && isReferenceDefinitionNode(node, parent, index)) return null;
	const key = context.keyCounter.value++;
	const typeName = node.type.name;
	let handleTaskClick;
	if (typeName === "list") {
		if (context.expandCollapsed) node = expandCollapsedList(node);
		handleTaskClick = createTaskClickHandler(node, context);
	}
	if (typeName === "codeBlock") return renderCodeBlock(node, key);
	const toDOM = node.type.spec.toDOM;
	if (node.isTextblock) {
		const inline = renderInline(node, context);
		return toDOM ? outputSpecToReact(toDOM(node), inline, context) : /* @__PURE__ */ jsx(Fragment, { children: inline }, key);
	}
	const children = node.content.content.map((child, childIndex) => {
		return renderBlock(child, context, node, childIndex);
	});
	const reactNode = toDOM ? outputSpecToReact(toDOM(node), children, context) : /* @__PURE__ */ jsx(Fragment, { children }, key);
	if (typeName === "list" && handleTaskClick && typeof reactNode !== "string" && reactNode != null) return cloneElement(reactNode, { onClick: handleTaskClick });
	return reactNode;
}
function isTaskList(node) {
	return isNodeOfType(node, "list") && node.attrs.kind === "task";
}
/**
* Checkboxes a block renders, in the same pre-order `renderBlock` walks, so a
* block's first checkbox index is the sum over the blocks before it.
*/
function countTaskItems(node) {
	let count = isTaskList(node) ? 1 : 0;
	node.descendants((child) => {
		if (isTaskList(child)) count++;
		return true;
	});
	return count;
}
/**
* The effective definitions as one string, so blocks can compare them by
* content: `collectReferenceDefinitions` builds a new map on every parse.
*/
function definitionsSignature(definitions) {
	let signature = "";
	for (const { key, href, title } of definitions.values()) signature += `${key}\0${href}\0${title}\n`;
	return signature;
}
function splitBlocks(doc) {
	const blocks = [];
	let taskBase = 0;
	for (const node of doc.content.content) {
		blocks.push({
			node,
			taskBase
		});
		taskBase += countTaskItems(node);
	}
	return blocks;
}
/**
* One top-level block. Memoized on the block's own content (`Node.eq`), its
* first checkbox index, the shared props object, and the definitions'
* content, so a growing document re-renders only the block that changed.
*/
const MarkdownBlock = memo(function MarkdownBlock({ node, taskBase, context, referenceDefinitions }) {
	return renderBlock(node, {
		...context,
		referenceDefinitions,
		taskCounter: { value: taskBase },
		keyCounter: { value: 0 }
	}, null, 0);
}, (previous, next) => {
	return previous.taskBase === next.taskBase && previous.context === next.context && previous.definitionsKey === next.definitionsKey && (previous.node === next.node || previous.node.eq(next.node));
});
/**
* Render Markdown to a read-only React tree that looks exactly like the editor
* in `hide` mark mode: inline marks, wikilink chips, images, tweet/YouTube
* embeds, and syntax-highlighted code. No editor, no ProseMirror view; just a
* walk over `markdownToDoc`'s document reusing meowdown's own parse, mark logic,
* and CSS (the root carries `ProseMirror` + `data-mark-mode` so the existing
* stylesheet applies). Requires a DOM environment.
*
* Callbacks (`onWikilinkClick`, etc.) and resolvers should be stable; pass them via
* `useCallback` to avoid re-rendering the whole tree.
*/
function MarkdownView(t0) {
	const $ = c(47);
	const { markdown, singleParagraph: t1, referenceDefinitions: suppliedDefinitions, markMode: t2, frontmatter: t3, interactive: t4, expandCollapsed: t5, resolveImageUrl, resolveFileLink, resolveWikiEmbed, resolveWikilink, resolveFileInfo, resolveXPost, mediaUrlProtocols, resolveYouTubeVideo, onWikilinkClick, onLinkClick, onImageClick, onXPostMediaClick, onYouTubeVideoClick, onFileClick, onTaskClick, className } = t0;
	const singleParagraph = t1 === void 0 ? false : t1;
	const markMode = t2 === void 0 ? "hide" : t2;
	const frontmatter = t3 === void 0 ? false : t3;
	const interactive = t4 === void 0 ? true : t4;
	const expandCollapsed = t5 === void 0 ? false : t5;
	const t6 = interactive ? onWikilinkClick : void 0;
	const t7 = interactive ? onLinkClick : void 0;
	const t8 = interactive ? onImageClick : void 0;
	const t9 = interactive ? onFileClick : void 0;
	const t10 = interactive ? onTaskClick : void 0;
	let t11;
	if ($[0] !== expandCollapsed || $[1] !== interactive || $[2] !== mediaUrlProtocols || $[3] !== resolveFileInfo || $[4] !== resolveFileLink || $[5] !== resolveImageUrl || $[6] !== resolveWikiEmbed || $[7] !== resolveWikilink || $[8] !== resolveXPost || $[9] !== resolveYouTubeVideo || $[10] !== singleParagraph || $[11] !== t10 || $[12] !== t6 || $[13] !== t7 || $[14] !== t8 || $[15] !== t9) {
		t11 = {
			singleParagraph,
			interactive,
			expandCollapsed,
			resolveImageUrl,
			resolveFileLink,
			resolveWikiEmbed,
			resolveWikilink,
			resolveFileInfo,
			resolveXPost,
			mediaUrlProtocols,
			resolveYouTubeVideo,
			onWikilinkClick: t6,
			onLinkClick: t7,
			onImageClick: t8,
			onFileClick: t9,
			onTaskClick: t10
		};
		$[0] = expandCollapsed;
		$[1] = interactive;
		$[2] = mediaUrlProtocols;
		$[3] = resolveFileInfo;
		$[4] = resolveFileLink;
		$[5] = resolveImageUrl;
		$[6] = resolveWikiEmbed;
		$[7] = resolveWikilink;
		$[8] = resolveXPost;
		$[9] = resolveYouTubeVideo;
		$[10] = singleParagraph;
		$[11] = t10;
		$[12] = t6;
		$[13] = t7;
		$[14] = t8;
		$[15] = t9;
		$[16] = t11;
	} else t11 = $[16];
	const context = t11;
	let t12;
	let t13;
	let t14;
	if ($[17] !== frontmatter || $[18] !== markdown || $[19] !== singleParagraph || $[20] !== suppliedDefinitions) {
		const doc = singleParagraph ? paragraphMarkdownToDoc(markdown) : markdownToDoc(markdown, { frontmatter });
		const localDefinitions = singleParagraph ? /* @__PURE__ */ new Map() : collectReferenceDefinitions(doc).definitions;
		const referenceDefinitions = suppliedDefinitions ? new Map([...suppliedDefinitions, ...localDefinitions]) : localDefinitions;
		t12 = splitBlocks(doc);
		t13 = referenceDefinitions;
		t14 = definitionsSignature(referenceDefinitions);
		$[17] = frontmatter;
		$[18] = markdown;
		$[19] = singleParagraph;
		$[20] = suppliedDefinitions;
		$[21] = t12;
		$[22] = t13;
		$[23] = t14;
	} else {
		t12 = $[21];
		t13 = $[22];
		t14 = $[23];
	}
	let t15;
	if ($[24] !== t12 || $[25] !== t13 || $[26] !== t14) {
		t15 = {
			blocks: t12,
			referenceDefinitions: t13,
			definitionsKey: t14
		};
		$[24] = t12;
		$[25] = t13;
		$[26] = t14;
		$[27] = t15;
	} else t15 = $[27];
	const { blocks, referenceDefinitions: referenceDefinitions_0, definitionsKey } = t15;
	const handleXPostMediaClick = interactive ? onXPostMediaClick : void 0;
	const handleYouTubeVideoClick = interactive ? onYouTubeVideoClick : void 0;
	let t16;
	if ($[28] !== handleXPostMediaClick || $[29] !== handleYouTubeVideoClick) {
		t16 = (root) => {
			if (handleXPostMediaClick) root.addEventListener(X_POST_MEDIA_CLICK, handleXPostMediaClick);
			if (handleYouTubeVideoClick) root.addEventListener(YOUTUBE_VIDEO_CLICK, handleYouTubeVideoClick);
			return () => {
				if (handleXPostMediaClick) root.removeEventListener(X_POST_MEDIA_CLICK, handleXPostMediaClick);
				if (handleYouTubeVideoClick) root.removeEventListener(YOUTUBE_VIDEO_CLICK, handleYouTubeVideoClick);
			};
		};
		$[28] = handleXPostMediaClick;
		$[29] = handleYouTubeVideoClick;
		$[30] = t16;
	} else t16 = $[30];
	const rootRef = t16;
	let t17;
	if ($[31] !== className) {
		t17 = clsx("ProseMirror", "meowdown-content", className);
		$[31] = className;
		$[32] = t17;
	} else t17 = $[32];
	let t18;
	if ($[33] !== blocks || $[34] !== context || $[35] !== definitionsKey || $[36] !== referenceDefinitions_0) {
		let t19;
		if ($[38] !== context || $[39] !== definitionsKey || $[40] !== referenceDefinitions_0) {
			t19 = (t20, index) => {
				const { node, taskBase } = t20;
				return /* @__PURE__ */ jsx(MarkdownBlock, {
					node,
					taskBase,
					context,
					referenceDefinitions: referenceDefinitions_0,
					definitionsKey
				}, index);
			};
			$[38] = context;
			$[39] = definitionsKey;
			$[40] = referenceDefinitions_0;
			$[41] = t19;
		} else t19 = $[41];
		t18 = blocks.map(t19);
		$[33] = blocks;
		$[34] = context;
		$[35] = definitionsKey;
		$[36] = referenceDefinitions_0;
		$[37] = t18;
	} else t18 = $[37];
	let t19;
	if ($[42] !== markMode || $[43] !== rootRef || $[44] !== t17 || $[45] !== t18) {
		t19 = /* @__PURE__ */ jsx("div", {
			ref: rootRef,
			className: t17,
			"data-mark-mode": markMode,
			children: t18
		});
		$[42] = markMode;
		$[43] = rootRef;
		$[44] = t17;
		$[45] = t18;
		$[46] = t19;
	} else t19 = $[46];
	return t19;
}

// src/hooks/use-lightbox.ts
/**
* The `view-transition-name` shared by the opened thumbnail and the lightbox
* content, so the browser zooms between them.
*/
const LIGHTBOX_TRANSITION_NAME = "meowdown-lightbox-media";
function setTransitionName(element, name) {
	if (element) element.style.viewTransitionName = name;
}
/**
* Owns which item a {@link LightboxRoot} shows. Opening and closing run as
* React transitions, so the `<ViewTransition>` inside the root animates them.
*
* The thumbnail is not rendered by this hook's component (it may not be
* rendered by React at all), so its half of the shared transition is set by
* hand: it carries the name while the browser captures the page without the
* lightbox, and loses it while the lightbox is mounted.
*/
function useLightbox() {
	const $ = c(8);
	const [item, setItem] = useState(null);
	const sourceRef = useRef(null);
	const instantRef = useRef(false);
	let t0;
	if ($[0] === Symbol.for("react.memo_cache_sentinel")) {
		t0 = (nextItem, element) => {
			setTransitionName(sourceRef.current, "");
			sourceRef.current = element ?? null;
			setTransitionName(sourceRef.current, LIGHTBOX_TRANSITION_NAME);
			startTransition(() => setItem(nextItem));
		};
		$[0] = t0;
	} else t0 = $[0];
	const open = t0;
	let t1;
	if ($[1] === Symbol.for("react.memo_cache_sentinel")) {
		t1 = (options) => {
			instantRef.current = options?.instant === true;
			if (instantRef.current) setItem(null);
			else startTransition(() => setItem(null));
		};
		$[1] = t1;
	} else t1 = $[1];
	const close = t1;
	const isOpen = item != null;
	let t2;
	let t3;
	if ($[2] !== isOpen) {
		t2 = () => {
			if (!isOpen) return;
			setTransitionName(sourceRef.current, "");
			return () => {
				const source = sourceRef.current;
				if (!instantRef.current && source?.isConnected) setTransitionName(source, LIGHTBOX_TRANSITION_NAME);
				else sourceRef.current = null;
			};
		};
		t3 = [isOpen];
		$[2] = isOpen;
		$[3] = t2;
		$[4] = t3;
	} else {
		t2 = $[3];
		t3 = $[4];
	}
	useLayoutEffect(t2, t3);
	let t4;
	if ($[5] === Symbol.for("react.memo_cache_sentinel")) {
		t4 = () => {
			setTransitionName(sourceRef.current, "");
			sourceRef.current = null;
		};
		$[5] = t4;
	} else t4 = $[5];
	const onExited = t4;
	let t5;
	if ($[6] !== item) {
		t5 = {
			item,
			open,
			close,
			onExited
		};
		$[6] = item;
		$[7] = t5;
	} else t5 = $[7];
	return t5;
}

// src/components/lightbox.module.css
var lightbox_module_default = {
	"Dialog": "meow_Dialog_U_12Ra",
	"Frame": "meow_Frame_U_12Ra",
	"Image": "meow_Image_U_12Ra",
	"Video": "meow_Video_U_12Ra"
};

// src/components/lightbox-frame.tsx
/**
* The embedded page of a lightbox, such as a video player: the largest box of
* the item's aspect ratio that fits.
*/
function LightboxFrame(t0) {
	const $ = c(19);
	let className;
	let item;
	let props;
	let style;
	if ($[0] !== t0) {
		({item, className, style, ...props} = t0);
		$[0] = t0;
		$[1] = className;
		$[2] = item;
		$[3] = props;
		$[4] = style;
	} else {
		className = $[1];
		item = $[2];
		props = $[3];
		style = $[4];
	}
	const ratio = item.width && item.height ? item.width / item.height : 1.7777777777777777;
	const t1 = String(ratio);
	let t2;
	if ($[5] !== item.poster) {
		t2 = item.poster ? `url(${JSON.stringify(item.poster)})` : void 0;
		$[5] = item.poster;
		$[6] = t2;
	} else t2 = $[6];
	let t3;
	if ($[7] !== style || $[8] !== t1 || $[9] !== t2) {
		t3 = {
			...style,
			"--meowdown-lightbox-frame-ratio": t1,
			backgroundImage: t2,
			viewTransitionName: LIGHTBOX_TRANSITION_NAME
		};
		$[7] = style;
		$[8] = t1;
		$[9] = t2;
		$[10] = t3;
	} else t3 = $[10];
	const frameStyle = t3;
	const t4 = item.src;
	const t5 = item.title;
	let t6;
	if ($[11] !== className) {
		t6 = clsx(lightbox_module_default.Frame, className);
		$[11] = className;
		$[12] = t6;
	} else t6 = $[12];
	let t7;
	if ($[13] !== frameStyle || $[14] !== item.src || $[15] !== item.title || $[16] !== props || $[17] !== t6) {
		t7 = /* @__PURE__ */ jsx("iframe", {
			allow: "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen",
			allowFullScreen: true,
			referrerPolicy: "strict-origin-when-cross-origin",
			...props,
			src: t4,
			title: t5,
			className: t6,
			style: frameStyle
		});
		$[13] = frameStyle;
		$[14] = item.src;
		$[15] = item.title;
		$[16] = props;
		$[17] = t6;
		$[18] = t7;
	} else t7 = $[18];
	return t7;
}

// src/components/lightbox-image.tsx
/**
* The image of a lightbox. It is the element the opened thumbnail zooms into.
*/
function LightboxImage(t0) {
	const $ = c(15);
	let className;
	let item;
	let props;
	let style;
	if ($[0] !== t0) {
		({item, className, style, ...props} = t0);
		$[0] = t0;
		$[1] = className;
		$[2] = item;
		$[3] = props;
		$[4] = style;
	} else {
		className = $[1];
		item = $[2];
		props = $[3];
		style = $[4];
	}
	const t1 = item.src;
	const t2 = item.alt ?? "";
	let t3;
	if ($[5] !== className) {
		t3 = clsx(lightbox_module_default.Image, className);
		$[5] = className;
		$[6] = t3;
	} else t3 = $[6];
	let t4;
	if ($[7] !== style) {
		t4 = {
			...style,
			viewTransitionName: LIGHTBOX_TRANSITION_NAME
		};
		$[7] = style;
		$[8] = t4;
	} else t4 = $[8];
	let t5;
	if ($[9] !== item.src || $[10] !== props || $[11] !== t2 || $[12] !== t3 || $[13] !== t4) {
		t5 = /* @__PURE__ */ jsx("img", {
			draggable: false,
			...props,
			src: t1,
			alt: t2,
			className: t3,
			style: t4
		});
		$[9] = item.src;
		$[10] = props;
		$[11] = t2;
		$[12] = t3;
		$[13] = t4;
		$[14] = t5;
	} else t5 = $[14];
	return t5;
}

// src/components/lightbox-root.tsx
const DIALOG_TRANSITION_CLASS = "meowdown-lightbox-dialog";
function showModal(dialog) {
	const active = document.activeElement;
	if (active instanceof HTMLElement && active.isContentEditable) active.blur();
	dialog.showModal();
	return () => dialog.close();
}
/**
* The full-window modal shell of a lightbox. It renders nothing while no item
* is open, and `Escape` closes it.
*/
function LightboxRoot(t0) {
	const $ = c(25);
	let children;
	let className;
	let lightbox;
	let props;
	if ($[0] !== t0) {
		({lightbox, children, className, ...props} = t0);
		$[0] = t0;
		$[1] = children;
		$[2] = className;
		$[3] = lightbox;
		$[4] = props;
	} else {
		children = $[1];
		className = $[2];
		lightbox = $[3];
		props = $[4];
	}
	const { item, close, onExited } = lightbox;
	if (!item) return null;
	let t1;
	if ($[5] !== onExited) {
		t1 = () => onExited;
		$[5] = onExited;
		$[6] = t1;
	} else t1 = $[6];
	const t2 = item.type === "image" ? "Image preview" : "Video preview";
	let t3;
	if ($[7] !== className) {
		t3 = clsx(lightbox_module_default.Dialog, className);
		$[7] = className;
		$[8] = t3;
	} else t3 = $[8];
	let t4;
	let t5;
	if ($[9] !== close) {
		t4 = (event) => {
			event.preventDefault();
			close();
		};
		t5 = (event_0) => {
			if (!event_0.currentTarget.open) close({ instant: true });
		};
		$[9] = close;
		$[10] = t4;
		$[11] = t5;
	} else {
		t4 = $[10];
		t5 = $[11];
	}
	let t6;
	if ($[12] !== children || $[13] !== item) {
		t6 = children(item);
		$[12] = children;
		$[13] = item;
		$[14] = t6;
	} else t6 = $[14];
	let t7;
	if ($[15] !== props || $[16] !== t2 || $[17] !== t3 || $[18] !== t4 || $[19] !== t5 || $[20] !== t6) {
		t7 = /* @__PURE__ */ jsx("dialog", {
			"aria-label": t2,
			...props,
			ref: showModal,
			className: t3,
			onCancel: t4,
			onClose: t5,
			children: t6
		});
		$[15] = props;
		$[16] = t2;
		$[17] = t3;
		$[18] = t4;
		$[19] = t5;
		$[20] = t6;
		$[21] = t7;
	} else t7 = $[21];
	let t8;
	if ($[22] !== t1 || $[23] !== t7) {
		t8 = /* @__PURE__ */ jsx(ViewTransition, {
			default: DIALOG_TRANSITION_CLASS,
			onExit: t1,
			children: t7
		});
		$[22] = t1;
		$[23] = t7;
		$[24] = t8;
	} else t8 = $[24];
	return t8;
}

// src/components/lightbox-video.tsx
/**
* The video of a lightbox. It starts playing as soon as it opens: the click
* that opened the lightbox is the user gesture that allows sound.
*/
function LightboxVideo(t0) {
	const $ = c(22);
	let className;
	let item;
	let props;
	let style;
	if ($[0] !== t0) {
		({item, className, style, ...props} = t0);
		$[0] = t0;
		$[1] = className;
		$[2] = item;
		$[3] = props;
		$[4] = style;
	} else {
		className = $[1];
		item = $[2];
		props = $[3];
		style = $[4];
	}
	const gif = item.gif === true;
	const t1 = !gif;
	const t2 = item.alt;
	const t3 = item.poster;
	const t4 = item.width;
	const t5 = item.height;
	let t6;
	if ($[5] !== className) {
		t6 = clsx(lightbox_module_default.Video, className);
		$[5] = className;
		$[6] = t6;
	} else t6 = $[6];
	let t7;
	if ($[7] !== style) {
		t7 = {
			...style,
			viewTransitionName: LIGHTBOX_TRANSITION_NAME
		};
		$[7] = style;
		$[8] = t7;
	} else t7 = $[8];
	let t8;
	if ($[9] !== item.sources) {
		t8 = item.sources.map(_temp);
		$[9] = item.sources;
		$[10] = t8;
	} else t8 = $[10];
	let t9;
	if ($[11] !== gif || $[12] !== item.alt || $[13] !== item.height || $[14] !== item.poster || $[15] !== item.width || $[16] !== props || $[17] !== t1 || $[18] !== t6 || $[19] !== t7 || $[20] !== t8) {
		t9 = /* @__PURE__ */ jsx("video", {
			controls: t1,
			loop: gif,
			muted: gif,
			autoPlay: true,
			playsInline: true,
			"aria-label": t2,
			...props,
			poster: t3,
			width: t4,
			height: t5,
			className: t6,
			style: t7,
			children: t8
		});
		$[11] = gif;
		$[12] = item.alt;
		$[13] = item.height;
		$[14] = item.poster;
		$[15] = item.width;
		$[16] = props;
		$[17] = t1;
		$[18] = t6;
		$[19] = t7;
		$[20] = t8;
		$[21] = t9;
	} else t9 = $[21];
	return t9;
}
function _temp(source) {
	return /* @__PURE__ */ jsx("source", {
		src: source.src,
		type: source.type
	}, source.src);
}

// src/components/wikilink-hover-card.module.css
var wikilink_hover_card_module_default = {
	"Popup": "meow_Popup_bcjyia",
	"Positioner": "meow_Positioner_bcjyia",
	"Viewport": "meow_Viewport_bcjyia"
};

// src/components/wikilink-hover-card.tsx
/**
* Show host-rendered content for the wiki link the pointer rests on. The
* open and close delays live in the core hover handler.
*/
function WikilinkHoverCard(t0) {
	const $ = c(18);
	const { children, className } = t0;
	const [hit, setHit] = useState();
	const lastRectRef = useRef(null);
	const [displayed, setDisplayed] = useState();
	const [open, setOpen] = useState(false);
	const [body, setBody] = useState(null);
	let t1;
	if ($[0] === Symbol.for("react.memo_cache_sentinel")) {
		t1 = () => defineWikilinkHoverHandler((nextHit) => {
			setHit(nextHit);
			setOpen(nextHit != null);
			if (nextHit) setDisplayed(nextHit);
		});
		$[0] = t1;
	} else t1 = $[0];
	const [hoverExtension] = useState(t1);
	useExtension$1(hoverExtension);
	let t2;
	if ($[1] !== hit?.element) {
		t2 = () => {
			const rect = hit?.element?.getBoundingClientRect();
			if (rect && rect.width > 0 && rect.height > 0) lastRectRef.current = rect;
			return lastRectRef.current || new DOMRect(0, 0, 0, 0);
		};
		$[1] = hit?.element;
		$[2] = t2;
	} else t2 = $[2];
	const getRect = t2;
	let t3;
	if ($[3] !== getRect) {
		t3 = { getBoundingClientRect: getRect };
		$[3] = getRect;
		$[4] = t3;
	} else t3 = $[4];
	const anchor = t3;
	let t4;
	let t5;
	if ($[5] !== children || $[6] !== displayed) {
		t4 = () => {
			let stale = false;
			const resolveBody = async () => {
				try {
					const resolved = await resolveHoverBody(children, displayed);
					if (!stale) setBody(resolved);
				} catch (t6) {
					const error = t6;
					if (stale) return;
					console.error("[meowdown] wikilink hover card body rejected:", error);
					setBody(null);
				}
			};
			resolveBody();
			return () => {
				stale = true;
			};
		};
		t5 = [children, displayed];
		$[5] = children;
		$[6] = displayed;
		$[7] = t4;
		$[8] = t5;
	} else {
		t4 = $[7];
		t5 = $[8];
	}
	useEffect(t4, t5);
	const t6 = open && body != null;
	let t7;
	let t8;
	if ($[9] === Symbol.for("react.memo_cache_sentinel")) {
		t7 = (nextOpen) => {
			if (!nextOpen) setOpen(false);
		};
		t8 = (nextOpen_0) => {
			if (!nextOpen_0) setDisplayed(void 0);
		};
		$[9] = t7;
		$[10] = t8;
	} else {
		t7 = $[9];
		t8 = $[10];
	}
	let t9;
	if ($[11] !== anchor || $[12] !== body || $[13] !== className) {
		t9 = body != null && /* @__PURE__ */ jsx(PreviewCard.Portal, { children: /* @__PURE__ */ jsx(PreviewCard.Positioner, {
			anchor,
			side: "bottom",
			sideOffset: 8,
			collisionPadding: 8,
			className: wikilink_hover_card_module_default.Positioner,
			"data-testid": "wikilink-hover-positioner",
			children: /* @__PURE__ */ jsx(PreviewCard.Popup, {
				inert: true,
				className: clsx(wikilink_hover_card_module_default.Popup, className),
				"data-testid": "wikilink-hover-card",
				children: /* @__PURE__ */ jsx(PreviewCard.Viewport, {
					className: wikilink_hover_card_module_default.Viewport,
					children: body
				})
			})
		}) });
		$[11] = anchor;
		$[12] = body;
		$[13] = className;
		$[14] = t9;
	} else t9 = $[14];
	let t10;
	if ($[15] !== t6 || $[16] !== t9) {
		t10 = /* @__PURE__ */ jsx(PreviewCard.Root, {
			open: t6,
			onOpenChange: t7,
			onOpenChangeComplete: t8,
			children: t9
		});
		$[15] = t6;
		$[16] = t9;
		$[17] = t10;
	} else t10 = $[17];
	return t10;
}
async function resolveHoverBody(children, hit) {
	return hit ? await children(hit) : null;
}

export { LightboxFrame, LightboxImage, LightboxRoot, LightboxVideo, MarkdownEditor, MarkdownView, WikilinkHoverCard, useEditor, useExtension, useKeymap, useLightbox };