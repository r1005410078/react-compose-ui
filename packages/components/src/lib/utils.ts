import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** 合并 Shadcn primitive 使用的条件 className，并消除 Tailwind utility 冲突。 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
