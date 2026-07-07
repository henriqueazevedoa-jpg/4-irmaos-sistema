import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Stack,
  Group,
  Title,
  Button,
  Table,
  Badge,
  Text,
  Center,
  Loader,
  ActionIcon,
  TextInput,
  Pagination,
  Modal,
  Divider,
} from "@mantine/core";
import { modals } from "@mantine/modals";
import {
  IconPlus,
  IconSearch,
  IconEye,
  IconBan,
  IconArrowBackUp,
} from "@tabler/icons-react";
import { api, query } from "../lib/api";
import { notificarErro, notificarSucesso } from "../lib/notificacoes";
import { formatarMoeda, formatarData } from "../lib/formato";
import { LABEL_FORMA } from "../lib/pagamento";
import { DevolucaoModal } from "../components/DevolucaoModal";
import type { VendaResumo, VendaDetalhe, RespostaLista } from "../lib/tipos";

const POR_PAGINA = 10;

const COR_STATUS: Record<string, string> = {
  FINALIZADA: "teal",
  CANCELADA: "gray",
  ABERTA: "yellow",
};

const LABEL_DESTINO: Record<string, string> = {
  DINHEIRO: "Devolvido em dinheiro",
  HAVER: "Virou crédito do cliente",
  ABATER_FIADO: "Abateu o fiado do cliente",
};

function podeDevolver(v: VendaDetalhe) {
  return v.itens.some((it) => Number(it.quantidade) - Number(it.quantidadeDevolvida) > 0);
}

export function VendasPage() {
  const navegar = useNavigate();
  const qc = useQueryClient();
  const [pagina, setPagina] = useState(1);
  const [busca, setBusca] = useState("");
  const [detalheId, setDetalheId] = useState<string | null>(null);
  const [devolucaoAberta, setDevolucaoAberta] = useState(false);

  const { data, isFetching } = useQuery({
    queryKey: ["vendas", { pagina, busca }],
    queryFn: () =>
      api.get<RespostaLista<VendaResumo>>(`/vendas${query({ pagina, porPagina: POR_PAGINA, busca })}`),
    placeholderData: (anterior) => anterior,
  });

  const { data: detalhe, isLoading: carregandoDetalhe } = useQuery({
    queryKey: ["vendas", detalheId],
    queryFn: () => api.get<VendaDetalhe>(`/vendas/${detalheId}`),
    enabled: !!detalheId,
  });

  const cancelar = useMutation({
    mutationFn: (id: string) => api.post(`/vendas/${id}/cancelar`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vendas"] });
      qc.invalidateQueries({ queryKey: ["produtos"] });
      notificarSucesso("Venda cancelada. Estoque e fiado foram estornados.");
    },
    onError: (e) => notificarErro(e),
  });

  function confirmarCancelamento(v: VendaResumo) {
    modals.openConfirmModal({
      title: "Cancelar venda",
      children: (
        <Text size="sm">
          Cancelar a venda <b>nº {v.numero}</b>? Os produtos voltam ao estoque e, se houver
          fiado, ele é estornado da conta do cliente.
        </Text>
      ),
      labels: { confirm: "Cancelar venda", cancel: "Voltar" },
      confirmProps: { color: "red" },
      onConfirm: () => cancelar.mutate(v.id),
    });
  }

  const vendas = data?.dados;

  return (
    <Stack>
      <Group justify="space-between" wrap="wrap">
        <Title order={2}>Histórico de vendas</Title>
        <Button leftSection={<IconPlus size={18} />} onClick={() => navegar("/vendas")}>
          Nova venda
        </Button>
      </Group>

      <TextInput
        placeholder="Buscar por nº ou cliente..."
        leftSection={<IconSearch size={16} />}
        value={busca}
        onChange={(e) => {
          setBusca(e.currentTarget.value);
          setPagina(1);
        }}
        w={{ base: "100%", sm: 320 }}
      />

      {isFetching && !vendas ? (
        <Center py="xl">
          <Loader />
        </Center>
      ) : vendas && vendas.length === 0 ? (
        <Center py="xl">
          <Text c="dimmed">Nenhuma venda registrada ainda.</Text>
        </Center>
      ) : (
        <Table.ScrollContainer minWidth={700}>
          <Table striped highlightOnHover verticalSpacing="sm">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Nº</Table.Th>
                <Table.Th>Data</Table.Th>
                <Table.Th>Cliente</Table.Th>
                <Table.Th>Itens</Table.Th>
                <Table.Th>Total</Table.Th>
                <Table.Th>Pagamento</Table.Th>
                <Table.Th>Situação</Table.Th>
                <Table.Th w={90}>Ações</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {vendas?.map((v) => (
                <Table.Tr key={v.id}>
                  <Table.Td>{v.numero}</Table.Td>
                  <Table.Td>{formatarData(v.dataVenda)}</Table.Td>
                  <Table.Td>{v.cliente?.nome ?? "Consumidor"}</Table.Td>
                  <Table.Td>{v._count.itens}</Table.Td>
                  <Table.Td>{formatarMoeda(v.total)}</Table.Td>
                  <Table.Td>
                    {[...new Set(v.pagamentos.map((p) => LABEL_FORMA[p.forma]))].join(", ")}
                  </Table.Td>
                  <Table.Td>
                    <Badge color={COR_STATUS[v.status]} variant="light">
                      {v.status === "FINALIZADA" ? "Finalizada" : v.status === "CANCELADA" ? "Cancelada" : "Aberta"}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Group gap={4} wrap="nowrap">
                      <ActionIcon variant="subtle" onClick={() => setDetalheId(v.id)} aria-label="Ver">
                        <IconEye size={18} />
                      </ActionIcon>
                      {v.status !== "CANCELADA" && (
                        <ActionIcon
                          variant="subtle"
                          color="red"
                          onClick={() => confirmarCancelamento(v)}
                          aria-label="Cancelar"
                        >
                          <IconBan size={18} />
                        </ActionIcon>
                      )}
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      )}

      {data?.paginacao && data.paginacao.totalPaginas > 1 && (
        <Group justify="center">
          <Pagination total={data.paginacao.totalPaginas} value={pagina} onChange={setPagina} />
        </Group>
      )}

      {/* Detalhe da venda */}
      <Modal
        opened={!!detalheId}
        onClose={() => setDetalheId(null)}
        title={detalhe ? `Venda nº ${detalhe.numero}` : "Venda"}
        size="lg"
      >
        {carregandoDetalhe || !detalhe ? (
          <Center py="xl">
            <Loader />
          </Center>
        ) : (
          <Stack>
            <Group justify="space-between">
              <Text c="dimmed">Cliente</Text>
              <Text>{detalhe.cliente?.nome ?? "Consumidor"}</Text>
            </Group>
            <Group justify="space-between">
              <Text c="dimmed">Data</Text>
              <Text>{formatarData(detalhe.dataVenda)}</Text>
            </Group>
            <Divider label="Itens" />
            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Produto</Table.Th>
                  <Table.Th>Qtd</Table.Th>
                  <Table.Th>Unit.</Table.Th>
                  <Table.Th>Total</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {detalhe.itens.map((it) => (
                  <Table.Tr key={it.id}>
                    <Table.Td>{it.descricao}</Table.Td>
                    <Table.Td>{Number(it.quantidade)}</Table.Td>
                    <Table.Td>{formatarMoeda(it.precoUnitario)}</Table.Td>
                    <Table.Td>{formatarMoeda(it.total)}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
            <Divider label="Pagamento" />
            {detalhe.pagamentos.map((p) => (
              <Group key={p.id} justify="space-between">
                <Text>{LABEL_FORMA[p.forma]}</Text>
                <Text>{formatarMoeda(p.valor)}</Text>
              </Group>
            ))}
            <Divider />
            <Group justify="space-between">
              <Text fw={700}>Total</Text>
              <Text fw={700}>{formatarMoeda(detalhe.total)}</Text>
            </Group>

            {detalhe.devolucoes.length > 0 && (
              <>
                <Divider label="Devoluções" />
                {detalhe.devolucoes.map((d) => (
                  <Group key={d.id} justify="space-between" wrap="nowrap">
                    <div>
                      <Text size="sm">
                        {formatarData(d.data)} —{" "}
                        {d.itens.map((i) => `${Number(i.quantidade)}x ${i.descricao}`).join(", ")}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {LABEL_DESTINO[d.destino]}
                      </Text>
                    </div>
                    <Text c="orange" fw={500}>
                      − {formatarMoeda(d.valorTotal)}
                    </Text>
                  </Group>
                ))}
              </>
            )}

            {detalhe.status === "FINALIZADA" && podeDevolver(detalhe) && (
              <Button
                color="orange"
                variant="light"
                leftSection={<IconArrowBackUp size={18} />}
                onClick={() => setDevolucaoAberta(true)}
              >
                Devolver itens
              </Button>
            )}
          </Stack>
        )}
      </Modal>

      {detalhe && (
        <DevolucaoModal
          venda={detalhe}
          aberto={devolucaoAberta}
          aoFechar={() => setDevolucaoAberta(false)}
        />
      )}
    </Stack>
  );
}
