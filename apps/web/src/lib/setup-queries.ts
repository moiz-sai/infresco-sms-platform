import type { SchoolClass } from '@sms/shared'
import { useQuery } from '@tanstack/react-query'
import { api } from './api'

export interface SectionInfo {
  id: string
  name: string
  classId: string
  classNameEn: string
  classNameUr: string | null
  classLevel: number
  yearId: string
  yearLabel: string
}

export function useClasses() {
  return useQuery({ queryKey: ['classes'], queryFn: () => api.get<SchoolClass[]>('/classes') })
}

// Sections of the current year, or of `yearId` (optionally one class).
export function useSections(classId?: string, yearId?: string) {
  return useQuery({
    queryKey: ['sections', classId ?? 'all', yearId ?? 'current'],
    queryFn: () => api.get<SectionInfo[]>('/sections', { classId, yearId }),
  })
}
