class UsersSystemAccess < ApplicationRecord
  self.table_name = "users_system_access"
  self.primary_key = nil

  alias_attribute :granted_at, :grantedAt

  belongs_to :user, foreign_key: "userId"
  belongs_to :system_module, foreign_key: "systemModuleId"
end
