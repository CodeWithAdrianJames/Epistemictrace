import { Navigate, type RouteObject } from 'react-router'
import AppLayout from './AppLayout.tsx'
import PlaceholderPage from './PlaceholderPage.tsx'

// Every MVP route renders a placeholder until its feature spec replaces it.
export const routes: RouteObject[] = [
  {
    path: '/',
    element: <AppLayout />,
    children: [
      // Spec 07 replaces this with a redirect based on the signed-in user's role.
      { index: true, element: <Navigate to="/login" replace /> },
      { path: 'login', element: <PlaceholderPage title="Log in" /> },
      { path: 'register', element: <PlaceholderPage title="Create an account" /> },
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
