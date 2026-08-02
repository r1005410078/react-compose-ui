import {
  BUILTIN_COMMAND_TYPES,
  createComposeBatchCommand,
  createDefaultComposeFlexLayout,
  getComposeComposition,
  getComposeHierarchy,
  getComposeLayout,
  getComposeLayoutItem,
  getComposeLock,
  resolveComposeAppearance,
  type ComposeAxisSizing,
  type ComposeDocument,
  type ComposeEntity,
  type ComposeLayoutItem,
  type ComposeLayoutSnapshot,
  type EditorCommand,
  type JsonObject,
} from '@compose-ui/core'

/** Auto Layout 模式命令规划失败。 @internal */
export interface ComposeAutoLayoutPlanIssue {
  readonly code:
    | 'layout.entity-missing'
    | 'layout.hierarchy-missing'
    | 'layout.already-enabled'
    | 'layout.not-enabled'
    | 'layout.entity-locked'
    | 'layout.child-missing'
    | 'layout.child-locked'
    | 'layout.snapshot-missing'
    | 'layout.box-missing'
  readonly message: string
}

/** Auto Layout 模式的原子命令规划结果。 @internal */
export type ComposeAutoLayoutPlanResult =
  | { readonly ok: true; readonly command: EditorCommand }
  | { readonly ok: false; readonly issue: ComposeAutoLayoutPlanIssue }

function failure(
  code: ComposeAutoLayoutPlanIssue['code'],
  message: string,
): ComposeAutoLayoutPlanResult {
  return { ok: false, issue: { code, message } }
}

function componentCommand(
  idFactory: () => string,
  type: string,
  entityId: string,
  key: string,
  value?: JsonObject,
): EditorCommand {
  return {
    id: idFactory(),
    type,
    payload: {
      entityId,
      key,
      ...(value ? { value } : {}),
    },
  }
}

function updateLayoutItemCommand(
  idFactory: () => string,
  entity: ComposeEntity,
  value: ComposeLayoutItem,
): EditorCommand {
  return componentCommand(
    idFactory,
    BUILTIN_COMMAND_TYPES.updateComponent,
    entity.id,
    'LayoutItem',
    value as unknown as JsonObject,
  )
}

/**
 * 添加默认 Auto Layout，并把当前全部直接子项转为 Flow。
 *
 * @internal
 */
export function planEnableComposeAutoLayout(
  document: ComposeDocument,
  entityId: string,
  idFactory: () => string,
): ComposeAutoLayoutPlanResult {
  const entity = document.entities[entityId]
  if (!entity) return failure('layout.entity-missing', `Entity ${entityId} 不存在`)
  const hierarchy = getComposeHierarchy(entity)
  if (!hierarchy) return failure('layout.hierarchy-missing', '只有容器可以启用自动布局')
  if (getComposeLayout(entity)) return failure('layout.already-enabled', '自动布局已经启用')
  if (getComposeLock(entity).locked) return failure('layout.entity-locked', '锁定容器不能启用自动布局')

  const children: ComposeEntity[] = []
  for (const childId of hierarchy.childIds) {
    const child = document.entities[childId]
    if (!child) return failure('layout.child-missing', `直接子项 ${childId} 不存在`)
    if (getComposeLock(child).locked) {
      return failure('layout.child-locked', `直接子项 ${child.name} 已锁定`)
    }
    children.push(child)
  }

  const commands: EditorCommand[] = [componentCommand(
    idFactory,
    BUILTIN_COMMAND_TYPES.addComponent,
    entity.id,
    'Layout',
    createDefaultComposeFlexLayout() as unknown as JsonObject,
  )]
  for (const child of children) {
    const item = getComposeLayoutItem(child)
    if (item.positioning === 'flow') continue
    commands.push(updateLayoutItemCommand(idFactory, child, {
      ...item,
      positioning: 'flow',
    }))
  }
  return {
    ok: true,
    command: createComposeBatchCommand({
      id: idFactory(),
      commands,
      meta: {
        label: `为 ${entity.name} 启用自动布局`,
        source: 'inspector',
        targetIds: [entity.id, ...hierarchy.childIds],
      },
    }),
  }
}

function bakeFixedSizing(
  sizing: ComposeAxisSizing,
  value: number,
): ComposeAxisSizing {
  return sizing.mode === 'fixed' ? sizing : { ...sizing, mode: 'fixed', value }
}

/**
 * 移除 Auto Layout，并把布局结果烘焙为自由布局所需的持久化几何。
 *
 * @internal
 */
export function planRemoveComposeAutoLayout(
  document: ComposeDocument,
  entityId: string,
  snapshot: ComposeLayoutSnapshot | undefined,
  idFactory: () => string,
): ComposeAutoLayoutPlanResult {
  const entity = document.entities[entityId]
  if (!entity) return failure('layout.entity-missing', `Entity ${entityId} 不存在`)
  const hierarchy = getComposeHierarchy(entity)
  if (!hierarchy) return failure('layout.hierarchy-missing', '当前 Entity 不是容器')
  if (!getComposeLayout(entity)) return failure('layout.not-enabled', '自动布局尚未启用')
  if (getComposeLock(entity).locked) return failure('layout.entity-locked', '锁定容器不能移除自动布局')
  if (!snapshot) return failure('layout.snapshot-missing', '布局结果尚未就绪')
  const parentBox = snapshot.boxes[entity.id]
  if (!parentBox) return failure('layout.box-missing', `缺少 ${entity.name} 的布局结果`)

  const flowChildren: Array<{
    readonly entity: ComposeEntity
    readonly box: NonNullable<ComposeLayoutSnapshot['boxes'][string]>
  }> = []
  for (const childId of hierarchy.childIds) {
    const child = document.entities[childId]
    if (!child) return failure('layout.child-missing', `直接子项 ${childId} 不存在`)
    const item = getComposeLayoutItem(child)
    if (item.positioning !== 'flow') continue
    if (getComposeLock(child).locked) {
      return failure('layout.child-locked', `直接子项 ${child.name} 已锁定`)
    }
    const box = snapshot.boxes[childId]
    if (!box) return failure('layout.box-missing', `缺少直接子项 ${child.name} 的布局结果`)
    flowChildren.push({ entity: child, box })
  }

  const commands: EditorCommand[] = []
  const borderWidth = resolveComposeAppearance(entity).borderWidth
  for (const child of flowChildren) {
    const item = getComposeLayoutItem(child.entity)
    commands.push(updateLayoutItemCommand(idFactory, child.entity, {
      ...item,
      positioning: 'absolute',
      offset: {
        x: child.box.x - borderWidth,
        y: child.box.y - borderWidth,
      },
      width: item.width.mode === 'fill'
        ? bakeFixedSizing(item.width, child.box.width)
        : item.width,
      height: item.height.mode === 'fill'
        ? bakeFixedSizing(item.height, child.box.height)
        : item.height,
    }))
  }

  const parentItem = getComposeLayoutItem(entity)
  if (parentItem.width.mode === 'hug' || parentItem.height.mode === 'hug') {
    commands.push(updateLayoutItemCommand(idFactory, entity, {
      ...parentItem,
      width: parentItem.width.mode === 'hug'
        ? bakeFixedSizing(parentItem.width, parentBox.width)
        : parentItem.width,
      height: parentItem.height.mode === 'hug'
        ? bakeFixedSizing(parentItem.height, parentBox.height)
        : parentItem.height,
    }))
  }

  const composition = getComposeComposition(entity)
  if (composition.baseComponentKeys.includes('Layout')) {
    commands.push(componentCommand(
      idFactory,
      BUILTIN_COMMAND_TYPES.updateComponent,
      entity.id,
      'Composition',
      {
        ...composition,
        baseComponentKeys: composition.baseComponentKeys.filter((key) => key !== 'Layout'),
      },
    ))
  }
  commands.push(componentCommand(
    idFactory,
    BUILTIN_COMMAND_TYPES.removeComponent,
    entity.id,
    'Layout',
  ))

  return {
    ok: true,
    command: createComposeBatchCommand({
      id: idFactory(),
      commands,
      meta: {
        label: `从 ${entity.name} 移除自动布局`,
        source: 'inspector',
        targetIds: [entity.id, ...flowChildren.map(({ entity: child }) => child.id)],
      },
    }),
  }
}
