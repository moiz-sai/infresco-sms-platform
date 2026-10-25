import { z } from 'zod';

const text = (max = 200) => z.string().trim().min(1).max(max);
const optText = (max = 200) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => v || null)
    .nullish();
export const isoDate = z.iso.date();

export const schoolUpdateSchema = z.object({
  nameEn: text(),
  nameUr: optText(),
  address: optText(500),
  phone: optText(50),
});
export type SchoolUpdate = z.infer<typeof schoolUpdateSchema>;

export const yearSchema = z
  .object({
    label: text(20),
    startsOn: isoDate,
    endsOn: isoDate,
    isCurrent: z.boolean().default(false),
  })
  .refine((y) => y.startsOn < y.endsOn, {
    message: 'Start must be before end',
    path: ['endsOn'],
  });
export type YearInput = z.infer<typeof yearSchema>;

export const classSchema = z.object({
  nameEn: text(50),
  nameUr: optText(50),
  level: z.coerce.number().int().min(0).max(20),
});
export type ClassInput = z.infer<typeof classSchema>;

export const sectionSchema = z.object({
  classId: z.uuid(),
  yearId: z.uuid(),
  name: text(20),
  classTeacherId: z.uuid().nullish(),
});
export type SectionInput = z.infer<typeof sectionSchema>;

export const sectionListQuerySchema = z.object({
  yearId: z.uuid().optional(),
  classId: z.uuid().optional(),
});
export type SectionListQuery = z.infer<typeof sectionListQuerySchema>;

export interface School {
  id: string;
  nameEn: string;
  nameUr: string | null;
  address: string | null;
  phone: string | null;
  devicePrefix: string;
}
export interface Year {
  id: string;
  label: string;
  startsOn: string;
  endsOn: string;
  isCurrent: boolean;
}
export interface SchoolClass {
  id: string;
  nameEn: string;
  nameUr: string | null;
  level: number;
}
export interface Section {
  id: string;
  classId: string;
  yearId: string;
  name: string;
  classTeacherId: string | null;
}
