import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Modal,
  TextInput,
  Textarea,
  Select,
  NumberInput,
  Button,
  Group,
  SimpleGrid,
  Stack,
  Text,
  Badge,
  ActionIcon,
  Tooltip,
} from "@mantine/core";
import { IconCash } from "@tabler/icons-react";
import { useForm } from "@mantine/form";
import { useLista, useSalvar, useRemover } from "../hooks/useCadastro";
import { TabelaCadastro } from "../components/TabelaCadastro";
import { CabecalhoLista } from "../components/CabecalhoLista";
import { formatarMoeda } from "../lib/formato";
import type { Cliente } from "../lib/tipos";

const RECURSO = "clientes";
const POR_PAGINA = 10;

interface FormValores {
  tipoPessoa: "PF" | "PJ";
  nome: string;
  cpfCnpj: string;
  email: string;
  telefone: string;
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;
  limiteCredito: number;
  observacoes: string;
}

const VAZIO: FormValores = {
  tipoPessoa: "PF",
  nome: "",
  cpfCnpj: "",
  email: "",
  telefone: "",
  cep: "",
  logradouro: "",
  numero: "",
  complemento: "",
  bairro: "",
  cidade: "",
  uf: "",
  limiteCredito: 0,
  observacoes: "",
};

export function ClientesPage() {
  const [pagina, setPagina] = useState(1);
  const [busca, setBusca] = useState("");
  const [incluirInativos, setIncluirInativos] = useState(false);
  const [modalAberto, setModalAberto] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);

  const { data, isFetching } = useLista<Cliente>(RECURSO, {
    pagina,
    porPagina: POR_PAGINA,
    busca,
    incluirInativos,
  });
  const navegar = useNavigate();
  const salvar = useSalvar<Cliente>(RECURSO, () => setModalAberto(false));
  const remover = useRemover(RECURSO);

  const form = useForm<FormValores>({
    initialValues: VAZIO,
    validate: {
      nome: (v) => (v.trim() ? null : "Informe o nome do cliente"),
    },
  });

  function abrirNovo() {
    setEditandoId(null);
    form.setValues(VAZIO);
    setModalAberto(true);
  }

  function abrirEdicao(c: Cliente) {
    setEditandoId(c.id);
    form.setValues({
      tipoPessoa: c.tipoPessoa,
      nome: c.nome ?? "",
      cpfCnpj: c.cpfCnpj ?? "",
      email: c.email ?? "",
      telefone: c.telefone ?? "",
      cep: c.cep ?? "",
      logradouro: c.logradouro ?? "",
      numero: c.numero ?? "",
      complemento: c.complemento ?? "",
      bairro: c.bairro ?? "",
      cidade: c.cidade ?? "",
      uf: c.uf ?? "",
      limiteCredito: Number(c.limiteCredito) || 0,
      observacoes: c.observacoes ?? "",
    });
    setModalAberto(true);
  }

  function enviar(valores: FormValores) {
    salvar.mutate({ id: editandoId ?? undefined, dados: valores });
  }

  return (
    <Stack>
      <CabecalhoLista
        titulo="Clientes"
        rotuloNovo="Novo cliente"
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

      <TabelaCadastro<Cliente>
        carregando={isFetching}
        dados={data?.dados}
        paginacao={data?.paginacao}
        aoMudarPagina={setPagina}
        onEditar={abrirEdicao}
        onRemover={(c) => remover.mutate(c.id)}
        descricaoRemover={(c) => c.nome}
        onRowClick={(c) => navegar(`/clientes/${c.id}/conta`)}
        acoesExtras={(c) => (
          <Tooltip label="Conta do cliente">
            <ActionIcon
              variant="subtle"
              color="orange"
              onClick={() => navegar(`/clientes/${c.id}/conta`)}
              aria-label="Conta do cliente"
            >
              <IconCash size={18} />
            </ActionIcon>
          </Tooltip>
        )}
        colunas={[
          { cabecalho: "Nome", render: (c) => <Text fw={500}>{c.nome}</Text> },
          { cabecalho: "CPF/CNPJ", render: (c) => c.cpfCnpj ?? "—" },
          { cabecalho: "Telefone", render: (c) => c.telefone ?? "—" },
          {
            cabecalho: "A receber",
            render: (c) =>
              Number(c.saldoConta) > 0 ? (
                <Badge color="orange" variant="light">
                  {formatarMoeda(c.saldoConta)}
                </Badge>
              ) : (
                <Text c="dimmed">—</Text>
              ),
          },
          {
            cabecalho: "Situação",
            render: (c) =>
              c.ativo ? (
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
        title={editandoId ? "Editar cliente" : "Novo cliente"}
        size="lg"
      >
        <form onSubmit={form.onSubmit(enviar)}>
          <Stack>
            <SimpleGrid cols={{ base: 1, sm: 2 }}>
              <Select
                label="Tipo"
                data={[
                  { value: "PF", label: "Pessoa Física (CPF)" },
                  { value: "PJ", label: "Pessoa Jurídica (CNPJ)" },
                ]}
                allowDeselect={false}
                {...form.getInputProps("tipoPessoa")}
              />
              <TextInput label="CPF / CNPJ" {...form.getInputProps("cpfCnpj")} />
            </SimpleGrid>
            <TextInput label="Nome" withAsterisk {...form.getInputProps("nome")} />
            <SimpleGrid cols={{ base: 1, sm: 2 }}>
              <TextInput label="Telefone" {...form.getInputProps("telefone")} />
              <TextInput label="E-mail" {...form.getInputProps("email")} />
            </SimpleGrid>
            <SimpleGrid cols={{ base: 1, sm: 3 }}>
              <TextInput label="CEP" {...form.getInputProps("cep")} />
              <TextInput label="Cidade" {...form.getInputProps("cidade")} />
              <TextInput label="UF" maxLength={2} {...form.getInputProps("uf")} />
            </SimpleGrid>
            <SimpleGrid cols={{ base: 1, sm: 2 }}>
              <TextInput label="Logradouro" {...form.getInputProps("logradouro")} />
              <TextInput label="Número" {...form.getInputProps("numero")} />
            </SimpleGrid>
            <SimpleGrid cols={{ base: 1, sm: 2 }}>
              <TextInput label="Bairro" {...form.getInputProps("bairro")} />
              <TextInput label="Complemento" {...form.getInputProps("complemento")} />
            </SimpleGrid>
            <NumberInput
              label="Limite de crédito"
              description="Valor máximo que o cliente pode comprar a prazo"
              min={0}
              prefix="R$ "
              decimalScale={2}
              thousandSeparator="."
              decimalSeparator=","
              {...form.getInputProps("limiteCredito")}
            />
            <Textarea label="Observações" autosize minRows={2} {...form.getInputProps("observacoes")} />
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
    </Stack>
  );
}
