import { a as useFetch, i as getSafeUrl, n as getRootContainer, r as renderLink, t as isPlainClick } from "../is-plain-click-QDpLdFP7.js";
import { defineCustomElement, defineProps, registerCustomElement, useEffect } from "@aria-ui/core";
import { parseXPost, parseXPostId } from "@post-embed/schema";
import el from "crelt";

//#region src/x/media-click.ts
const X_POST_MEDIA_CLICK = "meowdown-embed-media-click";
/**
* Returns false when a listener called `preventDefault()`: the host shows the
* media itself, so the card must not run its own default.
*/
function dispatchMediaClick(target, detail) {
	return target.dispatchEvent(new CustomEvent(X_POST_MEDIA_CLICK, {
		detail,
		bubbles: true,
		cancelable: true,
		composed: true
	}));
}

//#endregion
//#region src/x/render-author.ts
function renderAuthor(author, protocols, date) {
	if (!author.name && !author.handle) return;
	const validHandle = /^\w{1,15}$/.test(author.handle);
	const avatar = author.avatar && getSafeUrl(author.avatar, protocols);
	return el("header", { "data-author": "" }, avatar ? el("img", {
		"data-avatar": "",
		"data-shape": author.avatarShape,
		src: avatar,
		alt: "",
		width: 48,
		height: 48,
		loading: "lazy",
		decoding: "async",
		referrerpolicy: "no-referrer"
	}) : void 0, el("div", { "data-author-details": "" }, el("div", { "data-author-name": "" }, el("bdi", {}, author.name || author.handle)), author.handle ? el("bdi", {}, renderLink(`@${author.handle}`, validHandle ? `https://x.com/${author.handle}` : void 0)) : void 0), date ? el("span", { "data-date": "" }, date) : void 0);
}

//#endregion
//#region src/to-positive-number.ts
/**
* The value rounded to an integer, or nothing unless it is a finite number
* above zero.
*/
function toPositiveNumber(value) {
	if (typeof value === "number" && Number.isFinite(value) && value > 0) return Math.round(value);
}

//#endregion
//#region src/x/sort-video-sources.ts
/**
* Orders the sources the way a `<video>` should try them: it plays the first
* `<source>` it supports, so MP4 files come before HLS playlists (which only
* Safari plays natively), and within a type the highest bitrate comes first.
* A source without a bitrate counts as 0. Returns a new array.
*/
function sortVideoSources(sources) {
	return [...sources].sort((a, b) => {
		return Number(b.type === "video/mp4") - Number(a.type === "video/mp4") || (b.bitrate || 0) - (a.bitrate || 0);
	});
}

//#endregion
//#region src/x/render-media.ts
function getSizeAttrs(media) {
	return {
		width: toPositiveNumber(media.width),
		height: toPositiveNumber(media.height)
	};
}
function getRatioStyle(media) {
	const { width, height } = getSizeAttrs(media);
	return width && height ? `--_ratio: ${width} / ${height}` : void 0;
}
function getOrientation(media) {
	const width = toPositiveNumber(media.width);
	const height = toPositiveNumber(media.height);
	if (!width || !height) return;
	return height > width * 1.1 ? "portrait" : width > height * 1.1 ? "landscape" : "square";
}
function getSafeMediaUrl(value, protocols) {
	const url = getSafeUrl(value, protocols);
	if (!url) console.warn(`[meowdown] Ignored unsafe media URL: ${value}`);
	return url;
}
/**
* The item with only the URLs the card may load, or nothing when it has none
* left to show.
*/
function getDisplayable(media, protocols) {
	if (media.unavailable) return;
	if (media.type === "photo") {
		const url = getSafeMediaUrl(media.url, protocols);
		return url ? {
			...media,
			url
		} : void 0;
	}
	const sources = sortVideoSources(media.sources.flatMap((source) => {
		const url = getSafeMediaUrl(source.url, protocols);
		return url ? [{
			...source,
			url
		}] : [];
	}));
	if (sources.length === 0) return;
	const poster = media.poster && getSafeMediaUrl(media.poster, protocols);
	return {
		...media,
		sources,
		poster
	};
}
function renderUnavailable(permalink) {
	return el("div", { "data-media-unavailable": "" }, "Media unavailable. ", renderLink("View on X", permalink));
}
function renderError(permalink) {
	return el("div", {
		"data-media-error": "",
		hidden: true
	}, "Media could not be loaded. ", renderLink("View on X", permalink));
}
function renderPhoto(media, error, onClick) {
	const image = el("img", {
		src: media.url,
		alt: media.alt || "Post image",
		...getSizeAttrs(media),
		loading: "lazy",
		decoding: "async",
		referrerpolicy: "no-referrer"
	});
	const link = el("a", {
		href: media.url,
		target: "_blank",
		rel: "noopener noreferrer"
	}, image);
	image.addEventListener("error", () => {
		link.hidden = true;
		error.hidden = false;
	});
	link.addEventListener("click", (event) => {
		if (isPlainClick(event) && !onClick(image)) event.preventDefault();
	});
	return link;
}
function renderPlayer(media, error, permalink) {
	const gif = media.type === "gif";
	const sources = media.sources.map((source) => {
		return el("source", {
			src: source.url,
			type: source.type
		});
	});
	const video = el("video", {
		controls: true,
		playsInline: true,
		"aria-label": gif ? "Animated GIF" : "Post video",
		poster: media.poster,
		...getSizeAttrs(media),
		loop: gif
	}, sources, renderLink("Watch on X", permalink));
	video.muted = gif;
	const showError = () => {
		video.hidden = true;
		error.hidden = false;
	};
	video.addEventListener("error", showError);
	let failedSources = 0;
	for (const source of sources) source.addEventListener("error", () => {
		failedSources++;
		if (failedSources === sources.length) showError();
	}, { once: true });
	return video;
}
/**
* A poster button. Its click plays the video in place, unless a
* `meowdown-embed-media-click` listener takes over.
*/
function renderVideo(media, error, onClick, permalink) {
	const gif = media.type === "gif";
	const poster = media.poster ? el("img", {
		src: media.poster,
		alt: "",
		...getSizeAttrs(media),
		loading: "lazy",
		decoding: "async",
		referrerpolicy: "no-referrer"
	}) : void 0;
	const button = el("button", {
		"data-poster": "",
		type: "button",
		"aria-label": gif ? "Play GIF" : "Play video"
	}, poster, el("span", {
		"data-play": "",
		"aria-hidden": "true"
	}));
	button.addEventListener("click", () => {
		if (!onClick(poster ?? button)) return;
		const video = renderPlayer(media, error, permalink);
		button.replaceWith(video);
		video.focus();
		video.play().catch(() => {});
	});
	return button;
}
function renderMedia(media, protocols, permalink) {
	if (!media?.length) return;
	const displayable = media.map((item) => getDisplayable(item, protocols));
	const items = displayable.filter((item) => item != null);
	return el("div", {
		"data-media": "",
		"data-count": String(media.length)
	}, displayable.map((item) => {
		if (!item) return renderUnavailable(permalink);
		const error = renderError(permalink);
		const onClick = (element) => {
			return dispatchMediaClick(element, {
				media: item,
				items,
				index: items.indexOf(item),
				element
			});
		};
		return el("div", {
			"data-media-item": "",
			"data-type": item.type,
			"data-orientation": getOrientation(item),
			style: getRatioStyle(item)
		}, item.type === "photo" ? renderPhoto(item, error, onClick) : renderVideo(item, error, onClick, permalink), error);
	}));
}

//#endregion
//#region src/x/render-shared.ts
function getPermalink(post) {
	return /^\w{1,15}$/.test(post.author.handle) && /^\d+$/.test(post.id) ? `https://x.com/${post.author.handle}/status/${post.id}` : void 0;
}
/**
* The post date as a permalink: month and day, plus the year when it is not
* the current one. The full date and time are the tooltip.
*/
function renderDate(post) {
	const date = new Date(post.createdAt);
	if (!Number.isFinite(date.getTime())) return;
	const sameYear = date.getFullYear() === (/* @__PURE__ */ new Date()).getFullYear();
	return renderLink(el("time", {
		datetime: date.toISOString(),
		title: new Intl.DateTimeFormat(void 0, {
			dateStyle: "medium",
			timeStyle: "short"
		}).format(date)
	}, new Intl.DateTimeFormat(void 0, {
		month: "short",
		day: "numeric",
		year: sameYear ? void 0 : "numeric"
	}).format(date)), getPermalink(post));
}

//#endregion
//#region src/x/render-post.ts
function renderBody(post, collapseBlankLines = false) {
	const permalink = getPermalink(post);
	return el("p", {
		"data-body": "",
		dir: "auto",
		lang: post.lang || void 0
	}, el("span", { "data-text": "" }, post.body.map((segment) => {
		return segment.type === "link" ? renderLink(segment.text, segment.url) : segment.text.split(collapseBlankLines ? /\n+/ : "\n").map((line, index) => {
			return [index ? el("br", {}) : void 0, line];
		});
	})), post.truncated && permalink ? [" ", renderLink("Show more", permalink)] : void 0);
}
function renderEdit(post) {
	const edited = post.edit === "stale" ? el("span", { "data-edited": "" }, "This is an earlier version. ", renderLink("View latest", getPermalink(post))) : post.edit === "edited" ? el("span", { "data-edited": "" }, "Edited") : void 0;
	return edited ? el("footer", { "data-footer": "" }, edited) : void 0;
}
function renderQuoted(post, protocols) {
	return el("article", {
		"data-quoted": "",
		"aria-label": "Quoted post"
	}, renderAuthor(post.author, protocols, renderDate(post)), renderBody(post, true), renderMedia(post.media, protocols, getPermalink(post)), renderEdit(post));
}
function renderPost(post, protocols = null) {
	const reply = post.replyTo;
	const replyUrl = reply && /^\w{1,15}$/.test(reply.handle) && /^\d+$/.test(reply.id) ? `https://x.com/${reply.handle}/status/${reply.id}` : void 0;
	return el("article", {}, renderAuthor(post.author, protocols, renderDate(post)), reply ? el("div", { "data-reply-to": "" }, renderLink(`Replying to @${reply.handle}`, replyUrl)) : void 0, renderBody(post), renderMedia(post.media, protocols, getPermalink(post)), post.quote ? renderQuoted(post.quote, protocols) : void 0, renderEdit(post));
}

//#endregion
//#region src/x/x-post.ts
/** @internal */
function useXPost(host, props) {
	const { fetched, pending } = useFetch(host, props, "X post");
	useEffect(host, () => {
		host.dataset.meowdownEmbed = "x";
		const container = getRootContainer(host);
		const data = props.data.get() ?? fetched.get();
		const result = data == null ? void 0 : parseXPost(data);
		if (result?.issues) console.error("[meowdown] Invalid X post data:", result.issues);
		const protocols = props.mediaUrlProtocols.get();
		const url = props.url.get();
		const value = result && !result.issues ? result.value : void 0;
		const valid = value && (props.data.get() != null || !url || parseXPostId(url) === value.id);
		container.replaceChildren(valid ? renderPost(value, protocols) : renderFallback(pending.get(), url));
		return () => {
			for (const video of container.querySelectorAll("video")) video.pause();
		};
	});
}
function renderFallback(pending, url) {
	const permalink = url != null && parseXPostId(url) ? url : void 0;
	return el("article", pending ? {
		"data-fallback": "",
		"data-pending": ""
	} : { "data-fallback": "" }, el("header", { "data-author": "" }, el("bdi", {}, "X post")), el("p", { "data-body": "" }, pending ? "Loading this post…" : "This post is unavailable."), pending ? null : el("footer", { "data-footer": "" }, permalink ? renderLink("View on X", permalink) : "No saved post could be displayed."));
}
const XPost = defineCustomElement(useXPost, defineProps({
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
	mediaUrlProtocols: {
		default: null,
		attribute: false
	}
}));

//#endregion
//#region src/x/register.ts
function registerXPost(name = "meowdown-embed-x") {
	registerCustomElement(name, class extends XPost {});
}

//#endregion
export { X_POST_MEDIA_CLICK, registerXPost, useXPost };