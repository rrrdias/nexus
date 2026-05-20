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
