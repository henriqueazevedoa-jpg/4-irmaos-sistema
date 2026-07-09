import { Routes, Route, Navigate } from "react-router-dom";
import { AppLayout } from "./components/AppLayout";
import { DashboardPage } from "./pages/DashboardPage";
import { ProdutosPage } from "./pages/ProdutosPage";
import { FornecedoresPage } from "./pages/FornecedoresPage";
import { ClientesPage } from "./pages/ClientesPage";
import { FuncionariosPage } from "./pages/FuncionariosPage";
import { NotasEntradaPage } from "./pages/NotasEntradaPage";
import { NotaDetalhePage } from "./pages/NotaDetalhePage";
import { VendasPage } from "./pages/VendasPage";
import { PDVPage } from "./pages/PDVPage";
import { ContaClientePage } from "./pages/ContaClientePage";
import { RelatoriosPage } from "./pages/RelatoriosPage";
import { CaixaPage } from "./pages/CaixaPage";

export function App() {
  return (
    <AppLayout>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/vendas" element={<PDVPage />} />
        <Route path="/vendas/nova" element={<PDVPage />} />
        <Route path="/vendas/historico" element={<VendasPage />} />
        <Route path="/produtos" element={<ProdutosPage />} />
        <Route path="/entradas" element={<NotasEntradaPage />} />
        <Route path="/entradas/:id" element={<NotaDetalhePage />} />
        <Route path="/fornecedores" element={<FornecedoresPage />} />
        <Route path="/clientes" element={<ClientesPage />} />
        <Route path="/clientes/:id/conta" element={<ContaClientePage />} />
        <Route path="/funcionarios" element={<FuncionariosPage />} />
        <Route path="/relatorios" element={<RelatoriosPage />} />
        <Route path="/caixa" element={<CaixaPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppLayout>
  );
}
