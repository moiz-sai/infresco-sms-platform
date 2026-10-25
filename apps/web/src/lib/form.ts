import type { KeyboardEvent } from 'react'
import type { ZodType } from 'zod'
import i18n from '@/i18n'

export type FieldErrors = Record<string, string>

export function validate<T>(
  schema: ZodType<T>,
  value: unknown,
): { ok: true; data: T } | { ok: false; errors: FieldErrors } {
  const result = schema.safeParse(value)
  if (result.success) return { ok: true, data: result.data }
  const errors: FieldErrors = {}
  for (const issue of result.error.issues) {
    errors[issue.path.join('.')] ??= fieldError(issue)
  }
  return { ok: false, errors }
}

// Custom messages written in the shared Zod schemas → locale keys, so errors follow the UI language.
const MESSAGE_KEYS: Record<string, string> = {
  'PIN must be 4–6 digits': 'errors.pin',
  'At least 8 characters': 'errors.password',
  'Pick at least one role': 'errors.pickRole',
  'Give a new password or PIN': 'errors.passwordOrPin',
  'Start must be before end': 'errors.startBeforeEnd',
  'Percent must be 0–100': 'errors.percent',
  '2–6 letters/digits': 'errors.code',
  '3–32 letters, digits, dot, dash or underscore': 'errors.username',
  'Month must be YYYY-MM': 'errors.invalid',
  'Period must be YYYY-MM': 'errors.invalid',
}

function fieldError(issue: { code: string; message: string; minimum?: unknown; input?: unknown }) {
  const key = MESSAGE_KEYS[issue.message]
  if (key) return i18n.t(key)
  const empty = issue.input === undefined || issue.input === null || issue.input === ''
  if (empty || (issue.code === 'too_small' && issue.minimum === 1)) return i18n.t('errors.required')
  return i18n.t('errors.invalid')
}

// SPEC §3: every form saves on Ctrl+Enter.
export function submitOnCtrlEnter(e: KeyboardEvent<HTMLFormElement>) {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
    e.preventDefault()
    e.currentTarget.requestSubmit()
  }
}

export const today = () => new Date().toLocaleDateString('en-CA')
