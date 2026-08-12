import {
  createDefaultCanvasSettings,
  createDefaultOutputSettings,
  type ComposeDocument,
  type JsonObject,
} from '@compose-ui/core'
import { describe, expect, it } from 'vitest'
import { COMPONENT_INSTANCE_RENDERER_MEASUREMENT } from './measurement'

function atMost(value: number) {
  return { mode: 'at-most' as const, value }
}

function exactly(value: number) {
  return { mode: 'exactly' as const, value }
}

function measureInput(
  props: JsonObject,
  width: { mode: 'exactly' | 'at-most' | 'undefined'; value: number },
  height: { mode: 'exactly' | 'at-most' | 'undefined'; value: number },
) {
  return {
    entity: { id: 'instance', name: 'I', components: {} },
    renderer: { type: 'component-instance', props },
    authoredProps: props,
    prepared: props,
    props,
    width,
    height,
  } as Parameters<typeof COMPONENT_INSTANCE_RENDERER_MEASUREMENT.measure>[0]
}

function snapshotDocument(size: { width: number; height: number }): ComposeDocument {
  return {
    schemaVersion: 6,
    canvas: createDefaultCanvasSettings(),
    output: {
      ...createDefaultOutputSettings(),
      width: size.width,
      height: size.height,
    },
    rootIds: ['root'],
    entities: {
      root: {
        id: 'root',
        name: 'Root',
        components: {
          Composition: {
            presetId: 'rectangle',
            baseComponentKeys: ['Transform', 'LayoutItem', 'Visibility', 'Lock', 'Renderer'],
            capabilityIds: [],
          },
          Transform: { rotation: 0 },
          LayoutItem: {
            positioning: 'absolute',
            offset: { x: 0, y: 0 },
            width: { mode: 'fixed', value: size.width, min: 1, max: null },
            height: { mode: 'fixed', value: size.height, min: 1, max: null },
            margin: { top: 0, right: 0, bottom: 0, left: 0 },
            alignSelf: 'auto',
          },
          Visibility: { visible: true },
          Lock: { locked: false },
          Renderer: { type: 'rectangle', props: {} },
        },
      },
    },
  }
}

describe('COMPONENT_INSTANCE_RENDERER_MEASUREMENT', () => {
  it('无覆盖时用快照根尺寸', () => {
    const props = {
      resolvedSnapshot: {
        componentId: 'c',
        kind: 'base',
        revision: '1',
        document: snapshotDocument({ width: 120, height: 80 }),
        appliedLineage: [],
      },
      instanceOverrides: { operations: [] },
    } as unknown as JsonObject
    expect(COMPONENT_INSTANCE_RENDERER_MEASUREMENT.measure(
      measureInput(props, atMost(1000), atMost(1000)),
    )).toEqual({ width: 120, height: 80 })
  })

  it('有根尺寸覆盖时测量覆盖后的根，而不是原始 output', () => {
    const document = snapshotDocument({ width: 120, height: 80 })
    const props = {
      resolvedSnapshot: {
        componentId: 'c',
        kind: 'base',
        revision: '1',
        document,
        appliedLineage: [],
      },
      instanceOverrides: {
        operations: [
          {
            id: 'resize-w',
            kind: 'set-field',
            entityId: 'root',
            componentKey: 'LayoutItem',
            fieldPath: ['width', 'value'],
            value: 300,
          },
          {
            id: 'resize-h',
            kind: 'set-field',
            entityId: 'root',
            componentKey: 'LayoutItem',
            fieldPath: ['height', 'value'],
            value: 200,
          },
        ],
      },
    } as unknown as JsonObject
    expect(COMPONENT_INSTANCE_RENDERER_MEASUREMENT.measure(
      measureInput(props, atMost(1000), atMost(1000)),
    )).toEqual({ width: 300, height: 200 })
  })

  it('exactly 约束仍按固有尺寸缩放', () => {
    const props = {
      resolvedSnapshot: {
        componentId: 'c',
        kind: 'base',
        revision: '1',
        document: snapshotDocument({ width: 200, height: 100 }),
        appliedLineage: [],
      },
      instanceOverrides: { operations: [] },
    } as unknown as JsonObject
    expect(COMPONENT_INSTANCE_RENDERER_MEASUREMENT.measure(
      measureInput(props, exactly(100), atMost(1000)),
    )).toMatchObject({ width: 100, height: 50 })
  })
})
