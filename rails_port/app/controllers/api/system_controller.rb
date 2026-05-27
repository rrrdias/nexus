module Api
  class SystemController < BaseController
    def modules
      render json: SystemModule.order(:name)
    end

    def sidebar_modules
      render json: current_user.accessible_modules
    end
  end
end
