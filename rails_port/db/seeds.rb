ava = SystemModule.find_or_create_by!(slug: "ava") do |mod|
  mod.id = SecureRandom.uuid
  mod.name = "AVA"
  mod.description = "Relatorios academicos do Moodle"
  mod.color_code = "#27AE60"
  mod.icon_class = "ti-school"
  mod.path_url = "/reports/progress/ead"
  mod.active = true
end

backoffice = SystemModule.find_or_create_by!(slug: "backoffice") do |mod|
  mod.id = SecureRandom.uuid
  mod.name = "Backoffice"
  mod.description = "Administracao do Nexus"
  mod.color_code = "#1976D2"
  mod.icon_class = "ti-settings"
  mod.path_url = "/admin/users"
  mod.active = true
end

super_admin = Group.find_or_create_by!(name: "Super Admin") do |group|
  group.id = SecureRandom.uuid
  group.description = "Acesso administrativo total"
end

admin = User.find_or_initialize_by(email: ENV.fetch("ADMIN_EMAIL", "rrrdias25@gmail.com"))
admin.id ||= SecureRandom.uuid
admin.name ||= "Administrador"
admin.userid ||= "admin"
admin.active = true
admin.password = ENV.fetch("ADMIN_PASSWORD", "admin123")
admin.save!

UserGroup.find_or_create_by!(user: admin, group: super_admin)
GroupSystemAccess.find_or_create_by!(group: super_admin, system_module: ava)
GroupSystemAccess.find_or_create_by!(group: super_admin, system_module: backoffice)
UsersSystemAccess.find_or_create_by!(user: admin, system_module: ava)
UsersSystemAccess.find_or_create_by!(user: admin, system_module: backoffice)
