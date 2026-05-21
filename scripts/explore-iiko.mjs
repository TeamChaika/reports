/**
 * iiko API Explorer
 * Запуск: node scripts/explore-iiko.mjs
 * Требует: Node.js 18+ (встроенный fetch)
 *
 * Что делает:
 *   1. Запрашивает credentials интерактивно
 *   2. Делает запросы к ключевым справочникам
 *   3. Сохраняет ответы в scripts/iiko-responses/
 *   4. Выводит краткую структуру каждого ответа
 */

import { createHash } from 'crypto'
import { createInterface } from 'readline'
import { writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUTPUT_DIR = join(__dirname, 'iiko-responses')
mkdirSync(OUTPUT_DIR, { recursive: true })

// ── Helpers ──────────────────────────────────────────────────────────────────

function md5(str) {
  return createHash('md5').update(str).digest('hex')
}

function prompt(rl, question) {
  return new Promise((resolve) => rl.question(question, resolve))
}

function save(filename, data) {
  const path = join(OUTPUT_DIR, filename)
  writeFileSync(path, JSON.stringify(data, null, 2), 'utf8')
  return path
}

function printStructure(label, data, maxItems = 2) {
  console.log(`\n${'─'.repeat(60)}`)
  console.log(`📦 ${label}`)
  console.log('─'.repeat(60))

  if (Array.isArray(data)) {
    console.log(`  Тип: массив, ${data.length} записей`)
    if (data.length > 0) {
      console.log(`  Пример записи (первая):`)
      printFields(data[0], '    ')
      if (data.length > 1) {
        console.log(`  ... и ещё ${data.length - 1} записей`)
      }
    }
  } else if (typeof data === 'object' && data !== null) {
    console.log(`  Тип: объект`)
    printFields(data, '  ')
  } else {
    console.log(`  Значение: ${data}`)
  }
}

function printFields(obj, indent = '') {
  for (const [key, value] of Object.entries(obj)) {
    const type = Array.isArray(value)
      ? `array[${value.length}]`
      : value === null
        ? 'null'
        : typeof value
    const preview =
      typeof value === 'string' && value.length > 60
        ? `"${value.slice(0, 57)}..."`
        : Array.isArray(value) && value.length > 0
          ? `[${JSON.stringify(value[0])}...]`
          : JSON.stringify(value)
    console.log(`${indent}${key}: ${type} = ${preview}`)
  }
}

// ── iiko API ─────────────────────────────────────────────────────────────────

async function authenticate(baseUrl, login, passwordMd5) {
  const url = `${baseUrl}/resto/api/auth?login=${encodeURIComponent(login)}&pass=${passwordMd5}`
  console.log(`\n🔑 Аутентификация...`)
  const res = await fetch(url, { signal: AbortSignal.timeout(10_000) })
  if (!res.ok) throw new Error(`Auth failed: HTTP ${res.status}`)
  const key = (await res.text()).trim()
  if (!key || key.startsWith('<') || key.length < 10) {
    throw new Error(`Auth вернул невалидный ключ: "${key.slice(0, 100)}"`)
  }
  console.log(`  ✅ Получен sessionKey (${key.length} символов)`)
  return key
}

async function apiGet(baseUrl, key, path, label) {
  const url = `${baseUrl}${path}${path.includes('?') ? '&' : '?'}key=${key}`
  console.log(`\n⬇️  GET ${path.split('?')[0]}`)
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(30_000) })
    if (!res.ok) {
      const body = await res.text()
      console.log(`  ❌ HTTP ${res.status}: ${body.slice(0, 200)}`)
      return null
    }
    const data = await res.json()
    console.log(`  ✅ Получен ответ`)
    return data
  } catch (err) {
    console.log(`  ❌ Ошибка: ${err.message}`)
    return null
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const rl = createInterface({ input: process.stdin, output: process.stdout })

  console.log('╔══════════════════════════════════════════════════════════╗')
  console.log('║           iiko API Explorer — Shift Reports              ║')
  console.log('╚══════════════════════════════════════════════════════════╝')
  console.log('Ответы сохраняются в: scripts/iiko-responses/\n')

  const baseUrl = (await prompt(rl, 'iiko URL (например http://1.2.3.4:9900): ')).trim().replace(/\/$/, '')
  const login = (await prompt(rl, 'Логин: ')).trim()
  const password = await prompt(rl, 'Пароль: ')
  rl.close()

  const passwordMd5 = md5(password.trim())
  console.log(`\nMD5 пароля: ${passwordMd5}`)

  let key
  try {
    key = await authenticate(baseUrl, login, passwordMd5)
  } catch (err) {
    console.error(`\n❌ Не удалось подключиться: ${err.message}`)
    process.exit(1)
  }

  const results = {}

  // 1. Departments
  const departments = await apiGet(baseUrl, key, '/resto/api/corporation/departments', 'Departments')
  if (departments) {
    results.departments = departments
    save('departments.json', departments)
    printStructure('Заведения / Департаменты (departments)', departments)
  }

  // 2. Pay Types
  const payTypes = await apiGet(baseUrl, key, '/resto/api/corporation/payTypes', 'PayTypes')
  if (payTypes) {
    results.payTypes = payTypes
    save('pay-types.json', payTypes)
    printStructure('Типы оплат (payTypes)', payTypes)
  }

  // 3. Employees
  const employees = await apiGet(baseUrl, key, '/resto/api/employees', 'Employees')
  if (employees) {
    results.employees = employees
    save('employees.json', employees)
    printStructure('Сотрудники (employees)', employees)
  }

  // 4. Stores (склады)
  const stores = await apiGet(baseUrl, key, '/resto/api/corporation/stores', 'Stores')
  if (stores) {
    results.stores = stores
    save('stores.json', stores)
    printStructure('Склады (stores)', stores)
  }

  // 5. Discounts
  const discounts = await apiGet(baseUrl, key, '/resto/api/corporation/discounts', 'Discounts')
  if (discounts) {
    results.discounts = discounts
    save('discounts.json', discounts)
    printStructure('Скидки (discounts)', discounts)
  }

  // 6. Nomenclature — берём первый активный department
  let firstDeptId = null
  if (Array.isArray(departments)) {
    const active = departments.find((d) => !d.isDeleted && (d.type === 'DEPARTMENT' || d.type === 'RESTAURANT'))
    firstDeptId = active?.id ?? departments[0]?.id
  }

  if (firstDeptId) {
    console.log(`\n📍 Запрашиваем номенклатуру для departmentId: ${firstDeptId}`)
    const nomenclature = await apiGet(
      baseUrl,
      key,
      `/resto/api/nomenclature?departmentId=${firstDeptId}`,
      'Nomenclature',
    )
    if (nomenclature) {
      results.nomenclature = nomenclature
      save('nomenclature.json', nomenclature)

      // Номенклатура обычно имеет структуру { products: [...], groups: [...] }
      if (nomenclature.products || nomenclature.groups) {
        console.log(`\n${'─'.repeat(60)}`)
        console.log('📦 Номенклатура (nomenclature)')
        console.log('─'.repeat(60))
        if (nomenclature.groups) {
          console.log(`  Групп: ${nomenclature.groups.length}`)
          if (nomenclature.groups[0]) {
            console.log('  Пример группы:')
            printFields(nomenclature.groups[0], '    ')
          }
        }
        if (nomenclature.products) {
          console.log(`  Позиций: ${nomenclature.products.length}`)
          if (nomenclature.products[0]) {
            console.log('  Пример позиции:')
            printFields(nomenclature.products[0], '    ')
          }
        }
      } else {
        printStructure('Номенклатура (nomenclature)', nomenclature)
      }
    }
  } else {
    console.log('\n⚠️  Не найден активный департамент для запроса номенклатуры')
  }

  // 7. OLAP — тестовый запрос за последние 7 дней
  const today = new Date()
  const weekAgo = new Date(today)
  weekAgo.setDate(weekAgo.getDate() - 7)
  const fmt = (d) => d.toISOString().split('T')[0]

  if (firstDeptId) {
    const olapPath =
      `/resto/api/reports/olap?` +
      `department=${firstDeptId}` +
      `&dateFrom=${fmt(weekAgo)}` +
      `&dateTo=${fmt(today)}` +
      `&groupBy=OpenDate` +
      `&groupBy=PayTypes` +
      `&report=SALES`

    const olap = await apiGet(baseUrl, key, olapPath, 'OLAP')
    if (olap) {
      results.olap = olap
      save('olap-sample.json', olap)
      printStructure('OLAP отчёт (7 дней)', olap)
    }
  }

  // Итог
  console.log('\n')
  console.log('╔══════════════════════════════════════════════════════════╗')
  console.log('║                       ИТОГ                              ║')
  console.log('╠══════════════════════════════════════════════════════════╣')
  const saved = Object.keys(results)
  for (const name of saved) {
    console.log(`║  ✅ ${name.padEnd(54)}║`)
  }
  console.log('╠══════════════════════════════════════════════════════════╣')
  console.log(`║  📁 Файлы сохранены в: scripts/iiko-responses/           ║`)
  console.log('╚══════════════════════════════════════════════════════════╝')
}

main().catch((err) => {
  console.error('\n💥 Критическая ошибка:', err.message)
  process.exit(1)
})
