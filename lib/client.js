// 菜鸟课程 · 浏览器半边
//   - 左侧导航「菜鸟课程」→ 课程台主面板（/rookie-courses/ iframe）
//   - 右侧栏「菜鸟课程」标签 → 同一页面的紧凑模式，上课时自动打开
//   - 选课「开始上课」→ 在对应课程 workspace 新建会话，并把课程指令发出去
window.__ModuleLoader__.load({
  id: 'dsh-rookie-courses',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })

    const React = require('react')
    const h = React.createElement
    const PANEL = 'rookie-courses'
    const TAB = 'rookie-course'
    const SRC = '/rookie-courses/'
    const LABEL = '菜鸟课程'

    function CourseIcon(props) {
      const s = (props && props.size) || 18
      return h('svg', {
        width: s, height: s, viewBox: '0 0 24 24', fill: 'none',
        stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round',
      },
      h('path', { d: 'M12 21v-7' }),
      h('path', { d: 'M12 14c0-3.9 3.1-7 7-7 0 3.9-3.1 7-7 7z' }),
      h('path', { d: 'M12 14c0-3.9-3.1-7-7-7 0 3.9 3.1 7 7 7z' }))
    }

    function apply(ctx) {
      const frames = new Set()
      let scheme = null
      const postScheme = (frame) => {
        try {
          if (scheme && frame.contentWindow) {
            frame.contentWindow.postMessage({ type: 'rookie:scheme', scheme }, location.origin)
          }
        } catch {}
      }
      ctx.inject(['theme'], (c) => {
        const push = (snap) => { scheme = snap?.active?.colorScheme || null; frames.forEach(postScheme) }
        try { push(c.theme.getTheme()) } catch {}
        try { c.on('theme/change', push) } catch {}
      })

      const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
      async function waitBinding(id, timeoutMs) {
        const until = Date.now() + timeoutMs
        while (Date.now() < until) {
          try {
            const binding = ctx.sessions.binding(id)
            if (binding && binding.session) return binding
          } catch {}
          await sleep(100)
        }
        return undefined
      }

      const pathKey = (value) => String(value || '')
        .replace(/^\/private\/tmp\//, '/tmp/')
        .replace(/\/+$/, '')
      function findWorkspace(dir) {
        const items = ctx.workspaces.list.getSnapshot().items || []
        const want = pathKey(dir)
        return items.find((w) => pathKey(w.path) === want)
      }

      async function ensureWorkspace(course) {
        const existing = findWorkspace(course.dir)
        if (existing) return existing
        const created = await ctx.workspaces.create({ path: course.dir })
        const workspace = created && created.ok ? created.value && created.value.workspace : created && created.value && created.value.workspace
        if (workspace && workspace.workspaceId) return workspace
        await sleep(300)
        const found = findWorkspace(course.dir)
        if (found) return found
        throw new Error(`创建课程 workspace 失败：${course.workspace}`)
      }

      function openBoard() {
        try {
          if (ctx.sidebarRight && typeof ctx.sidebarRight.openTab === 'function') ctx.sidebarRight.openTab(TAB)
        } catch (error) {
          console.warn('[rookie-courses] 打开右侧课程看板失败', error)
        }
      }

      async function fetchCourse(courseId) {
        const res = await fetch(`/rookie-courses/api/course?id=${encodeURIComponent(courseId)}`, {
          headers: { accept: 'application/json' },
        })
        const data = await res.json()
        if (!res.ok || !data.ok) throw new Error((data && data.error) || `HTTP ${res.status}`)
        return data.course
      }

      async function startCourse(courseId) {
        const course = await fetchCourse(courseId)
        if (!course || !course.dir) throw new Error(`课程没有配置目录：${courseId}`)
        localStorage.setItem('rookie.activeCourse', courseId)
        let workspaceId
        let opened = false
        try {
          const workspace = await ensureWorkspace(course)
          workspaceId = workspace.workspaceId
          const created = await ctx.sessions.create({ workspaceId })
          const id = typeof created === 'string'
            ? created
            : created && created.ok ? created.value && created.value.sessionId
            : created && created.sessionId
          if (id) {
            ctx.uiWorkspace.openSession(id)
            opened = true
            try { ctx.layout.selectPanel(null) } catch {}
            const binding = await waitBinding(id, 6000)
            if (binding && binding.session && typeof binding.session.prompt === 'function') {
              const result = await binding.session.prompt([{ type: 'text', text: course.prompts.start }], 'queue')
              if (result && result.ok === false) {
                throw new Error((result.error && result.error.message) || 'prompt rejected')
              }
              setTimeout(openBoard, 400)
              return 'sent'
            }
          }
        } catch (error) {
          if (opened) throw error
          console.warn('[rookie-courses] 直接开课失败，改用草稿模式', error)
        }
        ctx.uiWorkspace.startSession(workspaceId, { prompt: course.prompts.start, whenDraftExists: 'replace' })
        try { ctx.layout.selectPanel(null) } catch {}
        setTimeout(openBoard, 800)
        return 'draft'
      }

      function CoursePanel() {
        const ref = React.useRef(null)
        React.useEffect(() => {
          const self = ref.current
          if (self) frames.add(self)
          const onMessage = async (event) => {
            const frame = ref.current
            if (!frame || event.source !== frame.contentWindow || event.origin !== location.origin) return
            const m = event.data
            if (!m || m.type !== 'rookie:start') return
            const win = frame.contentWindow
            try {
              const mode = await startCourse(String(m.courseId || ''))
              if (win) win.postMessage({ type: 'rookie:started', mode }, location.origin)
            } catch (error) {
              console.error('[rookie-courses] 开课失败', error)
              if (win) win.postMessage({ type: 'rookie:start-failed', message: String((error && error.message) || error) }, location.origin)
            }
          }
          addEventListener('message', onMessage)
          return () => { removeEventListener('message', onMessage); if (self) frames.delete(self) }
        }, [])
        return h('iframe', {
          ref,
          src: SRC,
          title: LABEL,
          allow: 'fullscreen',
          onLoad: (e) => postScheme(e.currentTarget),
          style: { width: '100%', height: '100%', border: 0, display: 'block', background: 'transparent' },
        })
      }

      function BoardTab() {
        const ref = React.useRef(null)
        React.useEffect(() => {
          const self = ref.current
          if (self) frames.add(self)
          return () => { if (self) frames.delete(self) }
        }, [])
        return h('iframe', {
          ref,
          src: `${SRC}?embed=1`,
          title: '课程看板',
          onLoad: (e) => postScheme(e.currentTarget),
          style: { width: '100%', height: '100%', border: 0, display: 'block', background: 'transparent' },
        })
      }

      ctx.slots.inject('sidebar.panellist', () =>
        ctx.slots.register({ name: 'sidebar.panellist', id: PANEL, order: 2, label: () => LABEL }, CourseIcon))
      ctx.slots.inject('main', () => ctx.slots.register({ name: 'main', key: PANEL }, CoursePanel))

      // 右侧栏「菜鸟课程」标签：只有会话在屏上时才有意义，失败就静默跳过。
      try {
        ctx.effect(() =>
          ctx.sidebarRightTabs.register({ id: TAB, kind: TAB, title: () => LABEL }))
        ctx.effect(() => ctx.slots.register({ name: 'sidebar.right.pane.tab', key: TAB }, BoardTab))
      } catch (error) {
        console.warn('[rookie-courses] 右侧课程看板注册失败', error)
      }
    }

    exports.isPlugin = true
    exports.inject = ['slots', 'uiWorkspace', 'layout', 'sessions', 'workspaces', 'sidebarRight', 'sidebarRightTabs']
    exports.apply = apply
    return module.exports
  },
})
