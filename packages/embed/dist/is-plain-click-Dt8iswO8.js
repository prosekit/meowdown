import { createSignal, useEffect } from "@aria-ui/core";
import el from "crelt";

//#region src/fetch.ts
/**
* Runs `resolver(url)` whenever `data` is `null` and both `url` and `resolver`
* are set, ignoring results that arrive after the inputs changed or the host
* disconnected.
*
* @internal
*/
function useFetch(host, props, label) {
	"use no memo";
	const fetched = createSignal(null);
	const pending = createSignal(false);
	useEffect(host, () => {
		const url = props.url.get();
		const resolver = props.resolver.get();
		fetched.set(null);
		pending.set(false);
		if (props.data.get() != null || !url || !resolver) return;
		let active = true;
		const settle = (value) => {
			if (!active) return;
			fetched.set(value ?? null);
			pending.set(false);
		};
		const fail = (error) => {
			if (!active) return;
			console.error(`[meowdown] Failed to fetch ${label}:`, error);
			settle(void 0);
		};
		let result;
		try {
			result = resolver(url);
		} catch (error) {
			fail(error);
			return;
		}
		if (isPromiseLike(result)) {
			pending.set(true);
			result.then(settle, fail);
		} else settle(result);
		return () => {
			active = false;
		};
	});
	return {
		fetched,
		pending
	};
}
function isPromiseLike(value) {
	return typeof value === "object" && value !== null && typeof value.then === "function";
}

//#endregion
//#region src/safe-url.ts
function getSafeUrl(value, protocols) {
	if (Array.from(value).some((character) => {
		return character.charCodeAt(0) <= 32 || character.charCodeAt(0) === 127;
	})) return;
	try {
		const url = new URL(value);
		if (url.username || url.password) return;
		if (url.protocol === "https:" || url.protocol === "http:" || protocols?.includes(url.protocol)) return url.href;
	} catch {
		return;
	}
}

//#endregion
//#region src/render-link.ts
function renderLink(content, destination) {
	const href = destination && getSafeUrl(destination);
	return href ? el("a", {
		href,
		target: "_blank",
		rel: "noopener noreferrer"
	}, content) : content;
}

//#endregion
//#region src/root.ts
/**
* The direct `<div data-root>` child that holds the rendered snapshot. Reused
* across updates so other children the host appended survive; created on
* first use.
*/
function getRootContainer(host) {
	let container = host.querySelector(":scope > div[data-root]");
	if (!container) {
		container = host.ownerDocument.createElement("div");
		container.dataset.root = "";
		host.append(container);
	}
	return container;
}

//#endregion
//#region src/is-plain-click.ts
function isPlainClick(event) {
	return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
}

//#endregion
export { useFetch as a, getSafeUrl as i, getRootContainer as n, renderLink as r, isPlainClick as t };