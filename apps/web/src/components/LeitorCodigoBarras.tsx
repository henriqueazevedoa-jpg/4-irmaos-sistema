import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { BrowserMultiFormatReader, type IScannerControls } from "@zxing/browser";

interface Props {
  aberto: boolean;
  aoFechar: () => void;
  aoLer: (codigo: string) => void;
}

// Leitor de código de barras em TELA CHEIA (mais robusto no celular).
// Evita a "modal" com animação, que faz o vídeo ficar preto em alguns Androids.
export function LeitorCodigoBarras({ aberto, aoFechar, aoLer }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [erro, setErro] = useState<string | null>(null);

  const aoLerRef = useRef(aoLer);
  aoLerRef.current = aoLer;
  const aoFecharRef = useRef(aoFechar);
  aoFecharRef.current = aoFechar;

  useEffect(() => {
    if (!aberto) return;
    setErro(null);

    const video = videoRef.current;
    if (!video) return;

    if (!navigator.mediaDevices?.getUserMedia) {
      setErro("Este navegador não permite usar a câmera. Abra pelo Chrome (Android) ou Safari (iPhone).");
      return;
    }

    // Ajustes essenciais para o vídeo aparecer no celular.
    video.setAttribute("playsinline", "true");
    video.setAttribute("autoplay", "true");
    video.muted = true;

    let stream: MediaStream | undefined;
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
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        if (cancelado || !stream) {
          stream?.getTracks().forEach((t) => t.stop());
          return;
        }
        controles = await leitor.decodeFromStream(stream, video!, aoDetectar);
        if (cancelado) controles.stop();
      } catch (e) {
        const err = e as Error;
        setErro(
          `Não foi possível abrir a câmera${err?.name ? ` (${err.name})` : ""}. ` +
            "Toque em 'Permitir' o acesso à câmera. Se você negou antes, toque no cadeado ao lado " +
            "do endereço → Permissões → Câmera → Permitir. Evite abrir por dentro de outro app (WhatsApp/Instagram)."
        );
      }
    }
    iniciar();

    return () => {
      cancelado = true;
      controles?.stop();
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [aberto]);

  if (!aberto) return null;

  return createPortal(
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 10000,
        background: "#000",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Cabeçalho com botão fechar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "12px 16px",
          color: "#fff",
          background: "rgba(0,0,0,0.6)",
        }}
      >
        <span style={{ fontWeight: 600 }}>Escanear código de barras</span>
        <button
          onClick={aoFechar}
          style={{
            background: "rgba(255,255,255,0.15)",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            padding: "8px 14px",
            fontSize: 16,
          }}
        >
          ✕ Fechar
        </button>
      </div>

      {/* Vídeo da câmera ocupando a tela */}
      <div style={{ position: "relative", flex: 1, overflow: "hidden" }}>
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          style={{ width: "100%", height: "100%", objectFit: "cover", background: "#000" }}
        />
        {/* Moldura de mira no centro */}
        {!erro && (
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              width: "78%",
              height: 140,
              border: "3px solid rgba(255,255,255,0.9)",
              borderRadius: 12,
              boxShadow: "0 0 0 2000px rgba(0,0,0,0.35)",
            }}
          />
        )}
      </div>

      {/* Mensagem (erro ou instrução) */}
      <div style={{ padding: "14px 16px", color: "#fff", background: "rgba(0,0,0,0.6)", textAlign: "center" }}>
        {erro ? erro : "Aponte a câmera para o código de barras do produto."}
      </div>
    </div>,
    document.body
  );
}
