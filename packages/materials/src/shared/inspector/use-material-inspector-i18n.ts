import { useMemo } from 'react'
import { useComposeI18nContext } from '@compose-ui/ui-context'
import { createContainerSchema, createTextSchema } from './schemas'

/** 为第一方材料 Inspector 解析共享语言、消息覆盖与本地化 Schema。 @internal */
export function useMaterialInspectorI18n() {
  const i18n = useComposeI18nContext()
  const locale = i18n?.locale ?? 'en-US'
  const formatMessage = i18n?.formatMessage
  const schemas = useMemo(() => ({
    container: createContainerSchema(locale, formatMessage),
    text: createTextSchema(locale, formatMessage),
  }), [formatMessage, locale])
  return {
    schemas,
    propertiesLabel: (name: string) => formatMessage?.(
      'materials.inspector.properties',
      locale === 'zh-CN' ? `${name} 属性` : `${name} properties`,
      { name },
    ) ?? (locale === 'zh-CN' ? `${name} 属性` : `${name} properties`),
  }
}
