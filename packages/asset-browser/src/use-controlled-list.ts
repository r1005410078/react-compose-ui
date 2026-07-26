import { useCallback, useState } from 'react'

export function useControlledList(
  controlled: readonly string[] | undefined,
  initial: readonly string[] | undefined,
  onChange?: (value: readonly string[]) => void,
) {
  const [internal, setInternal] = useState<readonly string[]>(initial ?? [])
  const value = controlled ?? internal
  const setValue = useCallback((next: readonly string[]) => {
    if (controlled === undefined) setInternal(next)
    onChange?.(next)
  }, [controlled, onChange])
  return [value, setValue] as const
}
