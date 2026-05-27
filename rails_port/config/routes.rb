Rails.application.routes.draw do
  root "dashboard#index"

  get "/login", to: "sessions#new"
  post "/login", to: "sessions#create"
  delete "/logout", to: "sessions#destroy"

  namespace :admin do
    resources :users do
      patch :toggle_active, on: :member
    end
    resources :groups
  end

  get "/reports", to: redirect("/reports/progress/ead"), as: :reports
  get "/relatorios", to: redirect("/reports")
  get "/reports/progress/:institution", to: "ava_reports#progress", as: :progress_report
  get "/reports/progress/:institution/export", to: "ava_reports#progress_export", as: :progress_report_export
  get "/reports/grades/:institution", to: "ava_reports#grades", as: :grades_report
  get "/reports/grades/:institution/export", to: "ava_reports#grades_export", as: :grades_report_export
  post "/reports/sync", to: "ava_reports#sync", as: :reports_sync

  namespace :api do
    post "/auth/login", to: "auth#login"
    get "/system/modules", to: "system#modules"
    get "/system/sidebar_modules", to: "system#sidebar_modules"
    get "/system/sidebar-modules", to: "system#sidebar_modules"

    resources :users do
      patch :active, on: :member
      put :active, on: :member
    end
    resources :groups

    post "/ava_reports/progress", to: "ava_reports#progress"
    post "/ava_reports/progress_export", to: "ava_reports#progress_export"
    post "/ava_reports/grades", to: "ava_reports#grades"
    post "/ava_reports/grades_export", to: "ava_reports#grades_export"
    post "/ava_reports/sync", to: "ava_reports#sync"
    post "/ava-reports/progress", to: "ava_reports#progress"
    post "/ava-reports/progress/export", to: "ava_reports#progress_export"
    post "/ava-reports/grades", to: "ava_reports#grades"
    post "/ava-reports/grades/export", to: "ava_reports#grades_export"
    post "/ava-reports/sync", to: "ava_reports#sync"

    get "/ava_sync", to: "ava_sync#index"
    get "/ava-sync", to: "ava_sync#index"
  end
end
