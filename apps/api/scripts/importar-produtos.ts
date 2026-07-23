/**
 * Importa os produtos (JSON gerado por limpar-planilha-produtos.py) para o banco.
 * Cria os fornecedores pelo nome e vincula, e insere os produtos ainda não
 * existentes (casados pelo "codigoExterno" do sistema antigo). É reexecutável:
 * roda de novo e só adiciona o que falta.
 *
 * Uso: npx tsx scripts/importar-produtos.ts /tmp/produtos-import.json
 */
import { readFileSync } from "node:fs";
import { prisma } from "../src/prisma.js";

interface ProdutoJson {
  codigoExterno: string | null;
  descricao: string;
  codigoBarras: string | null;
  unidade: string;
  ncm: string | null;
  cest: string | null;
  origem: string | null;
  csosn: string | null;
  icmsAliquota: number | null;
  fabricante: string | null;
  precoCusto: number;
  custoMedio: number;
  markup: number;
  precoVenda: number;
  saldoEstoque: number;
  estoqueMinimo: number;
  fornecedor: string | null;
}

async function main() {
  const arquivo = process.argv[2] ?? "/tmp/produtos-import.json";
  const { produtos, fornecedores } = JSON.parse(readFileSync(arquivo, "utf-8")) as {
    produtos: ProdutoJson[];
    fornecedores: string[];
  };

  // 1) Fornecedores: cria os que ainda não existem (pelo nome / razão social)
  const existentesForn = await prisma.fornecedor.findMany({ select: { id: true, razaoSocial: true } });
  const mapaForn = new Map(existentesForn.map((f) => [f.razaoSocial, f.id]));
  const novosForn = fornecedores.filter((nome) => !mapaForn.has(nome));
  if (novosForn.length) {
    await prisma.fornecedor.createMany({
      data: novosForn.map((nome) => ({ razaoSocial: nome, nomeFantasia: nome })),
    });
    const todos = await prisma.fornecedor.findMany({ select: { id: true, razaoSocial: true } });
    todos.forEach((f) => mapaForn.set(f.razaoSocial, f.id));
  }
  console.log(`Fornecedores: ${novosForn.length} criados (total ${mapaForn.size}).`);

  // 2) Produtos: só os que ainda não estão no banco (casados por codigoExterno)
  const jaExistem = new Set(
    (await prisma.produto.findMany({ where: { codigoExterno: { not: null } }, select: { codigoExterno: true } }))
      .map((p) => p.codigoExterno!)
  );
  const barrasUsados = new Set(
    (await prisma.produto.findMany({ where: { codigoBarras: { not: null } }, select: { codigoBarras: true } }))
      .map((p) => p.codigoBarras!)
  );

  const novos = produtos.filter((p) => !(p.codigoExterno && jaExistem.has(p.codigoExterno)));
  const registros = novos.map((p) => {
    let barras = p.codigoBarras;
    if (barras && barrasUsados.has(barras)) barras = null; // evita violar o único
    if (barras) barrasUsados.add(barras);
    return {
      codigoExterno: p.codigoExterno,
      descricao: p.descricao,
      codigoBarras: barras,
      unidade: p.unidade || "UN",
      ncm: p.ncm,
      cest: p.cest,
      origem: p.origem,
      csosn: p.csosn,
      icmsAliquota: p.icmsAliquota,
      fabricante: p.fabricante,
      precoCusto: p.precoCusto,
      custoMedio: p.custoMedio,
      markup: p.markup,
      precoVenda: p.precoVenda,
      saldoEstoque: p.saldoEstoque,
      estoqueMinimo: p.estoqueMinimo,
      fornecedorPadraoId: p.fornecedor ? mapaForn.get(p.fornecedor) ?? null : null,
    };
  });

  const LOTE = 1000;
  let inseridos = 0;
  for (let i = 0; i < registros.length; i += LOTE) {
    const lote = registros.slice(i, i + LOTE);
    const r = await prisma.produto.createMany({ data: lote, skipDuplicates: true });
    inseridos += r.count;
    process.stdout.write(`\rProdutos inseridos: ${inseridos}/${registros.length}`);
  }
  console.log(`\nConcluído. ${inseridos} produtos novos inseridos (${produtos.length - novos.length} já existiam).`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
