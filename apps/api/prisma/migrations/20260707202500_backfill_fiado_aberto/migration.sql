-- Acerta os dados existentes para o novo modelo de "fiado por venda".
-- (Vendas antigas tinham valorFiado/valorFiadoAberto zerados.)

-- 1) valorFiado = soma dos pagamentos no FIADO de cada venda finalizada
UPDATE "Venda" v
SET "valorFiado" = COALESCE((
  SELECT SUM(p."valor") FROM "Pagamento" p
  WHERE p."vendaId" = v."id" AND p."forma" = 'FIADO'
), 0)
WHERE v."status" = 'FINALIZADA';

-- 2) valorFiadoAberto = distribui o saldo devedor atual do cliente nas vendas,
--    das MAIS NOVAS para as mais antigas (as antigas foram pagas primeiro).
WITH ordenadas AS (
  SELECT
    v."id",
    v."clienteId",
    v."valorFiado",
    SUM(v."valorFiado") OVER (
      PARTITION BY v."clienteId"
      ORDER BY v."dataVenda" DESC, v."id" DESC
      ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    ) AS acumulado
  FROM "Venda" v
  WHERE v."status" = 'FINALIZADA' AND v."valorFiado" > 0
),
calc AS (
  SELECT
    o."id",
    GREATEST(0, LEAST(o."valorFiado", c."saldoConta" - (o.acumulado - o."valorFiado"))) AS aberto
  FROM ordenadas o
  JOIN "Cliente" c ON c."id" = o."clienteId"
)
UPDATE "Venda" v
SET "valorFiadoAberto" = calc.aberto
FROM calc
WHERE v."id" = calc."id";
