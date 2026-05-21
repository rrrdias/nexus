import {
  timestamp,
  pgTable,
  text,
  primaryKey,
  boolean,
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
])

export const groupSystemAccess = pgTable("group_system_access", {
  groupId: text("groupId").notNull().references(() => groups.id, { onDelete: "cascade" }),
  systemModuleId: text("systemModuleId").notNull().references(() => systemModules.id, { onDelete: "cascade" }),
}, (t) => [
  primaryKey({ columns: [t.groupId, t.systemModuleId] }),
])

export const auditLogs = pgTable("audit_log", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  action: text("action").notNull(),
  ipAddress: text("ipAddress"),
  userAgent: text("userAgent"),
  timestamp: timestamp("timestamp", { mode: "date" }).defaultNow().notNull(),
})

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
})

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
})
