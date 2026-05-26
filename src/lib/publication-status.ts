export function describePublicationReportStatus(status: string | null | undefined) {
  switch (status) {
    case "api_capability_unavailable":
      return "Метод Avito API недоступен. Товар и фид готовы; настройте Autoload вручную или дождитесь выдачи доступа.";
    case "autoload_profile_manual_setup_required":
      return "Нужно вручную подключить feed URL в Autoload-кабинете Avito.";
    case "profile_synced_upload_unavailable":
      return "Профиль Autoload сохранен; запуск upload API недоступен, Avito заберет фид по расписанию.";
    case "profile_synced_upload_error":
      return "Профиль Autoload сохранен, но запуск upload завершился ошибкой.";
    case "upload_started_report_pending":
      return "Upload запущен, отчет Avito еще формируется.";
    case "missing_credentials":
      return "Client ID и Client Secret еще не заполнены.";
    case "local_validation_failed":
      return "Нужно исправить поля товара перед отправкой.";
    case "autoload_ready":
      return "Готово к отправке через Autoload.";
    default:
      return status || "Нет отчета";
  }
}
