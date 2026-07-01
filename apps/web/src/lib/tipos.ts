// Tipos dos dados usados nas telas (espelham o modelo do banco).

export interface Paginacao {
  pagina: number;
  porPagina: number;
  total: number;
  totalPaginas: number;
}

export interface RespostaLista<T> {
  dados: T[];
  paginacao: Paginacao;
}

export interface Categoria {
  id: string;
  nome: string;
}

export type TipoPessoa = "PF" | "PJ";

export interface Fornecedor {
  id: string;
  tipoPessoa: TipoPessoa;
  cpfCnpj: string;
  razaoSocial: string;
  nomeFantasia: string | null;
  inscricaoEstadual: string | null;
  email: string | null;
  telefone: string | null;
  cep: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  observacoes: string | null;
  ativo: boolean;
}

export interface Cliente {
  id: string;
  tipoPessoa: TipoPessoa;
  nome: string;
  cpfCnpj: string | null;
  email: string | null;
  telefone: string | null;
  cep: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  limiteCredito: string;
  saldoConta: string;
  observacoes: string | null;
  ativo: boolean;
}

export interface ProdutoOpcao {
  id: string;
  descricao: string;
  sku: string | null;
  unidade: string;
  precoVenda: string;
  saldoEstoque: string;
}

export type FormaPagamento =
  | "DINHEIRO"
  | "PIX"
  | "CARTAO_DEBITO"
  | "CARTAO_CREDITO"
  | "FIADO"
  | "TRANSFERENCIA"
  | "OUTRO";

export type StatusVenda = "ABERTA" | "FINALIZADA" | "CANCELADA";

export interface VendaItemDetalhe {
  id: string;
  produtoId: string;
  descricao: string;
  quantidade: string;
  precoUnitario: string;
  desconto: string;
  total: string;
  produto?: { id: string; descricao: string; unidade: string } | null;
}

export interface PagamentoVenda {
  id: string;
  forma: FormaPagamento;
  valor: string;
}

export interface VendaResumo {
  id: string;
  numero: number;
  dataVenda: string;
  total: string;
  status: StatusVenda;
  cliente: { nome: string } | null;
  pagamentos: { forma: FormaPagamento }[];
  _count: { itens: number };
}

export interface VendaDetalhe {
  id: string;
  numero: number;
  dataVenda: string;
  subtotal: string;
  desconto: string;
  total: string;
  status: StatusVenda;
  observacoes: string | null;
  cliente: { id: string; nome: string } | null;
  itens: VendaItemDetalhe[];
  pagamentos: PagamentoVenda[];
}

export type TipoLancamento = "DEBITO" | "CREDITO";

export interface Lancamento {
  id: string;
  tipo: TipoLancamento;
  valor: string;
  saldoApos: string;
  descricao: string | null;
  data: string;
}

export interface ContaCliente {
  cliente: { id: string; nome: string; saldoConta: string; limiteCredito: string };
  lancamentos: Lancamento[];
}

export type StatusNota = "IMPORTADA" | "PENDENTE_REVISAO" | "PROCESSADA" | "CANCELADA";

export interface NotaItem {
  id: string;
  produtoId: string | null;
  codigoFornecedor: string | null;
  codigoBarras: string | null;
  descricaoNota: string;
  ncm: string | null;
  cfop: string | null;
  unidade: string | null;
  quantidade: string;
  valorUnitario: string;
  valorTotal: string;
  produto: { id: string; descricao: string; unidade: string; saldoEstoque: string } | null;
}

export interface NotaResumo {
  id: string;
  numero: string | null;
  chaveAcesso: string | null;
  dataEmissao: string | null;
  dataEntrada: string;
  valorTotal: string;
  status: StatusNota;
  fornecedor: { razaoSocial: string; nomeFantasia: string | null } | null;
  _count: { itens: number };
}

export interface NotaDetalhe {
  id: string;
  numero: string | null;
  serie: string | null;
  chaveAcesso: string | null;
  modelo: string | null;
  dataEmissao: string | null;
  dataEntrada: string;
  valorProdutos: string;
  valorTotal: string;
  status: StatusNota;
  fornecedor: Fornecedor | null;
  itens: NotaItem[];
}

export interface Produto {
  id: string;
  sku: string | null;
  codigoBarras: string | null;
  descricao: string;
  unidade: string;
  ncm: string | null;
  cest: string | null;
  categoriaId: string | null;
  fornecedorPadraoId: string | null;
  precoCusto: string;
  precoVenda: string;
  saldoEstoque: string;
  estoqueMinimo: string;
  ativo: boolean;
  categoria: { id: string; nome: string } | null;
  fornecedorPadrao: { id: string; razaoSocial: string; nomeFantasia: string | null } | null;
}
