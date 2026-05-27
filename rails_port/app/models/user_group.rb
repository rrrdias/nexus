class UserGroup < ApplicationRecord
  self.table_name = "user_group"
  self.primary_key = nil

  belongs_to :user, foreign_key: "userId"
  belongs_to :group, foreign_key: "groupId"
end
