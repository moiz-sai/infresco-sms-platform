import { enrollmentStatuses, type Page, type StudentListItem } from '@sms/shared'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from '@tanstack/react-table'
import { Search, UserPlus } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { api } from '@/lib/api'
import { useCan } from '@/lib/auth'
import { useLocalName } from '@/lib/i18n-helpers'
import { useClasses, useSections } from '@/lib/setup-queries'

const PAGE_SIZE = 25

export function StudentsPage() {
  const { t } = useTranslation()
  const name = useLocalName()
  const can = useCan()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''
  const classId = params.get('classId') ?? ''
  const sectionId = params.get('sectionId') ?? ''
  const status = params.get('status') ?? 'active'
  const page = Number(params.get('page') ?? '1')
  const [search, setSearch] = useState(q)
  const searchRef = useRef<HTMLInputElement>(null)
  const rowsRef = useRef<HTMLTableSectionElement>(null)

  const update = (patch: Record<string, string>) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        for (const [k, v] of Object.entries(patch)) {
          if (v) next.set(k, v)
          else next.delete(k)
        }
        if (!('page' in patch)) next.delete('page')
        return next
      },
      { replace: true },
    )

  useEffect(() => {
    if (search === q) return
    const id = setTimeout(
      () =>
        setParams(
          (prev) => {
            const next = new URLSearchParams(prev)
            if (search) next.set('q', search)
            else next.delete('q')
            next.delete('page')
            return next
          },
          { replace: true },
        ),
      300,
    )
    return () => clearTimeout(id)
  }, [search, q, setParams])

  const classes = useClasses()
  const sections = useSections(classId || undefined)
  const list = useQuery({
    queryKey: ['students', { q, classId, sectionId, status, page }],
    queryFn: () =>
      api.get<Page<StudentListItem>>('/students', {
        q,
        classId,
        sectionId,
        status,
        page,
        size: PAGE_SIZE,
      }),
    placeholderData: keepPreviousData,
  })

  const columns = useMemo<ColumnDef<StudentListItem>[]>(
    () => [
      { header: t('students.admissionNo'), accessorKey: 'admissionNo' },
      {
        header: t('students.name'),
        cell: ({ row }) => name(row.original.nameEn, row.original.nameUr),
      },
      { header: t('students.fatherName'), cell: ({ row }) => row.original.fatherName ?? '' },
      {
        header: t('students.class'),
        cell: ({ row }) =>
          `${name(row.original.classNameEn, row.original.classNameUr)} — ${row.original.sectionName}`,
      },
      { header: t('students.rollNo'), cell: ({ row }) => row.original.rollNo ?? '' },
      { header: t('students.phone'), cell: ({ row }) => row.original.phone ?? '' },
    ],
    [t, name],
  )
  const table = useReactTable({
    data: list.data?.items ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
  })
  const pages = Math.max(1, Math.ceil((list.data?.total ?? 0) / PAGE_SIZE))

  // Grid keys (SPEC §3): ↑/↓ move between rows, Enter opens the profile.
  function onRowKey(e: KeyboardEvent<HTMLTableRowElement>, index: number, studentId: string) {
    const rows = rowsRef.current?.querySelectorAll<HTMLTableRowElement>('tr[data-row]')
    if (e.key === 'ArrowDown') rows?.[index + 1]?.focus()
    else if (e.key === 'ArrowUp') {
      if (index === 0) searchRef.current?.focus()
      else rows?.[index - 1]?.focus()
    } else if (e.key === 'Enter') void navigate(`/students/${studentId}`)
    else return
    e.preventDefault()
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="me-auto text-xl font-semibold">{t('students.title')}</h1>
        {can('students.edit') && (
          <Button asChild>
            <Link to="/students/new">
              <UserPlus />
              {t('nav.admission')}
            </Link>
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-60 flex-1">
          <Search className="pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={searchRef}
            className="ps-8"
            placeholder={t('students.search')}
            value={search}
            autoFocus
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                rowsRef.current?.querySelector<HTMLTableRowElement>('tr[data-row]')?.focus()
              }
            }}
          />
        </div>
        <NativeSelect
          value={classId}
          onChange={(e) => update({ classId: e.target.value, sectionId: '' })}
        >
          <NativeSelectOption value="">{t('students.allClasses')}</NativeSelectOption>
          {classes.data?.map((c) => (
            <NativeSelectOption key={c.id} value={c.id}>
              {name(c.nameEn, c.nameUr)}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <NativeSelect value={sectionId} onChange={(e) => update({ sectionId: e.target.value })}>
          <NativeSelectOption value="">{t('students.allSections')}</NativeSelectOption>
          {sections.data?.map((s) => (
            <NativeSelectOption key={s.id} value={s.id}>
              {classId ? s.name : `${name(s.classNameEn, s.classNameUr)} — ${s.name}`}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <NativeSelect value={status} onChange={(e) => update({ status: e.target.value })}>
          {enrollmentStatuses.map((s) => (
            <NativeSelectOption key={s} value={s}>
              {t(`students.status.${s}`)}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((h) => (
                  <TableHead key={h.id} className="text-start">
                    {flexRender(h.column.columnDef.header, h.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody ref={rowsRef}>
            {table.getRowModel().rows.map((row, i) => (
              <TableRow
                key={row.id}
                data-row
                tabIndex={0}
                className="cursor-pointer focus:bg-accent focus:outline-none"
                onClick={() => void navigate(`/students/${row.original.studentId}`)}
                onKeyDown={(e) => onRowKey(e, i, row.original.studentId)}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))}
            {list.data && list.data.items.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="py-8 text-center text-muted-foreground"
                >
                  {t('students.empty')}
                </TableCell>
              </TableRow>
            )}
            {list.isPending && (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="py-8 text-center text-muted-foreground"
                >
                  {t('app.loading')}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="me-auto text-muted-foreground">
          {t('students.total', { count: list.data?.total ?? 0 })}
        </span>
        <span>{t('students.page', { page, pages })}</span>
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => update({ page: String(page - 1) })}
        >
          {t('students.prev')}
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= pages}
          onClick={() => update({ page: String(page + 1) })}
        >
          {t('students.next')}
        </Button>
      </div>
    </div>
  )
}
