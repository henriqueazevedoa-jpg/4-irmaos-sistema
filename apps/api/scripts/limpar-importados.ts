/**
 * Remove do banco os produtos que vieram da importação do SIC (têm codigoExterno).
 * Os produtos cadastrados manualmente (codigoExterno nulo) são preservados.
 * Uso: npx tsx scripts/limpar-importados.ts
 */
import { prisma } from "../src/prisma.js";

async function main() {
  const antes = await prisma.produto.count();
  const r = await prisma.produto.deleteMany({ where: { codigoExterno: { not: null } } });
  const depois = await prisma.produto.count();
  console.log(`Produtos removidos: ${r.count}. Antes: ${antes}, depois: ${depois}.`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
