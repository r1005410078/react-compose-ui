## 上下文

预览里一个组件实例的处理链（`packages/materials/src/component-instance/renderer.tsx`）：

1. `readReference` / `readSnapshot` / `readInstanceOverrides`：从 Renderer props 读出快照与覆盖
2. 循环引用与嵌套深度检查（读 React Context 里的祖先链）
3. `resolveComposeInstanceOverrides`（core）
4. `sampleComponentInstanceDocument`（按 `animation` / `animationTime` 采样，依赖 `animation` 包）
5. `anchorComponentDocumentRoot`：根锚到原点
6. `contentFit === 'layout'` 时 `alignComponentDocumentOutput`：根尺寸对齐实例盒
7. 嵌套 Layout Runtime + 测量适配器求解
8. 呈现：内容 `overflow: hidden`；翻转绕中心 `scale(±1)`；`contentFit: 'scale'` 时按根自然尺寸
   摆放、`scale(host/root)` 以原点为基准

1、3–6 是纯数据变换；2 只依赖「祖先链」这一份数据；7 必须在浏览器里；8 是呈现。

## 目标 / 非目标

- 目标：导出的实例与预览逐像素一致；预览与导出共用一份准备管线。
- 非目标：把组件映射成独立的 `.qml` 组件类型（每个实例仍内联展开）；实例的数据绑定（属于
  `add-qml-page-script`）。

## 决策

### 准备函数

```ts
prepareComposeComponentInstance(input: {
  props: JsonObject                 // 实例 Entity 的 Renderer props
  hostBox: { width; height } | null // 实例盒；'scale' 求比值用
  ancestorKeys: readonly string[]   // 祖先组件引用，查循环
}): ComposePreparedComponentInstance
```

结果是可判别联合：`{ ok: true; key; document; contentFit; contentScale; flipScale }` 或
`{ ok: false; reason: 'invalid-snapshot' | 'invalid-overrides' | 'cycle' | 'too-deep' }`。

- 住在 `materials/component-instance/prepare.ts`，**不含 React**；`renderer.tsx` 用它替换现在的
  内联步骤。祖先链改为显式参数：渲染器从 Context 读出来传进去，导出侧由递归自然得到。
- 不放进 `core`：第 4 步依赖 `animation` 包，而 `core` 不认识动画；放进 `qml-export` 则预览用不到。
  `materials` 已经依赖 `animation` 与 `core`，且编辑器已经依赖 `materials`，不新增任何依赖边。
- `contentScale` 需要实例盒：渲染器现在量自己的 DOM（`getComputedStyle`），导出侧直接用布局快照里
  实例的盒——两者在 `fit: none` 下是同一个数。准备函数接收盒而不自己量。

### 求解与导出输入

- 遍历与求解住 `materials`（`solveComposeComponentInstances`）：遍历场景里会被渲染的实例（含嵌套
  实例里的实例），对每个调用准备函数，再用 `resolveComposeDocumentLayout(document, adapter)` 求解。
  适配器与预览同一个工厂、同一个 registry。它不放进编辑器：`?qt-reference` 的验收页同样要走这条
  路径，而编辑器**不依赖** `materials`（物料由宿主注入）——因此编辑器经新 prop `qmlInstances`
  拿到它，宿主绑定好 Registry 与资源解析器传进来；缺席时实例导出为占位。
- 导出因此变成异步：动作先给「正在导出」的提示并在完成前不可用，完成后下载。
- 准备函数的深度参数可选（缺省为祖先链长度）：渲染器的深度来自 Context，与祖先链由同一个
  Provider 推进，但既有用例会单独设深度。
- 导出器输入新增 `instances?: ReadonlyMap<string, ComposeQmlInstanceContent>`，键为复合地址
  （顶层实例就是它自己的 id，嵌套的是 `外层/内层`）。缺失某个键时该实例走占位兜底。

### 映射

```
Item  (实例盒，x/y/w/h、旋转、透明度——与其他实体同一套)
└─ Item  clip: true, 0,0,w,h
   └─ Item  transform: Scale { origin: 盒中心; xScale: ±1; yScale: ±1 }   （有翻转时）
      └─ Item  transform: Scale { origin: 0,0; xScale; yScale }; w/h = 根自然尺寸  （'scale' 时）
         └─ 嵌套文档根的子树（复用 exportEntity，id 前缀加实例前缀避免撞名）
```

- QML `id` 加上实例前缀（`e_<实例>__<内部>`），`objectName` 写复合地址——同一个组件放八次，内部
  对象各有八份，id 必须互不相同。
- 实例本身是叶子，导出时本来就 `clip: true`，因此图中最外一层裁剪 Item 与实例盒合并。
- 缺结果的实例报新诊断码 `instance.unresolved`，与 `renderer.placeholder`（这种内容不支持）分开。

## 风险 / 权衡

- 导出变成异步，大图纸上实例多时要逐个求解 → 实例按组件引用 + 覆盖 + 盒尺寸去重求解。
- 渲染器重构有回归风险 → 既有的实例组件测试与 e2e（`instance-animation`、`instance-content-fit`、
  `component-library`）全部保持通过，作为回归网。

## 待解决问题

- 是否在之后把「同一组件的实例」映射成 QML 组件类型以缩小产物体积（需要实例覆盖能表达为属性）。
