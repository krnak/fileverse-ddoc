import React from 'react';
import ReactDOM from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { ThemeProvider } from '@fileverse/ui';
import App from './App.tsx';
import { NewDocument } from './routes/NewDocument.tsx';
import { AuthProvider } from './components/AuthOverlay.tsx';

const router = createBrowserRouter([
  {
    path: '/',
    element: <NewDocument />,
  },
  {
    path: '/document/:uuid',
    element: <App />,
  },
]);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </ThemeProvider>
  </React.StrictMode>,
);
