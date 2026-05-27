class SessionsController < ApplicationController
  skip_before_action :require_login, only: %i[new create]

  def new
    redirect_to root_path if logged_in?
  end

  def create
    user = User.where(email: login_param).or(User.where(userid: login_param)).first

    if user&.active && user.authenticate(params[:password])
      sign_in_user(user)
      redirect_to root_path
    else
      redirect_to login_path(error: "CredentialsSignin"), alert: "Usuario ou senha incorretos."
    end
  end

  def destroy
    sign_out_user
    redirect_to login_path
  end

  private

  def login_param
    params[:login].to_s.strip
  end
end
