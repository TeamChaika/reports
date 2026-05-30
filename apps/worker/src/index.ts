import { syncDepartments } from './iiko/sync-departments'
import { syncEmployees } from './iiko/sync-employees'
import { syncStores } from './iiko/sync-stores'
import { syncProducts } from './iiko/sync-products'
import { syncOlap } from './iiko/sync-olap'
import { syncRevenue } from './iiko/sync-revenue'
import { syncIikoTotals } from './iiko/sync-iiko-totals'
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

async function runOlapSync() {
  console.log(`[${new Date().toISOString()}] Starting OLAP sync...`)
  try {
    const count = await syncOlap(config)
    console.log(`  ✓ olap: ${count} rows`)
  } catch (err) {
    console.error(`  ✗ olap:`, err instanceof Error ? err.message : err)
  }
  try {
    const count = await syncRevenue()
    console.log(`  ✓ revenue: ${count} reports synced`)
  } catch (err) {
    console.error(`  ✗ revenue:`, err instanceof Error ? err.message : err)
  }
  try {
    const count = await syncIikoTotals()
    console.log(`  ✓ iiko totals: ${count} reports updated`)
  } catch (err) {
    console.error(`  ✗ iiko totals:`, err instanceof Error ? err.message : err)
  }
}

// On startup: run both immediately
await runReferenceSync()
await runOlapSync()

// Reference data: every 6 hours
setInterval(runReferenceSync, 6 * 60 * 60 * 1000)

// OLAP cache: every hour
setInterval(runOlapSync, 60 * 60 * 1000)

console.log('Worker running — reference sync every 6h, OLAP sync every 1h')
