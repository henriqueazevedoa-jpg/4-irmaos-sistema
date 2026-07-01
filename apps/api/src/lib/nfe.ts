import { XMLParser } from "fast-xml-parser";

// Leitor de XML de NF-e (modelo 55) e NFC-e (modelo 65).
// Extrai o emitente (fornecedor), os itens e os totais da nota.

export interface ItemNota {
  codigoFornecedor: string | null; // cProd (código do produto no fornecedor)
  codigoBarras: string | null; // cEAN (código de barras), quando informado
  descricao: string;
  ncm: string | null;
  cfop: string | null;
  unidade: string | null;
  quantidade: number;
  valorUnitario: number;
  valorTotal: number;
}

export interface EmitenteNota {
  cnpj: string | null;
  cpf: string | null;
  nome: string | null;
  nomeFantasia: string | null;
  inscricaoEstadual: string | null;
  cep: string | null;
  logradouro: string | null;
  numero: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
}

export interface NotaLida {
  chaveAcesso: string | null;
  numero: string | null;
  serie: string | null;
  modelo: string | null;
  dataEmissao: Date | null;
  valorProdutos: number;
  valorTotal: number;
  emitente: EmitenteNota;
  itens: ItemNota[];
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  removeNSPrefix: true,
  parseTagValue: false, // mantém tudo como texto (preserva zeros à esquerda de NCM/CFOP)
  trimValues: true,
});

// Converte texto numérico (aceita vírgula) em número; retorna 0 se inválido.
function num(v: unknown): number {
  if (v === undefined || v === null) return 0;
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function texto(v: unknown): string | null {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}

function soDigitos(v: unknown): string | null {
  const s = texto(v);
  if (!s) return null;
  const d = s.replace(/\D/g, "");
  return d.length ? d : null;
}

// Garante que algo que pode vir como objeto ou lista sempre seja uma lista.
function comoLista<T>(v: T | T[] | undefined): T[] {
  if (v === undefined || v === null) return [];
  return Array.isArray(v) ? v : [v];
}

export class XmlNotaInvalido extends Error {}

export function lerNotaXml(xml: string): NotaLida {
  let doc: any;
  try {
    doc = parser.parse(xml);
  } catch {
    throw new XmlNotaInvalido("O arquivo não é um XML válido.");
  }

  // Aceita <nfeProc><NFe>...</NFe></nfeProc> ou apenas <NFe>...</NFe>
  const nfeProc = doc?.nfeProc ?? doc;
  const nfe = nfeProc?.NFe ?? doc?.NFe;
  const infNFe = nfe?.infNFe;

  if (!infNFe) {
    throw new XmlNotaInvalido(
      "Não parece um XML de NF-e. Verifique se é o arquivo da nota (contém <infNFe>)."
    );
  }

  const ide = infNFe.ide ?? {};
  const emit = infNFe.emit ?? {};
  const ender = emit.enderEmit ?? {};
  const total = infNFe.total?.ICMSTot ?? {};

  // Chave de acesso: atributo Id (ex: "NFe3520...") ou protNFe/infProt/chNFe
  const chaveId = soDigitos(infNFe["@_Id"]);
  const chaveProt = soDigitos(nfeProc?.protNFe?.infProt?.chNFe);
  const chaveAcesso = (chaveId ?? chaveProt)?.slice(-44) ?? null;

  const dataTexto = texto(ide.dhEmi) ?? texto(ide.dEmi);
  let dataEmissao: Date | null = null;
  if (dataTexto) {
    const d = new Date(dataTexto);
    dataEmissao = Number.isNaN(d.getTime()) ? null : d;
  }

  const emitente: EmitenteNota = {
    cnpj: soDigitos(emit.CNPJ),
    cpf: soDigitos(emit.CPF),
    nome: texto(emit.xNome),
    nomeFantasia: texto(emit.xFant),
    inscricaoEstadual: texto(emit.IE),
    cep: soDigitos(ender.CEP),
    logradouro: texto(ender.xLgr),
    numero: texto(ender.nro),
    bairro: texto(ender.xBairro),
    cidade: texto(ender.xMun),
    uf: texto(ender.UF),
  };

  const itens: ItemNota[] = comoLista<any>(infNFe.det).map((det) => {
    const prod = det?.prod ?? {};
    const ean = texto(prod.cEAN);
    const eanValido = ean && ean.toUpperCase() !== "SEM GTIN" ? soDigitos(ean) : null;
    return {
      codigoFornecedor: texto(prod.cProd),
      codigoBarras: eanValido,
      descricao: texto(prod.xProd) ?? "(sem descrição)",
      ncm: texto(prod.NCM),
      cfop: texto(prod.CFOP),
      unidade: texto(prod.uCom),
      quantidade: num(prod.qCom),
      valorUnitario: num(prod.vUnCom),
      valorTotal: num(prod.vProd),
    };
  });

  return {
    chaveAcesso,
    numero: texto(ide.nNF),
    serie: texto(ide.serie),
    modelo: texto(ide.mod),
    dataEmissao,
    valorProdutos: num(total.vProd),
    valorTotal: num(total.vNF) || num(total.vProd),
    emitente,
    itens,
  };
}
