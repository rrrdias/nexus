class SystemModule < ApplicationRecord
  self.table_name = "system_module"

  alias_attribute :color_code, :colorCode
  alias_attribute :icon_class, :iconClass
  alias_attribute :path_url, :pathUrl
  alias_attribute :active, :isActive
  alias_attribute :created_at, :createdAt

  has_many :users_system_accesses, foreign_key: "systemModuleId", dependent: :destroy
  has_many :users, through: :users_system_accesses
  has_many :group_system_accesses, foreign_key: "systemModuleId", dependent: :destroy
  has_many :groups, through: :group_system_accesses

  scope :active, -> { where(isActive: true) }

  validates :name, :slug, :pathUrl, presence: true
  validates :name, :slug, uniqueness: true
end
