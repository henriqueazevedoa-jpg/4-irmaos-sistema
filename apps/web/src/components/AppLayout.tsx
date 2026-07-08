import type { ReactNode } from "react";
import { AppShell, Group, Title, Button, ScrollArea } from "@mantine/core";
import {
  IconLayoutDashboard,
  IconShoppingCart,
  IconBox,
  IconTruck,
  IconUsers,
  IconFileImport,
  IconChartBar,
  IconCashBanknote,
} from "@tabler/icons-react";
import { Link, useLocation } from "react-router-dom";

const ITENS = [
  { rotulo: "Início", para: "/", icone: IconLayoutDashboard },
  { rotulo: "Vendas", para: "/vendas", icone: IconShoppingCart },
  { rotulo: "Caixa", para: "/caixa", icone: IconCashBanknote },
  { rotulo: "Produtos", para: "/produtos", icone: IconBox },
  { rotulo: "Entradas", para: "/entradas", icone: IconFileImport },
  { rotulo: "Fornecedores", para: "/fornecedores", icone: IconTruck },
  { rotulo: "Clientes", para: "/clientes", icone: IconUsers },
  { rotulo: "Relatórios", para: "/relatorios", icone: IconChartBar },
];

export function AppLayout({ children }: { children: ReactNode }) {
  const local = useLocation();

  return (
    <AppShell header={{ height: 96 }} padding="md">
      <AppShell.Header>
        {/* Linha 1: título */}
        <Group h={48} px="md" align="center">
          <Title order={4}>🧱 Gestão — Loja 4 Irmãos</Title>
        </Group>

        {/* Linha 2: menu horizontal (estilo barra de menu clássica) */}
        <ScrollArea type="never" style={{ borderTop: "1px solid var(--mantine-color-gray-3)", background: "var(--mantine-color-gray-0)" }}>
          <Group h={47} px="xs" gap={2} wrap="nowrap">
            {ITENS.map((item) => {
              const ativo =
                item.para === "/" ? local.pathname === "/" : local.pathname.startsWith(item.para);
              return (
                <Button
                  key={item.para}
                  component={Link}
                  to={item.para}
                  variant={ativo ? "filled" : "subtle"}
                  color={ativo ? "blue" : "gray"}
                  size="sm"
                  radius="sm"
                  leftSection={<item.icone size={16} />}
                  styles={{ root: { flexShrink: 0 }, label: { fontWeight: ativo ? 600 : 500 } }}
                >
                  {item.rotulo}
                </Button>
              );
            })}
          </Group>
        </ScrollArea>
      </AppShell.Header>

      <AppShell.Main>{children}</AppShell.Main>
    </AppShell>
  );
}
