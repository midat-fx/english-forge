import { invoke, isTauri } from '@tauri-apps/api/core'
import { downloadText } from '../data/serialization'

export interface FileFilter {
  name: string
  extensions: string[]
}

export async function saveTextFile(
  filename: string,
  content: string,
  mimeType: string,
  filters: FileFilter[],
): Promise<boolean> {
  if (!isTauri()) {
    downloadText(filename, content, mimeType)
    return true
  }

  const [{ save }, { writeTextFile }] = await Promise.all([
    import('@tauri-apps/plugin-dialog'),
    import('@tauri-apps/plugin-fs'),
  ])
  const path = await save({ defaultPath: filename, filters })
  if (!path) return false
  await writeTextFile(path, content)
  return true
}

export async function openJsonText(): Promise<string | null | undefined> {
  if (!isTauri()) return undefined

  try {
    return await invoke<string | null>('choose_import_text')
  } catch (error) {
    const message = String(error)
    if (message.includes('9 MiB')) throw new Error('Импорт превышает безопасный лимит профиля 9 МБ.')
    if (message.includes('UTF-8')) throw new Error('Файл импорта не является корректным текстом UTF-8.')
    throw new Error('Не удалось безопасно прочитать выбранный файл импорта.')
  }
}
