#!/usr/bin/env python3
"""
Lê a planilha de produtos do sistema antigo (SIC) e gera um JSON normalizado
pronto para importar no sistema novo. Faz a limpeza dos dados (decimais no
formato brasileiro, unidades bagunçadas, GTIN inválido, duplicados).

Uso:
    python3 limpar-planilha-produtos.py "/caminho/Plan1 PRODUTOS COMPLETA.xlsx" saida.json
"""
import sys, json, re
from openpyxl import load_workbook


def norm_nome(s):
    s = re.sub(r"[^A-Z0-9 ]", " ", str(s).upper())
    return re.sub(r"\s+", " ", s).strip()

UNI_MAP = {"UND": "UN", "UNID": "UN", "UNIDADE": "UN", "UN.": "UN", "PC.": "PC", "PÇ": "PC", "PCS": "PC"}


def num(v):
    if v is None or v == "":
        return None
    if isinstance(v, (int, float)):
        return float(v)
    s = str(v).strip()
    if s == "":
        return None
    if "," in s:  # formato brasileiro: ponto = milhar, vírgula = decimal
        s = s.replace(".", "").replace(",", ".")
    try:
        return float(s)
    except ValueError:
        return None


def code_str(v):
    if v is None or str(v).strip() == "":
        return None
    if isinstance(v, (int, float)):
        return str(int(v))
    return str(v).strip()


def ncm_clean(v):
    if v is None:
        return None
    s = "".join(ch for ch in str(v) if ch.isdigit())
    if not s:
        return None
    return s.zfill(8)[:8] if len(s) <= 8 else s[:8]


def barcode_clean(v):
    if v is None:
        return None
    s = str(v).strip().upper()
    if "SEM GTIN" in s or s == "":
        return None
    d = "".join(ch for ch in s if ch.isdigit())
    return d if 8 <= len(d) <= 14 else None


def unidade_clean(v):
    if v is None or str(v).strip() == "":
        return "UN"
    s = str(v).strip().upper()
    return UNI_MAP.get(s, s)[:10]


def texto(v):
    if v is None:
        return None
    s = str(v).strip()
    return s or None


def main():
    entrada = sys.argv[1]
    saida = sys.argv[2] if len(sys.argv) > 2 else "produtos-import.json"
    wb = load_workbook(entrada, read_only=True, data_only=True)
    ws = wb["Plan1"]
    rows = ws.iter_rows(values_only=True)
    header = list(next(rows))
    idx = {h: i for i, h in enumerate(header)}

    def g(r, name):
        return r[idx[name]] if name in idx else None

    produtos = []
    fornecedores = set()
    vistos_codigo = set()
    vistos_barras = set()
    pulados_sem_nome = 0
    pulados_dup = 0

    for r in rows:
        descricao = texto(g(r, "Produto"))
        if not descricao:
            pulados_sem_nome += 1
            continue

        codigo = code_str(g(r, "Código"))
        if codigo and codigo in vistos_codigo:
            pulados_dup += 1
            continue
        if codigo:
            vistos_codigo.add(codigo)

        # código de barras (dedup: mantém o primeiro, anula repetidos)
        barras = barcode_clean(g(r, "Cean")) or barcode_clean(g(r, "Ceantrib"))
        if barras and barras in vistos_barras:
            barras = None
        if barras:
            vistos_barras.add(barras)

        fornecedor = texto(g(r, "Fornecedor"))
        if fornecedor:
            fornecedores.add(fornecedor)

        # Preço: o "Preço de venda" e o "Custo médio" da planilha vêm corrompidos
        # (vírgula perdida na exportação do SIC) em ~7% dos itens. O último custo e
        # o markup (Lucro) estão corretos, então reconstruímos o preço a partir deles.
        custo = num(g(r, "Preço de custo")) or 0
        markup = num(g(r, "Lucro"))
        venda_gravada = num(g(r, "Preço de venda")) or 0
        custo_ok = 0 < custo <= 10000  # acima disso o próprio custo está corrompido
        if custo_ok and markup is not None:
            preco_venda = round(custo * (1 + markup / 100), 2)
        elif 0 < venda_gravada <= 10000:
            preco_venda = venda_gravada  # custo ruim, mas o preço gravado é plausível
        else:
            preco_venda = 0  # sem base confiável — a loja preenche depois
        custo_final = custo if custo_ok else 0

        produtos.append({
            "codigoExterno": codigo,
            "descricao": descricao,
            "codigoBarras": barras,
            "unidade": unidade_clean(g(r, "Unidade")),
            "ncm": ncm_clean(g(r, "NCM")),
            "cest": code_str(g(r, "Cest")),
            "origem": code_str(g(r, "Origem")),
            "csosn": code_str(g(r, "Cst")),
            "icmsAliquota": num(g(r, "Icms")),
            "fabricante": texto(g(r, "Fabricante")),
            "precoCusto": custo_final,
            "custoMedio": custo_final,  # inicializa com o último custo (coluna 'Custo médio' não é confiável)
            "markup": markup or 0,
            "precoVenda": preco_venda,
            "saldoEstoque": num(g(r, "Quantidade")) or 0,
            "estoqueMinimo": num(g(r, "Estoque mínimo")) or 0,
            "fornecedor": fornecedor,
        })

    # Dedup por nome normalizado: mantém o item com maior estoque de cada grupo.
    melhor = {}
    for p in produtos:
        k = norm_nome(p["descricao"])
        if k not in melhor or (p["saldoEstoque"] or 0) > (melhor[k]["saldoEstoque"] or 0):
            melhor[k] = p
    dedup = list(melhor.values())
    removidos_nome = len(produtos) - len(dedup)

    with open(saida, "w", encoding="utf-8") as f:
        json.dump({"produtos": dedup, "fornecedores": sorted(fornecedores)}, f, ensure_ascii=False)

    print(f"Produtos: {len(dedup)} | Fornecedores: {len(fornecedores)} | "
          f"pulados sem nome: {pulados_sem_nome} | dup. de código: {pulados_dup} | "
          f"dup. de nome removidos: {removidos_nome}")


if __name__ == "__main__":
    main()
