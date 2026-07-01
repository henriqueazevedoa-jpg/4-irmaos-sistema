import { useState } from "react";
import {
  Modal,
  TextInput,
  Textarea,
  Select,
  Button,
  Group,
  SimpleGrid,
  Stack,
  Text,
  Badge,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { useLista, useSalvar, useRemover } from "../hooks/useCadastro";
import { TabelaCadastro } from "../components/TabelaCadastro";
import { CabecalhoLista } from "../components/CabecalhoLista";
import type { Fornecedor } from "../lib/tipos";

const RECURSO = "fornecedores";
const POR_PAGINA = 10;

interface FormValores {
  tipoPessoa: "PF" | "PJ";
  cpfCnpj: string;
  razaoSocial: string;
  nomeFantasia: string;
  inscricaoEstadual: string;
  email: string;
  telefone: string;
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;
  observacoes: string;
}

const VAZIO: FormValores = {
  tipoPessoa: "PJ",
  cpfCnpj: "",
  razaoSocial: "",
  nomeFantasia: "",
  inscricaoEstadual: "",
  email: "",
  telefone: "",
  cep: "",
  logradouro: "",
  numero: "",
  complemento: "",
  bairro: "",
  cidade: "",
  uf: "",
  observacoes: "",
};

export function FornecedoresPage() {
  const [pagina, setPagina] = useState(1);
  const [busca, setBusca] = useState("");
  const [incluirInativos, setIncluirInativos] = useState(false);
  const [modalAberto, setModalAberto] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);

  const { data, isFetching } = useLista<Fornecedor>(RECURSO, {
    pagina,
    porPagina: POR_PAGINA,
    busca,
    incluirInativos,
  });
  const salvar = useSalvar<Fornecedor>(RECURSO, () => setModalAberto(false));
  const remover = useRemover(RECURSO);

  const form = useForm<FormValores>({
    initialValues: VAZIO,
    validate: {
      cpfCnpj: (v) => (v.trim() ? null : "Informe o CPF/CNPJ"),
      razaoSocial: (v) => (v.trim() ? null : "Informe a razão social / nome"),
    },
  });

  function abrirNovo() {
    setEditandoId(null);
    form.setValues(VAZIO);
    setModalAberto(true);
  }

  function abrirEdicao(f: Fornecedor) {
    setEditandoId(f.id);
    form.setValues({
      tipoPessoa: f.tipoPessoa,
      cpfCnpj: f.cpfCnpj ?? "",
      razaoSocial: f.razaoSocial ?? "",
      nomeFantasia: f.nomeFantasia ?? "",
      inscricaoEstadual: f.inscricaoEstadual ?? "",
      email: f.email ?? "",
      telefone: f.telefone ?? "",
      cep: f.cep ?? "",
      logradouro: f.logradouro ?? "",
      numero: f.numero ?? "",
      complemento: f.complemento ?? "",
      bairro: f.bairro ?? "",
      cidade: f.cidade ?? "",
      uf: f.uf ?? "",
      observacoes: f.observacoes ?? "",
    });
    setModalAberto(true);
  }

  function enviar(valores: FormValores) {
    salvar.mutate({ id: editandoId ?? undefined, dados: valores });
  }

  return (
    <Stack>
      <CabecalhoLista
        titulo="Fornecedores"
        rotuloNovo="Novo fornecedor"
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

      <TabelaCadastro<Fornecedor>
        carregando={isFetching}
        dados={data?.dados}
        paginacao={data?.paginacao}
        aoMudarPagina={setPagina}
        onEditar={abrirEdicao}
        onRemover={(f) => remover.mutate(f.id)}
        descricaoRemover={(f) => f.razaoSocial}
        colunas={[
          {
            cabecalho: "Razão social / Nome",
            render: (f) => (
              <div>
                <Text fw={500}>{f.razaoSocial}</Text>
                {f.nomeFantasia && (
                  <Text size="xs" c="dimmed">
                    {f.nomeFantasia}
                  </Text>
                )}
              </div>
            ),
          },
          { cabecalho: "CPF/CNPJ", render: (f) => f.cpfCnpj },
          { cabecalho: "Telefone", render: (f) => f.telefone ?? "—" },
          {
            cabecalho: "Cidade/UF",
            render: (f) => [f.cidade, f.uf].filter(Boolean).join(" / ") || "—",
          },
          {
            cabecalho: "Situação",
            render: (f) =>
              f.ativo ? (
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
        title={editandoId ? "Editar fornecedor" : "Novo fornecedor"}
        size="lg"
      >
        <form onSubmit={form.onSubmit(enviar)}>
          <Stack>
            <Select
              label="Tipo"
              data={[
                { value: "PJ", label: "Pessoa Jurídica (CNPJ)" },
                { value: "PF", label: "Pessoa Física (CPF)" },
              ]}
              allowDeselect={false}
              {...form.getInputProps("tipoPessoa")}
            />
            <SimpleGrid cols={{ base: 1, sm: 2 }}>
              <TextInput label="CPF / CNPJ" withAsterisk {...form.getInputProps("cpfCnpj")} />
              <TextInput label="Inscrição Estadual" {...form.getInputProps("inscricaoEstadual")} />
            </SimpleGrid>
            <TextInput
              label="Razão social / Nome"
              withAsterisk
              {...form.getInputProps("razaoSocial")}
            />
            <TextInput label="Nome fantasia" {...form.getInputProps("nomeFantasia")} />
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
