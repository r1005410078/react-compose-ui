import { describe, expect, it } from 'vitest'
import {
  createVisibleGridAxis,
  createVisualGridStyle,
} from './grid-rendering'

describe('Godot-style low-zoom grid rendering', () => {
  it.each([
    { zoom: 1, stride: 1, worldStep: 8, screenStep: 8 },
    { zoom: 0.75, stride: 1, worldStep: 8, screenStep: 6 },
    { zoom: 0.25, stride: 1, worldStep: 8, screenStep: 2 },
    { zoom: 0.1, stride: 4, worldStep: 32, screenStep: 3.2 },
  ])(
    'keeps the configured 8-unit grid visible at zoom $zoom',
    ({ zoom, stride, worldStep, screenStep }) => {
      expect(createVisibleGridAxis({
        step: 8,
        offset: 0,
        viewportOffset: 0,
        zoom,
      })).toEqual({
        stride,
        worldStep,
        screenStep,
        screenOffset: 0,
      })
    },
  )

  it('normalizes positive and negative translations without changing the world lattice', () => {
    const axis = createVisibleGridAxis({
      step: 8,
      offset: -3,
      viewportOffset: -10,
      zoom: 0.25,
    })

    expect(axis).toEqual({
      stride: 1,
      worldStep: 8,
      screenStep: 2,
      screenOffset: 1.25,
    })
    for (const index of [-3, -1, 0, 2, 5]) {
      const worldLine = -3 + index * axis.worldStep
      expect((worldLine - -3) / 8).toBe(index * axis.stride)
    }
  })

  it('calculates X/Y and primary/minor layers independently with primary lines on top', () => {
    const style = createVisualGridStyle({
      stepX: 8,
      stepY: 10,
      offsetX: 0,
      offsetY: 0,
      primaryLineEvery: 8,
      snapEnabled: true,
    }, {
      x: 0,
      y: 0,
      zoom: 0.25,
    })

    expect(style.backgroundSize).toBe(
      '16px 100%, 100% 20px, 2px 100%, 100% 2.5px',
    )
    expect(style.backgroundImage.indexOf('--compose-stage-grid-primary'))
      .toBeLessThan(style.backgroundImage.indexOf('--compose-stage-grid-minor'))
  })

  it('only coalesces to power-of-two subsets of configured grid and primary lines', () => {
    const minor = createVisibleGridAxis({
      step: 8,
      offset: 5,
      viewportOffset: 17,
      zoom: 0.1,
    })
    const primary = createVisibleGridAxis({
      step: 24,
      offset: 5,
      viewportOffset: 17,
      zoom: 0.1,
    })

    expect(minor.stride).toBe(4)
    expect(primary.stride).toBe(1)
    expect(Number.isInteger(Math.log2(minor.stride))).toBe(true)
    expect(Number.isInteger(Math.log2(primary.stride))).toBe(true)
    expect(Number.isInteger(minor.worldStep / 8)).toBe(true)
    expect(Number.isInteger(primary.worldStep / 8)).toBe(true)
    expect(minor.screenOffset).toBeGreaterThanOrEqual(0)
    expect(minor.screenOffset).toBeLessThan(minor.screenStep)
  })
})
