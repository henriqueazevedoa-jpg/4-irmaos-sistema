import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Modal,
  Stack,
  Table,
  NumberInput,
  Select,
  Textarea,
  Button,
  Group,
  Text,
  Divider,
  Alert,
} from "@mantine/core";
import { IconInfoCircle } from "@tabler/icons-react";
import { api } from "../lib/api";
import { notificarErro, notificarSucesso } from "../lib/notificacoes";
import { formatarMoeda, formatarNumero } from "../lib/formato";
import { FORMAS_RECEBIMENTO } from "../lib/pagamento";
import { imprimirHtml } from "../lib/imprimir";
import { reciboDevolucao } from "../lib/recibos";
import type { VendaDetalhe, DestinoDevolucao } from "../lib/tipos";

interface RespostaDevolucao {
  data: string;
  valorTotal: string;
  destino: DestinoDevolucao;
  itens: { descricao: string; quantidade: string; valorUnitario: string; valorTotal: string }[];
}

interface Props {
  venda: VendaDetalhe;
  aberto: boolean;
  aoFechar: () => void;
}

// Valor unitário líquido do item (considera o desconto que a linha teve).
function unitLiquido(quantidade: string, total: string): number {
  const q = Number(quantidade);
  return q > 0 ? Number(total) / q : 0;
}

export function DevolucaoModal({ venda, aberto, aoFechar }: Props) {
  const qc = useQueryClient();
  const temCliente = !!venda.cliente;
  const [quantidades, setQuantidades] = useState<Record<string, number>>({});
  const [destino, setDestino] = useState<string>("DINHEIRO");
  const [forma, setForma] = useState<string>("DINHEIRO");
  const [observacao, setObservacao] = useState("");

  const devolver = useMutation({
    mutationFn: () => {
      const itens = venda.itens
        .filter((it) => (quantidades[it.id] ?? 0) > 0)
        .map((it) => ({ vendaItemId: it.id, quantidade: quantidades[it.id] }));
      return api.post<RespostaDevolucao>(`/vendas/${venda.id}/devolucoes`, {
        itens,
        destino,
        formaPagamento: destino === "DINHEIRO" ? forma : undefined,
        observacao,
      });
    },
    onSuccess: (dev) => {
      qc.invalidateQueries({ queryKey: ["vendas"] });
      qc.invalidateQueries({ queryKey: ["produtos"] });
      qc.invalidateQueries({ queryKey: ["conta"] });
      qc.invalidateQueries({ queryKey: ["clientes"] });
      notificarSucesso("Devolução registrada e estoque atualizado.");
      imprimirHtml(reciboDevolucao(venda, dev)); // imprime o comprovante
      aoFechar();
    },
    onError: (e) => notificarErro(e),
  });

  const total = venda.itens.reduce((acc, it) => {
    const q = quantidades[it.id] ?? 0;
    return acc + q * unitLiquido(it.quantidade, it.total);
  }, 0);

  const nada = total <= 0;

  const opcoesDestino = [
    { value: "DINHEIRO", label: "Devolver em dinheiro" },
    ...(temCliente
      ? [
          { value: "HAVER", label: "Virar crédito na conta do cliente" },
          { value: "ABATER_FIADO", label: "Abater do fiado do cliente" },
        ]
      : []),
  ];

  return (
    <Modal opened={aberto} onClose={aoFechar} title={`Devolver itens — venda nº ${venda.numero}`} size="lg">
      <Stack>
        <Text size="sm" c="dimmed">
          Informe quanto de cada item está voltando. O valor é calculado automaticamente e os itens
          voltam ao estoque.
        </Text>

        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Item</Table.Th>
              <Table.Th>Comprado</Table.Th>
              <Table.Th>Já devolvido</Table.Th>
              <Table.Th w={130}>Devolver</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {venda.itens.map((it) => {
              const disponivel = Number(it.quantidade) - Number(it.quantidadeDevolvida);
              return (
                <Table.Tr key={it.id}>
                  <Table.Td>
                    <Text size="sm">{it.descricao}</Text>
                    <Text size="xs" c="dimmed">
                      {formatarMoeda(unitLiquido(it.quantidade, it.total))} / un
                    </Text>
                  </Table.Td>
                  <Table.Td>{formatarNumero(it.quantidade)}</Table.Td>
                  <Table.Td>{formatarNumero(it.quantidadeDevolvida)}</Table.Td>
                  <Table.Td>
                    <NumberInput
                      size="xs"
                      min={0}
                      max={disponivel}
                      decimalScale={3}
                      disabled={disponivel <= 0}
                      value={quantidades[it.id] ?? 0}
                      onChange={(v) =>
                        setQuantidades((q) => ({ ...q, [it.id]: Number(v) || 0 }))
                      }
                    />
                  </Table.Td>
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>

        <Divider />

        <Select
          label="O que fazer com o valor devolvido?"
          data={opcoesDestino}
          value={destino}
          onChange={(v) => setDestino(v ?? "DINHEIRO")}
          allowDeselect={false}
        />
        {destino === "DINHEIRO" && (
          <Select
            label="Forma da devolução"
            data={FORMAS_RECEBIMENTO}
            value={forma}
            onChange={(v) => setForma(v ?? "DINHEIRO")}
            allowDeselect={false}
          />
        )}
        {!temCliente && (
          <Alert variant="light" color="gray" icon={<IconInfoCircle size={16} />} p="xs">
            Esta venda não tem cliente, então a devolução só pode ser em dinheiro.
          </Alert>
        )}

        <Textarea
          label="Observação"
          autosize
          minRows={1}
          value={observacao}
          onChange={(e) => setObservacao(e.currentTarget.value)}
        />

        <Group justify="space-between">
          <Text fw={700} size="lg">
            Total da devolução: {formatarMoeda(total)}
          </Text>
          <Group>
            <Button variant="default" onClick={aoFechar}>
              Cancelar
            </Button>
            <Button
              color="orange"
              disabled={nada}
              loading={devolver.isPending}
              onClick={() => devolver.mutate()}
            >
              Confirmar devolução
            </Button>
          </Group>
        </Group>
      </Stack>
    </Modal>
  );
}
