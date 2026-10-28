import { n as Resolver, t as FetchProps } from "../fetch-gxdhOZP6.js";
import { HostElement, State } from "@aria-ui/core";
import { YouTubeVideo } from "@post-embed/types";
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
export declare function registerYouTubeVideo(name?: string): void;
declare global {
  interface HTMLElementTagNameMap {
    'meowdown-embed-youtube': YouTubeVideoElement;
  }
  interface HTMLElementEventMap {
    'meowdown-embed-youtube-click': YouTubeVideoClickEvent;
  }
}
export type { Resolver, YouTubeVideoClickDetail, YouTubeVideoClickEvent, YouTubeVideoElement, YouTubeVideoProps };