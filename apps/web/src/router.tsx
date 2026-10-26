import { createBrowserRouter } from 'react-router'
import { Home, RequireAuth, RequirePermission } from '@/components/RequireAuth'
import { Shell } from '@/components/Shell'
import { AdmissionPage } from '@/pages/AdmissionPage'
import { ApprovalsPage } from '@/pages/ApprovalsPage'
import { AuditPage } from '@/pages/AuditPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { DefaultersPage } from '@/pages/DefaultersPage'
import { CashClosePage } from '@/pages/CashClosePage'
import { AttendancePage } from '@/pages/AttendancePage'
import { AttendanceRegisterPage } from '@/pages/AttendanceRegisterPage'
import { FeeCollectionPage } from '@/pages/FeeCollectionPage'
import { FeeSetupPage } from '@/pages/FeeSetupPage'
import { ReceiptPrintPage } from '@/pages/ReceiptPrintPage'
import { LoginPage } from '@/pages/LoginPage'
import { PromotePage } from '@/pages/PromotePage'
import { SettingsPage } from '@/pages/SettingsPage'
import { SetupPage } from '@/pages/SetupPage'
import { StudentProfilePage } from '@/pages/StudentProfilePage'
import { StudentsPage } from '@/pages/StudentsPage'
import { UsersPage } from '@/pages/UsersPage'

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <RequirePermission perm="fees.collect" />,
        children: [{ path: 'print/receipt/:id', element: <ReceiptPrintPage /> }],
      },
      {
        element: <Shell />,
        children: [
          { index: true, element: <Home /> },
          {
            element: <RequirePermission perm="dashboard.view" />,
            children: [{ path: 'dashboard', element: <DashboardPage /> }],
          },
          {
            element: <RequirePermission perm="students.view" />,
            children: [
              { path: 'students', element: <StudentsPage /> },
              { path: 'students/:id', element: <StudentProfilePage /> },
            ],
          },
          {
            element: <RequirePermission perm="students.edit" />,
            children: [{ path: 'students/new', element: <AdmissionPage /> }],
          },
          {
            element: <RequirePermission perm="students.promote" />,
            children: [{ path: 'students/promote', element: <PromotePage /> }],
          },
          {
            element: <RequirePermission perm="attendance.mark" />,
            children: [{ path: 'attendance', element: <AttendancePage /> }],
          },
          {
            element: <RequirePermission perm="attendance.view" />,
            children: [{ path: 'attendance/register', element: <AttendanceRegisterPage /> }],
          },
          {
            element: <RequirePermission perm="fees.collect" />,
            children: [{ path: 'fees/collect', element: <FeeCollectionPage /> }],
          },
          {
            element: <RequirePermission perm="fees.cash_close" />,
            children: [{ path: 'fees/cash-close', element: <CashClosePage /> }],
          },
          {
            element: <RequirePermission perm="fees.defaulters" />,
            children: [{ path: 'fees/defaulters', element: <DefaultersPage /> }],
          },
          {
            element: <RequirePermission perm="fees.configure" />,
            children: [{ path: 'fees/setup', element: <FeeSetupPage /> }],
          },
          {
            element: <RequirePermission perm="approvals.decide" />,
            children: [{ path: 'approvals', element: <ApprovalsPage /> }],
          },
          {
            element: <RequirePermission perm="setup.manage" />,
            children: [{ path: 'setup', element: <SetupPage /> }],
          },
          {
            element: <RequirePermission perm="settings.manage" />,
            children: [{ path: 'settings', element: <SettingsPage /> }],
          },
          {
            element: <RequirePermission perm="users.manage" />,
            children: [{ path: 'users', element: <UsersPage /> }],
          },
          {
            element: <RequirePermission perm="audit.view" />,
            children: [{ path: 'audit', element: <AuditPage /> }],
          },
          { path: '*', element: <Home /> },
        ],
      },
    ],
  },
])
