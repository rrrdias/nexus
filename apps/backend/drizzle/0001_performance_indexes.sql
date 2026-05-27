CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "idx_users_system_access_module"
  ON "users_system_access" ("systemModuleId");

CREATE INDEX IF NOT EXISTS "idx_user_group_group"
  ON "user_group" ("groupId");

CREATE INDEX IF NOT EXISTS "idx_group_system_access_module"
  ON "group_system_access" ("systemModuleId");

CREATE INDEX IF NOT EXISTS "idx_audit_log_user_timestamp"
  ON "audit_log" ("userId", "timestamp");

CREATE INDEX IF NOT EXISTS "idx_ava_progress_institution_period"
  ON "ava_progress_report" ("sourceInstitution", "periodo");

CREATE INDEX IF NOT EXISTS "idx_ava_progress_profile_filters"
  ON "ava_progress_report" ("sourceInstitution", "periodo", "curso_perfil", "periodo_perfil", "unidade_fisica");

CREATE INDEX IF NOT EXISTS "idx_ava_progress_status"
  ON "ava_progress_report" ("sourceInstitution", "enrolment_status");

CREATE INDEX IF NOT EXISTS "idx_ava_progress_updated_at"
  ON "ava_progress_report" ("updatedAt");

CREATE INDEX IF NOT EXISTS "idx_ava_progress_aluno_trgm"
  ON "ava_progress_report" USING gin ("aluno" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "idx_ava_progress_curso_trgm"
  ON "ava_progress_report" USING gin ("curso" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "idx_ava_progress_usuario_trgm"
  ON "ava_progress_report" USING gin ("usuario" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "idx_ava_progress_matricula_trgm"
  ON "ava_progress_report" USING gin ("matricula" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "idx_ava_grades_institution_period"
  ON "ava_grades_report" ("sourceInstitution", "periodo");

CREATE INDEX IF NOT EXISTS "idx_ava_grades_profile_filters"
  ON "ava_grades_report" ("sourceInstitution", "periodo", "curso_perfil", "periodo_perfil", "unidade_fisica");

CREATE INDEX IF NOT EXISTS "idx_ava_grades_status"
  ON "ava_grades_report" ("sourceInstitution", "enrolment_status");

CREATE INDEX IF NOT EXISTS "idx_ava_grades_updated_at"
  ON "ava_grades_report" ("updatedAt");

CREATE INDEX IF NOT EXISTS "idx_ava_grades_student_trgm"
  ON "ava_grades_report" USING gin ("student_name" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "idx_ava_grades_course_trgm"
  ON "ava_grades_report" USING gin ("course_fullname" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "idx_ava_grades_username_trgm"
  ON "ava_grades_report" USING gin ("user_username" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "idx_ava_grades_identification_trgm"
  ON "ava_grades_report" USING gin ("user_identification" gin_trgm_ops);
