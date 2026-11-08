import { describe, it } from 'vitest'
import './theme.css'
import { createPost } from './testing/fixtures.ts'
import { registerXPost } from './index.ts'
registerXPost()

describe('probe', () => {
  it('probe', async () => {
    const text = Array.from({ length: 20 }, (_, i) => `Line ${i + 1}`).join('\n')
    const snapshot = createPost(text)
    delete snapshot.author.avatar
    const element = document.createElement('meowdown-embed-x')
    element.style.setProperty('--meowdown-embed-max-height', '300px')
    element.data = snapshot
    document.body.append(element)
    await new Promise((resolve) => setTimeout(resolve, 1000))
    const article = element.querySelector('article')!
    const toggle = element.querySelector('[data-show-more]')!
    const style = getComputedStyle(article)
    console.info(JSON.stringify({
      ua: navigator.userAgent,
      sda: CSS.supports('animation-timeline: scroll()'),
      styleQuery: CSS.supports('container-type: normal'),
      overflowing: style.getPropertyValue('--_overflowing'),
      maxHeight: style.maxHeight,
      overflow: style.overflow,
      animationName: style.animationName,
      animationTimeline: style.getPropertyValue('animation-timeline'),
      scrollH: article.scrollHeight, clientH: article.clientHeight,
      anims: article.getAnimations().map((a) => ({ state: a.playState, time: String(a.currentTime), tl: a.timeline?.constructor.name })),
      toggleDisplay: getComputedStyle(toggle).display,
      styleQueryWorks: (() => {
        const outer = document.createElement('div')
        outer.style.setProperty('--probe', '1')
        const inner = document.createElement('div')
        outer.append(inner)
        const sheet = document.createElement('style')
        sheet.textContent = '@container style(--probe: 1) { .probe-inner { color: rgb(1, 2, 3) } }'
        inner.className = 'probe-inner'
        document.head.append(sheet)
        document.body.append(outer)
        return getComputedStyle(inner).color
      })(),
      registeredStyleQuery: (() => {
        const sheet = document.createElement('style')
        sheet.textContent = '@container style(--_overflowing: 0) { [data-content] { outline-color: rgb(4, 5, 6) } }'
        document.head.append(sheet)
        return getComputedStyle(element.querySelector('[data-content]')!).outlineColor
      })(),
      toggleProbe: (() => {
        const sheet = document.createElement('style')
        sheet.textContent = `
          @container style(--_overflowing: 1) { [data-show-more] { outline-color: rgb(7, 8, 9) } }
          @container style(--_overflowing: 1) { [data-show-more] > summary { outline-color: rgb(7, 8, 9) } }
          @container style(--_overflowing: 1) { [data-content] + * { border-top-color: rgb(9, 9, 9) } }
          .probe-plain [data-show-more] { border-left-color: rgb(3, 3, 3) }
        `
        document.head.append(sheet)
        element.classList.add('probe-plain')
        const cs = getComputedStyle(toggle)
        return {
          tag: toggle.tagName,
          parentTag: toggle.parentElement?.tagName,
          prevSibling: toggle.previousElementSibling?.getAttribute('data-content') != null ? 'content' : toggle.previousElementSibling?.outerHTML.slice(0, 60),
          outline: cs.outlineColor,
          border: cs.borderTopColor,
          plain: cs.borderLeftColor,
          summaryOutline: getComputedStyle(toggle.querySelector('summary')!).outlineColor,
          position: cs.position,
          overflowingOnToggle: cs.getPropertyValue('--_overflowing'),
          containerType: getComputedStyle(article).containerType,
          rules: [...document.styleSheets].flatMap((sheet) => { try { return [...sheet.cssRules] } catch { return [] } }).length,
        }
      })(),
      contentMask: getComputedStyle(element.querySelector('[data-content]')!).maskImage,
    }, null, 2))
  })
})
