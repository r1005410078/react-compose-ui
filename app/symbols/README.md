# 电网电气符号（SVG 导入素材）

这个文件夹是 `.svg` → 组件资产那条链路的**素材**，不是产品代码：示例应用把它整个映射成资源
浏览器里的 `Symbols` 文件夹（`app/src/demo-asset-provider.ts` 里的 `import.meta.glob`），
一级子目录成为子文件夹，往里丢一个 `.svg` 就会多出一项，右键即可「导入为组件」。

```
bun run dev   # 然后打开 http://localhost:5173/?symbols
```

`?symbols` 默认关闭，与 `?page-preview`、`?switch-demo` 同一条理由：图片资源库列出 Provider
里的全部图片，而 `.svg` 算图片——默认打开会让那张黄金图凭空多出几十项。

## 来源

从 `cd-normal-lib`（`normal-lib` / 电网电气符号 v0.0.1）**渲染**而来，共 58 个元件。
那个库里元件是 Vue SFC，几何写在模板里、墨色与状态是 props，因此不能直接当 SVG 用；
生成时用真的 Vue 2 运行时挂载每个组件、取渲染后的 DOM——模板里有 `v-if`、`computed` 与
`nanoid` 生成的 `mask` id，正则替换处理不了这些。

两处**有意偏离**源库，其余逐像素照搬：

- **墨色取 `#ff3b30` 而不是库里的 `#000`。** 那个库的画布是白的，而 Compose 的编辑画布是
  深色，照搬会得到一批看不见的元件。这个红是本仓库导线 Preset 的同一个值，深浅两个底都读
  得出来。颜色在源库里是 props，导入之后在 Compose 这边同样是可改的 Renderer prop。
- **只取每个元件的默认状态。** `switcher`（分/合）、`solid`（空心/实心）、`status`
  这些 props 在源库里是运行期变体，落成 SVG 只能定格一个；表格里列出了每个元件有哪些可配
  属性，需要别的状态时再生成一份即可。

## 端子

源库为 48 个元件声明了端子坐标（`index.js` 的 `ports`），SVG 格式里没有地方放它们，
因此**这一批 SVG 不携带端子**——坐标记在下面的表里，没有丢。导入之后要接线，需要在组件文档里
手工挂 `Ports`；把这份坐标在导入时映射成 `Ports` Component 是一条独立的能力，还没有做。

## 清单

### 电磁感应（`dianciganying/`，11 个）

| 文件 | 源目录 | 端子（id 与库内坐标） | 可配属性 |
| --- | --- | --- | --- |
| `变压器1.svg` | normal8 | 79(64,33) gN(64,95) | stroke / scale / color |
| `变压器2.svg` | normal16 | wE(64,33) zJ(64,95) | stroke / scale / color |
| `变压器3.svg` | bianyaqi | 79(64,33) gN(64,95) | stroke / scale / color |
| `电抗器.svg` | normal18 | sC(64,42) TY(64,86) | stroke |
| `电流互感器1.svg` | normal11 | JH(64,82) IO(64,44) | stroke |
| `电流互感器2.svg` | normal12 | hJ(64,90) fO(64,37) | stroke |
| `电流互感器3.svg` | normal13 | 9I(64,40) OT(64,87) | stroke |
| `电流互感器4.svg` | normal41 | 7z(64,45) Dh(64,67) | stroke |
| `电压互感器.svg` | normal23 | 1(64,33) | stroke / fill |
| `AC-DC.svg` | normal4 | 1(64,27) 2(64,102) | stroke |
| `DC-DC.svg` | dc-dc | 1(64,27) 2(64,102) | stroke |

### 测量仪表与声光信号（`celiang-yibiao-shengguang-xinhao/`，9 个）

| 文件 | 源目录 | 端子（id 与库内坐标） | 可配属性 |
| --- | --- | --- | --- |
| `灯1.svg` | Normal6 | 1(64,44) 2(64,85) | stroke |
| `灯2.svg` | Normal20 | 1(64,44) | stroke |
| `灯3.svg` | normal36 | — | status / disabledTwinkle |
| `灯4.svg` | normal37 | — | status |
| `等电位.svg` | Normal3 | 1(64,45) | stroke / fill |
| `三角形1.svg` | normal38 | — | status / stroke |
| `三角形2.svg` | normal39 | — | status / stroke |
| `信号灯1.svg` | normal42 | — | status |
| `信号灯2.svg` | normal43 | — | status / chargeColor / dischargeColor |

### 电阻与电容（`dianzu-dianrong/`，3 个）

| 文件 | 源目录 | 端子（id 与库内坐标） | 可配属性 |
| --- | --- | --- | --- |
| `电容.svg` | Normal29 | 1(58,64) 2(72,64) | stroke |
| `电阻.svg` | Normal | nb(43,64) qW(84,64) | stroke |
| `接地电容.svg` | Normal7 | 1(64,33) | stroke |

### 组件与模组（`zujian-mozu/`，5 个）

| 文件 | 源目录 | 端子（id 与库内坐标） | 可配属性 |
| --- | --- | --- | --- |
| `电池.svg` | battery | pF(64,43) | stroke / scale |
| `电池2.svg` | battery2 | oi(64,27) | scale / count / radius / spacing / color1 / color2 / color3 / nColor / stroke |
| `电源监控模块.svg` | Normal28 | 2_(56,20) tL(17,64) yV(110,64) | stroke |
| `整流器.svg` | Normal5 | Sk(43,33) gV(43,95) | stroke |
| `BMS.svg` | bms | 1a(64,47) k_(64,82) | stroke |

### 半导体与电子管（`bandaoti-dianziguan/`，2 个）

| 文件 | 源目录 | 端子（id 与库内坐标） | 可配属性 |
| --- | --- | --- | --- |
| `电缆.svg` | Normal9 | 5w(64,33) Xk(64,95) | stroke |
| `电缆终端头.svg` | Normal25 | 1(64,42) 2(64,80) | stroke |

### 导体与连接体（`daoti-lianjieti/`，5 个）

| 文件 | 源目录 | 端子（id 与库内坐标） | 可配属性 |
| --- | --- | --- | --- |
| `火线.svg` | Normal10 | 1P(64,54) 8W(64,74) | stroke |
| `接地线.svg` | Normal14 | 1(64,49) | stroke |
| `线1.svg` | Normal27 | W_(64,42) MV(64,80) | stroke |
| `线2.svg` | Normal30 | 1(64,51) 2(64,78) | stroke |
| `元件14.svg` | Normal14Old | 1(64,49) | stroke |

### 开关与保护（`kaiguan-baohu/`，18 个）

| 文件 | 源目录 | 端子（id 与库内坐标） | 可配属性 |
| --- | --- | --- | --- |
| `储能电机开关.svg` | normal35 | Qz(2,83) Le(127,83) | stroke / switcher / grounding |
| `刀闸1.svg` | Normal22 | 1(64,32) 2(65,94) | stroke / switcher |
| `刀闸2.svg` | Normal24 | 1(64,33) 2(64,93) | stroke / switcher |
| `断路器1.svg` | Normal15 | 1(64,33) 2(64,93) | stroke / switcher |
| `断路器2.svg` | Normal26 | 1(64,32) 2(64,96) | stroke / switcher |
| `开关1.svg` | Normal31 | 1(64,44) 2(64,83) | stroke / switcher / solid |
| `开关2.svg` | normal32 | X5(64,41) WP(64,87) | stroke / switcher / solid |
| `开关3.svg` | normal33 | iH(64,41) Ol(64,87) | stroke / switcher / solid |
| `开关4.svg` | normal34 | ag(64,32) jG(64,96) | stroke / switcher / solid |
| `逆变器.svg` | normal43 | iz(14,64) rG(114,64) | stroke |
| `熔断器.svg` | Normal42 | nH(63,118) HJ(63,10) | stroke |
| `软压板.svg` | Normal41 | QJ(42,64) zS(86,64) | stroke / switcher |
| `手车.svg` | normal40 | JP(64,50) LO(64,68) | stroke |
| `手车-2.svg` | Normal17 | rs(64,32) 5I(64,96) | stroke |
| `元件15.svg` | Normal15Old | 1(64,33) 2(64,93) | stroke / switcher |
| `元件22.svg` | Normal22Old | 1(64,33) 2(64,94) | stroke / switcher |
| `元件24.svg` | Normal24Old | 1(64,33) 2(64,93) | stroke / switcher |
| `元件26.svg` | Normal26Old | 1(64,32) 2(64,96) | stroke / switcher |

### 标识牌（`sign/`，5 个）

| 文件 | 源目录 | 端子（id 与库内坐标） | 可配属性 |
| --- | --- | --- | --- |
| `故障牌.svg` | malfunction | — | — |
| `检修牌.svg` | faulty | — | — |
| `锁定牌.svg` | lock | — | — |
| `抑制牌.svg` | prevent | — | — |
| `用户.svg` | user | DO(45,64) | stroke |
