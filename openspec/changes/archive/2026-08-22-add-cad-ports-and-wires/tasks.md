# 任务

## 1. 协议

- [x] 1.1 `CadPort`（`{ id, position }`，块局部）与 `CadBlockDefinition.ports`；缺省读作空列表
- [x] 1.2 `CadWire` Component 与 `CadWireEndpoint` 联合（`free` / `port`），`getCadWire`、
      `createCadWireEntity`
- [x] 1.3 校验：`port.invalid`、`port.duplicate-id`、`wire.invalid`、`wire.unknown-entity`、
      `wire.not-instance`、`wire.unknown-port`、`block.nested-wire`

## 2. 解算

- [x] 2.1 `inverseCadBlockPoint`：世界 → 块局部；任一轴比例为 0 时返回 `null`
- [x] 2.2 `collectCadInstancePorts`：解出全部可见实例的端口世界坐标
- [x] 2.3 `resolveCadWireSegment`：端点 → 世界线段；引用不完整时返回 `null`
- [x] 2.4 `collectCadVisibleSegments` 接入导线分支
- [x] 2.5 `translateCadEntity` 的导线分支：只动自由端点
- [x] 2.6 `previewCadTranslate`：复用 `translateCadEntity` 产出预览文档

## 3. 捕捉

- [x] 3.1 `CadSnapMode` 增加 `'port'`，插到 `CAD_SNAP_MODES` 最前
- [x] 3.2 端口候选来自 `collectCadInstancePorts`

## 4. 命令

- [x] 4.1 `cad.wire.add` handler：在文档中把落点绑定到端口，退化导线拒绝
- [x] 4.2 `cad.block.add-port` handler：逆变换写入块定义，非实例/零比例/重复 id 拒绝
- [x] 4.3 `cad.entity.remove` handler：冻结引用被删 Entity 的导线端点
- [x] 4.4 `WIRE` / `W` 会话与命令定义
- [x] 4.5 `PORT` / `PO` 会话与命令定义
- [x] 4.6 i18n 文案与命令注册

## 5. 画布

- [x] 5.1 图面渲染端口标记
- [x] 5.2 端口捕捉标记（菱形）
- [x] 5.3 拖动预览改走 `previewCadTranslate`，删掉屏幕位移分支

## 6. 验证

- [x] 6.1 单测：端口变换、导线解算、平移语义、校验机器码、两条 handler、两条会话
- [x] 6.2 组件测：端口标记与捕捉标记
- [x] 6.3 e2e：画符号 → `BLOCK` → `PORT` → `INSERT` → `WIRE` → 拖动实例 → 断言导线端点跟随
- [x] 6.4 e2e MUST 在**非 100% 缩放**下断言坐标；先确认去掉解算后用例变红
- [x] 6.5 五道门槛一起跑：`lint` / `typecheck` / `test` / `build` / `test:e2e`
