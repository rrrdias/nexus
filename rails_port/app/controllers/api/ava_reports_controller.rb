module Api
  class AvaReportsController < BaseController
    before_action :require_ava_access!

    def progress
      render json: AvaReports::Query.progress(
        page: params[:page].to_i.presence || 1,
        size: params[:size].to_i.presence || 30,
        filters: params[:filters] || {}
      )
    end

    def progress_export
      render json: AvaReports::Query.progress_export(filters: params[:filters] || {})
    end

    def grades
      render json: AvaReports::Query.grades(
        page: params[:page].to_i.presence || 1,
        size: params[:size].to_i.presence || 30,
        filters: params[:filters] || {}
      )
    end

    def grades_export
      render json: AvaReports::Query.grades_export(filters: params[:filters] || {})
    end

    def sync
      render json: {
        success: true,
        results: AvaReports::SyncService.run(institution: params[:institution], type: params[:type])
      }
    end

    private

    def require_ava_access!
      raise_unauthorized unless current_user&.can_access_module?("ava")
    end
  end
end
