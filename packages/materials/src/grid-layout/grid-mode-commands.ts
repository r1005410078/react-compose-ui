/**
 * 网格布局的启用、移除与布局类型切换。
 *
 * @remarks
 * 与 `flex-layout/layout-mode-commands.ts` 是姐妹模块，共用同一条形状：先逐项检查前置条件
 * 并以可定位的 issue 说明失败，再把全部写入攒成**一条** batch。
 * @packageDocumentation
 */

import {
  BUILTIN_COMMAND_TYPES,
  composeGridColumnWidth,
  createComposeBatchCommand,
  createDefaultComposeFlexLayout,
  createDefaultComposeGridLayout,
  getComposeComposition,
  getComposeGridItem,
  getComposeHierarchy,
  getComposeLayout,
  getComposeLayoutItem,
  getComposeLock,
  isComposeGridLayout,
  resolveComposeAppearance,
  solveComposeGrid,
  type ComposeDocument,
  type ComposeEntity,
  type ComposeGridCell,
  type ComposeGridItem,
  type ComposeGridLayout,
  type ComposeLayoutSnapshot,
  type EditorCommand,
  type JsonObject,
} from '@compose-ui/core'

/** 网格模式命令规划失败。 @internal */
export interface ComposeGridLayoutPlanIssue {
  readonly code:
    | 'grid.entity-missing'
    | 'grid.hierarchy-missing'
    | 'grid.already-enabled'
    | 'grid.not-enabled'
    | 'grid.entity-locked'
    | 'grid.child-missing'
    | 'grid.child-locked'
    | 'grid.snapshot-missing'
    | 'grid.box-missing'
    | 'grid.no-children'
  readonly message: string
}

/** 网格模式命令的原子规划结果。 @internal */
export type ComposeGridLayoutPlanResult =
  | { readonly ok: true; readonly command: EditorCommand }
  | { readonly ok: false; readonly issue: ComposeGridLayoutPlanIssue }

function failure(
  code: ComposeGridLayoutPlanIssue['code'],
  message: string,
): ComposeGridLayoutPlanResult {
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
    payload: { entityId, key, ...(value ? { value } : {}) },
  }
}

/** 逐项检查容器与它的直接子项，任一不满足即整条计划失败。 */
function collectChildren(
  document: ComposeDocument,
  hierarchy: { readonly childIds: readonly string[] },
): { readonly ok: true; readonly children: readonly ComposeEntity[] }
  | { readonly ok: false; readonly issue: ComposeGridLayoutPlanIssue } {
  const children: ComposeEntity[] = []
  for (const childId of hierarchy.childIds) {
    const child = document.entities[childId]
    if (!child) {
      return { ok: false, issue: { code: 'grid.child-missing', message: `直接子项 ${childId} 不存在` } }
    }
    if (getComposeLock(child).locked) {
      return { ok: false, issue: { code: 'grid.child-locked', message: `直接子项 ${child.name} 已锁定` } }
    }
    children.push(child)
  }
  return { ok: true, children }
}

/**
 * 按子项当前的**视觉位置与尺寸**算出它最接近的格坐标。
 *
 * @remarks
 * 位置取左上角所在的格（与画布拖动的落点判据一致），跨度按盒尺寸四舍五入到整数格——
 * 位置问「压住了哪一格」，尺寸问「离哪条格线更近」，两者判据不同是有意的。
 *
 * 落格产生的碰撞由**调用方**统一交给求解器解开：逐个落格时解一次会让先落的把后落的推走，
 * 而那个顺序对用户不可见。
 */
function nearestCell(
  id: string,
  box: NonNullable<ComposeLayoutSnapshot['boxes'][string]>,
  origin: { readonly x: number; readonly y: number },
  layout: ComposeGridLayout,
  contentWidth: number,
): ComposeGridCell {
  const columnStep = composeGridColumnWidth({
    columns: layout.columns,
    rowHeight: layout.rowHeight,
    rowGap: layout.rowGap,
    columnGap: layout.columnGap,
    contentWidth,
  }) + layout.columnGap
  const rowStep = layout.rowHeight + layout.rowGap
  const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)
  const w = columnStep > 0
    ? clamp(Math.round((box.width + layout.columnGap) / columnStep), 1, layout.columns)
    : 1
  const h = rowStep > 0 ? Math.max(1, Math.round((box.height + layout.rowGap) / rowStep)) : 1
  return {
    id,
    x: columnStep > 0
      ? clamp(Math.floor((box.x - origin.x) / columnStep), 0, Math.max(0, layout.columns - w))
      : 0,
    y: rowStep > 0 ? Math.max(0, Math.floor((box.y - origin.y) / rowStep)) : 0,
    w,
    h,
  }
}

/** 把一组已解算的格矩形写成 `GridItem` 命令；已有就 update、没有就 add。 */
function gridItemCommands(
  document: ComposeDocument,
  idFactory: () => string,
  cells: readonly ComposeGridCell[],
): readonly EditorCommand[] {
  return cells.map((cell) => {
    const existing = getComposeGridItem(document.entities[cell.id])
    const value: ComposeGridItem = {
      ...(existing ?? {}),
      x: cell.x,
      y: cell.y,
      w: cell.w,
      h: cell.h,
    }
    return componentCommand(
      idFactory,
      existing ? BUILTIN_COMMAND_TYPES.updateComponent : BUILTIN_COMMAND_TYPES.addComponent,
      cell.id,
      'GridItem',
      value as unknown as JsonObject,
    )
  })
}

/**
 * 按容器**当前**的网格参数，把全部直接子项重新就近落格。
 *
 * @remarks
 * 落位是在**启用网格那一刻**从像素推出来的，用的是那一刻的网格参数；而菜单只提供默认网格
 * （12 列 / 行高 48 / 行间距 6 / 内边距 16），行高、间距、内边距都得启用之后再改。
 * 参数一改，先前推出来的格坐标就不再对应作者画出来的版面——而它不会自己重推：
 * 格坐标此后是作者的显式意图，凭参数变化去改写它会把手动摆好的格子冲掉。
 *
 * 这条命令就是那个缺掉的显式入口：**用户说了「按现在的几何重来一遍」才重推**。
 * 与 {@link planEnableComposeGridLayout} 共用 `nearestCell` 与求解器——
 * 两处各算一遍的话，下一个改落位数学的人只会改到其中一处。
 *
 * 读的是子项**自己写下的** `LayoutItem`（offset 与两轴的 value），**不是**求解后的快照盒：
 * 网格一旦接管，快照里的盒子就是格坐标算出来的结果，拿它重推只会把同一个答案再算一遍，
 * 这条命令在它唯一该起作用的场合（参数改过、版面对不上）就成了空操作。
 * 作者写下的尺寸在进网格之后仍然留在文档里（只是属性面板把输入禁用了），那才是「我画的版面」。
 *
 * @internal
 */
export function planReflowComposeGridLayout(
  document: ComposeDocument,
  entityId: string,
  snapshot: ComposeLayoutSnapshot | undefined,
  idFactory: () => string,
): ComposeGridLayoutPlanResult {
  const entity = document.entities[entityId]
  if (!entity) return failure('grid.entity-missing', `Entity ${entityId} 不存在`)
  const hierarchy = getComposeHierarchy(entity)
  if (!hierarchy) return failure('grid.hierarchy-missing', '只有容器可以启用网格')
  const layout = getComposeLayout(entity)
  if (!layout || !isComposeGridLayout(layout)) {
    return failure('grid.not-enabled', '该容器还不是网格容器')
  }
  if (getComposeLock(entity).locked) return failure('grid.entity-locked', '锁定容器不能重新落位')
  if (!snapshot) return failure('grid.snapshot-missing', '布局结果尚未就绪')
  const parentBox = snapshot.boxes[entity.id]
  if (!parentBox) return failure('grid.box-missing', `缺少 ${entity.name} 的布局结果`)
  const collected = collectChildren(document, hierarchy)
  if (!collected.ok) return { ok: false, issue: collected.issue }

  const border = resolveComposeAppearance(entity).borderWidth
  const origin = { x: border + layout.padding.left, y: border + layout.padding.top }
  const contentWidth = Math.max(
    0,
    parentBox.width - border * 2 - layout.padding.left - layout.padding.right,
  )
  const cells: ComposeGridCell[] = collected.children.map((child) => {
    const item = getComposeLayoutItem(child)
    return nearestCell(
      child.id,
      {
        x: item.offset.x,
        y: item.offset.y,
        width: item.width.value,
        height: item.height.value,
        positioning: item.positioning,
      },
      origin,
      layout,
      contentWidth,
    )
  })
  const solved = solveComposeGrid(cells, { columns: layout.columns, float: layout.float })
  const commands = gridItemCommands(document, idFactory, solved)
  if (commands.length === 0) return failure('grid.no-children', '容器里没有可落位的子项')

  return {
    ok: true,
    command: createComposeBatchCommand({
      id: idFactory(),
      commands,
      meta: {
        label: `按当前几何重新落位 ${entity.name}`,
        source: 'inspector',
        targetIds: [entity.id, ...collected.children.map((child) => child.id)],
      },
    }),
  }
}

/**
 * 添加默认网格布局，并把全部直接子项按当前视觉位置就近落格。
 *
 * @internal
 */
export function planEnableComposeGridLayout(
  document: ComposeDocument,
  entityId: string,
  snapshot: ComposeLayoutSnapshot | undefined,
  idFactory: () => string,
): ComposeGridLayoutPlanResult {
  const entity = document.entities[entityId]
  if (!entity) return failure('grid.entity-missing', `Entity ${entityId} 不存在`)
  const hierarchy = getComposeHierarchy(entity)
  if (!hierarchy) return failure('grid.hierarchy-missing', '只有容器可以启用网格')
  if (getComposeLayout(entity)) return failure('grid.already-enabled', '该容器已经有布局')
  if (getComposeLock(entity).locked) return failure('grid.entity-locked', '锁定容器不能启用网格')
  if (!snapshot) return failure('grid.snapshot-missing', '布局结果尚未就绪')
  const parentBox = snapshot.boxes[entity.id]
  if (!parentBox) return failure('grid.box-missing', `缺少 ${entity.name} 的布局结果`)
  const collected = collectChildren(document, hierarchy)
  if (!collected.ok) return { ok: false, issue: collected.issue }

  const layout = createDefaultComposeGridLayout()
  const border = resolveComposeAppearance(entity).borderWidth
  const origin = { x: border + layout.padding.left, y: border + layout.padding.top }
  const contentWidth = Math.max(
    0,
    parentBox.width - border * 2 - layout.padding.left - layout.padding.right,
  )

  const cells: ComposeGridCell[] = []
  for (const child of collected.children) {
    const box = snapshot.boxes[child.id]
    if (!box) return failure('grid.box-missing', `缺少直接子项 ${child.name} 的布局结果`)
    cells.push(nearestCell(child.id, box, origin, layout, contentWidth))
  }
  const solved = solveComposeGrid(cells, { columns: layout.columns, float: layout.float })

  const commands: EditorCommand[] = [
    componentCommand(
      idFactory,
      BUILTIN_COMMAND_TYPES.addComponent,
      entity.id,
      'Layout',
      layout as unknown as JsonObject,
    ),
    ...collected.children
      .filter((child) => getComposeLayoutItem(child).positioning !== 'flow')
      .map((child) => componentCommand(
        idFactory,
        BUILTIN_COMMAND_TYPES.updateComponent,
        child.id,
        'LayoutItem',
        { ...getComposeLayoutItem(child), positioning: 'flow' } as unknown as JsonObject,
      )),
    ...gridItemCommands(document, idFactory, solved),
  ]

  return {
    ok: true,
    command: createComposeBatchCommand({
      id: idFactory(),
      commands,
      meta: {
        label: `为 ${entity.name} 启用网格`,
        source: 'inspector',
        targetIds: [entity.id, ...hierarchy.childIds],
      },
    }),
  }
}

/**
 * 移除网格，把布局结果烘焙回自由布局所需的持久化几何。
 *
 * @remarks
 * 与移除 Auto Layout 的规则一致：子项转 Absolute、offset 反算自当前 box、尺寸烘成 fixed。
 * 网格多一步——删掉全部 `GridItem`，否则文档里会留下一批指向不存在的容器语义的字段。
 *
 * @internal
 */
export function planRemoveComposeGridLayout(
  document: ComposeDocument,
  entityId: string,
  snapshot: ComposeLayoutSnapshot | undefined,
  idFactory: () => string,
): ComposeGridLayoutPlanResult {
  const entity = document.entities[entityId]
  if (!entity) return failure('grid.entity-missing', `Entity ${entityId} 不存在`)
  const hierarchy = getComposeHierarchy(entity)
  if (!hierarchy) return failure('grid.hierarchy-missing', '当前 Entity 不是容器')
  if (!isComposeGridLayout(getComposeLayout(entity))) return failure('grid.not-enabled', '网格尚未启用')
  if (getComposeLock(entity).locked) return failure('grid.entity-locked', '锁定容器不能移除网格')
  if (!snapshot) return failure('grid.snapshot-missing', '布局结果尚未就绪')
  const parentBox = snapshot.boxes[entity.id]
  if (!parentBox) return failure('grid.box-missing', `缺少 ${entity.name} 的布局结果`)
  const collected = collectChildren(document, hierarchy)
  if (!collected.ok) return { ok: false, issue: collected.issue }

  const border = resolveComposeAppearance(entity).borderWidth
  const commands: EditorCommand[] = []
  for (const child of collected.children) {
    const box = snapshot.boxes[child.id]
    if (!box) return failure('grid.box-missing', `缺少直接子项 ${child.name} 的布局结果`)
    const item = getComposeLayoutItem(child)
    commands.push(componentCommand(
      idFactory,
      BUILTIN_COMMAND_TYPES.updateComponent,
      child.id,
      'LayoutItem',
      {
        ...item,
        positioning: 'absolute',
        offset: { x: box.x - border, y: box.y - border },
        // 格中子级的轴尺寸模式在求解里被忽略，脱离网格后必须有一个确定的尺寸。
        width: { ...item.width, mode: 'fixed', value: box.width },
        height: { ...item.height, mode: 'fixed', value: box.height },
      } as unknown as JsonObject,
    ))
    if (getComposeGridItem(child)) {
      commands.push(componentCommand(
        idFactory,
        BUILTIN_COMMAND_TYPES.removeComponent,
        child.id,
        'GridItem',
      ))
    }
  }

  const parentItem = getComposeLayoutItem(entity)
  if (parentItem.height.mode === 'hug' || parentItem.width.mode === 'hug') {
    commands.push(componentCommand(
      idFactory,
      BUILTIN_COMMAND_TYPES.updateComponent,
      entity.id,
      'LayoutItem',
      {
        ...parentItem,
        width: parentItem.width.mode === 'hug'
          ? { ...parentItem.width, mode: 'fixed', value: parentBox.width }
          : parentItem.width,
        height: parentItem.height.mode === 'hug'
          ? { ...parentItem.height, mode: 'fixed', value: parentBox.height }
          : parentItem.height,
      } as unknown as JsonObject,
    ))
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
        label: `从 ${entity.name} 移除网格`,
        source: 'inspector',
        targetIds: [entity.id, ...hierarchy.childIds],
      },
    }),
  }
}

/**
 * 在网格与 Auto Layout 之间切换。
 *
 * @remarks
 * **两个方向都会丢信息**，这是入口上必须明示的：切到网格丢 `alignSelf`（网格没有主轴与
 * 交叉轴），切回 Auto Layout 丢全部格坐标。两样都无法从对侧推导回来，静默丢弃会让用户在
 * 撤销之后才发现。这里只负责把它写成**一条**事务，让那一次撤销真的够用。
 *
 * @param to - 目标布局类型
 * @internal
 */
export function planSwitchComposeLayoutType(
  document: ComposeDocument,
  entityId: string,
  to: 'grid' | 'flex',
  snapshot: ComposeLayoutSnapshot | undefined,
  idFactory: () => string,
): ComposeGridLayoutPlanResult {
  const entity = document.entities[entityId]
  if (!entity) return failure('grid.entity-missing', `Entity ${entityId} 不存在`)
  const hierarchy = getComposeHierarchy(entity)
  if (!hierarchy) return failure('grid.hierarchy-missing', '当前 Entity 不是容器')
  const current = getComposeLayout(entity)
  if (!current) return failure('grid.not-enabled', '该容器还没有布局')
  if (getComposeLock(entity).locked) return failure('grid.entity-locked', '锁定容器不能切换布局')
  if (to === 'grid' && isComposeGridLayout(current)) {
    return failure('grid.already-enabled', '已经是网格')
  }
  if (to === 'flex' && !isComposeGridLayout(current)) {
    return failure('grid.not-enabled', '已经是自动布局')
  }
  const collected = collectChildren(document, hierarchy)
  if (!collected.ok) return { ok: false, issue: collected.issue }

  if (to === 'flex') {
    const commands: EditorCommand[] = [
      componentCommand(
        idFactory,
        BUILTIN_COMMAND_TYPES.updateComponent,
        entity.id,
        'Layout',
        createDefaultComposeFlexLayout() as unknown as JsonObject,
      ),
      ...collected.children
        .filter((child) => getComposeGridItem(child))
        .map((child) => componentCommand(
          idFactory,
          BUILTIN_COMMAND_TYPES.removeComponent,
          child.id,
          'GridItem',
        )),
    ]
    return {
      ok: true,
      command: createComposeBatchCommand({
        id: idFactory(),
        commands,
        meta: {
          label: `把 ${entity.name} 切换为自动布局`,
          source: 'inspector',
          targetIds: [entity.id, ...hierarchy.childIds],
        },
      }),
    }
  }

  if (!snapshot) return failure('grid.snapshot-missing', '布局结果尚未就绪')
  const parentBox = snapshot.boxes[entity.id]
  if (!parentBox) return failure('grid.box-missing', `缺少 ${entity.name} 的布局结果`)
  const layout = createDefaultComposeGridLayout()
  const border = resolveComposeAppearance(entity).borderWidth
  const origin = { x: border + layout.padding.left, y: border + layout.padding.top }
  const contentWidth = Math.max(
    0,
    parentBox.width - border * 2 - layout.padding.left - layout.padding.right,
  )
  const cells: ComposeGridCell[] = []
  for (const child of collected.children) {
    const box = snapshot.boxes[child.id]
    if (!box) return failure('grid.box-missing', `缺少直接子项 ${child.name} 的布局结果`)
    cells.push(nearestCell(child.id, box, origin, layout, contentWidth))
  }
  const solved = solveComposeGrid(cells, { columns: layout.columns, float: layout.float })

  return {
    ok: true,
    command: createComposeBatchCommand({
      id: idFactory(),
      commands: [
        componentCommand(
          idFactory,
          BUILTIN_COMMAND_TYPES.updateComponent,
          entity.id,
          'Layout',
          layout as unknown as JsonObject,
        ),
        ...gridItemCommands(document, idFactory, solved),
      ],
      meta: {
        label: `把 ${entity.name} 切换为网格`,
        source: 'inspector',
        targetIds: [entity.id, ...hierarchy.childIds],
      },
    }),
  }
}
