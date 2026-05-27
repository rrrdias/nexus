class AvaProgressReport < ApplicationRecord
  self.table_name = "ava_progress_report"

  alias_attribute :source_institution, :sourceInstitution
  alias_attribute :aluno_id, :aluno_id
  alias_attribute :user_phone1, :user_phone1
  alias_attribute :enrolment_status, :enrolment_status
  alias_attribute :curso_perfil, :curso_perfil
  alias_attribute :periodo_perfil, :periodo_perfil
  alias_attribute :unidade_fisica, :unidade_fisica
  alias_attribute :progresso_total, :progresso_total
  alias_attribute :dias_sem_acesso, :dias_sem_acesso
  alias_attribute :updated_at, :updatedAt
end
