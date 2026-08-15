# Animation Panel 评审修复实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复 `@compose-ui/animation-panel` 代码评审发现的 4 个功能缺陷与 6 类可访问性缺陷，并让 `add-animation-panel-prototype` 的规范、任务记录与实现重新一致。

**Architecture:** 全部改动限制在 `packages/animation-panel/src` 与 `packages/editor` 的动画集成点。纯逻辑（关键帧 ID 分配、播放推进）留在 `animation-panel-model.ts`，React 侧只做渲染与事件归一化。新增一个包内私有的 `CommittedInput`，把"草稿输入 + 提交时写回会话"的模式从 `DurationInput` 抽出来，供时长、时间、颜色三个字段共用。不引入新依赖。

**Tech Stack:** Bun workspace、React 19（peer）、TypeScript、Vite（库构建）、Vitest + @testing-library/react、ESLint（`--max-warnings 0`）。

**Spec:**
- `openspec/changes/add-animation-panel-prototype/specs/animation-panel/spec.md`（本轮 Task 9 会修改其中一条需求）
- `openspec/changes/add-animation-panel-prototype/tasks.md`（本轮 Task 9 会追加"## 5. 评审修复"）

## Global Constraints

- 全部命令用 Bun：包内 `bun run lint` / `typecheck` / `test` / `build`，仓库根 `bun run lint` / `typecheck` / `test` / `build` / `check:architecture`；改动触及 editor 交互时额外跑根目录 `bun run test:e2e`。
- `openspec` 是全局 CLI，不在仓库依赖里，直接用 `openspec validate <id> --strict` 调用（不要写成 `bunx openspec`）。
- 不新增运行时依赖。`react` / `react-dom` 保持 peer；`@compose-ui/ui-context` 保持 `workspace:*` dependency 并在 `vite.config.ts` 的 `external` 中外置。
- 源码注释以中文为主，只解释"为什么"、不变量与非直观处理；禁止保留被注释掉的旧代码。
- 从包公共入口导出的组件、Hook、函数、类型必须有 TSDoc；包内私有实现（如 `CommittedInput`）不进入 `src/index.ts`。
- 测试名沿用现有格式：`OpenSpec: animation-panel / <Requirement> / <Scenario>`。
- 断言优先用 `getByRole` + accessible name，避免 `getByDisplayValue`（播放头 range input 会与数值文本框撞值）。
- 本轮**不做**、留给 Task 10 提案的事项：light 主题 token 化、`ComposeAnimationClip` 增加 `trackId`、去掉 `displayTrackLabel`/`displayPropertyLabel` 的 id 白名单、复用 `@compose-ui/components`、左右两栏滚动同步、"更多操作"菜单的真实实现。
- `getComposeAnimationClips` 每次调用返回新数组的引用抖动**有意不修**：当前没有任何消费者依赖其引用相等，提前加缓存违反 YAGNI。

---

## File Structure

| 文件 | 职责 | 本轮动作 |
|---|---|---|
| `packages/animation-panel/src/animation-panel/animation-panel-provider.tsx` | 会话状态、受控/非受控合流、播放 rAF 循环 | 修改（Task 1、8） |
| `packages/animation-panel/src/animation-panel/animation-panel-model.ts` | 纯模型：时间钳制、关键帧增删改、播放推进 | 修改（Task 2） |
| `packages/animation-panel/src/animation-panel/committed-input.tsx` | 草稿输入 + 提交时写回，供时长/时间/颜色共用 | **新建**（Task 3） |
| `packages/animation-panel/src/animation-panel/compose-animation-panel.tsx` | 时间线与属性面板的渲染、事件与 i18n 文案 | 修改（Task 3～8） |
| `packages/animation-panel/src/styles.css` | 包内命名空间样式 | 修改（Task 4、5、6、8） |
| `packages/animation-panel/src/animation-panel/animation-icons.tsx` | 内联 SVG 图标 | 修改（Task 6，删除 `MoreIcon`） |
| `packages/animation-panel/src/animation-panel/compose-animation-panel.test.tsx` | 组件契约、键盘、ARIA 测试 | 修改（Task 1、3～8） |
| `packages/animation-panel/src/animation-panel/animation-panel-model.test.ts` | 纯模型测试 | 修改（Task 2） |
| `packages/editor/src/compose-editor/compose-editor.tsx` | 编辑器组合入口 | 修改（Task 9，删死状态） |
| `packages/editor/src/workspace-layout/workspace-context.tsx` | 工作区内容 Context | 修改（Task 9） |
| `packages/editor/src/workspace-layout/workspace-panels.test.tsx` | 右侧面板行为测试 | 修改（Task 9） |
| `openspec/changes/add-animation-panel-prototype/**` | 提案、规范增量、任务清单 | 修改（Task 9） |
| `AGENTS.md` | 架构边界与分层清单 | 修改（Task 9） |
| `openspec/changes/update-animation-panel-foundation/**` | 后续提案骨架 | **新建**（Task 10，只起草不实施） |

---

### Task 1: 受控模式下播放头推进

评审发现 1。`commit` 的依赖是 `controlledValue`，受控宿主每回传一次新值就换一个 `commit` 身份 → 播放 `useEffect` 重建 → cleanup 把 `previousFrameTimeRef` 清成 `null` → 下一帧 `elapsed` 恒为 0。已实测：受控宿主推进 3 帧后 `currentTimeMs` 仍是 0，`isPlaying` 永远为 `true`。顺带修掉每帧 `Math.round` 造成的约 2% 偏快。

**Files:**
- Modify: `packages/animation-panel/src/animation-panel/animation-panel-provider.tsx:52-72`（`commit` 与 ref 定义）、`:209-238`（播放 effect）
- Test: `packages/animation-panel/src/animation-panel/compose-animation-panel.test.tsx`

**Interfaces:**
- Consumes: `advanceComposeAnimationPlayback(currentTimeMs, durationMs, playbackMode, elapsedMs, direction)`（已存在，签名不变）
- Produces: `commit` 在整个 Provider 生命周期内引用稳定（后续 Task 8 的 `useMemo` 依赖这一点）

- [ ] **Step 1: 写失败测试**

在 `compose-animation-panel.test.tsx` 顶部补 `useState` 导入（`import { useState } from 'react'`），并在 `describe('ComposeAnimationPanel', ...)` 内追加：

```tsx
  it('OpenSpec: animation-panel / 三种播放模式 / 受控宿主回传会话值时播放头继续推进', () => {
    const callbacks: FrameRequestCallback[] = []
    vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => {
      callbacks.push(callback)
      return callbacks.length
    }))
    vi.stubGlobal('cancelAnimationFrame', vi.fn())

    function ControlledHost() {
      const [value, setValue] = useState({
        ...createDefaultComposeAnimationPanelValue(),
        currentTimeMs: 0,
      })
      return (
        <ComposeAnimationPanelProvider value={value} onValueChange={setValue}>
          <ComposeAnimationTimeline />
        </ComposeAnimationPanelProvider>
      )
    }
    render(<ControlledHost />)

    fireEvent.click(screen.getByRole('button', { name: '播放动画' }))
    // 首帧只记录时间戳；之后每帧推进 50 ms。
    act(() => callbacks.shift()?.(0))
    act(() => callbacks.shift()?.(50))
    act(() => callbacks.shift()?.(100))

    expect(screen.getByRole('slider', { name: '当前时间' })).toHaveValue('100')
    expect(screen.getByRole('button', { name: '暂停动画' })).toBeInTheDocument()
  })
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd packages/animation-panel && bunx vitest run src/animation-panel/compose-animation-panel.test.tsx -t '受控宿主回传会话值时播放头继续推进'`
Expected: FAIL，`expected '0' to equal '100'`（播放头卡在 0）。

- [ ] **Step 3: 稳定 `commit` 身份**

在 `animation-panel-provider.tsx` 中，把 `commit` 及其周边改成：

```tsx
  const value = controlledValue ?? uncontrolledValue
  const valueRef = useRef(value)
  const onValueChangeRef = useRef(onValueChange)
  const previousFrameTimeRef = useRef<number | null>(null)
  const playbackDirectionRef = useRef<1 | -1>(1)
  // 不足 1 ms 的帧间隔余量：播放头按整毫秒存储，逐帧四舍五入会在 60 fps 下累积约 2% 的偏快。
  const frameRemainderRef = useRef(0)
  // commit 是播放 rAF effect 的依赖，必须在整个会话内保持同一引用。若它随受控值变化，
  // effect 会在每帧重建并清掉上一帧时间戳，elapsed 永远为 0，受控宿主的播放头再也不会前进。
  const controlledRef = useRef(controlledValue !== undefined)
  controlledRef.current = controlledValue !== undefined

  useEffect(() => {
    valueRef.current = value
    onValueChangeRef.current = onValueChange
  }, [onValueChange, value])

  const commit = useCallback((next: ComposeAnimationPanelValue) => {
    valueRef.current = next
    if (!controlledRef.current) setUncontrolledValue(next)
    onValueChangeRef.current?.(next)
  }, [])
```

同时删除已不再需要的 `const frameRef = useRef<number | null>(null)` 声明。

- [ ] **Step 4: 重构播放 effect**

把 `animation-panel-provider.tsx` 里整个播放 `useEffect` 替换为：

```tsx
  useEffect(() => {
    if (!value.isPlaying) return
    let frame = requestAnimationFrame(function tick(now) {
      const current = valueRef.current
      const previous = previousFrameTimeRef.current ?? now
      previousFrameTimeRef.current = now
      const elapsed = now - previous + frameRemainderRef.current
      const wholeElapsedMs = Math.floor(elapsed)
      frameRemainderRef.current = elapsed - wholeElapsedMs
      const next = advanceComposeAnimationPlayback(
        current.currentTimeMs,
        current.model.durationMs,
        current.playbackMode,
        wholeElapsedMs,
        playbackDirectionRef.current,
      )
      playbackDirectionRef.current = next.direction
      commit({ ...current, currentTimeMs: next.timeMs, isPlaying: next.isPlaying })
      if (next.isPlaying) frame = requestAnimationFrame(tick)
    })
    // 暂停或卸载时丢弃上一帧时间戳与余量：暂停期间流逝的真实时间不计入播放头。
    return () => {
      cancelAnimationFrame(frame)
      previousFrameTimeRef.current = null
      frameRemainderRef.current = 0
    }
  }, [commit, value.isPlaying])
```

- [ ] **Step 5: 跑测试确认通过**

Run: `cd packages/animation-panel && bun run test`
Expected: PASS，20 项全绿（原 19 项 + 新增 1 项）。特别确认原有「播放一次与循环」仍然通过。

- [ ] **Step 6: 提交**

```bash
git add packages/animation-panel/src/animation-panel/animation-panel-provider.tsx packages/animation-panel/src/animation-panel/compose-animation-panel.test.tsx
git commit -m "fix(animation-panel): 修复受控模式下播放头不推进"
```

---

### Task 2: 关键帧 ID 唯一化

评审发现 2。`addComposeAnimationKeyframe` 用 `${property.id}-${currentTimeMs}` 生成 ID，但关键帧一旦被拖动，ID 就与时间脱钩，在原时间再次加帧会产生同 ID。后果是 React key 重复，且 `findComposeAnimationKeyframe` 只命中第一个 —— 选中与拖动会作用到错误的帧。

**Files:**
- Modify: `packages/animation-panel/src/animation-panel/animation-panel-model.ts:232-267`
- Test: `packages/animation-panel/src/animation-panel/animation-panel-model.test.ts`

**Interfaces:**
- Produces: `addComposeAnimationKeyframe` 行为不变，但新帧 ID 在冲突时追加 `-2`、`-3` 序号；`createUniqueKeyframeId` 为模块私有，不导出。

- [ ] **Step 1: 写失败测试**

在 `animation-panel-model.test.ts` 的 `describe('animation panel model', ...)` 内追加：

```ts
  it('OpenSpec: animation-panel / 本地时间线与关键帧交互 / 在已用过的时间再次添加关键帧不会重复 ID', () => {
    const added = addComposeAnimationKeyframe({
      ...createDefaultComposeAnimationPanelValue(),
      currentTimeMs: 150,
    })
    const moved = updateComposeAnimationKeyframe(added, 'background-fill-150', { timeMs: 250 })
    expect(moved.conflict).toBe(false)

    // 150 ms 已空出来，但 `background-fill-150` 这个 ID 仍被移动后的关键帧占用。
    const readded = addComposeAnimationKeyframe({
      ...moved.value,
      currentTimeMs: 150,
      selectedKeyframeId: null,
    })
    const ids = readded.model.tracks[0]?.properties[0]?.keyframes.map(({ id }) => id) ?? []
    expect(new Set(ids).size).toBe(ids.length)
    expect(readded.selectedKeyframeId).toBe('background-fill-150-2')
  })
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd packages/animation-panel && bunx vitest run src/animation-panel/animation-panel-model.test.ts -t '不会重复 ID'`
Expected: FAIL，`expected 5 to be 6`（去重后数量变少，说明存在同 ID）。

- [ ] **Step 3: 实现唯一 ID 分配**

在 `animation-panel-model.ts` 中 `addComposeAnimationKeyframe` 之前插入：

```ts
/**
 * 关键帧 ID 只把时间当作初始命名依据。关键帧被移动后 ID 不跟随时间变化，
 * 因此原名可能仍被占用，必须在整个会话范围内查重后追加序号。
 */
function createUniqueKeyframeId(model: ComposeAnimationPanelModel, propertyId: string, timeMs: number) {
  const used = new Set(model.tracks
    .flatMap((track) => track.properties)
    .flatMap((property) => property.keyframes)
    .map(({ id }) => id))
  const base = `${propertyId}-${timeMs}`
  if (!used.has(base)) return base
  let suffix = 2
  while (used.has(`${base}-${suffix}`)) suffix += 1
  return `${base}-${suffix}`
}
```

并把 `addComposeAnimationKeyframe` 里构造新帧的那一段改为：

```ts
  const keyframe: ComposeAnimationKeyframe = {
    ...target.keyframe,
    id: createUniqueKeyframeId(value.model, target.property.id, value.currentTimeMs),
    timeMs: value.currentTimeMs,
  }
```

- [ ] **Step 4: 跑测试确认通过**

Run: `cd packages/animation-panel && bun run test`
Expected: PASS，21 项全绿。原有断言 `expect(next.selectedKeyframeId).toBe('background-fill-150')` 仍然成立（首次分配时 base 未被占用）。

- [ ] **Step 5: 提交**

```bash
git add packages/animation-panel/src/animation-panel/animation-panel-model.ts packages/animation-panel/src/animation-panel/animation-panel-model.test.ts
git commit -m "fix(animation-panel): 添加关键帧时保证 ID 在会话内唯一"
```

---

### Task 3: 时间与颜色字段改为草稿提交

评审发现 3、4。颜色字段的 `value` 直接绑定 model 且只接受完整 `#RRGGBB`，任何中间态都被立即回滚（实测删一个字符即恢复原值）；时间字段带 `" ms"` 后缀又逐键提交，React 受控回写把光标推到末尾，追加数字得到 `"200 ms3"` → `parseInt` 仍是 200，输入被吞，而不完整的数字还会真的移动关键帧。统一改为草稿 + Enter/失焦提交，单位移到相邻 `<small>`。

**Files:**
- Create: `packages/animation-panel/src/animation-panel/committed-input.tsx`
- Modify: `packages/animation-panel/src/animation-panel/compose-animation-panel.tsx:248-253`（时长控件）、`:359-398`（删除 `DurationInput`）、`:767-796`（时间与颜色字段）
- Modify: `packages/animation-panel/src/animation-panel/animation-panel-provider.tsx:192-195`（`updateSelectedKeyframe` 返回提交结果）
- Modify: `packages/animation-panel/src/styles.css`
- Test: `packages/animation-panel/src/animation-panel/compose-animation-panel.test.tsx`

**Interfaces:**
- Produces: `CommittedInput`（包内私有，不进 `src/index.ts`），props 为 `{ value: string; onCommit: (draft: string) => boolean } & Omit<InputHTMLAttributes<HTMLInputElement>, 'defaultValue' | 'onChange' | 'value'>`；`onCommit` 返回 `false` 表示草稿非法或被冲突拒绝，组件回滚草稿。
- Produces: `ComposeAnimationPanelSession.updateSelectedKeyframe` 返回 `boolean`（`false` = 被同时间冲突拒绝）。该类型未从包公共入口导出，改签名不影响外部。
- Consumes: `updateComposeAnimationKeyframe(value, keyframeId, update)`（已存在，返回 `{ value, conflict }`）

- [ ] **Step 1: 写失败测试**

在 `compose-animation-panel.test.tsx` 内追加两个测试：

```tsx
  it('OpenSpec: animation-panel / 本地时间线与关键帧交互 / 颜色字段允许输入中间态并在提交时生效', () => {
    render(
      <ComposeAnimationPanelProvider>
        <ComposeAnimationTimeline />
        <ComposeAnimationInspector />
      </ComposeAnimationPanelProvider>,
    )
    const color = screen.getByRole('textbox', { name: '值' })

    // 半成品颜色必须能停留在输入框里，而不是被立即回滚。
    fireEvent.change(color, { target: { value: '#FF6B6' } })
    expect(color).toHaveValue('#FF6B6')

    fireEvent.change(color, { target: { value: '#00aa11' } })
    fireEvent.blur(color)
    expect(screen.getByRole('textbox', { name: '值' })).toHaveValue('#00AA11')

    const committed = screen.getByRole('textbox', { name: '值' })
    fireEvent.change(committed, { target: { value: '不是颜色' } })
    fireEvent.blur(committed)
    expect(screen.getByRole('textbox', { name: '值' })).toHaveValue('#00AA11')
  })

  it('OpenSpec: animation-panel / 关键帧时间调整 / 时间字段在提交前不移动关键帧', () => {
    render(
      <ComposeAnimationPanelProvider>
        <ComposeAnimationTimeline />
        <ComposeAnimationInspector />
      </ComposeAnimationPanelProvider>,
    )
    const time = screen.getByRole('textbox', { name: '时间' })
    expect(time).toHaveValue('200')

    fireEvent.change(time, { target: { value: '25' } })
    expect(screen.getByRole('button', { name: '关键帧 200 ms：背景填充' })).toBeInTheDocument()

    fireEvent.keyDown(time, { key: 'Enter' })
    expect(screen.getByRole('button', { name: '关键帧 25 ms：背景填充' })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: '时间' })).toHaveValue('25')

    // Escape 丢弃草稿并回到会话值。
    const reselected = screen.getByRole('textbox', { name: '时间' })
    fireEvent.change(reselected, { target: { value: '90' } })
    fireEvent.keyDown(reselected, { key: 'Escape' })
    expect(reselected).toHaveValue('25')
  })
```

同时把既有断言里因单位外移而失效的写法改掉（改用 role + name，避免与播放头 range 撞值）：

- `compose-animation-panel.test.tsx:30` → `expect(screen.getByRole('textbox', { name: '时间' })).toHaveValue('200')`
- `:31` → `expect(screen.getByRole('textbox', { name: '值' })).toHaveValue('#FF6B6B')`
- `:46`、`:86` → `expect(screen.getByRole('textbox', { name: '时间' })).toHaveValue('100')`
- `:87` → `expect(screen.getByRole('textbox', { name: '值' })).toHaveValue('#00AA11')`
- `:109` → `expect(screen.getByRole('textbox', { name: '时间' })).toHaveValue('300')`
- `:110` 保持 `getByDisplayValue('200 ms → 300 ms')`（曲线区间是只读文本，不受影响）
- `:134` → `expect(screen.getByRole('textbox', { name: '时间' })).toHaveValue('250')`
- `:138` → `expect(screen.getByRole('textbox', { name: '时间' })).toHaveValue('240')`

- [ ] **Step 2: 跑测试确认失败**

Run: `cd packages/animation-panel && bun run test`
Expected: FAIL —— 新增两项失败（颜色中间态被回滚、时间字段值仍是 `200 ms`），改写过的既有断言也失败。

- [ ] **Step 3: 新建 `CommittedInput`**

创建 `packages/animation-panel/src/animation-panel/committed-input.tsx`：

```tsx
import { useState } from 'react'
import type { InputHTMLAttributes } from 'react'

type CommittedInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'defaultValue' | 'onChange' | 'value'
> & {
  /** 当前会话值的显示文本。 */
  readonly value: string
  /** 按 Enter 或失焦时提交草稿；返回 false 表示草稿非法或被拒绝，组件回滚到会话值。 */
  readonly onCommit: (draft: string) => boolean
}

/**
 * 会话值只在提交时更新的文本输入。
 *
 * 把 model 值直接绑到受控 `value` 会让所有中间态被立即回滚（`#FF6B6` 这类半成品颜色
 * 永远输入不完），逐键提交又会把不完整的数字当成真实编辑写回模型，并因受控回写把光标
 * 推到末尾而吞掉后续按键。宿主必须用当前会话值作为 `key`，会话值从外部变化时重新挂载
 * 以同步草稿。
 */
export function CommittedInput({ onCommit, value, ...htmlProps }: CommittedInputProps) {
  const [draft, setDraft] = useState(value)
  const commit = () => {
    if (draft === value) return
    if (!onCommit(draft)) setDraft(value)
  }
  return (
    <input
      {...htmlProps}
      value={draft}
      onBlur={commit}
      onChange={(event) => setDraft(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault()
          commit()
        }
        else if (event.key === 'Escape') {
          event.preventDefault()
          setDraft(value)
        }
      }}
    />
  )
}
```

- [ ] **Step 4: 让 `updateSelectedKeyframe` 返回提交结果**

在 `animation-panel-provider.tsx` 中：把 `ComposeAnimationPanelSession` 接口里的

```ts
  readonly updateSelectedKeyframe: (
    update: Partial<Pick<ComposeAnimationKeyframe, 'timeMs' | 'value' | 'interpolation'>>,
  ) => void
```

改为返回 `boolean`；并把实现改为：

```tsx
  const updateKeyframe = useCallback((keyframeId: string, update: Partial<Pick<ComposeAnimationKeyframe, 'timeMs' | 'value' | 'interpolation'>>) => {
    const current = valueRef.current
    const result = updateComposeAnimationKeyframe(current, keyframeId, update)
    if (result.conflict) {
      setNotice('duplicate-time')
      return false
    }
    setNotice(null)
    commit({
      ...result.value,
      selectedKeyframeId: keyframeId,
    })
    return true
  }, [commit])
  const updateSelectedKeyframe = useCallback((update: Partial<Pick<ComposeAnimationKeyframe, 'timeMs' | 'value' | 'interpolation'>>) => {
    const keyframeId = valueRef.current.selectedKeyframeId
    return keyframeId ? updateKeyframe(keyframeId, update) : false
  }, [updateKeyframe])
  const moveKeyframe = useCallback((keyframeId: string, timeMs: number) => {
    updateKeyframe(keyframeId, { timeMs })
  }, [updateKeyframe])
```

- [ ] **Step 5: 替换时长控件并删除 `DurationInput`**

在 `compose-animation-panel.tsx` 顶部补 `import { CommittedInput } from './committed-input'`，把工具栏里的 `<DurationInput ... />` 换成：

```tsx
            <label className="compose-animation-timeline__duration-control">
              <CommittedInput
                aria-label={t.duration}
                inputMode="numeric"
                key={value.model.durationMs}
                min={10}
                step={10}
                type="number"
                value={String(value.model.durationMs)}
                onCommit={(draft) => {
                  const durationMs = Number.parseInt(draft, 10)
                  if (!Number.isFinite(durationMs)) return false
                  setDuration(durationMs)
                  return true
                }}
              />
              <small>ms</small>
            </label>
```

然后整体删除 `function DurationInput(...)`。

- [ ] **Step 6: 改写时间与颜色字段**

把 `ComposeAnimationInspector` 里时间与颜色两个 `<label>` 替换为：

```tsx
        <label>
          <span>{t.time}</span>
          <span className="compose-animation-inspector__unit-field">
            <CommittedInput
              aria-label={t.time}
              inputMode="numeric"
              key={`${selectedKeyframe?.keyframe.id ?? 'none'}-${selectedKeyframe?.keyframe.timeMs ?? 0}`}
              readOnly={!selectedKeyframe}
              value={selectedKeyframe ? String(selectedKeyframe.keyframe.timeMs) : ''}
              onCommit={(draft) => {
                const timeMs = Number.parseInt(draft, 10)
                if (!Number.isFinite(timeMs)) return false
                return updateSelectedKeyframe({ timeMs })
              }}
            />
            <small>ms</small>
          </span>
        </label>
```

```tsx
        <label>
          <span>{t.value}</span>
          <span className="compose-animation-inspector__color-field">
            <i aria-hidden="true" style={{ backgroundColor: color }} />
            <CommittedInput
              aria-label={t.value}
              key={color}
              readOnly={!selectedKeyframe}
              spellCheck={false}
              value={color}
              onCommit={(draft) => {
                const next = draft.trim().toUpperCase()
                if (!/^#[0-9A-F]{6}$/.test(next)) return false
                return updateSelectedKeyframe({ value: next })
              }}
            />
          </span>
        </label>
```

- [ ] **Step 7: 补单位字段样式**

在 `styles.css` 的 `.compose-animation-inspector__color-field` 规则之前插入：

```css
  .compose-animation-inspector__unit-field { display: flex; height: 30px; align-items: center; padding-right: 9px; border: 1px solid color-mix(in srgb, var(--ap-border) 85%, black); border-radius: 4px; background: var(--ap-control); }
  .compose-animation-inspector__unit-field:focus-within { border-color: var(--ap-accent); box-shadow: 0 0 0 2px rgb(46 133 247 / 20%); }
  .compose-animation-inspector__unit-field input { height: 28px; border: 0; background: transparent; box-shadow: none !important; }
  .compose-animation-inspector__unit-field small { flex: 0 0 auto; color: var(--ap-muted); font-size: 12px; }
```

- [ ] **Step 8: 跑测试确认通过**

Run: `cd packages/animation-panel && bun run test && bun run lint && bun run typecheck`
Expected: 全部 PASS，23 项测试全绿。

- [ ] **Step 9: 提交**

```bash
git add packages/animation-panel/src
git commit -m "fix(animation-panel): 时间与颜色字段改为草稿提交，修复无法编辑的问题"
```

---

### Task 4: 关键帧轨道可点击且不再嵌套交互元素

评审发现 9。`.property-lane` 是 `role="button" tabIndex=0`，内部却嵌了 keyframe / interpolation-segment 两组 `<button>`，属于非法的交互元素嵌套；而 `.playhead-input` 铺满整个 scale（`z-index: 0` 且 DOM 顺序靠后），lane 空白区的点击其实全部落在这个透明 range 上，lane 的 `onClick` 对鼠标是死的 —— spec「点击右侧对应关键帧轨道选中属性」只能靠键盘满足。

做法：lane 退回纯容器；新增与左栏 `.row-hit` 对称的 `.lane-hit` 按钮承担选择；把 `.playhead-input` 收缩到标尺条高度，让擦洗回到标尺带（keyframe/segment/clip 因 z-index 更高，交互不受影响）。

**Files:**
- Modify: `packages/animation-panel/src/animation-panel/compose-animation-panel.tsx:619-693`
- Modify: `packages/animation-panel/src/styles.css:209-221`（`.row-hit` 之后追加 `.lane-hit`）、`:328`（`.playhead-input`）
- Test: `packages/animation-panel/src/animation-panel/compose-animation-panel.test.tsx`

**Interfaces:**
- Consumes: `t.selectPropertyLane(name)` 文案（已存在：`选择 ${name} 关键帧轨道` / `Select ${name} keyframe lane`）
- Produces: 新 DOM 契约 —— 每条属性轨道内首个子元素是 `button.compose-animation-timeline__lane-hit[data-property-lane-hit="<propertyId>"]`；容器 `div[data-property-lane]` 不再有 `role` / `tabindex`

- [ ] **Step 1: 写失败测试**

追加：

```tsx
  it('OpenSpec: animation-panel / 本地时间线与关键帧交互 / 点击关键帧轨道空白处选中属性轨道', () => {
    render(
      <ComposeAnimationPanelProvider>
        <ComposeAnimationTimeline />
      </ComposeAnimationPanelProvider>,
    )
    const lane = document.querySelector('[data-property-lane="background-fill"]')!
    // 容器不能既是 button 又包着 button：嵌套交互元素在 AT 中无法寻址。
    expect(lane).not.toHaveAttribute('role')
    expect(lane).not.toHaveAttribute('tabindex')

    const laneHit = screen.getByRole('button', { name: '选择 背景填充 关键帧轨道' })
    expect(laneHit.parentElement).toBe(lane)
    fireEvent.click(laneHit)

    expect(screen.getByRole('button', { name: '选择属性轨道 背景填充' }))
      .toHaveAttribute('aria-pressed', 'true')
    expect(lane).toHaveAttribute('data-selected', 'true')
  })

  it('OpenSpec: animation-panel / 参考图一致的可访问视觉结构 / 播放头擦洗区限定在标尺带', () => {
    render(
      <ComposeAnimationPanelProvider>
        <ComposeAnimationTimeline />
      </ComposeAnimationPanelProvider>,
    )
    // 播放头 range 覆盖整块 scale 时会盖住所有轨道，让 lane 的点击永远到不了。
    expect(screen.getByRole('slider', { name: '当前时间' }))
      .toHaveClass('compose-animation-timeline__playhead-input--ruler')
  })
```

同时更新既有断言 `compose-animation-panel.test.tsx:333-334`、`:337-338`：把对 `[data-property-lane="background-fill"]` 的 `aria-pressed` 断言改成对 lane-hit 按钮断言，`data-selected` 断言保留在容器上：

```tsx
    expect(screen.getByRole('button', { name: '选择 背景填充 关键帧轨道' }))
      .toHaveAttribute('aria-pressed', 'true')
    expect(document.querySelector('[data-property-lane="background-fill"]'))
      .toHaveAttribute('data-selected', 'true')
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd packages/animation-panel && bun run test`
Expected: FAIL，`expect(lane).not.toHaveAttribute('role')` 报 `role="button"` 仍在。

- [ ] **Step 3: 改写属性轨道渲染**

在 `compose-animation-panel.tsx` 的 `TimelineScale` 中，把属性轨道容器改成纯容器并把选择交给独立按钮：

```tsx
                return (
                  <div
                    className="compose-animation-timeline__property-lane"
                    data-property-lane={property.id}
                    data-selected={propertySelected || undefined}
                    key={property.id}
                  >
                    <button
                      aria-label={t.selectPropertyLane(label)}
                      aria-pressed={propertySelected}
                      className="compose-animation-timeline__lane-hit"
                      data-property-lane-hit={property.id}
                      type="button"
                      onClick={() => onSelectProperty(property.id)}
                    />
```

（其余 `keyframes.slice(1).map(...)` 与 `keyframes.map(...)` 两段保持原样，只是现在是 lane-hit 的兄弟节点而非 `role="button"` 的子节点。）

- [ ] **Step 4: 补 lane-hit 样式并收缩播放头擦洗区**

在 `styles.css` 的 `.compose-animation-timeline__row-hit:focus-visible` 规则之后追加：

```css
  .compose-animation-timeline__lane-hit {
    position: absolute;
    z-index: 0;
    inset: 0;
    padding: 0;
    border: 0;
    background: transparent;
    cursor: pointer;
  }
  .compose-animation-timeline__lane-hit:focus-visible {
    outline: 1px solid var(--ap-accent);
    outline-offset: -2px;
  }
```

把 `.compose-animation-timeline__playhead-input` 规则替换为：

```css
  /* 擦洗区只覆盖标尺带：铺满整块 scale 会盖住轨道空白区，让属性轨道的点击永远落不到实处。 */
  .compose-animation-timeline__playhead-input { position: absolute; z-index: 5; top: 0; right: 0; left: 0; width: 100%; height: var(--ap-ruler-height); margin: 0; opacity: 0; cursor: ew-resize; }
```

- [ ] **Step 5: 给播放头 input 加上标识类**

在 `compose-animation-panel.tsx` 的 range input 上把 `className` 改为：

```tsx
          className="compose-animation-timeline__playhead-input compose-animation-timeline__playhead-input--ruler"
```

- [ ] **Step 6: 跑测试确认通过**

Run: `cd packages/animation-panel && bun run test`
Expected: PASS，25 项全绿。

- [ ] **Step 7: 提交**

```bash
git add packages/animation-panel/src
git commit -m "fix(animation-panel): 关键帧轨道改用独立命中按钮，去除嵌套交互元素"
```

---

### Task 5: 选中态改用 `aria-current`

评审发现 13。`aria-pressed` 被用来表达"选中"，连片段的两个 resize 手柄都带上了"已按下"语义；未选中的关键帧还会朗读"未按下"。按 AGENTS.md，selection 与 pressed 是不同状态，不得混用。改为：集合内的当前项用 `aria-current="true"`（未选中时不渲染该属性），真正的开关（自动记录）保留 `aria-pressed`，手柄的显隐改用 `data-selected`。

**Files:**
- Modify: `packages/animation-panel/src/animation-panel/compose-animation-panel.tsx`（track row-hit、property row-hit、lane-hit、clip-body、clip-handle ×2、interpolation-segment、keyframe 共 8 处）
- Modify: `packages/animation-panel/src/styles.css:77`、`:299`、`:306`、`:316`、`:319`、`:325-326`
- Test: `packages/animation-panel/src/animation-panel/compose-animation-panel.test.tsx`（约 12 处断言）

**Interfaces:**
- Produces: 选中态 DOM 契约 —— 选中项渲染 `aria-current="true"`，未选中项不渲染 `aria-current`；`aria-pressed` 仅保留在自动记录按钮上。

- [ ] **Step 1: 改测试（先红）**

把下列断言从 `aria-pressed` 改为 `aria-current`，并把 `toHaveAttribute('aria-pressed', 'false')` 一律改为 `not.toHaveAttribute('aria-current')`：

- `:28`、`:45`、`:108`、`:133`（关键帧选中）
- `:102`（改为 `expect(segment).not.toHaveAttribute('aria-current')`）、`:106`（曲线段选中）
- `:187`、`:194`、`:200`（动画片段选中）
- `:325`、`:327`、`:331`、`:334`、`:345`、`:347`（对象/属性行与片段联动）
- `:328`、`:332`、`:348` 改为 `not.toHaveAttribute('aria-current')`
- Task 4 新增测试里的两处 `aria-pressed` 同样改为 `aria-current`

并追加：

```tsx
  it('OpenSpec: animation-panel / 参考图一致的可访问视觉结构 / 选中态与开关态使用不同的 ARIA 属性', () => {
    render(
      <ComposeAnimationPanelProvider>
        <ComposeAnimationTimeline />
      </ComposeAnimationPanelProvider>,
    )
    // 自动记录是真正的开关，保留 aria-pressed；集合内的选中项一律用 aria-current。
    expect(screen.getByRole('button', { name: '自动记录属性' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: '关键帧 200 ms：背景填充' })).not.toHaveAttribute('aria-pressed')
    expect(screen.getByRole('button', { name: '调整动画片段 Fault 的结束时间' })).not.toHaveAttribute('aria-pressed')
    expect(screen.getByRole('button', { name: '调整动画片段 Fault 的结束时间' })).not.toHaveAttribute('aria-current')
  })
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd packages/animation-panel && bun run test`
Expected: FAIL，多项断言报 `aria-current` 不存在。

- [ ] **Step 3: 改渲染属性**

在 `compose-animation-panel.tsx` 中逐处替换：

- 对象行 `.row-hit`：`aria-pressed={trackSelected}` → `aria-current={trackSelected || undefined}`
- 属性行 `.row-hit`：`aria-pressed={propertySelected}` → `aria-current={propertySelected || undefined}`
- `.lane-hit`：`aria-pressed={propertySelected}` → `aria-current={propertySelected || undefined}`
- `.clip-body`：`aria-pressed={selected}` → `aria-current={selected || undefined}`
- 两个 `.clip-handle`：删除 `aria-pressed={selected}`，改为 `data-selected={selected || undefined}`
- `.interpolation-segment`：`aria-pressed={selected}` → `aria-current={selected || undefined}`
- `.keyframe`：`aria-pressed={selected}` → `aria-current={selected || undefined}`
- 自动记录按钮的 `aria-pressed={value.autoRecord}` **保持不变**

- [ ] **Step 4: 同步样式选择器**

在 `styles.css` 中替换：

- `:77` 删除 `.compose-animation-timeline__icon-button[aria-pressed='true'],` 这一行（播放/加帧按钮不再有该状态，规则已成死代码）
- `:299` `.compose-animation-timeline__clip-body[aria-pressed='true']` → `.compose-animation-timeline__clip-body[aria-current='true']`
- `:306` `.compose-animation-timeline__clip-handle[aria-pressed='true']` → `.compose-animation-timeline__clip-handle[data-selected='true']`
- `:302-303` 的 `.clip-body:hover ~ ...` / `.clip-body:focus-visible ~ ...` 保持不变
- `:316` `.compose-animation-timeline__interpolation-segment[aria-pressed='true'] svg` → `[aria-current='true'] svg`
- `:319` `.compose-animation-timeline__interpolation-segment[aria-pressed='true']` → `[aria-current='true']`
- `:325-326` `.compose-animation-timeline__keyframe[aria-pressed='true']`（两条规则）→ `[aria-current='true']`

- [ ] **Step 5: 跑测试确认通过**

Run: `cd packages/animation-panel && bun run test && bun run lint`
Expected: PASS，26 项全绿。

- [ ] **Step 6: 提交**

```bash
git add packages/animation-panel/src
git commit -m "refactor(animation-panel): 选中态改用 aria-current，与开关态区分"
```

---

### Task 6: 删除死控件、修正 toolbar 与 Tabs 的 ARIA

评审发现 10、11。两个"更多操作"按钮没有任何行为却进 tab 序列并被朗读（已确认按删除处理）；`role="toolbar"` 没有方向键漫游，而里面还混着数字输入框与下拉，改用无键盘契约的 `role="group"`；缓动标签用了硬编码 DOM id（同页两个属性面板会重复），未激活标签的 `aria-controls` 指向不存在的元素，且缺少 Tabs 的方向键模式。

**Files:**
- Modify: `packages/animation-panel/src/animation-panel/compose-animation-panel.tsx`（messages 删 `more`、工具栏 role、track/property 行、Inspector tabs）
- Modify: `packages/animation-panel/src/animation-panel/animation-icons.tsx`（删 `MoreIcon`）
- Modify: `packages/animation-panel/src/styles.css:84-87`、`:261-263`
- Test: `packages/animation-panel/src/animation-panel/compose-animation-panel.test.tsx:301`

**Interfaces:**
- Consumes: `useId`（已在 `TimelineScale` 使用，Inspector 需新增导入）
- Produces: Tabs DOM 契约 —— 选中标签 `tabindex="0"` + `aria-controls=<面板 id>`，未选中标签 `tabindex="-1"` 且不带 `aria-controls`；面板 `aria-labelledby` 指向当前选中标签

- [ ] **Step 1: 写失败测试**

追加：

```tsx
  it('OpenSpec: animation-panel / 参考图一致的可访问视觉结构 / 缓动标签实现 Tabs 键盘模式', () => {
    render(
      <ComposeAnimationPanelProvider>
        <ComposeAnimationInspector />
      </ComposeAnimationPanelProvider>,
    )
    const curve = screen.getByRole('tab', { name: '曲线' })
    const spring = screen.getByRole('tab', { name: '弹簧' })
    expect(curve).toHaveAttribute('tabindex', '0')
    expect(spring).toHaveAttribute('tabindex', '-1')
    expect(curve).toHaveAttribute('aria-controls', screen.getByRole('tabpanel').id)
    // 未渲染的面板不能被 aria-controls 引用。
    expect(spring).not.toHaveAttribute('aria-controls')

    curve.focus()
    fireEvent.keyDown(curve, { key: 'ArrowRight' })
    expect(spring).toHaveAttribute('aria-selected', 'true')
    expect(spring).toHaveFocus()
    expect(screen.getByRole('tabpanel')).toHaveAttribute('aria-labelledby', spring.id)
  })

  it('OpenSpec: animation-panel / 分置嵌入动画区域 / 同页多个属性面板不产生重复 DOM id', () => {
    render(
      <ComposeAnimationPanelProvider>
        <ComposeAnimationInspector />
        <ComposeAnimationInspector />
      </ComposeAnimationPanelProvider>,
    )
    const ids = [
      ...screen.getAllByRole('tab').map((tab) => tab.id),
      ...screen.getAllByRole('tabpanel').map((panel) => panel.id),
    ]
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('OpenSpec: animation-panel / 参考图一致的可访问视觉结构 / 不暴露没有行为的控件', () => {
    render(
      <ComposeAnimationPanelProvider>
        <ComposeAnimationTimeline />
      </ComposeAnimationPanelProvider>,
    )
    expect(screen.queryByRole('button', { name: /更多操作/ })).not.toBeInTheDocument()
  })
```

并把 `:301-303` 的 toolbar 断言改为：

```tsx
    const toolbar = screen.getByRole('group', { name: '时间线操作栏' })
    expect(toolbar).toHaveAttribute('data-timeline-header', 'true')
    expect(toolbar.parentElement).toHaveClass('compose-animation-timeline__tracks')
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd packages/animation-panel && bun run test`
Expected: FAIL —— tab 缺 `tabindex`、`getByRole('group')` 找不到、"更多操作"按钮仍在。

- [ ] **Step 3: 删除"更多操作"控件**

- `compose-animation-panel.tsx`：删除对象行与属性行里的两个 `<button className="compose-animation-timeline__more-button" ...>`；从两个 locale 的 `messages` 中删除 `more` 条目；从 `./animation-icons` 的导入列表里删掉 `MoreIcon`。
- `animation-icons.tsx`：删除 `MoreIcon` 函数。
- `styles.css`：从 `:62-64` 与 `:84-87` 的选择器列表中删掉 `.compose-animation-timeline__more-button` 两处，并删除 `:261-263` 的 `.more-button` 规则块。

- [ ] **Step 4: 工具栏改为 group**

把工具栏容器的 `role="toolbar"` 改为 `role="group"`：

```tsx
          <div
            aria-label={t.toolbar}
            className="compose-animation-timeline__tracks-header"
            data-timeline-header="true"
            role="group"
          >
```

并在该行上方加注释：

```tsx
          {/* 这里混着数字输入框与下拉，无法满足 toolbar 要求的方向键漫游；group 只表达"一组相关控件"，没有键盘契约。 */}
```

- [ ] **Step 5: 重写缓动标签**

在 `compose-animation-panel.tsx` 顶部的 React 导入中加入 `useId`、`useRef`（`useRef` 已导入，确认即可），并在 `ComposeAnimationInspector` 内加入：

```tsx
  const easingId = useId()
  const curveTabId = `${easingId}-curve-tab`
  const springTabId = `${easingId}-spring-tab`
  const easingPanelId = `${easingId}-panel`
  const curveTabRef = useRef<HTMLButtonElement>(null)
  const springTabRef = useRef<HTMLButtonElement>(null)
  const activeTabId = value.easingEditor === 'curve' ? curveTabId : springTabId
  // Tabs 采用自动激活模式：方向键切换的同时把焦点带到新标签，否则漫游 tabindex 会把焦点留在旧标签上。
  const focusEasingTab = (editor: 'curve' | 'spring') => {
    setEasingEditor(editor)
    const target = editor === 'curve' ? curveTabRef.current : springTabRef.current
    target?.focus()
  }
  const handleEasingTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault()
      focusEasingTab(value.easingEditor === 'curve' ? 'spring' : 'curve')
    }
    else if (event.key === 'Home') {
      event.preventDefault()
      focusEasingTab('curve')
    }
    else if (event.key === 'End') {
      event.preventDefault()
      focusEasingTab('spring')
    }
  }
```

把 tablist 与 tabpanel 替换为：

```tsx
        <div aria-label={t.easingEditor} className="compose-animation-inspector__tabs" role="tablist">
          <button
            aria-controls={value.easingEditor === 'curve' ? easingPanelId : undefined}
            aria-selected={value.easingEditor === 'curve'}
            id={curveTabId}
            ref={curveTabRef}
            role="tab"
            tabIndex={value.easingEditor === 'curve' ? 0 : -1}
            type="button"
            onClick={() => setEasingEditor('curve')}
            onKeyDown={handleEasingTabKeyDown}
          >{t.curve}</button>
          <button
            aria-controls={value.easingEditor === 'spring' ? easingPanelId : undefined}
            aria-selected={value.easingEditor === 'spring'}
            id={springTabId}
            ref={springTabRef}
            role="tab"
            tabIndex={value.easingEditor === 'spring' ? 0 : -1}
            type="button"
            onClick={() => setEasingEditor('spring')}
            onKeyDown={handleEasingTabKeyDown}
          >{t.spring}</button>
        </div>
        <div
          aria-labelledby={activeTabId}
          className="compose-animation-inspector__curve"
          id={easingPanelId}
          role="tabpanel"
        >
```

（`<svg>` 与 `<strong>` 内容保持原样。）

- [ ] **Step 6: 跑测试确认通过**

Run: `cd packages/animation-panel && bun run test && bun run lint && bun run typecheck`
Expected: PASS，29 项全绿。

- [ ] **Step 7: 提交**

```bash
git add packages/animation-panel/src
git commit -m "fix(animation-panel): 删除无行为控件并修正 toolbar 与 Tabs 的 ARIA"
```

---

### Task 7: 关键帧时间冲突的可见与可访问反馈

评审发现 12。`duplicate-time` 提示只在 Inspector 的 sr-only live region 里，而编辑器只挂时间线 —— 拖帧撞到已有时间时用户得到零反馈（视觉上"拖不动"，AT 上什么也不说）。改为：时间线拥有唯一的 live region（拖动与方向键冲突都发生在这里），Inspector 改为常驻可见提示并通过 `aria-describedby` 挂到时间字段上，避免两个组件同时挂载时重复播报。顺带关掉当前时间读数的隐式播报 —— `<output>` 的隐式 role 是 `status`，播放时每帧都会被朗读。

**Files:**
- Modify: `packages/animation-panel/src/animation-panel/compose-animation-panel.tsx:245-247`（`<output>`）、`:697-710`（时间线 live region）、`:767-781`（时间字段）、`:837`（Inspector 提示）
- Modify: `packages/animation-panel/src/styles.css`
- Test: `packages/animation-panel/src/animation-panel/compose-animation-panel.test.tsx`

**Interfaces:**
- Consumes: `notice: 'duplicate-time' | null`（会话已提供）、`t.duplicateTime` 文案（已存在）
- Produces: 时间线内 `p.compose-animation-timeline__notice[role="status"]`；Inspector 内 `p.compose-animation-inspector__notice`，其 id 由 `useId` 生成并被时间字段 `aria-describedby` 引用

- [ ] **Step 1: 写失败测试**

追加：

```tsx
  it('OpenSpec: animation-panel / 关键帧时间调整 / 时间冲突时给出可见且可访问的反馈', () => {
    render(
      <ComposeAnimationPanelProvider>
        <ComposeAnimationTimeline />
        <ComposeAnimationInspector />
      </ComposeAnimationPanelProvider>,
    )
    const time = screen.getByRole('textbox', { name: '时间' })
    fireEvent.change(time, { target: { value: '100' } })
    fireEvent.keyDown(time, { key: 'Enter' })

    // 100 ms 已被占用：关键帧不能移动，且必须说明原因。
    expect(screen.getByRole('button', { name: '关键帧 200 ms：背景填充' })).toBeInTheDocument()
    expect(document.querySelector('.compose-animation-timeline__notice'))
      .toHaveTextContent('该属性轨道已存在同一时间的关键帧')
    expect(screen.getByRole('textbox', { name: '时间' }))
      .toHaveAccessibleDescription('该属性轨道已存在同一时间的关键帧')
    expect(screen.getByRole('textbox', { name: '时间' })).toHaveValue('200')
  })

  it('OpenSpec: animation-panel / 参考图一致的可访问视觉结构 / 当前时间读数不在播放时反复播报', () => {
    render(
      <ComposeAnimationPanelProvider>
        <ComposeAnimationTimeline />
      </ComposeAnimationPanelProvider>,
    )
    expect(screen.getByLabelText('当前时间', { selector: 'output' })).toHaveAttribute('aria-live', 'off')
  })
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd packages/animation-panel && bun run test`
Expected: FAIL —— 时间线里没有 `.compose-animation-timeline__notice`，`<output>` 也没有 `aria-live`。

- [ ] **Step 3: 时间线增加 live region 并静音读数**

在 `ComposeAnimationTimeline` 中从会话解构出 `notice`（`const { value, notice, addKeyframe, ... } = useAnimationPanelSession()`），把 `<output>` 改为：

```tsx
            {/* 隐式 role 是 status：播放时每帧都会变化，必须显式关掉播报，否则读屏会被刷屏。 */}
            <output aria-label={t.currentTime} aria-live="off" className="compose-animation-timeline__time-readout">
              {value.currentTimeMs}<small>ms</small>
            </output>
```

并在 `</div>` 结束 `compose-animation-timeline__content` 之前（`<section>` 内最后）加入：

```tsx
      <p aria-live="polite" className="compose-animation-panel__sr-only compose-animation-timeline__notice" role="status">
        {notice ? t.duplicateTime : ''}
      </p>
```

- [ ] **Step 4: Inspector 改为常驻可见提示**

在 `ComposeAnimationInspector` 中加入 `const noticeId = useId()`，把时间字段的 `CommittedInput` 补上描述引用：

```tsx
              aria-describedby={notice ? noticeId : undefined}
```

把文件末尾原有的 sr-only live region 替换为：

```tsx
      {/* 播报由时间线的 live region 负责：两个组件同时挂载时重复播报比没有播报更糟。
          这里只做常驻可见说明，并通过 aria-describedby 挂到时间字段上。 */}
      {notice ? <p className="compose-animation-inspector__notice" id={noticeId}>{t.duplicateTime}</p> : null}
```

- [ ] **Step 5: 补提示样式**

在 `styles.css` 的 `.compose-animation-panel__sr-only` 规则之前插入：

```css
  .compose-animation-inspector__notice { margin: 0 12px 12px; padding: 7px 9px; border: 1px solid color-mix(in srgb, var(--compose-danger, #e5484d) 55%, transparent); border-radius: 4px; color: #ffd7d9; background: color-mix(in srgb, var(--compose-danger, #e5484d) 16%, transparent); font-size: 12px; }
```

- [ ] **Step 6: 跑测试确认通过**

Run: `cd packages/animation-panel && bun run test`
Expected: PASS，31 项全绿。

- [ ] **Step 7: 提交**

```bash
git add packages/animation-panel/src
git commit -m "fix(animation-panel): 补齐关键帧时间冲突的可见与可访问反馈"
```

---

### Task 8: 会话记忆化、空选中态与死样式清理

评审的次要项：`session` 每次渲染都重建（Provider 位于编辑器根，父级任何重渲染都会刷新整个时间线）；无选中关键帧时计数显示虚假的 `1 / 4`、标题显示孤零零的 ` / `；`.compose-animation-timeline__controls` 与 `__controls-divider` 是没有任何使用者的死样式。

**Files:**
- Modify: `packages/animation-panel/src/animation-panel/animation-panel-provider.tsx:240-261`
- Modify: `packages/animation-panel/src/animation-panel/compose-animation-panel.tsx`（messages 增补、Inspector 头部）
- Modify: `packages/animation-panel/src/styles.css:48-50`、`:151`
- Test: `packages/animation-panel/src/animation-panel/compose-animation-panel.test.tsx`

**Interfaces:**
- Consumes: Task 1 产出的稳定 `commit`（所有回调已是 `useCallback`，`useMemo` 依赖数组因此是稳定项 + `value` + `notice`）
- Produces: 新文案 `noSelection`（`未选中关键帧` / `No keyframe selected`）

- [ ] **Step 1: 写失败测试**

追加：

```tsx
  it('OpenSpec: animation-panel / 关键帧选择与属性同步 / 无选中关键帧时不显示虚假序号', () => {
    render(
      <ComposeAnimationPanelProvider
        defaultValue={{ ...createDefaultComposeAnimationPanelValue(), selectedKeyframeId: null }}
      >
        <ComposeAnimationInspector />
      </ComposeAnimationPanelProvider>,
    )
    expect(screen.getByText('未选中关键帧')).toBeInTheDocument()
    expect(screen.getByText('— / 4')).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: '时间' })).toHaveValue('')
  })
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd packages/animation-panel && bun run test -t '无选中关键帧时不显示虚假序号'`
Expected: FAIL，页面显示的是 `1 / 4`。

- [ ] **Step 3: 记忆化 session**

在 `animation-panel-provider.tsx` 顶部导入中加入 `useMemo`，把 `const session: ComposeAnimationPanelSession = { ... }` 改为：

```tsx
  // Provider 挂在编辑器根节点上：不记忆化时，宿主任何一次无关重渲染都会换掉 session 引用，
  // 把整条时间线一起刷新。所有回调都是稳定的 useCallback，依赖只剩会话值与提示。
  const session = useMemo<ComposeAnimationPanelSession>(() => ({
    value,
    selectedKeyframe: findComposeAnimationKeyframe(value.model, value.selectedKeyframeId),
    notice,
    setCurrentTime,
    setDuration,
    setPlaying,
    setPlaybackMode,
    toggleAutoRecord,
    selectKeyframe,
    selectTrack,
    selectProperty,
    selectClip,
    updateClipRange,
    selectInterpolationSegment,
    moveKeyframe,
    updateSelectedKeyframe,
    toggleTrack,
    addKeyframe,
    setEasingEditor,
  }), [
    addKeyframe, moveKeyframe, notice, selectClip, selectInterpolationSegment, selectKeyframe,
    selectProperty, selectTrack, setCurrentTime, setDuration, setEasingEditor, setPlaybackMode,
    setPlaying, toggleAutoRecord, toggleTrack, updateClipRange, updateSelectedKeyframe, value,
  ])
```

- [ ] **Step 4: 修正空选中态**

在 `compose-animation-panel.tsx` 的两个 locale `messages` 中各加一条：

```ts
    noSelection: '未选中关键帧',
```

```ts
    noSelection: 'No keyframe selected',
```

把 `ComposeAnimationInspector` 里的 `selectedIndex` 与头部改为：

```tsx
  const selectedIndex = keyframes.findIndex(({ id }) => id === selectedKeyframe?.keyframe.id)
```

```tsx
      <header className="compose-animation-inspector__header">
        <h2>{t.keyframeHeading}</h2>
        <div>
          <strong>{selectedKeyframe ? `${trackLabel} / ${propertyLabel}` : t.noSelection}</strong>
          <span>{selectedIndex >= 0 ? selectedIndex + 1 : '—'} / {keyframes.length}</span>
        </div>
      </header>
```

- [ ] **Step 5: 删除死样式**

在 `styles.css` 中删除 `.compose-animation-timeline__controls { display: none; }` 规则块与 `.compose-animation-timeline__controls-divider { ... }` 规则行 —— 两个类名在 TSX 中都没有使用者。

- [ ] **Step 6: 跑测试确认通过**

Run: `cd packages/animation-panel && bun run lint && bun run typecheck && bun run test && bun run build`
Expected: 全部 PASS，32 项测试全绿，`dist/index.js` 与 `dist/styles.css` 正常产出。

- [ ] **Step 7: 提交**

```bash
git add packages/animation-panel/src
git commit -m "refactor(animation-panel): 记忆化会话、修正空选中态并清理死样式"
```

---

### Task 9: 规范、编辑器死状态与文档同步

评审发现 5、6。spec 要求"激活动画标签时右侧显示关键帧属性"，实现与测试却明确相反（`AnimationPanel` 的注释是"右侧继续用基础 / 外观"），`animationPanelActive` 因此成了全链路传递但无人消费的死状态。已定：**以现状为准改 spec 并删死状态**。同时把新包补进 AGENTS.md 的架构边界与分层清单。

**Files:**
- Modify: `openspec/changes/add-animation-panel-prototype/specs/animation-panel/spec.md`（"编辑器中可见的动画区"需求）
- Modify: `openspec/changes/add-animation-panel-prototype/tasks.md`（3.2 / 3.3 记录 + 追加"## 5. 评审修复"）
- Modify: `packages/editor/src/workspace-layout/workspace-context.tsx:30`
- Modify: `packages/editor/src/compose-editor/compose-editor.tsx:371-372`、`:1579`、`:1616-1626`
- Modify: `packages/editor/src/workspace-layout/workspace-panels.test.tsx`
- Modify: `AGENTS.md`（架构边界列表 + 分层第 3 层）
- Modify: `scripts/check-react-component-architecture.mjs`（`visualPackages` 与 `requiredVisualFeatures`）

**Interfaces:**
- Produces: `WorkspaceContent` 不再包含 `animationPanelActive` 字段；`ComposeEditor` 不再监听底部标签切换来维护动画状态

- [ ] **Step 1: 改写 spec 需求**

把 `openspec/changes/add-animation-panel-prototype/specs/animation-panel/spec.md` 中 `### Requirement: 编辑器中可见的动画区` 整块替换为：

```markdown
### Requirement: 编辑器中可见的动画区

`@compose-ui/editor` MUST 在默认底部工具组中提供本地化的“动画”标签，并以
`@compose-ui/animation-panel` 作为纯 UI 依赖挂载时间线。切换动画标签 MUST NOT 改变右侧属性区的
内容：右侧始终显示编辑器原有 Inspector，关键帧属性面板由宿主自行决定是否嵌入。此宿主集成
MUST NOT 把动画操作写入 ComposeDocument、Stage、Preview 或撤销历史。
底部工具组 MUST 横跨整个编辑器底边；场景与属性区应位于其上方的主工作区左右分栏，不能限制底部
工具组的水平宽度。

#### Scenario: 激活动画标签

- **WHEN** 用户在编辑器底部工具组选择“动画”标签
- **THEN** 底部显示动画时间线
- **AND** 右侧属性区继续显示编辑器原有 Inspector 内容

#### Scenario: 动画编辑器占满底边

- **WHEN** 编辑器同时显示场景区、右侧属性区和已展开的底部动画标签
- **THEN** 底部动画编辑器横跨编辑器完整底边宽度
- **AND** 场景区和属性区仅占用底部工具组上方的主工作区

#### Scenario: 切换回常规工具标签

- **WHEN** 用户从“动画”切换到资源、命令或日志标签
- **THEN** 右侧属性区内容保持不变
- **AND** 本地动画会话值不写入页面文档或撤销历史
```

- [ ] **Step 2: 校验 OpenSpec**

Run: `cd /Users/rongts/react-compose-ui && openspec validate add-animation-panel-prototype --strict`
Expected: PASS（每条需求至少一个 `#### Scenario:`）。

- [ ] **Step 3: 删除编辑器死状态**

- `packages/editor/src/workspace-layout/workspace-context.tsx`：删除 `animationPanelActive: boolean` 字段及其注释。
- `packages/editor/src/compose-editor/compose-editor.tsx`：删除 `const [animationPanelActive, setAnimationPanelActive] = useState(false)` 及其上方注释；删除 `content` 对象里的 `animationPanelActive,` 一行；把 `onDidActivePanelChange` 回调里的以下分支整段删除：

```tsx
      if (panelId === WORKSPACE_PANEL_IDS.animation) {
        setAnimationPanelActive(true)
      }
      else if (
        panelId === WORKSPACE_PANEL_IDS.assetBrowser
        || panelId === WORKSPACE_PANEL_IDS.command
        || panelId === WORKSPACE_PANEL_IDS.transactionLog
      ) {
        setAnimationPanelActive(false)
      }
```

保留其后的 `if (!isWorkspaceDocumentPanelId(panelId) ...) return` 与 `setActiveDocumentPanelId(panelId)`。

- `packages/editor/src/workspace-layout/workspace-panels.tsx`：把 `AnimationPanel` 的 TSDoc 改为与 spec 一致的表述：

```tsx
/** 底部动画时间线。右侧属性区不随动画标签切换，关键帧属性由宿主自行嵌入。 @internal */
```

- [ ] **Step 4: 更新编辑器测试**

`packages/editor/src/workspace-layout/workspace-panels.test.tsx`：从 fixture 中删除 `animationPanelActive: true,` 一行（该字段已不存在），保留其余断言，并把用例名改为：

```tsx
  it('OpenSpec: animation-panel / 编辑器中可见的动画区 / 底部动画标签不改变右侧属性区内容', () => {
```

- [ ] **Step 5: 补 AGENTS.md**

在 `AGENTS.md` 的"架构边界"列表中，紧随 `@compose-ui/history` 那一条之后插入：

```markdown
- `@compose-ui/animation-panel` 是与文档协议解耦的独立动画时间线与关键帧属性组件，可依赖
  `ui-context`，不得依赖 `core`、`editor`、`stage`、`preview` 或任何文档历史；所有操作只改变
  组件自身的 React 会话，`editor` 只把它当作纯 UI 依赖挂载。
```

并在"分层与依赖方向"第 3 层的包列表末尾追加 `、`animation-panel``。

- [ ] **Step 6: 把新包注册进架构检查**

`scripts/check-react-component-architecture.mjs` 用 `visualPackages` 白名单决定检查哪些包，
`animation-panel` 不在其中 —— 目前该包的禁用目录名、唯一公共入口、跨包私有路径导入、共置测试与
Story 全部**没有被检查**。在 `visualPackages` 的集合开头加入 `'animation-panel', `，并在
`requiredVisualFeatures` 对象开头加入：

```js
  'animation-panel': ['animation-panel/compose-animation-panel.tsx'],
```

（已验证：注册后当前源码结构直接通过检查，无需调整目录。）

- [ ] **Step 7: 更新 tasks.md 记录**

在 `openspec/changes/add-animation-panel-prototype/tasks.md` 中：

- 把 3.2 的记录改为：`记录：右侧属性区不随动画标签切换，继续显示编辑器原有 Inspector；相关断言见 workspace-panels.test.tsx。`
- 把 3.3 的结果改为：`结果：本地示例编辑器确认底部依次显示“资源 / 动画 / 命令 / 日志”；激活“动画”后底部显示时间线，右侧保持原有属性面板。`
- 在文件末尾追加：

```markdown

## 5. 评审修复

- [x] 5.1 修复受控模式下播放头不推进（commit 身份稳定化 + rAF effect 重构 + 亚毫秒余量累积）。
- [x] 5.2 添加关键帧时按会话查重分配 ID，避免关键帧移动后产生同 ID。
- [x] 5.3 时长、时间与颜色字段统一改为草稿 + Enter/失焦提交，单位移出输入框。
- [x] 5.4 关键帧轨道改用独立命中按钮，去除嵌套交互元素；播放头擦洗区收缩到标尺带。
- [x] 5.5 选中态统一改用 `aria-current`，`aria-pressed` 只保留给自动记录开关。
- [x] 5.6 删除无行为的“更多操作”控件；`toolbar` 改为 `group`；缓动标签补齐 `useId`、漫游 tabindex 与方向键。
- [x] 5.7 时间冲突提示改由时间线播报、属性面板常驻可见并挂 `aria-describedby`；当前时间读数关闭隐式播报。
- [x] 5.8 记忆化会话对象，修正无选中关键帧时的头部与序号，清理死样式。
- [x] 5.9 规范与文档同步：右侧属性区行为以现状为准，删除 `animationPanelActive` 死状态，补 AGENTS.md 包清单与架构检查白名单。
```

- [ ] **Step 8: 全量验证**

Run:
```bash
cd /Users/rongts/react-compose-ui
bun run lint && bun run typecheck && bun run check:architecture && bun run test && bun run build
openspec validate add-animation-panel-prototype --strict
bun run test:e2e
```
Expected: 全部 PASS。`test:e2e` 必须跑 —— 本轮改动了编辑器工作区接线与时间线的命中区域。

- [ ] **Step 9: 提交**

```bash
git add AGENTS.md scripts/check-react-component-architecture.mjs openspec/changes/add-animation-panel-prototype packages/editor/src
git commit -m "docs(animation-panel): 右侧属性区行为以现状为准并删除死状态"
```

---

### Task 10: 起草后续能力提案（不实施）

把本轮有意排除的 6 项写成一个待批提案，避免它们只留在评审结论里。**只创建文件，不改任何实现代码。**

**Files:**
- Create: `openspec/changes/update-animation-panel-foundation/proposal.md`
- Create: `openspec/changes/update-animation-panel-foundation/design.md`
- Create: `openspec/changes/update-animation-panel-foundation/tasks.md`
- Create: `openspec/changes/update-animation-panel-foundation/specs/animation-panel/spec.md`

**Interfaces:**
- Produces: 一个通过 `openspec validate --strict` 的待批变更；进入实现前需要人工批准

- [ ] **Step 1: 写 proposal.md**

```markdown
# 变更：让动画面板脱离原型约束

## 原因

`add-animation-panel-prototype` 交付了可操作的本地动画会话，但代码评审发现四处结构性限制：
面板只在深色主题下可读、动画片段没有轨道归属、演示数据的本地化被编进组件、以及基础控件没有
复用 `@compose-ui/components`。这些都涉及公共 API 或架构边界，必须先立规范再实现。

## 变更内容

- 把 `styles.css` 中硬编码的前景色全部换成 `--compose-*` token，使面板在 light 与 dark 下都可读。
- **BREAKING** 给 `ComposeAnimationClip` 增加必填 `trackId`，删除按 label 猜测轨道归属的启发式。
- 删除 `displayTrackLabel` / `displayPropertyLabel` 的 id 白名单，改由宿主提供本地化 label。
- 时间线与属性面板的按钮、数值输入与颜色字段改用 `@compose-ui/components`。
- 轨道名列表与关键帧轨道共用同一条垂直滚动，消除多轨道时的行错位。
- 用 `ComposeContextMenu` 重新提供轨道与属性行的“更多操作”菜单。

## 影响

- 受影响规范：`animation-panel`
- 受影响代码：`packages/animation-panel`（全部源文件）、`packages/animation-panel/package.json`
  （新增 `@compose-ui/components` 依赖）、`apps/storybook`
```

- [ ] **Step 2: 写 design.md**

```markdown
## 上下文

动画面板当前是与文档解耦的原型，会话数据只活在 React 内存中。评审确认它在主题、数据模型和
组件复用三个维度上都还停在"对齐参考图"的阶段，而这三项都会影响未来接入真实动画协议时的形状。

## 目标/非目标

- 目标：让面板在两种主题下都可用；让片段与轨道的关系成为显式数据；让基础控件回到共享组件层。
- 非目标：不在本变更中引入动画持久化协议、不接入 ComposeDocument、不实现真实的属性驱动。

## 决策

- 决策：`ComposeAnimationClip.trackId` 设为必填而非可选。可选字段会让"猜测归属"的分支永远留在
  代码里，与删除启发式的目标矛盾。包仍是 `0.1.0` 且未发布，破坏性变更成本可接受。
- 决策：本地化 label 由宿主提供，包内不再内置任何演示文案映射。`createDefaultComposeAnimationPanelValue`
  改为接受可选的 label 参数，默认值保持英文标识符。
- 考虑过的替代方案：为演示数据引入一套 message id 机制 —— 会把 i18n 协议塞进一个原型包，与
  `ui-context` 的既有职责重叠。

## 风险/权衡

- 主题 token 化后深色观感可能与 `design/animation.png` 出现细微偏差 → 以 Storybook 双主题快照复核。
- 双栏共用滚动需要重排 DOM 结构 → 先补齐行对齐的组件测试，再动布局。

## 迁移计划

包尚未发布，宿主只有仓库内的 `editor` 与 `storybook`；随本变更一次性更新调用点即可，无需兼容期。

## 待解决问题

- “更多操作”菜单应提供哪些具体动作？需要产品确认后再定义 Scenario。
```

- [ ] **Step 3: 写 specs/animation-panel/spec.md**

```markdown
## ADDED Requirements

### Requirement: 双主题可读的动画面板

动画面板 MUST 只通过 `@compose-ui/ui-context` 的语义 token 表达颜色，在 light 与 dark 两种解析
主题下都保持正文、标尺、关键帧与曲线的可读对比度；包内 MUST NOT 硬编码第一方 chrome 前景色。

#### Scenario: 浅色主题下渲染时间线

- **WHEN** 宿主以 `theme="light"` 渲染时间线与属性面板
- **THEN** 标尺文字、属性行文字、曲线路径与片段条均相对背景可读
- **AND** 组件不出现浅色背景配浅色前景的组合

### Requirement: 片段与轨道的显式归属

`ComposeAnimationClip` MUST 通过必填 `trackId` 声明所属对象轨道。时间线 MUST 只在对应轨道行渲染
其片段，选择片段与选择轨道的联动 MUST NOT 依赖 label 文本或 ID 前缀匹配。

#### Scenario: 多轨道各自显示自己的片段

- **WHEN** 会话包含两条对象轨道，且每条各有一个片段
- **THEN** 每个片段只渲染在自己 `trackId` 对应的轨道行
- **AND** 选择任一片段会选中同 `trackId` 的对象轨道

### Requirement: 由宿主提供的轨道文案

包 MUST NOT 内置任何按 ID 匹配的演示文案映射。轨道与属性的显示名 MUST 直接来自会话数据的
`label`，宿主负责按自身语言提供。

#### Scenario: 自定义轨道在英文环境下显示宿主文案

- **WHEN** 宿主以 `en-US` 渲染并提供 label 为 `Opacity` 的属性轨道
- **THEN** 左侧名称列与关键帧可访问名称都显示 `Opacity`
- **AND** 组件不把它替换成任何内置文案

### Requirement: 复用共享交互组件

时间线与属性面板的按钮、数值输入与颜色字段 MUST 使用 `@compose-ui/components` 的 Primitive，
不得在包内维护第二套基础控件实现。

#### Scenario: 颜色字段使用共享取色器

- **WHEN** 用户在属性面板编辑关键帧颜色
- **THEN** 使用与其他第一方面板一致的 `ComposeColorPicker` 交互
- **AND** 键盘与焦点行为与其他面板保持一致

### Requirement: 轨道名与关键帧轨道的滚动对齐

轨道名列表与关键帧轨道 MUST 共用同一条垂直滚动，任意滚动位置与任意轨道数量下，左右两侧的同一
轨道 MUST 保持在同一行。

#### Scenario: 多轨道滚动后仍然对齐

- **WHEN** 会话包含超出可视高度的轨道并向下滚动
- **THEN** 左侧轨道名与右侧关键帧轨道保持逐行对应
- **AND** 右侧出现横向滚动条时不产生额外的纵向偏移
```

- [ ] **Step 4: 写 tasks.md**

```markdown
## 1. 主题

- [ ] 1.1 Red：为 light 主题下的关键前景色写组件测试或 Storybook 双主题故事。
- [ ] 1.2 Green：把 `styles.css` 的硬编码前景色替换为 `--compose-*` token。

## 2. 片段归属

- [ ] 2.1 Red：为多轨道各自渲染片段、选择片段联动轨道写模型与组件测试。
- [ ] 2.2 Green：给 `ComposeAnimationClip` 增加必填 `trackId`，删除 label / 前缀启发式。
- [ ] 2.3 更新 `createDefaultComposeAnimationPanelValue` 与 Storybook 夹具。

## 3. 文案归属

- [ ] 3.1 Red：为宿主自定义 label 在 en-US 下的显示写测试。
- [ ] 3.2 Green：删除 `displayTrackLabel` / `displayPropertyLabel` 及相关 messages。

## 4. 复用共享组件

- [ ] 4.1 给 `packages/animation-panel/package.json` 增加 `@compose-ui/components` 依赖并在 vite 外置。
- [ ] 4.2 Green：按钮、数值输入与颜色字段改用共享 Primitive。
- [ ] 4.3 用 `ComposeContextMenu` 重新提供轨道与属性行的“更多操作”菜单。

## 5. 滚动对齐

- [ ] 5.1 Red：为超出可视高度的多轨道滚动对齐写测试。
- [ ] 5.2 Green：重排双栏结构，共用同一条垂直滚动。

## 6. 验证

- [ ] 6.1 运行包内 lint / typecheck / test / build 与仓库根全量验证。
- [ ] 6.2 运行 `bun run test:e2e`。
- [ ] 6.3 `openspec validate update-animation-panel-foundation --strict`。
```

- [ ] **Step 5: 校验并提交**

Run: `cd /Users/rongts/react-compose-ui && openspec validate update-animation-panel-foundation --strict`
Expected: PASS。

```bash
git add openspec/changes/update-animation-panel-foundation
git commit -m "docs(openspec): 起草动画面板脱离原型约束的提案"
```

---

## 自查

**写计划期间新发现：** `scripts/check-react-component-architecture.mjs` 的 `visualPackages` 白名单里没有
`animation-panel`，该包的目录规范、公共入口与跨包导入检查一直被整体跳过 —— 已并入 Task 9 Step 6，
并实测注册后当前源码直接通过。

**规范覆盖：** 评审结论的 22 条中，1～4（功能缺陷）由 Task 1～3 覆盖；9～13（可访问性）由 Task 4～7 覆盖；5、6（规范与文档）由 Task 9 覆盖；17、18、22 与死样式由 Task 8 覆盖；7、8、14、15、16 与"更多操作"菜单按决定移入 Task 10 的待批提案；21（`getComposeAnimationClips` 引用抖动）与 20（拖拽经过占用时间时的粘滞）在 Global Constraints 中显式声明不修 —— 前者无消费者依赖引用相等，后者是冲突阻止的固有表现，且 Task 7 已为它补上反馈。

**类型一致性：** `CommittedInput` 的 `onCommit: (draft: string) => boolean` 在 Task 3 定义，Task 3 的三处调用点与 Task 7 的 `aria-describedby` 用法一致；`updateSelectedKeyframe` 在 Task 3 改为返回 `boolean`，Task 8 的 `useMemo` 依赖数组包含它；Task 1 产出的稳定 `commit` 是 Task 8 记忆化的前提，顺序正确。`aria-pressed` 在 Task 4 新建的 lane-hit 上先按当时约定书写，再由 Task 5 统一转换为 `aria-current`，两处测试断言的演进已在对应步骤中写明。
