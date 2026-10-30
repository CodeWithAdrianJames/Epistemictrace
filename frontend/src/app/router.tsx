import { Outlet, type RouteObject } from 'react-router'
import LoginPage from '../auth/LoginPage.tsx'
import RegisterPage from '../auth/RegisterPage.tsx'
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
          { path: 'student/activities', element: <PlaceholderPage title="Activities" /> },
          {
            path: 'student/activities/:activityId',
            element: <PlaceholderPage title="Activity workspace" />,
            handle: { fullWidth: true },
          },
          { path: 'student/history', element: <PlaceholderPage title="My history" /> },
          { path: 'student/history/:sessionId', element: <PlaceholderPage title="Session details" /> },
        ],
      },
      {
        element: (
          <RequireRole role="INSTRUCTOR">
            <Outlet />
          </RequireRole>
        ),
        children: [
          { path: 'instructor/activities', element: <PlaceholderPage title="My activities" /> },
          { path: 'instructor/activities/new', element: <PlaceholderPage title="New activity" /> },
          { path: 'instructor/activities/:activityId', element: <PlaceholderPage title="Edit activity" /> },
        ],
      },
      { path: '*', element: <PlaceholderPage title="Page not found" /> },
    ],
  },
]
