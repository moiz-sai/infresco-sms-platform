import type { KeyboardEvent } from 'react'
import type { ZodType } from 'zod'

export type FieldErrors = Record<string, string>

export function validate<T>(
  schema: ZodType<T>,
  value: unknown,
): { ok: true; data: T } | { ok: false; errors: FieldErrors } {
  const result = schema.safeParse(value)
  if (result.success) return { ok: true, data: result.data }
  const errors: FieldErrors = {}
  for (const issue of result.error.issues) {
    errors[issue.path.join('.')] ??= issue.message
  }
  return { ok: false, errors }
}

// SPEC §3: every form saves on Ctrl+Enter.
export function submitOnCtrlEnter(e: KeyboardEvent<HTMLFormElement>) {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
    e.preventDefault()
    e.currentTarget.requestSubmit()
  }
}

export const today = () => new Date().toLocaleDateString('en-CA')
