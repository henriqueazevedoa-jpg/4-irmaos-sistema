import { PrismaClient } from "@prisma/client";

// Cliente único de acesso ao banco, reutilizado por toda a aplicação.
export const prisma = new PrismaClient();
