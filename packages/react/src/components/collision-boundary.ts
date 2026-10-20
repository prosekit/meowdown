import type { Popover } from '@base-ui/react/popover'
import { createContext } from 'react'

/**
 * The area the editor's floating menus and popovers stay inside. Same as the
 * `collisionBoundary` prop of Base UI positioners.
 */
export type CollisionBoundary = NonNullable<Popover.Positioner.Props['collisionBoundary']>

/**
 * See `EditorProps.collisionBoundary`.
 */
export const CollisionBoundaryContext = createContext<CollisionBoundary | undefined>(undefined)

/**
 * Converts a {@link CollisionBoundary} to the `boundary` prop of ProseKit
 * positioners, which spell the keyword the floating-ui way.
 */
export function toFloatingBoundary(boundary: CollisionBoundary | undefined) {
  // Same conversion as Base UI:
  // https://github.com/mui/base-ui/blob/v1.9.0/packages/react/src/internals/useAnchorPositioning.ts#L242
  return boundary === 'clipping-ancestors' ? 'clippingAncestors' : boundary
}
