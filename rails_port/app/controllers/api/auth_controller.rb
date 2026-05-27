module Api
  class AuthController < ActionController::API
    def login
      user = User.where(email: login_param).or(User.where(userid: login_param)).first

      if user&.active && user.authenticate(params[:password])
        render json: {
          access_token: JwtToken.encode(user),
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            image: user.image,
            isSuperAdmin: user.super_admin?
          }
        }
      else
        render json: { message: "Credenciais invalidas" }, status: :unauthorized
      end
    end

    private

    def login_param
      params[:email].presence || params[:login].to_s.strip
    end
  end
end
