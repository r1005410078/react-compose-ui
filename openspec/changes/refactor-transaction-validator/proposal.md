# 事务运行时注入文档校验器

## Why

CAD 文档类型（见 `docs/cad-document-roadmap.md`）复用 ECS 底座：Entity/Component 结构、
Patch 代数、事务、Undo/Redo 与历史面板全部照用，换的只是 Component 词汇与校验规则。
另起一套独立协议看着更干净，实际是把这些各复制一遍。

但事务运行时把 `validateComposeDocument` 硬编码在四处（`runtime.ts` 第 104、211、326、
456 行），承载文档的类型也一律写死 `ComposeDocument`。运行时**逻辑**对文档形状没有任何
假设——`cloneDocument` 是 `JSON.parse(JSON.stringify(...))`，Patch 按路径寻址——只有
**类型与那一个校验调用**认识 ComposeDocument。

## What Changes

- 新增 `DocumentValidator<TDocument>`：`(input: unknown) => DocumentValidationResultOf<TDocument>`。
  校验器同时承担规范化职责（现有实现返回规范化后的 document，调用方依赖这一点）。
- `ApplyDocumentPatchesResult`、`CommandHandler`、`TransactionRuntimeState`、
  `TransactionRuntimeEvent`、`TransactionRuntimeOptions`、`TransactionRuntime` six 个类型
  与 `applyDocumentPatches` 一并对文档类型泛型，**默认参数为 `ComposeDocument`**。
- 新增 `createDocumentTransactionRuntime<TDocument>`：泛型入口，`validate` **必填**。
- `createTransactionRuntime` 保持现有签名不变，成为 ComposeDocument 上的特化，内部转调
  泛型入口并传入 `validateComposeDocument`。

**无行为变化，且现有公共 API 一个名字都不改。** 类型默认参数使既有调用点全部原样编译。

## 为什么不是「可选 validate + 默认值」

若泛型入口的 `validate` 可选并默认 `validateComposeDocument`，`createTransactionRuntime<CadDocument>({ document })`
会**通过类型检查**却在运行时用 Compose 的规则去校验 CAD 文档——错误只在运行时以
「root-not-frame」之类的无关问题浮现。改为泛型入口必填、Compose 入口特化，这条错误路径
在类型层就不存在。

## Impact

- Affected specs: `command-transaction`
- Affected code: `packages/core/src/`（`command-types.ts`、`runtime.ts`、`patches.ts`、`index.ts`）
- 下游包全部不受影响：`TransactionRuntime` 等名称在默认类型参数下含义不变
