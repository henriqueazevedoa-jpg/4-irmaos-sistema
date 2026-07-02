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

    const video = videoRef.current;
    if (!video) return;

    // Ajustes essenciais para a câmera funcionar no celular (especialmente iPhone).
    video.setAttribute("playsinline", "true");
    video.setAttribute("autoplay", "true");
    video.muted = true;

    let controles: IScannerControls | undefined;
    let cancelado = false;
    const leitor = new BrowserMultiFormatReader();

    const aoDetectar = (resultado: unknown, _erro: unknown, ctrl: IScannerControls) => {
      const r = resultado as { getText: () => string } | undefined;
      if (r && !cancelado) {
        cancelado = true;
        ctrl.stop();
        aoLerRef.current(r.getText());
        aoFecharRef.current();
      }
    };

    async function iniciar() {
      // 1ª tentativa: câmera traseira (melhor para ler código de barras)
      try {
        controles = await leitor.decodeFromConstraints(
          { video: { facingMode: { ideal: "environment" } } },
          video!,
          aoDetectar
        );
      } catch {
        // 2ª tentativa: qualquer câmera disponível
        try {
          controles = await leitor.decodeFromVideoDevice(undefined, video!, aoDetectar);
        } catch (e) {
          const err = e as Error;
          setErro(
            `Não foi possível abrir a câmera${err?.name ? ` (${err.name})` : ""}. ` +
              "Verifique se você tocou em 'Permitir' o acesso à câmera. " +
              "Se estiver abrindo por dentro de outro aplicativo (Instagram, Facebook, etc.), " +
              "abra o endereço no navegador (Chrome ou Safari)."
          );
          return;
        }
      }
      if (cancelado) controles?.stop();
    }
    iniciar();

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
          autoPlay
          muted
          playsInline
          style={{ width: "100%", borderRadius: 8, background: "#000", minHeight: 240 }}
        />
      </Stack>
    </Modal>
  );
}
