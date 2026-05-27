require "net/http"
require "json"

module AvaReports
  class SyncService
    TASKS = [
      ["ead", "grades", "MOODLE_EAD_GRADES_GET_URL", "MOODLE_EAD_GRADES_ATT_URL"],
      ["ead", "progress", "MOODLE_EAD_PROGRESS_GET_URL", "MOODLE_EAD_PROGRESS_ATT_URL"],
      ["uni", "grades", "MOODLE_UNI_GRADES_GET_URL", "MOODLE_UNI_GRADES_ATT_URL"],
      ["uni", "progress", "MOODLE_UNI_PROGRESS_GET_URL", "MOODLE_UNI_PROGRESS_ATT_URL"],
      ["uniego", "grades", "MOODLE_UNIEGO_GRADES_GET_URL", "MOODLE_UNIEGO_GRADES_ATT_URL"],
      ["uniego", "progress", "MOODLE_UNIEGO_PROGRESS_GET_URL", "MOODLE_UNIEGO_PROGRESS_ATT_URL"],
      ["raizes", "grades", "MOODLE_RAIZES_GRADES_GET_URL", "MOODLE_RAIZES_GRADES_ATT_URL"],
      ["raizes", "progress", "MOODLE_RAIZES_PROGRESS_GET_URL", "MOODLE_RAIZES_PROGRESS_ATT_URL"],
      ["eefn", "grades", "MOODLE_EEFN_GRADES_GET_URL", "MOODLE_EEFN_GRADES_ATT_URL"],
      ["eefn", "progress", "MOODLE_EEFN_PROGRESS_GET_URL", "MOODLE_EEFN_PROGRESS_ATT_URL"],
      ["pos", "grades", "MOODLE_POS_GRADES_GET_URL", "MOODLE_POS_GRADES_ATT_URL"]
    ].freeze

    def self.run(institution: nil, type: nil)
      tasks = TASKS
      tasks = tasks.select { |task| task[0] == institution } if institution.present?
      tasks = tasks.select { |task| task[1] == type } if type.present?
      tasks.map { |name, kind, get_key, att_key| new(name, kind, ENV[get_key], ENV[att_key]).run }
    end

    def initialize(institution, type, get_url, att_url)
      @institution = institution
      @type = type
      @get_url = get_url
      @att_url = att_url
    end

    def run
      return skipped("URL missing") if @get_url.blank?

      payload = fetch_json(@get_url)
      return payload unless payload.is_a?(Array)

      inserted = @type == "grades" ? upsert_grades(payload) : upsert_progress(payload)
      trigger_refresh
      { source: "#{@institution}_#{@type}", status: "success", inserted: inserted, updated: 0 }
    rescue StandardError => e
      { source: "#{@institution}_#{@type}", status: "error", reason: e.message }
    end

    private

    def fetch_json(url)
      uri = URI(url)
      response = Net::HTTP.start(uri.host, uri.port, use_ssl: uri.scheme == "https", open_timeout: 15, read_timeout: 15) do |http|
        http.get(uri.request_uri)
      end
      return skipped("Link indisponivel no Moodle (HTTP #{response.code})") unless response.is_a?(Net::HTTPSuccess)

      body = response.body.to_s.strip
      return skipped("Arquivo de relatorio vazio") if body.blank?
      return skipped("Moodle retornou HTML/Erro") if body.start_with?("<!DOCTYPE", "<html", "<xml")

      JSON.parse(body)
    rescue JSON::ParserError => e
      skipped("JSON invalido retornado pelo Moodle: #{e.message[0, 50]}")
    end

    def skipped(reason)
      { source: "#{@institution}_#{@type}", status: "skipped", reason: reason }
    end

    def upsert_grades(items)
      count = 0
      items.each_slice(1_000) do |chunk|
        rows = chunk.filter_map do |item|
          user_id = item["user_id"].presence || item["aluno_id"]
          course_id = item["course_id"]
          next if user_id.blank? || course_id.blank?

          {
            id: SecureRandom.uuid,
            sourceInstitution: @institution,
            course_id: course_id.to_s,
            course_fullname: item["course_fullname"],
            course_shortname: item["course_shortname"],
            user_id: user_id.to_s,
            user_identification: item["user_identification"],
            user_username: item["user_username"] || item["usuario"],
            student_name: item["student_name"] || item["aluno"],
            user_email: item["user_email"],
            user_phone1: item["user_phone1"],
            user_phone2: item["user_phone2"],
            enrolment_status: item["enrolment_status"],
            curso_perfil: item["curso_perfil"],
            periodo_perfil: item["periodo_perfil"],
            unidade_fisica: item["unidade_fisica"],
            periodo: item["periodo"],
            fase1: item["fase1"].to_s,
            fase2: item["fase2"].to_s,
            fase3: item["fase3"].to_s,
            media: item["media"].to_s,
            custom_course: item["custom_course"],
            lastaccess: item["lastaccess"],
            updatedAt: Time.current
          }
        end
        if rows.any?
          AvaGradesReport.upsert_all(
            rows,
            unique_by: "unq_ava_grades",
            update_only: rows.first.keys - %i[id sourceInstitution user_id course_id]
          )
        end
        count += rows.length
      end
      count
    end

    def upsert_progress(items)
      count = 0
      items.each_slice(1_000) do |chunk|
        rows = chunk.filter_map do |item|
          next if item["matricula"].blank? || item["curso"].blank?

          {
            id: SecureRandom.uuid,
            sourceInstitution: @institution,
            aluno_id: item["aluno_id"].to_s,
            usuario: item["usuario"],
            aluno: item["aluno"],
            matricula: item["matricula"].to_s,
            user_phone1: item["user_phone1"],
            periodo: item["periodo"],
            enrolment_status: item["enrolment_status"],
            lastaccess: item["lastaccess"],
            curso: item["curso"].to_s,
            fase1: item["fase1"].to_s,
            fase2: item["fase2"].to_s,
            fase3: item["fase3"].to_s,
            curso_perfil: item["curso_perfil"],
            periodo_perfil: item["periodo_perfil"],
            unidade_fisica: item["unidade_fisica"],
            progresso_total: (item["progresso_total"] || item["media"]).to_s,
            lista_fase1: item["lista_fase1"],
            lista_fase2: item["lista_fase2"],
            lista_fase3: item["lista_fase3"],
            dias_sem_acesso: item["dias_sem_acesso"].to_s,
            updatedAt: Time.current
          }
        end
        if rows.any?
          AvaProgressReport.upsert_all(
            rows,
            unique_by: "unq_ava_progress",
            update_only: rows.first.keys - %i[id sourceInstitution aluno_id curso]
          )
        end
        count += rows.length
      end
      count
    end

    def trigger_refresh
      return if @att_url.blank?
      Thread.new { Net::HTTP.get(URI(@att_url)) }
    end
  end
end
