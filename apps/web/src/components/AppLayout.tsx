import type { ReactNode } from "react";
import { AppShell, Burger, Group, Title, NavLink, ScrollArea } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
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
  { rotulo: "Entrada de mercadoria", para: "/entradas", icone: IconFileImport },
  { rotulo: "Fornecedores", para: "/fornecedores", icone: IconTruck },
  { rotulo: "Clientes", para: "/clientes", icone: IconUsers },
  { rotulo: "Relatórios", para: "/relatorios", icone: IconChartBar },
];

export function AppLayout({ children }: { children: ReactNode }) {
  const [aberto, { toggle, close }] = useDisclosure();
  const local = useLocation();

  return (
    <AppShell
      header={{ height: 60 }}
      navbar={{ width: 240, breakpoint: "sm", collapsed: { mobile: !aberto } }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md">
          <Burger opened={aberto} onClick={toggle} hiddenFrom="sm" size="sm" />
          <Title order={4}>🧱 Gestão — Loja 4 Irmãos</Title>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="md">
        <AppShell.Section grow component={ScrollArea}>
          {ITENS.map((item) => (
            <NavLink
              key={item.para}
              component={Link}
              to={item.para}
              label={item.rotulo}
              leftSection={<item.icone size={18} />}
              active={
                item.para === "/"
                  ? local.pathname === "/"
                  : local.pathname.startsWith(item.para)
              }
              onClick={close}
            />
          ))}
        </AppShell.Section>
      </AppShell.Navbar>

      <AppShell.Main>{children}</AppShell.Main>
    </AppShell>
  );
}
