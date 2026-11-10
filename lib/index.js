// 菜鸟课程 · Host 半边
//   GET /rookie-courses/api/overview        四门课的总览
//   GET /rookie-courses/api/course?id=xxx   单门课详情
//   /rookie-courses/*                       课程台静态页面
import { createReadStream, existsSync, realpathSync, statSync } from 'node:fs'
import { extname, join, normalize, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readCourse, readGuide, readNote, readOverview } from './courses.js'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const WEB = join(ROOT, 'web')
const BASE = '/rookie-courses'

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
}

function sendJson(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
  res.end(JSON.stringify(body))
}

function notFound(res) {
  res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' })
  res.end('not found')
}

function safeFile(dir, rel) {
  if (!dir || !rel || rel.split('/').some((p) => p.startsWith('.') || p === '')) return null
  let base
  try { base = realpathSync(dir) } catch { return null }
  const file = normalize(join(base, rel))
  if (!file.startsWith(base + sep) || !existsSync(file)) return null
  const real = realpathSync(file)
  return real.startsWith(base + sep) && statSync(real).isFile() ? real : null
}

function serveFile(req, res, file) {
  const type = MIME[extname(file).toLowerCase()] || 'application/octet-stream'
  res.writeHead(200, { 'content-type': type, 'content-length': statSync(file).size, 'cache-control': 'no-cache' })
  if (req.method === 'HEAD') return res.end()
  createReadStream(file).pipe(res)
}

export const name = 'rookie-courses'
export const inject = ['webServer']

export function apply(ctx) {
  ctx.effect(() =>
    ctx.webServer.register({
      kind: 'prefix',
      path: BASE,
      async handler(req, res) {
        if (req.method !== 'GET' && req.method !== 'HEAD') return notFound(res)
        let url
        try { url = new URL(req.url || '/', 'http://x') } catch { return notFound(res) }
        let pathname = '/'
        try { pathname = decodeURIComponent(url.pathname) } catch {}
        const rest = pathname.slice(BASE.length) || '/'
        if (rest === '/api/overview') {
          try { return sendJson(res, 200, readOverview()) }
          catch (error) { return sendJson(res, 500, { ok: false, error: String(error?.message || error) }) }
        }
        if (rest === '/api/guide') {
          const id = url.searchParams.get('id') || ''
          try {
            const guide = readGuide(id)
            if (!guide) return sendJson(res, 404, { ok: false, error: 'guide not found' })
            return sendJson(res, 200, { ok: true, ...guide })
          } catch (error) {
            return sendJson(res, 500, { ok: false, error: String(error?.message || error) })
          }
        }
        if (rest === '/api/note') {
          const id = url.searchParams.get('id') || ''
          const file = url.searchParams.get('file') || ''
          try {
            const note = readNote(id, file)
            if (!note) return sendJson(res, 404, { ok: false, error: 'note not found' })
            return sendJson(res, 200, { ok: true, ...note })
          } catch (error) {
            return sendJson(res, 500, { ok: false, error: String(error?.message || error) })
          }
        }
        if (rest === '/api/course') {
          const id = url.searchParams.get('id') || ''
          try {
            const course = readCourse(id)
            if (!course) return sendJson(res, 404, { ok: false, error: `unknown course: ${id}` })
            return sendJson(res, 200, { ok: true, course })
          } catch (error) {
            return sendJson(res, 500, { ok: false, error: String(error?.message || error) })
          }
        }
        const file = safeFile(WEB, rest === '/' ? 'index.html' : rest.slice(1))
        return file ? serveFile(req, res, file) : notFound(res)
      },
    }),
  )
}
