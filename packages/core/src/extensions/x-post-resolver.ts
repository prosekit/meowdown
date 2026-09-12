import type { Tweet } from '@post-embed/types'

/**
 * Resolve the saved data for an X post URL, directly or as a promise. A
 * synchronous answer renders in the same frame as the document; a promise
 * reserves the persisted height until it settles. Return `undefined` when the
 * host has no snapshot: the embed then falls back to the provider iframe.
 * Called once per rendered embed, so cache in the host.
 */
export type XPostResolver = (url: string) => Tweet | undefined | Promise<Tweet | undefined>
