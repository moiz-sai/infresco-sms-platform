import { createBrowserRouter, Navigate } from 'react-router'
import { RequireAuth, RequirePermission } from '@/components/RequireAuth'
import { Shell } from '@/components/Shell'
import { AdmissionPage } from '@/pages/AdmissionPage'
import { AttendancePage } from '@/pages/AttendancePage'
import { AttendanceRegisterPage } from '@/pages/AttendanceRegisterPage'
import { LoginPage } from '@/pages/LoginPage'
import { SetupPage } from '@/pages/SetupPage'
import { StudentProfilePage } from '@/pages/StudentProfilePage'
import { StudentsPage } from '@/pages/StudentsPage'

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <Shell />,
        children: [
          { index: true, element: <Navigate to="/students" replace /> },
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
            element: <RequirePermission perm="attendance.mark" />,
            children: [{ path: 'attendance', element: <AttendancePage /> }],
          },
          {
            element: <RequirePermission perm="attendance.view" />,
            children: [{ path: 'attendance/register', element: <AttendanceRegisterPage /> }],
          },
          {
            element: <RequirePermission perm="settings.manage" />,
            children: [{ path: 'setup', element: <SetupPage /> }],
          },
          { path: '*', element: <Navigate to="/students" replace /> },
        ],
      },
    ],
  },
])
