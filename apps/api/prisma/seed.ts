import { PrismaClient } from "@prisma/client";

// Dados de exemplo para começar a testar o sistema.
// Rode com: npm run db:seed -w @quatro-irmaos/api
const prisma = new PrismaClient();

async function main() {
  // Categorias típicas de uma loja de materiais de construção
  const categorias = ["Cimento e Argamassa", "Hidráulica", "Elétrica", "Tintas", "Ferramentas", "Ferragens"];
  for (const nome of categorias) {
    await prisma.categoria.upsert({
      where: { nome },
      update: {},
      create: { nome },
    });
  }

  const hidraulica = await prisma.categoria.findUnique({ where: { nome: "Hidráulica" } });
  const cimento = await prisma.categoria.findUnique({ where: { nome: "Cimento e Argamassa" } });

  // Fornecedor de exemplo
  const fornecedor = await prisma.fornecedor.upsert({
    where: { cpfCnpj: "12345678000199" },
    update: {},
    create: {
      cpfCnpj: "12345678000199",
      razaoSocial: "Distribuidora de Materiais Exemplo LTDA",
      nomeFantasia: "Materiais Exemplo",
      cidade: "São Paulo",
      uf: "SP",
    },
  });

  // Produtos de exemplo
  await prisma.produto.upsert({
    where: { sku: "CIM-50KG" },
    update: {},
    create: {
      sku: "CIM-50KG",
      descricao: "Cimento CP-II 50kg",
      unidade: "SC",
      ncm: "25232910",
      precoCusto: 28.5,
      precoVenda: 39.9,
      saldoEstoque: 120,
      estoqueMinimo: 20,
      categoriaId: cimento?.id,
      fornecedorPadraoId: fornecedor.id,
    },
  });

  await prisma.produto.upsert({
    where: { sku: "TUB-PVC-100" },
    update: {},
    create: {
      sku: "TUB-PVC-100",
      descricao: "Tubo PVC Esgoto 100mm - barra 6m",
      unidade: "BR",
      ncm: "39172100",
      precoCusto: 45.0,
      precoVenda: 69.9,
      saldoEstoque: 35,
      estoqueMinimo: 10,
      categoriaId: hidraulica?.id,
      fornecedorPadraoId: fornecedor.id,
    },
  });

  // Cliente de exemplo
  await prisma.cliente.upsert({
    where: { cpfCnpj: "11122233344" },
    update: {},
    create: {
      nome: "João da Silva (cliente exemplo)",
      cpfCnpj: "11122233344",
      telefone: "(11) 90000-0000",
      limiteCredito: 500,
    },
  });

  console.log("✅ Dados de exemplo criados com sucesso.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
