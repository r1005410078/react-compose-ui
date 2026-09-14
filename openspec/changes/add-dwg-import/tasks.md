# 任务

## 0. 先回答，再动手

- [ ] 0.1 确定仓库许可证与目标用户的交付形态（`design.md` 待解决问题 1、2）——阶段 2 的前提
- [x] 0.2 类型层面核对：映射层读的每一个组码都能在解码器的类型里找到对应字段（勘察 1～3）
- [x] 0.3 拿 LibreDWG 自己的成对 `.dwg`/`.dxf` 测试图纸跑一遍（仓库外，不进 `bun.lock`）：
      确证弧度、发现 `dwg_write_dxf` 可用、抓到图层状态与错误码两处缺陷（勘察 2～5）
- [ ] 0.4 **决策 4 重判**：走 `dwg_write_dxf` 还是原来的适配层（见 design.md 末节）

## 1. `.dwg` 不再静默（无条件）

- [x] 1.1 资源浏览器在 `.dwg` 上出现上下文菜单项，内容是**说明**而不是一片空白
- [x] 1.2 文案给出可执行的下一步（转成 DXF；ODA File Converter 免费、跨平台、可批量）
- [x] 1.3 组件测试：只在 `.dwg` 上出现、不依赖任何 Store/Provider、选中后给出下一步
- [x] 1.4 端到端：真实菜单里可达，且同一次右键里**没有**「导入为页面」

## 2. 露出记录层的缝（`@compose-ui/dxf`）

- [ ] 2.1 `planDxfImport` 拆成 `planDxfImportFromRecords(records, options)` 与一行封装
- [ ] 2.2 导出 `planDxfImportFromRecords` 与既有的 `DxfRecord`
- [ ] 2.3 既有 DXF 测试全绿且**未修改**——这就是「映射层没动」的证据

## 3. `@compose-ui/dwg`（阶段 2）

- [ ] 3.1 建包：只依赖 `core` 与 `dxf`，无第三方运行时依赖
- [ ] 3.2 结构化声明解码器端口，MUST NOT 从 `@mlightcad/*` 引入任何类型
- [ ] 3.3 适配：解码结果 → `DxfRecord[]`（实体、`LAYER` 表、`BLOCKS` 段）
- [ ] 3.4 `planDwgImport(database, options)` = 适配 + `planDxfImportFromRecords`
- [ ] 3.5 诊断：`dwg-decode-failed` / `dwg-unsupported-entity`，与既有诊断同一条聚合规则

## 4. 判别性用例

- [ ] 4.1 **同一张图的 `.dwg` 与 `.dxf` 导入结果逐字段相同**（钉住映射层没被 fork）
- [ ] 4.2 解码失败产出可判别诊断，MUST NOT 产出空场景
- [ ] 4.3 未注入解码器时是第 1 节那条说明，不是报错也不是静默

## 5. 入口与集成（阶段 2）

- [ ] 5.1 `.dwg` 菜单项在解码器注入后变成「导入为页面」，复用 DXF 那条写盘与打开路径
- [ ] 5.2 导入有进行中反馈——wasm 懒加载让这条路不再是同步的
- [ ] 5.3 示例应用示范 `await import()` 注入解码器；一份演示用 `.dwg`
- [ ] 5.4 端到端：右键 `.dwg` → 导入 → 页面打开且激活场景含内容

## 6. 文档

- [ ] 6.1 `AGENTS.md`、`openspec/project.md` 补 `@compose-ui/dwg` 的包边界
- [ ] 6.2 `README.md` 说明 DWG 需要宿主注入解码器，以及为什么
