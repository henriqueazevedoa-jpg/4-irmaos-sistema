import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Stack,
  Group,
  Title,
  Card,
  Text,
  Table,
  Badge,
  NumberInput,
  Button,
  SimpleGrid,
  Center,
  Loader,
  ThemeIcon,
} from "@mantine/core";
import { IconPrinter, IconCircleCheck } from "@tabler/icons-react";
import { api } from "../lib/api";
import { formatarMoeda, formatarNumero } from "../lib/formato";
import { imprimirHtml } from "../lib/imprimir";
import { pedidoCompraA4 } from "../lib/recibos";
import type { Reposicao, ItemReposicao } from "../lib/tipos";

const SEM_FORNECEDOR = "__sem__";

export function ReposicaoPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["reposicao"],
    queryFn: () => api.get<Reposicao>("/produtos/reposicao"),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  // Quantidade a comprar por produto (começa na sugestão, o lojista ajusta).
  const [qtd, setQtd] = useState<Record<string, number>>({});
  useEffect(() => {
    if (data) {
      const inicial: Record<string, number> = {};
      for (const it of data.itens) inicial[it.id] = it.quantidadeSugerida;
      setQtd(inicial);
    }
  }, [data]);

  // Agrupa por fornecedor padrão
  const grupos = useMemo(() => {
    const mapa = new Map<string, { id: string; nome: string; itens: ItemReposicao[] }>();
    for (const it of data?.itens ?? []) {
      const id = it.fornecedor?.id ?? SEM_FORNECEDOR;
      const nome = it.fornecedor?.nome ?? "Sem fornecedor definido";
      if (!mapa.has(id)) mapa.set(id, { id, nome, itens: [] });
      mapa.get(id)!.itens.push(it);
    }
    return [...mapa.values()];
  }, [data]);

  const totalEstimado = (data?.itens ?? []).reduce(
    (s, it) => s + (qtd[it.id] ?? 0) * Number(it.precoCusto),
    0
  );

  function subtotalGrupo(itens: ItemReposicao[]) {
    return itens.reduce((s, it) => s + (qtd[it.id] ?? 0) * Number(it.precoCusto), 0);
  }

  function imprimirGrupo(nome: string, itens: ItemReposicao[]) {
    const doPedido = itens
      .filter((it) => (qtd[it.id] ?? 0) > 0)
      .map((it) => ({
        descricao: it.descricao,
        sku: it.sku,
        unidade: it.unidade,
        quantidade: qtd[it.id] ?? 0,
        precoCusto: it.precoCusto,
      }));
    if (doPedido.length === 0) return;
    imprimirHtml(pedidoCompraA4(nome, doPedido));
  }

  if (isLoading || !data) {
    return (
      <Center py="xl">
        <Loader />
      </Center>
    );
  }

  return (
    <Stack>
      <Title order={2}>Reposição de estoque</Title>

      {data.resumo.total === 0 ? (
        <Card withBorder radius="md" padding="xl">
          <Group>
            <ThemeIcon size="xl" radius="md" variant="light" color="teal">
              <IconCircleCheck size={26} />
            </ThemeIcon>
            <div>
              <Text fw={600}>Tudo em ordem 👍</Text>
              <Text c="dimmed" size="sm">
                Nenhum produto no mínimo ou abaixo. (Os alertas usam o estoque mínimo de cada
                produto — cadastre o mínimo nos produtos que quer acompanhar.)
              </Text>
            </div>
          </Group>
        </Card>
      ) : (
        <>
          <SimpleGrid cols={{ base: 2, sm: 4 }}>
            <Card withBorder radius="md" padding="md">
              <Text size="sm" c="dimmed">
                Itens para repor
              </Text>
              <Text fw={700} size="xl">
                {data.resumo.total}
              </Text>
            </Card>
            <Card withBorder radius="md" padding="md">
              <Text size="sm" c="dimmed">
                Zerados
              </Text>
              <Text fw={700} size="xl" c="red">
                {data.resumo.zerados}
              </Text>
            </Card>
            <Card withBorder radius="md" padding="md">
              <Text size="sm" c="dimmed">
                Baixos
              </Text>
              <Text fw={700} size="xl" c="orange">
                {data.resumo.baixos}
              </Text>
            </Card>
            <Card withBorder radius="md" padding="md">
              <Text size="sm" c="dimmed">
                Compra estimada
              </Text>
              <Text fw={700} size="xl">
                {formatarMoeda(totalEstimado)}
              </Text>
            </Card>
          </SimpleGrid>

          <Text c="dimmed" size="sm">
            A quantidade sugerida repõe até o dobro do estoque mínimo. Ajuste como quiser antes de
            imprimir o pedido de cada fornecedor.
          </Text>

          {grupos.map((grupo) => (
            <Card key={grupo.id} withBorder radius="md" padding="lg">
              <Group justify="space-between" mb="sm" wrap="wrap">
                <Group gap="xs">
                  <Title order={4}>{grupo.nome}</Title>
                  <Badge variant="light" color="gray">
                    {grupo.itens.length} {grupo.itens.length === 1 ? "item" : "itens"}
                  </Badge>
                </Group>
                <Button
                  variant="light"
                  leftSection={<IconPrinter size={18} />}
                  onClick={() => imprimirGrupo(grupo.nome, grupo.itens)}
                >
                  Imprimir pedido
                </Button>
              </Group>

              <Table.ScrollContainer minWidth={600}>
                <Table verticalSpacing="sm">
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Produto</Table.Th>
                      <Table.Th>Saldo / Mínimo</Table.Th>
                      <Table.Th>Situação</Table.Th>
                      <Table.Th w={130}>Comprar</Table.Th>
                      <Table.Th>Subtotal</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {grupo.itens.map((it) => (
                      <Table.Tr key={it.id}>
                        <Table.Td>
                          <Text size="sm">{it.descricao}</Text>
                          {it.sku && (
                            <Text size="xs" c="dimmed">
                              {it.sku}
                            </Text>
                          )}
                        </Table.Td>
                        <Table.Td>
                          {formatarNumero(it.saldoEstoque)} / {formatarNumero(it.estoqueMinimo)}{" "}
                          {it.unidade}
                        </Table.Td>
                        <Table.Td>
                          {it.zerado ? (
                            <Badge color="red" variant="light">
                              Zerado
                            </Badge>
                          ) : (
                            <Badge color="orange" variant="light">
                              Baixo
                            </Badge>
                          )}
                        </Table.Td>
                        <Table.Td>
                          <NumberInput
                            size="xs"
                            min={0}
                            value={qtd[it.id] ?? 0}
                            onChange={(v) => setQtd((q) => ({ ...q, [it.id]: Number(v) || 0 }))}
                            suffix={` ${it.unidade}`}
                          />
                        </Table.Td>
                        <Table.Td>
                          {formatarMoeda((qtd[it.id] ?? 0) * Number(it.precoCusto))}
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Table.ScrollContainer>

              <Group justify="flex-end" mt="sm">
                <Text fw={600}>
                  Subtotal do fornecedor: {formatarMoeda(subtotalGrupo(grupo.itens))}
                </Text>
              </Group>
            </Card>
          ))}
        </>
      )}
    </Stack>
  );
}
