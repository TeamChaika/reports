/**
 * iiko API Explorer — v4 (v2 endpoints + POST OLAP)
 * Запуск: IIKO_URL=... IIKO_LOGIN=... IIKO_PASSWORD=... node scripts/explore-iiko.mjs
 */

import { createHash } from 'crypto'
import { createInterface } from 'readline'
import { writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUTPUT_DIR = join(__dirname, 'iiko-responses')
mkdirSync(OUTPUT_DIR, { recursive: true })

function sha1(str) { return createHash('sha1').update(str).digest('hex') }
function prompt(rl, q) { return new Promise(r => rl.question(q, r)) }

function save(filename, content) {
  writeFileSync(join(OUTPUT_DIR, filename), typeof content === 'string' ? content : JSON.stringify(content, null, 2), 'utf8')
  console.log(`  💾 ${filename}`)
}

function parseXmlList(xml) {
  const items = []
  const rootMatch = xml.match(/^[\s\S]*?<([a-zA-Z][a-zA-Z0-9_-]*)[\s>]/)
  if (!rootMatch) return []
  const rootTag = rootMatch[1]
  const inner = xml
    .replace(new RegExp(`^[\\s\\S]*?<${rootTag}[^>]*>`), '')
    .replace(new RegExp(`</${rootTag}>[\\s\\S]*$`), '')
  const childMatch = inner.match(/<([a-zA-Z][a-zA-Z0-9_-]*)[\s>]/)
  if (!childMatch) return []
  const childTag = childMatch[1]
  const re = new RegExp(`<${childTag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${childTag}>`, 'gm')
  let m
  while ((m = re.exec(inner)) !== null) items.push(parseXmlObj(m[0]))
  return items
}

function parseXmlObj(xml) {
  const obj = {}
  const inner = xml.replace(/^<[^>]+>/, '').replace(/<\/[^>]+>\s*$/, '').trim()
  const re = /<([a-zA-Z][a-zA-Z0-9_-]*)(?:\s[^>]*)?>[\s\S]*?<\/\1>|<([a-zA-Z][a-zA-Z0-9_-]*)(?:\s[^>]*)?\s*\/>/gm
  let found = false, m
  while ((m = re.exec(inner)) !== null) {
    found = true
    const tag = m[1] ?? m[2]
    const innerContent = m[0].replace(/^<[^>]+>/, '').replace(/<\/[^>]+>\s*$/, '').trim()
    const val = /<[a-zA-Z]/.test(innerContent) ? parseXmlObj(m[0]) : (innerContent || null)
    if (obj[tag] !== undefined) {
      if (!Array.isArray(obj[tag])) obj[tag] = [obj[tag]]
      obj[tag].push(val)
    } else {
      obj[tag] = val
    }
  }
  return found ? obj : (inner || null)
}

function printStructure(label, data) {
  console.log(`\n${'─'.repeat(64)}`)
  console.log(`📦 ${label}`)
  console.log('─'.repeat(64))
  const arr = Array.isArray(data) ? data : (data ? [data] : [])
  if (!arr.length) { console.log('  (пусто)'); return }
  console.log(`  Записей: ${arr.length}`)
  for (const [i, item] of arr.slice(0, 2).entries()) {
    if (!item || typeof item !== 'object') continue
    console.log(`\n  Запись ${i + 1}:`)
    for (const [k, v] of Object.entries(item)) {
      const d = Array.isArray(v) ? `[${v.length} items]` : v && typeof v === 'object' ? `{${Object.keys(v).join(', ')}}` : String(v ?? 'null').slice(0, 80)
      console.log(`    ${k}: ${d}`)
    }
  }
}

// ── HTTP клиент ───────────────────────────────────────────────────────────────

async function authenticate(baseUrl, login, passwordSha1) {
  console.log('\n🔑 Аутентификация...')
  const res = await fetch(`${baseUrl}/resto/api/auth?login=${encodeURIComponent(login)}&pass=${passwordSha1}`, { signal: AbortSignal.timeout(10_000) })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const key = (await res.text()).trim()
  if (!key || key.startsWith('<') || key.length < 10) throw new Error(`Невалидный ключ: ${key.slice(0, 80)}`)
  console.log(`  ✅ sessionKey (${key.length} символов)`)
  return key
}

async function httpGet(baseUrl, key, path) {
  const sep = path.includes('?') ? '&' : '?'
  const url = `${baseUrl}${path}${sep}key=${key}`
  console.log(`\n⬇️  GET ${path.split('?')[0]}`)
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(30_000) })
    const text = await res.text()
    if (!res.ok) { console.log(`  ❌ ${res.status}: ${text.slice(0, 100)}`); return null }
    const t = text.trimStart()
    if (t.startsWith('{') || t.startsWith('[')) { console.log('  ✅ JSON'); return { format: 'json', raw: text, data: JSON.parse(text) } }
    if (t.startsWith('<')) { console.log('  ✅ XML'); return { format: 'xml', raw: text, data: parseXmlList(text) } }
    console.log(`  ⚠️  ${t.slice(0, 60)}`); return null
  } catch (e) { console.log(`  ❌ ${e.message}`); return null }
}

async function httpPost(baseUrl, key, path, body) {
  const sep = path.includes('?') ? '&' : '?'
  const url = `${baseUrl}${path}${sep}key=${key}`
  console.log(`\n⬆️  POST ${path.split('?')[0]}`)
  console.log(`  Body: ${JSON.stringify(body).slice(0, 120)}`)
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
    })
    const text = await res.text()
    if (!res.ok) { console.log(`  ❌ ${res.status}: ${text.slice(0, 200)}`); return null }
    const t = text.trimStart()
    if (t.startsWith('{') || t.startsWith('[')) { console.log('  ✅ JSON'); return { format: 'json', raw: text, data: JSON.parse(text) } }
    if (t.startsWith('<')) { console.log('  ✅ XML'); return { format: 'xml', raw: text, data: parseXmlList(text) } }
    console.log(`  ⚠️  ${t.slice(0, 60)}`); return null
  } catch (e) { console.log(`  ❌ ${e.message}`); return null }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('╔══════════════════════════════════════════════════════════╗')
  console.log('║        iiko API Explorer v4 — Shift Reports              ║')
  console.log('╚══════════════════════════════════════════════════════════╝')

  let baseUrl, login, passwordSha1
  if (process.env.IIKO_URL && process.env.IIKO_LOGIN && process.env.IIKO_PASSWORD) {
    baseUrl = process.env.IIKO_URL.trim().replace(/\/$/, '')
    login = process.env.IIKO_LOGIN.trim()
    passwordSha1 = sha1(process.env.IIKO_PASSWORD.trim())
    console.log(`\n  ${baseUrl}  /  ${login}`)
  } else {
    const rl = createInterface({ input: process.stdin, output: process.stdout })
    baseUrl = (await prompt(rl, 'iiko URL: ')).trim().replace(/\/$/, '')
    login = (await prompt(rl, 'Логин: ')).trim()
    passwordSha1 = sha1((await prompt(rl, 'Пароль: ')).trim())
    rl.close()
  }

  const key = await authenticate(baseUrl, login, passwordSha1)

  // ── Departments ─────────────────────────────────────────────────────────────
  console.log('\n═══ СПРАВОЧНИКИ ═══')
  const depts = await httpGet(baseUrl, key, '/resto/api/corporation/departments')
  let restaurants = []
  if (depts?.data) {
    save('departments.xml', depts.raw)
    save('departments.json', depts.data)
    restaurants = depts.data.filter(d => d?.type === 'DEPARTMENT')
    console.log(`  → Всего: ${depts.data.length}, type=DEPARTMENT: ${restaurants.length}`)
    for (const r of restaurants.slice(0, 15)) console.log(`    • [${r.code ?? '—'}] ${r.name} (${r.id})`)
    printStructure('Departments — структура полей', depts.data.slice(0, 2))
  }

  const deptId = restaurants[0]?.id
  const deptName = restaurants[0]?.name ?? '?'

  // ── Nomenclature v2 ─────────────────────────────────────────────────────────
  console.log('\n═══ НОМЕНКЛАТУРА ═══')
  const nomPaths = [
    `/resto/api/v2/entities/products/list?includeDeleted=false`,
    deptId ? `/resto/api/nomenclature?departmentId=${deptId}` : null,
    `/resto/api/v2/entities/products/list`,
    `/resto/api/products`,
  ].filter(Boolean)

  for (const path of nomPaths) {
    const r = await httpGet(baseUrl, key, path)
    if (r?.data) {
      save('nomenclature.xml', r.raw)
      save('nomenclature.json', r.data)
      printStructure(`Номенклатура (${path.split('?')[0]})`, Array.isArray(r.data) ? r.data.slice(0, 2) : [r.data])
      break
    }
  }

  // ── PayTypes ────────────────────────────────────────────────────────────────
  console.log('\n═══ ТИПЫ ОПЛАТ ═══')
  const payPaths = [
    '/resto/api/v2/entities/paymentTypes',
    '/resto/api/v2/entities/employees/roles',
    '/resto/api/v2/paymentTypes',
    '/resto/api/corporation/payTypes',
    '/resto/api/payTypes',
    '/resto/api/v2/entities/employees/employeeRoles',
  ]
  for (const path of payPaths) {
    const r = await httpGet(baseUrl, key, path)
    if (r?.data) {
      save('pay-types.json', r.data)
      printStructure(`PayTypes (${path})`, Array.isArray(r.data) ? r.data : [r.data])
      break
    }
  }

  // ── OLAP Columns ────────────────────────────────────────────────────────────
  console.log('\n═══ OLAP КОЛОНКИ ═══')
  const olapCols = await httpGet(baseUrl, key, '/resto/api/v2/reports/olap/columns?reportType=SALES')
  if (olapCols?.data) {
    save('olap-columns.json', olapCols.data)
    const arr = Array.isArray(olapCols.data) ? olapCols.data : [olapCols.data]
    console.log(`  Доступных полей: ${arr.length}`)
    arr.slice(0, 20).forEach(c => console.log(`    • ${c?.id ?? c?.name ?? JSON.stringify(c).slice(0, 60)}`))
  }

  // ── OLAP v2 POST ────────────────────────────────────────────────────────────
  console.log('\n═══ OLAP v2 ═══')
  const today = new Date().toISOString().split('T')[0]
  const week = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0]

  // Даты без времени (OpenDate.Typed — тип DATE, не DATETIME)
  // Поля агрегации — из реально доступных в /olap/columns
  const olapBody = {
    reportType: 'SALES',
    buildSummary: 'false',
    groupByRowFields: ['OpenDate.Typed', 'Department'],
    groupByColFields: ['PayTypes'],
    aggregateFields: ['DishAmountInt', 'DishSumInt', 'DishDiscountSumInt'],
    filters: {
      'OpenDate.Typed': {
        filterType: 'DateRange',
        periodType: 'CUSTOM',
        from: week,
        to: today,
      },
    },
  }

  const olapV2Post = await httpPost(baseUrl, key, '/resto/api/v2/reports/olap', olapBody)
  if (olapV2Post?.data) {
    const rows = Array.isArray(olapV2Post.data) ? olapV2Post.data : (olapV2Post.data?.data ?? [olapV2Post.data])
    save('olap-v2.json', olapV2Post.data)
    printStructure('OLAP v2 (POST)', rows.slice(0, 3))
    if (rows[0]) {
      console.log('\n  Все ключи первой строки:')
      Object.keys(rows[0]).forEach(k => console.log(`    ${k}: ${JSON.stringify(rows[0][k]).slice(0, 60)}`))
    }
  }

  // Вариант 2: один ресторан с фильтром по Department.Id
  if (!olapV2Post?.data && deptId) {
    console.log('  → Пробуем с фильтром по Department.Id...')
    const olapWithDept = {
      ...olapBody,
      filters: {
        ...olapBody.filters,
        'Department.Id': { filterType: 'IncludeValues', values: [deptId] },
      },
    }
    const r2 = await httpPost(baseUrl, key, '/resto/api/v2/reports/olap', olapWithDept)
    if (r2?.data) {
      save('olap-v2.json', r2.data)
      printStructure('OLAP v2 с Department.Id', Array.isArray(r2.data) ? r2.data.slice(0, 3) : [r2.data])
    }
  }

  // ── Employees ───────────────────────────────────────────────────────────────
  console.log('\n═══ СОТРУДНИКИ ═══')
  const emps = await httpGet(baseUrl, key, '/resto/api/employees')
  if (emps?.data) {
    const arr = Array.isArray(emps.data) ? emps.data : [emps.data]
    const active = arr.filter(e => e?.deleted === 'false' || e?.deleted === false)
    const notSupplier = active.filter(e => e?.supplier === 'false' || e?.supplier === false)
    console.log(`  Всего: ${arr.length}`)
    console.log(`  Активных (deleted=false): ${active.length}`)
    console.log(`  Не поставщики: ${notSupplier.length}`)
    save('employees.json', arr.slice(0, 100))
    printStructure('Employees — структура полей', arr.slice(0, 2))
  }

  // ── Stores ──────────────────────────────────────────────────────────────────
  console.log('\n═══ СКЛАДЫ ═══')
  const stores = await httpGet(baseUrl, key, '/resto/api/corporation/stores')
  if (stores?.data) {
    save('stores.json', stores.data)
    printStructure('Stores', stores.data.slice(0, 2))
  }

  console.log('\n')
  console.log('╔══════════════════════════════════════════════════════════╗')
  console.log(`║  Готово. Заведений DEPARTMENT: ${String(restaurants.length).padEnd(27)}║`)
  console.log(`║  Первое для теста: "${(deptName).slice(0, 35).padEnd(35)}"  ║`)
  console.log('║  Файлы: scripts/iiko-responses/                          ║')
  console.log('╚══════════════════════════════════════════════════════════╝')
}

main().catch(err => { console.error('\n💥', err.message); process.exit(1) })
