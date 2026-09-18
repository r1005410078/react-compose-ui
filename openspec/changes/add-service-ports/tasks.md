## 1. `@compose-ui/assets` 的三处加法

- [x] 1.1 `ComposeResolvedAssetUrl` 与可选 `resolveUrl`；`createComposeAssetResolver` 透传它
- [x] 1.2 `ComposeAssetUpload` 与可选 `createUpload` / `completeUpload`
- [x] 1.3 `ComposeAssetCapabilities` 补 `directUrl` / `directUpload` 两档
- [x] 1.4 既有两个 Provider（File System Access、示例内存）**一行不改**的边界用例

## 2. 新包 `@compose-ui/library`

- [x] 2.1 `packages/library/`：package.json、tsconfig、vite、vitest、README
- [x] 2.2 端口类型（`ComposeLibraryPort` 及其全部输入/输出），TSDoc 齐全
- [x] 2.3 `AGENTS.md` 补上这个包的架构边界（只依赖 `core` 与 `assets`；不进 `pages` 的理由）
- [x] 2.4 边界用例：公共 API 不出现 React / DOM / 鉴权参数

## 3. Provider 实现（现在没有后端时顶上的那一个）

- [x] 3.1 `createProviderLibraryPort({ provider })` 骨架与 `library.json` 读写
- [x] 3.2 目录：`listPages` 由**调用方注入**（`listComposePageDescriptors` 结构兼容，
      见 design.md D14）；库文件中没有记录的页面按默认值补
- [x] 3.3 查询：筛选、排序、游标分页在内存里算
- [x] 3.4 facet：按场景类型的那一组**摘掉 categories 条件**、按去处的那一组只受 search 影响
- [x] 3.5 `create` / `instantiate`（读源文件 → 写新文件 → 记一条 → useCount +1）
- [x] 3.6 `trash` / `restore` / `purge`；软删除不动文件
- [x] 3.7 `putThumbnail` 写 `.thumbnails/`；取图走端口上的 `readThumbnail`（交字节不交 URL，
      见 design.md D15）
- [x] 3.8 `recordOpen` / `listRecents`
- [x] 3.9 用例：手动放进目录的页面出现在库里；删模板再恢复仍是模板；选中一类后 facet 不为 0

## 4. 编辑器一侧

- [x] 4.1 保存成功后异步产出并上传缩略图；失败只出诊断，不阻断保存。**光栅化由宿主注入**
      （`renderThumbnail`）——把 DOM 变成位图要么引第三方运行时、要么走 `foreignObject`，
      两条都是独立的决定，不该作为保存路径的副作用被带进来；缺席即不产出，图墙画占位
- [x] 4.2 打开页面时 `recordOpen`；记不上不是打不开页面的理由
- [x] 4.3 验证编辑器的保存路径**一个字符都没改**（仍走 `writeFile` + `expectedRevision`）：
      既有 426 条用例一条没动就全过

## 5. 验证

- [x] 5.1 `bun run lint` / `typecheck` / `build` 全绿；`test` 逐包全绿
      （`turbo run test` 整跑在本机并发下会随机挂一个包，干净树上 `--force` 同样复现，
      与本变更无关）
- [x] 5.2 `openspec validate add-service-ports --strict`
