import { useMemo, useState, lazy, Suspense } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Stack,
  Group,
  Title,
  Select,
  NumberInput,
  Button,
  Card,
  Table,
  Text,
  TextInput,
  ActionIcon,
  Tooltip,
  Grid,
  Divider,
  Textarea,
  Alert,
  Center,
} from "@mantine/core";
import {
  IconTrash,
  IconShoppingCartPlus,
  IconCheck,
  IconInfoCircle,
  IconBarcode,
  IconCamera,
  IconHistory,
} from "@tabler/icons-react";
import { api, query } from "../lib/api";
import { notificarErro, notificarSucesso } from "../lib/notificacoes";
import { formatarMoeda } from "../lib/formato";
import { FORMAS_PAGAMENTO } from "../lib/pagamento";
import type { ProdutoOpcao, RespostaLista, Cliente, FormaPagamento } from "../lib/tipos";

// Carrega o leitor de câmera só quando for usado (evita peso no carregamento inicial).
const LeitorCodigoBarras = lazy(() =>
  import("../components/LeitorCodigoBarras").then((m) => ({ default: m.LeitorCodigoBarras }))
);

interface ItemCarrinho {
  produtoId: string;
  descricao: string;
  unidade: string;
  quantidade: number;
  precoUnitario: number;
}

export function PDVPage() {
  const navegar = useNavigate();
  const [carrinho, setCarrinho] = useState<ItemCarrinho[]>([]);
  const [clienteId, setClienteId] = useState<string | null>(null);
  const [desconto, setDesconto] = useState<number>(0);
  const [forma, setForma] = useState<FormaPagamento>("DINHEIRO");
  const [observacoes, setObservacoes] = useState("");
  const [codigoBipe, setCodigoBipe] = useState("");
  const [scannerAberto, setScannerAberto] = useState(false);

  const { data: produtos } = useQuery({
    queryKey: ["produtos", "opcoes"],
    queryFn: () => api.get<{ dados: ProdutoOpcao[] }>("/produtos/opcoes"),
  });
  const { data: clientes } = useQuery({
    queryKey: ["clientes", "opcoes"],
    queryFn: () => api.get<RespostaLista<Cliente>>(`/clientes${query({ porPagina: 100 })}`),
  });

  const qc = useQueryClient();
  const finalizar = useMutation({
    mutationFn: (payload: unknown) => api.post("/vendas", payload),
    onSuccess: () => {
      notificarSucesso("Venda registrada e estoque atualizado!");
      limparVenda(); // já deixa a tela pronta para a próxima venda
      qc.invalidateQueries({ queryKey: ["produtos"] }); // atualiza o estoque nas opções
    },
    onError: (e) => notificarErro(e),
  });

  function limparVenda() {
    setCarrinho([]);
    setClienteId(null);
    setDesconto(0);
    setForma("DINHEIRO");
    setObservacoes("");
    setCodigoBipe("");
  }

  const mapaProdutos = useMemo(
    () => new Map((produtos?.dados ?? []).map((p) => [p.id, p])),
    [produtos]
  );

  const subtotal = carrinho.reduce((acc, i) => acc + i.quantidade * i.precoUnitario, 0);
  const total = Math.max(0, subtotal - desconto);
  const ehFiado = forma === "FIADO";

  function adicionarProduto(p: ProdutoOpcao) {
    setCarrinho((atual) => {
      const existe = atual.find((i) => i.produtoId === p.id);
      if (existe) {
        return atual.map((i) =>
          i.produtoId === p.id ? { ...i, quantidade: i.quantidade + 1 } : i
        );
      }
      return [
        ...atual,
        {
          produtoId: p.id,
          descricao: p.descricao,
          unidade: p.unidade,
          quantidade: 1,
          precoUnitario: Number(p.precoVenda),
        },
      ];
    });
  }

  function adicionarPorId(produtoId: string | null) {
    if (!produtoId) return;
    const p = mapaProdutos.get(produtoId);
    if (p) adicionarProduto(p);
  }

  // Busca o produto pelo código de barras (leitor USB ou câmera) e joga no carrinho.
  async function buscarPorCodigo(codigo: string) {
    const cod = codigo.trim();
    if (!cod) return;
    try {
      const p = await api.get<ProdutoOpcao>(
        `/produtos/por-codigo-barras/${encodeURIComponent(cod)}`
      );
      adicionarProduto(p);
      notificarSucesso(`${p.descricao} adicionado.`);
    } catch (e) {
      notificarErro(e);
    } finally {
      setCodigoBipe("");
    }
  }

  function atualizarItem(produtoId: string, campos: Partial<ItemCarrinho>) {
    setCarrinho((atual) =>
      atual.map((i) => (i.produtoId === produtoId ? { ...i, ...campos } : i))
    );
  }

  function remover(produtoId: string) {
    setCarrinho((atual) => atual.filter((i) => i.produtoId !== produtoId));
  }

  function enviar() {
    if (carrinho.length === 0) {
      notificarErro(new Error("Adicione ao menos um produto à venda."));
      return;
    }
    if (ehFiado && !clienteId) {
      notificarErro(new Error("Venda no fiado exige selecionar um cliente."));
      return;
    }
    finalizar.mutate({
      clienteId: clienteId || null,
      desconto,
      observacoes,
      itens: carrinho.map((i) => ({
        produtoId: i.produtoId,
        quantidade: i.quantidade,
        precoUnitario: i.precoUnitario,
      })),
      pagamentos: [{ forma, valor: total }],
    });
  }

  const opcoesProduto = (produtos?.dados ?? []).map((p) => ({
    value: p.id,
    label: `${p.descricao} — ${formatarMoeda(p.precoVenda)} (estoque: ${Number(p.saldoEstoque)} ${p.unidade})`,
  }));

  return (
    <Stack>
      <Group justify="space-between" wrap="wrap">
        <Title order={2}>Nova venda</Title>
        <Button
          variant="light"
          leftSection={<IconHistory size={18} />}
          onClick={() => navegar("/vendas/historico")}
        >
          Histórico de vendas
        </Button>
      </Group>

      <Grid gutter="md">
        {/* Coluna do carrinho */}
        <Grid.Col span={{ base: 12, md: 8 }}>
          <Card withBorder radius="md" padding="lg">
            <Group gap="xs" wrap="nowrap" mb="xs">
              <TextInput
                style={{ flex: 1 }}
                placeholder="Bipe o código de barras aqui..."
                autoFocus
                leftSection={<IconBarcode size={18} />}
                value={codigoBipe}
                onChange={(e) => setCodigoBipe(e.currentTarget.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    buscarPorCodigo(codigoBipe);
                  }
                }}
              />
              <Tooltip label="Ler com a câmera">
                <ActionIcon
                  size={36}
                  variant="light"
                  onClick={() => setScannerAberto(true)}
                  aria-label="Ler com a câmera"
                >
                  <IconCamera size={20} />
                </ActionIcon>
              </Tooltip>
            </Group>

            <Select
              placeholder="...ou busque o produto pelo nome"
              searchable
              leftSection={<IconShoppingCartPlus size={18} />}
              data={opcoesProduto}
              value={null}
              onChange={adicionarPorId}
              nothingFoundMessage="Nenhum produto"
              mb="md"
            />

            {carrinho.length === 0 ? (
              <Center py="xl">
                <Text c="dimmed">Adicione produtos para começar a venda.</Text>
              </Center>
            ) : (
              <Table.ScrollContainer minWidth={500}>
                <Table verticalSpacing="sm">
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Produto</Table.Th>
                      <Table.Th w={110}>Qtd</Table.Th>
                      <Table.Th w={140}>Preço unit.</Table.Th>
                      <Table.Th w={120}>Total</Table.Th>
                      <Table.Th w={40}></Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {carrinho.map((i) => (
                      <Table.Tr key={i.produtoId}>
                        <Table.Td>
                          <Text size="sm">{i.descricao}</Text>
                          <Text size="xs" c="dimmed">
                            {i.unidade}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <NumberInput
                            value={i.quantidade}
                            onChange={(v) =>
                              atualizarItem(i.produtoId, { quantidade: Number(v) || 0 })
                            }
                            min={0}
                            decimalScale={3}
                            size="xs"
                          />
                        </Table.Td>
                        <Table.Td>
                          <NumberInput
                            value={i.precoUnitario}
                            onChange={(v) =>
                              atualizarItem(i.produtoId, { precoUnitario: Number(v) || 0 })
                            }
                            min={0}
                            decimalScale={2}
                            prefix="R$ "
                            thousandSeparator="."
                            decimalSeparator=","
                            size="xs"
                          />
                        </Table.Td>
                        <Table.Td>{formatarMoeda(i.quantidade * i.precoUnitario)}</Table.Td>
                        <Table.Td>
                          <ActionIcon
                            variant="subtle"
                            color="red"
                            onClick={() => remover(i.produtoId)}
                            aria-label="Remover item"
                          >
                            <IconTrash size={18} />
                          </ActionIcon>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Table.ScrollContainer>
            )}
          </Card>
        </Grid.Col>

        {/* Coluna do resumo/pagamento */}
        <Grid.Col span={{ base: 12, md: 4 }}>
          <Card withBorder radius="md" padding="lg">
            <Stack>
              <Select
                label="Cliente"
                placeholder="Consumidor (sem cadastro)"
                searchable
                clearable
                data={(clientes?.dados ?? []).map((c) => ({ value: c.id, label: c.nome }))}
                value={clienteId}
                onChange={setClienteId}
              />

              <NumberInput
                label="Desconto na venda"
                min={0}
                prefix="R$ "
                decimalScale={2}
                thousandSeparator="."
                decimalSeparator=","
                value={desconto}
                onChange={(v) => setDesconto(Number(v) || 0)}
              />

              <Select
                label="Forma de pagamento"
                data={FORMAS_PAGAMENTO}
                value={forma}
                onChange={(v) => setForma((v as FormaPagamento) ?? "DINHEIRO")}
                allowDeselect={false}
              />

              {ehFiado && !clienteId && (
                <Alert color="orange" variant="light" icon={<IconInfoCircle size={16} />} p="xs">
                  Selecione um cliente para vender no fiado.
                </Alert>
              )}

              <Textarea
                label="Observações"
                autosize
                minRows={1}
                value={observacoes}
                onChange={(e) => setObservacoes(e.currentTarget.value)}
              />

              <Divider />

              <Group justify="space-between">
                <Text c="dimmed">Subtotal</Text>
                <Text>{formatarMoeda(subtotal)}</Text>
              </Group>
              <Group justify="space-between">
                <Text fw={700} size="lg">
                  Total
                </Text>
                <Text fw={700} size="lg">
                  {formatarMoeda(total)}
                </Text>
              </Group>

              <Button
                size="md"
                leftSection={<IconCheck size={20} />}
                onClick={enviar}
                loading={finalizar.isPending}
                disabled={carrinho.length === 0}
              >
                Finalizar venda
              </Button>
            </Stack>
          </Card>
        </Grid.Col>
      </Grid>

      {scannerAberto && (
        <Suspense fallback={null}>
          <LeitorCodigoBarras
            aberto
            aoFechar={() => setScannerAberto(false)}
            aoLer={buscarPorCodigo}
          />
        </Suspense>
      )}
    </Stack>
  );
}
