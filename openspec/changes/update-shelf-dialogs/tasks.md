## 1. 共用骨架与拖拽

- [x] 1.1 `ComposeDialogContent` 增加 `size`（`default` | `wide`，缺省不变）。**没有为它单写一条
      Vitest**：两档的差别只是一个类名，而它被两个对话框的组件用例整体覆盖着；单断类名的用例
      断的是实现而不是行为
- [x] 1.2 纯函数 `resolveShelfDropIndex(rects, point, orientation)`：`wrap` 与 `vertical` 两支；
      Vitest 覆盖换行的第二行、末尾、空列表与纵排
- [x] 1.3 `useShelfReorder`：指针捕获 + 「离开过按下点才算拖动」+ 键盘抓起／移动／放下／放弃，
      两条通道写同一份 `{items, grabbedIndex, dropIndex, zone}` 会话
- [x] 1.4 `ShelfDialogShell`：标题 + 说明 + 左编排右来源 + 页脚（重置在左端）；来源列的行渲染
      与 live region 住在这里
- [x] 1.5 编辑器样式：格、段卡、插入线、影子、落区高亮、光标副本与徽标，全部走既有 token

## 2. 工具栏对话框

- [x] 2.1 `COMPOSE_TOOLBAR_CATALOG` 扩成记录（id / messageKey / icon / entrance）；`SECOND_ENTRANCE`
      从 `toolbar-shelf.test.ts` 搬进它，用例改为读那一份。**没有加 `group`**：来源列不分组——
      目录只有十六项，且搜索框已经在了；分组要为「宿主注入的项归哪一组」再定一条规则，而那条
      规则眼下没有消费者。真要分组时这个字段仍然加得上，来源列的行渲染一行不改。
- [x] 2.2 `reorderToolbarShelfItem(shelf, from, to)` 与 `insertToolbarShelfItemAt(shelf, id, at)`；
      Vitest 覆盖「谁都不能挪到『选择』之前」在按下标重排时同样成立
- [x] 2.3 重写 `ToolbarShelfDialog`：横排编排区、图标、固定格、分隔线格、来源列印第二条入口
- [x] 2.4 溢出切口：宿主把工具栏此刻的可见格数交给对话框；量不到不画
- [x] 2.5 Testing Library：键盘抓放、`Escape` 放弃、`Delete` 与反斜杠、「选择」抓不起来、溢出
      切口画与不画。**拖动几何归端到端**——jsdom 的 `getBoundingClientRect` 恒为零，落点换算在
      那里得不出可断言的结果；纯函数那一半由 `shelf-drop.test.ts` 覆盖

## 3. 物料面板对话框

- [x] 3.1 `reorderComponentShelfSection(shelf, id, to)` 与 `insertComponentShelfSectionAt`；Vitest
- [x] 3.2 重写 `PaletteShelfDialog`：纵排段卡（选项长在卡上）、面板级两项排在编排区之外、
      来源列复用骨架那一列
- [x] 3.3 组件面板标签右键：`WorkspaceTab` 上挂 `ComposeContextMenu`，只对组件面板给
      「自定义物料面板…」；空面板同样可用
- [x] 3.4 Testing Library：标签右键打开对话框；段卡开关直接可改；拖动加一段

## 4. 端到端

- [x] 4.1 工具栏：拖动重排一格并切走再切回仍在
- [x] 4.2 工具栏：把一格拖回来源列即移出，重置后回来
- [x] 4.3 键盘：`空格` 抓起、方向键移动、`空格` 放下之后工具栏按新顺序渲染
- [x] 4.4 物料：右键组件面板标签打开对话框，拖入 `Symbols` 一支后面板出现那一段

## 5. 文档与验证

- [x] 5.1 `AGENTS.md` 当前阶段补两条判据：编排区画的是它将来的样子；第二条入口的声明住在源码里
      并被 UI 渲染
- [ ] 5.2 `bun run lint`、`typecheck`、`test`、`build`、`test:e2e` 全绿
