const $ = (id) => document.getElementById(id)
const inFrame = window.parent !== window
const embed = new URLSearchParams(location.search).get('embed') === '1'
if (embed) document.body.classList.add('embed')

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
const pct = (c) => (c.progress && c.progress.total ? Math.round((c.progress.done / c.progress.total) * 100) : 0)
const fmtDate = (ms) => {
  if (!ms) return '—'
  const d = new Date(ms)
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}
const fmtShort = (ms) => fmtDate(ms).slice(5)
const stateLabel = (state) => (state === 'done' ? '已完成' : state === 'current' ? '进行中' : '待学')
const courseStatus = (c) => {
  if (!c.progress || !c.progress.total) return '待开课'
  if (c.progress.done >= c.progress.total) return '已完成'
  if (c.progress.done > 0) return '进行中'
  return '待开课'
}

let toastTimer = 0
function toast(text) {
  const el = $('toast')
  el.textContent = text
  el.classList.add('show')
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => el.classList.remove('show'), 4200)
}

function setAccent(color) {
  document.documentElement.style.setProperty('--course-accent', color || '#2f5bd1')
}

function rail(summary) {
  const active = location.hash.startsWith('#/course/') ? location.hash.split('/').pop() : ''
  const courses = summary ? summary.courses : []
  const items = courses.map((c, i) => {
    const count = c.progress && c.progress.total ? `${c.progress.done}/${c.progress.total}` : '待开课'
    return `<a class="nav-item ${active === c.id ? 'active' : ''}" href="#/course/${esc(c.id)}">
      <span class="nav-index">${String(i + 1).padStart(2, '0')}</span>
      <span class="nav-name">${esc(c.name)}</span>
      <span class="nav-count">${esc(count)}</span>
    </a>`
  }).join('')
  $('rail-nav').innerHTML = `
    <p class="nav-label">课程</p>
    <a class="nav-item ${active ? '' : 'active'}" href="#/">
      <span class="nav-index">00</span><span class="nav-name">概览</span><span class="nav-count">${courses.length} 门</span>
    </a>
    ${items || '<p class="nav-empty">还没有配置课程</p>'}
    <p class="nav-label">资料</p>
    <span class="nav-item" style="cursor:default;opacity:.62">
      <span class="nav-index">·</span><span class="nav-name">各课 CLAUDE.md</span>
    </span>`
  if (summary) $('rail-summary').textContent = `${summary.stats.courses} 门课 · ${summary.stats.active} 门在读`
}

function statCard(label, value, unit, cls = '') {
  return `<div class="stat"><span>${esc(label)}</span><b class="${cls}">${esc(value)}</b>${unit ? `<small>${esc(unit)}</small>` : ''}</div>`
}

function overviewPage(data) {
  const courses = data.courses
  if (!courses.length) {
    const sample = `{\n  "courses": [\n    {\n      "id": "python",\n      "name": "Python",\n      "dir": "/绝对路径/python课程笔记",\n      "parser": "python",\n      "prompt": "/python-course 继续上 Python 课…"\n    }\n  ]\n}`
    $('app').innerHTML = `
      <header class="page-head reveal">
        <p class="eyebrow">[ 菜鸟课程 · 未配置 ]</p>
        <h1>先配置课程，<br><em>再看课表。</em></h1>
        <p class="lede">没有找到课程配置。编辑下面的文件，写入至少一门课；保存后回到这里刷新即可。</p>
      </header>
      <section class="setup reveal" style="--delay:.05s">
        <p class="setup-path">${esc(data.configPath || '~/.dsh/rookie-courses.json')}</p>
        ${data.configError ? `<p class="setup-error">当前状态：${esc(data.configError)}</p>` : ''}
        <pre class="setup-code">${esc(sample)}</pre>
        <p class="setup-note">parser 可选：python / jargon / slash / cs146s。课程仓库需要有自己的 00-学习地图.md。</p>
      </section>
      <footer class="foot"><span>dsh-rookie-courses · v0.1</span><span>配置文件只读，不会写回</span></footer>`
    rail(data)
    return
  }
  const featured = [...courses].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
    .find((c) => c.progress.total && c.progress.done < c.progress.total) || courses[0]
  const cards = courses.map((c, i) => {
    return `<a class="course-card reveal" style="--accent:${esc(c.accent || '#2f5bd1')};--delay:${0.04 * i}s" href="#/course/${esc(c.id)}">
      <div class="card-top"><span class="course-index">${String(i + 1).padStart(2, '0')} / ${esc(c.id)}</span><span class="status-chip ${courseStatus(c) === '进行中' ? 'live' : ''}">${esc(courseStatus(c))}</span></div>
      <h3>${esc(c.name)}</h3>
      <p class="sub">${esc(c.subtitle)}</p>
      <div class="bar"><i style="width:${pct(c)}%"></i></div>
      <div class="card-meta"><span>${esc(c.progress.label)}</span><span>${c.noteTotal || 0} 篇笔记</span></div>
      <div class="card-next"><b>${esc(c.next.code || '—')}</b>${esc(c.next.title || '')}</div>
    </a>`
  }).join('')

  $('app').innerHTML = `
    <header class="page-head reveal">
      <p class="eyebrow">[ 菜鸟课程 · 课程台 ]</p>
      <h1>从菜鸟开始，<br><em>一门一门来。</em></h1>
      <p class="lede">四门课，四个方向：Python、编程黑话、Claude Code 斜杠命令、现代软件开发者。选一门，接着上次的进度往下。</p>
    </header>
    <section class="stats reveal" style="--delay:.05s">
      ${statCard('课程', data.stats.courses, '门')}
      ${statCard('在读', data.stats.active, '门')}
      ${statCard('笔记', data.stats.notes, '篇')}
      ${statCard('最近更新', fmtShort(data.stats.updatedAt), '', 'date')}
    </section>
    <section class="block reveal" style="--delay:.1s">
      <div class="block-head"><span class="num">01</span><h2>继续上课</h2><span class="hint">按最近更新</span></div>
      <a class="feature" href="#/course/${esc(featured.id)}">
        <div class="feature-main">
          <span class="kicker">继续 · ${esc(featured.name)}</span>
          <div class="feature-next"><b>${esc(featured.next.code || '—')}</b><span>${esc(featured.next.title || '')}</span></div>
          <p>${esc(featured.next.desc || featured.subtitle)}</p>
          <span class="btn">进入课程 →</span>
        </div>
        <div class="feature-side">
          <span class="big">${pct(featured)}<span style="font-size:18px">%</span></span>
          <span class="small">${esc(featured.progress.label)}</span>
          <span class="small">${featured.noteTotal || 0} 篇笔记</span>
        </div>
      </a>
    </section>
    <section class="block reveal" style="--delay:.16s">
      <div class="block-head"><span class="num">02</span><h2>全部课程</h2><span class="hint">点一门进去</span></div>
      <div class="course-grid">${cards}</div>
    </section>
    <footer class="foot reveal" style="--delay:.22s">
      <span>唯一进度源：各课 00-学习地图.md</span>
      <span>dsh-rookie-courses · v0.1</span>
    </footer>`
  rail(data)
}

function coursePage(course) {
  setAccent(course.accent)
  const rows = course.rows.length
    ? course.rows.map((r) => {
        const mark = r.state === 'done' ? '' : r.state === 'current' ? '进行中' : '待学'
        return `<li class="row ${r.state}">
          <span class="row-code">${esc(r.code)}</span>
          <span class="row-title" title="${esc(r.title)}">${esc(r.title)}</span>
          <span class="row-meta" title="${esc(r.meta)}">${esc(r.meta)}</span>
          <span class="row-mark">${mark}</span>
        </li>`
      }).join('')
    : '<li class="empty-state">这门课还没有开始。第一课从最常用的内容讲起，讲完在 00-学习地图.md 落下第一条记录。</li>'
  const notes = course.notes.length
    ? course.notes.map((n) => `<button class="note" type="button" data-note="${esc(n.file)}" data-course="${esc(course.id)}">
        <span class="note-date">${esc(n.date)}</span>
        <span class="note-title">${esc(n.title)}</span>
        <span class="note-range">${esc(n.range || '未标注范围')}</span>
        <span class="note-q">${n.questions ? `${n.questions} 个问答 · 点开读` : '点开读全文'}</span>
      </button>`).join('')
    : '<div class="empty-state">还没有笔记。第一课结束后落第一份。</div>'
  const status = (course.statusLine || []).map((s) => `<span>${esc(s)}</span>`).join('')

  $('app').innerHTML = `
    ${embed ? '' : '<a class="back" href="#/">← 全部课程</a>'}
    <header class="page-head course-head reveal">
      <p class="eyebrow">[ 课程 ${String((window.__overview?.courses.findIndex((c) => c.id === course.id) ?? 0) + 1).padStart(2, '0')} · ${esc(course.id)} ]</p>
      <h1>${esc(course.full)}</h1>
      <p class="lede">${esc(course.subtitle)}。${esc(course.kicker)}。</p>
      <div class="status-line">${status}</div>
    </header>
    <section class="hero reveal" style="--delay:.05s">
      <div class="next-panel">
        <div class="next-top"><span class="tag">下一节</span><span class="pill">${esc(course.progress.label)}</span></div>
        <div class="next-code">${esc(course.next.code || '—')}</div>
        <h2>${esc(course.next.title || '')}</h2>
        <p>${esc(course.next.desc || '')}</p>
        <div class="actions">
          <button class="start" type="button" data-start="${esc(course.id)}" id="start">开始上课 <span aria-hidden="true">→</span></button>
          <button class="ghost" type="button" data-guide="${esc(course.id)}">课程说明</button>
          <span class="hint">自动新建会话 · 切到课堂</span>
        </div>
      </div>
      <aside class="side-stats">
        <div><span>进度</span><b>${esc(course.progress.label)}</b></div>
        <div><span>笔记 · 篇</span><b>${course.noteTotal || 0}</b></div>
        <div><span>最近更新</span><b class="date">${esc(fmtDate(course.updatedAt))}</b></div>
      </aside>
    </section>
    <section class="block reveal" style="--delay:.1s">
      <div class="block-head"><span class="num">01</span><h2>课程进度</h2><span class="hint">按课程自己的地图</span></div>
      <ol class="rows">${rows}</ol>
    </section>
    <section class="block reveal" style="--delay:.15s">
      <div class="block-head"><span class="num">02</span><h2>课程笔记</h2><span class="hint">共 ${course.noteTotal || 0} 篇 · 点开读全文与问答</span></div>
      <div class="notes">${notes}</div>
    </section>
    <footer class="foot reveal" style="--delay:.2s">
      <span>只读看板 · 不改课程仓库</span>
      <span>${esc(course.dir)}</span>
    </footer>`
  rail(window.__overview)
}

function bindStart() {
  const btn = $('start')
  if (!btn) return
  btn.addEventListener('click', () => {
    if (!inFrame) { toast('请在 DeepSeek Harness 的「菜鸟课程」页面里开课'); return }
    const id = btn.dataset.start
    localStorage.setItem('rookie.activeCourse', id)
    btn.disabled = true
    btn.innerHTML = '正在准备课堂…'
    window.parent.postMessage({ type: 'rookie:start', courseId: id }, location.origin)
    setTimeout(() => {
      if (btn.disabled) { btn.disabled = false; btn.innerHTML = '开始上课 <span aria-hidden="true">→</span>' }
    }, 10000)
  })
}

async function fetchOverview() {
  const res = await fetch('./api/overview', { headers: { accept: 'application/json' } })
  const data = await res.json()
  if (!res.ok || !data.ok) throw new Error(data.error || `HTTP ${res.status}`)
  window.__overview = data
  return data
}

async function fetchCourse(id) {
  const res = await fetch(`./api/course?id=${encodeURIComponent(id)}`, { headers: { accept: 'application/json' } })
  const data = await res.json()
  if (!res.ok || !data.ok) throw new Error(data.error || `HTTP ${res.status}`)
  return data.course
}


function inlineMd(source) {
  let out = esc(source)
  out = out.replace(/`([^`]+)`/g, '<code>$1</code>')
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>')
  return out
}

function renderMarkdown(source) {
  const lines = String(source || '').replace(/\r\n/g, '\n').split('\n')
  const out = []
  let i = 0
  const isSpecial = (line) => /^(#{1,4})\s|^```|^>\s?|^[-*]\s+|^\d+[.)]\s+|^\|/.test(line)
  while (i < lines.length) {
    const line = lines[i]
    if (/^```/.test(line)) {
      const code = []
      i += 1
      while (i < lines.length && !/^```/.test(lines[i])) { code.push(lines[i]); i += 1 }
      i += 1
      out.push(`<pre><code>${esc(code.join('\n'))}</code></pre>`)
      continue
    }
    if (/^\|/.test(line) && i + 1 < lines.length && /^\|[\s:|-]+\|$/.test(lines[i + 1].trim())) {
      const cells = (row) => row.trim().slice(1, -1).split('|').map((c) => c.trim())
      const head = cells(line)
      i += 2
      const body = []
      while (i < lines.length && /^\|/.test(lines[i])) { body.push(cells(lines[i])); i += 1 }
      out.push(`<table><thead><tr>${head.map((c) => `<th>${inlineMd(c)}</th>`).join('')}</tr></thead><tbody>${body.map((r) => `<tr>${r.map((c) => `<td>${inlineMd(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`)
      continue
    }
    let m = line.match(/^(#{1,4})\s+(.+)$/)
    if (m) { out.push(`<h${m[1].length}>${inlineMd(m[2])}</h${m[1].length}>`); i += 1; continue }
    if (/^(-{3,}|\*{3,})\s*$/.test(line)) { out.push('<hr>'); i += 1; continue }
    if (/^>\s?/.test(line)) {
      const quote = []
      while (i < lines.length && /^>\s?/.test(lines[i])) { quote.push(lines[i].replace(/^>\s?/, '')); i += 1 }
      out.push(`<blockquote>${quote.map((q) => inlineMd(q)).join('<br>')}</blockquote>`)
      continue
    }
    if (/^[-*]\s+/.test(line)) {
      const items = []
      while (i < lines.length && /^[-*]\s+/.test(lines[i])) { items.push(inlineMd(lines[i].replace(/^[-*]\s+/, ''))); i += 1 }
      out.push(`<ul>${items.map((x) => `<li>${x}</li>`).join('')}</ul>`)
      continue
    }
    if (/^\d+[.)]\s+/.test(line)) {
      const items = []
      while (i < lines.length && /^\d+[.)]\s+/.test(lines[i])) { items.push(inlineMd(lines[i].replace(/^\d+[.)]\s+/, ''))); i += 1 }
      out.push(`<ol>${items.map((x) => `<li>${x}</li>`).join('')}</ol>`)
      continue
    }
    if (!line.trim()) { i += 1; continue }
    const para = [line]
    i += 1
    while (i < lines.length && lines[i].trim() && !isSpecial(lines[i])) { para.push(lines[i]); i += 1 }
    out.push(`<p>${para.map((p) => inlineMd(p)).join('<br>')}</p>`)
  }
  return out.join('\n')
}

let drawerOpen = false
function closeDrawer() {
  $('drawer').hidden = true
  drawerOpen = false
  document.body.style.overflow = ''
}
async function openNote(courseId, file) {
  const drawer = $('drawer')
  drawer.hidden = false
  drawerOpen = true
  document.body.style.overflow = 'hidden'
  $('drawer-kicker').textContent = '课程笔记'
  $('drawer-title').textContent = '载入中…'
  $('drawer-body').innerHTML = '<p style="color:var(--muted)">正在读笔记…</p>'
  try {
    const res = await fetch(`./api/note?id=${encodeURIComponent(courseId)}&file=${encodeURIComponent(file)}`, { headers: { accept: 'application/json' } })
    const data = await res.json()
    if (!res.ok || !data.ok) throw new Error(data.error || `HTTP ${res.status}`)
    const title = (data.markdown.match(/^#\s+(.+)$/m) || [])[1] || file
    $('drawer-title').textContent = title.replace(/^\d{4}-\d{2}-\d{2}\s*/, '')
    $('drawer-body').innerHTML = renderMarkdown(data.markdown.replace(/^#\s+.*\n/, ''))
    $('drawer-body').scrollTop = 0
  } catch (error) {
    $('drawer-body').innerHTML = `<p style="color:var(--muted)">读不到这篇笔记：${esc(error.message)}</p>`
  }
}

async function openGuide(courseId) {
  const drawer = $('drawer')
  drawer.hidden = false
  drawerOpen = true
  document.body.style.overflow = 'hidden'
  $('drawer-kicker').textContent = '课程说明'
  $('drawer-title').textContent = '载入中…'
  $('drawer-body').innerHTML = '<p style="color:var(--muted)">正在读课程说明…</p>'
  try {
    const res = await fetch(`./api/guide?id=${encodeURIComponent(courseId)}`, { headers: { accept: 'application/json' } })
    const data = await res.json()
    if (!res.ok || !data.ok) throw new Error(data.error || `HTTP ${res.status}`)
    $('drawer-title').textContent = data.name || '课程说明'
    $('drawer-body').innerHTML = renderMarkdown(data.markdown)
    $('drawer-body').scrollTop = 0
  } catch (error) {
    $('drawer-body').innerHTML = `<p style="color:var(--muted)">读不到课程说明：${esc(error.message)}</p>`
  }
}

document.addEventListener('click', (event) => {
  const guide = event.target.closest('[data-guide]')
  if (guide) { openGuide(guide.dataset.guide); return }
  const note = event.target.closest('[data-note]')
  if (note) { openNote(note.dataset.course, note.dataset.note); return }
  if (event.target.closest('[data-close]')) closeDrawer()
})
document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && drawerOpen) closeDrawer() })

async function render() {
  if (embed) {
    document.body.classList.add('embed')
    const id = new URLSearchParams(location.search).get('course') || localStorage.getItem('rookie.activeCourse')
    try {
      if (id) {
        const course = await fetchCourse(id)
        const data = await fetchOverview()
        window.__overview = data
        coursePage(course)
      } else {
        const data = await fetchOverview()
        overviewPage(data)
      }
      bindStart()
    } catch (error) {
      $('app').innerHTML = `<div class="empty-state">读不到课程数据：${esc(error.message)}</div>`
    }
    return
  }
  const m = location.hash.match(/^#\/course\/([\w-]+)/)
  try {
    if (m) {
      const course = await fetchCourse(m[1])
      const data = await fetchOverview()
      window.__overview = data
      coursePage(course)
    } else {
      const data = await fetchOverview()
      overviewPage(data)
    }
    bindStart()
  } catch (error) {
    $('app').innerHTML = `<div class="empty-state">读不到课程数据：${esc(error.message)}</div>`
  }
}

window.addEventListener('hashchange', render)
window.addEventListener('storage', (e) => { if (embed && e.key === 'rookie.activeCourse') render() })
window.addEventListener('message', (event) => {
  if (event.origin !== location.origin) return
  const m = event.data
  if (!m || typeof m.type !== 'string') return
  if (m.type === 'rookie:scheme') {
    document.documentElement.dataset.scheme = m.scheme === 'dark' ? 'dark' : 'light'
    return
  }
  if (m.type === 'rookie:started') {
    const btn = $('start')
    if (btn) { btn.innerHTML = '课堂已开始'; toast('正在切到课堂…') }
    return
  }
  if (m.type === 'rookie:start-failed') {
    const btn = $('start')
    if (btn) { btn.disabled = false; btn.innerHTML = '开始上课 <span aria-hidden="true">→</span>' }
    toast(`开课失败：${m.message || '未知错误'}`)
  }
})

if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
  document.documentElement.dataset.scheme = 'dark'
}
render()
