class CreateAvaReports < ActiveRecord::Migration[7.1]
  def change
    create_table :ava_progress_report, id: :string, if_not_exists: true do |t|
      t.string :sourceInstitution, null: false
      t.string :aluno_id
      t.string :usuario
      t.string :aluno
      t.string :matricula
      t.string :user_phone1
      t.string :periodo
      t.string :enrolment_status
      t.string :lastaccess
      t.string :curso
      t.string :fase1
      t.string :fase2
      t.string :fase3
      t.string :curso_perfil
      t.string :periodo_perfil
      t.string :unidade_fisica
      t.string :progresso_total
      t.text :lista_fase1
      t.text :lista_fase2
      t.text :lista_fase3
      t.string :dias_sem_acesso
      t.datetime :updatedAt, null: false, default: -> { "CURRENT_TIMESTAMP" }
    end

    add_index :ava_progress_report, %i[sourceInstitution aluno_id curso], unique: true, name: "unq_ava_progress", if_not_exists: true
    add_index :ava_progress_report, %i[sourceInstitution periodo], name: "idx_ava_progress_institution_period", if_not_exists: true
    add_index :ava_progress_report, %i[sourceInstitution periodo curso_perfil periodo_perfil unidade_fisica], name: "idx_ava_progress_profile_filters", if_not_exists: true
    add_index :ava_progress_report, %i[sourceInstitution enrolment_status], name: "idx_ava_progress_status", if_not_exists: true
    add_index :ava_progress_report, :updatedAt, name: "idx_ava_progress_updated_at", if_not_exists: true
    add_index :ava_progress_report, :aluno, using: :gin, opclass: :gin_trgm_ops, name: "idx_ava_progress_aluno_trgm", if_not_exists: true
    add_index :ava_progress_report, :curso, using: :gin, opclass: :gin_trgm_ops, name: "idx_ava_progress_curso_trgm", if_not_exists: true
    add_index :ava_progress_report, :usuario, using: :gin, opclass: :gin_trgm_ops, name: "idx_ava_progress_usuario_trgm", if_not_exists: true
    add_index :ava_progress_report, :matricula, using: :gin, opclass: :gin_trgm_ops, name: "idx_ava_progress_matricula_trgm", if_not_exists: true

    create_table :ava_grades_report, id: :string, if_not_exists: true do |t|
      t.string :sourceInstitution, null: false
      t.string :course_id
      t.string :course_fullname
      t.string :course_shortname
      t.string :user_id
      t.string :user_identification
      t.string :user_username
      t.string :student_name
      t.string :user_email
      t.string :user_phone1
      t.string :user_phone2
      t.string :enrolment_status
      t.string :curso_perfil
      t.string :periodo_perfil
      t.string :unidade_fisica
      t.string :periodo
      t.string :fase1
      t.string :fase2
      t.string :fase3
      t.string :media
      t.string :custom_course
      t.string :lastaccess
      t.datetime :updatedAt, null: false, default: -> { "CURRENT_TIMESTAMP" }
    end

    add_index :ava_grades_report, %i[sourceInstitution user_id course_id], unique: true, name: "unq_ava_grades", if_not_exists: true
    add_index :ava_grades_report, %i[sourceInstitution periodo], name: "idx_ava_grades_institution_period", if_not_exists: true
    add_index :ava_grades_report, %i[sourceInstitution periodo curso_perfil periodo_perfil unidade_fisica], name: "idx_ava_grades_profile_filters", if_not_exists: true
    add_index :ava_grades_report, %i[sourceInstitution enrolment_status], name: "idx_ava_grades_status", if_not_exists: true
    add_index :ava_grades_report, :updatedAt, name: "idx_ava_grades_updated_at", if_not_exists: true
    add_index :ava_grades_report, :student_name, using: :gin, opclass: :gin_trgm_ops, name: "idx_ava_grades_student_trgm", if_not_exists: true
    add_index :ava_grades_report, :course_fullname, using: :gin, opclass: :gin_trgm_ops, name: "idx_ava_grades_course_trgm", if_not_exists: true
    add_index :ava_grades_report, :user_username, using: :gin, opclass: :gin_trgm_ops, name: "idx_ava_grades_username_trgm", if_not_exists: true
    add_index :ava_grades_report, :user_identification, using: :gin, opclass: :gin_trgm_ops, name: "idx_ava_grades_identification_trgm", if_not_exists: true
  end
end
