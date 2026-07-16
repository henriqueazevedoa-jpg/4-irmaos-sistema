import { useState, Fragment } from "react";
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
  Center,
  Loader,
  SimpleGrid,
  Modal,
  NumberInput,
  Select,
  Textarea,
  TextInput,
  ActionIcon,
  Menu,
} from "@mantine/core";
import { modals } from "@mantine/modals";
import {
  IconArrowLeft,
  IconCash,
  IconGift,
  IconPrinter,
  IconHistory,
  IconCircleCheck,
  IconChevronDown,
  IconChevronUp,
  IconArrowBackUp,
  IconSearch,
  IconFilterOff,
} from "@tabler/icons-react";
import { api } from "../lib/api";
import { notificarErro, notificarSucesso } from "../lib/notificacoes";
import { formatarMoeda, formatarData, formatarNumero } from "../lib/formato";
import { FORMAS_RECEBIMENTO } from "../lib/pagamento";
import { imprimirHtml } from "../lib/imprimir";
import { reciboConta, reciboContaA4, reciboQuitacao, reciboVenda } from "../lib/recibos";
import { DevolucaoModal } from "../components/DevolucaoModal";
import type { ContaCliente, VendaFiado, HistoricoConta, Lancamento, VendaDetalhe } from "../lib/tipos";

function statusFiado(v: VendaFiado) {
  const aberto = Number(v.valorFiadoAberto);
  const fiado = Number(v.valorFiado);
  if (aberto <= 0.001) return { label: "Pago", cor: "teal" };
  if (aberto < fiado) return { label: "Parcial", cor: "yellow" };
  return { label: "Em aberto", cor: "orange" };
}

// Rótulo e cor de cada linha do extrato, deixando claro o tipo de movimento
// (compra no fiado, pagamento, devolução ou estorno de cancelamento).
function rotuloLancamento(l: Lancamento): { label: string; cor: string } {
  if (l.tipo === "DEBITO") return { label: "Compra (a prazo)", cor: "orange" };
  const d = (l.descricao ?? "").toLowerCase();
  if (d.includes("devolu")) return { label: "Devolução", cor: "grape" };
  if (d.includes("cancel") || d.includes("estorno")) return { label: "Estorno", cor: "gray" };
  return { label: "Pagamento", cor: "teal" };
}

// Remove o "venda nº N" da descrição (agora o número tem coluna própria).
function limparDescricao(desc: string | null): string {
  if (!desc) return "";
  return desc
    .replace(/\s*(—|-|\bda)?\s*venda nº\s*\d+/i, "")
    .replace(/\s*[—-]\s*$/, "")
    .trim();
}

// Dia (YYYY-MM-DD) no fuso local, para comparar com os filtros de data.
function diaLocal(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

function TabelaExtrato({
  lancamentos,
  itensPorVenda,
  onDevolver,
  onImprimir,
}: {
  lancamentos: Lancamento[];
  itensPorVenda?: Map<string, VendaFiado>;
  onDevolver?: (vendaId: string) => void;
  onImprimir?: (vendaId: string) => void;
}) {
  const [abertos, setAbertos] = useState<Set<string>>(new Set());
  if (lancamentos.length === 0) return <Text c="dimmed">Nenhuma movimentação.</Text>;

  const alternar = (id: string) =>
    setAbertos((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  return (
    <Table.ScrollContainer minWidth={620}>
      <Table striped verticalSpacing="sm">
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Data</Table.Th>
            <Table.Th>Venda nº</Table.Th>
            <Table.Th>Movimento</Table.Th>
            <Table.Th>Valor</Table.Th>
            <Table.Th>Saldo</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {lancamentos.map((l) => {
            const compra =
              l.tipo === "DEBITO" && l.vendaId ? itensPorVenda?.get(l.vendaId) : undefined;
            const numeroVenda = l.vendaId ? itensPorVenda?.get(l.vendaId)?.numero : undefined;
            const aberto = abertos.has(l.id);
            const mov = rotuloLancamento(l);
            const descricao = limparDescricao(l.descricao);
            return (
              <Fragment key={l.id}>
                <Table.Tr>
                  <Table.Td>{formatarData(l.data)}</Table.Td>
                  <Table.Td>
                    {numeroVenda ? <Text fw={500}>{numeroVenda}</Text> : <Text c="dimmed">—</Text>}
                  </Table.Td>
                  <Table.Td>
                    <Group gap={6} wrap="nowrap" align="flex-start">
                      {compra ? (
                        <ActionIcon
                          variant="subtle"
                          color="gray"
                          size="sm"
                          onClick={() => alternar(l.id)}
                          aria-label="Ver itens da compra"
                        >
                          {aberto ? <IconChevronUp size={16} /> : <IconChevronDown size={16} />}
                        </ActionIcon>
                      ) : (
                        <span style={{ width: 22, display: "inline-block" }} />
                      )}
                      <div>
                        <Badge color={mov.cor} variant="light">
                          {mov.label}
                        </Badge>
                        {descricao && (
                          <Text size="xs" c="dimmed">
                            {descricao}
                          </Text>
                        )}
                      </div>
                    </Group>
                  </Table.Td>
                  <Table.Td>
                    <Text c={mov.cor}>
                      {l.tipo === "DEBITO" ? "+" : "−"} {formatarMoeda(l.valor)}
                    </Text>
                  </Table.Td>
                  <Table.Td>{formatarMoeda(l.saldoApos)}</Table.Td>
                </Table.Tr>
                {compra && aberto && (
                  <Table.Tr>
                    <Table.Td colSpan={5} style={{ background: "var(--mantine-color-gray-0)" }}>
                      <Table>
                        <Table.Tbody>
                          {compra.itens.map((it, i) => {
                            const devolvida = Number(it.quantidadeDevolvida);
                            return (
                              <Table.Tr key={i}>
                                <Table.Td>
                                  {it.descricao}
                                  {devolvida > 0 && (
                                    <Badge color="grape" variant="light" size="sm" ml={6}>
                                      Devolvido: {formatarNumero(it.quantidadeDevolvida)}
                                    </Badge>
                                  )}
                                </Table.Td>
                                <Table.Td>{formatarNumero(it.quantidade)}</Table.Td>
                                <Table.Td>{formatarMoeda(it.precoUnitario)}</Table.Td>
                                <Table.Td ta="right">{formatarMoeda(it.total)}</Table.Td>
                              </Table.Tr>
                            );
                          })}
                        </Table.Tbody>
                      </Table>
                      {l.vendaId && (onImprimir || onDevolver) && (
                        <Group justify="flex-end" mt="xs" gap="xs">
                          {onImprimir && (
                            <Button
                              size="xs"
                              variant="light"
                              color="gray"
                              leftSection={<IconPrinter size={16} />}
                              onClick={() => onImprimir(l.vendaId!)}
                            >
                              Imprimir nota
                            </Button>
                          )}
                          {onDevolver && (
                            <Button
                              size="xs"
                              variant="light"
                              color="orange"
                              leftSection={<IconArrowBackUp size={16} />}
                              onClick={() => onDevolver(l.vendaId!)}
                            >
                              Devolver itens desta compra
                            </Button>
                          )}
                        </Group>
                      )}
                    </Table.Td>
                  </Table.Tr>
                )}
              </Fragment>
            );
          })}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  );
}

export function ContaClientePage() {
  const { id = "" } = useParams();
  const navegar = useNavigate();
  const qc = useQueryClient();
  const [modalAberto, setModalAberto] = useState(false);
  const [valor, setValor] = useState<number>(0);
  const [forma, setForma] = useState<string>("DINHEIRO");
  const [observacao, setObservacao] = useState("");

  const [histAberto, setHistAberto] = useState(false);
  const [vendaDevolver, setVendaDevolver] = useState<string | null>(null);

  // Filtros do extrato
  const [buscaVenda, setBuscaVenda] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["conta", id],
    queryFn: () => api.get<ContaCliente>(`/clientes/${id}/conta`),
  });

  // Carrega a venda completa (com itens já devolvidos) só quando o usuário pede a devolução.
  const { data: vendaParaDevolver } = useQuery({
    queryKey: ["vendas", vendaDevolver],
    queryFn: () => api.get<VendaDetalhe>(`/vendas/${vendaDevolver}`),
    enabled: !!vendaDevolver,
  });

  const { data: historico } = useQuery({
    queryKey: ["conta", id, "historico"],
    queryFn: () => api.get<HistoricoConta>(`/clientes/${id}/conta/historico`),
    enabled: histAberto,
  });

  function invalidar() {
    qc.invalidateQueries({ queryKey: ["conta", id] });
    qc.invalidateQueries({ queryKey: ["clientes"] });
  }

  const pagar = useMutation({
    mutationFn: () => api.post(`/clientes/${id}/pagamentos`, { valor, forma, observacao }),
    onSuccess: () => {
      invalidar();
      notificarSucesso("Pagamento registrado.");
      setModalAberto(false);
      setValor(0);
      setObservacao("");
    },
    onError: (e) => notificarErro(e),
  });

  // Busca a venda completa e imprime a nota individual (bobina 80mm).
  const imprimirNota = useMutation({
    mutationFn: (vendaId: string) => api.get<VendaDetalhe>(`/vendas/${vendaId}`),
    onSuccess: (v) => imprimirHtml(reciboVenda(v)),
    onError: (e) => notificarErro(e),
  });

  const usarHaver = useMutation({
    mutationFn: () => api.post(`/clientes/${id}/usar-haver`, {}),
    onSuccess: () => {
      invalidar();
      notificarSucesso("Crédito usado para abater a conta.");
    },
    onError: (e) => notificarErro(e),
  });

  if (isLoading || !data) {
    return (
      <Center py="xl">
        <Loader />
      </Center>
    );
  }

  const deve = Number(data.cliente.saldoConta);
  const haver = Number(data.cliente.saldoHaver);
  // Mapa vendaId -> compra (com itens), para expandir as compras no extrato
  const itensPorVenda = new Map(data.comprasCiclo.map((v) => [v.id, v]));

  // Aplica os filtros (nº da venda e período) ao extrato do ciclo.
  const temFiltro = !!(buscaVenda.trim() || dataInicio || dataFim);
  const lancamentosFiltrados = data.lancamentos.filter((l) => {
    if (buscaVenda.trim()) {
      const numero = l.vendaId ? itensPorVenda.get(l.vendaId)?.numero : undefined;
      if (!numero || !String(numero).includes(buscaVenda.trim())) return false;
    }
    const dia = diaLocal(l.data);
    if (dataInicio && dia < dataInicio) return false;
    if (dataFim && dia > dataFim) return false;
    return true;
  });

  function limparFiltros() {
    setBuscaVenda("");
    setDataInicio("");
    setDataFim("");
  }

  function confirmarUsarHaver() {
    modals.openConfirmModal({
      title: "Usar crédito",
      children: (
        <Text size="sm">
          Usar o crédito de <b>{formatarMoeda(data!.cliente.saldoHaver)}</b> para abater o que o
          cliente deve?
        </Text>
      ),
      labels: { confirm: "Usar crédito", cancel: "Cancelar" },
      onConfirm: () => usarHaver.mutate(),
    });
  }

  return (
    <Stack>
      <Button
        variant="subtle"
        leftSection={<IconArrowLeft size={18} />}
        onClick={() => navegar("/clientes")}
        style={{ alignSelf: "flex-start" }}
      >
        Voltar
      </Button>

      <Title order={2}>Conta de {data.cliente.nome}</Title>

      <SimpleGrid cols={{ base: 1, sm: 3 }}>
        <Card withBorder radius="md" padding="lg">
          <Text size="sm" c="dimmed">
            A receber (em aberto)
          </Text>
          <Text fw={700} size="xl" c={deve > 0 ? "orange" : "teal"}>
            {formatarMoeda(deve)}
          </Text>
        </Card>
        <Card withBorder radius="md" padding="lg">
          <Text size="sm" c="dimmed">
            Crédito a favor (haver)
          </Text>
          <Text fw={700} size="xl" c={haver > 0 ? "teal" : undefined}>
            {formatarMoeda(haver)}
          </Text>
        </Card>
        <Card withBorder radius="md" padding="lg">
          <Text size="sm" c="dimmed">
            Limite de crédito
          </Text>
          <Text fw={700} size="xl">
            {Number(data.cliente.limiteCredito) > 0
              ? formatarMoeda(data.cliente.limiteCredito)
              : "Sem limite"}
          </Text>
        </Card>
      </SimpleGrid>

      <Group>
        <Button
          leftSection={<IconCash size={18} />}
          disabled={deve <= 0}
          onClick={() => {
            setValor(deve);
            setModalAberto(true);
          }}
        >
          Registrar pagamento
        </Button>
        {haver > 0 && deve > 0 && (
          <Button
            variant="light"
            color="teal"
            leftSection={<IconGift size={18} />}
            loading={usarHaver.isPending}
            onClick={confirmarUsarHaver}
          >
            Usar crédito para abater
          </Button>
        )}
        {deve > 0 && (
          <Menu shadow="md" position="bottom-start">
            <Menu.Target>
              <Button
                variant="default"
                leftSection={<IconPrinter size={18} />}
                rightSection={<IconChevronDown size={14} />}
              >
                Imprimir conta
              </Button>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item onClick={() => imprimirHtml(reciboConta(data))}>
                Bobina térmica (80mm)
              </Menu.Item>
              <Menu.Item onClick={() => imprimirHtml(reciboContaA4(data))}>Folha A4</Menu.Item>
            </Menu.Dropdown>
          </Menu>
        )}
        {deve <= 0 && (
          <Button
            variant="light"
            color="teal"
            leftSection={<IconCircleCheck size={18} />}
            onClick={() => imprimirHtml(reciboQuitacao(data))}
          >
            Comprovante de quitação
          </Button>
        )}
        <Button
          variant="subtle"
          color="gray"
          leftSection={<IconHistory size={18} />}
          onClick={() => setHistAberto(true)}
        >
          Histórico completo
        </Button>
      </Group>

      {/* Extrato do ciclo atual — clique na seta de uma compra para ver os itens */}
      <Title order={4}>Movimentações da conta (desde a última quitação)</Title>

      <Group align="flex-end" gap="sm" wrap="wrap">
        <TextInput
          label="Buscar por nº da venda"
          placeholder="Ex: 20"
          leftSection={<IconSearch size={16} />}
          value={buscaVenda}
          onChange={(e) => setBuscaVenda(e.currentTarget.value)}
          w={{ base: "100%", sm: 200 }}
        />
        <TextInput
          type="date"
          label="De"
          value={dataInicio}
          onChange={(e) => setDataInicio(e.currentTarget.value)}
        />
        <TextInput
          type="date"
          label="Até"
          value={dataFim}
          onChange={(e) => setDataFim(e.currentTarget.value)}
        />
        {temFiltro && (
          <Button
            variant="subtle"
            color="gray"
            leftSection={<IconFilterOff size={16} />}
            onClick={limparFiltros}
          >
            Limpar filtros
          </Button>
        )}
      </Group>

      {temFiltro && (
        <Text size="sm" c="dimmed">
          {lancamentosFiltrados.length} movimentação(ões) encontrada(s).
        </Text>
      )}

      <TabelaExtrato
        lancamentos={lancamentosFiltrados}
        itensPorVenda={itensPorVenda}
        onDevolver={setVendaDevolver}
        onImprimir={(vendaId) => imprimirNota.mutate(vendaId)}
      />

      <Modal opened={modalAberto} onClose={() => setModalAberto(false)} title="Registrar pagamento">
        <Stack>
          <NumberInput
            label="Valor recebido"
            min={0}
            max={deve}
            prefix="R$ "
            decimalScale={2}
            thousandSeparator="."
            decimalSeparator=","
            value={valor}
            onChange={(v) => setValor(Number(v) || 0)}
          />
          <Select
            label="Forma"
            data={FORMAS_RECEBIMENTO}
            value={forma}
            onChange={(v) => setForma(v ?? "DINHEIRO")}
            allowDeselect={false}
          />
          <Textarea
            label="Observação"
            autosize
            minRows={1}
            value={observacao}
            onChange={(e) => setObservacao(e.currentTarget.value)}
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setModalAberto(false)}>
              Cancelar
            </Button>
            <Button onClick={() => pagar.mutate()} loading={pagar.isPending} disabled={valor <= 0}>
              Confirmar
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Histórico completo (todas as compras e movimentações) */}
      <Modal
        opened={histAberto}
        onClose={() => setHistAberto(false)}
        title="Histórico completo da conta"
        size="lg"
      >
        {!historico ? (
          <Center py="xl">
            <Loader />
          </Center>
        ) : (
          <Stack>
            <Title order={5}>Todas as compras a prazo</Title>
            {historico.vendasFiado.length === 0 ? (
              <Text c="dimmed">Nenhuma compra a prazo.</Text>
            ) : (
              historico.vendasFiado.map((v) => {
                const st = statusFiado(v);
                return (
                  <Group key={v.id} justify="space-between" wrap="nowrap">
                    <Text size="sm">
                      Venda nº {v.numero} — {formatarData(v.dataVenda)} · {formatarMoeda(v.total)}
                    </Text>
                    <Badge color={st.cor} variant="light">
                      {st.label}
                    </Badge>
                  </Group>
                );
              })
            )}
            <Title order={5} mt="sm">
              Extrato completo
            </Title>
            <TabelaExtrato
              lancamentos={historico.lancamentos}
              itensPorVenda={new Map(historico.vendasFiado.map((v) => [v.id, v]))}
            />
          </Stack>
        )}
      </Modal>

      {/* Devolução de itens de uma compra (aberta a partir do extrato) */}
      {vendaParaDevolver && vendaParaDevolver.id === vendaDevolver && (
        <DevolucaoModal
          venda={vendaParaDevolver}
          aberto
          aoFechar={() => setVendaDevolver(null)}
        />
      )}
    </Stack>
  );
}
