import { readFile } from 'fs/promises'
import path from 'path'
import { NextResponse } from 'next/server'

export async function GET() {
  const svg = await readFile(path.join(process.cwd(), 'src/app/icon.svg'))
  return new NextResponse(svg, {
    headers: { 'Content-Type': 'image/svg+xml' },
  })
}
