/**
 * The root of the editable document, and of a `MarkdownView`.
 */
export declare const CONTENT_CLASS = "meowdown-content";
/**
 * The `mdMark` mark: a run of Markdown syntax characters.
 */
export declare const SYNTAX_MARK_CLASS = "md-mark";
/**
 * The `mdImage` mark.
 */
export declare const IMAGE_MARK_CLASS = "md-image";
/**
 * The `mdLinkText` mark, and a rendered link in a `MarkdownView`.
 */
export declare const LINK_TEXT_MARK_CLASS = "md-link";
/**
 * The `mdLinkUri` mark.
 */
export declare const LINK_URI_MARK_CLASS = "md-link-uri";
/**
 * The `mdLinkTitle` mark.
 */
export declare const LINK_TITLE_MARK_CLASS = "md-link-title";
/**
 * The `mdTag` mark.
 */
export declare const TAG_MARK_CLASS = "md-tag";
/**
 * The `mdWikilink` mark.
 */
export declare const WIKILINK_MARK_CLASS = "md-wikilink";
/**
 * The `mdFile` mark.
 */
export declare const FILE_MARK_CLASS = "md-file";
/**
 * The `mdMath` mark.
 */
export declare const MATH_MARK_CLASS = "md-math";
/**
 * The `mdPack` mark.
 */
export declare const PACK_MARK_CLASS = "md-pack";
/**
 * A decoration that reveals the hidden Markdown syntax in its range.
 */
export declare const SHOW_CLASS = "show";
/**
 * A decoration on the source range of a selected atom.
 */
export declare const ATOM_SELECTED_CLASS = "md-atom-selected";
/**
 * A decoration on the range of a pending replacement.
 */
export declare const PENDING_REPLACEMENT_CLASS = "md-pending-replacement";
/**
 * The layer that holds the virtual caret.
 */
export declare const VIRTUAL_CARET_LAYER_CLASS = "md-virtual-caret-layer";
/**
 * The virtual caret.
 */
export declare const VIRTUAL_CARET_CLASS = "md-virtual-caret";
/**
 * The root of an atom mark view: an image, file, or wiki link.
 */
export declare const ATOM_VIEW_CLASS = "md-atom-view";
/**
 * The hidden holder of an atom mark view's Markdown source.
 */
export declare const ATOM_VIEW_CONTENT_CLASS = "md-atom-view-content";
/**
 * The rendered, non-editable part of an atom mark view.
 */
export declare const ATOM_VIEW_PREVIEW_CLASS = "md-atom-view-preview";
/**
 * The root of an image mark view, which also renders X post and YouTube cards.
 */
export declare const IMAGE_VIEW_CLASS = "md-image-view";
/**
 * The hidden holder of an image's Markdown source.
 */
export declare const IMAGE_VIEW_CONTENT_CLASS = "md-image-view-content";
/**
 * The rendered image or card.
 */
export declare const IMAGE_VIEW_PREVIEW_CLASS = "md-image-view-preview";
/**
 * The drag handle that resizes an image or YouTube card.
 */
export declare const IMAGE_RESIZE_HANDLE_CLASS = "md-image-resize-handle";
/**
 * The resizable box around an image.
 */
export declare const IMAGE_RESIZABLE_CLASS = "md-image-resizable";
/**
 * The resizable box around a YouTube card.
 */
export declare const EMBED_RESIZABLE_CLASS = "md-embed-resizable";
/**
 * The root of a file mark view.
 */
export declare const FILE_VIEW_CLASS = "md-file-view";
/**
 * The hidden holder of a file's Markdown source.
 */
export declare const FILE_VIEW_CONTENT_CLASS = "md-file-view-content";
/**
 * The rendered file pill.
 */
export declare const FILE_VIEW_PREVIEW_CLASS = "md-file-view-preview";
/**
 * The icon of a file pill.
 */
export declare const FILE_VIEW_ICON_CLASS = "md-file-view-icon";
/**
 * The name of a file pill.
 */
export declare const FILE_VIEW_NAME_CLASS = "md-file-view-name";
/**
 * The size of a file pill.
 */
export declare const FILE_VIEW_SIZE_CLASS = "md-file-view-size";
/**
 * The root of a wiki link mark view.
 */
export declare const WIKILINK_VIEW_CLASS = "md-wikilink-view";
/**
 * The hidden holder of a wiki link's Markdown source.
 */
export declare const WIKILINK_VIEW_CONTENT_CLASS = "md-wikilink-view-content";
/**
 * The rendered wiki link.
 */
export declare const WIKILINK_VIEW_PREVIEW_CLASS = "md-wikilink-view-preview";
/**
 * The label of a rendered wiki link.
 */
export declare const WIKILINK_VIEW_LABEL_CLASS = "md-wikilink-view-label";
/**
 * The root of a math mark view.
 */
export declare const MATH_VIEW_CLASS = "md-math-view";
/**
 * The Markdown source of a math formula.
 */
export declare const MATH_VIEW_CONTENT_CLASS = "md-math-view-content";
/**
 * The rendered math formula.
 */
export declare const MATH_VIEW_PREVIEW_CLASS = "md-math-view-preview";
/**
 * The class of the menu button that an image, X post, or YouTube card shows
 * in the editor.
 */
export declare const EMBED_MENU_BUTTON_CLASS = "md-embed-menu-button";
/**
 * A small square button holding one icon.
 */
export declare const ICON_BUTTON_CLASS = "meowdown-icon-button";
/**
 * A Lucide icon drawn in `currentColor`. Pair it with {@link getIconClass}.
 */
export declare const ICON_CLASS = "meowdown-icon";
/**
 * The Lucide icons that the core stylesheet ships.
 */
export type IconName = 'braces' | 'check' | 'chevrons-up-down' | 'copy' | 'earth' | 'ellipsis' | 'grip-horizontal' | 'grip-vertical' | 'link-2' | 'pencil' | 'sparkles' | 'trash-2' | 'unlink';
/**
 * The class that picks the icon `name`, used together with {@link ICON_CLASS}.
 */
export declare function getIconClass(name: IconName): string;
/**
 * The positioner of a floating action menu.
 */
export declare const MENU_POSITIONER_CLASS = "meowdown-menu-positioner";
/**
 * The popup of a floating action menu.
 */
export declare const MENU_POPUP_CLASS = "meowdown-menu-popup";
/**
 * A row of a floating menu.
 */
export declare const MENU_ITEM_CLASS = "meowdown-menu-item";
/**
 * The check mark of the chosen row in a pick list.
 */
export declare const MENU_ITEM_INDICATOR_CLASS = "meowdown-menu-item-indicator";