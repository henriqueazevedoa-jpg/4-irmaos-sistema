import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Stack,
  Group,
  Title,
  SegmentedControl,
  SimpleGrid,
  Card,
  Text,
  Table,
  Badge,
  ThemeIcon,
  Center,
  Loader,
  Anchor,
} from "@mantine/core";
import {
  IconCash,
  IconShoppingCart,
  IconReceipt2,
  IconAlertTriangle,
  IconCoin,
} from "@tabler/icons-react";
import { api, query } from "../lib/api";
import { formatarMoeda, formatarNumero } from "../lib/formato";
import { LABEL_FORMA } from "../lib/pagamento";
import type { FormaPagamento } from "../lib/tipos";

interface RelatorioVendas {
  totalVendas: number;
  valorTotal: string;
  ticketMedio: string;
  porForma: { forma: FormaPagamento; total: string }[];
  maisVendidos: {
    produtoId: string;
    descricao: string;
    unidade: string;
    quantidade: string;
    total: string;
  }[];
}

interface RelatorioFinanceiro {
  contasReceber: {
    total: string;
    clientes: { id: string; nome: string; saldoConta: string; telefone: string | null }[];
  };
  estoqueBaixo: {
    id: string;
    descricao: string;
    unidade: string;
    saldoEstoque: string;
    estoqueMinimo: string;
  }[];
}

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function calcularPeriodo(preset: string): { de: string; ate: string } {
  const ate = new Date();
  const de = new Date();
  if (preset === "7") de.setDate(de.getDate() - 6);
  else if (preset === "30") de.setDate(de.getDate() - 29);
  else if (preset === "mes") de.setDate(1);
  return { de: iso(de), ate: iso(ate) };
}

function CartaoResumo({
  titulo,
  valor,
  cor,
  icone: Icone,
}: {
  titulo: string;
  valor: string;
  cor: string;
  icone: typeof IconCash;
}) {
  return (
    <Card withBorder radius="md" padding="lg">
      <Group>
        <ThemeIcon size="xl" radius="md" variant="light" color={cor}>
          <Icone size={26} />
        </ThemeIcon>
        <div>
          <Text size="sm" c="dimmed">
            {titulo}
          </Text>
          <Text fw={700} size="xl">
            {valor}
          </Text>
        </div>
      </Group>
    </Card>
  );
}

export function RelatoriosPage() {
  const navegar = useNavigate();
  const [preset, setPreset] = useState("30");
  const periodo = calcularPeriodo(preset);

  const { data: vendas, isLoading: carregandoVendas } = useQuery({
    queryKey: ["relatorios", "vendas", periodo],
    queryFn: () => api.get<RelatorioVendas>(`/relatorios/vendas${query(periodo)}`),
  });

  const { data: financeiro } = useQuery({
    queryKey: ["relatorios", "financeiro"],
    queryFn: () => api.get<RelatorioFinanceiro>("/relatorios/financeiro"),
  });

  return (
    <Stack gap="lg">
      <Group justify="space-between" wrap="wrap">
        <Title order={2}>Relatórios</Title>
        <SegmentedControl
          value={preset}
          onChange={setPreset}
          data={[
            { label: "7 dias", value: "7" },
            { label: "30 dias", value: "30" },
            { label: "Este mês", value: "mes" },
          ]}
        />
      </Group>

      {/* Resumo de vendas do período */}
      {carregandoVendas || !vendas ? (
        <Center py="xl">
          <Loader />
        </Center>
      ) : (
        <>
          <SimpleGrid cols={{ base: 1, sm: 3 }}>
            <CartaoResumo
              titulo="Vendido no período"
              valor={formatarMoeda(vendas.valorTotal)}
              cor="teal"
              icone={IconCash}
            />
            <CartaoResumo
              titulo="Nº de vendas"
              valor={String(vendas.totalVendas)}
              cor="blue"
              icone={IconShoppingCart}
            />
            <CartaoResumo
              titulo="Ticket médio"
              valor={formatarMoeda(vendas.ticketMedio)}
              cor="grape"
              icone={IconReceipt2}
            />
          </SimpleGrid>

          <SimpleGrid cols={{ base: 1, md: 2 }}>
            <Card withBorder radius="md" padding="lg">
              <Title order={4} mb="sm">
                Por forma de pagamento
              </Title>
              {vendas.porForma.length === 0 ? (
                <Text c="dimmed">Sem vendas no período.</Text>
              ) : (
                <Table>
                  <Table.Tbody>
                    {vendas.porForma.map((f) => (
                      <Table.Tr key={f.forma}>
                        <Table.Td>{LABEL_FORMA[f.forma]}</Table.Td>
                        <Table.Td ta="right">{formatarMoeda(f.total)}</Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              )}
            </Card>

            <Card withBorder radius="md" padding="lg">
              <Title order={4} mb="sm">
                Mais vendidos
              </Title>
              {vendas.maisVendidos.length === 0 ? (
                <Text c="dimmed">Sem vendas no período.</Text>
              ) : (
                <Table>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Produto</Table.Th>
                      <Table.Th>Qtd</Table.Th>
                      <Table.Th ta="right">Total</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {vendas.maisVendidos.map((m) => (
                      <Table.Tr key={m.produtoId}>
                        <Table.Td>{m.descricao}</Table.Td>
                        <Table.Td>
                          {formatarNumero(m.quantidade)} {m.unidade}
                        </Table.Td>
                        <Table.Td ta="right">{formatarMoeda(m.total)}</Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              )}
            </Card>
          </SimpleGrid>
        </>
      )}

      {/* Contas a receber (fiado) */}
      <Card withBorder radius="md" padding="lg">
        <Group mb="sm">
          <ThemeIcon variant="light" color="orange" radius="md">
            <IconCoin size={18} />
          </ThemeIcon>
          <Title order={4}>Contas a receber (fiado em aberto)</Title>
          {financeiro && (
            <Badge color="orange" variant="light" size="lg">
              {formatarMoeda(financeiro.contasReceber.total)}
            </Badge>
          )}
        </Group>
        {!financeiro ? (
          <Center py="md">
            <Loader size="sm" />
          </Center>
        ) : financeiro.contasReceber.clientes.length === 0 ? (
          <Text c="dimmed">Ninguém está devendo. 👍</Text>
        ) : (
          <Table highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Cliente</Table.Th>
                <Table.Th>Telefone</Table.Th>
                <Table.Th ta="right">Deve</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {financeiro.contasReceber.clientes.map((c) => (
                <Table.Tr key={c.id} style={{ cursor: "pointer" }} onClick={() => navegar(`/clientes/${c.id}/conta`)}>
                  <Table.Td>
                    <Anchor component="span">{c.nome}</Anchor>
                  </Table.Td>
                  <Table.Td>{c.telefone ?? "—"}</Table.Td>
                  <Table.Td ta="right">
                    <Badge color="orange" variant="light">
                      {formatarMoeda(c.saldoConta)}
                    </Badge>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Card>

      {/* Estoque baixo */}
      <Card withBorder radius="md" padding="lg">
        <Group mb="sm">
          <ThemeIcon variant="light" color="red" radius="md">
            <IconAlertTriangle size={18} />
          </ThemeIcon>
          <Title order={4}>Estoque baixo</Title>
          {financeiro && financeiro.estoqueBaixo.length > 0 && (
            <Badge color="red" variant="light">
              {financeiro.estoqueBaixo.length}
            </Badge>
          )}
        </Group>
        {!financeiro ? (
          <Center py="md">
            <Loader size="sm" />
          </Center>
        ) : financeiro.estoqueBaixo.length === 0 ? (
          <Text c="dimmed">Nenhum produto abaixo do estoque mínimo. 👍</Text>
        ) : (
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Produto</Table.Th>
                <Table.Th>Saldo</Table.Th>
                <Table.Th>Mínimo</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {financeiro.estoqueBaixo.map((p) => (
                <Table.Tr key={p.id}>
                  <Table.Td>{p.descricao}</Table.Td>
                  <Table.Td>
                    <Badge color="red" variant="light">
                      {formatarNumero(p.saldoEstoque)} {p.unidade}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    {formatarNumero(p.estoqueMinimo)} {p.unidade}
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Card>
    </Stack>
  );
}
