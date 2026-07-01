import { z } from "zod";

// Carrega o arquivo .env (se existir). Em produção, as variáveis vêm do sistema.
try {
  process.loadEnvFile();
} catch {
  // sem .env — tudo bem, usamos as variáveis do ambiente
}

const schema = z.object({
  DATABASE_URL: z.string().url(),
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_ANON_KEY: z.string().optional(),
  SUPABASE_SERVICE_KEY: z.string().optional(),
  PORT: z.coerce.number().default(3333),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Configuração de ambiente inválida. Verifique o arquivo apps/api/.env:");
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
