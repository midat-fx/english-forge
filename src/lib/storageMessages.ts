/** Turns raw (English) storage-layer errors into a learner-facing Russian message. */
export function localizeStorageError(error: string): string {
  if (error.includes('Profile writes are locked')) return 'Запись профиля заблокирована, пока вы не импортируете резервную копию или не сбросите повреждённые данные.'
  if (error.includes('Profile deletion requires an explicit recovery action')) return 'Для удаления повреждённого профиля нужно явно выбрать действие восстановления.'
  if (error.includes('exceeds the 9 MB')) return 'Профиль превышает локальный лимит переносимых данных — 9 МБ.'
  if (error.includes('saved profile failed validation')) return 'Сохранённый профиль не прошёл проверку и не был загружен. Восстановите его из резервной копии или сбросьте повреждённые данные.'
  return 'Локальное хранилище вернуло ошибку. Повторите попытку или восстановите профиль из резервной копии.'
}
