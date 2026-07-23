import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Stack,
  Group,
  Title,
  Text,
  Table,
  Badge,
  NumberInput,
  Button,
  Select,
  TextInput,
  Checkbox,
  Center,
  Loader,
  Modal,
  Card,
} from "@mantine/core";
import { IconSearch, IconShoppingCartPlus, IconPrinter } from "@tabler/icons-react";
import { api, query } from "../lib/api";
import { formatarMoeda, formatarNumero, formatarData } from "../lib/formato";
import { imprimirHtml } from "../lib/imprimir";
import { pedidoCompraA4 } from "../lib/recibos";
import { notificarErro } from "../lib/notificacoes";
import type { PainelProdutos, ItemPainel, ClasseAbc, Fornecedor, RespostaLista } from "../lib/tipos";

const ABC_INFO: Record<ClasseAbc, { cor: string; label: string }> = {
  A: { cor: "green", label: "A" },
  B: { cor: "blue", label: "B" },
  C: { cor: "gray", label: "C" },
  SEM_VENDA: { cor: "orange", label: "Sem venda" },
};

// Cor de fundo da linha conforme o critério escolhido (ou nenhuma).
function corLinha(item: ItemPainel, criterio: string): string | undefined {
  if (criterio === "abc") {
    return {
      A: "var(--mantine-color-green-0)",
      B: "var(--mantine-color-blue-0)",
      C: "var(--mantine-color-gray-1)",
      SEM_VENDA: "var(--mantine-color-orange-0)",
    }[item.classeAbc];
  }
  if (criterio === "estoque") {
    const s = Number(item.saldoEstoque);
    const m = Number(item.estoqueMinimo);
    if (s <= 0) return "var(--mantine-color-red-1)";
    if (m > 0 && s <= m) return "var(--mantine-color-orange-0)";
    return undefined;
  }
  if (criterio === "giro") {
    return item.vendaQtd > 0 ? "var(--mantine-color-green-0)" : "var(--mantine-color-red-0)";
  }
  return undefined;
}

export function PainelProdutosPage() {
  const [dias, setDias] = useState("90");
  const [busca, setBusca] = useState("");
  const [colorir, setColorir] = useState("abc");
  const [ordem, setOrdem] = useState("mais");
  const [filtroForn, setFiltroForn] = useState<string | null>(null);
  const [filtroClasse, setFiltroClasse] = useState<string | null>(null);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());

  const [modalCompra, setModalCompra] = useState(false);
  const [fornecedorCompra, setFornecedorCompra] = useState<string | null>(null);
  const [qtdCompra, setQtdCompra] = useState<Record<string, number>>({});

  const { data, isLoading } = useQuery({
    queryKey: ["painel", dias],
    queryFn: () => api.get<PainelProdutos>(`/produtos/painel${query({ dias })}`),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const { data: fornecedores } = useQuery({
    queryKey: ["fornecedores", "opcoes"],
    queryFn: () => api.get<RespostaLista<Fornecedor>>(`/fornecedores${query({ porPagina: 200 })}`),
  });

  const opcoesFornecedor = (fornecedores?.dados ?? []).map((f) => ({
    value: f.id,
    label: f.nomeFantasia || f.razaoSocial,
  }));

  // Fornecedores presentes nos produtos, para o filtro
  const fornecedoresDoPainel = useMemo(() => {
    const m = new Map<string, string>();
    for (const it of data?.itens ?? []) if (it.fornecedor) m.set(it.fornecedor.id, it.fornecedor.nome);
    return [...m.entries()].map(([value, label]) => ({ value, label }));
  }, [data]);

  const itensFiltrados = useMemo(() => {
    let itens = data?.itens ?? [];
    const b = busca.trim().toLowerCase();
    if (b) itens = itens.filter((i) => i.descricao.toLowerCase().includes(b) || i.sku?.toLowerCase().includes(b));
    if (filtroForn) itens = itens.filter((i) => i.fornecedor?.id === filtroForn);
    if (filtroClasse) itens = itens.filter((i) => i.classeAbc === filtroClasse);

    const ordenado = [...itens].sort((a, z) => {
      switch (ordem) {
        case "mais":
          return z.vendaQtd - a.vendaQtd;
        case "menos":
          return a.vendaQtd - z.vendaQtd;
        case "faturado":
          return z.vendaValor - a.vendaValor;
        case "estoque":
          return Number(a.saldoEstoque) - Number(z.saldoEstoque);
        case "semvenda":
          return (a.vendaQtd > 0 ? 1 : 0) - (z.vendaQtd > 0 ? 1 : 0);
        default:
          return a.descricao.localeCompare(z.descricao);
      }
    });
    return ordenado;
  }, [data, busca, filtroForn, filtroClasse, ordem]);

  function alternar(id: string) {
    setSelecionados((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }

  const todosMarcados = itensFiltrados.length > 0 && itensFiltrados.every((i) => selecionados.has(i.id));
  function alternarTodos() {
    setSelecionados((s) => {
      const n = new Set(s);
      if (todosMarcados) itensFiltrados.forEach((i) => n.delete(i.id));
      else itensFiltrados.forEach((i) => n.add(i.id));
      return n;
    });
  }

  const itensSelecionados = (data?.itens ?? []).filter((i) => selecionados.has(i.id));

  function abrirCompra() {
    // pré-preenche fornecedor se todos os selecionados compartilham o mesmo
    const forns = new Set(itensSelecionados.map((i) => i.fornecedor?.id).filter(Boolean));
    setFornecedorCompra(forns.size === 1 ? [...forns][0]! : null);
    const q: Record<string, number> = {};
    for (const i of itensSelecionados) q[i.id] = i.sugestaoCompra > 0 ? i.sugestaoCompra : 1;
    setQtdCompra(q);
    setModalCompra(true);
  }

  function imprimirPedido() {
    const nome = opcoesFornecedor.find((f) => f.value === fornecedorCompra)?.label;
    if (!nome) {
      notificarErro(new Error("Selecione o fornecedor do pedido."));
      return;
    }
    const itens = itensSelecionados
      .filter((i) => (qtdCompra[i.id] ?? 0) > 0)
      .map((i) => ({
        descricao: i.descricao,
        sku: i.sku,
        unidade: i.unidade,
        quantidade: qtdCompra[i.id] ?? 0,
        precoCusto: i.precoCusto,
      }));
    if (itens.length === 0) {
      notificarErro(new Error("Informe a quantidade de ao menos um item."));
      return;
    }
    imprimirHtml(pedidoCompraA4(nome, itens));
    setModalCompra(false);
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
      <Group justify="space-between" wrap="wrap">
        <Title order={2}>Painel de produtos</Title>
        <Button
          leftSection={<IconShoppingCartPlus size={18} />}
          disabled={selecionados.size === 0}
          onClick={abrirCompra}
        >
          Montar lista de compra ({selecionados.size})
        </Button>
      </Group>

      <Card withBorder radius="md" padding="sm">
        <Group gap="sm" wrap="wrap" align="flex-end">
          <TextInput
            label="Buscar"
            placeholder="Nome ou código"
            leftSection={<IconSearch size={16} />}
            value={busca}
            onChange={(e) => setBusca(e.currentTarget.value)}
            w={{ base: "100%", sm: 200 }}
          />
          <Select
            label="Período das vendas"
            data={[
              { value: "30", label: "Últimos 30 dias" },
              { value: "90", label: "Últimos 90 dias" },
              { value: "180", label: "Últimos 6 meses" },
              { value: "365", label: "Último ano" },
            ]}
            value={dias}
            onChange={(v) => setDias(v ?? "90")}
            allowDeselect={false}
            w={160}
          />
          <Select
            label="Ordenar por"
            data={[
              { value: "mais", label: "Mais vendidos" },
              { value: "menos", label: "Menos vendidos" },
              { value: "faturado", label: "Maior faturamento" },
              { value: "estoque", label: "Menor estoque" },
              { value: "semvenda", label: "Sem venda primeiro" },
              { value: "nome", label: "Nome (A-Z)" },
            ]}
            value={ordem}
            onChange={(v) => setOrdem(v ?? "mais")}
            allowDeselect={false}
            w={170}
          />
          <Select
            label="Colorir por"
            data={[
              { value: "nenhum", label: "Nenhum" },
              { value: "abc", label: "Curva ABC" },
              { value: "giro", label: "Vende × parado" },
              { value: "estoque", label: "Estoque baixo" },
            ]}
            value={colorir}
            onChange={(v) => setColorir(v ?? "nenhum")}
            allowDeselect={false}
            w={150}
          />
          <Select
            label="Fornecedor"
            placeholder="Todos"
            clearable
            searchable
            data={fornecedoresDoPainel}
            value={filtroForn}
            onChange={setFiltroForn}
            w={180}
          />
          <Select
            label="Classe ABC"
            placeholder="Todas"
            clearable
            data={[
              { value: "A", label: "A (mais faturam)" },
              { value: "B", label: "B" },
              { value: "C", label: "C" },
              { value: "SEM_VENDA", label: "Sem venda" },
            ]}
            value={filtroClasse}
            onChange={setFiltroClasse}
            w={160}
          />
        </Group>
      </Card>

      <Text size="sm" c="dimmed">
        {itensFiltrados.length} produto(s). A curva ABC é calculada pelo faturamento do período
        escolhido (A = os que mais faturam).
      </Text>

      <Table.ScrollContainer minWidth={820}>
        <Table striped highlightOnHover verticalSpacing="sm">
          <Table.Thead>
            <Table.Tr>
              <Table.Th w={36}>
                <Checkbox
                  checked={todosMarcados}
                  onChange={alternarTodos}
                  aria-label="Selecionar todos"
                />
              </Table.Th>
              <Table.Th>Produto</Table.Th>
              <Table.Th>Estoque / mín.</Table.Th>
              <Table.Th>ABC</Table.Th>
              <Table.Th>Vendido</Table.Th>
              <Table.Th>Faturado</Table.Th>
              <Table.Th>Cobertura</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {itensFiltrados.map((it) => {
              const cor = colorir === "nenhum" ? undefined : corLinha(it, colorir);
              const saldo = Number(it.saldoEstoque);
              const minimo = Number(it.estoqueMinimo);
              const corSaldo = saldo <= 0 ? "red" : minimo > 0 && saldo <= minimo ? "orange" : undefined;
              return (
                <Table.Tr key={it.id} style={cor ? { backgroundColor: cor } : undefined}>
                  <Table.Td>
                    <Checkbox
                      checked={selecionados.has(it.id)}
                      onChange={() => alternar(it.id)}
                      aria-label={`Selecionar ${it.descricao}`}
                    />
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" fw={500}>
                      {it.descricao}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {[it.sku, it.categoria].filter(Boolean).join(" · ") || "—"}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text c={corSaldo} fw={corSaldo ? 600 : undefined}>
                      {formatarNumero(it.saldoEstoque)}
                    </Text>
                    <Text size="xs" c="dimmed">
                      mín. {formatarNumero(it.estoqueMinimo)} {it.unidade}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Badge color={ABC_INFO[it.classeAbc].cor} variant="light">
                      {ABC_INFO[it.classeAbc].label}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    {it.vendaQtd > 0 ? `${formatarNumero(it.vendaQtd)} ${it.unidade}` : "—"}
                  </Table.Td>
                  <Table.Td>{it.vendaValor > 0 ? formatarMoeda(it.vendaValor) : "—"}</Table.Td>
                  <Table.Td>
                    <Text size="sm">{it.diasCobertura != null ? `~${it.diasCobertura} dias` : "—"}</Text>
                    <Text size="xs" c="dimmed">
                      {it.ultimaVenda ? `últ. ${formatarData(it.ultimaVenda)}` : "sem venda"}
                    </Text>
                  </Table.Td>
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>

      {/* Modal: montar a lista de compra dos selecionados */}
      <Modal
        opened={modalCompra}
        onClose={() => setModalCompra(false)}
        title="Montar lista de compra"
        size="lg"
      >
        <Stack>
          <Select
            label="Fornecedor do pedido"
            placeholder="Selecione o fornecedor"
            searchable
            withAsterisk
            data={opcoesFornecedor}
            value={fornecedorCompra}
            onChange={setFornecedorCompra}
          />
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Produto</Table.Th>
                <Table.Th>Saldo</Table.Th>
                <Table.Th w={130}>Comprar</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {itensSelecionados.map((it) => (
                <Table.Tr key={it.id}>
                  <Table.Td>
                    <Text size="sm">{it.descricao}</Text>
                  </Table.Td>
                  <Table.Td>
                    {formatarNumero(it.saldoEstoque)} {it.unidade}
                  </Table.Td>
                  <Table.Td>
                    <NumberInput
                      size="xs"
                      min={0}
                      value={qtdCompra[it.id] ?? 0}
                      onChange={(v) => setQtdCompra((q) => ({ ...q, [it.id]: Number(v) || 0 }))}
                      suffix={` ${it.unidade}`}
                    />
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setModalCompra(false)}>
              Cancelar
            </Button>
            <Button leftSection={<IconPrinter size={18} />} onClick={imprimirPedido}>
              Imprimir pedido
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
