import type { StudentFields } from '@sms/shared'

export type StudentDraft = {
  [K in keyof StudentFields]-?: string
}

export const emptyStudent: StudentDraft = {
  nameEn: '',
  nameUr: '',
  fatherName: '',
  gender: 'm',
  dob: '',
  bForm: '',
  phone: '',
  address: '',
}

export function toDraft(s: Partial<StudentFields>): StudentDraft {
  return Object.fromEntries(
    Object.keys(emptyStudent).map((k) => [k, s[k as keyof StudentFields] ?? '']),
  ) as StudentDraft
}

// Empty strings become null so optional fields validate.
export function fromDraft(d: StudentDraft) {
  return { ...d, dob: d.dob || null }
}
