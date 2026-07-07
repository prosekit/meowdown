import { describe, expect, it } from 'vitest'

import { attributesToProps } from './attributes-to-props.ts'

describe('attributesToProps', () => {
  it('returns an empty object when called without attributes', () => {
    expect(attributesToProps()).toEqual({})
    expect(attributesToProps({})).toEqual({})
  })

  it('converts HTML attribute names to React prop names', () => {
    expect(attributesToProps({ class: 'note', for: 'field', tabindex: '0' })).toEqual({
      className: 'note',
      htmlFor: 'field',
      tabIndex: '0',
    })
  })

  it('matches attribute names case-insensitively', () => {
    expect(attributesToProps({ CLASS: 'note' })).toEqual({ className: 'note' })
  })

  it('converts SVG attribute names to React prop names', () => {
    expect(attributesToProps({ viewbox: '0 0 24 24', 'stroke-width': '2' })).toEqual({
      viewBox: '0 0 24 24',
      strokeWidth: '2',
    })
  })

  it('keeps aria attributes unchanged', () => {
    expect(attributesToProps({ 'aria-label': 'Close' })).toEqual({ 'aria-label': 'Close' })
  })

  it('keeps data attributes unchanged', () => {
    expect(attributesToProps({ 'data-testid': 'checkbox' })).toEqual({ 'data-testid': 'checkbox' })
  })

  it('ignores the style attribute', () => {
    expect(attributesToProps({ style: 'color: red', class: 'note' })).toEqual({
      className: 'note',
    })
  })

  it('keeps unknown attributes unchanged', () => {
    expect(attributesToProps({ unknownattribute: 'yes' })).toEqual({ unknownattribute: 'yes' })
  })

  it('converts boolean attributes to true', () => {
    expect(attributesToProps({ disabled: '' })).toEqual({ disabled: true })
    expect(attributesToProps({ disabled: 'disabled' })).toEqual({ disabled: true })
  })

  it('converts overloaded boolean attributes to true only when empty', () => {
    expect(attributesToProps({ download: '' })).toEqual({ download: true })
    expect(attributesToProps({ download: 'archive.zip' })).toEqual({ download: 'archive.zip' })
  })

  it('keeps checked on an input element', () => {
    expect(attributesToProps({ type: 'checkbox', checked: '' }, 'input')).toEqual({
      type: 'checkbox',
      checked: true,
    })
  })

  it('keeps value on an input element', () => {
    expect(attributesToProps({ type: 'text', value: 'hello' }, 'input')).toEqual({
      type: 'text',
      value: 'hello',
    })
  })

  it('converts value to defaultValue on a textarea element', () => {
    expect(attributesToProps({ value: 'hello' }, 'textarea')).toEqual({ defaultValue: 'hello' })
  })

  it('converts value to defaultValue on a select element', () => {
    expect(attributesToProps({ value: 'apple' }, 'select')).toEqual({ defaultValue: 'apple' })
  })

  it('keeps value on elements that are not form controls', () => {
    expect(attributesToProps({ value: '5' }, 'li')).toEqual({ value: '5' })
  })
})
