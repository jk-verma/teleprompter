const escapeHtml = value =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")

const plainTextToHtml = value =>
  value
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map(line => `<p>${line ? escapeHtml(line) : "<br>"}</p>`)
    .join("")

const getFileExtension = fileName => {
  const lastDot = fileName.lastIndexOf(".")
  return lastDot >= 0 ? fileName.slice(lastDot + 1).toLowerCase() : ""
}

const isHtmlDocument = value => /<(html|head|body|!doctype)\b/i.test(value)

const isHtmlFragment = value =>
  /<(div|p|br|hr|strong|em|u|b|i|span|ul|ol|li|blockquote|section|article|h[1-6]|pre|table|thead|tbody|tr|td|th)\b/i.test(
    value,
  )

const htmlToPlainTextHtml = value => {
  const parser = new DOMParser()
  const documentElement = parser.parseFromString(value, "text/html")
  const bodyText = documentElement.body?.textContent?.trim() ?? ""

  return bodyText ? plainTextToHtml(bodyText) : ""
}

const extractBodySource = value => {
  const match = value.match(/<body\b[^>]*>([\s\S]*)<\/body>/i)
  return match?.[1]?.trim() ?? ""
}

const jsonValueToHtml = value => {
  if (typeof value === "string") {
    return value.trim().startsWith("<") ? value : plainTextToHtml(value)
  }

  if (Array.isArray(value)) {
    return value.map(item => jsonValueToHtml(item)).join("")
  }

  if (value && typeof value === "object") {
    const record = value
    const htmlKeys = ["html", "scriptHtml", "contentHtml", "bodyHtml", "markup"]
    for (const key of htmlKeys) {
      const candidate = record[key]
      if (typeof candidate === "string" && candidate.trim()) {
        return candidate
      }
    }

    const textKeys = ["text", "script", "content", "body", "message", "notes"]
    for (const key of textKeys) {
      const candidate = record[key]
      if (typeof candidate === "string" && candidate.trim()) {
        return plainTextToHtml(candidate)
      }
    }

    if (Array.isArray(record.blocks)) {
      return record.blocks.map(block => jsonValueToHtml(block)).join("")
    }
  }

  return ""
}

export const normalizeImportedScript = (value, fileName = "", mimeType = "") => {
  const trimmed = value.trim()
  if (!trimmed) {
    return ""
  }

  const extension = getFileExtension(fileName)
  const mime = mimeType.toLowerCase()
  const isHtmlFile =
    extension === "html" ||
    extension === "htm" ||
    extension === "xhtml" ||
    mime.includes("text/html") ||
    mime.includes("application/xhtml+xml")
  const isJsonFile = extension === "json" || mime.includes("application/json")

  if (isJsonFile) {
    try {
      const parsed = JSON.parse(value)
      const htmlFromJson = jsonValueToHtml(parsed)
      if (htmlFromJson.trim()) {
        return htmlFromJson
      }
    } catch {
      return plainTextToHtml(value)
    }
  }

  if (isHtmlFile) {
    const parser = new DOMParser()
    const documentElement = parser.parseFromString(value, "text/html")
    const bodyHtml = documentElement.body?.innerHTML?.trim() ?? ""

    if (isHtmlDocument(trimmed)) {
      if (isHtmlFragment(bodyHtml)) {
        return bodyHtml
      }

      const rawBodySource = extractBodySource(value)
      if (rawBodySource) {
        return plainTextToHtml(rawBodySource)
      }

      return htmlToPlainTextHtml(bodyHtml || value)
    }

    if (isHtmlFragment(trimmed)) {
      return trimmed
    }

    if (bodyHtml && isHtmlFragment(bodyHtml)) {
      return bodyHtml
    }

    return htmlToPlainTextHtml(bodyHtml || value)
  }

  if (isHtmlFragment(trimmed)) {
    return value
  }

  return plainTextToHtml(value)
}
