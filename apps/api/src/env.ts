import { z } from "zod";

// Carrega o arquivo .env (se existir). Em produção, as variáveis vêm do sistema.
try {
  process.loadEnvFile();
} catch {
  // sem .env — tudo bem, usamos as variáveis do ambiente
}

// Trata texto vazio como "não informado" (evita falha se o campo vier em branco na nuvem).
const opcional = z.preprocess((v) => (v === "" ? undefined : v), z.string().optional());

const schema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL é obrigatório"),
  SUPABASE_URL: opcional,
  SUPABASE_ANON_KEY: opcional,
  SUPABASE_SERVICE_KEY: opcional,
  PORT: z.coerce.number().default(3333),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Configuração de ambiente inválida. Verifique o arquivo apps/api/.env:");
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
