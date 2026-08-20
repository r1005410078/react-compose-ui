import type {
  ComposeStagePolicy,
  ComposeStageProps,
  ComposeStageServices,
} from '@compose-ui/stage'

/**
 * 宿主对 controller 计算的 Stage 属性的覆盖。
 *
 * @remarks
 * `services` 与 `policy` 是聚合对象，宿主通常只覆盖其中一两个字段，因此这里放宽为
 * `Partial`：合并按字段进行，覆盖一个端口不会抹掉 controller 提供的其余端口。
 *
 * @public
 */
export type ComposeEditorStageOverrides =
  & Omit<Partial<ComposeStageProps>, 'services' | 'policy'>
  & {
    readonly services?: Partial<ComposeStageServices>
    readonly policy?: Partial<ComposeStagePolicy>
  }

/**
 * 把宿主覆盖合并到 controller 计算的 Stage 属性上。
 *
 * @remarks
 * 覆盖优先级由签名表达：`overrides` 一侧永远胜出，包括显式传入的 `undefined`——这与它替代的
 * `cloneElement` 展开语义一致，宿主借此清除 controller 的默认值（例如没有页面会话时把
 * `scriptScope` 清空）。`services` 与 `policy` 各自再做一层同样语义的展开，因此宿主只需
 * 给出要改的字段。
 *
 * @public
 */
export function composeEditorStageProps(
  base: ComposeStageProps,
  overrides: ComposeEditorStageOverrides,
): ComposeStageProps {
  const { services, policy, ...flat } = overrides
  return {
    ...base,
    ...flat,
    services: services ? { ...base.services, ...services } : base.services,
    policy: policy ? { ...base.policy, ...policy } : base.policy,
  }
}
