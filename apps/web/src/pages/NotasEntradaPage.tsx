import { useRef, useState } from "react";
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
} from "@mantine/core";
import { modals } from "@mantine/modals";
import { IconFileImport, IconSearch, IconTrash, IconChevronRight } from "@tabler/icons-react";
import { api, query } from "../lib/api";
import { notificarErro, notificarSucesso } from "../lib/notificacoes";
import { formatarMoeda, formatarData } from "../lib/formato";
import { STATUS_NOTA } from "../lib/statusNota";
import type { NotaResumo, NotaDetalhe, RespostaLista } from "../lib/tipos";

const POR_PAGINA = 10;

export function NotasEntradaPage() {
  const navegar = useNavigate();
  const qc = useQueryClient();
  const inputArquivo = useRef<HTMLInputElement>(null);
  const [pagina, setPagina] = useState(1);
  const [busca, setBusca] = useState("");

  const { data, isFetching } = useQuery({
    queryKey: ["notas-entrada", { pagina, busca }],
    queryFn: () =>
      api.get<RespostaLista<NotaResumo>>(
        `/notas-entrada${query({ pagina, porPagina: POR_PAGINA, busca })}`
      ),
    placeholderData: (anterior) => anterior,
  });

  const importar = useMutation({
    mutationFn: (xml: string) =>
      api.post<NotaDetalhe>("/notas-entrada/importar-xml", { xml }),
    onSuccess: (nota) => {
      qc.invalidateQueries({ queryKey: ["notas-entrada"] });
      notificarSucesso("Nota importada! Confira os itens antes de dar entrada.");
      navegar(`/entradas/${nota.id}`);
    },
    onError: (erro) => notificarErro(erro),
  });

  const excluir = useMutation({
    mutationFn: (id: string) => api.del(`/notas-entrada/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notas-entrada"] });
      notificarSucesso("Nota excluída.");
    },
    onError: (erro) => notificarErro(erro),
  });

  async function aoEscolherArquivo(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    e.target.value = ""; // permite escolher o mesmo arquivo de novo
    if (!arquivo) return;
    const xml = await arquivo.text();
    importar.mutate(xml);
  }

  function confirmarExclusao(nota: NotaResumo) {
    modals.openConfirmModal({
      title: "Excluir nota",
      children: (
        <Text size="sm">
          Excluir a nota <b>nº {nota.numero ?? "—"}</b>? Isso só é possível porque ela ainda
          não deu entrada no estoque.
        </Text>
      ),
      labels: { confirm: "Excluir", cancel: "Cancelar" },
      confirmProps: { color: "red" },
      onConfirm: () => excluir.mutate(nota.id),
    });
  }

  const notas = data?.dados;

  return (
    <Stack>
      <input
        ref={inputArquivo}
        type="file"
        accept=".xml,text/xml,application/xml"
        style={{ display: "none" }}
        onChange={aoEscolherArquivo}
      />

      <Group justify="space-between" wrap="wrap">
        <Title order={2}>Entrada de mercadoria</Title>
        <Button
          leftSection={<IconFileImport size={18} />}
          onClick={() => inputArquivo.current?.click()}
          loading={importar.isPending}
        >
          Importar XML da nota
        </Button>
      </Group>

      <TextInput
        placeholder="Buscar por nº, chave ou fornecedor..."
        leftSection={<IconSearch size={16} />}
        value={busca}
        onChange={(e) => {
          setBusca(e.currentTarget.value);
          setPagina(1);
        }}
        w={{ base: "100%", sm: 360 }}
      />

      {isFetching && !notas ? (
        <Center py="xl">
          <Loader />
        </Center>
      ) : notas && notas.length === 0 ? (
        <Center py="xl">
          <Stack align="center" gap="xs">
            <Text c="dimmed">Nenhuma nota importada ainda.</Text>
            <Text c="dimmed" size="sm">
              Clique em "Importar XML da nota" e escolha o arquivo .xml da nota fiscal.
            </Text>
          </Stack>
        </Center>
      ) : (
        <Table.ScrollContainer minWidth={700}>
          <Table striped highlightOnHover verticalSpacing="sm">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Nº</Table.Th>
                <Table.Th>Fornecedor</Table.Th>
                <Table.Th>Emissão</Table.Th>
                <Table.Th>Itens</Table.Th>
                <Table.Th>Valor</Table.Th>
                <Table.Th>Situação</Table.Th>
                <Table.Th w={90}>Ações</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {notas?.map((n) => {
                const st = STATUS_NOTA[n.status];
                return (
                  <Table.Tr
                    key={n.id}
                    style={{ cursor: "pointer" }}
                    onClick={() => navegar(`/entradas/${n.id}`)}
                  >
                    <Table.Td>{n.numero ?? "—"}</Table.Td>
                    <Table.Td>
                      {n.fornecedor?.nomeFantasia || n.fornecedor?.razaoSocial || "—"}
                    </Table.Td>
                    <Table.Td>{formatarData(n.dataEmissao)}</Table.Td>
                    <Table.Td>{n._count.itens}</Table.Td>
                    <Table.Td>{formatarMoeda(n.valorTotal)}</Table.Td>
                    <Table.Td>
                      <Badge color={st.cor} variant="light">
                        {st.label}
                      </Badge>
                    </Table.Td>
                    <Table.Td onClick={(e) => e.stopPropagation()}>
                      <Group gap={4} wrap="nowrap">
                        {n.status !== "PROCESSADA" && (
                          <ActionIcon
                            variant="subtle"
                            color="red"
                            onClick={() => confirmarExclusao(n)}
                            aria-label="Excluir"
                          >
                            <IconTrash size={18} />
                          </ActionIcon>
                        )}
                        <ActionIcon
                          variant="subtle"
                          onClick={() => navegar(`/entradas/${n.id}`)}
                          aria-label="Abrir"
                        >
                          <IconChevronRight size={18} />
                        </ActionIcon>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      )}

      {data?.paginacao && data.paginacao.totalPaginas > 1 && (
        <Group justify="center">
          <Pagination
            total={data.paginacao.totalPaginas}
            value={pagina}
            onChange={setPagina}
          />
        </Group>
      )}
    </Stack>
  );
}
