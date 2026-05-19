import { PrismaClient } from '@prisma/client'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'

const createPrismaClient = () => {
  console.log('🔌 Inicializando Prisma Client...')
  const connectionString = process.env.DATABASE_URL
  
  if (!connectionString) {
    console.error('❌ DATABASE_URL não encontrada no process.env')
  }

  const pool = new Pool({ connectionString })
  const adapter = new PrismaPg(pool)
  const client = new PrismaClient({ adapter })

  // Teste de conexão opcional (pode ser removido depois)
  client.$connect()
    .then(() => console.log('✅ Prisma conectado ao Postgres com sucesso!'))
    .catch((err) => console.error('❌ Falha na conexão do Prisma:', err))

  return client
}

const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof createPrismaClient> | undefined
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
