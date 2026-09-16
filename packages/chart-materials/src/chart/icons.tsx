import type { COMPOSE_CHART_KINDS } from './props'

/** 三种图各自的物料面板图标；与其它物料共用 20×20 画幅。 @internal */
export function ComposeChartMaterialIcon({ kind }: {
  readonly kind: (typeof COMPOSE_CHART_KINDS)[number]
}) {
  return (
    <svg aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 20 20">
      {kind === 'line' ? <polyline points="3,14 7,9 11,12 17,5" /> : null}
      {kind === 'bar' ? (
        <>
          <rect height="7" width="3" x="3.5" y="9" />
          <rect height="11" width="3" x="8.5" y="5" />
          <rect height="5" width="3" x="13.5" y="11" />
        </>
      ) : null}
      {kind === 'pie' ? (
        <>
          <circle cx="10" cy="10" r="6.2" />
          <path d="M10 3.8v6.2h6.2" />
        </>
      ) : null}
    </svg>
  )
}
