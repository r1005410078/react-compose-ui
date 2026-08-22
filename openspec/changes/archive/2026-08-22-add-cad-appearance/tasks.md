# 任务

## 1. 协议

- [x] 1.1 `CadStroke`（`color?` / `width?` / `dashPattern?`）、`getCadStroke`
- [x] 1.2 校验：颜色是非空字符串、线宽为正、虚线段全为正数
- [x] 1.3 九个标准色名表，与 DXF 导入器共用

## 2. 解析

- [x] 2.1 `resolveCadStroke(document, entity)`：逐项回退到图层色 / 默认线宽 / 实线
- [x] 2.2 不含 `CadStroke` 时结果与引入本能力之前逐字相同

## 3. 命令

- [x] 3.1 `cad.entity.stroke.set` handler：按项设置或删除，三项全空时删掉 Component
- [x] 3.2 `createStrokePropertySession`：三条命令共用，差别只在解析
- [x] 3.3 `COLOR` / `LWEIGHT` / `LTYPE` 定义与 i18n；解析失败拒绝但不结束命令

## 4. 画布

- [x] 4.1 渲染读解析结果：`strokeWidth` 不乘 zoom，`strokeDasharray` 乘 zoom
- [x] 4.2 块实例按实例自身外观（沿用图层的既有判断）

## 5. 验证

- [x] 5.1 单测：逐项回退、清除即删键、全空删 Component、三种解析、事务与撤销
- [x] 5.2 组件测：颜色与虚线出现在属性上、**缩放后线宽不变而虚线变密**
- [x] 5.3 e2e：选中一条线改色改线型，图面上看得见
- [x] 5.4 每条新断言先确认去掉实现后变红
- [x] 5.5 五道门槛一起跑：`lint` / `typecheck` / `test` / `build` / `test:e2e`
