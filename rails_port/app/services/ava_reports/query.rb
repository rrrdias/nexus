module AvaReports
  class Query
    TERMS_WITHOUT_ACCESS = ["nunca acessou", "sem acesso", "", "none", "nulo", "-"].freeze
    PHASES = {
      fase1: [Date.new(2026, 2, 13), Date.new(2026, 3, 29)],
      fase2: [Date.new(2026, 3, 30), Date.new(2026, 5, 11)],
      fase3: [Date.new(2026, 5, 12), Date.new(2026, 6, 19)]
    }.freeze

    def self.progress(page:, size:, filters:)
      new(AvaProgressReport, filters).progress(page: page, size: size)
    end

    def self.progress_export(filters:)
      new(AvaProgressReport, filters).progress_export
    end

    def self.grades(page:, size:, filters:)
      new(AvaGradesReport, filters).grades(page: page, size: size)
    end

    def self.grades_export(filters:)
      new(AvaGradesReport, filters).grades_export
    end

    def initialize(model, filters)
      @model = model
      @filters = filters.to_h.with_indifferent_access
    end

    def progress(page:, size:)
      rows = filtered_progress_rows
      total = rows.length
      page_rows = rows.slice(offset(page, size), size) || []

      {
        page: page,
        size: size,
        total_records: total,
        total_pages: total.zero? ? 0 : (total.to_f / size).ceil,
        data: hydrate_progress(page_rows),
      }.merge(progress_metrics(rows))
    end

    def progress_export
      hydrate_progress(filtered_progress_rows)
    end

    def grades(page:, size:)
      rows = filtered_grade_rows
      total = rows.length
      page_rows = rows.slice(offset(page, size), size) || []

      {
        page: page,
        size: size,
        total_records: total,
        total_pages: total.zero? ? 0 : (total.to_f / size).ceil,
        data: hydrate_grades(page_rows),
      }.merge(grade_metrics(rows))
    end

    def grades_export
      hydrate_grades(filtered_grade_rows)
    end

    private

    attr_reader :model, :filters

    def relation
      scope = model.all
      scope = scope.where('"sourceInstitution" = ?', filters[:sourceInstitution]) if filters[:sourceInstitution].present?

      if model == AvaProgressReport
        scope = like(scope, :aluno, filters[:aluno])
        scope = like(scope, :curso, filters[:curso])
        scope = like(scope, :usuario, filters[:usuario])
        scope = like(scope, :matricula, filters[:matricula])
      else
        scope = like(scope, :student_name, filters[:aluno])
        scope = like(scope, :course_fullname, filters[:curso])
        scope = like(scope, :user_username, filters[:usuario])
        scope = like(scope, :user_identification, filters[:matricula])
      end

      period = filters.key?(:periodo) ? filters[:periodo] : "2026-1"
      scope = like(scope, :periodo, period) if period.present?
      scope = like(scope, :curso_perfil, filters[:curso_perfil])
      scope = like(scope, :periodo_perfil, filters[:periodo_perfil])
      scope = like(scope, :unidade_fisica, filters[:unidade_fisica])
      scope = like(scope, :enrolment_status, filters[:enrolment_status])

      access = filters[:lastaccess]
      scope = like(scope, :lastaccess, access) if access.present? && !%w[sem_acesso com_acesso].include?(access)
      scope
    end

    def filtered_progress_rows
      rows = relation
        .select(:id, :aluno_id, :matricula, :lastaccess, :curso, :fase1, :fase2, :fase3, :progresso_total)
        .order(:aluno, :curso, :id)
        .map { |row| decorate_access(row) }
      apply_access_filters(rows)
    end

    def filtered_grade_rows
      rows = relation
        .select(:id, :lastaccess, :fase1, :fase2, :fase3, :media, :user_identification, :student_name)
        .order(:student_name, :course_fullname, :id)
        .map { |row| decorate_access(row) }
      apply_access_filters(rows)
    end

    def hydrate_progress(rows)
      ids = rows.map(&:id)
      days_by_id = rows.index_by(&:id).transform_values { |row| row.dias_sem_acesso_calc }
      AvaProgressReport.where(id: ids).index_by(&:id).values_at(*ids).compact.map do |row|
        serialize_progress(row).merge("diasSemAcesso" => days_by_id[row.id] || row.dias_sem_acesso)
      end
    end

    def hydrate_grades(rows)
      ids = rows.map(&:id)
      days_by_id = rows.index_by(&:id).transform_values { |row| row.dias_sem_acesso_calc }
      AvaGradesReport.where(id: ids).index_by(&:id).values_at(*ids).compact.map do |row|
        serialize_grade(row).merge("diasSemAcesso" => days_by_id[row.id] || "-")
      end
    end

    def progress_metrics(rows)
      today = Date.current
      total = rows.length
      avg_total = average(rows.map { |r| parse_number(r.progresso_total) })
      below = rows.count { |row| below_expected_progress?(row, today) }
      discipline_map = rows.group_by(&:curso).reject { |name, _| name.blank? }
      global_threshold = today <= PHASES[:fase1][1] ? 33 : (today <= PHASES[:fase2][1] ? 66 : 100)
      critical = discipline_map.count { |_course, items| average(items.map { |r| parse_number(r.progresso_total) }) < global_threshold }
      no_access = rows.select { |row| without_access?(row.lastaccess) }

      students = rows.each_with_object({}) do |row, memo|
        key = row.aluno_id.presence || row.matricula
        next if key.blank?
        memo[key] ||= false
        memo[key] ||= !without_access?(row.lastaccess)
      end

      phase_metrics = PHASES.transform_values { |range| phase_metrics(rows, range, today) }

      {
        average_progress: avg_total.round,
        below_expected: below,
        average_below_expected: percent(below, total).round,
        total_disciplines: discipline_map.length,
        critical_disciplines: critical,
        average_fase1: average(rows.map { |r| parse_number(r.fase1) }).round,
        status_fase1: phase_status(average(rows.map { |r| parse_number(r.fase1) }), *PHASES[:fase1]),
        f1_below: phase_metrics[:fase1][:below],
        f1_crit: phase_metrics[:fase1][:crit],
        average_fase2: today >= PHASES[:fase2][0] ? average(rows.map { |r| parse_number(r.fase2) }).round : 0,
        status_fase2: today >= PHASES[:fase2][0] ? phase_status(average(rows.map { |r| parse_number(r.fase2) }), *PHASES[:fase2]) : "neutral",
        f2_below: phase_metrics[:fase2][:below],
        f2_crit: phase_metrics[:fase2][:crit],
        average_fase3: today >= PHASES[:fase3][0] ? average(rows.map { |r| parse_number(r.fase3) }).round : 0,
        status_fase3: today >= PHASES[:fase3][0] ? phase_status(average(rows.map { |r| parse_number(r.fase3) }), *PHASES[:fase3]) : "neutral",
        f3_below: phase_metrics[:fase3][:below],
        f3_crit: phase_metrics[:fase3][:crit],
        count_mat_sem_acesso: no_access.length,
        percent_mat_sem_acesso: percent(no_access.length, total),
        count_alunos_sem_acesso: students.values.count(false),
        percent_alunos_sem_acesso: percent(students.values.count(false), students.length),
        total_alunos_unicos: students.length,
        matriculas_em_dia: rows.count { |row| !below_expected_progress?(row, today) },
        percent_matriculas_em_dia: percent(rows.count { |row| !below_expected_progress?(row, today) }, total).round
      }
    end

    def grade_metrics(rows)
      total = rows.length
      below = rows.count { |row| (parse_number(row.media) || 0) < 60 && parse_number(row.media).present? }
      no_access = rows.select { |row| row.dias_sem_acesso_calc == "-" }
      students = rows.map { |row| row.user_identification.presence || row.student_name }.compact.uniq
      no_access_students = no_access.map { |row| row.user_identification.presence || row.student_name }.compact.uniq

      {
        average_media: average(rows.map { |r| parse_number(r.media) }).round(1),
        below_expected: below,
        average_below_expected: percent(below, total).round,
        average_fase1: average(rows.map { |r| parse_number(r.fase1) }).round(1),
        average_fase2: average(rows.map { |r| parse_number(r.fase2) }).round(1),
        average_fase3: average(rows.map { |r| parse_number(r.fase3) }).round(1),
        count_mat_sem_acesso: no_access.length,
        percent_mat_sem_acesso: percent(no_access.length, total),
        count_alunos_sem_acesso: no_access_students.length,
        percent_alunos_sem_acesso: percent(no_access_students.length, students.length),
        total_alunos_unicos: students.length
      }
    end

    def like(scope, column, value)
      return scope if value.blank?
      scope.where("#{column} ILIKE ?", "%#{ActiveRecord::Base.sanitize_sql_like(value.to_s)}%")
    end

    def serialize_progress(row)
      row.as_json.merge(
        "sourceInstitution" => row.sourceInstitution,
        "alunoId" => row.aluno_id,
        "userPhone1" => row.user_phone1,
        "enrolmentStatus" => row.enrolment_status,
        "cursoPerfil" => row.curso_perfil,
        "periodoPerfil" => row.periodo_perfil,
        "unidadeFisica" => row.unidade_fisica,
        "progressoTotal" => row.progresso_total,
        "listaFase1" => row.lista_fase1,
        "listaFase2" => row.lista_fase2,
        "listaFase3" => row.lista_fase3
      )
    end

    def serialize_grade(row)
      row.as_json.merge(
        "sourceInstitution" => row.sourceInstitution,
        "courseId" => row.course_id,
        "courseFullname" => row.course_fullname,
        "courseShortname" => row.course_shortname,
        "userId" => row.user_id,
        "userIdentification" => row.user_identification,
        "userUsername" => row.user_username,
        "studentName" => row.student_name,
        "userEmail" => row.user_email,
        "userPhone1" => row.user_phone1,
        "userPhone2" => row.user_phone2,
        "enrolmentStatus" => row.enrolment_status,
        "cursoPerfil" => row.curso_perfil,
        "periodoPerfil" => row.periodo_perfil,
        "unidadeFisica" => row.unidade_fisica,
        "customCourse" => row.custom_course
      )
    end

    def decorate_access(row)
      row.define_singleton_method(:dias_sem_acesso_calc) { @dias_sem_acesso_calc }
      row.instance_variable_set(:@dias_sem_acesso_calc, days_without_access(row.lastaccess))
      row
    end

    def apply_access_filters(rows)
      access = filters[:lastaccess]
      rows = rows.select { |row| without_access?(row.lastaccess) } if access == "sem_acesso"
      rows = rows.reject { |row| without_access?(row.lastaccess) } if access == "com_acesso"
      inactivity = filters[:dias_sem_acesso]
      return rows if inactivity.blank?

      if inactivity.include?("-")
        min, max = inactivity.split("-").map(&:to_i)
        rows.select { |row| row.dias_sem_acesso_calc.to_i.between?(min, max) && row.dias_sem_acesso_calc != "-" }
      else
        min = inactivity[/\d+/].to_i
        rows.select { |row| row.dias_sem_acesso_calc.to_i >= min && row.dias_sem_acesso_calc != "-" }
      end
    end

    def days_without_access(value)
      return "-" if without_access?(value)
      day, month, year = value.to_s.split("/").map(&:to_i)
      return "-" if day.zero? || month.zero? || year.zero?
      [(Date.current - Date.new(year, month, day)).to_i, 0].max.to_s
    rescue ArgumentError
      "-"
    end

    def without_access?(value)
      TERMS_WITHOUT_ACCESS.include?(value.to_s.strip.downcase)
    end

    def parse_number(value)
      return nil if value.blank? || value == "-"
      Float(value.to_s.delete("%").tr(",", "."))
    rescue ArgumentError
      nil
    end

    def average(values)
      numbers = values.compact
      return 0 if numbers.empty?
      numbers.sum / numbers.length
    end

    def percent(value, total)
      return 0 if total.to_i.zero?
      value.to_f / total * 100
    end

    def offset(page, size)
      ([page.to_i, 1].max - 1) * size.to_i
    end

    def phase_status(avg, start_date, end_date)
      today = Date.current
      return "neutral" if today < start_date
      return "success" if avg >= 100
      return "danger" if today > end_date || avg < 40
      "warning"
    end

    def below_expected_progress?(row, today)
      PHASES.any? do |phase, (start_date, end_date)|
        value = parse_number(row.public_send(phase)) || 0
        today >= start_date && value < (today > end_date ? 100 : 40)
      end
    end

    def phase_metrics(rows, range, today)
      start_date, end_date = range
      return { below: 0, crit: 0 } if today < start_date
      threshold = today > end_date ? 100 : 40
      phase = PHASES.key(range)
      below = rows.count { |row| (parse_number(row.public_send(phase)) || 0) < threshold }
      crit = rows.group_by(&:curso).reject { |name, _| name.blank? }.count do |_course, items|
        average(items.map { |r| parse_number(r.public_send(phase)) }) < threshold
      end
      { below: below, crit: crit }
    end
  end
end
