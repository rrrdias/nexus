import { db } from './index';
import { 
  users, 
  systemModules, 
  usersSystemAccess, 
  auditLogs, 
  groups, 
  userGroups, 
  groupSystemAccess,
  locals,
  opcaos,
  agendamentosMatricula,
  avaProgressReport,
  avaOpenlms
} from './schema';
import * as bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';

export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

async function main() {
  console.log('🌱 Iniciando seed do Core DB com Drizzle...');

  // Limpar tabelas (ordem reversa de chave estrangeira)
  await db.delete(agendamentosMatricula);
  await db.delete(opcaos);
  await db.delete(locals);
  await db.delete(auditLogs);
  await db.delete(usersSystemAccess);
  await db.delete(groupSystemAccess);
  await db.delete(userGroups);
  await db.delete(groups);
  await db.delete(systemModules);
  await db.delete(users);
  await db.delete(avaProgressReport);

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
    pathUrl: '/admin/scheduling',
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

  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  if (!adminPassword) {
    throw new Error('SEED_ADMIN_PASSWORD is required');
  }

  // Usuário Administrador
  const adminResult = await db.insert(users).values({
    userid: 'ricardo.dias',
    name: 'Ricardo Dias',
    email: 'rrrdias25@gmail.com',
    password: await hashPassword(adminPassword),
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

  // --- SEED DE AGENDAMENTO ---
  console.log('🌱 Semeando dados de polos e agendamentos...');

  // 1. Criar Polos
  const poloAnapolis = await db.insert(locals).values({
    nome: 'Anápolis (UniEvangélica)',
    endereco: 'Av. Universitária, km 3,5 - Cidade Universitária',
    linkLocal: 'https://maps.google.com/?q=UniEvangelica',
    telefone: '(62) 3310-6600',
    status: true,
  }).returning();

  const poloGoianesia = await db.insert(locals).values({
    nome: 'Polo Goianésia',
    endereco: 'Rua 33, nº 456 - Setor Sul, Goianésia - GO',
    linkLocal: 'https://maps.google.com/?q=Goianesia',
    telefone: '(62) 3353-1200',
    status: true,
  }).returning();

  console.log('✅ Polos criados!');

  // 2. Criar Opções (Slots de Horários)
  // Hoje e Amanhã
  const hoje = new Date();
  hoje.setHours(0,0,0,0);
  const amanha = new Date();
  amanha.setDate(hoje.getDate() + 1);
  amanha.setHours(0,0,0,0);

  // Slots para Anápolis
  const slot1 = await db.insert(opcaos).values({
    localId: poloAnapolis[0].id,
    data: hoje,
    hora: '08:00:00',
    vagas: 25,
    status: true,
  }).returning();

  const slot2 = await db.insert(opcaos).values({
    localId: poloAnapolis[0].id,
    data: hoje,
    hora: '08:30:00',
    vagas: 25,
    status: true,
  }).returning();

  const slot3 = await db.insert(opcaos).values({
    localId: poloAnapolis[0].id,
    data: hoje,
    hora: '09:00:00',
    vagas: 24, // uma vaga já ocupada
    status: true,
  }).returning();

  const slot4 = await db.insert(opcaos).values({
    localId: poloAnapolis[0].id,
    data: hoje,
    hora: '09:30:00',
    vagas: 24, // uma vaga já ocupada
    status: true,
  }).returning();

  // Slots para Goianésia
  await db.insert(opcaos).values([
    {
      localId: poloGoianesia[0].id,
      data: amanha,
      hora: '14:00:00',
      vagas: 15,
      status: true,
    },
    {
      localId: poloGoianesia[0].id,
      data: amanha,
      hora: '14:30:00',
      vagas: 15,
      status: true,
    }
  ]);

  console.log('✅ Horários (slots) criados!');

  // 3. Criar Alunos e Matérias no Moodle local
  // Matrícula "123456" com 2 matérias
  await db.insert(avaProgressReport).values([
    {
      sourceInstitution: 'ead',
      alunoId: '1001',
      usuario: 'aluno.teste@unievangelica.edu.br',
      aluno: 'João Aluno Teste',
      matricula: '123456',
      userPhone1: '(62) 99999-1111',
      periodo: '2026-1',
      curso: 'Programação I',
      enrolmentStatus: 'active',
      progressoTotal: '45.5',
    },
    {
      sourceInstitution: 'ead',
      alunoId: '1001',
      usuario: 'aluno.teste@unievangelica.edu.br',
      aluno: 'João Aluno Teste',
      matricula: '123456',
      userPhone1: '(62) 99999-1111',
      periodo: '2026-1',
      curso: 'Estruturas de Dados',
      enrolmentStatus: 'active',
      progressoTotal: '30.0',
    }
  ]);

  // Outro Aluno "789012" com 1 matéria
  await db.insert(avaProgressReport).values({
    sourceInstitution: 'ead',
    alunoId: '1002',
    usuario: 'maria.estudante@unievangelica.edu.br',
    aluno: 'Maria Estudante',
    matricula: '789012',
    userPhone1: '(62) 98888-2222',
    periodo: '2026-1',
    curso: 'Banco de Dados',
    enrolmentStatus: 'active',
    progressoTotal: '75.2',
  });

  console.log('✅ Alunos mockados no Moodle local!');

  // 4. Criar Agendamento Ativo Inicial
  await db.insert(agendamentosMatricula).values({
    opcaoId: slot3[0].id, // 09:00:00
    matricula: '123456',
    descricao: 'Programação I;Estruturas de Dados',
    status: 'ativo',
    periodo: '2026-1',
    data: hoje,
  });

  console.log('✅ Agendamento inicial semeado com sucesso!');

  // --- SEED DE CREDENCIAIS MOODLE (AVA OPENLMS) ---
  console.log('🌱 Semeando credenciais Moodle na tabela ava_openlms...');
  const openlmsData = [
    {
      unidadeEns: 'UniEVANGÉLICA',
      urlSandbox: 'unievangelica-sandbox.myopenlms.net',
      tokenSandbox: 'JB0lPNK5bHuGZynaGpNL75fUEB7I4YoDZfpot1jL8URXJ6xPlBbi773B90K3Oz7n',
      urlProd: 'avagrad.unievangelica.edu.br',
      tokenProd: 'Jtmko5WBb1PTNSwHjThcYNtrPlhRZ05ijiJNdgP5XgPkzBrYWP1udldtNABm06La',
      status: true,
    },
    {
      unidadeEns: 'EaD',
      urlSandbox: 'avaead-unievangelica-sandbox.myopenlms.net',
      tokenSandbox: '7Wynfa7j3P1seisFkEMkf0fZFkBAcQ5ZmtDIKArDPjwuHf1skDSF4ze9agA2y6Ra',
      urlProd: 'avaead.unievangelica.edu.br',
      tokenProd: '7Wynfa7j3P1seisFkEMkf0fZFkBAcQ5ZmtDIKArDPjwuHf1skDSF4ze9agA2y6Ra',
      status: true,
    },
    {
      unidadeEns: 'Ead_Unievangelica',
      urlSandbox: 'avaead-unievangelica-sandbox.myopenlms.net',
      tokenSandbox: '7Wynfa7j3P1seisFkEMkf0fZFkBAcQ5ZmtDIKArDPjwuHf1skDSF4ze9agA2y6Ra',
      urlProd: 'avaead.unievangelica.edu.br',
      tokenProd: '7Wynfa7j3P1seisFkEMkf0fZFkBAcQ5ZmtDIKArDPjwuHf1skDSF4ze9agA2y6Ra',
      status: true,
    },
    {
      unidadeEns: 'FAEGO',
      urlSandbox: 'faceg-sandbox.myopenlms.net',
      tokenSandbox: 'JhbOfQpjF1W82qPj9ihjyukcglLWaeLjCmyh4dGAUc8MJNxIwTrjERCl3N7TsJ3u',
      urlProd: 'ava.uniego.edu.br',
      tokenProd: 'JhbOfQpjF1W82qPj9ihjyukcglLWaeLjCmyh4dGAUc8MJNxIwTrjERCl3N7TsJ3u',
      status: true,
    },
    {
      unidadeEns: 'RAÍZES',
      urlSandbox: 'raizes-sandbox.myopenlms.net',
      tokenSandbox: '9K1lgXx7sSlzBT9W7atH7xljZ1Tz07Q0HHboeOmMhNCiiC5gdonabPA0GUp6R6xa',
      urlProd: 'ava.faculdaderaizes.edu.br',
      tokenProd: '9K1lgXx7sSlzBT9W7atH7xljZ1Tz07Q0HHboeOmMhNCiiC5gdonabPA0GUp6R6xa',
      status: true,
    },
    {
      unidadeEns: 'RAIZES',
      urlSandbox: 'raizes-sandbox.myopenlms.net',
      tokenSandbox: '9K1lgXx7sSlzBT9W7atH7xljZ1Tz07Q0HHboeOmMhNCiiC5gdonabPA0GUp6R6xa',
      urlProd: 'ava.faculdaderaizes.edu.br',
      tokenProd: '9K1lgXx7sSlzBT9W7atH7xljZ1Tz07Q0HHboeOmMhNCiiC5gdonabPA0GUp6R6xa',
      status: true,
    },
    {
      unidadeEns: 'EEFN',
      urlSandbox: 'colegiosaee-sandbox.myopenlms.net',
      tokenSandbox: '37KzpACjJEKDhHPEEeJCioxtaIeJbASU8eKneMNnRYrzg73kbDn9sasIjMRBNkWM',
      urlProd: 'ava.aee.edu.br',
      tokenProd: '37KzpACjJEKDhHPEEeJCioxtaIeJbASU8eKneMNnRYrzg73kbDn9sasIjMRBNkWM',
      status: true,
    },
  ];

  for (const item of openlmsData) {
    try {
      const existing = await db.select().from(avaOpenlms).where(eq(avaOpenlms.unidadeEns, item.unidadeEns));
      if (existing.length === 0) {
        await db.insert(avaOpenlms).values(item);
        console.log(`[SEED] Inseridas credenciais para a unidade: "${item.unidadeEns}"`);
      }
    } catch (e: any) {
      console.error(`Erro ao semear "${item.unidadeEns}":`, e.message);
    }
  }
  console.log('✅ Credenciais Moodle semeadas com sucesso!');
}

main().then(() => {
  process.exit(0);
}).catch((e) => {
  console.error(e);
  process.exit(1);
});

