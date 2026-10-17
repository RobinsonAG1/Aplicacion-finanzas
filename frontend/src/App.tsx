import { Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { ProtectedRoute } from './components/ProtectedRoute'
import { DashboardPage } from './pages/DashboardPage'
import { LoginPage } from './pages/LoginPage'
import { NotFoundPage } from './pages/NotFoundPage'
import { PlaceholderPage } from './pages/PlaceholderPage'
import { RegisterPage } from './pages/RegisterPage'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route index element={<DashboardPage />} />
          <Route path="transactions" element={<PlaceholderPage title="Transacciones" />} />
          <Route path="budgets" element={<PlaceholderPage title="Presupuestos" />} />
          <Route path="pots" element={<PlaceholderPage title="Huchas de ahorro" />} />
          <Route path="bills" element={<PlaceholderPage title="Facturas recurrentes" />} />
          <Route path="analytics" element={<PlaceholderPage title="Analítica" />} />
          <Route path="accounts" element={<PlaceholderPage title="Cuentas" />} />
          <Route path="categories" element={<PlaceholderPage title="Categorías" />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
    </Routes>
  )
}
