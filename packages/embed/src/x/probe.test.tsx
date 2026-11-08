import { describe, it } from 'vitest'

import './theme.css'
import { registerXPost } from './index.ts'
import { createPost } from './testing/fixtures.ts'

registerXPost()

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

function mountLimited(className: string) {
  const text = Array.from({ length: 20 }, (_, index) => `Line ${index + 1}`).join('\n')
  const snapshot = createPost(text)
  delete snapshot.author.avatar
  const element = document.createElement('meowdown-embed-x')
  element.classList.add(className)
  element.style.setProperty('--meowdown-embed-max-height', '300px')
  element.data = snapshot
  document.body.append(element)
  return element
}

function describeToggle(element: HTMLElement) {
  const toggle = element.querySelector<HTMLElement>('[data-show-more]')!
  const style = getComputedStyle(toggle)
  return `${style.display} ${style.position} h=${toggle.getBoundingClientRect().height}`
}

describe('probe', () => {
  it('probe', async () => {
    const sheet = document.createElement('style')
    sheet.textContent = `
      [data-meowdown-embed='x'].v-plain [data-root] > article > [data-show-more] { display: block }
      @container style(--_overflowing: 1) {
        [data-meowdown-embed='x'].v-container [data-root] > article > [data-show-more] { display: block }
      }
      @container style(--_overflowing: 1) {
        [data-meowdown-embed='x'].v-flex [data-root] > article > [data-show-more] { display: flex }
      }
      [data-meowdown-embed='x'].v-hidden [data-root] > article > [data-show-more] { display: block; visibility: hidden }
      @container style(--_overflowing: 1) {
        [data-meowdown-embed='x'].v-hidden [data-root] > article > [data-show-more] { visibility: visible }
      }
      @keyframes probe-show { from, to { visibility: visible } }
      [data-meowdown-embed='x'].v-anim [data-root] > article { scroll-timeline: --probe-clip block }
      [data-meowdown-embed='x'].v-anim [data-root] > article > [data-show-more] {
        display: block;
        visibility: hidden;
        animation: probe-show linear both;
        animation-timeline: --probe-clip;
      }
      @keyframes probe-show-display { from, to { display: block } }
      [data-meowdown-embed='x'].v-anim-display [data-root] > article { scroll-timeline: --probe-clip2 block }
      [data-meowdown-embed='x'].v-anim-display [data-root] > article > [data-show-more] {
        animation: probe-show-display linear both;
        animation-timeline: --probe-clip2;
      }
    `
    document.head.append(sheet)
    const variants = ['v-base', 'v-plain', 'v-container', 'v-flex', 'v-hidden', 'v-anim', 'v-anim-display']
    const elements = variants.map((name) => mountLimited(name))
    const result: Record<string, string> = {}
    for (const ms of [0, 50, 200, 1000]) {
      await sleep(ms)
      result[`v-base-at-${ms}`] = describeToggle(elements[0])
    }
    elements.forEach((element, i) => {
      result[variants[i]] = describeToggle(element)
    })
    // Force a full restyle of the base card and read again.
    const base = elements[0]
    base.style.width = '401px'
    await sleep(300)
    result['v-base-after-resize'] = describeToggle(base)
    const toggle = base.querySelector<HTMLElement>('[data-show-more]')!
    toggle.style.color = 'red'
    await sleep(100)
    result['v-base-after-inline'] = describeToggle(base)
    const visibility = elements[4].querySelector<HTMLElement>('[data-show-more]')!
    result['v-hidden-visibility'] = getComputedStyle(visibility).visibility
    const baseArticle = elements[0].querySelector('article')!
    const baseToggle = elements[0].querySelector('[data-show-more]')!
    result['v-base-inherited'] = getComputedStyle(baseToggle).getPropertyValue('--_overflowing')
    result['v-base-article'] = getComputedStyle(baseArticle).getPropertyValue('--_overflowing')
    result['v-base-mask'] = getComputedStyle(elements[0].querySelector('[data-content]')!).maskImage
    for (const name of ['v-anim', 'v-anim-display']) {
      const toggle = elements[variants.indexOf(name)].querySelector<HTMLElement>('[data-show-more]')!
      result[`${name}-visibility`] = getComputedStyle(toggle).visibility
    }
    console.info(JSON.stringify(result, null, 2))
  })
})
