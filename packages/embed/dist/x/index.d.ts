import { n as Resolver, t as FetchProps } from "../fetch-Djnul03u.js";
import { HostElement, State } from "@aria-ui/core";
import { XPost, XPostMedia } from "@post-embed/types";
//#region src/x/media-click.d.ts
export declare const X_POST_MEDIA_CLICK = "meowdown-embed-media-click";
interface XPostMediaClickDetail {
  /**
   * The activated item. Its URLs already passed the `mediaUrlProtocols` check,
   * and video sources are sorted best first.
   */
  media: XPostMedia;
  /**
   * Every displayable item of the same post, in order, for paging.
   */
  items: XPostMedia[];
  /**
   * Position of `media` in `items`.
   */
  index: number;
  /**
   * The rendered thumbnail: the photo `<img>`, or the video poster.
   */
  element: HTMLElement;
}
type XPostMediaClickEvent = CustomEvent<XPostMediaClickDetail>;
//#endregion
//#region src/x/x-post.d.ts
interface XPostProps extends FetchProps<XPost> {
  mediaUrlProtocols: readonly string[] | null;
}
interface XPostElement extends HTMLElement, XPostProps {}
/** @internal */
export declare function useXPost(host: HostElement, props: State<XPostProps>): void;
//#endregion
//#region src/x/register.d.ts
export declare function registerXPost(name?: string): void;
//#endregion
//#region src/x/index.d.ts
declare global {
  interface HTMLElementTagNameMap {
    'meowdown-embed-x': XPostElement;
  }
  interface HTMLElementEventMap {
    'meowdown-embed-media-click': XPostMediaClickEvent;
  }
}
//#endregion
export type { Resolver, XPostElement, XPostMediaClickDetail, XPostMediaClickEvent, XPostProps };