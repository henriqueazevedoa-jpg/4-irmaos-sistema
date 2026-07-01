// Encaminhador HTTPS para acesso pelo celular na rede da loja.
// O computador continua usando http://127.0.0.1:5173 normalmente (sem mudança).
// Este servidor escuta em HTTPS na porta 5443 e repassa tudo para o Vite (5173),
// permitindo que o celular use a câmera (que exige HTTPS fora de localhost).
import https from "node:https";
import http from "node:http";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const AQUI = dirname(fileURLToPath(import.meta.url));
const CERT = join(AQUI, "certs", "cert.pem");
const KEY = join(AQUI, "certs", "key.pem");

if (!fs.existsSync(CERT) || !fs.existsSync(KEY)) {
  console.log("ℹ️  Certificados não encontrados — acesso HTTPS pelo celular desativado.");
  process.exit(0);
}

const PORTA_HTTPS = 5443;
const ALVO = { host: "127.0.0.1", port: 5173 };
const opcoes = { key: fs.readFileSync(KEY), cert: fs.readFileSync(CERT) };

// Repassa requisições normais (páginas, arquivos, /api, etc.)
const servidor = https.createServer(opcoes, (req, res) => {
  const proxied = http.request(
    { host: ALVO.host, port: ALVO.port, path: req.url, method: req.method, headers: req.headers },
    (resposta) => {
      res.writeHead(resposta.statusCode ?? 502, resposta.headers);
      resposta.pipe(res);
    }
  );
  proxied.on("error", () => {
    res.writeHead(502);
    res.end("Servidor iniciando... recarregue em instantes.");
  });
  req.pipe(proxied);
});

// Repassa conexões WebSocket (recarregamento automático do Vite)
servidor.on("upgrade", (req, socket, head) => {
  const proxied = http.request({
    host: ALVO.host,
    port: ALVO.port,
    path: req.url,
    method: req.method,
    headers: req.headers,
  });
  proxied.on("upgrade", (resposta, socketAlvo, cabecaAlvo) => {
    const linhas = [`HTTP/1.1 101 Switching Protocols`];
    for (const [k, v] of Object.entries(resposta.headers)) linhas.push(`${k}: ${v}`);
    socket.write(linhas.join("\r\n") + "\r\n\r\n");
    if (cabecaAlvo && cabecaAlvo.length) socketAlvo.unshift(cabecaAlvo);
    socketAlvo.pipe(socket);
    socket.pipe(socketAlvo);
  });
  proxied.on("error", () => socket.destroy());
  proxied.end();
});

servidor.listen(PORTA_HTTPS, "0.0.0.0", () => {
  console.log(`🔒 HTTPS para o celular ativo na porta ${PORTA_HTTPS}`);
});
