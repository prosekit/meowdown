/*

Ported from https://github.com/remarkablemark/html-react-parser/blob/v6.1.4/src/attributes-to-props.ts

License: https://github.com/remarkablemark/html-react-parser/blob/v6.1.4/LICENSE

The MIT License

Copyright (c) 2016 Menglin "Mark" Xu <mark@remarkablemark.org>

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
"Software"), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

*/

import { BOOLEAN, getPropertyInfo, OVERLOADED_BOOLEAN, possibleStandardNames } from 'react-property'

// https://react.dev/learn/sharing-state-between-components#controlled-and-uncontrolled-components
// https://developer.mozilla.org/docs/Web/HTML/Attributes
const UNCONTROLLED_COMPONENT_ATTRIBUTES = ['checked', 'value'] as const
const UNCONTROLLED_COMPONENT_NAMES = ['input', 'select', 'textarea'] as const

type UncontrolledComponentAttributes = (typeof UNCONTROLLED_COMPONENT_ATTRIBUTES)[number]

type UncontrolledComponentNames = (typeof UNCONTROLLED_COMPONENT_NAMES)[number]

/**
 * Converts HTML/SVG DOM attributes to React props.
 *
 * @param attributes - HTML/SVG DOM attributes.
 * @param nodeName - DOM node name.
 * @returns - React props.
 */
export function attributesToProps(
  attributes: Record<string, string | undefined> = {},
  nodeName?: string,
): Record<PropertyKey, string | boolean | number> {
  const props: Record<PropertyKey, string | boolean | number> = {}

  const isInputValueOnly = nodeName === 'input' || !!attributes['reset'] || !!attributes['submit']

  for (const [attributeName, attributeValue] of Object.entries(attributes)) {
    if (attributeValue === undefined) {
      continue
    }

    // convert HTML/SVG attribute to React prop
    const attributeNameLowerCased = attributeName.toLowerCase()

    // Ignore style attribute
    if (attributeNameLowerCased === 'style') {
      continue
    }

    // ARIA (aria-*) or custom data (data-*) attribute
    if (
      attributeNameLowerCased.startsWith('aria-') ||
      attributeNameLowerCased.startsWith('data-')
    ) {
      props[attributeName] = attributeValue
      continue
    }

    let propName = getPropName(attributeNameLowerCased)

    if (propName) {
      const propertyInfo = getPropertyInfo(propName) as { type: number } | undefined

      // convert attribute to uncontrolled component prop (e.g., `value` to `defaultValue`)
      if (
        UNCONTROLLED_COMPONENT_ATTRIBUTES.includes(propName as UncontrolledComponentAttributes) &&
        UNCONTROLLED_COMPONENT_NAMES.includes(nodeName as UncontrolledComponentNames) &&
        !isInputValueOnly
      ) {
        propName = getPropName('default' + attributeNameLowerCased)
      }

      props[propName] = attributeValue

      switch (propertyInfo?.type) {
        case BOOLEAN:
          props[propName] = true
          break
        case OVERLOADED_BOOLEAN:
          if (attributeValue === '') {
            props[propName] = true
          }
          break
      }
      continue
    }

    props[attributeName] = attributeValue
  }

  return props
}

/**
 * Gets prop name from lowercased attribute name.
 *
 * @param attributeName - Lowercased attribute name.
 * @returns - Prop name.
 */
function getPropName(attributeName: string): string {
  return possibleStandardNames[attributeName]
}
