-- Renomeia "fiado" para os novos termos (a prazo / conta) nas descrições
-- já gravadas dos lançamentos da conta do cliente.
UPDATE "LancamentoConta"
SET "descricao" = REPLACE("descricao", 'para abater o fiado', 'para abater a conta')
WHERE "descricao" LIKE '%para abater o fiado%';

UPDATE "LancamentoConta"
SET "descricao" = REPLACE("descricao", 'Compra no fiado', 'Compra a prazo')
WHERE "descricao" LIKE '%Compra no fiado%';

UPDATE "LancamentoConta"
SET "descricao" = REPLACE("descricao", 'abateu o fiado', 'abateu a conta')
WHERE "descricao" LIKE '%abateu o fiado%';

UPDATE "LancamentoConta"
SET "descricao" = REPLACE("descricao", 'aplicado no fiado', 'aplicado na conta')
WHERE "descricao" LIKE '%aplicado no fiado%';
