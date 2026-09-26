import { a as useFetch, i as getSafeUrl, n as getRootContainer, r as renderLink, t as isPlainClick } from "../is-plain-click-Dt8iswO8.js";
import { defineCustomElement, defineProps, registerCustomElement, useEffect } from "@aria-ui/core";
import { parseYouTubeVideo } from "@post-embed/schema";
import el from "crelt";

//#region src/youtube/parse-url.ts
const YOUTUBE_HOSTS = /^(?:www\.|m\.)?(?:youtube\.com|youtube-nocookie\.com)$/i;
const YOUTU_BE_HOST = /^(?:www\.)?youtu\.be$/i;
const VIDEO_ID = /^[\w-]{11}$/;
function parseYouTubeUrl(value) {
	let url;
	try {
		url = new URL(value);
	} catch {
		return;
	}
	let videoId = null;
	let short = false;
	if (YOUTU_BE_HOST.test(url.hostname)) videoId = url.pathname.slice(1);
	else if (YOUTUBE_HOSTS.test(url.hostname)) {
		const [, first, second] = url.pathname.split("/");
		if (url.pathname === "/watch") videoId = url.searchParams.get("v");
		else if (first === "shorts" || first === "embed" || first === "live") {
			videoId = second ?? null;
			short = first === "shorts";
		}
	}
	if (!videoId || !VIDEO_ID.test(videoId)) return;
	const time = url.searchParams.get("start") ?? url.searchParams.get("t") ?? "";
	return {
		videoId,
		startSeconds: parseStartSeconds(time),
		short
	};
}
/**
* `90`, `90s`, `1m30s`, `1h2m3s` to seconds; anything else is `0`.
*/
function parseStartSeconds(value) {
	if (!value) return 0;
	if (/^\d+$/.test(value)) return Number(value);
	const matched = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/.exec(value);
	if (!matched) return 0;
	return Number(matched[1] ?? 0) * 3600 + Number(matched[2] ?? 0) * 60 + Number(matched[3] ?? 0);
}
function getWatchUrl(ref) {
	const time = ref.startSeconds ? `&t=${ref.startSeconds}` : "";
	return `https://www.youtube.com/watch?v=${ref.videoId}${time}`;
}
function getEmbedUrl(ref) {
	const params = new URLSearchParams({
		autoplay: "1",
		playsinline: "1"
	});
	if (ref.startSeconds) params.set("start", String(ref.startSeconds));
	return `https://www.youtube-nocookie.com/embed/${ref.videoId}?${params}`;
}

//#endregion
//#region src/youtube/video-click.ts
const YOUTUBE_VIDEO_CLICK = "meowdown-embed-youtube-click";
/**
* Returns false when a listener called `preventDefault()`: the host plays the
* video itself, so the card must not run its own default.
*/
function dispatchVideoClick(target, detail) {
	return target.dispatchEvent(new CustomEvent(YOUTUBE_VIDEO_CLICK, {
		detail,
		bubbles: true,
		cancelable: true,
		composed: true
	}));
}

//#endregion
//#region src/youtube/render-video.ts
function renderFrame(ref, title) {
	return el("iframe", {
		src: getEmbedUrl(ref),
		title,
		allow: "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen",
		allowfullscreen: true,
		referrerpolicy: "strict-origin-when-cross-origin"
	});
}
function renderVideo(video, ref, playback) {
	const watchUrl = getWatchUrl(ref);
	const title = video.title || "YouTube video";
	const poster = getSafeUrl(video.thumbnail_url);
	const external = {
		target: "_blank",
		rel: "noopener noreferrer"
	};
	const image = poster ? el("img", {
		src: poster,
		alt: "",
		width: video.thumbnail_width || void 0,
		height: video.thumbnail_height || void 0,
		loading: "lazy",
		decoding: "async",
		referrerpolicy: "no-referrer"
	}) : void 0;
	const posterContent = [image, el("span", {
		"data-play": "",
		"aria-hidden": "true"
	})];
	const onClick = (element) => {
		return dispatchVideoClick(element, {
			video,
			...ref,
			embedUrl: getEmbedUrl(ref),
			element
		});
	};
	let posterElement;
	if (playback === "inline") {
		const button = el("button", {
			"data-poster": "",
			type: "button",
			"aria-label": `Play: ${title}`
		}, posterContent);
		button.addEventListener("click", () => {
			if (!onClick(image ?? button)) return;
			const frame = renderFrame(ref, title);
			button.replaceWith(frame);
			frame.focus();
		});
		posterElement = button;
	} else {
		const link = el("a", {
			"data-poster": "",
			href: watchUrl,
			...external
		}, posterContent);
		link.addEventListener("click", (event) => {
			if (isPlainClick(event) && !onClick(image ?? link)) event.preventDefault();
		});
		posterElement = link;
	}
	return el("article", { "data-orientation": ref.short ? "portrait" : void 0 }, posterElement, el("div", { "data-details": "" }, el("a", {
		"data-title": "",
		href: watchUrl,
		...external
	}, title), video.author_name ? renderLink(el("span", { "data-author": "" }, video.author_name), video.author_url) : void 0));
}

//#endregion
//#region src/youtube/youtube-video.ts
/** @internal */
function useYouTubeVideo(host, props) {
	const { fetched, pending } = useFetch(host, props, "YouTube video");
	useEffect(host, () => {
		host.dataset.meowdownEmbed = "youtube";
		const container = getRootContainer(host);
		const data = props.data.get() ?? fetched.get();
		const playback = props.playback.get() === "inline" ? "inline" : "link";
		const result = data == null ? void 0 : parseYouTubeVideo(data);
		if (result?.issues) console.error("[meowdown] Invalid YouTube video data:", result.issues);
		const ref = result && !result.issues ? parseYouTubeUrl(result.value.url) : void 0;
		container.replaceChildren(result && !result.issues && ref ? renderVideo(result.value, ref, playback) : renderFallback(pending.get()));
	});
}
function renderFallback(pending) {
	return el("article", pending ? {
		"data-fallback": "",
		"data-pending": ""
	} : { "data-fallback": "" }, el("div", { "data-details": "" }, el("span", { "data-title": "" }, "YouTube video")), el("p", { "data-body": "" }, pending ? "Loading this video…" : "This video is unavailable."), pending ? null : el("footer", { "data-footer": "" }, "No saved video could be displayed."));
}
const YouTubeVideoCustomElement = defineCustomElement(useYouTubeVideo, defineProps({
	data: {
		default: null,
		attribute: false
	},
	url: {
		default: null,
		attribute: false
	},
	resolver: {
		default: null,
		attribute: false
	},
	playback: {
		default: "link",
		attribute: "playback",
		type: "string"
	}
}));

//#endregion
//#region src/youtube/register.ts
function registerYouTubeVideo(name = "meowdown-embed-youtube") {
	registerCustomElement(name, class extends YouTubeVideoCustomElement {});
}

//#endregion
export { YOUTUBE_VIDEO_CLICK, registerYouTubeVideo, useYouTubeVideo };