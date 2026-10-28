import { n as Resolver, t as FetchProps } from "../fetch-gxdhOZP6.js";
import { HostElement, State } from "@aria-ui/core";
import { XPost, XPostMedia } from "@post-embed/types";
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
interface XPostProps extends FetchProps<XPost> {
  mediaUrlProtocols: readonly string[] | null;
}
interface XPostElement extends HTMLElement, XPostProps {}
/** @internal */
export declare function useXPost(host: HostElement, props: State<XPostProps>): void;
export declare function registerXPost(name?: string): void;
declare global {
  interface HTMLElementTagNameMap {
    'meowdown-embed-x': XPostElement;
  }
  interface HTMLElementEventMap {
    'meowdown-embed-media-click': XPostMediaClickEvent;
  }
}
export type { Resolver, XPostElement, XPostMediaClickDetail, XPostMediaClickEvent, XPostProps };