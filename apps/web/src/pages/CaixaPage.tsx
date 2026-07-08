import { useState } from "react";
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
  Textarea,
  ThemeIcon,
  Alert,
} from "@mantine/core";
import {
  IconCashBanknote,
  IconArrowDownCircle,
  IconArrowUpCircle,
  IconLock,
  IconAlertTriangle,
} from "@tabler/icons-react";
import { api } from "../lib/api";
import { notificarErro, notificarSucesso } from "../lib/notificacoes";
import { formatarMoeda, formatarDataHora } from "../lib/formato";
import { LABEL_FORMA } from "../lib/pagamento";
import type { CaixaAtual } from "../lib/tipos";

function moedaDin(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function CaixaPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["caixa", "atual"],
    queryFn: () => api.get<CaixaAtual>("/caixa/atual"),
  });

  const [valorAbertura, setValorAbertura] = useState<number>(0);
  const [obsAbertura, setObsAbertura] = useState("");

  const [movModal, setMovModal] = useState<null | "SANGRIA" | "SUPRIMENTO">(null);
  const [movValor, setMovValor] = useState<number>(0);
  const [movDesc, setMovDesc] = useState("");

  const [fecharAberto, setFecharAberto] = useState(false);
  const [valorContado, setValorContado] = useState<number>(0);
  const [obsFechamento, setObsFechamento] = useState("");

  function invalidar() {
    qc.invalidateQueries({ queryKey: ["caixa"] });
  }

  const abrir = useMutation({
    mutationFn: () => api.post("/caixa/abrir", { valorAbertura, observacao: obsAbertura }),
    onSuccess: () => {
      invalidar();
      notificarSucesso("Caixa aberto!");
      setValorAbertura(0);
      setObsAbertura("");
    },
    onError: (e) => notificarErro(e),
  });

  const idCaixa = data?.caixa?.id;
  const movimento = useMutation({
    mutationFn: () =>
      api.post(`/caixa/${idCaixa}/movimentos`, { tipo: movModal, valor: movValor, descricao: movDesc }),
    onSuccess: () => {
      invalidar();
      notificarSucesso("Movimento registrado.");
      setMovModal(null);
      setMovValor(0);
      setMovDesc("");
    },
    onError: (e) => notificarErro(e),
  });

  const fechar = useMutation({
    mutationFn: () =>
      api.post(`/caixa/${idCaixa}/fechar`, { valorContado, observacao: obsFechamento }),
    onSuccess: () => {
      invalidar();
      notificarSucesso("Caixa fechado.");
      setFecharAberto(false);
      setValorContado(0);
      setObsFechamento("");
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

  // ─────────────── Nenhum caixa aberto: mostra a abertura ───────────────
  if (!data.caixa) {
    return (
      <Stack maw={480}>
        <Title order={2}>Caixa</Title>
        <Card withBorder radius="md" padding="lg">
          <Group mb="sm">
            <ThemeIcon variant="light" color="gray" radius="md">
              <IconCashBanknote size={18} />
            </ThemeIcon>
            <Text fw={500}>Nenhum caixa aberto no momento</Text>
          </Group>
          <Stack>
            <NumberInput
              label="Valor de abertura (troco inicial na gaveta)"
              min={0}
              prefix="R$ "
              decimalScale={2}
              thousandSeparator="."
              decimalSeparator=","
              value={valorAbertura}
              onChange={(v) => setValorAbertura(Number(v) || 0)}
            />
            <Textarea
              label="Observação (opcional)"
              autosize
              minRows={1}
              value={obsAbertura}
              onChange={(e) => setObsAbertura(e.currentTarget.value)}
            />
            <Button onClick={() => abrir.mutate()} loading={abrir.isPending}>
              Abrir caixa
            </Button>
          </Stack>
        </Card>
      </Stack>
    );
  }

  // ─────────────── Caixa aberto ───────────────
  const caixa = data.caixa;
  const r = data.resumo!;
  const esperado = Number(r.dinheiroEsperado);
  const diferencaPreview = valorContado - esperado;

  return (
    <Stack>
      <Group justify="space-between" wrap="wrap">
        <div>
          <Title order={2}>Caixa aberto</Title>
          <Text c="dimmed" size="sm">
            Aberto em {formatarDataHora(caixa.abertoEm)} · abertura {formatarMoeda(caixa.valorAbertura)}
          </Text>
        </div>
        <Badge color="teal" variant="light" size="lg">
          ABERTO
        </Badge>
      </Group>

      <SimpleGrid cols={{ base: 1, sm: 3 }}>
        <Card withBorder radius="md" padding="lg">
          <Text size="sm" c="dimmed">
            Dinheiro esperado na gaveta
          </Text>
          <Text fw={700} size="xl">
            {formatarMoeda(r.dinheiroEsperado)}
          </Text>
        </Card>
        <Card withBorder radius="md" padding="lg">
          <Text size="sm" c="dimmed">
            Vendas neste caixa
          </Text>
          <Text fw={700} size="xl">
            {r.quantidadeVendas}
          </Text>
        </Card>
        <Card withBorder radius="md" padding="lg" style={{ justifyContent: "center" }}>
          <Button
            color="red"
            leftSection={<IconLock size={18} />}
            onClick={() => {
              setValorContado(esperado);
              setFecharAberto(true);
            }}
          >
            Fechar caixa
          </Button>
        </Card>
      </SimpleGrid>

      <SimpleGrid cols={{ base: 1, md: 2 }}>
        {/* Recebido por forma de pagamento */}
        <Card withBorder radius="md" padding="lg">
          <Title order={4} mb="sm">
            Recebido por forma
          </Title>
          {r.porForma.length === 0 ? (
            <Text c="dimmed">Nenhum recebimento ainda.</Text>
          ) : (
            <Table>
              <Table.Tbody>
                {r.porForma.map((f) => (
                  <Table.Tr key={f.forma}>
                    <Table.Td>{LABEL_FORMA[f.forma]}</Table.Td>
                    <Table.Td ta="right">{formatarMoeda(f.total)}</Table.Td>
                  </Table.Tr>
                ))}
                <Table.Tr>
                  <Table.Td>Suprimentos (entradas)</Table.Td>
                  <Table.Td ta="right">{formatarMoeda(r.suprimentos)}</Table.Td>
                </Table.Tr>
                <Table.Tr>
                  <Table.Td>Sangrias (retiradas)</Table.Td>
                  <Table.Td ta="right">- {formatarMoeda(r.sangrias)}</Table.Td>
                </Table.Tr>
              </Table.Tbody>
            </Table>
          )}
        </Card>

        {/* Movimentos manuais */}
        <Card withBorder radius="md" padding="lg">
          <Group justify="space-between" mb="sm">
            <Title order={4}>Sangrias e suprimentos</Title>
          </Group>
          <Group mb="sm">
            <Button
              size="xs"
              variant="light"
              color="orange"
              leftSection={<IconArrowDownCircle size={16} />}
              onClick={() => setMovModal("SANGRIA")}
            >
              Sangria
            </Button>
            <Button
              size="xs"
              variant="light"
              color="teal"
              leftSection={<IconArrowUpCircle size={16} />}
              onClick={() => setMovModal("SUPRIMENTO")}
            >
              Suprimento
            </Button>
          </Group>
          {caixa.movimentos && caixa.movimentos.length > 0 ? (
            <Table>
              <Table.Tbody>
                {caixa.movimentos.map((m) => (
                  <Table.Tr key={m.id}>
                    <Table.Td>
                      <Badge
                        variant="light"
                        color={m.tipo === "SANGRIA" ? "orange" : "teal"}
                        size="sm"
                      >
                        {m.tipo === "SANGRIA" ? "Sangria" : "Suprimento"}
                      </Badge>
                      {m.descricao && (
                        <Text size="xs" c="dimmed">
                          {m.descricao}
                        </Text>
                      )}
                    </Table.Td>
                    <Table.Td ta="right">
                      {m.tipo === "SANGRIA" ? "- " : "+ "}
                      {formatarMoeda(m.valor)}
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          ) : (
            <Text c="dimmed" size="sm">
              Nenhuma sangria ou suprimento.
            </Text>
          )}
        </Card>
      </SimpleGrid>

      {/* Modal de sangria/suprimento */}
      <Modal
        opened={movModal !== null}
        onClose={() => setMovModal(null)}
        title={movModal === "SANGRIA" ? "Registrar sangria (retirada)" : "Registrar suprimento (entrada)"}
      >
        <Stack>
          <NumberInput
            label="Valor"
            min={0}
            prefix="R$ "
            decimalScale={2}
            thousandSeparator="."
            decimalSeparator=","
            value={movValor}
            onChange={(v) => setMovValor(Number(v) || 0)}
          />
          <Textarea
            label="Motivo / observação"
            autosize
            minRows={1}
            value={movDesc}
            onChange={(e) => setMovDesc(e.currentTarget.value)}
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setMovModal(null)}>
              Cancelar
            </Button>
            <Button onClick={() => movimento.mutate()} loading={movimento.isPending} disabled={movValor <= 0}>
              Confirmar
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Modal de fechamento */}
      <Modal opened={fecharAberto} onClose={() => setFecharAberto(false)} title="Fechar caixa">
        <Stack>
          <Group justify="space-between">
            <Text c="dimmed">Dinheiro esperado na gaveta</Text>
            <Text fw={700}>{formatarMoeda(esperado)}</Text>
          </Group>
          <NumberInput
            label="Dinheiro contado (o que está de fato na gaveta)"
            min={0}
            prefix="R$ "
            decimalScale={2}
            thousandSeparator="."
            decimalSeparator=","
            value={valorContado}
            onChange={(v) => setValorContado(Number(v) || 0)}
          />
          <Alert
            variant="light"
            color={Math.abs(diferencaPreview) < 0.005 ? "teal" : diferencaPreview > 0 ? "blue" : "orange"}
            icon={<IconAlertTriangle size={16} />}
          >
            {Math.abs(diferencaPreview) < 0.005
              ? "Bateu certinho!"
              : diferencaPreview > 0
                ? `Sobra de ${moedaDin(diferencaPreview)}`
                : `Falta de ${moedaDin(Math.abs(diferencaPreview))}`}
          </Alert>
          <Textarea
            label="Observação (opcional)"
            autosize
            minRows={1}
            value={obsFechamento}
            onChange={(e) => setObsFechamento(e.currentTarget.value)}
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setFecharAberto(false)}>
              Cancelar
            </Button>
            <Button color="red" onClick={() => fechar.mutate()} loading={fechar.isPending}>
              Fechar caixa
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
