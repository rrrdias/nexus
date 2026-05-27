class ApplicationRecord < ActiveRecord::Base
  primary_abstract_class

  before_create :assign_uuid

  private

  def assign_uuid
    self.id ||= SecureRandom.uuid if has_attribute?(:id)
  end
end
