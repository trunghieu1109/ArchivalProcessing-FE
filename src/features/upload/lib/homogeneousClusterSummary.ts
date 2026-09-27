const DOSSIER_STYLE_PREFIXES = [
  /^hồ\s+sơ\s+(?:về\s+)?(?:việc\s+)?/iu,
  /^tập\s+tài\s+liệu\s+(?:về\s+)?(?:việc\s+)?/iu,
  /^nhóm\s+tài\s+liệu\s+(?:về\s+)?(?:việc\s+)?/iu,
]

export function normalizeClusterContentSummary(value?: string | null) {
  const source = String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
  if (!source) return "Nhóm tài liệu có nội dung tương đồng."

  const sentences = source
    .split(/(?<=[.!?…])\s+/u)
    .map(toNarrativeSentence)
    .filter(Boolean)

  const selected: string[] = []
  for (const sentence of sentences) {
    if (selected.some((current) => wordSimilarity(current, sentence) >= 0.58)) {
      continue
    }
    selected.push(sentence)
    if (selected.length >= 2) break
  }

  return selected.join(" ") || "Nhóm tài liệu có nội dung tương đồng."
}

function toNarrativeSentence(value: string) {
  let sentence = value.trim()
  for (const prefix of DOSSIER_STYLE_PREFIXES) {
    sentence = sentence.replace(prefix, "")
  }
  sentence = sentence.trim()
  if (!sentence) return ""
  if (sentence.length > 220) {
    sentence = `${sentence.slice(0, 217).replace(/[\s,;:.-]+$/u, "")}…`
  }
  sentence = sentence[0].toLocaleUpperCase("vi-VN") + sentence.slice(1)
  return /[.!?…]$/u.test(sentence) ? sentence : `${sentence}.`
}

function wordSimilarity(left: string, right: string) {
  const leftWords = wordSet(left)
  const rightWords = wordSet(right)
  if (leftWords.size === 0 || rightWords.size === 0) return 0
  const intersection = [...leftWords].filter((word) => rightWords.has(word))
  const union = new Set([...leftWords, ...rightWords])
  return intersection.length / union.size
}

function wordSet(value: string) {
  return new Set(
    value
      .toLocaleLowerCase("vi-VN")
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/u)
      .filter((word) => word.length > 1)
  )
}
