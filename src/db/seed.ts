import { db } from './index';
import { users, systemModules, usersSystemAccess, auditLogs, groups, userGroups, groupSystemAccess } from './schema';
import { eq } from 'drizzle-orm';

async function main() {
  console.log('🌱 Iniciando seed do Core DB com Drizzle...');

  // Limpar tabelas
  await db.delete(auditLogs);
  await db.delete(usersSystemAccess);
  await db.delete(groupSystemAccess);
  await db.delete(userGroups);
  await db.delete(groups);
  await db.delete(systemModules);
  await db.delete(users);

  console.log('🧹 Tabelas limpas.');

  // Módulos do Sistema
  const avaResult = await db.insert(systemModules).values({
    name: 'AVA Reports',
    slug: 'ava',
    description: 'Relatórios de Progresso e Indicadores AVA',
    colorCode: '#1976D2',
    iconClass: 'ti-chart-bar',
    pathUrl: '/relatorios',
  }).returning();
  const ava = avaResult[0];

  const backofficeResult = await db.insert(systemModules).values({
    name: 'Backoffice Agendamentos',
    slug: 'backoffice',
    description: 'Gestão Dinâmica de Presença e Agendamentos',
    colorCode: '#0097A7',
    iconClass: 'ti-calendar-event',
    pathUrl: '/backoffice',
  }).returning();
  const backoffice = backofficeResult[0];

  console.log('✅ Módulos de sistemas criados!');

  // Grupos
  const superAdminGroupResult = await db.insert(groups).values({
    name: 'Super Admin',
    description: 'Acesso irrestrito a todos os sistemas',
  }).returning();
  const superAdminGroup = superAdminGroupResult[0];

  console.log('✅ Grupos criados!');

  // Usuário Administrador
  const adminResult = await db.insert(users).values({
    userid: 'ricardo.dias',
    name: 'Ricardo Dias',
    email: 'rrrdias25@gmail.com',
    password: 'senha_secreta_admin', // Use hashing em produção
  }).returning();
  const adminUser = adminResult[0];

  console.log(`👤 Usuário ${adminUser.name} criado com sucesso!`);

  // Associar Usuário ao Grupo
  await db.insert(userGroups).values({
    userId: adminUser.id,
    groupId: superAdminGroup.id,
  });

  // Associar Acessos ao Grupo e ao Usuário
  await db.insert(groupSystemAccess).values([
    { groupId: superAdminGroup.id, systemModuleId: ava.id },
    { groupId: superAdminGroup.id, systemModuleId: backoffice.id },
  ]);

  await db.insert(usersSystemAccess).values([
    { userId: adminUser.id, systemModuleId: ava.id },
    { userId: adminUser.id, systemModuleId: backoffice.id },
  ]);

  console.log('🔗 Vínculos de acessos aos sistemas concedidos com sucesso!');
}

main().then(() => {
  process.exit(0);
}).catch((e) => {
  console.error(e);
  process.exit(1);
});
