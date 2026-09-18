import { EmbedGallery, type EmbedGalleryProps } from './embed-gallery.tsx'

export default {
  component: EmbedGallery,
}

export const X = { args: { kind: 'x' } satisfies EmbedGalleryProps }

export const YouTube = { args: { kind: 'youtube' } satisfies EmbedGalleryProps }
