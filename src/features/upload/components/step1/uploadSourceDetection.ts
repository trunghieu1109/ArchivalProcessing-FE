export type DetectedUploadSource =
  | { kind: "zip"; file: File }
  | { kind: "folder"; files: File[] }

interface LegacyFileSystemEntry {
  isFile: boolean
  isDirectory: boolean
  name: string
  fullPath: string
}

interface LegacyFileSystemFileEntry extends LegacyFileSystemEntry {
  file: (
    successCallback: (file: File) => void,
    errorCallback?: (error: DOMException) => void
  ) => void
}

interface LegacyFileSystemDirectoryEntry extends LegacyFileSystemEntry {
  createReader: () => {
    readEntries: (
      successCallback: (entries: LegacyFileSystemEntry[]) => void,
      errorCallback?: (error: DOMException) => void
    ) => void
  }
}

export async function detectDroppedUploadSource(
  dataTransfer: DataTransfer
): Promise<DetectedUploadSource> {
  const entries = Array.from(dataTransfer.items)
    .map<LegacyFileSystemEntry | null>((item) => {
      const legacyItem = item as DataTransferItem & {
        webkitGetAsEntry?: () => FileSystemEntry | null
      }
      return (legacyItem.webkitGetAsEntry?.() ??
        null) as unknown as LegacyFileSystemEntry | null
    })
    .filter((entry): entry is LegacyFileSystemEntry => entry !== null)

  const directories = entries.filter((entry) => entry.isDirectory)
  if (directories.length > 0) {
    if (directories.length !== 1 || entries.length !== 1) {
      throw new Error("Mỗi lần chỉ kéo thả một folder.")
    }
    const files = await readEntryFiles(
      directories[0] as LegacyFileSystemDirectoryEntry,
      ""
    )
    return { kind: "folder", files }
  }

  const files = Array.from(dataTransfer.files)
  if (files.length === 1 && isZipFile(files[0])) {
    return { kind: "zip", file: files[0] }
  }
  if (files.length > 0 && files.every(isPdfFile)) {
    return {
      kind: "folder",
      files: files.map((file) =>
        withRelativePath(file, joinPath("Tài liệu PDF", file.name))
      ),
    }
  }
  throw new Error(
    "Hãy kéo thả một file ZIP, một folder PDF hoặc một nhóm chỉ gồm file PDF."
  )
}

export function isZipFile(file: File): boolean {
  return file.name.toLowerCase().endsWith(".zip")
}

export function isPdfFile(file: File): boolean {
  return file.name.toLowerCase().endsWith(".pdf") && file.size > 0
}

async function readEntryFiles(
  entry: LegacyFileSystemDirectoryEntry,
  parentPath: string
): Promise<File[]> {
  const currentPath = joinPath(parentPath, entry.name)
  const children = await readDirectoryEntries(entry)
  const nested = await Promise.all(
    children.map(async (child) => {
      if (child.isDirectory) {
        return readEntryFiles(
          child as LegacyFileSystemDirectoryEntry,
          currentPath
        )
      }
      if (!child.isFile) return []
      const file = await readFileEntry(child as LegacyFileSystemFileEntry)
      return [withRelativePath(file, joinPath(currentPath, file.name))]
    })
  )
  return nested.flat()
}

function readDirectoryEntries(
  entry: LegacyFileSystemDirectoryEntry
): Promise<LegacyFileSystemEntry[]> {
  const reader = entry.createReader()
  const allEntries: LegacyFileSystemEntry[] = []
  return new Promise((resolve, reject) => {
    const readNext = () => {
      reader.readEntries(
        (entries) => {
          if (entries.length === 0) {
            resolve(allEntries)
            return
          }
          allEntries.push(...entries)
          readNext()
        },
        (error) => reject(error)
      )
    }
    readNext()
  })
}

function readFileEntry(entry: LegacyFileSystemFileEntry): Promise<File> {
  return new Promise((resolve, reject) => {
    entry.file(resolve, reject)
  })
}

function withRelativePath(file: File, relativePath: string): File {
  if (file.webkitRelativePath === relativePath) return file
  const copy = new File([file], file.name, {
    type: file.type,
    lastModified: file.lastModified,
  })
  Object.defineProperty(copy, "webkitRelativePath", {
    configurable: true,
    value: relativePath.replaceAll("\\", "/"),
  })
  return copy
}

function joinPath(parent: string, name: string): string {
  return [parent, name].filter(Boolean).join("/")
}
