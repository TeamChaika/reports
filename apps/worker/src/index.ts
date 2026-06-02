import { syncDepartments } from './iiko/sync-departments'
import { syncEmployees } from './iiko/sync-employees'
import { syncStores } from './iiko/sync-stores'
import { syncProducts } from './iiko/sync-products'
import { syncCashShifts } from './iiko/sync-cashshifts'
import { syncIikoSales } from './iiko/sync-iiko-sales'
import type { IikoConfig } from './iiko/client'

const config: IikoConfig = {
  baseUrl: process.env['IIKO_BASE_URL'] ?? '',
  login: process.env['IIKO_LOGIN'] ?? '',
  password: process.env['IIKO_PASSWORD'] ?? '',
}

if (!config.baseUrl || !config.login || !config.password) {
  console.error('IIKO_BASE_URL, IIKO_LOGIN, IIKO_PASSWORD are required')
  process.exit(1)
}

async function runReferenceSync() {
  console.log(`[${new Date().toISOString()}] Starting reference sync...`)
  for (const [name, fn] of [
    ['departments', syncDepartments],
    ['stores', syncStores],
    ['employees', syncEmployees],
    ['products', syncProducts],
  ] as const) {
    try {
      const count = await fn(config)
      console.log(`  ✓ ${name}: ${count} records`)
    } catch (err) {
      console.error(`  ✗ ${name}:`, err instanceof Error ? err.message : err)
    }
  }
}

async function runLiveSync() {
  console.log(`[${new Date().toISOString()}] Starting live sync...`)
  try {
    const count = await syncCashShifts(config)
    console.log(`  ✓ cashshifts: ${count} reports updated`)
  } catch (err) {
    console.error(`  ✗ cashshifts:`, err instanceof Error ? err.message : err)
  }
  try {
    const { payTypes, hourly, summary, discounts } = await syncIikoSales(config)
    console.log(`  ✓ iiko sales: ${payTypes} pay-type, ${hourly} hourly, ${summary} summary, ${discounts} discount rows`)
  } catch (err) {
    console.error(`  ✗ iiko sales:`, err instanceof Error ? err.message : err)
  }
}

// On startup: run both immediately
await runReferenceSync()
await runLiveSync()

// Reference data: every 6 hours
setInterval(runReferenceSync, 6 * 60 * 60 * 1000)

// Live sync (cash shifts + OLAP sales): every 5 minutes
setInterval(runLiveSync, 5 * 60 * 1000)

console.log('Worker running — reference sync every 6h, live sync every 5m')
