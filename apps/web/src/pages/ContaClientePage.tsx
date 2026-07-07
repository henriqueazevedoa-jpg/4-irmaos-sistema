import { useState } from "react";
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
  Accordion,
} from "@mantine/core";
import { modals } from "@mantine/modals";
import { IconArrowLeft, IconCash, IconGift } from "@tabler/icons-react";
import { api } from "../lib/api";
import { notificarErro, notificarSucesso } from "../lib/notificacoes";
import { formatarMoeda, formatarData, formatarNumero } from "../lib/formato";
import { FORMAS_RECEBIMENTO } from "../lib/pagamento";
import type { ContaCliente, VendaFiado } from "../lib/tipos";

function statusFiado(v: VendaFiado) {
  const aberto = Number(v.valorFiadoAberto);
  const fiado = Number(v.valorFiado);
  if (aberto <= 0.001) return { label: "Pago", cor: "teal" };
  if (aberto < fiado) return { label: "Parcial", cor: "yellow" };
  return { label: "Em aberto", cor: "orange" };
}

export function ContaClientePage() {
  const { id = "" } = useParams();
  const navegar = useNavigate();
  const qc = useQueryClient();
  const [modalAberto, setModalAberto] = useState(false);
  const [valor, setValor] = useState<number>(0);
  const [forma, setForma] = useState<string>("DINHEIRO");
  const [observacao, setObservacao] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["conta", id],
    queryFn: () => api.get<ContaCliente>(`/clientes/${id}/conta`),
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

  const usarHaver = useMutation({
    mutationFn: () => api.post(`/clientes/${id}/usar-haver`, {}),
    onSuccess: () => {
      invalidar();
      notificarSucesso("Crédito usado para abater o fiado.");
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
            Deve (fiado em aberto)
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
      </Group>

      {/* Compras no fiado, com status pago/parcial/em aberto */}
      <Title order={4}>Compras no fiado</Title>
      {data.vendasFiado.length === 0 ? (
        <Text c="dimmed">Nenhuma compra no fiado.</Text>
      ) : (
        <Accordion variant="separated">
          {data.vendasFiado.map((v) => {
            const st = statusFiado(v);
            return (
              <Accordion.Item key={v.id} value={v.id}>
                <Accordion.Control>
                  <Group justify="space-between" wrap="nowrap" pr="md">
                    <div>
                      <Text fw={500}>
                        Venda nº {v.numero} — {formatarData(v.dataVenda)}
                      </Text>
                      <Text size="xs" c="dimmed">
                        Total {formatarMoeda(v.total)} · Em aberto {formatarMoeda(v.valorFiadoAberto)}
                      </Text>
                    </div>
                    <Badge color={st.cor} variant="light">
                      {st.label}
                    </Badge>
                  </Group>
                </Accordion.Control>
                <Accordion.Panel>
                  <Table>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Item</Table.Th>
                        <Table.Th>Qtd</Table.Th>
                        <Table.Th>Unit.</Table.Th>
                        <Table.Th ta="right">Total</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {v.itens.map((it, i) => (
                        <Table.Tr key={i}>
                          <Table.Td>{it.descricao}</Table.Td>
                          <Table.Td>{formatarNumero(it.quantidade)}</Table.Td>
                          <Table.Td>{formatarMoeda(it.precoUnitario)}</Table.Td>
                          <Table.Td ta="right">{formatarMoeda(it.total)}</Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                </Accordion.Panel>
              </Accordion.Item>
            );
          })}
        </Accordion>
      )}

      {/* Extrato (movimentações da conta) */}
      <Title order={4}>Extrato</Title>
      {data.lancamentos.length === 0 ? (
        <Text c="dimmed">Nenhuma movimentação na conta.</Text>
      ) : (
        <Table.ScrollContainer minWidth={520}>
          <Table striped verticalSpacing="sm">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Data</Table.Th>
                <Table.Th>Movimento</Table.Th>
                <Table.Th>Valor</Table.Th>
                <Table.Th>Saldo</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {data.lancamentos.map((l) => (
                <Table.Tr key={l.id}>
                  <Table.Td>{formatarData(l.data)}</Table.Td>
                  <Table.Td>
                    <Badge color={l.tipo === "DEBITO" ? "orange" : "teal"} variant="light">
                      {l.tipo === "DEBITO" ? "Compra (fiado)" : "Pagamento/Crédito"}
                    </Badge>
                    {l.descricao && (
                      <Text size="xs" c="dimmed">
                        {l.descricao}
                      </Text>
                    )}
                  </Table.Td>
                  <Table.Td>
                    <Text c={l.tipo === "DEBITO" ? "orange" : "teal"}>
                      {l.tipo === "DEBITO" ? "+" : "−"} {formatarMoeda(l.valor)}
                    </Text>
                  </Table.Td>
                  <Table.Td>{formatarMoeda(l.saldoApos)}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      )}

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
    </Stack>
  );
}
