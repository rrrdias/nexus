module Admin
  class GroupsController < ApplicationController
    before_action :require_super_admin

    def index
      @groups = Group.includes(:system_modules).order(:name)
      @modules = SystemModule.order(:name)
    end

    def create
      Group.transaction do
        group = Group.create!(group_params)
        group.system_module_ids = Array(params[:module_ids])
      end
      redirect_to admin_groups_path, notice: "Grupo criado."
    rescue ActiveRecord::RecordInvalid => e
      redirect_to admin_groups_path, alert: e.message
    end

    def update
      group = Group.find(params[:id])
      Group.transaction do
        group.update!(group_params)
        group.system_module_ids = Array(params[:module_ids])
      end
      redirect_to admin_groups_path, notice: "Grupo atualizado."
    rescue ActiveRecord::RecordInvalid => e
      redirect_to admin_groups_path, alert: e.message
    end

    def destroy
      Group.find(params[:id]).destroy!
      redirect_to admin_groups_path, notice: "Grupo removido."
    end

    private

    def group_params
      params.require(:group).permit(:name, :description)
    end
  end
end
