# 变更：默认 Palette 只保留没有专用入口的 Preset

## Why

Stage 工具栏已经提供 container、rectangle、line、arrow、circle、text 六个绘制工具，而组件库
Palette 同时又列出同名 Preset，同一个创建动作出现两个入口。用户在实际使用中反馈这些条目是重复的。

Page Slot 的情况不同：它在工具栏上没有对应工具，但它的真实入口是把页面文件从资源面板拖入画布
——那条路径会顺带带上页面引用与目标 output 尺寸。Palette 里空手创建出的只是一个未指向任何页面的
占位，价值有限。

Image 与 SVG 早已用同一个 `paletteHidden` 机制隐藏，本变更沿用该机制，不引入新协议。

## What Changes

- Text、Line、Arrow、Circle 与 Page Slot Entity Preset 默认 `paletteHidden`，不再出现在组件库
  Palette 中。它们仍然注册在 Registry 中，拖入、键盘新增、资源拖放与文档反序列化路径不受影响。
- 默认 Palette 因此只保留 Container、Rectangle 与宿主扩展 Preset。
- 宿主仍可通过物料 options 覆盖，或注册自己的 Preset 恢复任意条目。

## 首期边界

- 不改动 `paletteHidden` 协议本身，也不引入 Preset 分组或排序能力。
- 不移除任何 Preset、Renderer 或工具栏工具；只调整默认可见性。
