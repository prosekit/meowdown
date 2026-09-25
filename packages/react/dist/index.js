import { clsx } from "clsx/lite";
import { Fragment, ViewTransition, cloneElement, createElement, memo, startTransition, useCallback, useDeferredValue, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useReducer, useRef, useState } from "react";
import { buildFileMarkdown, codeBlockLanguages, collectReferenceDefinitions, defaultResolveImageUrl, defaultResolveXPost, defaultResolveYouTubeVideo, defineCodeBlockPreviewPlugin, defineEditorExtension, defineLinkEditKeymap, defineLinkHoverHandler, definePendingReplacementHandler, defineSearchStatusHandler, defineVirtualCaret, defineWikilinkHoverHandler, dismissLinkHover, docToMarkdown, formatFileSize, getCodeTokens, getFileKind, getLinkText, getMarkBuilders, getPendingReplacement, getSearchStatus, getSelectedText, getTableColumnAlign, getTextblockDisplayText, getVirtualElementFromRange, inlineTextToMarkChunksWithContext, isCodeBlockPreviewHiddenDecoration, isLinkTextForHref, isModEvent, isNodeOfType, isReferenceDefinitionNode, isSelectionInTableCell, loadKaTeX, markdownToDoc, normalizeHref, parsePostEmbedSnapshot, renderMathInto, updateEditorConfig } from "@meowdown/core";
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
import { AutocompleteEmpty, AutocompleteItem, AutocompletePopup, AutocompletePositioner, AutocompleteRoot } from "@prosekit/react/autocomplete";
import { MenuItem, MenuPopup, MenuPositioner } from "@prosekit/react/menu";
import { TableHandleColumnMenuRoot, TableHandleColumnMenuTrigger, TableHandleColumnPopup, TableHandleColumnPositioner, TableHandleDragPreview, TableHandleDropIndicator, TableHandleRoot, TableHandleRowMenuRoot, TableHandleRowMenuTrigger, TableHandleRowPopup, TableHandleRowPositioner } from "@prosekit/react/table-handle";
import { X_POST_MEDIA_CLICK, registerXPost } from "@meowdown/embed/x";
import { YOUTUBE_VIDEO_CLICK, registerYouTubeVideo } from "@meowdown/embed/youtube";
import { matchEmbed } from "@meowdown/markdown";
import { Mark } from "@prosekit/pm/model";
import { BOOLEAN, OVERLOADED_BOOLEAN, getPropertyInfo, possibleStandardNames } from "react-property";
import { PreviewCard } from "@base-ui/react/preview-card";

//#region src/hooks/use-beautiful-mermaid.ts
let beautifulMermaidPromise;
function loadBeautifulMermaid() {
	beautifulMermaidPromise ??= import("./beautiful-mermaid-chunk-Cc6FHgAa.js").then((module) => module.renderMermaidSVG).catch((error) => {
		console.error("[meowdown] Failed to load beautiful-mermaid.", error);
		throw error;
	});
	return beautifulMermaidPromise;
}
function useBeautifulMermaid(enabled) {
	const [renderer, setRenderer] = useState(void 0);
	useEffect(() => {
		if (!enabled || renderer) return;
		let cancelled = false;
		loadBeautifulMermaid().then((loadedRenderer) => {
			if (!cancelled) setRenderer(() => loadedRenderer);
		});
		return () => {
			cancelled = true;
		};
	}, [enabled, renderer]);
	return renderer;
}

//#endregion
//#region src/hooks/use-katex.ts
/**
* The lazily loaded KaTeX render function, or `undefined` while it loads (or when
* `enabled` is false, so a document without math never loads it).
*/
function useKaTeX(enabled) {
	const [katex, setKaTeX] = useState(void 0);
	useEffect(() => {
		if (!enabled || katex) return;
		let cancelled = false;
		loadKaTeX().then((render) => {
			if (!cancelled) setKaTeX(() => render);
		});
		return () => {
			cancelled = true;
		};
	}, [enabled, katex]);
	return katex;
}

//#endregion
//#region src/utils/non-prose-props.ts
const NON_PROSE_PROPS = {
	spellCheck: false,
	autoCorrect: "off",
	autoCapitalize: "off",
	writingsuggestions: "false"
};

//#endregion
//#region src/components/code-block-view.module.css
var code_block_view_module_default = {
	"CopyButton": "meow_CopyButton_IVpCJa",
	"Empty": "meow_Empty_IVpCJa",
	"Item": "meow_Item_IVpCJa",
	"ItemIndicator": "meow_ItemIndicator_IVpCJa",
	"ItemText": "meow_ItemText_IVpCJa",
	"List": "meow_List_IVpCJa",
	"MermaidPreview": "meow_MermaidPreview_IVpCJa",
	"Popup": "meow_Popup_IVpCJa",
	"Positioner": "meow_Positioner_IVpCJa",
	"Preview": "meow_Preview_IVpCJa",
	"Root": "meow_Root_IVpCJa",
	"Search": "meow_Search_IVpCJa",
	"SearchRow": "meow_SearchRow_IVpCJa",
	"Toolbar": "meow_Toolbar_IVpCJa",
	"Trigger": "meow_Trigger_IVpCJa",
	"TriggerIcon": "meow_TriggerIcon_IVpCJa"
};

//#endregion
//#region src/components/copy-button.tsx
const COPIED_RESET_MS = 1500;
/**
* A copy-to-clipboard button with "copied" feedback. Shared by the code block
* toolbar and the link popover.
*/
function CopyButton({ getText, label, onCopy, className, ...rest }) {
	const [copied, setCopied] = useState(false);
	const resetTimerRef = useRef(void 0);
	const copy = async () => {
		try {
			await navigator.clipboard.writeText(getText());
			setCopied(true);
			clearTimeout(resetTimerRef.current);
			resetTimerRef.current = setTimeout(() => setCopied(false), COPIED_RESET_MS);
			onCopy?.();
		} catch (error) {
			console.warn("[meowdown] Failed to copy:", error);
		}
	};
	return /* @__PURE__ */ jsx("button", {
		type: "button",
		className,
		"data-copied": copied ? "" : void 0,
		"aria-label": copied ? "Copied" : label,
		title: copied ? "Copied" : label,
		onMouseDown: (event) => event.preventDefault(),
		onClick: copy,
		...rest,
		children: copied ? /* @__PURE__ */ jsx(CheckIcon, {}) : /* @__PURE__ */ jsx(CopyIcon, {})
	});
}

//#endregion
//#region src/components/math-render.tsx
/**
* KaTeX output rendered into a real element, the same way the editor's
* `MathMarkView` does. A span host matches KaTeX's own output shape; display
* mode emits a block-level `math[display="block"]` element.
*/
function MathRender(props) {
	const { katex, formula, displayMode, className, onMouseDown } = props;
	const ref = useRef(null);
	useLayoutEffect(() => {
		const element = ref.current;
		if (!element) return;
		renderMathInto(katex, element, formula, displayMode);
	}, [
		katex,
		formula,
		displayMode
	]);
	return /* @__PURE__ */ jsx("span", {
		ref,
		className,
		contentEditable: false,
		"data-testid": props["data-testid"],
		onMouseDown
	});
}

//#endregion
//#region src/components/mermaid-render.tsx
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
	const { renderer, source, className, onMouseDown } = props;
	const output = useMemo(() => renderMermaid(renderer, source), [renderer, source]);
	const ref = useRef(null);
	useLayoutEffect(() => {
		const host = ref.current;
		if (!host || !output.element) return;
		host.replaceChildren(window.document.importNode(output.element, true));
	}, [output]);
	if (output.error) return /* @__PURE__ */ jsx("span", {
		className,
		contentEditable: false,
		"data-error": true,
		"data-testid": props["data-testid"],
		onMouseDown,
		children: output.error
	}, "error");
	return /* @__PURE__ */ jsx("span", {
		ref,
		className,
		contentEditable: false,
		"data-testid": props["data-testid"],
		onMouseDown
	}, "svg");
}

//#endregion
//#region src/components/code-block-view.tsx
function CodeBlockView(props) {
	const { node, view, getPos, decorations, selected, setAttrs, contentRef } = props;
	const language = node.attrs.language || "";
	const isMath = language === "math";
	const isMermaid = language === "mermaid";
	const code = node.textContent;
	const caretInside = decorations.some(isCodeBlockPreviewHiddenDecoration);
	const katex = useKaTeX(isMath);
	const mermaid = useBeautifulMermaid(isMermaid);
	const showMathPreview = isMath && katex != null;
	const showMermaidPreview = isMermaid && mermaid != null;
	const showPreview = showMathPreview || showMermaidPreview;
	const previewCode = useDeferredValue(showPreview ? code : "");
	const previewOnly = showPreview && !caretInside && code.trim() !== "";
	const focusSource = useCallback((event) => {
		event.preventDefault();
		const pos = getPos();
		if (pos == null) return;
		const selection = TextSelection.near(view.state.doc.resolve(pos + 1), 1);
		view.dispatch(view.state.tr.setSelection(selection));
		view.focus();
	}, [view, getPos]);
	const setLanguage = useCallback((language) => {
		setAttrs({ language });
	}, [setAttrs]);
	return /* @__PURE__ */ jsxs("div", {
		className: code_block_view_module_default.Root,
		"data-preview": previewOnly || void 0,
		children: [
			/* @__PURE__ */ jsx("pre", {
				ref: contentRef,
				"data-language": language,
				...NON_PROSE_PROPS
			}),
			selected ? null : /* @__PURE__ */ jsx(CodeBlockToolbar, {
				code,
				language,
				setLanguage
			}),
			showMathPreview && /* @__PURE__ */ jsx(MathRender, {
				katex,
				formula: previewCode,
				displayMode: true,
				className: code_block_view_module_default.Preview,
				"data-testid": "code-block-math-preview",
				onMouseDown: focusSource
			}),
			showMermaidPreview && /* @__PURE__ */ jsx(MermaidRender, {
				renderer: mermaid,
				source: previewCode,
				className: `${code_block_view_module_default.Preview} ${code_block_view_module_default.MermaidPreview}`,
				"data-testid": "code-block-mermaid-preview",
				onMouseDown: focusSource
			})
		]
	});
}
function CodeBlockToolbar({ code, language, setLanguage }) {
	const selected = useMemo(() => {
		return codeBlockLanguages.find((item) => item.value === language) ?? {
			value: language,
			label: language
		};
	}, [language]);
	const [query, setQuery] = useState("");
	const [comboboxOpen, setComboboxOpen] = useState(false);
	const itemsForView = useMemo(() => {
		const value = query.trim();
		if (!value) return codeBlockLanguages;
		const lowercased = value.toLowerCase();
		return codeBlockLanguages.some((item) => item.value.toLowerCase() === lowercased || item.label.toLowerCase() === lowercased) ? codeBlockLanguages : [...codeBlockLanguages, {
			value,
			label: `Use "${value}"`
		}];
	}, [query]);
	return /* @__PURE__ */ jsxs("div", {
		className: code_block_view_module_default.Toolbar,
		contentEditable: false,
		"data-open": comboboxOpen || void 0,
		children: [/* @__PURE__ */ jsxs(Combobox.Root, {
			items: itemsForView,
			value: selected,
			onValueChange: (item) => setLanguage(item?.value ?? ""),
			inputValue: query,
			onInputValueChange: setQuery,
			onOpenChange: (open) => {
				if (open) setComboboxOpen(true);
				else setQuery("");
			},
			onOpenChangeComplete: (open) => {
				if (!open) setComboboxOpen(false);
			},
			children: [/* @__PURE__ */ jsxs(Combobox.Trigger, {
				className: code_block_view_module_default.Trigger,
				"data-testid": "code-block-language",
				children: [/* @__PURE__ */ jsx(Combobox.Value, { placeholder: "Plain Text" }), /* @__PURE__ */ jsx(Combobox.Icon, {
					className: code_block_view_module_default.TriggerIcon,
					children: /* @__PURE__ */ jsx(ChevronsUpDownIcon, {})
				})]
			}), /* @__PURE__ */ jsx(Combobox.Portal, { children: /* @__PURE__ */ jsx(Combobox.Positioner, {
				className: code_block_view_module_default.Positioner,
				sideOffset: 4,
				children: /* @__PURE__ */ jsxs(Combobox.Popup, {
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
							children: (item) => /* @__PURE__ */ jsxs(Combobox.Item, {
								value: item,
								className: code_block_view_module_default.Item,
								children: [/* @__PURE__ */ jsx(Combobox.ItemIndicator, {
									className: code_block_view_module_default.ItemIndicator,
									children: /* @__PURE__ */ jsx(CheckIcon, {})
								}), /* @__PURE__ */ jsx("span", {
									className: code_block_view_module_default.ItemText,
									children: item.label
								})]
							}, item.label)
						})
					]
				})
			}) })]
		}), /* @__PURE__ */ jsx(CopyButton, {
			getText: () => code,
			label: "Copy code",
			className: code_block_view_module_default.CopyButton,
			"data-testid": "code-block-copy"
		})]
	});
}

//#endregion
//#region src/extensions/code-block-view.ts
function defineCodeBlockView(component = CodeBlockView) {
	return union(defineReactNodeView({
		name: "codeBlock",
		contentAs: "code",
		component
	}), defineCodeBlockPreviewPlugin());
}

//#endregion
//#region src/components/block-handle.module.css
var block_handle_module_default = {
	"Draggable": "meow_Draggable_5NLr4G",
	"Popup": "meow_Popup_5NLr4G",
	"Positioner": "meow_Positioner_5NLr4G"
};

//#endregion
//#region src/components/block-handle.tsx
function BlockHandle() {
	return /* @__PURE__ */ jsx(BlockHandleRoot, { children: /* @__PURE__ */ jsx(BlockHandlePositioner, {
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
}

//#endregion
//#region src/components/drop-indicator.module.css
var drop_indicator_module_default = { "DropIndicator": "meow_DropIndicator_3Hl43W" };

//#endregion
//#region src/components/drop-indicator.tsx
function DropIndicator$1() {
	return /* @__PURE__ */ jsx(DropIndicator, {
		className: drop_indicator_module_default.DropIndicator,
		"data-testid": "drop-indicator"
	});
}

//#endregion
//#region src/components/editor-extensions.tsx
function EditorExtensions({ config, searchQuery, onDocChange, onSearchChange }) {
	const editor = useEditor$1();
	useEffect(() => {
		const timer = setTimeout(() => updateEditorConfig(editor, config));
		return () => clearTimeout(timer);
	}, [editor, config]);
	const deferredSearchQuery = useDeferredValue(searchQuery);
	useEffect(() => {
		editor.commands.setSearchQuery({
			search: deferredSearchQuery,
			literal: true
		});
	}, [editor, deferredSearchQuery]);
	useExtension$1(useMemo(() => onDocChange ? defineDocChangeHandler(onDocChange) : null, [onDocChange]));
	useExtension$1(useMemo(() => onSearchChange ? defineSearchStatusHandler(onSearchChange) : null, [onSearchChange]));
	return null;
}

//#endregion
//#region src/components/link-menu-state.ts
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

//#endregion
//#region src/components/link-menu.module.css
var link_menu_module_default = {
	"Actions": "meow_Actions_1IcuaW",
	"Button": "meow_Button_1IcuaW",
	"Description": "meow_Description_1IcuaW",
	"Field": "meow_Field_1IcuaW",
	"Form": "meow_Form_1IcuaW",
	"FormActions": "meow_FormActions_1IcuaW",
	"Host": "meow_Host_1IcuaW",
	"Icon": "meow_Icon_1IcuaW",
	"Input": "meow_Input_1IcuaW",
	"Popup": "meow_Popup_1IcuaW",
	"Positioner": "meow_Positioner_1IcuaW",
	"Preview": "meow_Preview_1IcuaW",
	"PreviewBody": "meow_PreviewBody_1IcuaW",
	"pulse": "meow_pulse_1IcuaW",
	"RemoveButton": "meow_RemoveButton_1IcuaW",
	"ReplaceButton": "meow_ReplaceButton_1IcuaW",
	"ReplaceRow": "meow_ReplaceRow_1IcuaW",
	"Row": "meow_Row_1IcuaW",
	"SaveButton": "meow_SaveButton_1IcuaW",
	"Skeleton": "meow_Skeleton_1IcuaW",
	"SkeletonLine": "meow_SkeletonLine_1IcuaW",
	"SkeletonLineShort": "meow_SkeletonLineShort_1IcuaW",
	"Title": "meow_Title_1IcuaW",
	"Url": "meow_Url_1IcuaW",
	"UseTitleButton": "meow_UseTitleButton_1IcuaW"
};

//#endregion
//#region src/components/link-menu.tsx
function useLinkPreview(href, resolveLinkPreview) {
	const [settled, setSettled] = useState();
	useEffect(() => {
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
	}, [href, resolveLinkPreview]);
	if (!href || !resolveLinkPreview || !isWebHref(href)) return { status: "idle" };
	return settled?.href === href ? settled.result : { status: "loading" };
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
function LinkPopover({ anchor, open, onClose, onCloseComplete, onPopupHover, children }) {
	return /* @__PURE__ */ jsx(Popover.Root, {
		open,
		onOpenChange: (open) => {
			if (!open) onClose();
		},
		onOpenChangeComplete: (open) => {
			if (!open) onCloseComplete?.();
		},
		children: /* @__PURE__ */ jsx(Popover.Portal, { children: /* @__PURE__ */ jsx(Popover.Positioner, {
			anchor,
			side: "bottom",
			sideOffset: 8,
			className: link_menu_module_default.Positioner,
			children: /* @__PURE__ */ jsx(Popover.Popup, {
				className: link_menu_module_default.Popup,
				"data-testid": "link-popover",
				initialFocus: false,
				finalFocus: false,
				onMouseEnter: () => onPopupHover?.(true),
				onMouseLeave: () => onPopupHover?.(false),
				children
			})
		}) })
	});
}
function LinkAnchor({ href, className, onLinkClick, children }) {
	return /* @__PURE__ */ jsx("a", {
		className,
		href,
		title: href,
		target: "_blank",
		rel: "noopener noreferrer",
		onClick: (event) => {
			if (!onLinkClick) return;
			event.preventDefault();
			onLinkClick({
				href,
				event: event.nativeEvent,
				mod: isModEvent(event)
			});
		},
		children
	});
}
function LinkActions({ href, onLinkCopy, onEdit, onRemove }) {
	return /* @__PURE__ */ jsxs("div", {
		className: link_menu_module_default.Actions,
		children: [
			/* @__PURE__ */ jsx(CopyButton, {
				getText: () => href,
				label: "Copy link",
				className: link_menu_module_default.Button,
				onCopy: () => onLinkCopy?.({ href })
			}),
			onEdit && /* @__PURE__ */ jsx("button", {
				type: "button",
				className: link_menu_module_default.Button,
				title: "Edit link",
				"aria-label": "Edit link",
				onClick: onEdit,
				children: /* @__PURE__ */ jsx(PencilIcon, {})
			}),
			onRemove && /* @__PURE__ */ jsx("button", {
				type: "button",
				className: link_menu_module_default.Button,
				title: "Remove link",
				"aria-label": "Remove link",
				onClick: onRemove,
				children: /* @__PURE__ */ jsx(UnlinkIcon, {})
			})
		]
	});
}
function PreviewIcon({ preview }) {
	const [failed, setFailed] = useState(false);
	if (!preview.iconSrc || failed) return /* @__PURE__ */ jsx(Globe2Icon, { "aria-hidden": "true" });
	return /* @__PURE__ */ jsx("img", {
		src: preview.iconSrc,
		alt: "",
		onError: () => setFailed(true)
	});
}
function getHostname(href) {
	try {
		return new URL(href).hostname;
	} catch {
		return href;
	}
}
function LinkInfoContent({ href, previewState, onLinkClick, onLinkCopy, onEdit, onRemove, onUseTitle }) {
	if (previewState.status === "resolved") {
		const { preview } = previewState;
		return /* @__PURE__ */ jsxs("div", {
			"data-testid": "link-popover-info",
			children: [
				/* @__PURE__ */ jsxs("div", {
					className: link_menu_module_default.Preview,
					children: [
						/* @__PURE__ */ jsx("div", {
							className: link_menu_module_default.Icon,
							children: /* @__PURE__ */ jsx(PreviewIcon, { preview }, preview.iconSrc)
						}),
						/* @__PURE__ */ jsxs("div", {
							className: link_menu_module_default.PreviewBody,
							children: [/* @__PURE__ */ jsx(LinkAnchor, {
								href,
								className: link_menu_module_default.Title,
								onLinkClick,
								children: preview.title
							}), /* @__PURE__ */ jsx("div", {
								className: link_menu_module_default.Host,
								children: getHostname(href)
							})]
						}),
						/* @__PURE__ */ jsx(LinkActions, {
							href,
							onLinkCopy,
							onEdit,
							onRemove
						})
					]
				}),
				preview.description && /* @__PURE__ */ jsx("p", {
					className: link_menu_module_default.Description,
					children: preview.description
				}),
				onUseTitle && /* @__PURE__ */ jsxs("div", {
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
				})
			]
		});
	}
	return /* @__PURE__ */ jsxs("div", {
		"data-testid": "link-popover-info",
		children: [/* @__PURE__ */ jsxs("div", {
			className: link_menu_module_default.Row,
			children: [/* @__PURE__ */ jsx(LinkAnchor, {
				href,
				className: link_menu_module_default.Url,
				onLinkClick,
				children: href
			}), /* @__PURE__ */ jsx(LinkActions, {
				href,
				onLinkCopy,
				onEdit,
				onRemove
			})]
		}), previewState.status === "loading" && /* @__PURE__ */ jsxs("div", {
			className: link_menu_module_default.Skeleton,
			"data-testid": "link-popover-loading",
			role: "status",
			"aria-label": "Loading link preview",
			children: [/* @__PURE__ */ jsx("div", { className: link_menu_module_default.SkeletonLine }), /* @__PURE__ */ jsx("div", { className: link_menu_module_default.SkeletonLineShort })]
		})]
	});
}
function LinkEditContent({ edit, resolveLinkPreview, onSubmit, onRemove }) {
	const [text, setText] = useState(edit.text);
	const [href, setHref] = useState(edit.link?.href ?? "");
	const [debouncedHref, setDebouncedHref] = useState(href.trim());
	const hrefInputRef = useRef(null);
	const previewHref = normalizeHref(debouncedHref);
	const previewState = useLinkPreview(previewHref || void 0, resolveLinkPreview);
	const canUseTitle = !!edit.link && debouncedHref === href.trim() && isLinkTextForHref(text, previewHref);
	const canSave = text.trim() !== "" && href.trim() !== "";
	useEffect(() => {
		const timer = window.setTimeout(() => setDebouncedHref(href.trim()), 400);
		return () => window.clearTimeout(timer);
	}, [href]);
	useEffect(() => {
		hrefInputRef.current?.focus();
		hrefInputRef.current?.select();
	}, []);
	return /* @__PURE__ */ jsxs("form", {
		className: link_menu_module_default.Form,
		"data-testid": "link-popover-edit",
		noValidate: true,
		onSubmit: (event) => {
			event.preventDefault();
			if (canSave) onSubmit(text, href);
		},
		children: [
			/* @__PURE__ */ jsxs("label", {
				className: link_menu_module_default.Field,
				children: [/* @__PURE__ */ jsx("span", { children: "Text" }), /* @__PURE__ */ jsx("input", {
					className: link_menu_module_default.Input,
					value: text,
					"data-testid": "link-popover-text-input",
					onChange: (event) => setText(event.target.value)
				})]
			}),
			/* @__PURE__ */ jsxs("label", {
				className: link_menu_module_default.Field,
				children: [/* @__PURE__ */ jsx("span", { children: "Link" }), /* @__PURE__ */ jsx("input", {
					ref: hrefInputRef,
					className: link_menu_module_default.Input,
					value: href,
					placeholder: "Paste link…",
					"data-testid": "link-popover-input",
					onChange: (event) => setHref(event.target.value)
				})]
			}),
			/* @__PURE__ */ jsxs("div", {
				className: link_menu_module_default.FormActions,
				children: [
					onRemove && /* @__PURE__ */ jsx("button", {
						type: "button",
						className: link_menu_module_default.RemoveButton,
						onClick: onRemove,
						children: "Remove link"
					}),
					canUseTitle && previewState.status === "resolved" && /* @__PURE__ */ jsx("button", {
						type: "button",
						className: link_menu_module_default.UseTitleButton,
						onClick: () => setText(previewState.preview.title),
						children: "Use page title"
					}),
					/* @__PURE__ */ jsx("button", {
						type: "submit",
						className: link_menu_module_default.SaveButton,
						disabled: !canSave,
						"data-testid": "link-popover-submit",
						children: "Save"
					})
				]
			})
		]
	});
}
function LinkMenu({ onLinkClick, onLinkCopy, resolveLinkPreview, readOnly = false }) {
	const editor = useEditor$1();
	const [state, dispatch] = useReducer(reduceLinkMenu, LINK_MENU_IDLE);
	const isPointerOverPopupRef = useRef(false);
	const [linkHoverExtension] = useState(() => {
		return defineLinkHoverHandler((hit) => dispatch({
			type: "hover",
			link: hit?.payload
		}), { canLeave: () => !isPointerOverPopupRef.current });
	});
	useExtension$1(linkHoverExtension);
	const linkEditExtension = useMemo(() => {
		return readOnly ? null : defineLinkEditKeymap((edit) => dispatch({
			type: "edit",
			edit
		}));
	}, [readOnly]);
	useExtension$1(linkEditExtension);
	const handlePointerHover = useCallback((over) => {
		isPointerOverPopupRef.current = over;
	}, []);
	const close = useCallback(() => {
		isPointerOverPopupRef.current = false;
		dismissLinkHover(editor.state);
		dispatch({ type: "close" });
	}, [editor]);
	const view = getLinkMenuView(state);
	const edit = view?.kind === "edit" ? view.edit : void 0;
	const link = view?.kind === "preview" ? view.link : void 0;
	const handleEditRemove = useCallback(() => {
		editor.commands.removeLink();
		close();
	}, [editor, close]);
	const handleEditSubmit = useCallback((text, href) => {
		if (!edit) return;
		if (edit.link) editor.commands.updateLink({
			text: text === edit.text ? void 0 : text,
			href,
			title: edit.link.title
		});
		else editor.commands.insertLink({
			text,
			href
		});
		close();
	}, [
		edit,
		editor,
		close
	]);
	const mutable = link != null && !readOnly && link.form !== "reference";
	const linkText = useMemo(() => link ? getLinkText(link) : "", [link]);
	const editLink = useCallback(() => {
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
	}, [
		link,
		editor,
		linkText
	]);
	const removeLink = useCallback(() => {
		if (!link) return;
		selectLinkUnit(editor, link);
		editor.commands.removeLink();
		close();
	}, [
		link,
		editor,
		close
	]);
	const handleUseTitle = useMemo(() => {
		if (!link || !mutable || !isLinkTextForHref(linkText, link.href)) return;
		return (title) => {
			selectLinkUnit(editor, link);
			editor.commands.updateLink({ text: title });
			close();
		};
	}, [
		link,
		editor,
		close,
		linkText,
		mutable
	]);
	const previewState = useLinkPreview(link?.href, resolveLinkPreview);
	const range = edit ? edit.link?.text ?? edit : link?.text;
	const anchor = useMemo(() => {
		if (!range) return;
		return getVirtualElementFromRange(editor.view, range);
	}, [range, editor]);
	return /* @__PURE__ */ jsx(LinkPopover, {
		anchor,
		open: state.kind === "preview" || state.kind === "edit",
		onClose: close,
		onCloseComplete: () => {
			if (edit) editor.focus();
			dispatch({ type: "closed" });
		},
		onPopupHover: handlePointerHover,
		children: edit ? /* @__PURE__ */ jsx(LinkEditContent, {
			edit,
			resolveLinkPreview,
			onRemove: edit.link ? handleEditRemove : void 0,
			onSubmit: handleEditSubmit
		}, `${edit.from}:${edit.to}`) : link ? /* @__PURE__ */ jsx(LinkInfoContent, {
			href: link.href,
			previewState,
			onLinkClick,
			onLinkCopy,
			onEdit: mutable ? editLink : void 0,
			onRemove: mutable ? removeLink : void 0,
			onUseTitle: handleUseTitle
		}) : void 0
	});
}

//#endregion
//#region src/components/pending-replacement-preview.module.css
var pending_replacement_preview_module_default = {
	"AcceptButton": "meow_AcceptButton_QgaziW",
	"Button": "meow_Button_QgaziW",
	"Footer": "meow_Footer_QgaziW",
	"Popup": "meow_Popup_QgaziW",
	"Positioner": "meow_Positioner_QgaziW",
	"Spacer": "meow_Spacer_QgaziW",
	"Text": "meow_Text_QgaziW",
	"Waiting": "meow_Waiting_QgaziW"
};

//#endregion
//#region src/components/pending-replacement-preview.tsx
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
function PendingReplacementPreview({ actions, onResolve }) {
	const editor = useEditor$1();
	const [pending, setPending] = useState(null);
	useExtension$1(useMemo(() => {
		return definePendingReplacementHandler((event) => {
			if (event.type === "update") setPending(event.pending);
			else {
				setPending(null);
				onResolve?.(event.outcome, event.pending);
			}
		});
	}, [onResolve]));
	const to = pending?.to;
	const anchor = useMemo(() => {
		if (to == null) return;
		return getVirtualElementFromRange(editor.view, {
			from: to,
			to
		});
	}, [to, editor]);
	const staged = pending !== null;
	useEffect(() => {
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
			if (scroller) scroller.scrollTop += nudge;
		}
	}, [staged, editor]);
	if (!pending) return null;
	const discard = () => {
		editor.commands.discardPendingReplacement();
		editor.focus();
	};
	const accept = () => {
		editor.commands.acceptPendingReplacement();
		editor.focus();
	};
	return /* @__PURE__ */ jsx(Popover.Root, {
		open: true,
		onOpenChange: (next) => {
			if (!next) discard();
		},
		children: /* @__PURE__ */ jsx(Popover.Portal, { children: /* @__PURE__ */ jsx(Popover.Positioner, {
			anchor,
			side: "bottom",
			sideOffset: 8,
			className: pending_replacement_preview_module_default.Positioner,
			children: /* @__PURE__ */ jsxs(Popover.Popup, {
				className: pending_replacement_preview_module_default.Popup,
				"data-testid": "pending-replacement",
				initialFocus: false,
				finalFocus: false,
				children: [/* @__PURE__ */ jsx("div", {
					className: pending_replacement_preview_module_default.Text,
					"data-testid": "pending-replacement-text",
					children: pending.text || /* @__PURE__ */ jsx("span", {
						className: pending_replacement_preview_module_default.Waiting,
						children: "Waiting for text..."
					})
				}), /* @__PURE__ */ jsxs("div", {
					className: pending_replacement_preview_module_default.Footer,
					children: [
						actions,
						/* @__PURE__ */ jsx("span", { className: pending_replacement_preview_module_default.Spacer }),
						/* @__PURE__ */ jsx("button", {
							type: "button",
							className: pending_replacement_preview_module_default.Button,
							"data-testid": "pending-replacement-discard",
							onClick: discard,
							children: "Discard"
						}),
						/* @__PURE__ */ jsx("button", {
							type: "button",
							className: pending_replacement_preview_module_default.AcceptButton,
							"data-testid": "pending-replacement-accept",
							disabled: !pending.text.trim(),
							onClick: accept,
							children: pending.mode === "replace" ? "Replace selection" : "Insert below"
						})
					]
				})]
			})
		}) })
	});
}

//#endregion
//#region src/hooks/use-delayed-flag.ts
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
function useDelayedFlag(value, openDelay = OPEN_DELAY, closeDelay = CLOSE_DELAY) {
	const [flag, setFlag] = useState(false);
	const timerRef = useRef(void 0);
	useEffect(() => {
		clearTimeout(timerRef.current);
		timerRef.current = setTimeout(() => setFlag(value), value ? openDelay : closeDelay);
		return () => clearTimeout(timerRef.current);
	}, [
		value,
		openDelay,
		closeDelay
	]);
	return flag;
}

//#endregion
//#region src/components/selection-menu.module.css
var selection_menu_module_default = {
	"AffordanceButton": "meow_AffordanceButton_x_2ThG",
	"AffordancePopup": "meow_AffordancePopup_x_2ThG",
	"AffordancePositioner": "meow_AffordancePositioner_x_2ThG",
	"Detail": "meow_Detail_x_2ThG",
	"Empty": "meow_Empty_x_2ThG",
	"Input": "meow_Input_x_2ThG",
	"Item": "meow_Item_x_2ThG",
	"Label": "meow_Label_x_2ThG",
	"List": "meow_List_x_2ThG",
	"Popup": "meow_Popup_x_2ThG",
	"Positioner": "meow_Positioner_x_2ThG"
};

//#endregion
//#region src/components/selection-menu.tsx
/**
* A command menu over the current selection: a popover with a filter input and
* host-supplied rows, anchored to the selected range. Opened imperatively (via
* `EditorHandle.openSelectionMenu`) or from the selection affordance, a small
* floating button that appears on a non-empty selection.
*/
function SelectionMenu({ onSelectionMenuSearch, context, onOpen, onClose, affordance = true }) {
	const editor = useEditor$1();
	const [selection, setSelection] = useState();
	useExtension$1(useMemo(() => {
		return defineUpdateHandler((view) => {
			const { from, to, empty } = view.state.selection;
			const anchorable = !empty && isTextSelection(view.state.selection) && !getPendingReplacement(view.state) && getSearchStatus(view.state).active === 0;
			setSelection((previous) => {
				if (previous?.from === from && previous?.to === to && previous?.anchorable === anchorable) return previous;
				return {
					from,
					to,
					anchorable
				};
			});
		});
	}, []));
	const close = useCallback(() => {
		onClose();
		editor.focus();
	}, [onClose, editor]);
	const menuAnchor = useMemo(() => {
		if (!context) return;
		return getVirtualElementFromRange(editor.view, {
			from: context.from,
			to: context.to
		});
	}, [context, editor]);
	const showAffordance = affordance && !!!context && !!selection?.anchorable;
	const affordanceVisible = useDelayedFlag(showAffordance, 250, 0);
	const affordanceAnchor = useMemo(() => {
		if (!showAffordance || !selection) return;
		return getVirtualElementFromRange(editor.view, {
			from: selection.to,
			to: selection.to
		});
	}, [
		showAffordance,
		selection,
		editor
	]);
	if (context) return /* @__PURE__ */ jsx(Popover.Root, {
		open: true,
		onOpenChange: (next) => {
			if (!next) close();
		},
		children: /* @__PURE__ */ jsx(Popover.Portal, { children: /* @__PURE__ */ jsx(Popover.Positioner, {
			anchor: menuAnchor,
			side: "bottom",
			sideOffset: 8,
			className: selection_menu_module_default.Positioner,
			children: /* @__PURE__ */ jsx(Popover.Popup, {
				className: selection_menu_module_default.Popup,
				"data-testid": "selection-menu",
				finalFocus: false,
				children: /* @__PURE__ */ jsx(SelectionMenuPopup, {
					onSelectionMenuSearch,
					context,
					onClose: close
				})
			})
		}) })
	});
	if (affordanceVisible && showAffordance) return /* @__PURE__ */ jsx(Popover.Root, {
		open: true,
		onOpenChange: () => {},
		children: /* @__PURE__ */ jsx(Popover.Portal, { children: /* @__PURE__ */ jsx(Popover.Positioner, {
			anchor: affordanceAnchor,
			side: "bottom",
			sideOffset: 4,
			className: selection_menu_module_default.AffordancePositioner,
			children: /* @__PURE__ */ jsx(Popover.Popup, {
				className: selection_menu_module_default.AffordancePopup,
				"data-testid": "selection-menu-affordance",
				initialFocus: false,
				finalFocus: false,
				children: /* @__PURE__ */ jsx("button", {
					type: "button",
					className: selection_menu_module_default.AffordanceButton,
					title: "Selection commands",
					"aria-label": "Selection commands",
					onPointerDown: (event) => event.preventDefault(),
					onClick: onOpen,
					children: /* @__PURE__ */ jsx(SparklesIcon, {})
				})
			})
		}) })
	});
	return null;
}
/**
* The menu content. Mounted only while the menu is open, so its filter state
*  resets naturally on close.
*/
function SelectionMenuPopup({ onSelectionMenuSearch, context, onClose }) {
	const [query, setQuery] = useState("");
	const [items, setItems] = useState([]);
	const [loading, setLoading] = useState(false);
	const [activeIndex, setActiveIndex] = useState(0);
	const fetchItems = useCallback(async (query, signal) => {
		if (signal.aborted) return;
		setLoading(true);
		const result = await onSelectionMenuSearch(query, context);
		if (signal.aborted) return;
		setItems(result);
		setActiveIndex(0);
		setLoading(false);
	}, [onSelectionMenuSearch, context]);
	useEffect(() => {
		const controller = new AbortController();
		queueMicrotask(() => {
			fetchItems(query, controller.signal);
		});
		return () => {
			controller.abort();
		};
	}, [query, fetchItems]);
	const selectItem = useCallback((item) => {
		onClose();
		item.onSelect(context);
	}, [context, onClose]);
	function onInputKeyDown(event) {
		if (event.key === "ArrowDown") {
			event.preventDefault();
			setActiveIndex((index) => Math.min(index + 1, Math.max(items.length - 1, 0)));
		} else if (event.key === "ArrowUp") {
			event.preventDefault();
			setActiveIndex((index) => Math.max(index - 1, 0));
		} else if (event.key === "Enter") {
			event.preventDefault();
			const item = items[activeIndex];
			if (item) selectItem(item);
		}
	}
	return /* @__PURE__ */ jsxs(Fragment$1, { children: [/* @__PURE__ */ jsx("input", {
		autoFocus: true,
		className: selection_menu_module_default.Input,
		value: query,
		placeholder: "Filter commands...",
		"data-testid": "selection-menu-input",
		onChange: (event) => setQuery(event.target.value),
		onKeyDown: onInputKeyDown
	}), /* @__PURE__ */ jsxs("div", {
		role: "listbox",
		className: selection_menu_module_default.List,
		children: [items.map((item, index) => /* @__PURE__ */ jsxs("button", {
			type: "button",
			role: "option",
			"aria-selected": index === activeIndex,
			className: selection_menu_module_default.Item,
			"data-active": index === activeIndex || void 0,
			onPointerEnter: () => setActiveIndex(index),
			onClick: () => selectItem(item),
			children: [/* @__PURE__ */ jsx("span", {
				className: selection_menu_module_default.Label,
				children: item.label
			}), item.detail ? /* @__PURE__ */ jsx("span", {
				className: selection_menu_module_default.Detail,
				children: item.detail
			}) : null]
		}, item.id)), items.length === 0 ? /* @__PURE__ */ jsx("div", {
			className: selection_menu_module_default.Empty,
			children: loading ? "Loading..." : "No commands"
		}) : null]
	})] });
}

//#endregion
//#region src/utils/date-format.ts
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

//#endregion
//#region src/components/autocomplete-menu.module.css
var autocomplete_menu_module_default = {
	"Detail": "meow_Detail_DPx1Ga",
	"Item": "meow_Item_DPx1Ga",
	"Label": "meow_Label_DPx1Ga",
	"Popup": "meow_Popup_DPx1Ga",
	"Positioner": "meow_Positioner_DPx1Ga"
};

//#endregion
//#region src/components/slash-menu.tsx
const regex$2 = new RegExp((canUseRegexLookbehind() ? String.raw`(?<!\S)` : "") + String.raw`\/(?!\/)(\S.*)?$`, "u");
const defaultOnFileSaveError = (error) => {
	console.error("[meowdown] failed to save attached file:", error);
};
function SlashMenuItem({ label, keywords, detail, kbd, onSelect }) {
	return /* @__PURE__ */ jsxs(AutocompleteItem, {
		value: [label, ...keywords ?? []].join(" "),
		className: autocomplete_menu_module_default.Item,
		onSelect,
		children: [
			/* @__PURE__ */ jsx("span", {
				className: detail ? autocomplete_menu_module_default.Label : void 0,
				children: label
			}),
			detail ? /* @__PURE__ */ jsx("span", {
				className: autocomplete_menu_module_default.Detail,
				children: detail
			}) : null,
			kbd && /* @__PURE__ */ jsx("kbd", { children: kbd })
		]
	});
}
function selectionInTableCell(editor) {
	return isSelectionInTableCell(editor.state);
}
function SlashMenu({ timeFormat = "12", onSlashMenuSearch, onFilePaste, onFileSaveError }) {
	const editor = useEditor$1();
	const fileInputRef = useRef(null);
	const inTableCell = useEditorDerivedValue(selectionInTableCell);
	const [open, setOpen] = useState(false);
	const [query, setQuery] = useState("");
	const [hostItems, setHostItems] = useState([]);
	const fetchHostItems = useCallback(async (query, signal) => {
		if (!onSlashMenuSearch || signal.aborted) return;
		const result = await onSlashMenuSearch(query);
		if (signal.aborted) return;
		setHostItems(result);
	}, [onSlashMenuSearch]);
	useEffect(() => {
		if (!open) return;
		const controller = new AbortController();
		queueMicrotask(() => {
			fetchHostItems(query, controller.signal);
		});
		return () => {
			controller.abort();
		};
	}, [
		open,
		query,
		fetchHostItems
	]);
	const openFilePicker = useCallback(() => {
		fileInputRef.current?.click();
	}, []);
	const handleFileInputChange = useCallback(async (event) => {
		const input = event.currentTarget;
		const files = Array.from(input.files ?? []);
		input.value = "";
		if (!onFilePaste || files.length === 0) return;
		const onSaveError = onFileSaveError ?? defaultOnFileSaveError;
		const markdown = [];
		for (const file of files) try {
			const destination = await onFilePaste(file);
			if (destination) markdown.push(buildFileMarkdown(file, destination));
		} catch (error) {
			onSaveError(error, file);
		}
		if (markdown.length === 0) return;
		editor.focus();
		editor.commands.insertText({ text: markdown.join("\n") });
	}, [
		editor,
		onFilePaste,
		onFileSaveError
	]);
	return /* @__PURE__ */ jsxs(AutocompleteRoot, {
		regex: regex$2,
		onOpenChange: (event) => setOpen(event.detail),
		onQueryChange: (event) => setQuery(event.detail),
		children: [onFilePaste ? /* @__PURE__ */ jsx("input", {
			ref: fileInputRef,
			"data-testid": "slash-menu-file-input",
			type: "file",
			multiple: true,
			hidden: true,
			onChange: handleFileInputChange
		}) : null, /* @__PURE__ */ jsx(AutocompletePositioner, {
			className: autocomplete_menu_module_default.Positioner,
			children: /* @__PURE__ */ jsxs(AutocompletePopup, {
				className: autocomplete_menu_module_default.Popup,
				"data-testid": "slash-menu",
				children: [
					!inTableCell && /* @__PURE__ */ jsxs(Fragment$1, { children: [
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
					] }),
					/* @__PURE__ */ jsx(SlashMenuItem, {
						label: "Now",
						onSelect: () => editor.commands.insertText({ text: formatNowTime(timeFormat) })
					}),
					onFilePaste ? /* @__PURE__ */ jsx(SlashMenuItem, {
						label: "Attach file",
						keywords: [
							"attachment",
							"file",
							"upload"
						],
						onSelect: openFilePicker
					}) : null,
					hostItems.map((item) => /* @__PURE__ */ jsx(SlashMenuItem, {
						label: item.label,
						keywords: item.keywords,
						detail: item.detail,
						onSelect: item.onSelect
					}, item.id ?? item.label)),
					/* @__PURE__ */ jsx(AutocompleteEmpty, {
						className: autocomplete_menu_module_default.Item,
						children: "No results"
					})
				]
			})
		})]
	});
}

//#endregion
//#region src/components/table-handle.module.css
var table_handle_module_default = {
	"ColumnPopup": "meow_ColumnPopup_fYKfba",
	"MenuItem": "meow_MenuItem_fYKfba",
	"MenuPopup": "meow_MenuPopup_fYKfba",
	"MenuPositioner": "meow_MenuPositioner_fYKfba",
	"Positioner": "meow_Positioner_fYKfba",
	"RowPopup": "meow_RowPopup_fYKfba",
	"Trigger": "meow_Trigger_fYKfba"
};

//#endregion
//#region src/components/table-handle.tsx
function getTableHandleState(editor) {
	const commands = editor.commands;
	const columnAlign = getTableColumnAlign(editor.state);
	return {
		columnAlign,
		setTableColumnAlign: {
			canExec: commands.setTableColumnAlign.canExec("left"),
			command: (align) => {
				return commands.setTableColumnAlign(columnAlign === align ? null : align);
			}
		},
		addTableColumnBefore: {
			canExec: commands.addTableColumnBefore.canExec(),
			command: () => commands.addTableColumnBefore()
		},
		addTableColumnAfter: {
			canExec: commands.addTableColumnAfter.canExec(),
			command: () => commands.addTableColumnAfter()
		},
		addTableRowAbove: {
			canExec: commands.addTableRowAbove.canExec(),
			command: () => commands.addTableRowAbove()
		},
		addTableRowBelow: {
			canExec: commands.addTableRowBelow.canExec(),
			command: () => commands.addTableRowBelow()
		},
		deleteCellSelection: {
			canExec: commands.deleteCellSelection.canExec(),
			command: () => commands.deleteCellSelection()
		},
		deleteTableColumn: {
			canExec: commands.deleteTableColumn.canExec(),
			command: () => commands.deleteTableColumn()
		},
		deleteTableRow: {
			canExec: commands.deleteTableRow.canExec(),
			command: () => commands.deleteTableRow()
		},
		deleteTable: {
			canExec: commands.deleteTable.canExec(),
			command: () => commands.deleteTable()
		}
	};
}
const COLUMN_ALIGN_LABELS = {
	left: "Align Left",
	center: "Align Center",
	right: "Align Right"
};
function ColumnAlignMenuItem({ align, columnAlign, onSelect }) {
	const active = columnAlign === align;
	return /* @__PURE__ */ jsxs(MenuItem, {
		className: table_handle_module_default.MenuItem,
		"data-testid": `table-align-${align}`,
		"data-active": active ? "" : void 0,
		onSelect,
		children: [/* @__PURE__ */ jsx("span", { children: COLUMN_ALIGN_LABELS[align] }), active && /* @__PURE__ */ jsx(CheckIcon, {})]
	});
}
function TableHandle() {
	const state = useEditorDerivedValue(getTableHandleState);
	return /* @__PURE__ */ jsxs(TableHandleRoot, { children: [
		/* @__PURE__ */ jsx(TableHandleDragPreview, {}),
		/* @__PURE__ */ jsx(TableHandleDropIndicator, {}),
		/* @__PURE__ */ jsx(TableHandleColumnPositioner, {
			className: table_handle_module_default.Positioner,
			children: /* @__PURE__ */ jsx(TableHandleColumnPopup, {
				className: table_handle_module_default.ColumnPopup,
				children: /* @__PURE__ */ jsxs(TableHandleColumnMenuRoot, { children: [/* @__PURE__ */ jsx(TableHandleColumnMenuTrigger, {
					className: table_handle_module_default.Trigger,
					"data-testid": "table-handle-column",
					children: /* @__PURE__ */ jsx(GripHorizontalIcon, {})
				}), /* @__PURE__ */ jsx(MenuPositioner, {
					className: table_handle_module_default.MenuPositioner,
					children: /* @__PURE__ */ jsxs(MenuPopup, {
						className: table_handle_module_default.MenuPopup,
						"data-testid": "table-handle-column-menu",
						children: [
							state.addTableColumnBefore.canExec && /* @__PURE__ */ jsx(MenuItem, {
								className: table_handle_module_default.MenuItem,
								"data-testid": "table-insert-left",
								onSelect: state.addTableColumnBefore.command,
								children: /* @__PURE__ */ jsx("span", { children: "Insert Left" })
							}),
							state.addTableColumnAfter.canExec && /* @__PURE__ */ jsx(MenuItem, {
								className: table_handle_module_default.MenuItem,
								"data-testid": "table-insert-right",
								onSelect: state.addTableColumnAfter.command,
								children: /* @__PURE__ */ jsx("span", { children: "Insert Right" })
							}),
							state.setTableColumnAlign.canExec && /* @__PURE__ */ jsxs(Fragment$1, { children: [
								/* @__PURE__ */ jsx(ColumnAlignMenuItem, {
									align: "left",
									columnAlign: state.columnAlign,
									onSelect: () => state.setTableColumnAlign.command("left")
								}),
								/* @__PURE__ */ jsx(ColumnAlignMenuItem, {
									align: "center",
									columnAlign: state.columnAlign,
									onSelect: () => state.setTableColumnAlign.command("center")
								}),
								/* @__PURE__ */ jsx(ColumnAlignMenuItem, {
									align: "right",
									columnAlign: state.columnAlign,
									onSelect: () => state.setTableColumnAlign.command("right")
								})
							] }),
							state.deleteCellSelection.canExec && /* @__PURE__ */ jsxs(MenuItem, {
								className: table_handle_module_default.MenuItem,
								"data-testid": "table-clear-column",
								onSelect: state.deleteCellSelection.command,
								children: [/* @__PURE__ */ jsx("span", { children: "Clear Contents" }), /* @__PURE__ */ jsx("kbd", { children: "Del" })]
							}),
							state.deleteTableColumn.canExec && /* @__PURE__ */ jsx(MenuItem, {
								className: table_handle_module_default.MenuItem,
								"data-testid": "table-delete-column",
								onSelect: state.deleteTableColumn.command,
								children: /* @__PURE__ */ jsx("span", { children: "Delete Column" })
							}),
							state.deleteTable.canExec && /* @__PURE__ */ jsx(MenuItem, {
								className: table_handle_module_default.MenuItem,
								"data-danger": "",
								"data-testid": "table-delete-table-column",
								onSelect: state.deleteTable.command,
								children: /* @__PURE__ */ jsx("span", { children: "Delete Table" })
							})
						]
					})
				})] })
			})
		}),
		/* @__PURE__ */ jsx(TableHandleRowPositioner, {
			placement: "left",
			className: table_handle_module_default.Positioner,
			children: /* @__PURE__ */ jsx(TableHandleRowPopup, {
				className: table_handle_module_default.RowPopup,
				children: /* @__PURE__ */ jsxs(TableHandleRowMenuRoot, { children: [/* @__PURE__ */ jsx(TableHandleRowMenuTrigger, {
					className: table_handle_module_default.Trigger,
					"data-testid": "table-handle-row",
					children: /* @__PURE__ */ jsx(GripVerticalIcon, {})
				}), /* @__PURE__ */ jsx(MenuPositioner, {
					className: table_handle_module_default.MenuPositioner,
					children: /* @__PURE__ */ jsxs(MenuPopup, {
						className: table_handle_module_default.MenuPopup,
						"data-testid": "table-handle-row-menu",
						children: [
							state.addTableRowAbove.canExec && /* @__PURE__ */ jsx(MenuItem, {
								className: table_handle_module_default.MenuItem,
								"data-testid": "table-insert-above",
								onSelect: state.addTableRowAbove.command,
								children: /* @__PURE__ */ jsx("span", { children: "Insert Above" })
							}),
							state.addTableRowBelow.canExec && /* @__PURE__ */ jsx(MenuItem, {
								className: table_handle_module_default.MenuItem,
								"data-testid": "table-insert-below",
								onSelect: state.addTableRowBelow.command,
								children: /* @__PURE__ */ jsx("span", { children: "Insert Below" })
							}),
							state.deleteCellSelection.canExec && /* @__PURE__ */ jsxs(MenuItem, {
								className: table_handle_module_default.MenuItem,
								"data-testid": "table-clear-row",
								onSelect: state.deleteCellSelection.command,
								children: [/* @__PURE__ */ jsx("span", { children: "Clear Contents" }), /* @__PURE__ */ jsx("kbd", { children: "Del" })]
							}),
							state.deleteTableRow.canExec && /* @__PURE__ */ jsx(MenuItem, {
								className: table_handle_module_default.MenuItem,
								"data-testid": "table-delete-row",
								onSelect: state.deleteTableRow.command,
								children: /* @__PURE__ */ jsx("span", { children: "Delete Row" })
							}),
							state.deleteTable.canExec && /* @__PURE__ */ jsx(MenuItem, {
								className: table_handle_module_default.MenuItem,
								"data-danger": "",
								"data-testid": "table-delete-table-row",
								onSelect: state.deleteTable.command,
								children: /* @__PURE__ */ jsx("span", { children: "Delete Table" })
							})
						]
					})
				})] })
			})
		})
	] });
}

//#endregion
//#region src/utils/returns-true.ts
function returnsTrue() {
	return true;
}

//#endregion
//#region src/components/tag-menu.tsx
const regex$1 = new RegExp((canUseRegexLookbehind() ? String.raw`(?<!\S)` : "") + String.raw`#[\da-z]+$`, "iu");
function TagMenu({ onTagSearch }) {
	const editor = useEditor$1();
	const [open, setOpen] = useState(false);
	const [query, setQuery] = useState("");
	const [items, setItems] = useState([]);
	const [loading, setLoading] = useState(false);
	const fetchItems = useCallback(async (query, signal) => {
		if (signal.aborted) return;
		setLoading(true);
		const result = await onTagSearch(query);
		if (signal.aborted) return;
		setItems(result);
		setLoading(false);
	}, [onTagSearch]);
	useEffect(() => {
		if (!open) return;
		const controller = new AbortController();
		queueMicrotask(() => {
			fetchItems(query, controller.signal);
		});
		return () => {
			controller.abort();
		};
	}, [
		open,
		query,
		fetchItems
	]);
	return /* @__PURE__ */ jsx(AutocompleteRoot, {
		regex: regex$1,
		filter: returnsTrue,
		onOpenChange: (event) => setOpen(event.detail),
		onQueryChange: (event) => setQuery(event.detail),
		children: /* @__PURE__ */ jsx(AutocompletePositioner, {
			className: autocomplete_menu_module_default.Positioner,
			children: /* @__PURE__ */ jsxs(AutocompletePopup, {
				className: autocomplete_menu_module_default.Popup,
				"data-testid": "tag-menu",
				children: [items.map((item) => /* @__PURE__ */ jsxs(AutocompleteItem, {
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
				}, item.tag)), /* @__PURE__ */ jsx(AutocompleteEmpty, {
					className: autocomplete_menu_module_default.Item,
					children: loading ? "Loading..." : "No tags found"
				})]
			})
		})
	});
}

//#endregion
//#region src/components/virtual-caret.tsx
function VirtualCaret() {
	const [layer, setLayer] = useState(null);
	useExtension$1(useMemo(() => layer == null ? null : defineVirtualCaret(layer), [layer]));
	return /* @__PURE__ */ jsx("div", { ref: setLayer });
}

//#endregion
//#region src/components/wikilink-menu.tsx
const regex = new RegExp(String.raw`(?:\[\[[^[\]]*|` + (canUseRegexLookbehind() ? String.raw`(?<!\S)` : "") + String.raw`@(?:[^[\]\s][^[\]]*)?)$`, "u");
function queryFromRegexMatch(match) {
	return match[0].replace(/^(?:\[\[|@)/, "").trim();
}
function WikilinkMenu({ onWikilinkSearch }) {
	const editor = useEditor$1();
	const [open, setOpen] = useState(false);
	const [query, setQuery] = useState("");
	const [items, setItems] = useState([]);
	const [loading, setLoading] = useState(false);
	const fetchItems = useCallback(async (query, signal) => {
		if (signal.aborted) return;
		setLoading(true);
		const result = await onWikilinkSearch(query);
		if (signal.aborted) return;
		setItems(result);
		setLoading(false);
	}, [onWikilinkSearch]);
	useEffect(() => {
		if (!open) return;
		const controller = new AbortController();
		queueMicrotask(() => {
			fetchItems(query, controller.signal);
		});
		return () => {
			controller.abort();
		};
	}, [
		open,
		query,
		fetchItems
	]);
	return /* @__PURE__ */ jsx(AutocompleteRoot, {
		regex,
		filter: returnsTrue,
		followCursor: true,
		queryBuilder: queryFromRegexMatch,
		onOpenChange: (event) => setOpen(event.detail),
		onQueryChange: (event) => setQuery(event.detail),
		children: /* @__PURE__ */ jsx(AutocompletePositioner, {
			className: autocomplete_menu_module_default.Positioner,
			children: /* @__PURE__ */ jsxs(AutocompletePopup, {
				className: autocomplete_menu_module_default.Popup,
				"data-testid": "wikilink-menu",
				children: [items.map((item) => /* @__PURE__ */ jsxs(AutocompleteItem, {
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
						children: item.detail
					}) : null]
				}, item.target)), /* @__PURE__ */ jsx(AutocompleteEmpty, {
					className: autocomplete_menu_module_default.Item,
					children: loading ? "Loading..." : "No notes found"
				})]
			})
		})
	});
}

//#endregion
//#region src/components/prosekit-editor.tsx
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
function ProseKitEditor({ markMode = "focus", initialMarkdown, onDocChange, onSlashMenuSearch, onTagSearch, onWikilinkSearch, onSelectionMenuSearch, selectionMenuAffordance = true, pendingReplacementActions, onPendingReplacementResolve, onWikilinkClick, onLinkClick, onLinkCopy, resolveLinkPreview, onTagClick, onExitBoundary, resolveImageUrl, resolveFileLink, resolveWikiEmbed, resolveWikilink, resolveFileInfo, resolveXPost, mediaUrlProtocols, resolveYouTubeVideo, onFileClick, onFilePaste, onFileSaveError, onImageClick, onXPostMediaClick, onYouTubeVideoClick, embedPaste, linkPaste, bulletAfterHeading, substitution = true, frontmatter = false, blockHandle = true, placeholder, readOnly, spellCheck, searchQuery = "", onSearchChange, timeFormat, editorClassName, CodeBlockView, ref, children }) {
	const suppressDocChangeRef = useRef(false);
	const handleDocChange = useMemo(() => {
		if (!onDocChange) return;
		return () => {
			if (suppressDocChangeRef.current) return;
			onDocChange();
		};
	}, [onDocChange]);
	const wikilinkEnabled = !!onWikilinkSearch;
	const config = useMemo(() => ({
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
		substitution,
		placeholder,
		readOnly,
		spellCheck,
		editorClassName,
		wikilinkEnabled
	}), [
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
		substitution,
		placeholder,
		readOnly,
		spellCheck,
		editorClassName,
		wikilinkEnabled
	]);
	const [editor] = useState(() => {
		const baseExtension = defineEditorExtension(config);
		const extension = CodeBlockView === false ? baseExtension : union(baseExtension, defineCodeBlockView(CodeBlockView));
		const editor = createEditor({ extension });
		if (initialMarkdown) editor.setContent(markdownToDoc(initialMarkdown, {
			nodes: editor.nodes,
			frontmatter
		}));
		return editor;
	});
	const [selectionMenuContext, setSelectionMenuContext] = useState();
	const hasSelectionMenu = !!onSelectionMenuSearch;
	const openSelectionMenu = useCallback(() => {
		const { state } = editor;
		const { from, to, empty } = state.selection;
		if (empty) return;
		setSelectionMenuContext({
			selectedText: getSelectedText(state),
			from,
			to
		});
	}, [editor]);
	const closeSelectionMenu = useCallback(() => {
		setSelectionMenuContext(void 0);
	}, []);
	useImperativeHandle(ref, () => {
		function getMarkdown() {
			return docToMarkdown(editor.state.doc, { frontmatter });
		}
		function getSelection() {
			return editor.state.selection.toJSON();
		}
		function getState() {
			return [getMarkdown(), getSelection()];
		}
		function replaceState(markdown, selection, addToHistory = true, forceMarkdown = false) {
			if (markdown == null && !selection) return;
			const transaction = editor.state.tr;
			if (markdown != null) {
				const doc = markdownToDoc(markdown, {
					nodes: editor.nodes,
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
				editor.view.dispatch(transaction);
			} finally {
				suppressDocChangeRef.current = false;
			}
		}
		function setState(markdown, selection) {
			replaceState(markdown, selection);
		}
		function setMarkdown(markdown) {
			setState(markdown);
		}
		function refreshMarkdownRendering() {
			const [markdown, selection] = getState();
			replaceState(markdown, selection, false, true);
		}
		function insertMarkdown(markdown) {
			editor.commands.insertMarkdown(markdown);
		}
		function setSelection(selection) {
			setState(void 0, selection);
		}
		function focus() {
			editor.focus();
		}
		function scrollIntoView() {
			editor.commands.scrollIntoView();
		}
		function revealHeading(fragment) {
			const position = findHeadingPosition(editor.state.doc, fragment);
			if (position == null) return false;
			const selection = TextSelection.near(editor.state.doc.resolve(position));
			editor.view.dispatch(editor.state.tr.setSelection(selection).scrollIntoView());
			return true;
		}
		function getSelectedTextFromState() {
			return getSelectedText(editor.state);
		}
		function openSelectionMenuFromHandle() {
			if (!hasSelectionMenu) return;
			openSelectionMenu();
		}
		function startPendingReplacement(options) {
			return editor.commands.startPendingReplacement(options);
		}
		function appendPendingReplacementText(text) {
			editor.commands.appendPendingReplacementText(text);
		}
		function acceptPendingReplacement(options) {
			editor.commands.acceptPendingReplacement(options ?? {});
		}
		function discardPendingReplacement() {
			editor.commands.discardPendingReplacement();
		}
		function findNext() {
			editor.commands.findNext();
		}
		function findPrevious() {
			editor.commands.findPrev();
		}
		return {
			getMarkdown,
			setMarkdown,
			insertMarkdown,
			getState,
			setState,
			refreshMarkdownRendering,
			getSelection,
			setSelection,
			focus,
			scrollIntoView,
			revealHeading,
			getSelectedText: getSelectedTextFromState,
			openSelectionMenu: openSelectionMenuFromHandle,
			startPendingReplacement,
			appendPendingReplacementText,
			acceptPendingReplacement,
			discardPendingReplacement,
			findNext,
			findPrevious,
			editor
		};
	}, [
		editor,
		frontmatter,
		hasSelectionMenu,
		openSelectionMenu
	]);
	return /* @__PURE__ */ jsxs(ProseKit, {
		editor,
		children: [
			/* @__PURE__ */ jsx(VirtualCaret, {}),
			/* @__PURE__ */ jsx("div", { ref: editor.mount }),
			/* @__PURE__ */ jsx(EditorExtensions, {
				config,
				searchQuery,
				onDocChange: handleDocChange,
				onSearchChange
			}),
			blockHandle && !readOnly && /* @__PURE__ */ jsx(BlockHandle, {}),
			!readOnly && /* @__PURE__ */ jsx(TableHandle, {}),
			blockHandle && !readOnly && /* @__PURE__ */ jsx(DropIndicator$1, {}),
			/* @__PURE__ */ jsx(SlashMenu, {
				timeFormat,
				onSlashMenuSearch,
				onFilePaste,
				onFileSaveError
			}),
			/* @__PURE__ */ jsx(LinkMenu, {
				onLinkClick,
				onLinkCopy,
				resolveLinkPreview,
				readOnly
			}, String(readOnly)),
			onTagSearch && /* @__PURE__ */ jsx(TagMenu, { onTagSearch }),
			onWikilinkSearch && /* @__PURE__ */ jsx(WikilinkMenu, { onWikilinkSearch }),
			onSelectionMenuSearch && !readOnly && /* @__PURE__ */ jsx(SelectionMenu, {
				onSelectionMenuSearch,
				context: selectionMenuContext,
				onOpen: openSelectionMenu,
				onClose: closeSelectionMenu,
				affordance: selectionMenuAffordance
			}),
			!readOnly && /* @__PURE__ */ jsx(PendingReplacementPreview, {
				actions: pendingReplacementActions,
				onResolve: onPendingReplacementResolve
			}),
			children
		]
	});
}

//#endregion
//#region src/components/editor.tsx
const CARET_GLIDE_OFF = { "--meowdown-caret-glide": "0ms" };
/**
* A hybrid live-preview Markdown editor: the document stays Markdown text,
* rendered in place as rich content.
*
* Callbacks and resolvers should be stable; pass them via `useCallback`.
*/
function MeowdownEditor({ mode = "focus", initialMarkdown, onDocChange, onSlashMenuSearch, onTagSearch, onWikilinkSearch, onSelectionMenuSearch, selectionMenuAffordance = true, pendingReplacementActions, onPendingReplacementResolve, onWikilinkClick, onLinkClick, onLinkCopy, resolveLinkPreview, onTagClick, onExitBoundary, resolveImageUrl, resolveFileLink, resolveWikiEmbed, resolveWikilink, resolveFileInfo, resolveXPost, mediaUrlProtocols, resolveYouTubeVideo, onFileClick, onFilePaste, onFileSaveError, onImageClick, onXPostMediaClick, onYouTubeVideoClick, embedPaste = true, linkPaste = true, bulletAfterHeading = false, substitution = true, frontmatter = false, blockHandle = true, caretGlide = true, placeholder, readOnly, spellCheck, searchQuery, onSearchChange, timeFormat, editorClassName, wrapperClassName, CodeBlockView, handleRef, children }) {
	const childRef = useRef(null);
	useImperativeHandle(handleRef, () => {
		function getMarkdown() {
			return childRef.current?.getMarkdown() ?? "";
		}
		function setMarkdown(markdown) {
			childRef.current?.setMarkdown(markdown);
		}
		function insertMarkdown(markdown) {
			childRef.current?.insertMarkdown(markdown);
		}
		function getState() {
			return childRef.current?.getState() ?? ["", {
				type: "text",
				anchor: 0,
				head: 0
			}];
		}
		function setState(markdown, selection) {
			childRef.current?.setState(markdown, selection);
		}
		function refreshMarkdownRendering() {
			childRef.current?.refreshMarkdownRendering();
		}
		function getSelection() {
			return childRef.current?.getSelection() ?? {
				type: "text",
				anchor: 0,
				head: 0
			};
		}
		function setSelection(selection) {
			childRef.current?.setSelection(selection);
		}
		function focus() {
			childRef.current?.focus();
		}
		function scrollIntoView() {
			childRef.current?.scrollIntoView();
		}
		function revealHeading(fragment) {
			return childRef.current?.revealHeading(fragment) ?? false;
		}
		function getSelectedText() {
			return childRef.current?.getSelectedText() ?? "";
		}
		function openSelectionMenu() {
			childRef.current?.openSelectionMenu();
		}
		function startPendingReplacement(options) {
			return childRef.current?.startPendingReplacement(options) ?? false;
		}
		function appendPendingReplacementText(text) {
			childRef.current?.appendPendingReplacementText(text);
		}
		function acceptPendingReplacement(options) {
			childRef.current?.acceptPendingReplacement(options);
		}
		function discardPendingReplacement() {
			childRef.current?.discardPendingReplacement();
		}
		function findNext() {
			childRef.current?.findNext();
		}
		function findPrevious() {
			childRef.current?.findPrevious();
		}
		return {
			getMarkdown,
			setMarkdown,
			insertMarkdown,
			getState,
			setState,
			refreshMarkdownRendering,
			getSelection,
			setSelection,
			focus,
			scrollIntoView,
			revealHeading,
			getSelectedText,
			openSelectionMenu,
			startPendingReplacement,
			appendPendingReplacementText,
			acceptPendingReplacement,
			discardPendingReplacement,
			findNext,
			findPrevious,
			get editor() {
				return childRef.current?.editor;
			}
		};
	}, []);
	return /* @__PURE__ */ jsx("div", {
		className: clsx("meowdown", wrapperClassName),
		style: caretGlide ? void 0 : CARET_GLIDE_OFF,
		children: /* @__PURE__ */ jsx(ProseKitEditor, {
			ref: childRef,
			markMode: mode,
			initialMarkdown,
			onDocChange,
			onSlashMenuSearch,
			onTagSearch,
			onWikilinkSearch,
			onSelectionMenuSearch,
			selectionMenuAffordance,
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
			substitution,
			frontmatter,
			blockHandle,
			placeholder,
			readOnly,
			spellCheck,
			searchQuery,
			onSearchChange,
			timeFormat,
			editorClassName,
			CodeBlockView,
			children
		})
	});
}

//#endregion
//#region src/components/attributes-to-props.ts
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

//#endregion
//#region src/components/dom-output-spec.tsx
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

//#endregion
//#region src/components/markdown-view.tsx
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
	const { target, display, onWikilinkClick, children } = props;
	return /* @__PURE__ */ jsxs("span", {
		className: "md-wikilink-view md-atom-view",
		children: [/* @__PURE__ */ jsx("span", {
			className: "md-wikilink-view-preview md-atom-view-preview",
			"data-testid": "wikilink",
			contentEditable: false,
			onClick: onWikilinkClick ? (event) => {
				return onWikilinkClick({
					target,
					event: event.nativeEvent,
					mod: isModEvent(event)
				});
			} : void 0,
			children: /* @__PURE__ */ jsx("span", {
				className: "md-wikilink-view-label",
				contentEditable: false,
				children: display || target
			})
		}), /* @__PURE__ */ jsx("span", {
			className: "md-wikilink-view-content md-atom-view-content",
			children
		})]
	});
}
function PostEmbed(props) {
	const { kind, src, width, snapshot, resolveXPost, mediaUrlProtocols, resolveYouTubeVideo } = props;
	registerXPost();
	registerYouTubeVideo();
	const saved = snapshot == null ? void 0 : parsePostEmbedSnapshot(snapshot);
	return /* @__PURE__ */ jsx("span", {
		className: "md-image-view-preview md-atom-view-preview",
		contentEditable: false,
		"data-testid": `${kind}-embed`,
		"data-post-embed": kind,
		children: kind === "x-post" ? createElement("meowdown-embed-x", {
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
		})
	});
}
function ImagePreview(props) {
	const { src, alt, width, snapshot, resolveImageUrl, resolveXPost, mediaUrlProtocols, resolveYouTubeVideo, onImageClick, interactive } = props;
	const kind = matchEmbed(src);
	if (kind) {
		if (!interactive) return null;
		return /* @__PURE__ */ jsx(PostEmbed, {
			kind,
			src,
			width,
			snapshot,
			resolveXPost,
			mediaUrlProtocols,
			resolveYouTubeVideo: resolveYouTubeVideo ?? defaultResolveYouTubeVideo
		}, src);
	}
	const url = (resolveImageUrl ?? defaultResolveImageUrl)(src);
	if (!url) return null;
	return /* @__PURE__ */ jsx("span", {
		className: "md-image-view-preview md-atom-view-preview",
		"data-testid": "image-preview",
		contentEditable: false,
		children: /* @__PURE__ */ jsx("img", {
			src: url,
			alt,
			draggable: false,
			onClick: onImageClick ? (event) => {
				return onImageClick({
					src,
					alt,
					event: event.nativeEvent,
					element: event.currentTarget,
					mod: isModEvent(event)
				});
			} : void 0,
			style: width == null ? void 0 : { width: `${width}px` }
		})
	});
}
function ImageView(props) {
	const { src, alt, width, snapshot, context, children } = props;
	return /* @__PURE__ */ jsxs("span", {
		className: "md-image-view md-atom-view",
		children: [/* @__PURE__ */ jsx(ImagePreview, {
			src,
			alt,
			width,
			snapshot,
			resolveImageUrl: context.resolveImageUrl,
			resolveXPost: context.resolveXPost,
			mediaUrlProtocols: context.mediaUrlProtocols,
			resolveYouTubeVideo: context.resolveYouTubeVideo,
			onImageClick: context.onImageClick,
			interactive: context.interactive
		}), /* @__PURE__ */ jsx("span", {
			className: "md-image-view-content md-atom-view-content",
			children
		})]
	});
}
function FileView(props) {
	const { href, name, context, children } = props;
	const resolveFileInfo = context.resolveFileInfo;
	const [resolvedSize, setResolvedSize] = useState();
	useEffect(() => {
		if (!resolveFileInfo) return;
		let active = true;
		const load = async () => {
			try {
				const info = await resolveFileInfo(href);
				if (!active || info?.size == null || !Number.isFinite(info.size) || info.size < 0) return;
				setResolvedSize({
					href,
					resolver: resolveFileInfo,
					text: formatFileSize(info.size)
				});
			} catch (error) {
				console.error("[meowdown] resolveFileInfo failed:", error);
			}
		};
		load();
		return () => {
			active = false;
		};
	}, [resolveFileInfo, href]);
	const size = resolvedSize?.href === href && resolvedSize.resolver === resolveFileInfo ? resolvedSize.text : "";
	const handleClick = context.onFileClick ? (event) => {
		context.onFileClick?.({
			href,
			name,
			event: event.nativeEvent,
			mod: isModEvent(event)
		});
	} : void 0;
	return /* @__PURE__ */ jsxs("span", {
		className: "md-file-view md-atom-view",
		children: [/* @__PURE__ */ jsxs("span", {
			className: "md-file-view-preview md-atom-view-preview",
			"data-testid": "file-pill",
			"data-file-kind": getFileKind(href),
			contentEditable: false,
			title: name,
			onClick: handleClick,
			children: [
				/* @__PURE__ */ jsxs("svg", {
					className: "md-file-view-icon",
					viewBox: "0 0 24 24",
					"aria-hidden": "true",
					fill: "none",
					stroke: "currentColor",
					strokeWidth: "2",
					strokeLinecap: "round",
					strokeLinejoin: "round",
					children: [/* @__PURE__ */ jsx("path", { d: "M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" }), /* @__PURE__ */ jsx("path", { d: "M14 2v4a2 2 0 0 0 2 2h4" })]
				}),
				/* @__PURE__ */ jsx("span", {
					className: "md-file-view-name",
					children: name
				}),
				/* @__PURE__ */ jsx("span", {
					className: "md-file-view-size",
					"data-testid": "file-pill-size",
					children: size
				})
			]
		}), /* @__PURE__ */ jsx("span", {
			className: "md-file-view-content md-atom-view-content",
			children
		})]
	});
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
function CodeBlock({ code, language }) {
	const syncTokens = useMemo(() => {
		const result = getCodeTokens(code, language);
		return Array.isArray(result) ? result : null;
	}, [code, language]);
	const [asyncTokens, setAsyncTokens] = useState(null);
	useEffect(() => {
		if (syncTokens) return;
		let active = true;
		const result = getCodeTokens(code, language);
		if (!Array.isArray(result)) result.then((loaded) => {
			if (active) setAsyncTokens(loaded);
		});
		return () => {
			active = false;
		};
	}, [
		code,
		language,
		syncTokens
	]);
	const tokens = syncTokens ?? asyncTokens ?? [];
	return /* @__PURE__ */ jsx("pre", {
		"data-language": language || void 0,
		children: /* @__PURE__ */ jsx("code", { children: tokens.length > 0 ? renderTokens(code, tokens) : code })
	});
}
/**
* Mirrors the editor's `MathMarkView` DOM: a KaTeX preview next to the source
* text, flipped by the same mode CSS (the read-only view has no caret, so the
* preview always shows in hide/focus modes).
*/
function MathView(props) {
	const { formula, children } = props;
	const katex = useKaTeX(true);
	if (!katex) return /* @__PURE__ */ jsx("span", { children: formula });
	return /* @__PURE__ */ jsxs("span", {
		className: "md-math-view",
		children: [/* @__PURE__ */ jsx(MathRender, {
			katex,
			formula,
			displayMode: false,
			className: "md-math-view-preview",
			"data-testid": "math-preview"
		}), /* @__PURE__ */ jsx("span", {
			className: "md-math-view-content",
			children
		})]
	});
}
/**
* A `math` code block: the rendered formula alone, the source while KaTeX loads.
*/
function MathCodeBlock({ code }) {
	const katex = useKaTeX(true);
	if (!katex) return /* @__PURE__ */ jsx(CodeBlock, {
		code,
		language: "math"
	});
	return /* @__PURE__ */ jsx(MathRender, {
		katex,
		formula: code,
		displayMode: true,
		className: code_block_view_module_default.Preview,
		"data-testid": "code-block-math-preview"
	});
}
function MermaidCodeBlock({ code }) {
	const renderer = useBeautifulMermaid(true);
	if (!renderer || code.trim() === "") return /* @__PURE__ */ jsx(CodeBlock, {
		code,
		language: "mermaid"
	});
	return /* @__PURE__ */ jsx(MermaidRender, {
		renderer,
		source: code,
		className: `${code_block_view_module_default.Preview} ${code_block_view_module_default.MermaidPreview}`,
		"data-testid": "code-block-mermaid-preview"
	});
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
	if (isReferenceDefinitionNode(node, parent, index)) return null;
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
function MarkdownView({ markdown, markMode = "hide", frontmatter = false, interactive = true, expandCollapsed = false, resolveImageUrl, resolveFileLink, resolveWikiEmbed, resolveWikilink, resolveFileInfo, resolveXPost, mediaUrlProtocols, resolveYouTubeVideo, onWikilinkClick, onLinkClick, onImageClick, onXPostMediaClick, onYouTubeVideoClick, onFileClick, onTaskClick, className }) {
	const context = useMemo(() => ({
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
		onWikilinkClick: interactive ? onWikilinkClick : void 0,
		onLinkClick: interactive ? onLinkClick : void 0,
		onImageClick: interactive ? onImageClick : void 0,
		onFileClick: interactive ? onFileClick : void 0,
		onTaskClick: interactive ? onTaskClick : void 0
	}), [
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
		onWikilinkClick,
		onLinkClick,
		onImageClick,
		onFileClick,
		onTaskClick
	]);
	const { blocks, referenceDefinitions, definitionsKey } = useMemo(() => {
		const doc = markdownToDoc(markdown, { frontmatter });
		const referenceDefinitions = collectReferenceDefinitions(doc).definitions;
		return {
			blocks: splitBlocks(doc),
			referenceDefinitions,
			definitionsKey: definitionsSignature(referenceDefinitions)
		};
	}, [markdown, frontmatter]);
	const handleXPostMediaClick = interactive ? onXPostMediaClick : void 0;
	const handleYouTubeVideoClick = interactive ? onYouTubeVideoClick : void 0;
	const rootRef = useCallback((root) => {
		if (handleXPostMediaClick) root.addEventListener(X_POST_MEDIA_CLICK, handleXPostMediaClick);
		if (handleYouTubeVideoClick) root.addEventListener(YOUTUBE_VIDEO_CLICK, handleYouTubeVideoClick);
		return () => {
			if (handleXPostMediaClick) root.removeEventListener(X_POST_MEDIA_CLICK, handleXPostMediaClick);
			if (handleYouTubeVideoClick) root.removeEventListener(YOUTUBE_VIDEO_CLICK, handleYouTubeVideoClick);
		};
	}, [handleXPostMediaClick, handleYouTubeVideoClick]);
	return /* @__PURE__ */ jsx("div", {
		ref: rootRef,
		className: clsx("ProseMirror", "meowdown-content", className),
		"data-mark-mode": markMode,
		children: blocks.map(({ node, taskBase }, index) => /* @__PURE__ */ jsx(MarkdownBlock, {
			node,
			taskBase,
			context,
			referenceDefinitions,
			definitionsKey
		}, index))
	});
}

//#endregion
//#region src/hooks/use-lightbox.ts
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
	const [item, setItem] = useState(null);
	const sourceRef = useRef(null);
	const instantRef = useRef(false);
	const open = useCallback((nextItem, element) => {
		setTransitionName(sourceRef.current, "");
		sourceRef.current = element ?? null;
		setTransitionName(sourceRef.current, LIGHTBOX_TRANSITION_NAME);
		startTransition(() => setItem(nextItem));
	}, []);
	const close = useCallback((options) => {
		instantRef.current = options?.instant === true;
		if (instantRef.current) setItem(null);
		else startTransition(() => setItem(null));
	}, []);
	const isOpen = item != null;
	useLayoutEffect(() => {
		if (!isOpen) return;
		setTransitionName(sourceRef.current, "");
		return () => {
			const source = sourceRef.current;
			if (!instantRef.current && source?.isConnected) setTransitionName(source, LIGHTBOX_TRANSITION_NAME);
			else sourceRef.current = null;
		};
	}, [isOpen]);
	const onExited = useCallback(() => {
		setTransitionName(sourceRef.current, "");
		sourceRef.current = null;
	}, []);
	return useMemo(() => ({
		item,
		open,
		close,
		onExited
	}), [
		item,
		open,
		close,
		onExited
	]);
}

//#endregion
//#region src/components/lightbox.module.css
var lightbox_module_default = {
	"Dialog": "meow_Dialog_Bt-ppa",
	"Frame": "meow_Frame_Bt-ppa",
	"Image": "meow_Image_Bt-ppa",
	"Video": "meow_Video_Bt-ppa"
};

//#endregion
//#region src/components/lightbox-frame.tsx
/**
* The embedded page of a lightbox, such as a video player: the largest box of
* the item's aspect ratio that fits.
*/
function LightboxFrame({ item, className, style, ...props }) {
	const ratio = item.width && item.height ? item.width / item.height : 16 / 9;
	const frameStyle = {
		...style,
		"--meowdown-lightbox-frame-ratio": String(ratio),
		backgroundImage: item.poster ? `url(${JSON.stringify(item.poster)})` : void 0,
		viewTransitionName: LIGHTBOX_TRANSITION_NAME
	};
	return /* @__PURE__ */ jsx("iframe", {
		allow: "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen",
		allowFullScreen: true,
		referrerPolicy: "strict-origin-when-cross-origin",
		...props,
		src: item.src,
		title: item.title,
		className: clsx(lightbox_module_default.Frame, className),
		style: frameStyle
	});
}

//#endregion
//#region src/components/lightbox-image.tsx
/**
* The image of a lightbox. It is the element the opened thumbnail zooms into.
*/
function LightboxImage({ item, className, style, ...props }) {
	return /* @__PURE__ */ jsx("img", {
		draggable: false,
		...props,
		src: item.src,
		alt: item.alt ?? "",
		className: clsx(lightbox_module_default.Image, className),
		style: {
			...style,
			viewTransitionName: LIGHTBOX_TRANSITION_NAME
		}
	});
}

//#endregion
//#region src/components/lightbox-root.tsx
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
function LightboxRoot({ lightbox, children, className, ...props }) {
	const { item, close, onExited } = lightbox;
	if (!item) return null;
	return /* @__PURE__ */ jsx(ViewTransition, {
		default: DIALOG_TRANSITION_CLASS,
		onExit: () => onExited,
		children: /* @__PURE__ */ jsx("dialog", {
			"aria-label": item.type === "image" ? "Image preview" : "Video preview",
			...props,
			ref: showModal,
			className: clsx(lightbox_module_default.Dialog, className),
			onCancel: (event) => {
				event.preventDefault();
				close();
			},
			onClose: (event) => {
				if (!event.currentTarget.open) close({ instant: true });
			},
			children: children(item)
		})
	});
}

//#endregion
//#region src/components/lightbox-video.tsx
/**
* The video of a lightbox. It starts playing as soon as it opens: the click
* that opened the lightbox is the user gesture that allows sound.
*/
function LightboxVideo({ item, className, style, ...props }) {
	const gif = item.gif === true;
	return /* @__PURE__ */ jsx("video", {
		controls: !gif,
		loop: gif,
		muted: gif,
		autoPlay: true,
		playsInline: true,
		"aria-label": item.alt,
		...props,
		poster: item.poster,
		width: item.width,
		height: item.height,
		className: clsx(lightbox_module_default.Video, className),
		style: {
			...style,
			viewTransitionName: LIGHTBOX_TRANSITION_NAME
		},
		children: item.sources.map((source) => /* @__PURE__ */ jsx("source", {
			src: source.src,
			type: source.type
		}, source.src))
	});
}

//#endregion
//#region src/components/wikilink-hover-card.module.css
var wikilink_hover_card_module_default = {
	"Popup": "meow_Popup_L_YRjW",
	"Positioner": "meow_Positioner_L_YRjW",
	"Viewport": "meow_Viewport_L_YRjW"
};

//#endregion
//#region src/components/wikilink-hover-card.tsx
/**
* Show host-rendered content for the wiki link the pointer rests on. The
* open and close delays live in the core hover handler.
*/
function WikilinkHoverCard({ children, className }) {
	const [hit, setHit] = useState();
	const lastRectRef = useRef(null);
	const [displayed, setDisplayed] = useState();
	const [open, setOpen] = useState(false);
	const [body, setBody] = useState(null);
	const [hoverExtension] = useState(() => {
		return defineWikilinkHoverHandler((nextHit) => {
			setHit(nextHit);
			setOpen(nextHit != null);
			if (nextHit) setDisplayed(nextHit);
		});
	});
	useExtension$1(hoverExtension);
	const getRect = useCallback(() => {
		const rect = hit?.element?.getBoundingClientRect();
		if (rect && rect.width > 0 && rect.height > 0) lastRectRef.current = rect;
		return lastRectRef.current || new DOMRect(0, 0, 0, 0);
	}, [hit]);
	const anchor = useMemo(() => {
		return { getBoundingClientRect: getRect };
	}, [getRect]);
	useEffect(() => {
		let stale = false;
		const resolveBody = async () => {
			try {
				const resolved = await (displayed ? children(displayed) : null);
				if (!stale) setBody(resolved);
			} catch (error) {
				if (stale) return;
				console.error("[meowdown] wikilink hover card body rejected:", error);
				setBody(null);
			}
		};
		resolveBody();
		return () => {
			stale = true;
		};
	}, [children, displayed]);
	return /* @__PURE__ */ jsx(PreviewCard.Root, {
		open: open && body != null,
		onOpenChange: (nextOpen) => {
			if (!nextOpen) setOpen(false);
		},
		onOpenChangeComplete: (nextOpen) => {
			if (!nextOpen) setDisplayed(void 0);
		},
		children: body != null && /* @__PURE__ */ jsx(PreviewCard.Portal, { children: /* @__PURE__ */ jsx(PreviewCard.Positioner, {
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
		}) })
	});
}

//#endregion
export { LightboxFrame, LightboxImage, LightboxRoot, LightboxVideo, MarkdownView, MeowdownEditor, WikilinkHoverCard, useEditor, useExtension, useKeymap, useLightbox };