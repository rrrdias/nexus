module Api
  class BaseController < ActionController::API
    before_action :authenticate_api_user!

    attr_reader :current_user

    private

    def authenticate_api_user!
      header = request.headers["Authorization"].to_s
      scheme, token = header.split(" ", 2)
      raise_unauthorized unless scheme == "Bearer" && token.present?

      payload = JwtToken.decode(token)
      @current_user = User.find_by(id: payload["sub"])
      raise_unauthorized if @current_user.blank? || @current_user.disabled?
    rescue JWT::DecodeError
      raise_unauthorized
    end

    def require_super_admin!
      raise_unauthorized unless current_user&.super_admin?
    end

    def raise_unauthorized
      render json: { message: "Unauthorized" }, status: :unauthorized
    end
  end
end
