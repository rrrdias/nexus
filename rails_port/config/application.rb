require_relative "boot"

require "rails"
require "active_model/railtie"
require "active_job/railtie"
require "active_record/railtie"
require "action_controller/railtie"
require "action_view/railtie"
require "action_mailer/railtie"
# require "sprockets/railtie"

Bundler.require(*Rails.groups)

module NexusCoreRails
  class Application < Rails::Application
    config.load_defaults 7.1
    config.time_zone = "America/Sao_Paulo"
    config.active_record.schema_format = :sql
    config.autoload_lib(ignore: %w[assets tasks])

    config.middleware.insert_before 0, Rack::Cors do
      allow do
        origins ENV.fetch("FRONTEND_ORIGIN", "http://localhost:3003")
        resource "/api/*", headers: :any, methods: %i[get post put patch delete options]
      end
    end
  end
end
