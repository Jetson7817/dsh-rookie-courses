// 菜鸟课程 · 课程配置与四门课的进度解析
// 课程目录来自 ~/.dsh/rookie-courses.json（或 ROOKIE_COURSES_CONFIG），
// 每门课仍然以自己的 00-学习地图.md 为唯一进度源，这里只做只读解析。
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { basename, join } from 'node:path'

export const CONFIG_PATH = process.env.ROOKIE_COURSES_CONFIG || join(homedir(), '.dsh', 'rookie-courses.json')

const PARSER_NAMES = ['python', 'jargon', 'slash', 'cs146s']

function normalizeCourse(entry, index) {
  const at = `courses[${index}]`
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) throw new Error(`${at} 必须是对象`)
  const id = String(entry.id || '').trim()
  if (!/^[a-z0-9-]+$/.test(id)) throw new Error(`${at}.id 只能用小写字母、数字和短横线`)
  const dir = String(entry.dir || '').trim()
  if (!dir.startsWith('/')) throw new Error(`${at}.dir 必须是绝对路径`)
  const parser = String(entry.parser || '').trim()
  if (!PARSER_NAMES.includes(parser)) throw new Error(`${at}.parser 必须是 ${PARSER_NAMES.join(' / ')}`)
  return {
    id,
    name: String(entry.name || id),
    full: String(entry.full || entry.name || id),
    subtitle: String(entry.subtitle || ''),
    kicker: String(entry.kicker || ''),
    dir,
    workspace: String(entry.workspace || basename(dir)),
    accent: String(entry.accent || '#2f5bd1'),
    unit: String(entry.unit || '节'),
    parser,
    prompt: String(entry.prompt || '继续上这门课。先读 00-学习地图.md 确认下一步，再按 CLAUDE.md 的约定开讲。'),
  }
}

/** Read the course config on every call so edits apply without a restart. */
export function loadCourses() {
  if (!existsSync(CONFIG_PATH)) {
    return { courses: [], configPath: CONFIG_PATH, error: 'missing-config' }
  }
  try {
    const raw = JSON.parse(readFileSync(CONFIG_PATH, 'utf8'))
    const list = Array.isArray(raw) ? raw : raw.courses
    if (!Array.isArray(list)) throw new Error('配置里需要有 courses 数组')
    if (list.length === 0) throw new Error('courses 不能是空数组')
    const seen = new Set()
    const courses = list.map((entry, index) => {
      const course = normalizeCourse(entry, index)
      if (seen.has(course.id)) throw new Error(`courses[${index}].id 重复：${course.id}`)
      seen.add(course.id)
      return course
    })
    return { courses, configPath: CONFIG_PATH, error: null }
  } catch (error) {
    return { courses: [], configPath: CONFIG_PATH, error: String(error.message || error) }
  }
}

const text = (file) => (existsSync(file) ? readFileSync(file, 'utf8') : '')
const plain = (s) => String(s ?? '')
  .replace(/\*\*/g, '')
  .replace(/`/g, '')
  .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
  .replace(/\s+/g, ' ')
  .trim()
const isDone = (s) => /\[x\]|✅|完成|已学完/i.test(s || '')
const isTodo = (s) => /\[ \]|未开始|待/.test(s || '')

function sectionsOf(raw) {
  const out = {}
  let current = null
  for (const line of raw.split('\n')) {
    const m = line.match(/^##\s+(.+?)\s*$/)
    if (m) { current = m[1]; out[current] = []; continue }
    if (current) out[current].push(line)
  }
  return out
}

function table(lines) {
  const rows = []
  for (const line of lines || []) {
    if (!/^\s*\|.*\|\s*$/.test(line)) continue
    const cells = line.trim().slice(1, -1).split('|').map((c) => c.trim())
    if (!cells.length || /^[-: ]+$/.test(cells[0])) continue
    if (/^(章|周|次|模块|日期|项|Pass)$/.test(cells[0])) continue
    rows.push(cells)
  }
  return rows
}

function noteList(dir, sub, filter, limit = 20) {
  const folder = sub === '.' ? dir : join(dir, sub)
  if (!existsSync(folder)) return { items: [], total: 0 }
  const files = readdirSync(folder)
    .filter((f) => f.endsWith('.md') && !f.startsWith('.') && (!filter || filter.test(f)))
  const items = files.map((file) => {
    const full = join(folder, file)
    const raw = text(full)
    const heading = (raw.match(/^#\s+(.+)$/m) || [])[1] || file.replace(/\.md$/, '')
    const range = (raw.match(/^范围：(.+)$/m) || [])[1] || ''
    const questions = (raw.match(/^###\s+Q\d+/gm) || []).length
    const date = (file.match(/^(\d{4}-\d{2}-\d{2})/) || [])[1] || ''
    const mtime = statSync(full).mtimeMs
    return {
      file,
      title: plain(heading).replace(/^\d{4}-\d{2}-\d{2}\s*/, ''),
      range: plain(range),
      questions,
      date: date || new Date(mtime).toISOString().slice(0, 10),
      mtime,
    }
  }).sort((a, b) => b.mtime - a.mtime)
  return { items: items.slice(0, limit), total: items.length }
}

function finish(course, data) {
  const map = join(course.dir, '00-学习地图.md')
  const noteTimes = (data.notes.items || []).map((n) => n.mtime)
  const updatedAt = data.updatedAt ?? Math.max(statSync(map).mtimeMs, ...(noteTimes.length ? noteTimes : [0]))
  const done = data.progress.done
  const total = data.progress.total
  return {
    id: course.id,
    name: course.name,
    full: course.full,
    workspace: course.workspace,
    subtitle: course.subtitle,
    kicker: course.kicker,
    dir: course.dir,
    accent: course.accent,
    unit: course.unit,
    progress: { done, total, label: total ? `${done} / ${total} ${course.unit}` : '尚未开课' },
    percent: total ? Math.round((done / total) * 100) : 0,
    next: data.next,
    rows: data.rows,
    notes: data.notes.items,
    noteTotal: data.notes.total,
    statusLine: data.statusLine,
    updatedAt,
    prompts: { start: course.prompt },
  }
}

function parsePython(course) {
  const raw = text(join(course.dir, '00-学习地图.md'))
  if (!raw) throw new Error('找不到 Python 学习地图')
  const s = sectionsOf(raw)
  const progressLines = (s['当前进度'] || []).filter((l) => /^\s*-\s+/.test(l)).map((l) => plain(l.replace(/^\s*-\s+/, '')))
  const next = plain((raw.match(/\*\*下一步：([^*]+)\*\*/) || [])[1] || '')
  const chapters = table(s['章节表']).map(([chapter, topic, status, notes]) => {
    const span = (plain(chapter).match(/^(\d+)\s*[–-]\s*(\d+)$/) || [])
    const count = span.length ? Number(span[2]) - Number(span[1]) + 1 : 1
    const state = isDone(status) ? 'done' : /进行中/.test(status) ? 'current' : 'todo'
    const date = (plain(status).match(/\d{4}-\d{2}-\d{2}/) || [])[0]
    const meta = state === 'done' ? `已学完${date ? ' · ' + date : ''}` : state === 'current' ? plain(status) : '未开始'
    return { code: plain(chapter), title: plain(topic), meta, state, count, note: plain(notes) }
  })
  const done = chapters.filter((r) => r.state === 'done').reduce((n, r) => n + r.count, 0)
  const total = chapters.reduce((n, r) => n + r.count, 0)
  const nm = next.match(/^(\d+(?:\.\d+)*)\s*(.*)$/)
  return finish(course, {
    progress: { done, total },
    next: { code: nm ? nm[1] : '', title: nm ? nm[2] : next, desc: '接着上一课的进度往下，不跳章、不提前用未学语法。' },
    rows: chapters.map((r) => ({ ...r })),
    notes: noteList(course.dir, '笔记'),
    statusLine: progressLines.slice(-2),
  })
}

function parseJargon(course) {
  const raw = text(join(course.dir, '00-学习地图.md'))
  if (!raw) throw new Error('找不到编程黑话课学习地图')
  const s = sectionsOf(raw)
  const modules = table(s['13 个模块']).map(([code, name, words, tier, status]) => ({
    code: plain(code), title: plain(name), meta: `${plain(tier)} · ${plain(words)}`, state: isDone(status) ? 'done' : 'todo', note: '',
  }))
  const passes = table(s['Pass 1 八次课']).map(([n, module, theme, doneFlag]) => ({
    code: `第 ${plain(n)} 次`, title: `${plain(module)} · ${plain(theme)}`, meta: plain(module), state: isDone(doneFlag) ? 'done' : 'todo', note: '',
  }))
  const done = passes.filter((r) => r.state === 'done').length
  const nextRow = passes.find((r) => r.state !== 'done')
  const moduleDone = modules.filter((m) => m.state === 'done').map((m) => m.code)
  const lastDate = table(s['进度记录']).map((r) => plain(r[0])).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort().pop()
  return finish(course, {
    updatedAt: lastDate ? new Date(`${lastDate}T12:00:00`).getTime() : undefined,
    progress: { done, total: passes.length },
    next: nextRow
      ? { code: String(Number(nextRow.code.replace(/\D/g, '')) || 1).padStart(2, '0'), title: nextRow.title, desc: 'Pass 1 一次课只清一小块卡顿点，先懂再记。' }
      : { code: '✓', title: 'Pass 1 已完成', desc: '可以进入 Pass 2，或按术语表随查随用。' },
    rows: passes,
    notes: noteList(course.dir, '.', /^M\d/),
    statusLine: [`Pass 1 · ${done}/8 次课`, moduleDone.length ? `已完成模块：${moduleDone.join('、')}` : '尚未开始'],
  })
}

function parseSlash(course) {
  const raw = text(join(course.dir, '00-学习地图.md'))
  if (!raw) throw new Error('找不到斜杠命令课学习地图')
  const s = sectionsOf(raw)
  const records = table(s['课程记录']).filter(([date, topic]) => !/^—$/.test(plain(date)) && !/待第一课/.test(plain(topic)))
  return finish(course, {
    progress: { done: records.length, total: records.length },
    next: { code: '01', title: '第一课', desc: '课程大纲在第一课后补齐；先选一条最常用的命令，现场演示真实输出。' },
    rows: records.map(([date, topic, note]) => ({ code: plain(date), title: plain(topic), meta: plain(note), state: 'done' })),
    notes: noteList(course.dir, '笔记'),
    statusLine: ['尚未开课', '第一课后补课程大纲'],
  })
}

function parseCs146s(course) {
  const raw = text(join(course.dir, '00-学习地图.md'))
  if (!raw) throw new Error('找不到 CS146S 学习地图')
  const s = sectionsOf(raw)
  const weeks = table(s['11 周表']).map(([week, topic, core, status, note]) => ({
    code: plain(week),
    title: plain(topic),
    meta: plain(core),
    state: /完成/.test(status) ? 'done' : /进行中/.test(status) ? 'current' : 'todo',
    note: plain(note),
  }))
  const done = weeks.filter((r) => r.state === 'done').length
  const nextRow = weeks.find((r) => r.state !== 'done')
  const nextLine = plain((raw.match(/\*\*下一步：进入 ([^*]+)\*\*/) || [])[1] || '')
  return finish(course, {
    progress: { done, total: weeks.length },
    next: nextRow
      ? { code: nextRow.code, title: nextRow.title, desc: nextRow.meta || nextLine }
      : { code: '✓', title: '全部完成', desc: '期末项目与展示。' },
    rows: weeks,
    notes: noteList(course.dir, '笔记'),
    statusLine: [`W1 已完成`, nextLine ? `下一步：${nextLine}` : '下一步：W2'],
  })
}

const PARSERS = { python: parsePython, jargon: parseJargon, slash: parseSlash, cs146s: parseCs146s }

export function readCourse(id, courses) {
  const list = courses || loadCourses().courses
  const course = list.find((c) => c.id === id)
  if (!course) return undefined
  return PARSERS[course.parser](course)
}

export function readNote(id, file) {
  const course = loadCourses().courses.find((c) => c.id === id)
  if (!course) return undefined
  const safe = basename(String(file || ''))
  if (!safe || safe !== file || !safe.endsWith('.md')) return undefined
  for (const candidate of [join(course.dir, '笔记', safe), join(course.dir, safe)]) {
    if (existsSync(candidate)) return { file: safe, markdown: readFileSync(candidate, 'utf8') }
  }
  return undefined
}

export function readOverview() {
  const loaded = loadCourses()
  const courses = loaded.courses.map((c) => {
    try {
      const d = readCourse(c.id, loaded.courses)
      return {
        id: d.id, name: d.name, full: d.full, subtitle: d.subtitle, kicker: d.kicker,
        accent: d.accent, progress: d.progress, percent: d.percent, next: d.next,
        noteTotal: d.noteTotal, updatedAt: d.updatedAt,
      }
    } catch (error) {
      return {
        id: c.id, name: c.name, full: c.full, subtitle: c.subtitle, kicker: c.kicker,
        accent: c.accent, error: String(error.message || error),
        progress: { done: 0, total: 0, label: '读取失败' }, percent: 0,
        next: { code: '!', title: '读不到课程目录', desc: c.dir }, noteTotal: 0, updatedAt: 0,
      }
    }
  })
  const active = courses.filter((c) => c.progress.total > 0 && c.progress.done < c.progress.total).length
  return {
    ok: true,
    configPath: loaded.configPath,
    configError: loaded.error,
    courses,
    stats: {
      courses: courses.length,
      active,
      notes: courses.reduce((n, c) => n + (c.noteTotal || 0), 0),
      updatedAt: courses.length ? Math.max(...courses.map((c) => c.updatedAt || 0)) : 0,
    },
  }
}
