## 1. `@compose-ui/assets` 的三处加法

- [ ] 1.1 `ComposeResolvedAssetUrl` 与可选 `resolveUrl`；`createComposeAssetResolver` 透传它
- [ ] 1.2 `ComposeAssetUpload` 与可选 `createUpload` / `completeUpload`
- [ ] 1.3 `ComposeAssetCapabilities` 补 `directUrl` / `directUpload` 两档
- [ ] 1.4 既有两个 Provider（File System Access、示例内存）**一行不改**的边界用例

## 2. 新包 `@compose-ui/library`

- [ ] 2.1 `packages/library/`：package.json、tsconfig、vite、vitest、README
- [ ] 2.2 端口类型（`ComposeLibraryPort` 及其全部输入/输出），TSDoc 齐全
- [ ] 2.3 `AGENTS.md` 补上这个包的架构边界（只依赖 `core` 与 `assets`；不进 `pages` 的理由）
- [ ] 2.4 边界用例：公共 API 不出现 React / DOM / 鉴权参数

## 3. Provider 实现（现在没有后端时顶上的那一个）

- [ ] 3.1 `createProviderLibraryPort({ provider })` 骨架与 `library.json` 读写
- [ ] 3.2 目录：复用 `listComposePageDescriptors`；库文件中没有记录的页面按默认值补
- [ ] 3.3 查询：筛选、排序、游标分页在内存里算
- [ ] 3.4 facet：按场景类型的那一组**摘掉 categories 条件**、按去处的那一组只受 search 影响
- [ ] 3.5 `create` / `instantiate`（读源文件 → 写新文件 → 记一条 → useCount +1）
- [ ] 3.6 `trash` / `restore` / `purge`；软删除不动文件
- [ ] 3.7 `putThumbnail` 写 `.thumbnails/`；`resolveUrl` 缺席时退回 read + objectURL
- [ ] 3.8 `recordOpen` / `listRecents`
- [ ] 3.9 用例：手动放进目录的页面出现在库里；删模板再恢复仍是模板；选中一类后 facet 不为 0

## 4. 编辑器一侧

- [ ] 4.1 保存成功后异步产出并上传缩略图；失败只出诊断，不阻断保存
- [ ] 4.2 打开页面时 `recordOpen`
- [ ] 4.3 验证编辑器的保存路径**一个字符都没改**（仍走 `writeFile` + `expectedRevision`）

## 5. 验证

- [ ] 5.1 `bun run lint` / `typecheck` / `test` / `build`
- [ ] 5.2 `openspec validate add-service-ports --strict`
