# 变更：抽出适配层剩余的四处独立关注点

## 原因

步骤 5 收尾之后对 800 行的 `compose-stage.tsx` 做了一次逐段复核。剩下的内容里有四处仍然值得
动，**理由都不是行数**——每一处要么守着一条会被误删的约束，要么缺一份本该有的测试。

## 变更内容

### `use-stage-hidden-entities.ts` — 守约束

Switcher 隐藏集合的两层记忆化。这里的引用稳定性是**硬要求**：场景子树与 SceneIndex 缓存都以
这个 Set 作键，换新引用会重建整棵场景，正在 DOM 上测量的实例内部选中框随之丢失。

之前这条约束只是夹在两个 `useMemo` 之间的一段注释。谁觉得「套两层没必要」顺手合并，后果是
实例下钻的选中框在编辑时闪断——一个很难归因的 bug。现在两层各自的职责写进了 TSDoc：外层保
身份、内层把依赖从选区数组换成内容 key（宿主每帧都可能传新数组，直接用数组作依赖会让每个
平移帧重新遍历文档）。

### `use-stage-surface-size.ts` — 守约束

state + ResizeObserver + 宿主回调，自成闭环。两处判定看着像样板，删掉都会出问题：零尺寸直接
返回（挂在隐藏容器里时会把回退尺寸覆盖成 0，之后所有除以尺寸的换算失效），以及同值短路
（ResizeObserver 会因祖先重排触发但尺寸没变）。

### `stage-screen-model.ts` — 补测试

**这一处刻意不是 Hook**：44 行里没有一个 React API。标尺刻度、场景边界、手柄锚点、辅助线合并、
滚动轴，全部由输入完全决定。抽成纯函数是为了能测——`bootstrapContentBounds` 的惰性求值
（不惰性则每个平移帧都为一个立刻丢弃的结果做全场景遍历）此前只有注释说它重要。

它返回 9 个字段，但与 Overlay 那刀拒绝的「共享派生包」性质不同：那是多个消费者共用的可变
集合点，这是单向的一次性视图模型，没有第二个消费者往里塞字段。

### 预览变换合成折进 `useStagePreviewDocuments` — 减参数

`segmentTransform` / `previewTransforms` / `previewDirections` 存在的唯一目的是喂给那个 Hook。
**正确动作不是新建模块，而是把它们搬进已有的 Hook**，参数从两个合成好的 map 换成内核原始的
`segmentPreview` 与 `previewTransforms`。加模块是成本，减参数是收益。

## 顺带

`'正在加载自动布局引擎…'` 是第三处硬编码 chrome 文案（前两处在右键菜单与资源拖入播报里已修）。
它在加载态门里，同样拿得到 `useComposeI18nContext`，没有技术障碍。

`compose-stage.tsx` 800 → 714 行。

## 影响

- 受影响的规范：`stage`（适配层组织、chrome 文案）
- 受影响的代码：`stage-surface/compose-stage.tsx`、`stage-i18n.ts`、三个新增模块
- 用户可见行为：zh-CN 无变化；en-US 下加载提示此前显示中文，现在显示英文。
