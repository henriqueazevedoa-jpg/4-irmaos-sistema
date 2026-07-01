import { useState, lazy, Suspense } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Modal,
  TextInput,
  Autocomplete,
  Select,
  NumberInput,
  Button,
  Group,
  SimpleGrid,
  Stack,
  Text,
  Badge,
  Alert,
  ActionIcon,
  Tooltip,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { IconInfoCircle, IconCamera } from "@tabler/icons-react";

// Carrega o leitor de câmera só quando for usado.
const LeitorCodigoBarras = lazy(() =>
  import("../components/LeitorCodigoBarras").then((m) => ({ default: m.LeitorCodigoBarras }))
);
import { api } from "../lib/api";
import { useLista, useSalvar, useRemover } from "../hooks/useCadastro";
import { TabelaCadastro } from "../components/TabelaCadastro";
import { CabecalhoLista } from "../components/CabecalhoLista";
import { formatarMoeda, formatarNumero } from "../lib/formato";
import type { Produto, Categoria, Fornecedor, RespostaLista } from "../lib/tipos";

const RECURSO = "produtos";
const POR_PAGINA = 10;

const UNIDADES = ["UN", "KG", "M", "M2", "M3", "SC", "CX", "L", "BR", "PC", "PAR", "RL"];

interface FormValores {
  descricao: string;
  sku: string;
  codigoBarras: string;
  unidade: string;
  ncm: string;
  categoriaId: string;
  fornecedorPadraoId: string;
  precoCusto: number;
  precoVenda: number;
  estoqueMinimo: number;
  saldoEstoque: number;
}

const VAZIO: FormValores = {
  descricao: "",
  sku: "",
  codigoBarras: "",
  unidade: "UN",
  ncm: "",
  categoriaId: "",
  fornecedorPadraoId: "",
  precoCusto: 0,
  precoVenda: 0,
  estoqueMinimo: 0,
  saldoEstoque: 0,
};

export function ProdutosPage() {
  const [pagina, setPagina] = useState(1);
  const [busca, setBusca] = useState("");
  const [incluirInativos, setIncluirInativos] = useState(false);
  const [modalAberto, setModalAberto] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [scannerAberto, setScannerAberto] = useState(false);

  const { data, isFetching } = useLista<Produto>(RECURSO, {
    pagina,
    porPagina: POR_PAGINA,
    busca,
    incluirInativos,
  });
  const salvar = useSalvar<Produto>(RECURSO, () => setModalAberto(false));
  const remover = useRemover(RECURSO);

  // Listas para os campos de seleção
  const { data: categorias } = useQuery({
    queryKey: ["categorias"],
    queryFn: () => api.get<{ dados: Categoria[] }>("/categorias"),
  });
  const { data: fornecedores } = useQuery({
    queryKey: ["fornecedores", "select"],
    queryFn: () => api.get<RespostaLista<Fornecedor>>("/fornecedores?porPagina=100"),
  });

  const form = useForm<FormValores>({
    initialValues: VAZIO,
    validate: {
      descricao: (v) => (v.trim() ? null : "Informe a descrição do produto"),
      unidade: (v) => (v.trim() ? null : "Informe a unidade"),
    },
  });

  function abrirNovo() {
    setEditandoId(null);
    form.setValues(VAZIO);
    setModalAberto(true);
  }

  function abrirEdicao(p: Produto) {
    setEditandoId(p.id);
    form.setValues({
      descricao: p.descricao ?? "",
      sku: p.sku ?? "",
      codigoBarras: p.codigoBarras ?? "",
      unidade: p.unidade ?? "UN",
      ncm: p.ncm ?? "",
      categoriaId: p.categoriaId ?? "",
      fornecedorPadraoId: p.fornecedorPadraoId ?? "",
      precoCusto: Number(p.precoCusto) || 0,
      precoVenda: Number(p.precoVenda) || 0,
      estoqueMinimo: Number(p.estoqueMinimo) || 0,
      saldoEstoque: Number(p.saldoEstoque) || 0,
    });
    setModalAberto(true);
  }

  function enviar(valores: FormValores) {
    // Na edição não enviamos o estoque (ele muda só por entrada de nota, venda ou ajuste).
    const { saldoEstoque, ...resto } = valores;
    const dados = editandoId ? resto : valores;
    salvar.mutate({ id: editandoId ?? undefined, dados });
  }

  return (
    <Stack>
      <CabecalhoLista
        titulo="Produtos"
        rotuloNovo="Novo produto"
        busca={busca}
        aoBuscar={(v) => {
          setBusca(v);
          setPagina(1);
        }}
        incluirInativos={incluirInativos}
        aoAlternarInativos={(v) => {
          setIncluirInativos(v);
          setPagina(1);
        }}
        aoNovo={abrirNovo}
      />

      <TabelaCadastro<Produto>
        carregando={isFetching}
        dados={data?.dados}
        paginacao={data?.paginacao}
        aoMudarPagina={setPagina}
        onEditar={abrirEdicao}
        onRemover={(p) => remover.mutate(p.id)}
        descricaoRemover={(p) => p.descricao}
        colunas={[
          {
            cabecalho: "Produto",
            render: (p) => (
              <div>
                <Text fw={500}>{p.descricao}</Text>
                <Text size="xs" c="dimmed">
                  {[p.sku, p.categoria?.nome].filter(Boolean).join(" • ") || "—"}
                </Text>
              </div>
            ),
          },
          { cabecalho: "Preço venda", render: (p) => formatarMoeda(p.precoVenda) },
          {
            cabecalho: "Estoque",
            render: (p) => {
              const saldo = Number(p.saldoEstoque);
              const baixo = saldo <= Number(p.estoqueMinimo);
              return (
                <Badge color={baixo ? "red" : "teal"} variant="light">
                  {formatarNumero(p.saldoEstoque)} {p.unidade}
                </Badge>
              );
            },
          },
          {
            cabecalho: "Situação",
            render: (p) =>
              p.ativo ? (
                <Badge color="teal" variant="light">
                  Ativo
                </Badge>
              ) : (
                <Badge color="gray" variant="light">
                  Inativo
                </Badge>
              ),
          },
        ]}
      />

      <Modal
        opened={modalAberto}
        onClose={() => setModalAberto(false)}
        title={editandoId ? "Editar produto" : "Novo produto"}
        size="lg"
      >
        <form onSubmit={form.onSubmit(enviar)}>
          <Stack>
            <TextInput label="Descrição" withAsterisk {...form.getInputProps("descricao")} />
            <SimpleGrid cols={{ base: 1, sm: 2 }}>
              <TextInput label="Código interno (SKU)" {...form.getInputProps("sku")} />
              <TextInput
                label="Código de barras"
                rightSection={
                  <Tooltip label="Ler com a câmera">
                    <ActionIcon
                      variant="subtle"
                      onClick={() => setScannerAberto(true)}
                      aria-label="Ler código de barras com a câmera"
                    >
                      <IconCamera size={18} />
                    </ActionIcon>
                  </Tooltip>
                }
                {...form.getInputProps("codigoBarras")}
              />
            </SimpleGrid>
            <SimpleGrid cols={{ base: 1, sm: 3 }}>
              <Autocomplete
                label="Unidade"
                withAsterisk
                data={UNIDADES}
                {...form.getInputProps("unidade")}
              />
              <TextInput label="NCM (fiscal)" {...form.getInputProps("ncm")} />
              <Select
                label="Categoria"
                placeholder="Sem categoria"
                clearable
                searchable
                data={(categorias?.dados ?? []).map((c) => ({ value: c.id, label: c.nome }))}
                {...form.getInputProps("categoriaId")}
              />
            </SimpleGrid>
            <Select
              label="Fornecedor padrão"
              placeholder="Nenhum"
              clearable
              searchable
              data={(fornecedores?.dados ?? []).map((f) => ({
                value: f.id,
                label: f.nomeFantasia || f.razaoSocial,
              }))}
              {...form.getInputProps("fornecedorPadraoId")}
            />
            <SimpleGrid cols={{ base: 1, sm: 2 }}>
              <NumberInput
                label="Preço de custo"
                min={0}
                prefix="R$ "
                decimalScale={2}
                thousandSeparator="."
                decimalSeparator=","
                {...form.getInputProps("precoCusto")}
              />
              <NumberInput
                label="Preço de venda"
                min={0}
                prefix="R$ "
                decimalScale={2}
                thousandSeparator="."
                decimalSeparator=","
                {...form.getInputProps("precoVenda")}
              />
            </SimpleGrid>
            <SimpleGrid cols={{ base: 1, sm: 2 }}>
              <NumberInput
                label="Estoque mínimo"
                description="Aviso quando o estoque ficar abaixo disso"
                min={0}
                decimalScale={3}
                {...form.getInputProps("estoqueMinimo")}
              />
              {!editandoId && (
                <NumberInput
                  label="Estoque inicial"
                  description="Quantidade que já existe na loja"
                  min={0}
                  decimalScale={3}
                  {...form.getInputProps("saldoEstoque")}
                />
              )}
            </SimpleGrid>
            {editandoId && (
              <Alert variant="light" color="blue" icon={<IconInfoCircle size={18} />}>
                O estoque não é alterado aqui. Ele muda por entrada de nota fiscal, venda ou
                ajuste de estoque.
              </Alert>
            )}
            <Group justify="flex-end">
              <Button variant="default" onClick={() => setModalAberto(false)}>
                Cancelar
              </Button>
              <Button type="submit" loading={salvar.isPending}>
                Salvar
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>

      {scannerAberto && (
        <Suspense fallback={null}>
          <LeitorCodigoBarras
            aberto
            aoFechar={() => setScannerAberto(false)}
            aoLer={(codigo) => form.setFieldValue("codigoBarras", codigo)}
          />
        </Suspense>
      )}
    </Stack>
  );
}
