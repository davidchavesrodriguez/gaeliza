import { createBrowserRouter } from 'react-router-dom'
import { RequireSession } from '../auth/RequireSession'
import { AppShell } from '../components/AppShell'
import { AnalysisWorkspacePage } from '../pages/AnalysisWorkspacePage'
import { CreateAnalysisPage } from '../pages/CreateAnalysisPage'
import { DashboardPage } from '../pages/DashboardPage'
import { LandingPage } from '../pages/LandingPage'
import { NotFoundPage } from '../pages/NotFoundPage'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <LandingPage />,
  },
  {
    element: <RequireSession />,
    children: [
      {
        path: '/app',
        element: <AppShell />,
        children: [
          {
            index: true,
            element: <DashboardPage />,
          },
          {
            path: 'new',
            element: <CreateAnalysisPage />,
          },
          {
            path: 'analyses/:analysisId',
            element: <AnalysisWorkspacePage />,
          },
        ],
      },
    ],
  },
  {
    path: '*',
    element: <NotFoundPage />,
  },
])
