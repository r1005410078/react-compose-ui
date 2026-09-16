> 依赖 `add-service-ports`：`ComposeLibraryPort` 落地之前，第 2 节只能对着接口写。

## 1. 新包 `@compose-ui/library-browser`

- [ ] 1.1 `packages/library-browser/`：package.json、tsconfig、vite、vitest、README
- [ ] 1.2 `AGENTS.md` 补上包边界（可依赖 `library`/`components`/`preview`/`ui-context`；
      不得依赖 `editor`/`stage`/`asset-browser`）
- [ ] 1.3 边界用例：公共 API 不出现 `editor` 与 `stage`

## 2. 页面库那一屏

- [ ] 2.1 左栏两段：去处（互斥）与场景类型筛选；两种选中画法可分
- [ ] 2.2 左栏与主区读**同一次** `query()` 的结果（items 与 facets 不分两次取）
- [ ] 2.3 图墙：无卡片容器，名称与使用次数压在图的底边；次数为 0 时不写
- [ ] 2.4 hover 才出尺寸、修改时间与两颗按钮
- [ ] 2.5 分段、排序、检索与滚动加载（游标）
- [ ] 2.6 缩略图缺席时画占位
- [ ] 2.7 WAI-ARIA：左栏两段各自的角色与键盘、图墙的网格语义与焦点

## 3. 全屏演示屏

- [ ] 3.1 复用既有只读 Preview 渲染，不新写渲染器
- [ ] 3.2 整屏只有图与一条控制条；左右翻页只写序号与总数
- [ ] 3.3 用例：屏上不出现分类、文件名与修改时间

## 4. 「就用这个」

- [ ] 4.1 只问名称的对话框；落地走 `instantiate`
- [ ] 4.2 图墙与演示屏两处按钮落到同一条路径
- [ ] 4.3 成功后直接打开新页面

## 5. 编辑器壳子

- [ ] 5.1 文档标签条从画布列头搬进应用顶栏；标签条横向滚动，不挤走右端两段
- [ ] 5.2 标志成为回页面库的入口，应用菜单保留
- [ ] 5.3 画布列头改为文档面包屑 + 「设计 / 动画」切换器
- [ ] 5.4 页面库作为 body 的一种状态；该状态下不渲染工作区切换器
- [ ] 5.5 保存成功后异步渲染激活场景并上传缩略图，失败只出诊断
- [ ] 5.6 更新受影响的既有用例（顶栏段数、标签条位置、选中画法三处）

## 6. 验证

- [ ] 6.1 `bun run lint` / `typecheck` / `test` / `build`
- [ ] 6.2 `bun run test:e2e`（顶栏与标签条改了位置）
- [ ] 6.3 `openspec validate add-page-library-home --strict`
