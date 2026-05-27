class CreateCoreSchema < ActiveRecord::Migration[7.1]
  def change
    enable_extension "pgcrypto" unless extension_enabled?("pgcrypto")
    enable_extension "pg_trgm" unless extension_enabled?("pg_trgm")

    create_table :user, id: :string, if_not_exists: true do |t|
      t.string :name
      t.string :email, null: false
      t.datetime :emailVerified
      t.string :image
      t.string :password
      t.boolean :isActive, default: true
      t.string :userid
    end
    add_index :user, :email, unique: true, if_not_exists: true
    add_index :user, :userid, unique: true, if_not_exists: true

    create_table :system_module, id: :string, if_not_exists: true do |t|
      t.string :name, null: false
      t.string :slug, null: false
      t.text :description
      t.string :colorCode, null: false, default: "#27AE60"
      t.string :iconClass, null: false, default: "ti-apps"
      t.string :pathUrl, null: false
      t.boolean :isActive, null: false, default: true
      t.datetime :createdAt, null: false, default: -> { "CURRENT_TIMESTAMP" }
    end
    add_index :system_module, :name, unique: true, if_not_exists: true
    add_index :system_module, :slug, unique: true, if_not_exists: true

    create_table :group, id: :string, if_not_exists: true do |t|
      t.string :name, null: false
      t.text :description
    end
    add_index :group, :name, unique: true, if_not_exists: true

    create_table :users_system_access, id: false, if_not_exists: true do |t|
      t.string :userId, null: false
      t.string :systemModuleId, null: false
      t.datetime :grantedAt, null: false, default: -> { "CURRENT_TIMESTAMP" }
    end
    add_index :users_system_access, %i[userId systemModuleId], unique: true, name: "pk_users_system_access", if_not_exists: true
    add_index :users_system_access, :systemModuleId, name: "idx_users_system_access_module", if_not_exists: true

    create_table :user_group, id: false, if_not_exists: true do |t|
      t.string :userId, null: false
      t.string :groupId, null: false
    end
    add_index :user_group, %i[userId groupId], unique: true, name: "pk_user_group", if_not_exists: true
    add_index :user_group, :groupId, name: "idx_user_group_group", if_not_exists: true

    create_table :group_system_access, id: false, if_not_exists: true do |t|
      t.string :groupId, null: false
      t.string :systemModuleId, null: false
    end
    add_index :group_system_access, %i[groupId systemModuleId], unique: true, name: "pk_group_system_access", if_not_exists: true
    add_index :group_system_access, :systemModuleId, name: "idx_group_system_access_module", if_not_exists: true

    create_table :audit_log, id: :string, if_not_exists: true do |t|
      t.string :userId, null: false
      t.string :action, null: false
      t.string :ipAddress
      t.string :userAgent
      t.datetime :timestamp, null: false, default: -> { "CURRENT_TIMESTAMP" }
    end
    add_index :audit_log, %i[userId timestamp], name: "idx_audit_log_user_timestamp", if_not_exists: true
  end
end
