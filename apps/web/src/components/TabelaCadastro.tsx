import type { ReactNode } from "react";
import {
  Table,
  ActionIcon,
  Group,
  Text,
  Center,
  Loader,
  Pagination,
  Stack,
} from "@mantine/core";
import { IconPencil, IconTrash } from "@tabler/icons-react";
import { modals } from "@mantine/modals";
import type { Paginacao } from "../lib/tipos";

export interface Coluna<T> {
  cabecalho: string;
  render: (item: T) => ReactNode;
}

interface Props<T extends { id: string; ativo?: boolean }> {
  colunas: Coluna<T>[];
  dados?: T[];
  carregando: boolean;
  paginacao?: Paginacao;
  aoMudarPagina: (pagina: number) => void;
  onEditar: (item: T) => void;
  onRemover: (item: T) => void;
  descricaoRemover: (item: T) => string;
  acoesExtras?: (item: T) => ReactNode;
  onRowClick?: (item: T) => void;
}

export function TabelaCadastro<T extends { id: string; ativo?: boolean }>(props: Props<T>) {
  const {
    colunas,
    dados,
    carregando,
    paginacao,
    aoMudarPagina,
    onEditar,
    onRemover,
    descricaoRemover,
    acoesExtras,
    onRowClick,
  } = props;

  function confirmarRemocao(item: T) {
    modals.openConfirmModal({
      title: "Confirmar remoção",
      children: (
        <Text size="sm">
          Deseja remover <b>{descricaoRemover(item)}</b>? O registro ficará inativo (o
          histórico é preservado).
        </Text>
      ),
      labels: { confirm: "Remover", cancel: "Cancelar" },
      confirmProps: { color: "red" },
      onConfirm: () => onRemover(item),
    });
  }

  if (carregando && !dados) {
    return (
      <Center py="xl">
        <Loader />
      </Center>
    );
  }

  if (dados && dados.length === 0) {
    return (
      <Center py="xl">
        <Text c="dimmed">Nenhum registro encontrado.</Text>
      </Center>
    );
  }

  return (
    <Stack>
      <Table.ScrollContainer minWidth={600}>
        <Table striped highlightOnHover verticalSpacing="sm">
          <Table.Thead>
            <Table.Tr>
              {colunas.map((c) => (
                <Table.Th key={c.cabecalho}>{c.cabecalho}</Table.Th>
              ))}
              <Table.Th w={120}>Ações</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {dados?.map((item) => (
              <Table.Tr
                key={item.id}
                opacity={item.ativo === false ? 0.5 : 1}
                onClick={onRowClick ? () => onRowClick(item) : undefined}
                style={onRowClick ? { cursor: "pointer" } : undefined}
              >
                {colunas.map((c) => (
                  <Table.Td key={c.cabecalho}>{c.render(item)}</Table.Td>
                ))}
                {/* Não propaga o clique dos botões para a linha */}
                <Table.Td onClick={(e) => e.stopPropagation()}>
                  <Group gap={4} wrap="nowrap">
                    {acoesExtras?.(item)}
                    <ActionIcon
                      variant="subtle"
                      onClick={() => onEditar(item)}
                      aria-label="Editar"
                    >
                      <IconPencil size={18} />
                    </ActionIcon>
                    <ActionIcon
                      variant="subtle"
                      color="red"
                      onClick={() => confirmarRemocao(item)}
                      aria-label="Remover"
                    >
                      <IconTrash size={18} />
                    </ActionIcon>
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>

      {paginacao && paginacao.totalPaginas > 1 && (
        <Group justify="center">
          <Pagination
            total={paginacao.totalPaginas}
            value={paginacao.pagina}
            onChange={aoMudarPagina}
          />
        </Group>
      )}
    </Stack>
  );
}
