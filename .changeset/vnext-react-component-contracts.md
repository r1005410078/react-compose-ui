---
"@compose-ui/components": major
"@compose-ui/ui-context": major
"@compose-ui/component-registry": major
"@compose-ui/stage": major
"@compose-ui/scene-tree": major
"@compose-ui/asset-browser": major
"@compose-ui/property-panel": major
"@compose-ui/history": major
"@compose-ui/operation-log": major
"@compose-ui/command-panel": major
"@compose-ui/materials": major
"@compose-ui/core": major
"@compose-ui/editor": major
"@compose-ui/preview": major
---

发布 vNext React API：第一方视觉组件统一为 Compose 命名、移除 legacy React facade，并以功能目录和
Storybook 组件文档作为稳定维护边界。资源浏览器的文件预览改为显式打开的 Canvas Dockview 文档标签，
避免单击资源时读取内容或替换当前目录网格。

同一 vNext 发布还将 ComposeDocument 升级至 v5：背景从字符串颜色改为结构化 Paint，新增透明度、
线性/径向/角向渐变、会话颜色历史、吸管与 Stage 直接渐变编辑；受影响的 Core、Editor、Preview、
Stage、组件注册和物料包均随该 major 变更发布。
