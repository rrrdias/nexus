module Api
  class GroupsController < BaseController
    before_action :require_super_admin!

    def index
      groups = Group.includes(:system_modules).order(:name)
      render json: groups.map { |group| group.as_json.merge(modules: group.system_modules) }
    end

    def show
      group = Group.find(params[:id])
      render json: { group: group, moduleIds: group.system_module_ids }
    end

    def create
      Group.transaction do
        group = Group.create!(name: params[:name].to_s.strip, description: params[:description])
        group.system_module_ids = Array(params[:moduleIds])
      end
      render json: { success: true }
    end

    def update
      group = Group.find(params[:id])
      Group.transaction do
        group.update!(name: params[:name].to_s.strip, description: params[:description])
        group.system_module_ids = Array(params[:moduleIds])
      end
      render json: { success: true }
    end

    def destroy
      Group.find(params[:id]).destroy!
      render json: { success: true }
    end
  end
end
