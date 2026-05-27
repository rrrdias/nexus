module Api
  class UsersController < BaseController
    before_action :require_super_admin!

    def index
      users = User.includes(:groups, :direct_system_modules).order(:name)
      render json: users.map { |user| serialize_user(user) }
    end

    def show
      user = User.find(params[:id])
      render json: {
        user: user,
        groupIds: user.group_ids,
        moduleIds: user.direct_system_module_ids
      }
    end

    def create
      User.transaction do
        user = User.create!(user_params)
        replace_associations(user)
      end
      render json: { success: true }
    end

    def update
      user = User.find(params[:id])
      User.transaction do
        attrs = user_params
        attrs.delete(:password) if attrs[:password].blank?
        user.update!(attrs)
        replace_associations(user)
      end
      render json: { success: true }
    end

    def active
      User.find(params[:id]).update!(active: ActiveModel::Type::Boolean.new.cast(params[:isActive]))
      render json: { success: true }
    end

    def destroy
      User.find(params[:id]).destroy!
      render json: { success: true }
    end

    private

    def user_params
      {
        name: params[:name].to_s.strip,
        email: params[:email].to_s.strip,
        userid: params[:userid].presence&.strip,
        active: ActiveModel::Type::Boolean.new.cast(params[:isActive]),
        password: params[:password]
      }
    end

    def replace_associations(user)
      user.group_ids = Array(params[:groupIds])
      user.direct_system_module_ids = Array(params[:moduleIds])
    end

    def serialize_user(user)
      user.as_json.merge(
        groups: user.groups.map { |group| { id: group.id, name: group.name } },
        modules: user.direct_system_modules.map { |mod| { id: mod.id, name: mod.name } }
      )
    end
  end
end
