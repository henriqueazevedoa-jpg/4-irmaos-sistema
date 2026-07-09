import { useState } from "react";
import {
  Modal,
  TextInput,
  Textarea,
  Button,
  Group,
  Stack,
  Text,
  Badge,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { useLista, useSalvar, useRemover } from "../hooks/useCadastro";
import { TabelaCadastro } from "../components/TabelaCadastro";
import { CabecalhoLista } from "../components/CabecalhoLista";
import type { Funcionario } from "../lib/tipos";

const RECURSO = "funcionarios";
const POR_PAGINA = 10;

interface FormValores {
  nome: string;
  telefone: string;
  observacoes: string;
}

const VAZIO: FormValores = {
  nome: "",
  telefone: "",
  observacoes: "",
};

export function FuncionariosPage() {
  const [pagina, setPagina] = useState(1);
  const [busca, setBusca] = useState("");
  const [incluirInativos, setIncluirInativos] = useState(false);
  const [modalAberto, setModalAberto] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);

  const { data, isFetching } = useLista<Funcionario>(RECURSO, {
    pagina,
    porPagina: POR_PAGINA,
    busca,
    incluirInativos,
  });
  const salvar = useSalvar<Funcionario>(RECURSO, () => setModalAberto(false));
  const remover = useRemover(RECURSO);

  const form = useForm<FormValores>({
    initialValues: VAZIO,
    validate: {
      nome: (v) => (v.trim() ? null : "Informe o nome do funcionário"),
    },
  });

  function abrirNovo() {
    setEditandoId(null);
    form.setValues(VAZIO);
    setModalAberto(true);
  }

  function abrirEdicao(f: Funcionario) {
    setEditandoId(f.id);
    form.setValues({
      nome: f.nome ?? "",
      telefone: f.telefone ?? "",
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
        titulo="Funcionários"
        rotuloNovo="Novo funcionário"
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

      <TabelaCadastro<Funcionario>
        carregando={isFetching}
        dados={data?.dados}
        paginacao={data?.paginacao}
        aoMudarPagina={setPagina}
        onEditar={abrirEdicao}
        onRemover={(f) => remover.mutate(f.id)}
        descricaoRemover={(f) => f.nome}
        colunas={[
          { cabecalho: "Nome", render: (f) => <Text fw={500}>{f.nome}</Text> },
          { cabecalho: "Telefone", render: (f) => f.telefone ?? "—" },
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
        title={editandoId ? "Editar funcionário" : "Novo funcionário"}
        size="sm"
      >
        <form onSubmit={form.onSubmit(enviar)}>
          <Stack>
            <TextInput label="Nome" withAsterisk {...form.getInputProps("nome")} />
            <TextInput label="Telefone" {...form.getInputProps("telefone")} />
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
