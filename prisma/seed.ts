import { PrismaClient, Role } from '@prisma/client'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'

const databaseUrl = "postgresql://admin:1213122@127.0.0.1:5432/core_db?schema=public";
const pool = new Pool({ connectionString: databaseUrl });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 Iniciando seed do Core DB...')

  // 1. Limpar dados antigos para evitar duplicidade ao reexecutar
  // Ordem importa devido às chaves estrangeiras
  await prisma.auditLog.deleteMany()
  await prisma.systemAccess.deleteMany()
  await prisma.systemModule.deleteMany()
  await prisma.user.deleteMany()

  // 2. Criar os Módulos de Sistemas Oficiais (Design System)
//   const catedra = await prisma.systemModule.create({
//     data: {
//       name: 'Cátedra Flow',
//       slug: 'catedra',
//       description: 'Gestão Acadêmica e Alocação de Professores',
//       colorCode: '#27AE60', // Verde Primário
//       iconClass: 'ti-school',
//       pathUrl: '/catedra',
//     },
//   })

  const ava = await prisma.systemModule.create({
    data: {
      name: 'AVA Reports',
      slug: 'ava',
      description: 'Relatórios de Progresso e Indicadores AVA',
      colorCode: '#1976D2', // Azul Ação
      iconClass: 'ti-chart-bar',
      pathUrl: '/relatorios',
    },
  })

  const backoffice = await prisma.systemModule.create({
    data: {
      name: 'Backoffice Agendamentos',
      slug: 'backoffice',
      description: 'Gestão Dinâmica de Presença e Agendamentos',
      colorCode: '#0097A7', // Teal Oficial
      iconClass: 'ti-calendar-event',
      pathUrl: '/backoffice',
    },
  })

  console.log('✅ Módulos de sistemas criados!')

  // 3. Criar Usuário Administrador (Mockado baseado na maquete)
  const adminUser = await prisma.user.create({
    data: {
      keycloakId: '4eed2fa9-67d4-41ed-93dd-a65d9a5876a7', // Será substituído pelo ID real do Keycloak depois
      userid: 'ricardo.dias', // Formato DM Mono
      name: 'Ricardo Dias',
      email: 'rrrdias25@gmail.com',
      role: Role.SUPER_ADMIN,
    },
  })

  console.log(`👤 Usuário ${adminUser.name} criado como SUPER_ADMIN!`)

  // 4. Associar o usuário aos sistemas na tabela pivot SystemAccess
  await prisma.systemAccess.createMany({
    data: [
    //   { userId: adminUser.id, systemModuleId: catedra.id },
      { userId: adminUser.id, systemModuleId: ava.id },
      { userId: adminUser.id, systemModuleId: backoffice.id },
    ],
  })

  console.log('🔗 Vínculos de acessos aos sistemas concedidos com sucesso!')
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })