import { useEffect, useRef, useState } from "react";
import { Modal, Text, Alert, Stack } from "@mantine/core";
import { BrowserMultiFormatReader, type IScannerControls } from "@zxing/browser";

interface Props {
  aberto: boolean;
  aoFechar: () => void;
  aoLer: (codigo: string) => void;
}

// Modal que abre a câmera e lê um código de barras (EAN/UPC etc).
// Ao ler, chama aoLer(codigo) e fecha. Prefere a câmera traseira no celular.
export function LeitorCodigoBarras({ aberto, aoFechar, aoLer }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [erro, setErro] = useState<string | null>(null);

  // Mantém as funções mais recentes sem reiniciar a câmera a cada render.
  const aoLerRef = useRef(aoLer);
  aoLerRef.current = aoLer;
  const aoFecharRef = useRef(aoFechar);
  aoFecharRef.current = aoFechar;

  useEffect(() => {
    if (!aberto) return;
    setErro(null);

    let controles: IScannerControls | undefined;
    let cancelado = false;
    const leitor = new BrowserMultiFormatReader();

    leitor
      .decodeFromConstraints(
        { video: { facingMode: { ideal: "environment" } } },
        videoRef.current!,
        (resultado, _erro, ctrl) => {
          if (resultado && !cancelado) {
            cancelado = true;
            ctrl.stop();
            aoLerRef.current(resultado.getText());
            aoFecharRef.current();
          }
        }
      )
      .then((c) => {
        controles = c;
        if (cancelado) c.stop();
      })
      .catch(() => setErro("Não foi possível acessar a câmera. Verifique a permissão do navegador."));

    return () => {
      cancelado = true;
      controles?.stop();
    };
  }, [aberto]);

  return (
    <Modal opened={aberto} onClose={aoFechar} title="Escanear código de barras" size="md" centered>
      <Stack>
        {erro ? (
          <Alert color="red" variant="light">
            {erro}
          </Alert>
        ) : (
          <Text size="sm" c="dimmed">
            Aponte a câmera para o código de barras do produto.
          </Text>
        )}
        <video
          ref={videoRef}
          style={{ width: "100%", borderRadius: 8, background: "#000", minHeight: 240 }}
        />
      </Stack>
    </Modal>
  );
}
