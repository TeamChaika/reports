// Minimal XML parser — no external deps, handles iiko REST API responses

function parseXmlList(xml: string): Record<string, unknown>[] {
  const items: Record<string, unknown>[] = []
  const rootMatch = xml.match(/^[\s\S]*?<([a-zA-Z][a-zA-Z0-9_-]*)[\s>]/)
  if (!rootMatch) return []
  const rootTag = rootMatch[1] as string
  const inner = xml
    .replace(new RegExp(`^[\\s\\S]*?<${rootTag}[^>]*>`), '')
    .replace(new RegExp(`</${rootTag}>[\\s\\S]*$`), '')
  const childMatch = inner.match(/<([a-zA-Z][a-zA-Z0-9_-]*)[\s>]/)
  if (!childMatch) return []
  const childTag = childMatch[1] as string
  const re = new RegExp(`<${childTag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${childTag}>`, 'gm')
  let m: RegExpExecArray | null
  while ((m = re.exec(inner)) !== null) items.push(parseXmlObj(m[0]))
  return items
}

function parseXmlObj(xml: string): Record<string, unknown> {
  const obj: Record<string, unknown> = {}
  const inner = xml.replace(/^<[^>]+>/, '').replace(/<\/[^>]+>\s*$/, '').trim()
  const re =
    /<([a-zA-Z][a-zA-Z0-9_-]*)(?:\s[^>]*)?>[\s\S]*?<\/\1>|<([a-zA-Z][a-zA-Z0-9_-]*)(?:\s[^>]*)?\s*\/>/gm
  let found = false
  let m: RegExpExecArray | null
  while ((m = re.exec(inner)) !== null) {
    found = true
    const tag = (m[1] ?? m[2]) as string
    const innerContent = m[0].replace(/^<[^>]+>/, '').replace(/<\/[^>]+>\s*$/, '').trim()
    const val = /<[a-zA-Z]/.test(innerContent) ? parseXmlObj(m[0]) : innerContent || null
    if (obj[tag] !== undefined) {
      if (!Array.isArray(obj[tag])) obj[tag] = [obj[tag]]
      ;(obj[tag] as unknown[]).push(val)
    } else {
      obj[tag] = val
    }
  }
  return found ? obj : { _value: inner || null }
}

// XML strings from iiko represent booleans as "true"/"false" strings
function boolVal(v: unknown): boolean {
  return v === true || v === 'true'
}

export { parseXmlList, parseXmlObj, boolVal }
