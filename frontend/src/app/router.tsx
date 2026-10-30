import { Navigate, type RouteObject } from 'react-router'
import LoginPage from '../auth/LoginPage.tsx'
import RegisterPage from '../auth/RegisterPage.tsx'
import AppLayout from './AppLayout.tsx'
import PlaceholderPage from './PlaceholderPage.tsx'

// Routes without a feature page yet render a placeholder until their spec replaces it.
export const routes: RouteObject[] = [
  {
    path: '/',
    element: <AppLayout />,
    children: [
      // Spec 07 replaces this with a redirect based on the signed-in user's role.
      { index: true, element: <Navigate to="/login" replace /> },
      { path: 'login', element: <LoginPage /> },
      { path: 'register', element: <RegisterPage /> },
      { path: 'student/activities', element: <PlaceholderPage title="Activities" /> },
      {
        path: 'student/activities/:activityId',
        element: <PlaceholderPage title="Activity workspace" />,
        handle: { fullWidth: true },
      },
      { path: 'student/history', element: <PlaceholderPage title="My history" /> },
      { path: 'student/history/:sessionId', element: <PlaceholderPage title="Session details" /> },
      { path: 'instructor/activities', element: <PlaceholderPage title="My activities" /> },
      { path: 'instructor/activities/new', element: <PlaceholderPage title="New activity" /> },
      { path: 'instructor/activities/:activityId', element: <PlaceholderPage title="Edit activity" /> },
      { path: '*', element: <PlaceholderPage title="Page not found" /> },
    ],
  },
]
