require "csv"

class AvaReportsController < ApplicationController
  before_action :require_ava_access

  INSTITUTION_TITLES = {
    "ead" => "Graduacao EaD",
    "uni" => "UNI",
    "uniego" => "UNIEGO",
    "raizes" => "Raizes",
    "eefn" => "EEFN",
    "pos" => "POS"
  }.freeze

  def progress
    @institution = params[:institution]
    @title = "Progresso dos Alunos - #{INSTITUTION_TITLES.fetch(@institution, @institution.upcase)}"
    @metrics = AvaReports::Query.progress(page: page, size: size, filters: report_filters)
    render :progress
  end

  def grades
    @institution = params[:institution]
    @title = "Notas dos Alunos - #{INSTITUTION_TITLES.fetch(@institution, @institution.upcase)}"
    @metrics = AvaReports::Query.grades(page: page, size: size, filters: report_filters)
    render :grades
  end

  def progress_export
    rows = AvaReports::Query.progress_export(filters: report_filters)
    send_data csv_for(rows, progress_headers), filename: "progresso_#{params[:institution]}.csv", type: "text/csv"
  end

  def grades_export
    rows = AvaReports::Query.grades_export(filters: report_filters)
    send_data csv_for(rows, grades_headers), filename: "notas_#{params[:institution]}.csv", type: "text/csv"
  end

  def sync
    results = AvaReports::SyncService.run(institution: params[:institution], type: params[:type])
    redirect_back fallback_location: reports_path, notice: "Sincronizacao concluida: #{results.map { |r| r[:status] }.join(", ")}"
  end

  private

  def require_ava_access
    redirect_to root_path, alert: "Acesso negado." unless current_user.can_access_module?("ava")
  end

  def page
    [params[:page].to_i, 1].max
  end

  def size
    (params[:size].presence || 30).to_i
  end

  def report_filters
    params.permit(
      :sourceInstitution, :aluno, :curso, :usuario, :matricula, :periodo,
      :curso_perfil, :periodo_perfil, :unidade_fisica, :enrolment_status,
      :lastaccess, :dias_sem_acesso
    ).to_h.merge(sourceInstitution: params[:institution])
  end

  def csv_for(rows, headers)
    CSV.generate(headers: true) do |csv|
      csv << headers.keys
      rows.each { |row| csv << headers.values.map { |key| row[key.to_s] || row[key] || "-" } }
    end
  end

  def progress_headers
    {
      "Matricula" => :matricula,
      "Aluno" => :aluno,
      "Telefone" => :user_phone1,
      "Disciplina" => :curso,
      "Curso Perfil" => :curso_perfil,
      "Periodo Perfil" => :periodo_perfil,
      "Polo" => :unidade_fisica,
      "Ultimo Acesso" => :lastaccess,
      "Dias Sem Acesso" => :diasSemAcesso,
      "Status" => :enrolment_status,
      "Fase 1" => :fase1,
      "Fase 2" => :fase2,
      "Fase 3" => :fase3,
      "Progresso Total" => :progresso_total
    }
  end

  def grades_headers
    progress_headers.merge("Media Final" => :media)
  end
end
