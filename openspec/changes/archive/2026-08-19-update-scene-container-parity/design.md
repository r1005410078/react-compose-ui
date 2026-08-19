# 设计

## 决策 1：升格是"只加一个 Component"，不附带任何规范化

`promoteComposeEntityToFrame(entity, size)` 只做三件事：缺 `Hierarchy` 就补一个空的、把
`Hierarchy`/`Frame` 补进 `Composition.baseComponentKeys`、写入 `Frame: { size }`。
`Appearance`、`Clip`、`Renderer`、动画轨道、名称、id、子级全部原封不动。

**为什么不顺手统一外观**：如果升格顺手把外观改成场景默认值，用户画一个改过底色的容器再拖出
场景，颜色会被悄悄改掉——这正好违背「容器跟场景是一个东西」。归一化只发生在**构造**新场景
时（`createComposeFrameEntity` 的默认值），不发生在**升格**既有实体时。

**为什么写 `baseComponentKeys`**：`entity.component.remove` 拒绝移除 `baseComponentKeys` 里的
键。升格后 `Frame` 进入该列表，Inspector 就不会出现一个能把根场景变成非法文档的删除按钮。

## 决策 2：场景默认外观常量放在 core，用 materials 侧的等值测试防漂移

`COMPOSE_DEFAULT_SCENE_APPEARANCE` 与 `DEFAULT_CONTAINER_APPEARANCE` 值相同但分处两包。
core 不能依赖 materials（架构边界），materials 依赖 core 但容器外观是物料层的事实来源——
把容器默认值反过来从 core 取会让 core 承担物料语义。

因此接受一份刻意的副本，并在 materials 侧加一条深相等断言把两者锁在一起。任何一侧漂移都会
在 `bun run test` 里立刻变红，而不是等到用户看见场景和容器颜色不一样。

## 决策 3：非容器的落点是"换算 + 钳制"，不是"换算"

落点在定义上一定在所有场景之外——否则 `containerAtPoint` 就命中了。直接换算成场景局部坐标
会得到一个越界坐标：场景开了 Clip 时对象直接消失，没开 Clip 时对象飘在场景外，两种都读作
「画了但没出现」。

钳制保持宽高不变，把左上角钳进 `[0, frameSize - size]`；实体比场景大时钳到 0。它是
`packages/stage-engine` 里的纯函数，与 React、DOM 无关，用 Vitest 覆盖「完全在外」「部分
重叠」「大于场景」。

## 决策 4：目标场景用 `resolveTargetFrameId(document, [], activeFrameId)`

复用既有解析器而不是直接读 `activeFrameId`，是为了拿到它内建的回退链
（`activeFrameId` → 首个根 Frame → 任意 Frame）。传空选区是刻意的：新建落点不应该被"当前
选中了哪个实体"影响——用户在空白处画东西时的意图是"放进正在编辑的那块场景"，而不是"放进
上一次点过的东西所在的场景"。

规范 `多画板下的 Frame 动作目标` 的"选中优先"只约束**以 Frame 为对象的动作**（适配画布、
缩放到 Frame），不约束新建落点。

## 决策 5：删描边，保留边界 `<rect>`

删掉的是 `.compose-stage__output-decoration` 里的四条可见 `<line>` 与对应 CSS。
`<rect data-testid="stage-frame-boundary-*">` 保留：它是规范里的「可检查边界」区域，也是十处
e2e 取场景屏幕几何的锚点，本身 `pointer-events: none`、`fill: transparent`，删掉只会制造无谓
的测试改写面。

「哪一块会被发布」的可辨认性从描边转移到标题标签上的激活标记——它本来就更明确，因为它带
文字与可点语义，而颜色差异在深色主题下很弱。

## 已知遗留（本变更不解决）

- **「Frame 默认裁剪」与「可在场景边界外编辑」矛盾。** `compose-document` 规范说 Frame 默认
  裁剪并可通过 `Clip` 关闭，`stage` 规范同时要求实体被移出 Frame 边界后仍可渲染与编辑。
  代码现状是 `createComposeFrameEntity` 根本不写 `Clip`，于是场景不裁剪、e2e 通过、规范
  第一句落空。真正的解法是让裁剪在编辑态与预览态分开取值，属于独立变更。
  本变更因此不动 Clip：升格保留原样，构造保持现状。
- **升格入口仍缺两个。** `受约束的 Frame 升格入口` 列的四个动作里，「为该容器绑定动画」与
  「把该容器设为独立导出目标」仍未实现。
