import { describe, expect, it } from 'vitest'
import { sanitizeSvg } from './sanitize'

const passthrough = {
  overrideFill: false,
  fillColor: '#000000',
  overrideStroke: false,
  strokeColor: '#ffffff',
} as const

function parse(markup: string) {
  return new DOMParser().parseFromString(markup, 'image/svg+xml').documentElement
}

describe('sanitizeSvg', () => {
  /*
   * 判别性在于 `fill`：只断言「stroke 还在」的用例，在一个仍然丢掉 `fill:none` 的实现上同样
   * 会绿，而丢掉 `fill:none` 正是整张图变成黑色剪影的那一步——SVG 的 `fill` 默认值是黑色。
   */
  it('把 <style> 里的 class 求值成元素自己的呈现属性', () => {
    const clean = parse(sanitizeSvg(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10">'
      + '<style>.pri{fill:none;stroke:#ff3b30;stroke-width:2}</style>'
      + '<rect class="pri" x="1" y="1" width="8" height="8"/>'
      + '</svg>',
      passthrough,
    ))
    const rect = clean.querySelector('rect')!
    expect(rect.getAttribute('fill')).toBe('none')
    expect(rect.getAttribute('stroke')).toBe('#ff3b30')
    expect(rect.getAttribute('stroke-width')).toBe('2')
    // `<style>` 本身仍然被删掉：求值只是把墨色搬到元素上，没有放宽安全边界。
    expect(clean.querySelector('style')).toBeNull()
  })

  it('class 压过标签规则，内联 style 压过两者', () => {
    const clean = parse(sanitizeSvg(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10">'
      + '<style>.a{fill:#00ff00}text{fill:#0000ff}</style>'
      + '<text class="a" x="0" y="5">a</text>'
      + '<text class="a" x="0" y="9" style="fill:#123456">b</text>'
      + '</svg>',
      passthrough,
    ))
    const [first, second] = [...clean.querySelectorAll('text')]
    // 标签规则写在 class 规则**后面**：按源码次序会是蓝色，按特异性才是绿色。
    expect(first!.getAttribute('fill')).toBe('#00ff00')
    expect(second!.getAttribute('fill')).toBe('#123456')
    expect(second!.getAttribute('style')).toBeNull()
  })

  it('求值出来的 url() 引用照旧被清洗掉', () => {
    const clean = parse(sanitizeSvg(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10">'
      + '<style>.leak{fill:url(https://example.com/x.svg#g)}</style>'
      + '<rect class="leak" x="1" y="1" width="8" height="8"/>'
      + '</svg>',
      passthrough,
    ))
    expect(clean.querySelector('rect')!.getAttribute('fill')).toBeNull()
  })

  it('不合法的选择器只跳过它自己', () => {
    const clean = parse(sanitizeSvg(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10">'
      + '<style>.a{{fill:#ff0000}.b{fill:#00ff00}</style>'
      + '<rect class="b" x="1" y="1" width="8" height="8"/>'
      + '</svg>',
      passthrough,
    ))
    expect(clean.querySelector('rect')!.getAttribute('fill')).toBe('#00ff00')
  })

  it('求值后的 fill:none 不被描边覆盖改写', () => {
    const clean = parse(sanitizeSvg(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10">'
      + '<style>.pri{fill:none;stroke:#ff3b30}</style>'
      + '<rect class="pri" x="1" y="1" width="8" height="8"/>'
      + '</svg>',
      { overrideFill: true, fillColor: '#abcdef', overrideStroke: true, strokeColor: '#fedcba' },
    ))
    const rect = clean.querySelector('rect')!
    expect(rect.getAttribute('fill')).toBe('none')
    expect(rect.getAttribute('stroke')).toBe('#fedcba')
  })
})
