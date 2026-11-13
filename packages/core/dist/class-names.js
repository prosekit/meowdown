// src/class-names.ts
/**
* The root of the editable document, and of a `MarkdownView`.
*/
const CONTENT_CLASS = "meowdown-content";
/**
* The `mdMark` mark: a run of Markdown syntax characters.
*/
const SYNTAX_MARK_CLASS = "md-mark";
/**
* The `mdImage` mark.
*/
const IMAGE_MARK_CLASS = "md-image";
/**
* The `mdLinkText` mark, and a rendered link in a `MarkdownView`.
*/
const LINK_TEXT_MARK_CLASS = "md-link";
/**
* The `mdLinkUri` mark.
*/
const LINK_URI_MARK_CLASS = "md-link-uri";
/**
* The `mdLinkTitle` mark.
*/
const LINK_TITLE_MARK_CLASS = "md-link-title";
/**
* The `mdTag` mark.
*/
const TAG_MARK_CLASS = "md-tag";
/**
* The `mdWikilink` mark.
*/
const WIKILINK_MARK_CLASS = "md-wikilink";
/**
* The `mdFile` mark.
*/
const FILE_MARK_CLASS = "md-file";
/**
* The `mdMath` mark.
*/
const MATH_MARK_CLASS = "md-math";
/**
* The `mdPack` mark.
*/
const PACK_MARK_CLASS = "md-pack";
/**
* A decoration that reveals the hidden Markdown syntax in its range.
*/
const SHOW_CLASS = "show";
/**
* A decoration on the source range of a selected atom.
*/
const ATOM_SELECTED_CLASS = "md-atom-selected";
/**
* A decoration on the range of a pending replacement.
*/
const PENDING_REPLACEMENT_CLASS = "md-pending-replacement";
/**
* The layer that holds the virtual caret.
*/
const VIRTUAL_CARET_LAYER_CLASS = "md-virtual-caret-layer";
/**
* The virtual caret.
*/
const VIRTUAL_CARET_CLASS = "md-virtual-caret";
/**
* The root of an atom mark view: an image, file, or wiki link.
*/
const ATOM_VIEW_CLASS = "md-atom-view";
/**
* The hidden holder of an atom mark view's Markdown source.
*/
const ATOM_VIEW_CONTENT_CLASS = "md-atom-view-content";
/**
* The rendered, non-editable part of an atom mark view.
*/
const ATOM_VIEW_PREVIEW_CLASS = "md-atom-view-preview";
/**
* The root of an image mark view, which also renders X post and YouTube cards.
*/
const IMAGE_VIEW_CLASS = "md-image-view";
/**
* The hidden holder of an image's Markdown source.
*/
const IMAGE_VIEW_CONTENT_CLASS = "md-image-view-content";
/**
* The rendered image or card.
*/
const IMAGE_VIEW_PREVIEW_CLASS = "md-image-view-preview";
/**
* The drag handle that resizes an image or YouTube card.
*/
const IMAGE_RESIZE_HANDLE_CLASS = "md-image-resize-handle";
/**
* The resizable box around an image.
*/
const IMAGE_RESIZABLE_CLASS = "md-image-resizable";
/**
* The resizable box around a YouTube card.
*/
const EMBED_RESIZABLE_CLASS = "md-embed-resizable";
/**
* The root of a file mark view.
*/
const FILE_VIEW_CLASS = "md-file-view";
/**
* The hidden holder of a file's Markdown source.
*/
const FILE_VIEW_CONTENT_CLASS = "md-file-view-content";
/**
* The rendered file pill.
*/
const FILE_VIEW_PREVIEW_CLASS = "md-file-view-preview";
/**
* The icon of a file pill.
*/
const FILE_VIEW_ICON_CLASS = "md-file-view-icon";
/**
* The name of a file pill.
*/
const FILE_VIEW_NAME_CLASS = "md-file-view-name";
/**
* The size of a file pill.
*/
const FILE_VIEW_SIZE_CLASS = "md-file-view-size";
/**
* The root of a wiki link mark view.
*/
const WIKILINK_VIEW_CLASS = "md-wikilink-view";
/**
* The hidden holder of a wiki link's Markdown source.
*/
const WIKILINK_VIEW_CONTENT_CLASS = "md-wikilink-view-content";
/**
* The rendered wiki link.
*/
const WIKILINK_VIEW_PREVIEW_CLASS = "md-wikilink-view-preview";
/**
* The label of a rendered wiki link.
*/
const WIKILINK_VIEW_LABEL_CLASS = "md-wikilink-view-label";
/**
* The root of a math mark view.
*/
const MATH_VIEW_CLASS = "md-math-view";
/**
* The Markdown source of a math formula.
*/
const MATH_VIEW_CONTENT_CLASS = "md-math-view-content";
/**
* The rendered math formula.
*/
const MATH_VIEW_PREVIEW_CLASS = "md-math-view-preview";
/**
* The class of the menu button that an image, X post, or YouTube card shows
* in the editor.
*/
const EMBED_MENU_BUTTON_CLASS = "md-embed-menu-button";
/**
* A small square button holding one icon.
*/
const ICON_BUTTON_CLASS = "meowdown-icon-button";
/**
* A Lucide icon drawn in `currentColor`. Pair it with {@link getIconClass}.
*/
const ICON_CLASS = "meowdown-icon";
/**
* The class that picks the icon `name`, used together with {@link ICON_CLASS}.
*/
function getIconClass(name) {
	return `${ICON_CLASS}-${name}`;
}
/**
* The positioner of a floating action menu.
*/
const MENU_POSITIONER_CLASS = "meowdown-menu-positioner";
/**
* The popup of a floating action menu.
*/
const MENU_POPUP_CLASS = "meowdown-menu-popup";
/**
* A row of a floating menu.
*/
const MENU_ITEM_CLASS = "meowdown-menu-item";
/**
* The check mark of the chosen row in a pick list.
*/
const MENU_ITEM_INDICATOR_CLASS = "meowdown-menu-item-indicator";

export { ATOM_SELECTED_CLASS, ATOM_VIEW_CLASS, ATOM_VIEW_CONTENT_CLASS, ATOM_VIEW_PREVIEW_CLASS, CONTENT_CLASS, EMBED_MENU_BUTTON_CLASS, EMBED_RESIZABLE_CLASS, FILE_MARK_CLASS, FILE_VIEW_CLASS, FILE_VIEW_CONTENT_CLASS, FILE_VIEW_ICON_CLASS, FILE_VIEW_NAME_CLASS, FILE_VIEW_PREVIEW_CLASS, FILE_VIEW_SIZE_CLASS, ICON_BUTTON_CLASS, ICON_CLASS, IMAGE_MARK_CLASS, IMAGE_RESIZABLE_CLASS, IMAGE_RESIZE_HANDLE_CLASS, IMAGE_VIEW_CLASS, IMAGE_VIEW_CONTENT_CLASS, IMAGE_VIEW_PREVIEW_CLASS, LINK_TEXT_MARK_CLASS, LINK_TITLE_MARK_CLASS, LINK_URI_MARK_CLASS, MATH_MARK_CLASS, MATH_VIEW_CLASS, MATH_VIEW_CONTENT_CLASS, MATH_VIEW_PREVIEW_CLASS, MENU_ITEM_CLASS, MENU_ITEM_INDICATOR_CLASS, MENU_POPUP_CLASS, MENU_POSITIONER_CLASS, PACK_MARK_CLASS, PENDING_REPLACEMENT_CLASS, SHOW_CLASS, SYNTAX_MARK_CLASS, TAG_MARK_CLASS, VIRTUAL_CARET_CLASS, VIRTUAL_CARET_LAYER_CLASS, WIKILINK_MARK_CLASS, WIKILINK_VIEW_CLASS, WIKILINK_VIEW_CONTENT_CLASS, WIKILINK_VIEW_LABEL_CLASS, WIKILINK_VIEW_PREVIEW_CLASS, getIconClass };