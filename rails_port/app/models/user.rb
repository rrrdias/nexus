class User < ApplicationRecord
  self.table_name = "user"

  alias_attribute :active, :isActive
  alias_attribute :email_verified, :emailVerified

  has_many :user_groups, foreign_key: "userId", dependent: :destroy
  has_many :groups, through: :user_groups
  has_many :users_system_accesses, foreign_key: "userId", dependent: :destroy
  has_many :direct_system_modules, through: :users_system_accesses, source: :system_module

  validates :email, presence: true, uniqueness: true

  def password=(raw_password)
    self[:password] = raw_password.present? ? BCrypt::Password.create(raw_password) : self[:password]
  end

  def authenticate(raw_password)
    return false if self[:password].blank?
    BCrypt::Password.new(self[:password]).is_password?(raw_password)
  end

  def super_admin?
    email == "rrrdias25@gmail.com" || groups.exists?(name: "Super Admin")
  end

  def disabled?
    !active
  end

  def accessible_modules
    SystemModule
      .active
      .where(id: direct_system_modules.select(:id))
      .or(SystemModule.active.where(id: SystemModule.joins(:group_system_accesses).where(group_system_accesses: { groupId: groups.select(:id) }).select(:id)))
      .distinct
      .order(:name)
  end

  def can_access_module?(slug)
    return true if super_admin?
    accessible_modules.exists?(slug: slug)
  end
end
