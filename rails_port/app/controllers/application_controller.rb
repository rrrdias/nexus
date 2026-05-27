class ApplicationController < ActionController::Base
  helper_method :current_user, :logged_in?, :super_admin?

  before_action :require_login

  private

  def current_user
    @current_user ||= User.find_by(id: session[:user_id]) if session[:user_id].present?
  end

  def logged_in?
    current_user.present?
  end

  def super_admin?
    current_user&.super_admin?
  end

  def require_login
    redirect_to login_path unless logged_in?
  end

  def require_super_admin
    redirect_to root_path, alert: "Acesso negado." unless super_admin?
  end

  def sign_in_user(user)
    session[:user_id] = user.id
  end

  def sign_out_user
    reset_session
  end
end
