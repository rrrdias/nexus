module Api
  class AvaSyncController < ActionController::API
    def index
      return render json: { error: "CRON_SECRET is not configured" }, status: :service_unavailable if secret.blank?
      return render json: { error: "Unauthorized" }, status: :unauthorized unless authorized?

      render json: {
        success: true,
        results: AvaReports::SyncService.run(institution: params[:institution], type: params[:type])
      }
    end

    private

    def secret
      ENV["CRON_SECRET"]
    end

    def authorized?
      expected = "Bearer #{secret}"
      actual = request.headers["Authorization"].to_s
      ActiveSupport::SecurityUtils.secure_compare(actual, expected)
    rescue ArgumentError
      false
    end
  end
end
