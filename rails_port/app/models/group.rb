class Group < ApplicationRecord
  self.table_name = "group"

  has_many :user_groups, foreign_key: "groupId", dependent: :destroy
  has_many :users, through: :user_groups
  has_many :group_system_accesses, foreign_key: "groupId", dependent: :destroy
  has_many :system_modules, through: :group_system_accesses

  validates :name, presence: true, uniqueness: true
end
