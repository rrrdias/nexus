class GroupSystemAccess < ApplicationRecord
  self.table_name = "group_system_access"
  self.primary_key = nil

  belongs_to :group, foreign_key: "groupId"
  belongs_to :system_module, foreign_key: "systemModuleId"
end
