import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AdminRoute } from '@/components/AdminRoute';
import { Layout } from '@/components/Layout';
import { AdminPage } from '@/pages/AdminPage';
import { CatalogPage } from '@/pages/CatalogPage';
import { LoginPage } from '@/pages/LoginPage';
import { BooksTab } from '@/features/admin/BooksTab';
import { DashboardTab } from '@/features/admin/DashboardTab';
import { LoansTab } from '@/features/admin/LoansTab';
import { ReadersTab } from '@/features/admin/ReadersTab';

export function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<CatalogPage />} />
          <Route path="/login" element={<LoginPage />} />

          {/* Every admin section is its own address: /admin/books, /admin/loans, ... */}
          <Route
            path="/admin"
            element={
              <AdminRoute>
                <AdminPage />
              </AdminRoute>
            }
          >
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<DashboardTab />} />
            <Route path="books" element={<BooksTab />} />
            <Route path="readers" element={<ReadersTab />} />
            <Route path="loans" element={<LoansTab />} />
          </Route>

          {/* Anything unknown goes back to the catalog rather than showing a blank page. */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
