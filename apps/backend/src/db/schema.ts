import {
  timestamp,
  pgTable,
  text,
  primaryKey,
  boolean,
  unique,
  index,
  integer
} from "drizzle-orm/pg-core"

export const users = pgTable("user", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").unique().notNull(),
  emailVerified: timestamp("emailVerified", { mode: "date" }),
  image: text("image"),
  password: text("password"),
  isActive: boolean("isActive").default(true),
  userid: text("userid").unique(), // Ex: u2501234
})

export const systemModules = pgTable("system_module", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").unique().notNull(),
  slug: text("slug").unique().notNull(),
  description: text("description"),
  colorCode: text("colorCode").default("#27AE60").notNull(),
  iconClass: text("iconClass").default("ti-apps").notNull(),
  pathUrl: text("pathUrl").notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
})

export const usersSystemAccess = pgTable("users_system_access", {
  userId: text("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  systemModuleId: text("systemModuleId").notNull().references(() => systemModules.id, { onDelete: "cascade" }),
  grantedAt: timestamp("grantedAt", { mode: "date" }).defaultNow().notNull(),
}, (t) => [
  primaryKey({ columns: [t.userId, t.systemModuleId] }),
  index("idx_users_system_access_module").on(t.systemModuleId),
])

export const groups = pgTable("group", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").unique().notNull(),
  description: text("description"),
})

export const userGroups = pgTable("user_group", {
  userId: text("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  groupId: text("groupId").notNull().references(() => groups.id, { onDelete: "cascade" }),
}, (t) => [
  primaryKey({ columns: [t.userId, t.groupId] }),
  index("idx_user_group_group").on(t.groupId),
])

export const groupSystemAccess = pgTable("group_system_access", {
  groupId: text("groupId").notNull().references(() => groups.id, { onDelete: "cascade" }),
  systemModuleId: text("systemModuleId").notNull().references(() => systemModules.id, { onDelete: "cascade" }),
}, (t) => [
  primaryKey({ columns: [t.groupId, t.systemModuleId] }),
  index("idx_group_system_access_module").on(t.systemModuleId),
])

export const auditLogs = pgTable("audit_log", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  action: text("action").notNull(),
  ipAddress: text("ipAddress"),
  userAgent: text("userAgent"),
  timestamp: timestamp("timestamp", { mode: "date" }).defaultNow().notNull(),
}, (t) => [
  index("idx_audit_log_user_timestamp").on(t.userId, t.timestamp),
])

// ==========================================
// Módulo: AVA Reports (Sincronização do Moodle)
// ==========================================

export const avaProgressReport = pgTable("ava_progress_report", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  sourceInstitution: text("sourceInstitution").notNull(), // Ex: 'ead', 'uni', 'faceg'
  
  // Dados brutos vindos do json
  alunoId: text("aluno_id"),
  usuario: text("usuario"),
  aluno: text("aluno"),
  matricula: text("matricula"),
  userPhone1: text("user_phone1"),
  periodo: text("periodo"),
  enrolmentStatus: text("enrolment_status"),
  lastaccess: text("lastaccess"),
  curso: text("curso"),
  fase1: text("fase1"),
  fase2: text("fase2"),
  fase3: text("fase3"),
  cursoPerfil: text("curso_perfil"),
  periodoPerfil: text("periodo_perfil"),
  unidadeFisica: text("unidade_fisica"),
  progressoTotal: text("progresso_total"),
  listaFase1: text("lista_fase1"),
  listaFase2: text("lista_fase2"),
  listaFase3: text("lista_fase3"),
  diasSemAcesso: text("dias_sem_acesso"),

  updatedAt: timestamp("updatedAt", { mode: "date" }).defaultNow().notNull(),
}, (t) => [
  unique("unq_ava_progress").on(t.sourceInstitution, t.alunoId, t.curso),
  index("idx_ava_progress_institution_period").on(t.sourceInstitution, t.periodo),
  index("idx_ava_progress_profile_filters").on(t.sourceInstitution, t.periodo, t.cursoPerfil, t.periodoPerfil, t.unidadeFisica),
  index("idx_ava_progress_status").on(t.sourceInstitution, t.enrolmentStatus),
  index("idx_ava_progress_updated_at").on(t.updatedAt),
  index("idx_ava_progress_aluno_trgm").using("gin", t.aluno.op("gin_trgm_ops")),
  index("idx_ava_progress_curso_trgm").using("gin", t.curso.op("gin_trgm_ops")),
  index("idx_ava_progress_usuario_trgm").using("gin", t.usuario.op("gin_trgm_ops")),
  index("idx_ava_progress_matricula_trgm").using("gin", t.matricula.op("gin_trgm_ops")),
])

export const avaGradesReport = pgTable("ava_grades_report", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  sourceInstitution: text("sourceInstitution").notNull(), // Ex: 'ead', 'uni', 'faceg'

  // Dados brutos vindos do json
  courseId: text("course_id"),
  courseFullname: text("course_fullname"),
  courseShortname: text("course_shortname"),
  userId: text("user_id"),
  userIdentification: text("user_identification"),
  userUsername: text("user_username"),
  studentName: text("student_name"),
  userEmail: text("user_email"),
  userPhone1: text("user_phone1"),
  userPhone2: text("user_phone2"),
  enrolmentStatus: text("enrolment_status"),
  cursoPerfil: text("curso_perfil"),
  periodoPerfil: text("periodo_perfil"),
  unidadeFisica: text("unidade_fisica"),
  periodo: text("periodo"),
  fase1: text("fase1"),
  fase2: text("fase2"),
  fase3: text("fase3"),
  media: text("media"),
  customCourse: text("custom_course"),
  lastaccess: text("lastaccess"),

  updatedAt: timestamp("updatedAt", { mode: "date" }).defaultNow().notNull(),
}, (t) => [
  unique("unq_ava_grades").on(t.sourceInstitution, t.userId, t.courseId),
  index("idx_ava_grades_institution_period").on(t.sourceInstitution, t.periodo),
  index("idx_ava_grades_profile_filters").on(t.sourceInstitution, t.periodo, t.cursoPerfil, t.periodoPerfil, t.unidadeFisica),
  index("idx_ava_grades_status").on(t.sourceInstitution, t.enrolmentStatus),
  index("idx_ava_grades_updated_at").on(t.updatedAt),
  index("idx_ava_grades_student_trgm").using("gin", t.studentName.op("gin_trgm_ops")),
  index("idx_ava_grades_course_trgm").using("gin", t.courseFullname.op("gin_trgm_ops")),
  index("idx_ava_grades_username_trgm").using("gin", t.userUsername.op("gin_trgm_ops")),
  index("idx_ava_grades_identification_trgm").using("gin", t.userIdentification.op("gin_trgm_ops")),
])

// ==========================================
// Módulo: Scheduling (Agendamento de Provas)
// ==========================================

export const locals = pgTable("local", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  nome: text("nome").notNull(),
  endereco: text("endereco").notNull(),
  linkLocal: text("link_local"),
  telefone: text("telefone"),
  status: boolean("status").default(true).notNull(),
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { mode: "date" }).defaultNow().notNull(),
})

export const opcaos = pgTable("opcao", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  localId: text("localId").notNull().references(() => locals.id, { onDelete: "cascade" }),
  data: timestamp("data", { mode: "date" }).notNull(),
  hora: text("hora").notNull(),
  vagas: integer("vagas").notNull(),
  status: boolean("status").default(true).notNull(),
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { mode: "date" }).defaultNow().notNull(),
}, (t) => [
  index("idx_opcao_local").on(t.localId),
  index("idx_opcao_data").on(t.data),
])

export const agendamentosMatricula = pgTable("agendamentos_matricula", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  opcaoId: text("opcaoId").notNull().references(() => opcaos.id, { onDelete: "cascade" }),
  matricula: text("matricula").notNull(),
  descricao: text("descricao").notNull(),
  status: text("status").default("ativo").notNull(),
  periodo: text("periodo").notNull(),
  data: timestamp("data", { mode: "date" }).notNull(),
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { mode: "date" }).defaultNow().notNull(),
  deletedAt: timestamp("deletedAt", { mode: "date" }),
}, (t) => [
  unique("unq_agendamento_matricula_periodo").on(t.matricula, t.periodo),
  index("idx_agendamento_opcao").on(t.opcaoId),
  index("idx_agendamento_matricula").on(t.matricula),
])

// ==========================================
// Módulo: Nexus AVA Integration Tracker
// ==========================================

export const syncedTurmas = pgTable("synced_turma", {
  unidadeEns: text("unidadeEns").notNull(),
  turmaId: text("turmaId").notNull(),
}, (t) => [
  primaryKey({ columns: [t.unidadeEns, t.turmaId] }),
  index("idx_synced_turmas_id").on(t.turmaId),
])

export const syncedUsuarios = pgTable("synced_usuario", {
  unidadeEns: text("unidadeEns").notNull(),
  username: text("username").notNull(),
}, (t) => [
  primaryKey({ columns: [t.unidadeEns, t.username] }),
])

export const syncedMatriculas = pgTable("synced_matricula", {
  unidadeEns: text("unidadeEns").notNull(),
  turma: text("turma").notNull(),
  username: text("username").notNull(),
  nivel: integer("nivel").notNull(), // 1=Professor / 2=Aluno
}, (t) => [
  primaryKey({ columns: [t.unidadeEns, t.turma, t.username, t.nivel] }),
  index("idx_synced_mat_lookup").on(t.turma, t.username),
])

export const integrationJobs = pgTable("integration_job", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  profile: text("profile").notNull(), // ex: tabula.yaml
  unidade: text("unidade").notNull(),
  periodo: text("periodo").notNull(),
  status: text("status").notNull(), // 'running', 'success', 'failed'
  logs: text("logs"),
  startedAt: timestamp("startedAt").defaultNow().notNull(),
  finishedAt: timestamp("finishedAt"),
})

export const avaOpenlms = pgTable("ava_openlms", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  unidadeEns: text("unidadeEns").unique().notNull(),
  urlSandbox: text("urlSandbox").notNull(),
  tokenSandbox: text("tokenSandbox").notNull(),
  urlProd: text("urlProd").notNull(),
  tokenProd: text("tokenProd").notNull(),
  status: boolean("status").default(true).notNull(),
})



