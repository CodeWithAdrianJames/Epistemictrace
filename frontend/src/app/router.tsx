import { Outlet, type RouteObject } from 'react-router'
import LoginPage from '../auth/LoginPage.tsx'
import RegisterPage from '../auth/RegisterPage.tsx'
import ActivityEditPage from '../features/activities/ActivityEditPage.tsx'
import ActivityListPage from '../features/activities/ActivityListPage.tsx'
import ActivityNewPage from '../features/activities/ActivityNewPage.tsx'
import StudentActivityListPage from '../features/activities/StudentActivityListPage.tsx'
import HistoryListPage from '../features/history/HistoryListPage.tsx'
import SessionDetailPage from '../features/history/SessionDetailPage.tsx'
import WorkspacePage from '../features/workspace/WorkspacePage.tsx'
import AppLayout from './AppLayout.tsx'
import GuestOnly from './GuestOnly.tsx'
import HomeRedirect from './HomeRedirect.tsx'
import PlaceholderPage from './PlaceholderPage.tsx'
import RequireRole from './RequireRole.tsx'

// Routes without a feature page yet render a placeholder until their spec replaces it.
// The role guards are pathless layout routes, so they add no URL segment and match nothing on their own.
export const routes: RouteObject[] = [
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <HomeRedirect /> },
      {
        path: 'login',
        element: (
          <GuestOnly>
            <LoginPage />
          </GuestOnly>
        ),
      },
      {
        path: 'register',
        element: (
          <GuestOnly>
            <RegisterPage />
          </GuestOnly>
        ),
      },
      {
        element: (
          <RequireRole role="STUDENT">
            <Outlet />
          </RequireRole>
        ),
        children: [
          { path: 'student/activities', element: <StudentActivityListPage /> },
          {
            path: 'student/activities/:activityId',
            element: <WorkspacePage />,
            handle: { fullWidth: true },
          },
          { path: 'student/history', element: <HistoryListPage /> },
          { path: 'student/history/:sessionId', element: <SessionDetailPage /> },
        ],
      },
      {
        element: (
          <RequireRole role="INSTRUCTOR">
            <Outlet />
          </RequireRole>
        ),
        children: [
          { path: 'instructor/activities', element: <ActivityListPage /> },
          { path: 'instructor/activities/new', element: <ActivityNewPage /> },
          { path: 'instructor/activities/:activityId', element: <ActivityEditPage /> },
        ],
      },
      { path: '*', element: <PlaceholderPage title="Page not found" /> },
    ],
  },
]
