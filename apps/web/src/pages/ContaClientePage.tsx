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
} from "@mantine/core";
import { IconArrowLeft, IconCash } from "@tabler/icons-react";
import { api } from "../lib/api";
import { notificarErro, notificarSucesso } from "../lib/notificacoes";
import { formatarMoeda, formatarData } from "../lib/formato";
import { FORMAS_RECEBIMENTO } from "../lib/pagamento";
import type { ContaCliente } from "../lib/tipos";

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

  const pagar = useMutation({
    mutationFn: () =>
      api.post(`/clientes/${id}/pagamentos`, { valor, forma, observacao }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["conta", id] });
      qc.invalidateQueries({ queryKey: ["clientes"] });
      notificarSucesso("Pagamento registrado.");
      setModalAberto(false);
      setValor(0);
      setObservacao("");
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

  const saldo = Number(data.cliente.saldoConta);

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
            Saldo devedor (fiado)
          </Text>
          <Text fw={700} size="xl" c={saldo > 0 ? "orange" : "teal"}>
            {formatarMoeda(saldo)}
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
        <Card withBorder radius="md" padding="lg" style={{ justifyContent: "center" }}>
          <Button
            leftSection={<IconCash size={18} />}
            disabled={saldo <= 0}
            onClick={() => {
              setValor(saldo);
              setModalAberto(true);
            }}
          >
            Registrar pagamento
          </Button>
        </Card>
      </SimpleGrid>

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
                      {l.tipo === "DEBITO" ? "Compra (fiado)" : "Pagamento"}
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
            max={saldo}
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
