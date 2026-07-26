---
"@compose-ui/history": patch
"@compose-ui/scene-tree": patch
---

优化窄栏历史记录的视觉层级，并防止宿主按钮 reset 覆盖组件字号。

在 SceneTree watch 构建期间保留上一份有效声明文件，避免 Editor 开发时短暂丢失类型。
