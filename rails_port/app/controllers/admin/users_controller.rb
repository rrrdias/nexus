module Admin
  class UsersController < ApplicationController
    before_action :require_super_admin

    def index
      @users = User.includes(:groups, :direct_system_modules).order(:name)
      @groups = Group.order(:name)
      @modules = SystemModule.order(:name)
    end

    def create
      User.transaction do
        user = User.create!(user_params)
        user.group_ids = Array(params[:group_ids])
        user.direct_system_module_ids = Array(params[:module_ids])
      end
      redirect_to admin_users_path, notice: "Usuario criado."
    rescue ActiveRecord::RecordInvalid => e
      redirect_to admin_users_path, alert: e.message
    end

    def update
      user = User.find(params[:id])
      attrs = user_params
      attrs.delete(:password) if attrs[:password].blank?
      User.transaction do
        user.update!(attrs)
        user.group_ids = Array(params[:group_ids])
        user.direct_system_module_ids = Array(params[:module_ids])
      end
      redirect_to admin_users_path, notice: "Usuario atualizado."
    rescue ActiveRecord::RecordInvalid => e
      redirect_to admin_users_path, alert: e.message
    end

    def toggle_active
      user = User.find(params[:id])
      user.update!(active: !user.active)
      redirect_to admin_users_path
    end

    def destroy
      User.find(params[:id]).destroy!
      redirect_to admin_users_path, notice: "Usuario removido."
    end

    private

    def user_params
      params.require(:user).permit(:name, :email, :userid, :password, :isActive).tap do |attrs|
        attrs[:active] = attrs.delete(:isActive) == "1" if attrs.key?(:isActive)
      end
    end
  end
end
