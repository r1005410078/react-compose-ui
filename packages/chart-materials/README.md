# @compose-ui/chart-materials

折线、柱状与饼图的第一方 Compose 物料。

它**不在** `@compose-ui/materials` 里：图表自带一个第三方图表运行时（echarts），放进基础
物料包会让只画方块与文字的宿主也装上它。这与 `@compose-ui/dxf`、`@compose-ui/svg-import`
各自独立成包是同一条判断。

echarts **不出现在本包的公共 API 类型里**——换掉图表运行时不该是一次破坏性变更。

```ts
import { createComposeChartMaterials } from '@compose-ui/chart-materials'
import '@compose-ui/chart-materials/styles.css'

const registry = createComposeEntityRegistry({
  presets: [...createBasicMaterials(), ...createComposeChartMaterials()],
})
```
