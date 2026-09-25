import { n as Resolver, t as FetchProps } from "../fetch-Djnul03u.js";
import { HostElement, State } from "@aria-ui/core";
import { YouTubeVideo } from "@post-embed/types";
//#region src/youtube/video-click.d.ts
export declare const YOUTUBE_VIDEO_CLICK = "meowdown-embed-youtube-click";
interface YouTubeVideoClickDetail {
  /**
   * The snapshot the card rendered.
   */
  video: YouTubeVideo;
  videoId: string;
  /**
   * Where playback starts, from the `t` or `start` parameter of the URL.
   */
  startSeconds: number;
  /**
   * A Short, which plays in portrait.
   */
  short: boolean;
  /**
   * The player page for an `<iframe>`. It starts playing as soon as it loads.
   */
  embedUrl: string;
  /**
   * The rendered thumbnail: the poster `<img>`, or the poster itself when the
   * snapshot has no thumbnail.
   */
  element: HTMLElement;
}
type YouTubeVideoClickEvent = CustomEvent<YouTubeVideoClickDetail>;
//#endregion
//#region src/youtube/youtube-video.d.ts
interface YouTubeVideoProps extends FetchProps<YouTubeVideo> {
  /**
   * `link` (default) opens the watch page; `inline` swaps in the YouTube
   * player after a click on the poster.
   */
  playback: string;
}
interface YouTubeVideoElement extends HTMLElement, YouTubeVideoProps {}
/** @internal */
export declare function useYouTubeVideo(host: HostElement, props: State<YouTubeVideoProps>): void;
//#endregion
//#region src/youtube/register.d.ts
export declare function registerYouTubeVideo(name?: string): void;
//#endregion
//#region src/youtube/index.d.ts
declare global {
  interface HTMLElementTagNameMap {
    'meowdown-embed-youtube': YouTubeVideoElement;
  }
  interface HTMLElementEventMap {
    'meowdown-embed-youtube-click': YouTubeVideoClickEvent;
  }
}
//#endregion
export type { Resolver, YouTubeVideoClickDetail, YouTubeVideoClickEvent, YouTubeVideoElement, YouTubeVideoProps };