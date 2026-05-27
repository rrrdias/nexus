class AuditLog < ApplicationRecord
  self.table_name = "audit_log"

  alias_attribute :user_id, :userId
  alias_attribute :ip_address, :ipAddress
  alias_attribute :user_agent, :userAgent

  belongs_to :user, foreign_key: "userId"
end
