import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  SimpleGrid,
  Card,
  Text,
  Title,
  Group,
  ThemeIcon,
  Stack,
  Badge,
  Table,
  Center,
  Loader,
} from "@mantine/core";
import { IconBox, IconTruck, IconUsers, IconAlertTriangle } from "@tabler/icons-react";
import { api } from "../lib/api";
import { formatarNumero } from "../lib/formato";
import type { Produto, RespostaLista } from "../lib/tipos";

function useTotal(recurso: string) {
  return useQuery({
    queryKey: [recurso, "total"],
    queryFn: async () => {
      const r = await api.get<{ paginacao: { total: number } }>(`/${recurso}?porPagina=1`);
      return r.paginacao.total;
    },
  });
}

function CartaoResumo({
  titulo,
  valor,
  cor,
  icone: Icone,
  para,
}: {
  titulo: string;
  valor?: number;
  cor: string;
  icone: typeof IconBox;
  para: string;
}) {
  return (
    <Card component={Link} to={para} withBorder padding="lg" radius="md">
      <Group>
        <ThemeIcon size="xl" radius="md" variant="light" color={cor}>
          <Icone size={26} />
        </ThemeIcon>
        <div>
          <Text size="sm" c="dimmed">
            {titulo}
          </Text>
          <Text fw={700} size="xl">
            {valor ?? "—"}
          </Text>
        </div>
      </Group>
    </Card>
  );
}

export function DashboardPage() {
  const produtos = useTotal("produtos");
  const clientes = useTotal("clientes");
  const fornecedores = useTotal("fornecedores");

  const { data: listaProdutos, isLoading } = useQuery({
    queryKey: ["produtos", "estoque-baixo"],
    queryFn: () => api.get<RespostaLista<Produto>>("/produtos?porPagina=100"),
  });

  const estoqueBaixo = (listaProdutos?.dados ?? []).filter(
    (p) => Number(p.saldoEstoque) <= Number(p.estoqueMinimo)
  );

  return (
    <Stack gap="lg">
      <div>
        <Title order={2}>Bem-vindo 👋</Title>
        <Text c="dimmed">Resumo da loja 4 Irmãos</Text>
      </div>

      <SimpleGrid cols={{ base: 1, sm: 3 }}>
        <CartaoResumo
          titulo="Produtos"
          valor={produtos.data}
          cor="blue"
          icone={IconBox}
          para="/produtos"
        />
        <CartaoResumo
          titulo="Clientes"
          valor={clientes.data}
          cor="grape"
          icone={IconUsers}
          para="/clientes"
        />
        <CartaoResumo
          titulo="Fornecedores"
          valor={fornecedores.data}
          cor="teal"
          icone={IconTruck}
          para="/fornecedores"
        />
      </SimpleGrid>

      <Card withBorder padding="lg" radius="md">
        <Group mb="sm">
          <ThemeIcon variant="light" color="red" radius="md">
            <IconAlertTriangle size={18} />
          </ThemeIcon>
          <Title order={4}>Estoque baixo</Title>
          {estoqueBaixo.length > 0 && (
            <Badge color="red" variant="light">
              {estoqueBaixo.length}
            </Badge>
          )}
        </Group>

        {isLoading ? (
          <Center py="md">
            <Loader size="sm" />
          </Center>
        ) : estoqueBaixo.length === 0 ? (
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
              {estoqueBaixo.map((p) => (
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
