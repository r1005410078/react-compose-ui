# 任务

## 1. 解析

- [x] 1.1 分词：文本 → `(code, value)` 对，容忍 CRLF 与前后空白
- [x] 1.2 分组：组码 0 开启新记录；记录保留 `pairs` 数组而不是收成 map
- [x] 1.3 段落识别：`TABLES` / `BLOCKS` / `ENTITIES`

## 2. 映射

- [x] 2.1 坐标翻转与角度取反的单一入口（位置、角度、比例三条推论）
- [x] 2.2 `LAYER` 表 → `CadLayer[]`；ACI 前九色；补齐图层 `0`
- [x] 2.3 `LINE` / `CIRCLE` / `ARC` / `LWPOLYLINE` / `TEXT` → 对应图元
- [x] 2.4 `BLOCK` → 块定义（按基点换算局部坐标）；`*` 开头跳过；块内 `INSERT` 跳过并报告
- [x] 2.5 `INSERT` → 块实例（旋转取反、比例不变）
- [x] 2.6 未知图层落回 `0` 并报告

## 3. 诊断

- [x] 3.1 稳定机器码：`unsupported-entity` / `polyline-bulge` / `unknown-layer` /
      `nested-block` / `unknown-block`
- [x] 3.2 同类按类型聚合计数

## 4. 入口

- [x] 4.1 资源浏览器上下文菜单：`.dxf` 上「从 DXF 导入」→ 生成 `.cad.json` 并打开
- [x] 4.2 导入诊断呈现给用户
- [x] 4.3 CAD 画布 `autoFitContent`：有内容时按包围盒取景，空文档不动

## 5. 验证

- [x] 5.1 单测：分词与分组、五类实体、**不对称圆弧**的角度、块与基点、诊断聚合、
      长折线顶点不折叠、产出文档通过校验
- [x] 5.2 组件测：有内容的文档打开即取景，空文档视口不变
- [x] 5.3 e2e：右键演示 `.dxf` → 导入 → 图面上看得见图元
- [x] 5.4 每条新断言先确认去掉实现后变红
- [x] 5.5 五道门槛一起跑：`lint` / `typecheck` / `test` / `build` / `test:e2e`
