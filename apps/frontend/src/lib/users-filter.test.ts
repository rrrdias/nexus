import assert from "node:assert/strict"
import { filterAdminUsers } from "./users-filter"

const mockGroups = [
  {
    id: "grp-backoffice",
    name: "Operadores Backoffice",
    modules: [{ id: "mod-backoffice", name: "Backoffice Agendamentos" }],
  },
  {
    id: "grp-tutoria",
    name: "Tutores",
    modules: [{ id: "mod-tutoria", name: "Tutoria" }],
  },
]

const mockUsers = [
  {
    id: "u1",
    name: "João da Silva",
    email: "joao@uni.edu.br",
    userid: "u1001",
    isActive: true,
    groups: [{ id: "grp-backoffice", name: "Operadores Backoffice" }],
    modules: [{ id: "mod-teologia", name: "Tutoria - Teologia" }],
  },
  {
    id: "u2",
    name: "Maria Oliveira",
    email: "maria@uni.edu.br",
    userid: "u1002",
    isActive: true,
    groups: [{ id: "grp-tutoria", name: "Tutores" }],
    modules: [],
  },
  {
    id: "u3",
    name: "Carlos Sem Acesso",
    email: "carlos@uni.edu.br",
    userid: "u1003",
    isActive: false,
    groups: [],
    modules: [],
  },
]

function run() {
  // 1. Pesquisa por nome sem acento, email e matricula
  assert.deepEqual(
    filterAdminUsers(mockUsers, mockGroups, { search: "joao" }).map((u) => u.id),
    ["u1"]
  )
  assert.deepEqual(
    filterAdminUsers(mockUsers, mockGroups, { search: "maria@uni" }).map((u) => u.id),
    ["u2"]
  )
  assert.deepEqual(
    filterAdminUsers(mockUsers, mockGroups, { search: "U1003" }).map((u) => u.id),
    ["u3"]
  )

  // 2. Filtro por modulo direto (avulso) ou herdado por grupo
  assert.deepEqual(
    filterAdminUsers(mockUsers, mockGroups, {
      moduleId: "mod-backoffice",
      linkScope: "all",
    }).map((u) => u.id),
    ["u1"]
  )
  assert.deepEqual(
    filterAdminUsers(mockUsers, mockGroups, {
      moduleId: "mod-backoffice",
      linkScope: "direct",
    }).map((u) => u.id),
    []
  )
  assert.deepEqual(
    filterAdminUsers(mockUsers, mockGroups, {
      moduleId: "mod-teologia",
      linkScope: "direct",
    }).map((u) => u.id),
    ["u1"]
  )
  assert.deepEqual(
    filterAdminUsers(mockUsers, mockGroups, {
      moduleId: "mod-tutoria",
      linkScope: "group",
    }).map((u) => u.id),
    ["u2"]
  )

  // 3. Filtro "Sem modulos vinculados" e status
  assert.deepEqual(
    filterAdminUsers(mockUsers, mockGroups, { moduleId: "none" }).map((u) => u.id),
    ["u3"]
  )
  assert.deepEqual(
    filterAdminUsers(mockUsers, mockGroups, { status: "active" }).map((u) => u.id),
    ["u1", "u2"]
  )
  assert.deepEqual(
    filterAdminUsers(mockUsers, mockGroups, { status: "inactive" }).map((u) => u.id),
    ["u3"]
  )

  console.log("✅ All 10 users-filter tests passed!")
}

run()
