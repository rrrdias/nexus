class AvaGradesReport < ApplicationRecord
  self.table_name = "ava_grades_report"

  alias_attribute :source_institution, :sourceInstitution
  alias_attribute :course_id, :course_id
  alias_attribute :course_fullname, :course_fullname
  alias_attribute :course_shortname, :course_shortname
  alias_attribute :user_id, :user_id
  alias_attribute :user_identification, :user_identification
  alias_attribute :user_username, :user_username
  alias_attribute :student_name, :student_name
  alias_attribute :user_email, :user_email
  alias_attribute :user_phone1, :user_phone1
  alias_attribute :user_phone2, :user_phone2
  alias_attribute :enrolment_status, :enrolment_status
  alias_attribute :curso_perfil, :curso_perfil
  alias_attribute :periodo_perfil, :periodo_perfil
  alias_attribute :unidade_fisica, :unidade_fisica
  alias_attribute :custom_course, :custom_course
  alias_attribute :updated_at, :updatedAt
end
