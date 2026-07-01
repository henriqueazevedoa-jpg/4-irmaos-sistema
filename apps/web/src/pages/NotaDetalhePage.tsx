import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Stack,
  Group,
  Title,
  Button,
  Card,
  Text,
  Badge,
  Table,
  Select,
  Center,
  Loader,
  Alert,
  SimpleGrid,
  Tooltip,
  Anchor,
} from "@mantine/core";
import {
  IconArrowLeft,
  IconCheck,
  IconAlertTriangle,
  IconPackageImport,
  IconPlus,
} from "@tabler/icons-react";
import { api } from "../lib/api";
import { notificarErro, notificarSucesso } from "../lib/notificacoes";
import { formatarMoeda, formatarNumero, formatarData } from "../lib/formato";
import { STATUS_NOTA } from "../lib/statusNota";
import type { NotaDetalhe } from "../lib/tipos";

export function NotaDetalhePage() {
  const { id = "" } = useParams();
  const navegar = useNavigate();
  const qc = useQueryClient();

  const { data: nota, isLoading } = useQuery({
    queryKey: ["notas-entrada", id],
    queryFn: () => api.get<NotaDetalhe>(`/notas-entrada/${id}`),
  });

  const { data: produtos } = useQuery({
    queryKey: ["produtos", "opcoes"],
    queryFn: () =>
      api.get<{ dados: { id: string; descricao: string; sku: string | null }[] }>(
        "/produtos/opcoes"
      ),
  });

  function invalidar() {
    qc.invalidateQueries({ queryKey: ["notas-entrada"] });
    qc.invalidateQueries({ queryKey: ["produtos"] });
  }

  const vincular = useMutation({
    mutationFn: (v: { itemId: string; produtoId: string | null }) =>
      api.put(`/notas-entrada/${id}/itens/${v.itemId}`, { produtoId: v.produtoId }),
    onSuccess: invalidar,
    onError: (e) => notificarErro(e),
  });

  const criarProduto = useMutation({
    mutationFn: (itemId: string) =>
      api.post(`/notas-entrada/${id}/itens/${itemId}/criar-produto`, {}),
    onSuccess: () => {
      invalidar();
      notificarSucesso("Produto criado e vinculado ao item.");
    },
    onError: (e) => notificarErro(e),
  });

  const processar = useMutation({
    mutationFn: () => api.post(`/notas-entrada/${id}/processar`, {}),
    onSuccess: () => {
      invalidar();
      notificarSucesso("Entrada concluída! O estoque foi atualizado.");
    },
    onError: (e) => notificarErro(e),
  });

  if (isLoading || !nota) {
    return (
      <Center py="xl">
        <Loader />
      </Center>
    );
  }

  const st = STATUS_NOTA[nota.status];
  const processada = nota.status === "PROCESSADA";
  const todosVinculados = nota.itens.every((i) => i.produtoId);

  const opcoesProduto = (produtos?.dados ?? []).map((p) => ({
    value: p.id,
    label: p.sku ? `${p.descricao} (${p.sku})` : p.descricao,
  }));

  return (
    <Stack>
      <Group justify="space-between" wrap="wrap">
        <Button
          variant="subtle"
          leftSection={<IconArrowLeft size={18} />}
          onClick={() => navegar("/entradas")}
        >
          Voltar
        </Button>
        <Badge color={st.cor} variant="light" size="lg">
          {st.label}
        </Badge>
      </Group>

      <Title order={2}>Nota nº {nota.numero ?? "—"}</Title>

      <Card withBorder radius="md" padding="lg">
        <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }}>
          <div>
            <Text size="xs" c="dimmed">
              Fornecedor
            </Text>
            <Text fw={500}>
              {nota.fornecedor?.nomeFantasia || nota.fornecedor?.razaoSocial || "—"}
            </Text>
          </div>
          <div>
            <Text size="xs" c="dimmed">
              Emissão
            </Text>
            <Text fw={500}>{formatarData(nota.dataEmissao)}</Text>
          </div>
          <div>
            <Text size="xs" c="dimmed">
              Valor total
            </Text>
            <Text fw={500}>{formatarMoeda(nota.valorTotal)}</Text>
          </div>
          <div>
            <Text size="xs" c="dimmed">
              Itens
            </Text>
            <Text fw={500}>{nota.itens.length}</Text>
          </div>
        </SimpleGrid>
      </Card>

      {processada ? (
        <Alert color="teal" variant="light" icon={<IconCheck size={18} />}>
          Esta nota já deu entrada no estoque. O histórico está registrado e não pode ser
          alterado.
        </Alert>
      ) : (
        <Alert color="blue" variant="light" icon={<IconAlertTriangle size={18} />}>
          Confira cada item e vincule a um produto do sistema (ou crie um novo). Quando todos
          estiverem vinculados, clique em <b>Dar entrada no estoque</b>.
        </Alert>
      )}

      <Table.ScrollContainer minWidth={820}>
        <Table verticalSpacing="sm" highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Item da nota</Table.Th>
              <Table.Th>Qtd</Table.Th>
              <Table.Th>Vlr. unit.</Table.Th>
              <Table.Th>Total</Table.Th>
              <Table.Th w={340}>Produto no sistema</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {nota.itens.map((item) => (
              <Table.Tr key={item.id}>
                <Table.Td>
                  <Text fw={500}>{item.descricaoNota}</Text>
                  <Text size="xs" c="dimmed">
                    {[
                      item.codigoBarras && `EAN ${item.codigoBarras}`,
                      item.ncm && `NCM ${item.ncm}`,
                      item.unidade,
                    ]
                      .filter(Boolean)
                      .join(" • ")}
                  </Text>
                </Table.Td>
                <Table.Td>{formatarNumero(item.quantidade)}</Table.Td>
                <Table.Td>{formatarMoeda(item.valorUnitario)}</Table.Td>
                <Table.Td>{formatarMoeda(item.valorTotal)}</Table.Td>
                <Table.Td>
                  {processada ? (
                    <Group gap={6}>
                      <IconCheck size={16} color="var(--mantine-color-teal-6)" />
                      <Text size="sm">{item.produto?.descricao ?? "—"}</Text>
                    </Group>
                  ) : (
                    <Group gap="xs" wrap="nowrap" align="flex-start">
                      <Select
                        placeholder="Escolher produto..."
                        searchable
                        clearable
                        data={opcoesProduto}
                        value={item.produtoId}
                        onChange={(v) => vincular.mutate({ itemId: item.id, produtoId: v })}
                        error={!item.produtoId && "Pendente"}
                        style={{ flex: 1 }}
                      />
                      <Tooltip label="Criar um produto novo a partir deste item">
                        <Button
                          variant="light"
                          size="sm"
                          px="sm"
                          leftSection={<IconPlus size={16} />}
                          onClick={() => criarProduto.mutate(item.id)}
                          loading={criarProduto.isPending}
                        >
                          Criar
                        </Button>
                      </Tooltip>
                    </Group>
                  )}
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>

      {!processada && (
        <Group justify="flex-end">
          <Tooltip
            label="Vincule todos os itens a um produto antes de dar entrada"
            disabled={todosVinculados}
          >
            <Button
              size="md"
              leftSection={<IconPackageImport size={20} />}
              disabled={!todosVinculados}
              loading={processar.isPending}
              onClick={() => processar.mutate()}
            >
              Dar entrada no estoque
            </Button>
          </Tooltip>
        </Group>
      )}

      {nota.chaveAcesso && (
        <Text size="xs" c="dimmed">
          Chave de acesso: <Anchor component="span">{nota.chaveAcesso}</Anchor>
        </Text>
      )}
    </Stack>
  );
}
