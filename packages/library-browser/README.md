# @compose-ui/library-browser

页面库那一屏——**应用的入口**。它回答的是「这东西该怎么画」：主区并排摆着同一类场景已经画过的
各种画法，而真正的用法是**当着客户翻**，客户指中哪一张就以那一张为底开始改。

消费 `@compose-ui/library` 的 `ComposeLibraryPort`，与 `@compose-ui/asset-browser` 之于 `assets`
同构。**不依赖 `editor` 与 `stage`**：页面库可以完全不加载编辑器，编辑器只是把它当一个领域组件挂上。

```tsx
import { ComposeLibraryBrowser } from '@compose-ui/library-browser'
import '@compose-ui/library-browser/styles.css'

<ComposeLibraryBrowser
  port={libraryPort}
  onOpenPage={(pageKey) => openInEditor(pageKey)}
  onNewPage={() => createBlankPage()}
  // 全屏演示用**真实渲染**而不是缩略图：客户要凑近看数值与线宽。
  renderPage={(record) => <ComposePageHost pageKey={record.pageKey} />}
/>
```

## 几条写死的判断

- **左栏是两段，不是一棵树。**上段回答「在哪儿找」（`aria-current`，画一块实底），下段回答
  「找哪一类」（`aria-pressed`，画左边一条竖条）。两种画法不同，背后就是两种不同的语义。
- **主区是图墙，不套卡片。**名称与使用次数压在图的底边上；尺寸与修改时间退到 hover。
  使用次数为 0 时不写——那一行的空缺本身也是信息。
- **缩略图可以缺席**，缺席时画占位。`thumbnailUrl` 走服务端签的直接 URL，给不出 URL 的实现
  走 `readThumbnail` 交字节，objectURL 的生命周期由这一层持有。
- **演示屏上不出现分类、文件名与修改时间**，只有图、序号与一条控制条：屏幕此刻正对着客户。
- **「就用这个」只问名称。**客户在旁边等着，别的之后都能改。
