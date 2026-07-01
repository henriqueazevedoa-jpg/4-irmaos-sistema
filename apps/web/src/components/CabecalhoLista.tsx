import { Group, Title, TextInput, Button, Switch, Stack } from "@mantine/core";
import { IconPlus, IconSearch } from "@tabler/icons-react";

interface Props {
  titulo: string;
  busca: string;
  aoBuscar: (valor: string) => void;
  incluirInativos: boolean;
  aoAlternarInativos: (valor: boolean) => void;
  aoNovo: () => void;
  rotuloNovo?: string;
}

export function CabecalhoLista(props: Props) {
  const { titulo, busca, aoBuscar, incluirInativos, aoAlternarInativos, aoNovo, rotuloNovo } = props;

  return (
    <Stack gap="sm">
      <Group justify="space-between" wrap="wrap">
        <Title order={2}>{titulo}</Title>
        <Button leftSection={<IconPlus size={18} />} onClick={aoNovo}>
          {rotuloNovo ?? "Novo"}
        </Button>
      </Group>
      <Group justify="space-between" wrap="wrap">
        <TextInput
          placeholder="Buscar..."
          leftSection={<IconSearch size={16} />}
          value={busca}
          onChange={(e) => aoBuscar(e.currentTarget.value)}
          w={{ base: "100%", sm: 320 }}
        />
        <Switch
          label="Mostrar inativos"
          checked={incluirInativos}
          onChange={(e) => aoAlternarInativos(e.currentTarget.checked)}
        />
      </Group>
    </Stack>
  );
}
