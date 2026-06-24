(function () {
    'use strict';
    if (window.HOJToolboxV29) return;
    window.HOJToolboxV29 = 1;

    /* ── 登录跳转逻辑 ── */
    const LOGIN_HOST = 'e2api.staff.xdf.cn';
    const SUCCESS_HOST = 'oa.xdf.cn';
    const TARGET_URL = 'https://code.xdf.cn/oj';

    const host = location.hostname;

    // 情况 1：在扫码登录页，静默等待
    if (host === LOGIN_HOST || host.endsWith('.' + LOGIN_HOST)) {
        console.log('[HOJToolbox] 当前在扫码登录页，等待扫码完成...');
        return;
    }

    // 情况 2：只要进入 oa.xdf.cn（不管是 /oanew/#/guide 还是以后改成什么路径），立即跳转
    if (host === SUCCESS_HOST || host.endsWith('.' + SUCCESS_HOST)) {
        console.log('[HOJToolbox] 检测到已登录 OA（' + location.href + '），即将跳转到 OJ...');
        setTimeout(() => {
            location.replace(TARGET_URL);
        }, 500);
        return;
    }

    // 情况 3：非 code.xdf.cn 域名，脚本不激活
    if (!(host === 'code.xdf.cn' || host.endsWith('.code.xdf.cn'))) {
        console.log('[HOJToolbox] 非目标站点（' + host + '），脚本不激活');
        return;
    }



    /* ── 动态加载 markdown-it ── */
    function loadMarkdownIt(cb) {
        if (window.markdownit) { cb(); return; }
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/markdown-it@14/dist/markdown-it.min.js';
        script.onload = cb;
        script.onerror = () => {
            const s2 = document.createElement('script');
            s2.src = 'https://unpkg.com/markdown-it@14/dist/markdown-it.min.js';
            s2.onload = cb;
            document.head.appendChild(s2);
        };
        document.head.appendChild(script);
    }
    /* ── 动态加载 KaTeX ── */
    function loadKatex(cb) {
        if (window.katex) { cb(); return; }
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css';
        document.head.appendChild(link);
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js';
        script.onload = () => {
            const script2 = document.createElement('script');
            script2.src = 'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/contrib/auto-render.min.js';
            script2.onload = cb;
            document.head.appendChild(script2);
        };
        document.head.appendChild(script);
    }

    /* ── 动态加载 highlight.js ── */
    function loadHighlightJs(cb) {
        if (window.hljs) { cb(); return; }
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://cdn.jsdelivr.net/npm/highlight.js@11.9.0/styles/atom-one-light.min.css';
        document.head.appendChild(link);
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/highlight.js@11.9.0/lib/core.min.js';
        script.onload = () => {
            // 只加载常用语言包，避免体积过大
            const langs = ['cpp', 'c', 'python', 'java', 'javascript', 'bash'];
            let loaded = 0;
            langs.forEach(lang => {
                const s = document.createElement('script');
                s.src = 'https://cdn.jsdelivr.net/npm/highlight.js@11.9.0/lib/languages/' + lang + '.min.js';
                s.onload = () => {
                    loaded++;
                    if (loaded === langs.length) cb();
                };
                s.onerror = () => { loaded++; if (loaded === langs.length) cb(); };
                document.head.appendChild(s);
            });
        };
        document.head.appendChild(script);
    }
    /* ── 动态加载 CodeMirror 6（ESM 动态 import） ── */
    async function loadCodeMirror() {
        if (window._CM) return window._CM;
        const [
            { EditorState },
            { EditorView, keymap, lineNumbers, highlightActiveLineGutter,
                highlightSpecialChars, drawSelection, dropCursor,
                rectangularSelection, crosshairCursor, highlightActiveLine },
            { defaultKeymap, history, historyKeymap, indentWithTab,
                undo, redo, selectAll },
            { bracketMatching, indentOnInput, syntaxHighlighting,
                defaultHighlightStyle, foldGutter },
            { autocompletion, completionKeymap, closeBrackets,
                closeBracketsKeymap },
            { cpp },
            { python },
            { java },
            { oneDark },
        ] = await Promise.all([
            import('https://esm.sh/@codemirror/state@6'),
            import('https://esm.sh/@codemirror/view@6'),
            import('https://esm.sh/@codemirror/commands@6'),
            import('https://esm.sh/@codemirror/language@6'),
            import('https://esm.sh/@codemirror/autocomplete@6'),
            import('https://esm.sh/@codemirror/lang-cpp@6'),
            import('https://esm.sh/@codemirror/lang-python@6'),
            import('https://esm.sh/@codemirror/lang-java@6'),
            import('https://esm.sh/@codemirror/theme-one-dark@6'),
        ]);
        window._CM = {
            EditorState, EditorView, keymap, lineNumbers,
            highlightActiveLineGutter, highlightSpecialChars,
            drawSelection, dropCursor, rectangularSelection,
            crosshairCursor, highlightActiveLine,
            defaultKeymap, history, historyKeymap, indentWithTab,
            bracketMatching, indentOnInput, syntaxHighlighting,
            defaultHighlightStyle, foldGutter,
            autocompletion, completionKeymap, closeBrackets,
            closeBracketsKeymap,
            cpp, python, java, oneDark,
        };
        return window._CM;
    }


    /* ═══════════════════════════════════════════
       全局状态
    ═══════════════════════════════════════════ */
    const S = {
        targetTid: (location.href.match(/training\/(\d+)/) || [])[1] || '',
        targetCid: (location.href.match(/contest\/(\d+)/) || [])[1] || '',
        pageType: (/\/contest\/\d+/.test(location.href) ? 'contest'
            : /\/training\/\d+/.test(location.href) ? 'training' : ''),

        primaryTab: 'sync',
        secondaryTab: 'search',
        syncSourceType: 'group',
        descSourceType: 'group',
        probSourceType: 'group',
        targetGroupGid: '', 

        groups: [], trainings: [], contests: [],
        publicCategories: [], publicTrainings: [],
        publicCategoryLoaded: false,

        syncList: [],
        searchList: [],
        deleteRaw: [], deleteList: [],

        checkedSync: new Set(),
        checkedSearch: new Set(),
        checkedDelete: new Set(),

        fabX: innerWidth - 64, fabY: 88,
        open: false, busy: false, deleteLoaded: false,
        syncSourceTid: '', syncSourceCid: '',
        syncRank: false,
        currentDesc: '',
        targetName: '',    // 当前训练/比赛名称
        targetGroup: '',   // 当前所属团队名称
        manualTarget: '',
        manualTargetType: '',
        manualTargetLabel: '',
        teachManualPick: false,

        // 教学模块状态
        teach: {
            mode: '',
            problems: [],       // 题单列表
            currentProblem: null,
            currentPid: '',
            currentDisplayId: '',
            cid: '',
            tid: '',
            gid: '',
            languages: [],      // 当前题目支持的语言
            language: 'C++ With O2',
            lastSubmitId: '',
            polling: false,
            theme: 'dark',
            fontSize: 16,
            testPolling: false,
            lastTestKey: '',
            _samples: [],
        },

    };

    /* ═══════════════════════════════════════════
       工具
    ═══════════════════════════════════════════ */
    const $ = (s, p = document) => p.querySelector(s);
    const $$ = (s, p = document) => [...p.querySelectorAll(s)];
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
    const esc = s => String(s).replace(/[&<>"]/g, m =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));
    const uniq = a => { const m = new Map(); a.forEach(x => m.set(ppv(x), x)); return [...m.values()]; };
    const log = t => { const el = $('#htool-log'); if (el) el.textContent = t; };
    const ppv = p => String((p && ((p.pid != null && p.pid) || (p.id != null && p.id))) || '');
    const sid = p => String(
        p && p.displayId != null ? p.displayId :
            p && p.problemId != null ? p.problemId :
                p && p.pid != null ? p.pid :
                    p && p.id != null ? p.id : ''
    );
    const ptitle = p => p.displayTitle || p.title || p.problemName || p.name || '未命名题目';
    const studentNameCache = new Map();

    async function fetchStudentRealName(code) {
        if (!code) return '';
        if (studentNameCache.has(code)) return studentNameCache.get(code) || '';
        try {
            const res = await fetch(
                'https://gw-xeasy.xdf.cn/xeasy-srv-teachinghub/student/basic-info?studentCode=' + encodeURIComponent(code),
                { credentials: 'include' }
            );
            const j = await res.json();
            const name = j?.data?.studentName || j?.data?.studentname || '';
            studentNameCache.set(code, name || null);
            return name;
        } catch (e) {
            studentNameCache.set(code, null);
            return '';
        }
    }

    function applyRealNamesToList(sel) {
        const nodes = document.querySelectorAll(sel + ' [data-sc]');
        nodes.forEach(async n => {
            const real = await fetchStudentRealName(n.dataset.sc);
            if (real) { n.textContent = real; n.title = real + '（' + n.dataset.sc + '）'; }
        });
    }

    /* ═══════════════════════════════════════════
       Token / 请求
    ═══════════════════════════════════════════ */
    function token() {
        for (const k of ['token', 'sharding-oj-token', 'admin-token', 'vuex']) {
            const v = localStorage.getItem(k);
            if (!v) continue;
            if (k === 'vuex') {
                try { const j = JSON.parse(v); if (j.user?.token) return j.user.token; } catch (e) { }
            } else return v;
        }
        return '';
    }

    async function req(url, method = 'GET', body) {
        const h = { 'Content-Type': 'application/json' };
        const tk = token();
        if (tk) h.Authorization = tk;
        const r = await fetch(url, {
            method, headers: h, credentials: 'include',
            body: body ? JSON.stringify(body) : void 0
        });
        let j = null;
        try { j = await r.json(); } catch (e) { }
        if (j && (j.status === 200 || j.error === 0 || r.ok)) return j;
        if (r.ok && j == null) return { status: 200, data: null };
        throw new Error(j && (j.msg || j.message) || '请求失败');
    }

    async function retry(fn, n = 3, gap = 500) {
        let err;
        for (let i = 0; i < n; i++) {
            try { return await fn(); } catch (e) { err = e; }
            if (i < n - 1) await sleep(gap + i * 200);
        }
        throw err;
    }

    const pick = r => !r?.data ? [] :
        Array.isArray(r.data) ? r.data :
            Array.isArray(r.data.problemList?.records) ? r.data.problemList.records :
                Array.isArray(r.records) ? r.records : [];

    const pickList = r => !r?.data ? [] :
        Array.isArray(r.data.records) ? r.data.records :
            Array.isArray(r.data) ? r.data : [];
    function promptTrainingPassword(trainingLabel) {
        return new Promise(resolve => {
            const overlay = document.createElement('div');
            overlay.style.cssText = [
                'position:fixed;inset:0;z-index:2000001;',
                'background:rgba(15,23,42,.5);',
                'display:flex;align-items:center;justify-content:center;',
            ].join('');

            overlay.innerHTML =
                '<div style="background:#fff;border-radius:14px;padding:20px;width:340px;' +
                'max-width:calc(100vw - 24px);box-shadow:0 24px 56px rgba(15,23,42,.22);' +
                'font-family:Inter,system-ui,sans-serif;">' +
                '<div style="font-size:13px;font-weight:900;color:#0f172a;margin-bottom:6px;">训练需要密码</div>' +
                '<div style="font-size:11px;color:#64748b;margin-bottom:12px;">' +
                esc(trainingLabel || '该训练') + ' 设有访问密码，请输入后继续。</div>' +
                '<input id="htool-pwd-ipt" type="password" placeholder="请输入训练密码" ' +
                'style="width:100%;height:36px;padding:0 12px;border:1px solid rgba(148,163,184,.3);' +
                'border-radius:10px;font-size:12px;outline:none;box-sizing:border-box;margin-bottom:12px;">' +
                '<div style="display:flex;gap:8px;justify-content:flex-end;">' +
                '<button id="htool-pwd-cancel" style="height:32px;padding:0 14px;border:1px solid #e2e8f0;' +
                'border-radius:9px;background:#fff;font-size:12px;font-weight:800;cursor:pointer;color:#475569;">取消</button>' +
                '<button id="htool-pwd-ok" style="height:32px;padding:0 14px;border:none;' +
                'border-radius:9px;background:linear-gradient(135deg,#2563eb,#1d4ed8);' +
                'color:#fff;font-size:12px;font-weight:800;cursor:pointer;">确认</button>' +
                '</div>' +
                '</div>';

            document.body.appendChild(overlay);

            const ipt = overlay.querySelector('#htool-pwd-ipt');
            const ok = overlay.querySelector('#htool-pwd-ok');
            const cancel = overlay.querySelector('#htool-pwd-cancel');

            const finish = val => { overlay.remove(); resolve(val); };

            ok.onclick = () => finish(ipt.value.trim());
            cancel.onclick = () => finish(null);
            // 回车确认
            ipt.addEventListener('keydown', e => { if (e.key === 'Enter') finish(ipt.value.trim()); });
            ipt.focus();
        });
    }


    /* ═══════════════════════════════════════════
       字母编号
    ═══════════════════════════════════════════ */
    function numToLetters(n) {
        let s = ''; n = parseInt(n, 10);
        while (n > 0) { n--; s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26); }
        return s || 'A';
    }
    function lettersToNum(s) {
        s = String(s || '').trim().toUpperCase();
        if (!/^[A-Z]+$/.test(s)) return 1e9;
        let n = 0;
        for (let i = 0; i < s.length; i++) n = n * 26 + (s.charCodeAt(i) - 64);
        return n;
    }

    /* ═══════════════════════════════════════════
       API
    ═══════════════════════════════════════════ */
    // ── 团队权限检查 ──
    async function checkGroupAccess(gid) {
        const r = await req('/api/oj/get-group-access?gid=' + encodeURIComponent(gid));
        return r?.data?.access === true;
    }

    // ── 训练访问权检查（是否需要密码）──
    async function checkTrainingAccess(tid) {
        const r = await req('/api/oj/get-training-access?tid=' + encodeURIComponent(tid));
        return r?.data?.access === true;
    }

    // ── 注册训练（输入密码加入）──
    async function registerTraining(tid, password) {
        const r = await req('/api/oj/register-training', 'POST', {
            tid: String(tid), password: String(password)
        });
        // 注册成功时 status 200，失败时 req 会 throw
        return r;
    }

    async function loadGroupTrainingProblems(tid) {
        let r = await req('/api/oj/group/get-training-problem-list?tid=' + encodeURIComponent(tid) + '&limit=1000&currentPage=1');
        let d = pick(r);
        if (!d.length) {
            r = await req('/api/oj/get-training-problem-list?tid=' + encodeURIComponent(tid) + '&limit=1000&currentPage=1');
            d = pick(r);
        }
        return d;
    }

    async function getContestProblemMap(cid) {
        const r = await req('/api/oj/group/get-contest-problem-list?cid=' + encodeURIComponent(cid));

        // 先建立 pid -> problemId 的映射
        const problemIdMap = {};
        const plRecords = r?.data?.problemList?.records;
        if (Array.isArray(plRecords)) {
            plRecords.forEach(x => {
                if (x.id != null && x.problemId) {
                    problemIdMap[String(x.id)] = x.problemId;
                }
            });
        }

        if (r?.data?.contestProblemMap) {
            // 把 problemId 合并进每个条目
            const map = r.data.contestProblemMap;
            Object.keys(map).forEach(k => {
                const pid = String(map[k]?.pid ?? k);
                if (problemIdMap[pid]) map[k].problemId = problemIdMap[pid];
            });
            return map;
        }

        if (Array.isArray(r?.data?.records)) {
            const map = {};
            r.data.records.forEach((x, i) => {
                const key = String(x.pid ?? x.problemId ?? i);
                map[key] = x;
                if (problemIdMap[key]) map[key].problemId = problemIdMap[key];
            });
            return map;
        }

        return {};
    }



    async function loadContestProblems(cid) {
        let list = [];
        try {
            const r = await req('/api/oj/get-contest-problem?cid=' + encodeURIComponent(cid));
            const d = r?.data;
            if (Array.isArray(d)) list = d;
            else if (Array.isArray(d?.records)) list = d.records;
            else if (Array.isArray(d?.problemList)) list = d.problemList;
        } catch (e) { }
        const rawMap = await getContestProblemMap(cid);
        if (!list.length) {
            list = Object.keys(rawMap).map(k => {
                const item = rawMap[k] || {};
                return {
                    pid: item.pid ?? item.problemId ?? k, id: item.pid ?? item.problemId ?? k,
                    problemId: item.problemId ?? item.pid ?? k,
                    displayId: item.displayId || '',
                    displayTitle: item.displayTitle || item.title || item.problemName || item.name || ('题目' + k),
                    title: item.title || item.displayTitle || item.problemName || item.name || ('题目' + k),
                    problemName: item.problemName || item.title || item.name || ('题目' + k),
                };
            });
        } else {
            list = list.map((item, i) => {
                const pidKey = String(item.pid ?? item.id ?? item.problemId ?? i);
                const meta = rawMap[pidKey] || Object.values(rawMap).find(x =>
                    String(x.pid ?? x.problemId ?? '') === pidKey) || {};
                return {
                    ...item,
                    pid: item.pid ?? item.id ?? meta.pid ?? pidKey,
                    id: item.id ?? item.pid ?? meta.pid ?? pidKey,
                    problemId: item.problemId ?? meta.problemId ?? item.pid ?? pidKey,
                    displayId: item.displayId || meta.displayId || '',
                    displayTitle: item.displayTitle || meta.displayTitle || item.title || item.problemName || '未命名题目',
                    title: item.title || meta.title || item.problemName || '未命名题目',
                    problemName: item.problemName || item.title || '未命名题目',
                };
            });
        }
        return list.sort((a, b) => lettersToNum(a.displayId) - lettersToNum(b.displayId));
    }

    const loadPublicTrainingCategories = async () => pickList(await req('/api/oj/get-training-category'));
    const loadPublicTrainingsByCategory = async cid => pickList(await req(
        cid ? '/api/oj/get-training-list?categoryId=' + encodeURIComponent(cid) + '&limit=100000'
            : '/api/oj/get-training-list?limit=100000'
    ));
    const loadPublicTrainingProblems = async tid =>
        pick(await req('/api/oj/get-training-problem-list?tid=' + encodeURIComponent(tid)));

    const addTrainingProblem = p => req('/api/oj/group/add-training-problem-from-public', 'POST', {
        pid: parseInt(ppv(p), 10), tid: parseInt(S.targetTid, 10), displayId: sid(p)
    });
    const delTrainingProblem = p => req(
        '/api/oj/group/training-problem?pid=' + encodeURIComponent(ppv(p)) + '&tid=' + encodeURIComponent(S.targetTid), 'DELETE'
    );
    const updateTrainingProblemRank = async body => req('/api/oj/group/training-problem', 'PUT', body);
    const getTrainingDetail = async tid => req('/api/oj/get-training-detail?tid=' + encodeURIComponent(tid));
    const getGroupTraining = async tid => req('/api/oj/group/training?tid=' + encodeURIComponent(tid));
    const updateGroupTraining = async body => req('/api/oj/group/training', 'PUT', body);
    const addContestProblem = (p, displayId) => req('/api/oj/group/add-contest-problem-from-public', 'POST', {
        pid: parseInt(ppv(p), 10), cid: parseInt(S.targetCid, 10), displayId
    });
    const delContestProblem = p => req(
        '/api/oj/group/contest-problem?pid=' + encodeURIComponent(ppv(p)) + '&cid=' + encodeURIComponent(S.targetCid), 'DELETE'
    );
    const getContestInfo = async cid => req('/api/oj/get-contest-info?cid=' + encodeURIComponent(cid));

    async function getGroupContest(cid) {
        for (const u of ['/api/oj/group/contest?cid=', '/api/oj/get-contest-info?cid=']) {
            try { return await req(u + encodeURIComponent(cid)); } catch (e) { }
        }
        throw new Error('比赛信息获取失败');
    }
    const updateGroupContest = async body => req('/api/oj/group/contest', 'PUT', body);

    async function loadGroupContestsByGid(gid) {
        for (const u of [
            '/api/oj/group/get-contest-list?limit=1000&currentPage=1&gid=' + encodeURIComponent(gid),
            '/api/oj/group/get-contest-list?gid=' + encodeURIComponent(gid) + '&limit=1000&currentPage=1',
        ]) {
            try {
                const r = await req(u);
                const records = r?.data?.records;
                if (Array.isArray(records) && records.length) return records;
            } catch (e) { }
        }
        return [];
    }
    async function loadAcCode() {
        const displayId = S.teach.currentDisplayId || S.teach.currentPid;
        if (!displayId) return alert('请先从题单选择题目');
        const language = $('#htool-teach-lang')?.value || S.teach.language || 'C++ With O2';

        setBusy(true);
        log('正在获取AC代码...');
        try {
            let records = await fetchAcSubmissions(displayId, true);
            // 先找语言匹配的
            let match = records.find(r => r.language === language);
            if (!match) {
                // onlyMine 无结果或无语言匹配，改 false
                records = await fetchAcSubmissions(displayId, false);
                match = records.find(r => r.language === language);
            }
            if (!match) return alert('未找到语言为「' + language + '」的AC提交');

            const detail = await fetchTeachSubmitInfo(match.submitId);
            const code = detail?.code || detail?.submission?.code || '';
            if (!code) return alert('获取代码失败，该提交可能不公开');

            // 填入编辑器
            S.teach._cmCode = code;
            if (_cmView) {
                _cmView.dispatch({
                    changes: { from: 0, to: _cmView.state.doc.length, insert: code }
                });
            }
            log('AC代码已加载（来自：' + (match.nickname || match.username) + '）');
        } catch (e) {
            alert('获取AC代码失败：' + e.message);
            log('获取AC代码失败：' + e.message);
        } finally { setBusy(false); }
    }


    /* ═══════════════════════════════════════════
       教学模块 API
    ═══════════════════════════════════════════ */
    async function fetchAcSubmissions(problemId, onlyMine) {
        const r = await req('/api/oj/get-submission-list?onlyMine=' + onlyMine
            + '&status=0&problemID=' + encodeURIComponent(problemId)
            + '&limit=20&currentPage=1');
        return r?.data?.records || [];
    }

    // ── 团队权限检查 ──
    async function checkGroupAccess(gid) {
        const r = await req('/api/oj/get-group-access?gid=' + encodeURIComponent(gid));
        return r?.data?.access === true;
    }

    // ── 训练访问权检查（是否需要密码）──
    async function checkTrainingAccess(tid) {
        const r = await req('/api/oj/get-training-access?tid=' + encodeURIComponent(tid));
        return r?.data?.access === true;
    }

    // ── 注册训练（输入密码加入）──
    async function registerTraining(tid, password) {
        const r = await req('/api/oj/register-training', 'POST', {
            tid: String(tid), password: String(password)
        });
        // 注册成功时 status 200，失败时 req 会 throw
        return r;
    }

    async function fetchTeachProblemDetail({ mode, pid, displayId, cid, gid }) {
        if (mode === 'contest') {
            const r = await req('/api/oj/get-contest-problem-details?displayId='
                + encodeURIComponent(displayId) + '&cid=' + encodeURIComponent(cid));
            return r?.data || {};
        } else {
            if (!pid) throw new Error('训练模式需要题号 pid');
            let url = '/api/oj/get-problem-detail?problemId=' + encodeURIComponent(pid);
            if (gid) url += '&gid=' + encodeURIComponent(gid);
            const r = await req(url);
            return r?.data || {};
        }
    }


    async function fetchTeachSubmitInfo(submitId) {
        const r = await req('/api/oj/get-submission-detail?submitId=' + encodeURIComponent(submitId));
        return r?.data?.submission || {};
    }

    async function fetchAllCaseResult(submitId) {
        try {
            const r = await req('/api/oj/get-all-case-result?submitId=' + encodeURIComponent(submitId));
            return r?.data?.judgeCaseList || [];
        } catch (e) { return []; }
    }
    async function submitTestJudge(payload) {
        const r = await req('/api/oj/submit-problem-test-judge', 'POST', payload);
        // 返回结构示例：{ status:200, data: { testJudgeKey: "TEST_JUDGE_xxx" } }
        const key = r?.data?.testJudgeKey ?? r?.data?.key ?? r?.data;
        if (!key || typeof key !== 'string' || !key.startsWith('TEST_JUDGE')) {
            throw new Error('自测未返回 testJudgeKey，返回：' + JSON.stringify(r?.data));
        }
        return key;
    }
    async function pollTestResult(key) {
        const resultEl = $('#htool-test-result');
        S.teach.testPolling = true;
        const RUNNING = new Set(['6', '7', '9', '11', '13', '14', '15']);

        for (let i = 0; i < 30; i++) {
            await sleep(1000);
            try {
                const d = await fetchTestJudgeResult(key);
                const status = String(d.status ?? '');
                const isRunning = RUNNING.has(status);
                const isAC = status === '0';

                // 比对输出是否一致（去除末尾空白）
                const userOut = String(d.userOutput ?? '').trimEnd();
                const expectOut = String(d.expectedOutput ?? '').trimEnd();
                const matched = isAC || userOut === expectOut;

                const label = isRunning ? '评测中...'
                    : matched ? '✓ 输出正确' : '✗ 输出不一致';
                const cls = isRunning ? 'running' : matched ? 'ok' : 'err';
                const memMB = d.memory != null ? (d.memory / 1024).toFixed(1) + 'MB' : '-';

                if (resultEl) {
                    resultEl.className = 'htool-teach-result ' + cls;
                    resultEl.innerHTML =
                        '<div class="htool-teach-result-head">' +
                        (isRunning ? '<span class="htool-ai-spin"></span>' : '') +
                        '<span class="htool-teach-result-status">' + esc(label) + '</span>' +
                        '<span class="htool-muted" style="margin-left:8px;">时间 ' + (d.time ?? '-') + 'ms ｜ 内存 ' + memMB + '</span>' +
                        '</div>' +
                        (!isRunning ? (
                            '<div class="htool-test-compare">' +
                            '<div class="htool-test-col">' +
                            '<div class="htool-test-col-title">你的输出</div>' +
                            '<pre class="htool-teach-pre htool-test-pre ' + (matched ? 'ok' : 'err') + '">' + esc(userOut) + '</pre>' +
                            '</div>' +
                            '<div class="htool-test-col">' +
                            '<div class="htool-test-col-title">期望输出</div>' +
                            '<pre class="htool-teach-pre htool-test-pre">' + esc(expectOut) + '</pre>' +
                            '</div>' +
                            '</div>' +
                            (d.stderr ? '<pre class="htool-teach-pre" style="margin-top:6px;color:#b91c1c;font-size:11px;max-height:80px;overflow:auto;">' + esc(d.stderr) + '</pre>' : '')
                        ) : '');
                }

                if (!isRunning) { S.teach.testPolling = false; return; }
            } catch (e) { /* 静默重试 */ }
        }

        S.teach.testPolling = false;
        if (resultEl) resultEl.innerHTML += '<div class="htool-muted" style="margin-top:4px;">自测超时</div>';
    }
    async function runTestJudge() {
        const pid = S.teach.mode === 'contest' ? S.teach.currentDisplayId : S.teach.currentPid;
        if (!pid) return alert('请先从题单选择题目');
        const code = _cmView ? _cmView.state.doc.toString() : S.teach._cmCode || '';
        if (!code.trim()) return alert('代码不能为空');

        const userInput = $('#htool-test-input')?.value ?? '';
        const expectedOutput = $('#htool-test-expected')?.value ?? '';

        const language = $('#htool-teach-lang')?.value || 'C++ With O2';

        // mode 字段：根据语言映射
        const modeMap = {
            'C++ With O2': 'text/x-c++src', 'C++': 'text/x-c++src',
            'C': 'text/x-csrc', 'Java': 'text/x-java',
            'Python3': 'text/x-python', 'Python2': 'text/x-python',
        };
        const mode = modeMap[language] || 'text/x-c++src';

        const payload = {
            pid: S.teach.mode === 'contest'
                ? S.teach.currentPid
                : parseInt(S.teach.currentPid, 10),  // 自测用数字 1524
            language, code,
            type: S.teach.mode === 'contest' ? 'contest' : 'group',
            userInput,
            expectedOutput,
            mode,
            isRemoteJudge: false,
            seconds: 0,
        };


        const resultEl = $('#htool-test-result');
        if (resultEl) {
            resultEl.className = 'htool-teach-result running';
            resultEl.innerHTML = '<span class="htool-ai-spin"></span><span>自测提交中...</span>';
        }

        setBusy(true);
        try {
            const key = await submitTestJudge(payload);
            S.teach.lastTestKey = key;
            log('自测提交成功，等待结果...');
            await pollTestResult(key);
        } catch (e) {
            if (resultEl) {
                resultEl.className = 'htool-teach-result err';
                resultEl.innerHTML = '<span>自测失败：' + esc(e.message) + '</span>';
            }
            log('自测失败：' + e.message);
        } finally { setBusy(false); }
    }


    async function fetchTestJudgeResult(key) {
        const r = await req('/api/oj/get-test-judge-result?testJudgeKey=' + encodeURIComponent(key));
        return r?.data || {};
    }


    async function submitTeachJudge(payload) {
        const r = await req('/api/oj/submit-problem-judge', 'POST', payload);
        console.log('submit response:', JSON.stringify(r));
        // 兼容多种返回结构
        const submitId = r?.data?.submitId
            ?? r?.data?.id
            ?? r?.data?.judgeId
            ?? r?.data;
        if (!submitId || submitId === 'null' || submitId === 'undefined') {
            throw new Error('提交未返回 submitId，返回：' + JSON.stringify(r?.data));
        }
        return String(submitId);
    }


    /* ── 自动加载当前页面题单 ── */
    async function autoLoadTeachProblems() {
        refreshTid();
        const holder = $('#htool-teach-list');
        const titleEl = $('#htool-teach-list-title');
        if (!holder) return;
        if (S.pageType !== 'training' && S.pageType !== 'contest') {
            holder.innerHTML = '<div class="htool-empty"><span class="htool-empty-ic">⚠</span><span class="htool-empty-tx">请在训练或比赛页面使用</span></div>';
            return;
        }
        holder.innerHTML = '<div class="htool-empty"><span class="htool-ai-spin"></span><span class="htool-empty-tx">加载题单中...</span></div>';
        try {
            let problems = [];
            if (S.pageType === 'training') {
                if (titleEl) titleEl.textContent = '训练题单';
                S.teach.mode = 'training';
                S.teach.tid = S.targetTid;
                S.teach.gid = (location.href.match(/group\/(\d+)/) || [])[1] || '';
                S.teach.cid = '';
                problems = await loadGroupTrainingProblems(S.targetTid);
            } else {
                if (titleEl) titleEl.textContent = '比赛题单';
                S.teach.mode = 'contest';
                S.teach.cid = S.targetCid;
                S.teach.tid = '';
                S.teach.gid = '';
                problems = await loadContestProblems(S.targetCid);
            }
            S.teach.problems = problems;
            renderTeachProblemList(problems);
            log('教学题单已加载：' + problems.length + ' 题');
        } catch (e) {
            holder.innerHTML = '<div class="htool-empty"><span class="htool-empty-ic">✕</span><span class="htool-empty-tx">加载失败：' + esc(e.message) + '</span></div>';
            log('教学题单加载失败：' + e.message);
        }
    }

    function renderTeachProblemList(problems) {
        const holder = $('#htool-teach-list');
        if (!holder) return;
        if (!problems.length) {
            holder.innerHTML = '<div class="htool-empty"><span class="htool-empty-ic">∅</span><span class="htool-empty-tx">暂无题目</span></div>';
            return;
        }
        holder.innerHTML = problems.map((p, i) =>
            '<div class="htool-teach-prob-item" data-i="' + i + '">' +
            '<span class="htool-teach-prob-id">' + esc(sid(p)) + '</span>' +
            '<span class="htool-teach-prob-title">' + esc(ptitle(p)) + '</span>' +
            '</div>'
        ).join('');
        $$('.htool-teach-prob-item', holder).forEach(item => {
            item.onclick = () => {
                const p = problems[+item.dataset.i];
                $$('.htool-teach-prob-item', holder).forEach(x => x.classList.remove('active'));
                item.classList.add('active');
                openTeachProblem(p);
            };
        });
    }
    async function loadProblemFromCurrentPage() {
        // 从 URL 提取 displayId，如 /oj/problem/P1003
        const match = location.href.match(/\/oj\/problem\/([A-Za-z0-9]+)/);
        if (!match) return alert('当前页面不是题目页，无法自动加载');
        const displayId = match[1];

        setBusy(true);
        log('加载当前页面题目：' + displayId + '...');
        try {
            const gid = (location.href.match(/\/group\/(\d+)/) || [])[1] || '';
            const data = await fetchTeachProblemDetail({
                mode: 'training',
                pid: displayId,
                gid,
            });

            S.teach.mode = 'training';
            S.teach.currentDisplayId = displayId;
            S.teach.currentPid = String(data?.problem?.id ?? data?.id ?? '');
            S.teach.cid = '';
            S.teach.tid = '';
            S.teach.gid = gid;
            S.teach.currentProblem = data;

            // 语言列表
            const langList = extractLanguages(data);
            S.teach.languages = langList;
            const langSel = $('#htool-teach-lang');
            if (langSel) {
                langSel.innerHTML = langList.map(l =>
                    '<option value="' + esc(l) + '"' + (l === S.teach.language ? ' selected' : '') + '>'
                    + esc(l) + '</option>'
                ).join('');
                if (!langList.includes(S.teach.language)) S.teach.language = langList[0] || 'C++ With O2';
                langSel.value = S.teach.language;
            }

            // 标题更新
            const probTitle = $('#htool-teach-prob-title');
            if (probTitle) probTitle.textContent = data?.problem?.title || displayId;
            const submitTitle = $('#htool-teach-submit-title');
            if (submitTitle) submitTitle.textContent = displayId + ' 提交代码';

            renderTeachProblemDetail(data);

            // 同步样例到自测
            const _p = data?.problem || data || {};
            const testSamples = (() => {
                try {
                    if (Array.isArray(_p.samples) && _p.samples.length) return _p.samples;
                    if (typeof _p.samples === 'string') { const parsed = JSON.parse(_p.samples); if (Array.isArray(parsed)) return parsed; }
                    if (Array.isArray(_p.examples) && _p.examples.length) return _p.examples;
                    if (typeof _p.examples === 'string') {
                        const x = parseExamplesString(_p.examples); if (x.length) return x;
                        const j = JSON.parse(_p.examples); if (Array.isArray(j)) return j;
                    }
                } catch (e) { }
                return [];
            })();
            S.teach._samples = testSamples;
            const sampleSel = $('#htool-test-sample-sel');
            if (sampleSel) {
                if (testSamples.length) {
                    sampleSel.style.display = '';
                    sampleSel.innerHTML = '<option value="">选择填充样例...</option>'
                        + testSamples.map((s, i) => '<option value="' + i + '">样例 ' + (i + 1) + '</option>').join('');
                } else {
                    sampleSel.style.display = 'none';
                }
            }

            initCodeMirror().catch(() => { });
            log('已加载题目：' + (data?.problem?.title || displayId));
        } catch (e) {
            alert('加载失败：' + e.message);
            log('加载失败：' + e.message);
        } finally { setBusy(false); }
    }

    async function openTeachProblem(p) {
        refreshTid();
        S.teachManualPick = true;
        switchSecondary('teachproblem');

        const problemWrap = $('#htool-teach-problem');
        const resultEl = $('#htool-teach-result');
        const langSel = $('#htool-teach-lang');

        if (problemWrap) {
            problemWrap.innerHTML = '<div class="htool-empty"><span class="htool-ai-spin"></span><span class="htool-empty-tx">加载题目中...</span></div>';
        }
        if (resultEl) {
            resultEl.className = 'htool-teach-result';
            resultEl.innerHTML = '<span class="htool-muted">提交后在此显示评测结果</span>';
        }

        setBusy(true);
        try {
            let data;

            if (S.pageType === 'contest') {
                // 比赛模式
                S.teach.mode = 'contest';
                S.teach.currentDisplayId = sid(p);
                S.teach.currentPid = String(p.pid ?? p.id ?? p.problemId ?? '');
                S.teach.cid = S.targetCid;
                S.teach.tid = '';
                S.teach.gid = '';

                data = await fetchTeachProblemDetail({
                    mode: 'contest',
                    displayId: S.teach.currentDisplayId,
                    cid: S.teach.cid,
                });

            } else {
                // 训练模式
                S.teach.mode = 'training';
                S.teach.currentPid = ppv(p);                    // 数字 id 1524，给自测用
                S.teach.currentDisplayId = p.displayId || sid(p); // "P1472"，给提交和题目详情用
                S.teach.cid = '';
                S.teach.tid = S.targetTid || '';
                S.teach.gid = (location.href.match(/group\/(\d+)/) || [])[1] || '';

                data = await fetchTeachProblemDetail({
                    mode: 'training',
                    pid: S.teach.currentDisplayId,  // 题目详情 API 用 "P1472"
                    gid: S.teach.gid,
                });
            }



            S.teach.currentProblem = data;

            // 提取支持语言
            const langList = extractLanguages(data);
            S.teach.languages = langList;
            if (langSel) {
                langSel.innerHTML = langList.map(l =>
                    '<option value="' + esc(l) + '"' + (l === S.teach.language ? ' selected' : '') + '>'
                    + esc(l) + '</option>'
                ).join('');
                if (!langList.includes(S.teach.language)) {
                    S.teach.language = langList[0] || 'C++ With O2';
                }
                langSel.value = S.teach.language;
            }

            // 更新题目页标题
            const probTitle = $('#htool-teach-prob-title');
            if (probTitle) {
                probTitle.textContent = (data?.problem?.title || ptitle(p) || '题目详情');
            }
            const submitTitle = $('#htool-teach-submit-title');
            if (submitTitle) {
                submitTitle.textContent = (S.teach.currentDisplayId || S.teach.currentPid || '') + ' 提交代码';
            }

            renderTeachProblemDetail(data);


            // ── 同步样例到自测页下拉框 ──
            const _p = data?.problem || data || {};   // ← 改这里，用 _p 避免冲突
            const testSamples = (() => {
                try {
                    if (Array.isArray(_p.samples) && _p.samples.length) return _p.samples;
                    if (typeof _p.samples === 'string') {
                        const parsed = JSON.parse(_p.samples);
                        if (Array.isArray(parsed) && parsed.length) return parsed;
                    }
                    if (Array.isArray(_p.examples) && _p.examples.length) return _p.examples;
                    if (typeof _p.examples === 'string') {
                        const xmlParsed = parseExamplesString(_p.examples);
                        if (xmlParsed.length) return xmlParsed;
                        const jsonParsed = JSON.parse(_p.examples);
                        if (Array.isArray(jsonParsed) && jsonParsed.length) return jsonParsed;
                    }
                } catch (e) { }
                return [];
            })();
            S.teach._samples = testSamples;
            const sampleSel = $('#htool-test-sample-sel');
            if (sampleSel) {
                if (testSamples.length) {
                    sampleSel.style.display = '';
                    sampleSel.innerHTML = '<option value="">选择填充样例...</option>'
                        + testSamples.map((s, i) => '<option value="' + i + '">样例 ' + (i + 1) + '</option>').join('');
                } else {
                    sampleSel.style.display = 'none';
                    sampleSel.innerHTML = '<option value="">无样例</option>';
                }
            }



            // 初始化/重建 CodeMirror 编辑器
            S.teach._cmCode = S.teach._cmCode || '';
            initCodeMirror().catch(() => { });


            log('题目已加载：' + (data?.problem?.title || S.teach.currentDisplayId || S.teach.currentPid));

        } catch (e) {
            if (problemWrap) {
                problemWrap.innerHTML = '<div class="htool-empty"><span class="htool-empty-ic">✕</span><span class="htool-empty-tx">加载失败：' + esc(e.message) + '</span></div>';
            }
            log('题目加载失败：' + e.message);
        } finally {
            setBusy(false);
        }
    }


    function extractLanguages(data) {
        const topLevel = data?.languages;
        if (Array.isArray(topLevel) && topLevel.length) {
            return topLevel.map(l => typeof l === 'string' ? l : (l.name || l.language || String(l))).filter(Boolean);
        }
        const p = data?.problem || data || {};
        const raw = p.languages || p.languageList || p.supportLanguages;
        if (Array.isArray(raw) && raw.length) {
            return raw.map(l => typeof l === 'string' ? l : (l.name || l.language || String(l))).filter(Boolean);
        }
        // 最终降级
        return ['C++ With O2', 'C++', 'Python3', 'Java', 'C'];
    }
    function parseExamplesString(str) {
        if (!str || typeof str !== 'string') return [];
        const results = [];
        const re = /<input>([\s\S]*?)<\/input>\s*<output>([\s\S]*?)<\/output>/g;
        let m;
        while ((m = re.exec(str)) !== null) {
            results.push({ input: m[1], output: m[2] });
        }
        return results;
    }

    function renderTeachProblemDetail(data) {
        const holder = $('#htool-teach-problem');
        if (!holder) return;
        const p = data?.problem || data || {};

        const samples = (() => {
            try {
                if (Array.isArray(p.samples) && p.samples.length) return p.samples;
                if (typeof p.samples === 'string') {
                    const parsed = JSON.parse(p.samples);
                    if (Array.isArray(parsed) && parsed.length) return parsed;
                }
                if (Array.isArray(p.examples) && p.examples.length) return p.examples;
                if (typeof p.examples === 'string') {
                    const xmlParsed = parseExamplesString(p.examples);
                    if (xmlParsed.length) return xmlParsed;
                    const jsonParsed = JSON.parse(p.examples);
                    if (Array.isArray(jsonParsed) && jsonParsed.length) return jsonParsed;
                }
            } catch (e) { }
            return [];
        })();




        const md = getMd();
        const renderMd = text => {
            if (!text || !text.trim()) return '';
            if (md) return md.render(text);
            return '<pre style="white-space:pre-wrap;font-size:12px;">'
                + text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</pre>';
        };

        let html = '';
        html += '<div class="htool-teach-prob-header">';
        html += '<div class="htool-teach-prob-name">' + esc(p.title || p.problemName || '未命名') + '</div>';
        html += '<div class="htool-teach-prob-meta">';
        if (p.timeLimit) html += '<span>时间 ' + esc(String(p.timeLimit)) + 'ms</span>';
        if (p.memoryLimit) html += '<span>内存 ' + esc(String(p.memoryLimit)) + 'MB</span>';
        if (p.score != null) html += '<span>分数 ' + esc(String(p.score)) + '</span>';
        html += '</div></div>';

        if (p.description) {
            html += '<div class="htool-teach-section">';
            html += '<div class="htool-teach-sec-title">题目描述</div>';
            html += '<div class="htool-md-preview">' + renderMd(p.description) + '</div>';
            html += '</div>';
        }
        if (p.input) {
            html += '<div class="htool-teach-section">';
            html += '<div class="htool-teach-sec-title">输入描述</div>';
            html += '<div class="htool-md-preview">' + renderMd(p.input) + '</div>';
            html += '</div>';
        }
        if (p.output) {
            html += '<div class="htool-teach-section">';
            html += '<div class="htool-teach-sec-title">输出描述</div>';
            html += '<div class="htool-md-preview">' + renderMd(p.output) + '</div>';
            html += '</div>';
        }
        if (samples.length) {
            html += '<div class="htool-teach-section">';
            html += '<div class="htool-teach-sec-title">样例</div>';
            samples.forEach((s, i) => {
                html += '<div class="htool-teach-sample">';
                html += '<div class="htool-teach-sample-label">样例 ' + (i + 1) + ' 输入</div>';
                html += '<pre class="htool-teach-pre">' + esc(String(s.input || '')) + '</pre>';
                html += '<div class="htool-teach-sample-label">样例 ' + (i + 1) + ' 输出</div>';
                html += '<pre class="htool-teach-pre">' + esc(String(s.output || '')) + '</pre>';
                html += '</div>';
            });
            html += '</div>';
        }
        if (p.hint) {
            html += '<div class="htool-teach-section">';
            html += '<div class="htool-teach-sec-title">提示</div>';
            html += '<div class="htool-md-preview">' + renderMd(p.hint) + '</div>';
            html += '</div>';
        }

        holder.innerHTML = html;
    }

    const TEACH_STATUS_MAP = {
        '-2': 'Compile Error', '-1': 'Wrong Answer', '0': 'Accepted',
        '1': 'Time Limit Exceeded', '2': 'Memory Limit Exceeded',
        '3': 'Runtime Error', '4': 'System Error', '5': 'Presentation Error',
        '6': 'Pending', '7': 'Judging', '8': 'Partial Accepted', '9': 'Submitting',
        '10': 'Submit Failed', '11': 'Pending Rejudge', '13': 'Rejudging',
        '14': 'Judging', '15': 'Queueing',
    };

    const STATUS_COLOR = {
        '0': '#047857', '-1': '#dc2626', '-2': '#7c3aed',
        '1': '#b45309', '2': '#b45309', '3': '#dc2626',
    };

    function renderCaseResults(cases) {
        if (!cases || !cases.length) return '';
        const rows = cases.map(c => {
            const st = String(c.status ?? '');
            const label = TEACH_STATUS_MAP[st] || ('状态' + st);
            const isOk = st === '0';
            const color = STATUS_COLOR[st] || '#64748b';
            const memKB = c.memory != null ? c.memory + 'KB' : '-';
            const timeMs = c.time != null ? c.time + 'ms' : '-';
            return '<div class="htool-teach-case ' + (isOk ? 'ok' : 'err') + '">' +
                '<span class="htool-teach-case-no">#' + (c.seq ?? '?') + '</span>' +
                '<span class="htool-teach-case-status" style="color:' + color + ';">' + esc(label) + '</span>' +
                '<span class="htool-teach-case-meta">' + timeMs + ' / ' + memKB + '</span>' +
                (c.score != null ? '<span class="htool-teach-case-meta">' + c.score + '分</span>' : '') +
                '</div>';
        });
        return '<div class="htool-teach-cases">' + rows.join('') + '</div>';
    }



    async function pollTeachResult(submitId) {
        const resultEl = $('#htool-teach-result');
        S.teach.polling = true;
        const RUNNING = new Set(['6', '7', '9', '11', '13', '14', '15']);

        for (let i = 0; i < 30; i++) {
            await sleep(1200);
            try {
                const sub = await fetchTeachSubmitInfo(submitId);
                const status = String(sub.status ?? sub.judgeStatus ?? '');
                const label = TEACH_STATUS_MAP[status] || ('状态 ' + status);
                const isRunning = RUNNING.has(status);
                const isAC = status === '0';
                const cls = isAC ? 'ok' : isRunning ? 'running' : 'err';
                const color = STATUS_COLOR[status] || (isRunning ? 'var(--hp)' : '#64748b');
                const memMB = sub.memory != null ? (sub.memory / 1024).toFixed(1) + 'MB' : '-';

                // 同时拉取测试点详情
                let casesHtml = '';
                if (!isRunning) {
                    const cases = await fetchAllCaseResult(submitId);
                    casesHtml = renderCaseResults(Array.isArray(cases) ? cases : (cases.caseResultList || cases.list || []));
                }

                if (resultEl) {
                    resultEl.className = 'htool-teach-result ' + cls;
                    resultEl.innerHTML =
                        '<div class="htool-teach-result-head">' +
                        (isRunning ? '<span class="htool-ai-spin"></span>' : '') +
                        '<span class="htool-teach-result-status" style="color:' + color + ';">' + esc(label) + '</span>' +
                        '<span class="htool-muted" style="margin-left:8px;">时间 ' + (sub.time ?? '-') + 'ms ｜ 内存 ' + memMB
                        + ' ｜ 分数 ' + (sub.score ?? '-') + '</span>' +
                        '</div>' +
                        (sub.errorMessage && sub.errorMessage !== 'The error message does not support viewing.'
                            ? '<pre class="htool-teach-pre" style="margin-top:6px;max-height:100px;overflow:auto;color:#b91c1c;font-size:11px;">'
                            + esc(sub.errorMessage) + '</pre>'
                            : '') +
                        casesHtml;
                }

                if (!isRunning) { S.teach.polling = false; return; }
            } catch (e) { /* 静默重试 */ }
        }

        S.teach.polling = false;
        if (resultEl) resultEl.innerHTML += '<div class="htool-muted" style="margin-top:4px;">轮询超时，请稍后查看</div>';
    }


    /* ═══════════════════════════════════════════
       比赛编号维护
    ═══════════════════════════════════════════ */
    async function normalizeContestDisplayIds() {
        if (!S.targetCid) throw new Error('未找到当前比赛 cid');
        const rawMap = await getContestProblemMap(S.targetCid);
        const list = Object.keys(rawMap).map(k => ({
            pid: String(rawMap[k]?.pid ?? rawMap[k]?.problemId ?? k),
            displayId: String(rawMap[k]?.displayId || '').toUpperCase(),
        }));
        if (!list.length) return { nextDisplayId: 'A' };
        list.sort((a, b) => {
            const d = lettersToNum(a.displayId) - lettersToNum(b.displayId);
            return d !== 0 ? d : parseInt(a.pid) - parseInt(b.pid);
        });
        for (let i = 0; i < list.length; i++) {
            const expect = numToLetters(i + 1);
            if (list[i].displayId !== expect) {
                await addContestProblem({ pid: list[i].pid }, expect);
                log('校正展示编号：' + (list[i].displayId || '∅') + ' → ' + expect);
                await sleep(150);
            }
        }
        return { nextDisplayId: numToLetters(list.length + 1) };
    }

    async function addContestProblemAutoDisplay(p) {
        if (!S.targetCid) throw new Error('未找到当前比赛 cid');
        const { nextDisplayId } = await normalizeContestDisplayIds();
        log('添加到比赛：' + sid(p) + ' → ' + nextDisplayId);
        await addContestProblem(p, nextDisplayId);
    }

    async function rebuildContestProblemsByOrder(list) {
        if (!S.targetCid) throw new Error('未找到当前比赛 cid');
        log('准备重建比赛题目顺序...');
        const currentMap = await getContestProblemMap(S.targetCid);
        const currentList = Object.keys(currentMap).map(k => ({
            pid: currentMap[k]?.pid ?? currentMap[k]?.problemId ?? k,
            displayId: currentMap[k]?.displayId || ''
        })).sort((a, b) => lettersToNum(a.displayId) - lettersToNum(b.displayId));
        for (let i = 0; i < currentList.length; i++) {
            log('删除原题目 ' + (i + 1) + '/' + currentList.length);
            await retry(() => delContestProblem({ pid: currentList[i].pid }));
            await sleep(150);
        }
        for (let i = 0; i < list.length; i++) {
            const displayId = numToLetters(i + 1);
            log('重建 ' + (i + 1) + '/' + list.length + '：' + displayId + ' ← ' + sid(list[i]));
            await retry(() => addContestProblem(list[i], displayId));
            await sleep(200);
        }
    }

    async function syncContestOrderKeepExisting(sourceList) {
        if (!sourceList.length) return;
        const currentList = await loadContestProblems(S.targetCid);
        const sourcePidSet = new Set(sourceList.map(ppv));
        const keptOld = currentList.filter(p => !sourcePidSet.has(ppv(p)));
        await rebuildContestProblemsByOrder([...keptOld, ...sourceList]);
    }

    /* ═══════════════════════════════════════════
       简介同步
    ═══════════════════════════════════════════ */
    async function syncTrainingDescription(sourceDesc) {
        if (!S.targetTid) throw new Error('未找到当前训练 tid');
        if (S.pageType !== 'training') throw new Error('只有训练页面支持同步训练简介');
        log('读取当前训练完整信息...');
        const groupRes = await retry(() => getGroupTraining(S.targetTid));
        const raw = groupRes?.data || {};
        const targetData = raw.training || raw;
        if (!targetData?.id) throw new Error('当前训练完整信息获取失败');
        const categoryId = raw.trainingCategory?.id ?? targetData.trainingCategory?.id
            ?? targetData.categoryId ?? targetData.category?.id ?? 0;
        await retry(() => updateGroupTraining({
            training: {
                id: targetData.id, title: targetData.title || '',
                description: sourceDesc,
                author: targetData.author || '', auth: targetData.auth || 'Private',
                privatePwd: targetData.privatePwd || '',
                status: typeof targetData.status === 'boolean' ? targetData.status : true,
                rank: typeof targetData.rank === 'number' ? targetData.rank : 0,
                isGroup: typeof targetData.isGroup === 'boolean' ? targetData.isGroup : true,
                gid: String(targetData.gid || ''),
                gmtCreate: targetData.gmtCreate, gmtModified: targetData.gmtModified
            },
            trainingCategory: { id: categoryId }
        }));
        return '训练简介同步成功';
    }

    async function syncContestDescription(sourceDesc) {
        if (!S.targetCid) throw new Error('未找到当前比赛 cid');
        if (S.pageType !== 'contest') throw new Error('只有比赛页面支持同步比赛简介');
        log('读取当前比赛完整信息...');
        const groupRes = await retry(() => getGroupContest(S.targetCid));
        const targetData = groupRes?.data || {};
        if (!targetData?.id) throw new Error('当前比赛完整信息获取失败');
        await retry(() => updateGroupContest({ ...targetData, description: sourceDesc }));
        return '比赛简介同步成功';
    }

    async function fetchCurrentDesc() {
        refreshTid();
        if (!S.pageType) throw new Error('请在训练页面或比赛页面运行');
        if (S.pageType === 'training') {
            if (!S.targetTid) throw new Error('未找到当前训练 tid');
            const r = await retry(() => getTrainingDetail(S.targetTid));
            return String(r?.data?.description ?? '');
        } else {
            if (!S.targetCid) throw new Error('未找到当前比赛 cid');
            const r = await retry(() => getContestInfo(S.targetCid));
            return String(r?.data?.description ?? '');
        }
    }

    /* ═══════════════════════════════════════════
       题单顺序回写
    ═══════════════════════════════════════════ */
    async function syncRanksBySourceOrder(list) {
        if (!list.length) return;
        log('等待题目写入...');
        await sleep(1200);
        let metaMap = new Map(), allFound = false;
        for (let round = 0; round < 8; round++) {
            log('读取目标题单记录...（第 ' + (round + 1) + '/8 次）');
            const res = await retry(() => req(
                '/api/oj/group/get-training-problem-list?tid=' + encodeURIComponent(S.targetTid) + '&limit=1000&currentPage=1'
            ));
            const rawMap = res?.data?.trainingProblemMap || {};
            metaMap = new Map();
            Object.keys(rawMap).forEach(k => {
                const item = rawMap[k];
                if (item?.pid != null) metaMap.set(String(item.pid), item);
            });
            allFound = list.every(src => metaMap.has(ppv(src)));
            if (allFound) break;
            await sleep(1000);
        }
        if (!allFound) {
            const miss = list.find(src => !metaMap.has(ppv(src)));
            throw new Error('目标题单中未找到题目：' + sid(miss));
        }
        for (let i = 0; i < list.length; i++) {
            const src = list[i], meta = metaMap.get(ppv(src));
            if (!meta) throw new Error('目标题单中未找到题目：' + sid(src));
            await retry(() => updateTrainingProblemRank({
                id: parseInt(meta.id, 10), tid: parseInt(meta.tid, 10), pid: parseInt(meta.pid, 10),
                displayId: meta.displayId || sid(src), rank: src._srcRank || (i + 1),
                gmtCreate: meta.gmtCreate, gmtModified: meta.gmtModified
            }));
            log('回写顺序 ' + (i + 1) + '/' + list.length + '：' + sid(src));
            await sleep(200);
        }
    }

    /* ═══════════════════════════════════════════
       setBusy / upd / render
    ═══════════════════════════════════════════ */
    function setBusy(v) {
        S.busy = v;
        $$('#htool-panel button,#htool-panel input,#htool-panel textarea').forEach(el => {
            if (el.id === 'htool-close') return;
            if (el.id === 'htool-hd-jump') return;      // ← 跳转按钮不受 busy 影响
            if (el.classList.contains('htool-ipt') || el.classList.contains('htool-textarea')) return;
            el.disabled = v;
        });
        $('#htool-panel')?.classList.toggle('busy', !!v);
    }


    function upd(list, set, el) {
        let c = 0;
        list.forEach(p => set.has(ppv(p)) && c++);
        if (el) el.textContent = c + '/' + list.length;
    }

    function render(box, list, set, cntEl, emptyIcon, emptyText) {
        emptyIcon = emptyIcon || '∅';
        emptyText = emptyText || '暂无题目';
        if (!box || !cntEl) return;
        if (!list.length) {
            box.innerHTML =
                '<div class="htool-empty">' +
                '<span class="htool-empty-ic">' + emptyIcon + '</span>' +
                '<span class="htool-empty-tx">' + emptyText + '</span>' +
                '</div>';
            cntEl.textContent = '0/0';
            return;
        }
        box.innerHTML = list.map((p, i) =>
            '<label class="htool-item">' +
            '<input type="checkbox" data-i="' + i + '"' + (set.has(ppv(p)) ? ' checked' : '') + '>' +
            '<span class="htool-pid">' + esc(sid(p)) + '</span>' +
            '<span class="htool-ptitle" title="' + esc(ptitle(p)) + '">' + esc(ptitle(p)) + '</span>' +
            '</label>'
        ).join('');
        $$('input[type=checkbox]', box).forEach(ch => ch.onchange = () => {
            const p = list[+ch.dataset.i];
            ch.checked ? set.add(ppv(p)) : set.delete(ppv(p));
            upd(list, set, cntEl);
        });
        upd(list, set, cntEl);
    }

    function renderDeleteList(box, list, set, cntEl) {
        if (!box || !cntEl) return;
        if (!list.length) {
            box.innerHTML =
                '<div class="htool-empty">' +
                '<span class="htool-empty-ic">⌫</span>' +
                '<span class="htool-empty-tx">暂无题目</span>' +
                '</div>';
            cntEl.textContent = '0/0';
            return;
        }
        const draggable = S.pageType === 'training' || S.pageType === 'contest';
        box.innerHTML = list.map((p, i) =>
            '<label class="htool-item' + (draggable ? ' htool-draggable' : '') + '"' +
            (draggable ? ' draggable="true"' : '') +
            ' data-i="' + i + '">' +
            '<input type="checkbox" data-i="' + i + '"' + (set.has(ppv(p)) ? ' checked' : '') + '>' +
            '<span class="htool-pid">' + esc(sid(p)) + '</span>' +
            '<span class="htool-ptitle" title="' + esc(ptitle(p)) + '">' + esc(ptitle(p)) + '</span>' +
            '</label>'
        ).join('');
        $$('input[type=checkbox]', box).forEach(ch => ch.onchange = () => {
            const p = list[+ch.dataset.i];
            ch.checked ? set.add(ppv(p)) : set.delete(ppv(p));
            upd(list, set, cntEl);
        });
        if (draggable) {
            let dragIdx = -1;
            $$('.htool-draggable', box).forEach(item => {
                item.addEventListener('dragstart', e => {
                    dragIdx = +item.dataset.i;
                    item.classList.add('dragging');
                    if (e.dataTransfer) e.dataTransfer.setData('text/plain', String(dragIdx));
                });
                item.addEventListener('dragend', () => {
                    item.classList.remove('dragging'); dragIdx = -1;
                    $$('.htool-draggable', box).forEach(x => x.classList.remove('drag-over'));
                });
                item.addEventListener('dragover', e => { e.preventDefault(); item.classList.add('drag-over'); });
                item.addEventListener('dragleave', () => item.classList.remove('drag-over'));
                item.addEventListener('drop', e => {
                    e.preventDefault(); item.classList.remove('drag-over');
                    const dropIdx = +item.dataset.i;
                    if (dragIdx < 0 || dragIdx === dropIdx) return;
                    const moved = S.deleteList.splice(dragIdx, 1)[0];
                    S.deleteList.splice(dropIdx, 0, moved);
                    renderDeleteList($('#htool-delete-list'), S.deleteList, S.checkedDelete, $('#htool-delete-cnt'));
                    log('已调整顺序，记得点击"保存顺序"');
                });
            });
        }
        upd(list, set, cntEl);
    }

    /* ═══════════════════════════════════════════
       makeSelect
    ═══════════════════════════════════════════ */
    function makeSelect(id, ph, onSel) {
        const box = document.getElementById(id);
        if (!box) return { list: [], value: '', setOptions() { }, getValue() { return ''; }, clear() { } };
        box.className = 'htool-select';
        box.innerHTML = '<input class="htool-ipt" type="text" placeholder="' + esc(ph) + '"><div class="htool-drop"></div>';
        const ipt = $('input', box), drop = $('.htool-drop', box);
        const api = {
            list: [], value: '',
            setOptions(arr, keep) {
                this.list = arr || [];
                if (!keep) { this.value = ''; ipt.value = ''; }
                this.render(ipt.value.trim());
            },
            render(q) {
                const kw = (q || '').toLowerCase();
                const filtered = this.list.filter(x =>
                    !kw || String(x.label).toLowerCase().includes(kw) || String(x.value).toLowerCase().includes(kw)
                );
                if (!filtered.length) { drop.innerHTML = '<div class="htool-drop-empty">无匹配</div>'; return; }
                drop.innerHTML = filtered.map((x, i) =>
                    '<div class="htool-drop-item" data-i="' + i + '" title="' + esc(x.label) + '"><span>' + esc(x.label) + '</span></div>'
                ).join('');
                $$('.htool-drop-item', drop).forEach(el => el.onclick = () => {
                    const item = filtered[+el.dataset.i];
                    api.value = item.value; ipt.value = item.label;
                    box.classList.remove('open');
                    onSel && onSel(item.value, item);
                });
            },
            getValue() { return this.value; },
            clear() { this.value = ''; ipt.value = ''; this.render(''); }
        };
        ipt.onfocus = () => { box.classList.add('open'); api.render(ipt.value.trim()); };
        ipt.oninput = () => { api.value = ''; box.classList.add('open'); api.render(ipt.value.trim()); };
        document.addEventListener('click', e => { if (!box.contains(e.target)) box.classList.remove('open'); });
        return api;
    }

    /* ═══════════════════════════════════════════
       refreshTid / updateBadge
    ═══════════════════════════════════════════ */
    function refreshTid() {
        const newTid = (location.href.match(/training\/(\d+)/) || [])[1] || '';
        const newCid = (location.href.match(/contest\/(\d+)/) || [])[1] || '';
        const newType = /\/contest\/\d+/.test(location.href) ? 'contest'
            : /\/training\/\d+/.test(location.href) ? 'training' : '';

        if (newType) {
            // ── 情况一：URL 能识别到训练/比赛页 ──
            // 若用户已手动选择了其他目标，保留，不用 URL 覆盖
            if (S.manualTarget) return;
            if (S.targetTid === newTid && S.targetCid === newCid && S.pageType === newType) return;
            S.targetTid = newTid;
            S.targetCid = newCid;
            S.pageType = newType;
        } else {
            // ── 情况二：非训练/比赛页，优先用手动选择，否则清空 ──
            if (S.manualTarget) {
                // 手动选择已存在，保持不变直接返回
                return;
            }
            if (S.pageType === '' && !S.targetTid && !S.targetCid) return;
            S.targetTid = '';
            S.targetCid = '';
            S.pageType = '';
        }

        // ── 以下只有状态真正发生变化时才执行 ──
        S.targetName = '';
        S.deleteLoaded = false;
        S.syncList = []; S.searchList = []; S.deleteRaw = []; S.deleteList = [];
        S.syncSourceTid = ''; S.syncSourceCid = '';
        S.checkedSync.clear(); S.checkedSearch.clear(); S.checkedDelete.clear();
        render($('#htool-sync-list'), [], S.checkedSync, $('#htool-sync-cnt'), '∅', '请先加载');
        render($('#htool-search-list'), [], S.checkedSearch, $('#htool-search-cnt'), '⌕', '暂无结果');
        renderDeleteList($('#htool-delete-list'), [], S.checkedDelete, $('#htool-delete-cnt'));
        fetchTargetName();
    }



    function updateBadge() {
        const badge = $('#htool-page-badge');
        if (badge) {
            let label, cls;
            if (S.manualTarget) {
                // 手动选择状态：显示名称，保持可点击以便修改
                label = S.targetName
                    ? (S.manualTargetType === 'contest' ? '比赛：' : '题单：') + S.targetName
                    : (S.manualTargetType === 'contest' ? '比赛 #' : '题单 #') + S.manualTarget;
                cls = S.manualTargetType === 'contest' ? 'contest' : 'training';
                badge.style.cursor = 'pointer';
                badge.title = '点击重新选择';
                badge.onclick = openTargetPicker;
            } else if (S.pageType) {
                // URL 自动识别
                label = S.targetName
                    ? (S.pageType === 'contest' ? '比赛：' : '训练：') + S.targetName
                    : (S.pageType === 'contest' ? '当前：比赛页' : '当前：训练页');
                cls = S.pageType;
                badge.style.cursor = 'pointer';
                badge.title = '点击切换目标训练/比赛';
                badge.onclick = openTargetPicker;
            } else {
                // 未识别，允许手动选择
                label = '点击选择训练/比赛';
                cls = 'empty';
                badge.style.cursor = 'pointer';
                badge.title = '手动选择目标训练或比赛';
                badge.onclick = openTargetPicker;
            }
            badge.textContent = label;
            badge.className = 'htool-badge ' + cls;
        }
        const rl = $('#htool-sync-rank-label');
        if (rl) rl.textContent = S.pageType === 'contest' ? '同步题目顺序' : '同步题单顺序';
        const mt = $('#htool-manage-desc-title');
        if (mt) mt.textContent = S.pageType === 'contest' ? '当前比赛简介' : '当前训练简介';
        const pt = $('#htool-manage-prob-title');
        if (pt) pt.textContent = S.pageType === 'contest' ? '比赛题单管理' : '训练题单管理';

        // 跳转按钮
        const jumpBtn = $('#htool-hd-jump');
        if (jumpBtn) {
            const tid = S.targetTid;
            const cid = S.targetCid;
            const type = S.pageType || S.manualTargetType;
            const urlGid = S.targetGroupGid || '';

            let url = '';
            if (type === 'training' && tid) {
                // 团队训练需要 gid；公共训练不需要
                url = urlGid
                    ? `/oj/group/${urlGid}/training/${tid}/problems`
                    : `/oj/training/${tid}/problems`;
            } else if (type === 'contest' && cid) {
                url = `/oj/contest/${cid}/problems`;
            }

            if (url) {
                jumpBtn.style.display = '';
                jumpBtn.onclick = () => { location.href = url; };
            } else {
                jumpBtn.style.display = 'none';
                jumpBtn.onclick = null;
            }
        }
    }


    async function fetchTargetName() {
        try {
            if (S.pageType === 'training' && S.targetTid) {
                const r = await getTrainingDetail(S.targetTid);
                S.targetName = r?.data?.title || r?.data?.name || '';
            } else if (S.pageType === 'contest' && S.targetCid) {
                const r = await getContestInfo(S.targetCid);
                S.targetName = r?.data?.title || r?.data?.name || '';
            } else {
                return;
            }
            updateBadge();
        } catch (e) { /* 静默失败，badge 降级显示 */ }
    }

    // function openTargetPicker() {
    //     // 防止重复打开
    //     if ($('#htool-picker-overlay')) return;

    //     const overlay = document.createElement('div');
    //     overlay.id = 'htool-picker-overlay';
    //     overlay.style.cssText = 'position:fixed;inset:0;z-index:2000000;background:rgba(15,23,42,.45);display:flex;align-items:center;justify-content:center;';

    //     const box = document.createElement('div');
    //     box.style.cssText = 'background:#fff;border-radius:16px;padding:20px;width:420px;max-width:calc(100vw - 24px);box-shadow:0 24px 56px rgba(15,23,42,.22);font-family:Inter,system-ui,sans-serif;';

    //     box.innerHTML = `
    //         <div style="font-size:14px;font-weight:900;color:#0f172a;margin-bottom:14px;">选择目标训练 / 比赛</div>
    //         <div style="font-size:11px;font-weight:800;color:#64748b;margin-bottom:6px;letter-spacing:.4px;text-transform:uppercase;">团队</div>
    //         <div style="display:grid;grid-template-columns:1fr auto;gap:6px;margin-bottom:12px;align-items:center;">
    //             <div id="htool-picker-group"></div>
    //             <button id="htool-picker-jump" title="在新标签页打开选中的训练/比赛" style="height:36px;padding:0 14px;border:none;border-radius:9px;background:#10b981;color:#fff;font-size:12px;font-weight:800;cursor:pointer;opacity:.4;pointer-events:none;white-space:nowrap;" disabled>↗ 跳转</button>
    //         </div>
    //         <div id="htool-picker-train-wrap" style="display:none;">
    //             <div style="font-size:11px;font-weight:800;color:#64748b;margin-bottom:6px;letter-spacing:.4px;text-transform:uppercase;">训练题单</div>
    //             <div id="htool-picker-train" style="margin-bottom:12px;"></div>
    //         </div>
    //         <div id="htool-picker-contest-wrap" style="display:none;">
    //             <div style="font-size:11px;font-weight:800;color:#64748b;margin-bottom:6px;letter-spacing:.4px;text-transform:uppercase;">比赛</div>
    //             <div id="htool-picker-contest" style="margin-bottom:12px;"></div>
    //         </div>
    //         <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:4px;">
    //             <button id="htool-picker-cancel" style="height:34px;padding:0 16px;border:1px solid #e2e8f0;border-radius:9px;background:#fff;font-size:12px;font-weight:800;cursor:pointer;color:#475569;">取消</button>
    //             <button id="htool-picker-confirm" style="height:34px;padding:0 16px;border:none;border-radius:9px;background:linear-gradient(135deg,#2563eb,#1d4ed8);color:#fff;font-size:12px;font-weight:800;cursor:pointer;" disabled>确认</button>
    //         </div>
    //     `;

    //     overlay.appendChild(box);
    //     document.body.appendChild(overlay);

    //     const close = () => overlay.remove();
    //     overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
    //     $('#htool-picker-cancel', overlay).onclick = close;

    //     // 选中状态：默认读取当前已识别/已手动选择的目标
    //     let pickedTid = S.targetTid || '';
    //     let pickedCid = S.targetCid || '';
    //     let pickedType = S.pageType || S.manualTargetType || '';
    //     let pickedLabel = S.targetName || S.manualTargetLabel || '';
    //     const confirmBtn = $('#htool-picker-confirm', overlay);
    //     const jumpBtn = $('#htool-picker-jump', overlay);
    //     // 如果当前已有目标，确认按钮直接可用
    //     if (pickedTid || pickedCid) confirmBtn.disabled = false;

    //     // 记录当前选中的团队 gid，用于构造跳转 URL
    //     let pickedGroupGid = '';

    //     function updateJumpBtn() {
    //         if ((pickedTid || pickedCid) && pickedGroupGid) {
    //             jumpBtn.disabled = false;
    //             jumpBtn.style.opacity = '1';
    //             jumpBtn.style.pointerEvents = 'auto';
    //         } else {
    //             jumpBtn.disabled = true;
    //             jumpBtn.style.opacity = '.4';
    //             jumpBtn.style.pointerEvents = 'none';
    //         }
    //     }

    //     jumpBtn.onclick = () => {
    //         if (!pickedGroupGid || (!pickedTid && !pickedCid)) return;
    //         const url = pickedTid
    //             ? `/group/${pickedGroupGid}/training/${pickedTid}`
    //             : `/group/${pickedGroupGid}/contest/${pickedCid}`;
    //         window.open(url, '_blank');
    //     };



    //     function setPicked(type, id, label) {
    //         pickedType = type; pickedCid = ''; pickedTid = '';
    //         if (type === 'training') pickedTid = id;
    //         else pickedCid = id;
    //         pickedLabel = label;
    //         confirmBtn.disabled = false;
    //         updateJumpBtn();
    //     }


    //     // 训练和比赛选择器（互斥）
    //     let selTrain = null, selContest = null;

    //     selTrain = makeSelect('htool-picker-train', '搜索训练题单', (v, item) => {
    //         if (!v) return;
    //         // 互斥：清空比赛选择
    //         if (selContest) selContest.clear();
    //         setPicked('training', v, item.label);
    //     });

    //     selContest = makeSelect('htool-picker-contest', '搜索比赛', (v, item) => {
    //         if (!v) return;
    //         // 互斥：清空训练选择
    //         if (selTrain) selTrain.clear();
    //         setPicked('contest', v, item.label);
    //     });

    //     // 团队选择器
    //     let _firstGroupLoad = true;  // 只有第一次加载团队时才自动回填
    //     const selGroup = makeSelect('htool-picker-group', '搜索团队', async v => {
    //         if (!v) return;
    //         const isFirst = _firstGroupLoad;
    //         _firstGroupLoad = false;
    //         // 换团队时重置选择（但保留类型意图，方便切换后自动匹配）
    //         if (selTrain) selTrain.clear();
    //         if (selContest) selContest.clear();
    //         pickedTid = ''; pickedCid = ''; pickedLabel = ''; pickedType = '';
    //         confirmBtn.disabled = true;
    //         pickedGroupGid = v;
    //         updateJumpBtn();

    //         $('#htool-picker-train-wrap', overlay).style.display = 'block';
    //         $('#htool-picker-contest-wrap', overlay).style.display = 'block';
    //         selTrain.setOptions([{ value: '', label: '加载中...' }]);
    //         selContest.setOptions([{ value: '', label: '加载中...' }]);

    //         let trainList = [], contestList = [];
    //         try {
    //             await loadTrainingOpts(v, selTrain);
    //             trainList = selTrain.list;
    //         } catch (e) {
    //             selTrain.setOptions([{ value: '', label: '加载失败' }]);
    //         }
    //         try {
    //             await loadContestOpts(v, selContest);
    //             contestList = selContest.list;
    //         } catch (e) {
    //             selContest.setOptions([{ value: '', label: '加载失败' }]);
    //         }

    //         // 自动回填：仅首次打开 picker 时，将当前页面目标预填入
    //         const curTid = isFirst ? S.targetTid : '';
    //         const curCid = isFirst ? S.targetCid : '';
    //         if (curTid) {

    //             const match = trainList.find(x => String(x.value) === String(curTid));
    //             if (match) {
    //                 selTrain.value = match.value;
    //                 selTrain.list.forEach((_, i) => { /* 触发渲染时 ipt 已有值 */ });
    //                 // 直接写入 input 显示值
    //                 const ipt = $('input', document.getElementById('htool-picker-train'));
    //                 if (ipt) ipt.value = match.label;
    //                 pickedTid = curTid; pickedCid = '';
    //                 pickedType = 'training'; pickedLabel = match.label;
    //                 confirmBtn.disabled = false;
    //                 updateJumpBtn();
    //             }
    //         } else if (curCid) {
    //             const match = contestList.find(x => String(x.value) === String(curCid));
    //             if (match) {
    //                 selContest.value = match.value;
    //                 const ipt = $('input', document.getElementById('htool-picker-contest'));
    //                 if (ipt) ipt.value = match.label;
    //                 pickedCid = curCid; pickedTid = '';
    //                 pickedType = 'contest'; pickedLabel = match.label;
    //                 confirmBtn.disabled = false;
    //                 updateJumpBtn();
    //             }
    //         }
    //     });


    //     // 填入已有团队列表
    //     const opts = groupOpts();
    //     if (opts.length) {
    //         selGroup.setOptions(opts);
    //     } else {
    //         selGroup.setOptions([{ value: '', label: '加载中...' }]);
    //         req('/api/oj/get-group-list?onlyMine=true&limit=100&currentPage=1').then(r => {
    //             S.groups = r?.data?.records || [];
    //             selGroup.setOptions(groupOpts());
    //         }).catch(() => selGroup.setOptions([{ value: '', label: '加载失败' }]));
    //     }

    //     confirmBtn.onclick = () => {
    //         if (!pickedTid && !pickedCid) return;

    //         // 若选的就是当前 URL 页面，让 URL 自动接管，不需要 manualTarget
    //         const urlTid = (location.href.match(/training\/(\d+)/) || [])[1] || '';
    //         const urlCid = (location.href.match(/contest\/(\d+)/) || [])[1] || '';
    //         const isSameAsUrl = (pickedTid && pickedTid === urlTid) || (pickedCid && pickedCid === urlCid);
    //         if (isSameAsUrl) {
    //             S.manualTarget = ''; S.manualTargetType = ''; S.manualTargetLabel = '';
    //         } else {
    //             S.manualTarget = pickedTid || pickedCid;
    //             S.manualTargetType = pickedType;
    //             S.manualTargetLabel = pickedLabel;
    //         }

    //         S.targetTid = pickedTid;
    //         S.targetCid = pickedCid;
    //         S.pageType = pickedType;
    //         S.targetName = pickedLabel;
    //         S.deleteLoaded = false;
    //         S.syncList = []; S.searchList = []; S.deleteRaw = []; S.deleteList = [];
    //         S.checkedSync.clear(); S.checkedSearch.clear(); S.checkedDelete.clear();
    //         render($('#htool-sync-list'), [], S.checkedSync, $('#htool-sync-cnt'), '∅', '请先加载');
    //         render($('#htool-search-list'), [], S.checkedSearch, $('#htool-search-cnt'), '⌕', '暂无结果');
    //         renderDeleteList($('#htool-delete-list'), [], S.checkedDelete, $('#htool-delete-cnt'));
    //         updateBadge();
    //         log('已手动选择：' + pickedLabel);
    //         close();
    //     };


    // }


    // 全局状态补充（在 S 对象里加）
    // manualTarget: ''     手动选择的 tid 或 cid
    // manualTargetType: '' 'training' | 'contest'
    // manualTargetLabel: '' 显示文本

    async function openTargetPicker() {
        // 再次点击则关闭
        const existing = $('#htool-target-picker');
        if (existing) { existing.remove(); return; }

        const badge = $('#htool-page-badge');
        if (!badge) return;

        const picker = document.createElement('div');
        picker.id = 'htool-target-picker';
        picker.style.cssText = [
            'position:fixed;z-index:1000002;',
            'background:#fff;border:1px solid rgba(148,163,184,.26);',
            'border-radius:14px;box-shadow:0 12px 32px rgba(15,23,42,.16);',
            'padding:14px;width:340px;',
            'font-family:Inter,system-ui,sans-serif;font-size:12px;color:#0f172a;',
        ].join('');

        const rect = badge.getBoundingClientRect();
        let left = rect.left;
        if (left + 340 > innerWidth - 8) left = innerWidth - 348;
        picker.style.left = left + 'px';
        picker.style.top = (rect.bottom + 6) + 'px';

        const currentInfo = S.manualTarget
            ? '<div style="font-size:11px;color:#2563eb;margin-bottom:8px;padding:4px 8px;background:#eff6ff;border-radius:7px;">'
            + '当前：' + esc(S.manualTargetLabel || S.manualTarget) + '</div>'
            : '';

        // ── 新增：当前 URL 页面快捷恢复 ──
        const urlTid = (location.href.match(/training\/(\d+)/) || [])[1] || '';
        const urlCid = (location.href.match(/contest\/(\d+)/) || [])[1] || '';
        const urlType = /\/contest\/\d+/.test(location.href) ? 'contest'
            : /\/training\/\d+/.test(location.href) ? 'training' : '';
        const urlInfo = urlType
            ? '<button id="htool-tp-use-url" style="' +
            'width:100%;height:32px;margin-bottom:10px;' +
            'border:1px dashed rgba(37,99,235,.35);border-radius:9px;' +
            'background:#eff6ff;color:#2563eb;' +
            'font-size:11px;font-weight:800;cursor:pointer;' +
            'display:flex;align-items:center;justify-content:center;gap:5px;">' +
            '<span>↩</span><span>使用当前页面' +
            (urlType === 'contest' ? '比赛' : '训练') +
            ' #' + (urlTid || urlCid) + '</span></button>'
            : '';

        picker.innerHTML =
            '<div style="font-size:11px;font-weight:900;color:#64748b;letter-spacing:.4px;text-transform:uppercase;margin-bottom:8px;">选择目标训练 / 比赛</div>' +
            currentInfo +
            urlInfo +
            '<div style="margin-bottom:8px;"><div id="htool-tp-group"></div></div>' +
            '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:10px;">' +
            '<div><div style="font-size:10px;font-weight:800;color:#94a3b8;margin-bottom:3px;">训练</div><div id="htool-tp-train"></div></div>' +
            '<div><div style="font-size:10px;font-weight:800;color:#94a3b8;margin-bottom:3px;">比赛</div><div id="htool-tp-contest"></div></div>' +
            '</div>' +
            '<div style="display:flex;gap:6px;">' +
            '<button id="htool-tp-confirm" style="flex:1;height:32px;border:none;border-radius:9px;background:linear-gradient(135deg,#2563eb,#1d4ed8);color:#fff;font-size:12px;font-weight:800;cursor:pointer;">确认</button>' +
            '<button id="htool-tp-cancel" style="height:32px;padding:0 14px;border:1px solid rgba(148,163,184,.26);border-radius:9px;background:#fff;color:#475569;font-size:12px;font-weight:800;cursor:pointer;">取消</button>' +
            '</div>';

        document.body.appendChild(picker);

        const closePicker = () => { const p = $('#htool-target-picker'); if (p) p.remove(); };

        // ── 新增：绑定"使用当前页面"按钮 ──
        const useUrlBtn = picker.querySelector('#htool-tp-use-url');
        if (useUrlBtn) {
            useUrlBtn.onclick = () => {
                S.manualTarget = '';
                S.manualTargetType = '';
                S.manualTargetLabel = '';
                S.targetTid = urlTid;
                S.targetCid = urlCid;
                S.pageType = urlType;
                S.targetName = '';
                S.deleteLoaded = false;
                closePicker();
                fetchTargetName();
                updateBadge();
                log('已切换回当前页面' + (urlType === 'contest' ? '比赛' : '训练') + ' #' + (urlTid || urlCid));
            };
        }

        // 点击外部关闭
        setTimeout(() => {
            document.addEventListener('click', function outsideHandler(e) {
                if (!picker.contains(e.target) && e.target !== badge) {
                    closePicker();
                    document.removeEventListener('click', outsideHandler);
                }
            });
        }, 0);

        let _tpSelectedTid = '', _tpSelectedCid = '';
        let _tpTrainLabel = '', _tpContestLabel = '', _tpGroupLabel = '';

        // 先声明，再 makeSelect（互斥需要互相引用）
        let tpSelTrain, tpSelContest;

        const tpSelGroup = makeSelect('htool-tp-group', '搜索团队', async v => {
            if (!v) return;
            _tpSelectedTid = ''; _tpSelectedCid = '';
            _tpTrainLabel = ''; _tpContestLabel = '';
            if (tpSelTrain) tpSelTrain.setOptions([{ value: '', label: '加载中...' }], true);
            if (tpSelContest) tpSelContest.setOptions([{ value: '', label: '加载中...' }], true);
            try {
                const [trainR, contestR] = await Promise.all([
                    req('/api/oj/group/get-training-list?limit=100&currentPage=1&gid=' + encodeURIComponent(v)),
                    loadGroupContestsByGid(v),
                ]);
                const trains = trainR?.data?.records || [];
                const contests = contestR || [];
                if (tpSelTrain) tpSelTrain.setOptions(trains.map(t => ({
                    value: String(t.id || t.tid || ''),
                    label: t.title || t.name || ('训练' + (t.id || t.tid || ''))
                })));
                if (tpSelContest) tpSelContest.setOptions(contests.map(c => ({
                    value: String(c.id || c.cid || ''),
                    label: c.title || c.name || ('比赛' + (c.id || c.cid || ''))
                })));
                const g = S.groups.find(x => String(x.id || x.gid || '') === v);
                _tpGroupLabel = g ? (g.name || g.groupName || g.title || '') : '';
            } catch (e) {
                if (tpSelTrain) tpSelTrain.setOptions([{ value: '', label: '加载失败' }], true);
                if (tpSelContest) tpSelContest.setOptions([{ value: '', label: '加载失败' }], true);
            }
        });

        tpSelTrain = makeSelect('htool-tp-train', '选择训练', (v, item) => {
            if (v) {
                _tpSelectedTid = v;
                _tpSelectedCid = '';
                _tpTrainLabel = item ? item.label : v;
                _tpContestLabel = '';
                if (tpSelContest) tpSelContest.clear(); // 互斥：清空比赛选择
            }
        });

        tpSelContest = makeSelect('htool-tp-contest', '选择比赛', (v, item) => {
            if (v) {
                _tpSelectedCid = v;
                _tpSelectedTid = '';
                _tpContestLabel = item ? item.label : v;
                _tpTrainLabel = '';
                if (tpSelTrain) tpSelTrain.clear(); // 互斥：清空训练选择
            }
        });

        // 如果团队数据已加载，直接填充
        if (S.groups.length) {
            tpSelGroup.setOptions(groupOpts());
        } else {
            tpSelGroup.setOptions([{ value: '', label: '加载中...' }], true);
            initGroups().then(() => { tpSelGroup.setOptions(groupOpts()); });
        }

        picker.querySelector('#htool-tp-confirm').onclick = () => {
            if (!_tpSelectedTid && !_tpSelectedCid) {
                alert('请先选择一个训练或比赛'); return;
            }
            const type = _tpSelectedTid ? 'training' : 'contest';
            const id = _tpSelectedTid || _tpSelectedCid;
            const itemLabel = _tpSelectedTid ? _tpTrainLabel : _tpContestLabel;
            const fullLabel = (_tpGroupLabel ? _tpGroupLabel + ' · ' : '') + (itemLabel || (type === 'training' ? '训练 ' : '比赛 ') + id);

            // 覆盖全局状态
            S.pageType = type;
            S.targetTid = type === 'training' ? id : '';
            S.targetCid = type === 'contest' ? id : '';
            S.targetName = itemLabel || '';
            S.targetGroup = _tpGroupLabel;
            S.targetGroupGid = tpSelGroup.getValue();
            S.manualTarget = id;
            S.manualTargetType = type;
            S.manualTargetLabel = fullLabel;
            S.deleteLoaded = false;

            closePicker();
            updateBadge();
            log('已手动指定目标：' + fullLabel);
        };

        picker.querySelector('#htool-tp-cancel').onclick = closePicker;
    }



    /* ═══════════════════════════════════════════
       视图切换
    ═══════════════════════════════════════════ */
    const SECONDARY_TABS = {
        sync: ['search', 'syncdesc', 'syncprob'],
        manage: ['managedesc', 'manageprob'],
        teach: ['teachpick', 'teachproblem', 'teachsubmit', 'teachtest', 'teachrank'],
    };
    function mirrorSelect(src, dst, dstContainerId) {
        if (!src || !dst) return;
        const v = src.getValue();
        if (!v) return;
        // 如果目标选择器选项为空或与来源不同，先同步选项列表
        if (!dst.list.length && src.list.length) {
            dst.setOptions(src.list, true);
        }
        // 只在目标当前值不同时才写入，避免触发 onSel 副作用
        if (dst.getValue() === v) return;
        dst.value = v;
        // 同步输入框显示文字
        const ipt = document.querySelector('#' + dstContainerId + ' input');
        const srcIpt = src.list.find(x => x.value === v);
        if (ipt && srcIpt) ipt.value = srcIpt.label;
    }

    function switchSecondary(tab) {
        S.secondaryTab = tab;
        $$('.htool-sub-btn', $('#htool-subnav')).forEach(b => b.classList.toggle('on', b.dataset.secondary === tab));

        $$('.htool-view').forEach(v => v.style.display = 'none');
        const el = $('#htool-view-' + tab);
        if (el) el.style.display = 'flex';
        if (tab === 'manageprob') autoLoadDelete();
        if (tab === 'managedesc') autoLoadCurrentDesc();
        if (tab === 'teachpick') autoLoadTeachProblems();
        if (tab === 'teachrank') autoLoadTeachRank(false);
        if (tab === 'teachsubmit' || tab === 'teachproblem') {
            // 野区题目页自动加载：未手动选题 且 当前无题目 且 URL 是题目页
            if (!S.teachManualPick
                && !S.teach.currentDisplayId
                && /\/oj\/problem\/[A-Za-z0-9]+/.test(location.href)) {
                loadProblemFromCurrentPage();
            }
        }


        // ── 简介↔题单 选择器互相镜像，防止切 Tab 丢失选择 ──
        if (tab === 'syncprob') {
            mirrorSelect(selDescGroup, selProbGroup, 'htool-sel-prob-group');
            mirrorSelect(selDescGroupContest, selProbGroupContest, 'htool-sel-prob-gcontest');
            mirrorSelect(selDescTrain, selProbTrain, 'htool-sel-prob-train');
            mirrorSelect(selDescContest, selProbContest, 'htool-sel-prob-contest');
            mirrorSelect(selDescPublic, selProbPublic, 'htool-sel-prob-public');
            // 同步来源类型按钮高亮
            const t = S.descSourceType;
            ['group', 'contest', 'public'].forEach(x =>
                $('#htool-probsrc-' + x)?.classList.toggle('on', x === t)
            );
            $('#htool-probsrc-group-wrap').style.display = t === 'group' ? 'grid' : 'none';
            $('#htool-probsrc-contest-wrap').style.display = t === 'contest' ? 'grid' : 'none';
            $('#htool-probsrc-public-wrap').style.display = t === 'public' ? 'grid' : 'none';
            S.probSourceType = t;
        } else if (tab === 'syncdesc') {
            mirrorSelect(selProbGroup, selDescGroup, 'htool-sel-desc-group');
            mirrorSelect(selProbGroupContest, selDescGroupContest, 'htool-sel-desc-gcontest');
            mirrorSelect(selProbTrain, selDescTrain, 'htool-sel-desc-train');
            mirrorSelect(selProbContest, selDescContest, 'htool-sel-desc-contest');
            mirrorSelect(selProbPublic, selDescPublic, 'htool-sel-desc-public');
            const t = S.probSourceType;
            ['group', 'contest', 'public'].forEach(x =>
                $('#htool-descsrc-' + x)?.classList.toggle('on', x === t)
            );
            $('#htool-descsrc-group-wrap').style.display = t === 'group' ? 'grid' : 'none';
            $('#htool-descsrc-contest-wrap').style.display = t === 'contest' ? 'grid' : 'none';
            $('#htool-descsrc-public-wrap').style.display = t === 'public' ? 'grid' : 'none';
            S.descSourceType = t;
        }

        updateBadge();
    }





    /* ═══════════════════════════════════════════
       来源切换
    ═══════════════════════════════════════════ */
    const groupOpts = () => S.groups.map(g => ({
        value: String(g.id || g.gid || ''),
        label: g.name || g.groupName || g.title || ('团队' + (g.id || g.gid || ''))
    }));

    /* ═══════════════════════════════════════════
       团队/题单/比赛列表加载
    ═══════════════════════════════════════════ */
    let selDescGroup, selDescGroupContest, selDescTrain, selDescContest, selDescCat, selDescPublic;
    let selProbGroup, selProbGroupContest, selProbTrain, selProbContest, selProbCat, selProbPublic;

    async function initGroups() {
        try {
            const r = await req('/api/oj/get-group-list?onlyMine=true&limit=100&currentPage=1');
            S.groups = r?.data?.records || [];
            const opts = groupOpts();
            selDescGroup.setOptions(opts);
            selDescGroupContest.setOptions(opts);
            selProbGroup.setOptions(opts);
            selProbGroupContest.setOptions(opts);
        } catch (e) {
            const fail = [{ value: '', label: '加载失败' }];
            [selDescGroup, selDescGroupContest, selProbGroup, selProbGroupContest].forEach(s => s.setOptions(fail));
            log('团队加载失败：' + e.message);
        }
    }

    async function loadTrainingOpts(gid, targetSel) {
        const r = await req('/api/oj/group/get-training-list?limit=100&currentPage=1&gid=' + encodeURIComponent(gid));
        S.trainings = r?.data?.records || [];
        targetSel.setOptions(S.trainings.map(t => ({
            value: String(t.id || t.tid || ''),
            label: t.title || t.name || ('题单' + (t.id || t.tid || ''))
        })));
    }

    async function loadContestOpts(gid, targetSel) {
        const records = await loadGroupContestsByGid(gid);
        S.contests = records || [];
        targetSel.setOptions(S.contests.map(c => ({
            value: String(c.id || c.cid || ''),
            label: c.title || c.name || ('比赛' + (c.id || c.cid || ''))
        })));
    }

    async function ensurePublicCategories(prefix) {
        if (S.publicCategoryLoaded) return;
        setBusy(true);
        try {
            S.publicCategories = await loadPublicTrainingCategories();
            const catOpts = [{ value: '', label: '全部' }].concat(
                S.publicCategories.map(c => ({
                    value: String(c.id || c.categoryId || ''),
                    label: c.name || c.title || c.categoryName || ('分类' + (c.id || c.categoryId || ''))
                }))
            );
            selDescCat.setOptions(catOpts);
            selProbCat.setOptions(catOpts);
            S.publicCategoryLoaded = true;
            await loadPublicTrainingOpts('');
        } catch (e) {
            [selDescCat, selProbCat].forEach(s => s.setOptions([{ value: '', label: '加载失败' }]));
            log('公共训练分类加载失败：' + e.message);
        } finally { setBusy(false); }
    }

    async function loadPublicTrainingOpts(cid) {
        const loading = [{ value: '', label: '加载中...' }];
        selDescPublic.setOptions(loading, true);
        selProbPublic.setOptions(loading, true);
        try {
            S.publicTrainings = await loadPublicTrainingsByCategory(cid);
            const opts = S.publicTrainings.map(t => ({
                value: String(t.id || t.tid || ''),
                label: t.title || t.name || ('训练' + (t.id || t.tid || ''))
            }));
            selDescPublic.setOptions(opts);
            selProbPublic.setOptions(opts);
        } catch (e) {
            [selDescPublic, selProbPublic].forEach(s => s.setOptions([{ value: '', label: '加载失败' }], true));
            log('公共训练列表加载失败：' + e.message);
        } finally { setBusy(false); }
    }

    /* ═══════════════════════════════════════════
       同步简介：加载来源 & 执行
    ═══════════════════════════════════════════ */
    async function loadDescSource() {
        refreshTid();
        setBusy(true);
        try {
            let sourceDesc = '';
            if (S.descSourceType === 'group') {
                const tid = selDescTrain.getValue();
                if (!tid) throw new Error('请先选择来源题单');
                log('读取来源训练简介...');
                const r = await retry(() => getTrainingDetail(tid));
                sourceDesc = String(r?.data?.description ?? '');
            } else if (S.descSourceType === 'contest') {
                const cid = selDescContest.getValue();
                if (!cid) throw new Error('请先选择来源比赛');
                log('读取来源比赛简介...');
                const r = await retry(() => getContestInfo(cid));
                sourceDesc = String(r?.data?.description ?? '');
            } else {
                const tid = selDescPublic.getValue();
                if (!tid) throw new Error('请先选择公共训练');
                log('读取公共训练简介...');
                const r = await retry(() => getTrainingDetail(tid));
                sourceDesc = String(r?.data?.description ?? '');
            }
            const preview = $('#htool-desc-source-preview');
            if (preview) preview.value = sourceDesc;
            log('来源简介已加载，确认后点击"同步简介"');
            window.htoolSwitchSyncDescTab('edit');
        } catch (e) {
            alert(e.message); log('加载失败：' + e.message);
        } finally { setBusy(false); }
    }


    async function runDescSync() {
        refreshTid();
        if (!S.pageType) return alert('请在训练页面或比赛页面运行');
        const preview = $('#htool-desc-source-preview');
        const sourceDesc = preview ? preview.value : '';
        if (sourceDesc === '' && !confirm('来源简介为空，确定要用空内容覆盖当前简介吗？')) return;
        if (!confirm('确定将来源简介同步到当前' + (S.pageType === 'contest' ? '比赛' : '训练') + '吗？')) return;
        setBusy(true);
        try {
            const msg = S.pageType === 'contest'
                ? await syncContestDescription(sourceDesc)
                : await syncTrainingDescription(sourceDesc);
            log(msg); alert(msg);
        } catch (e) {
            log('简介同步失败：' + e.message); alert('简介同步失败：' + e.message);
        } finally { setBusy(false); }
    }

    /* ═══════════════════════════════════════════
       同步题单：加载来源 & 执行
    ═══════════════════════════════════════════ */
    async function loadSyncProblems() {
        refreshTid();
        setBusy(true);
        try {
            let d = [], sourceTid = '', sourceCid = '';
            if (S.probSourceType === 'group') {
                const tid = selProbTrain.getValue();
                if (!tid) throw new Error('请先选择来源题单');
                sourceTid = tid;

                // ── 权限 & 密码检查 ──
                const gid = selProbGroup.getValue();
                if (gid) {
                    log('检查团队权限...');
                    const groupOk = await checkGroupAccess(gid);
                    if (!groupOk) throw new Error('暂未加入该团队，无法读取题单');
                }
                log('检查训练访问权限...');
                const trainOk = await checkTrainingAccess(tid);
                if (!trainOk) {
                    setBusy(false);
                    const trainLabel = selProbTrain.list.find(x => x.value === tid)?.label || ('训练 #' + tid);
                    const pwd = await promptTrainingPassword(trainLabel);
                    if (pwd === null) { log('已取消'); return; }
                    setBusy(true);
                    log('提交训练密码...');
                    try {
                        await registerTraining(tid, pwd);
                        log('密码验证成功，正在加载题目...');
                    } catch (e) {
                        throw new Error('密码错误或验证失败：' + e.message);
                    }
                }
                // ── 权限检查结束 ──

                d = await loadGroupTrainingProblems(tid);

            } else if (S.probSourceType === 'contest') {
                const cid = selProbContest.getValue();
                if (!cid) throw new Error('请先选择来源比赛');
                sourceCid = cid;
                d = await loadContestProblems(cid);
            } else {
                const tid = selProbPublic.getValue();
                if (!tid) throw new Error('请先选择公共训练');
                sourceTid = tid;
                d = await loadPublicTrainingProblems(tid);
            }
            if (!d.length) throw new Error('来源为空或无权限');
            S.syncSourceTid = String(sourceTid || '');
            S.syncSourceCid = String(sourceCid || '');
            S.syncList = d.map((p, i) => ({ ...p, _srcRank: i + 1 }));
            S.checkedSync = new Set(S.syncList.map(ppv));
            render($('#htool-sync-list'), S.syncList, S.checkedSync, $('#htool-sync-cnt'), '∅', '暂无题目');
            log('已加载 ' + d.length + ' 题'
                + (sourceTid ? '，tid=' + sourceTid : '')
                + (sourceCid ? '，cid=' + sourceCid : '')
                + (!S.pageType ? '；未处于训练/比赛页，暂不可同步' : ''));
        } catch (e) {
            alert(e.message); log('加载失败：' + e.message);
        } finally { setBusy(false); }
    }



    async function runSync() {
        refreshTid();
        if (!S.pageType) return alert('请在训练页面或比赛页面运行');
        const list = S.syncList.filter(p => S.checkedSync.has(ppv(p)));
        const needRank = !!$('#htool-sync-rank')?.checked;
        if (!list.length && !needRank) return alert('请至少选择一道题目，或勾选顺序同步');
        if (!S.syncList.length) return alert('请先点击「加载题目」');
        if (needRank && !list.length) return alert('勾选"同步顺序"时，至少需要选择一道题目');
        const actionText = [
            list.length ? '同步 ' + list.length + ' 道题目' : '',
            needRank ? (S.pageType === 'contest' ? '同步题目顺序' : '同步题单顺序') : ''
        ].filter(Boolean).join('，');
        if (!confirm('确定' + actionText + '到当前' + (S.pageType === 'contest' ? '比赛' : '题单') + '吗？')) return;
        setBusy(true);
        let ok = 0, bad = [], rankMsg = '';
        try {
            for (let i = 0; i < list.length; i++) {
                const p = list[i];
                log('同步 ' + (i + 1) + '/' + list.length + '：' + sid(p));
                try {
                    if (S.pageType === 'contest') {
                        await retry(() => addContestProblemAutoDisplay(p), 1, 0);
                    } else {
                        const trainingDisplayId = S.probSourceType === 'contest'
                            ? String(p.problemId ?? ppv(p))
                            : sid(p);

                        await retry(() => req('/api/oj/group/add-training-problem-from-public', 'POST', {
                            pid: parseInt(ppv(p), 10),
                            tid: parseInt(S.targetTid, 10),
                            displayId: trainingDisplayId
                        }));



                    }
                    ok++;
                } catch (e) { bad.push({ id: sid(p), reason: e.message || '未知错误' }); }
                await sleep(300);
            }

            if (needRank) {
                try {
                    const successList = list.filter(p => !bad.some(x => x.id === sid(p)));
                    if (!successList.length) { rankMsg = '顺序未同步：无成功题目'; }
                    else if (S.pageType === 'contest') {
                        await syncContestOrderKeepExisting(successList);
                        rankMsg = '比赛题目顺序同步成功';
                    } else {
                        await syncRanksBySourceOrder(successList);
                        rankMsg = '题单顺序同步成功';
                    }
                } catch (e) { rankMsg = '顺序同步失败：' + (e.message || '未知错误'); }
            }
        } finally { setBusy(false); }
        let finalMsg = '同步完成：成功 ' + ok + '，失败 ' + bad.length;
        if (rankMsg) finalMsg += '；' + rankMsg;
        log(finalMsg);
        alert(finalMsg + (bad.length ? '\n\n' + bad.slice(0, 10).map(x => '- ' + x.id + '：' + x.reason).join('\n') : ''));
    }

    /* ═══════════════════════════════════════════
       搜索题目
    ═══════════════════════════════════════════ */
    async function runSearch() {
        refreshTid();
        const raw = $('#htool-kw-search')?.value.trim();
        if (!raw) return alert('请输入搜索关键词');
        const parts = raw.split(',').map(s => s.trim()).filter(Boolean);
        const isMultiMode = parts.length > 1;
        setBusy(true);
        try {
            if (isMultiMode) {
                let allResults = [], failList = [];
                for (let i = 0; i < parts.length; i++) {
                    const kw = parts[i];
                    log('批量搜索 ' + (i + 1) + '/' + parts.length + '：' + kw);
                    try {
                        const res = await req('/api/oj/get-problem-list?keyword=' + encodeURIComponent(kw));
                        const raw = res?.data?.records || [];
                        const normalized = raw.map(p => ({
                            ...p, id: p.pid ?? p.id, pid: p.pid ?? p.id,
                            title: p.title || p.problemName || p.name || '未命名题目',
                            problemName: p.problemName || p.title || p.name || '未命名题目'
                        }));
                        const kwLower = kw.toLowerCase();
                        const exact = normalized.filter(p => sid(p).toLowerCase() === kwLower);
                        if (exact.length) {
                            allResults.push(...exact);
                        } else {
                            const related = normalized.filter(p => {
                                const id = sid(p).toLowerCase(), t = ptitle(p).toLowerCase();
                                return id.includes(kwLower) || t.includes(kwLower);
                            });
                            if (related.length) allResults.push(related[0]);
                            else failList.push(kw);
                        }
                    } catch (e) {
                        failList.push(kw);
                        log('搜索 ' + kw + ' 失败：' + e.message);
                    }
                    if (i < parts.length - 1) await sleep(120);
                }
                const kept = S.searchList.filter(p => S.checkedSearch.has(ppv(p)));
                S.searchList = uniq([...allResults, ...kept]);
                allResults.forEach(p => S.checkedSearch.add(ppv(p)));
                render($('#htool-search-list'), S.searchList, S.checkedSearch, $('#htool-search-cnt'), '⌕', '暂无结果');
                const msg = '批量搜索完成：找到 ' + allResults.length + ' 题'
                    + (failList.length ? '，未找到：' + failList.join('、') : '');
                log(msg);
                if (failList.length) alert(msg);
            } else {
                const q = parts[0];
                const res = await req('/api/oj/get-problem-list?keyword=' + encodeURIComponent(q));
                const rawList = res?.data?.records || [];
                const normalized = rawList.map(p => ({
                    ...p, id: p.pid ?? p.id, pid: p.pid ?? p.id,
                    title: p.title || p.problemName || p.name || '未命名题目',
                    problemName: p.problemName || p.title || p.name || '未命名题目'
                }));
                const kw = q.toLowerCase();
                const results = [...normalized].sort((x, y) => {
                    const sc = p => {
                        const A = sid(p).toLowerCase(), T = ptitle(p).toLowerCase();
                        let s = 0;
                        if (A === kw) s += 1000; if (T === kw) s += 900;
                        if (A.startsWith(kw)) s += 500; if (T.startsWith(kw)) s += 300;
                        if (A.includes(kw)) s += 180; if (T.includes(kw)) s += 120;
                        return s;
                    };
                    return sc(y) - sc(x);
                });
                const filtered = uniq(results).filter(p => {
                    const id = sid(p).toLowerCase(), t = ptitle(p).toLowerCase();
                    return id === kw || id.includes(kw) || t.includes(kw);
                });
                const kept = S.searchList.filter(p => S.checkedSearch.has(ppv(p)));
                const keptMap = new Map(kept.map(p => [ppv(p), p]));
                S.searchList = [...filtered.filter(p => !keptMap.has(ppv(p))), ...kept];
                render($('#htool-search-list'), S.searchList, S.checkedSearch, $('#htool-search-cnt'), '⌕', '暂无结果');
                log('搜索到 ' + filtered.length + ' 题');
                if (!filtered.length && !kept.length) alert('没有搜索到题目');
            }
        } catch (e) {
            alert('搜题失败：' + e.message);
            log('搜题失败：' + e.message);
        } finally { setBusy(false); }
    }

    async function runAdd() {
        refreshTid();
        if (!S.pageType) return alert('请在训练页面或比赛页面运行');
        const list = S.searchList.filter(p => S.checkedSearch.has(ppv(p)));
        if (!list.length) return alert('请至少选择一道题目');
        const label = S.pageType === 'contest' ? '添加到比赛' : '添加到题单';
        if (!confirm('确定' + label + ' ' + list.length + ' 道题目吗？')) return;
        setBusy(true);
        let ok = 0, bad = [];
        try {
            for (let i = 0; i < list.length; i++) {
                const p = list[i];
                log((S.pageType === 'contest' ? '添加到比赛 ' : '添加 ') + (i + 1) + '/' + list.length + '：' + sid(p));
                try {
                    if (S.pageType === 'contest') await retry(() => addContestProblemAutoDisplay(p), 1, 0);
                    else await retry(() => addTrainingProblem(p));
                    ok++;
                } catch (e) { bad.push({ id: sid(p), reason: e.message || '未知错误' }); }
                await sleep(300);
            }
        } finally { setBusy(false); }
        log(label + '完成：成功 ' + ok + '，失败 ' + bad.length);
        alert(label + '完成：成功 ' + ok + '，失败 ' + bad.length
            + (bad.length ? '\n\n' + bad.slice(0, 10).map(x => '- ' + x.id + '：' + x.reason).join('\n') : ''));
    }

    /* ═══════════════════════════════════════════
       管理>简介
    ═══════════════════════════════════════════ */
    async function autoLoadCurrentDesc() {
        refreshTid();
        if (!S.pageType) { log('请在训练页面或比赛页面运行'); return; }
        setBusy(true);
        try {
            const desc = await fetchCurrentDesc();
            S.currentDesc = desc;
            const ta = $('#htool-manage-desc-editor');
            if (ta) ta.value = desc;
            log('当前简介已加载');
            window.htoolSwitchDescTab('edit');
        } catch (e) { log('简介加载失败：' + e.message); }
        finally { setBusy(false); }
    }

    async function saveCurrentDesc() {
        refreshTid();
        if (!S.pageType) return alert('请在训练页面或比赛页面运行');
        const ta = $('#htool-manage-desc-editor');
        const newDesc = ta ? ta.value : '';
        if (!confirm('确定保存当前编辑的简介到' + (S.pageType === 'contest' ? '比赛' : '训练') + '吗？')) return;
        setBusy(true);
        try {
            const msg = S.pageType === 'contest'
                ? await syncContestDescription(newDesc)
                : await syncTrainingDescription(newDesc);
            S.currentDesc = newDesc;
            log(msg); alert(msg);
        } catch (e) {
            log('保存失败：' + e.message); alert('保存失败：' + e.message);
        } finally { setBusy(false); }
    }

    /* ═══════════════════════════════════════════
       管理>题单
    ═══════════════════════════════════════════ */
    async function autoLoadDelete() {
        refreshTid();
        if (S.deleteLoaded) return;
        if (S.pageType !== 'training' && S.pageType !== 'contest') return;
        setBusy(true);
        try {
            const d = S.pageType === 'training'
                ? await loadGroupTrainingProblems(S.targetTid)
                : await loadContestProblems(S.targetCid);
            S.deleteRaw = d; S.deleteList = d;
            S.checkedDelete = new Set(); S.deleteLoaded = true;
            renderDeleteList($('#htool-delete-list'), S.deleteList, S.checkedDelete, $('#htool-delete-cnt'));
            log('已加载 ' + d.length + ' 题');
        } catch (e) { log('自动加载失败：' + e.message); }
        finally { setBusy(false); }
    }

    async function reloadDelete() {
        S.deleteLoaded = false;
        refreshTid();
        if (S.pageType !== 'training' && S.pageType !== 'contest') return alert('请在训练页面或比赛页面运行');
        setBusy(true);
        try {
            const d = S.pageType === 'training'
                ? await loadGroupTrainingProblems(S.targetTid)
                : await loadContestProblems(S.targetCid);
            S.deleteRaw = d; S.deleteList = d;
            S.checkedDelete = new Set(); S.deleteLoaded = true;
            renderDeleteList($('#htool-delete-list'), S.deleteList, S.checkedDelete, $('#htool-delete-cnt'));
            log('已加载 ' + d.length + ' 题');
        } catch (e) {
            alert(e.message); log('加载失败：' + e.message);
        } finally { setBusy(false); }
    }

    /* ═══════════════════════════════════════════
       教学模块：加载题目、渲染、提交、轮询
    ═══════════════════════════════════════════ */

    async function loadTeachProblem() {
        refreshTid();
        const modeSel = $('#htool-teach-mode')?.value || (S.pageType === 'contest' ? 'contest' : 'training');
        const keyRaw = $('#htool-teach-key')?.value.trim();
        if (!keyRaw) return alert('请输入题号（训练填 pid，如 P1710；比赛填 displayId，如 A）');
        setBusy(true);
        try {
            let data;
            if (modeSel === 'contest') {
                if (!S.targetCid) throw new Error('当前未检测到 cid，请在比赛页使用');
                data = await fetchTeachProblem({
                    mode: 'contest', displayId: keyRaw.toUpperCase(), cid: S.targetCid
                });
                S.teach.mode = 'contest';
                S.teach.displayId = keyRaw.toUpperCase();
                S.teach.cid = S.targetCid;
                S.teach.tid = '';
                S.teach.gid = '';
                S.teach.pid = String(data?.problem?.problemId || data?.problem?.pid || data?.problemId || data?.pid || '');
            } else {
                const gid = (location.href.match(/group\/(\d+)/) || [])[1] || '';
                data = await fetchTeachProblem({ mode: 'training', pid: keyRaw, gid });
                S.teach.mode = 'training';
                S.teach.pid = keyRaw;
                S.teach.displayId = '';
                S.teach.cid = '';
                S.teach.tid = S.targetTid || '';
                S.teach.gid = gid || '';
            }
            S.teach.problem = data;
            S.teach.title = data?.problem?.title || data?.title || '未命名题目';
            renderTeachProblem(data);
            switchSecondary('teachsolve');
            log('题目加载成功：' + S.teach.title);
        } catch (e) {
            alert('加载失败：' + e.message);
            log('题目加载失败：' + e.message);
        } finally { setBusy(false); }
    }

    function renderTeachProblem(data) {
        const holder = $('#htool-teach-problem');
        if (!holder) return;
        const p = data?.problem || data || {};
        const samples = (() => {
            try {
                if (Array.isArray(p.samples) && p.samples.length) return p.samples;
                if (typeof p.samples === 'string') {
                    const parsed = JSON.parse(p.samples);
                    if (Array.isArray(parsed) && parsed.length) return parsed;
                }
                if (Array.isArray(p.examples) && p.examples.length) return p.examples;
                if (typeof p.examples === 'string') {
                    const xmlParsed = parseExamplesString(p.examples);
                    if (xmlParsed.length) return xmlParsed;
                    const jsonParsed = JSON.parse(p.examples);
                    if (Array.isArray(jsonParsed) && jsonParsed.length) return jsonParsed;
                }
            } catch (e) { }
            return [];
        })();


        const parts = [];
        parts.push('<h2 style="font-size:15px;font-weight:900;margin:0 0 4px;">' + esc(p.title || S.teach.title) + '</h2>');
        parts.push('<p class="htool-muted" style="margin:0 0 8px;">时间限制 ' + (p.timeLimit || '?') + 'ms ｜ 内存限制 '
            + (p.memoryLimit || '?') + 'MB ｜ 分数 ' + (p.score ?? '?') + '</p>');
        if (p.description) {
            parts.push('<div class="htool-teach-section"><div class="htool-teach-sec-title">题目描述</div>'
                + renderMarkdown(p.description) + '</div>');
        }
        if (p.input) {
            parts.push('<div class="htool-teach-section"><div class="htool-teach-sec-title">输入描述</div>'
                + renderMarkdown(p.input) + '</div>');
        }
        if (p.output) {
            parts.push('<div class="htool-teach-section"><div class="htool-teach-sec-title">输出描述</div>'
                + renderMarkdown(p.output) + '</div>');
        }
        if (samples.length) {
            parts.push('<div class="htool-teach-section"><div class="htool-teach-sec-title">样例</div>');
            samples.forEach((s, i) => {
                parts.push(
                    '<div style="margin-bottom:8px;">' +
                    '<div style="font-size:11px;font-weight:800;color:#475569;margin-bottom:3px;">样例 ' + (i + 1) + ' 输入</div>' +
                    '<pre class="htool-teach-pre"><code>' + esc(String(s.input || '')) + '</code></pre>' +
                    '<div style="font-size:11px;font-weight:800;color:#475569;margin:5px 0 3px;">样例 ' + (i + 1) + ' 输出</div>' +
                    '<pre class="htool-teach-pre"><code>' + esc(String(s.output || '')) + '</code></pre>' +
                    '</div>'
                );
            });
            parts.push('</div>');
        }
        if (p.hint) {
            parts.push('<div class="htool-teach-section"><div class="htool-teach-sec-title">提示</div>'
                + renderMarkdown(p.hint) + '</div>');
        }
        holder.innerHTML = parts.join('');
    }
    /* ── CodeMirror 编辑器实例管理 ── */
    let _cmView = null; // 全局唯一编辑器实例

    function getLangExtension(language, CM) {
        const l = (language || '').toLowerCase();
        if (l.includes('python')) return CM.python();
        if (l.includes('java') && !l.includes('javascript')) return CM.java();
        // C, C++, C++ With O2 等全部走 cpp
        return CM.cpp();
    }

    async function initCodeMirror() {
        const container = $('#htool-teach-code-cm');
        if (!container) return;
        if (_cmView) { _cmView.destroy(); _cmView = null; }

        const CM = await loadCodeMirror();

        // 亮色主题：用默认高亮 + 白底
        const lightTheme = CM.EditorView.theme({
            '&': { background: '#ffffff', color: '#24292e' },
            '.cm-content': { caretColor: '#24292e' },
            '.cm-cursor': { borderLeftColor: '#24292e' },
            '.cm-activeLine': { backgroundColor: '#f3f4f6' },
            '.cm-activeLineGutter': { backgroundColor: '#f3f4f6' },
            '.cm-gutters': { background: '#f8fafc', color: '#94a3b8', border: 'none' },
            '.cm-selectionBackground, ::selection': { background: '#b3d7ff !important' },
        });

        const themeExt = S.teach.theme === 'dark' ? CM.oneDark : lightTheme;

        // 字体大小动态注入
        const fontSizeTheme = CM.EditorView.theme({
            '&': { fontSize: S.teach.fontSize + 'px' },
            '.cm-content': {
                fontFamily: "'Fira Mono', Consolas, 'Courier New', monospace",
                fontSize: S.teach.fontSize + 'px',   // ← 加这行
                lineHeight: '1.6',
            },
            '.cm-gutters': {
                fontSize: S.teach.fontSize + 'px',   // ← 行号也同步
            },
        });


        const extensions = [
            CM.lineNumbers(),
            CM.highlightActiveLineGutter(),
            CM.highlightSpecialChars(),
            CM.history(),
            CM.foldGutter(),
            CM.drawSelection(),
            CM.dropCursor(),
            CM.rectangularSelection(),
            CM.crosshairCursor(),
            CM.highlightActiveLine(),
            CM.indentOnInput(),
            CM.bracketMatching(),
            CM.closeBrackets(),
            CM.autocompletion(),
            CM.syntaxHighlighting(CM.defaultHighlightStyle, { fallback: true }),
            CM.keymap.of([
                ...CM.closeBracketsKeymap,
                ...CM.defaultKeymap,
                ...CM.historyKeymap,
                ...CM.completionKeymap,
                CM.indentWithTab,
            ]),
            themeExt,
            fontSizeTheme,
            getLangExtension(S.teach.language, CM),
            CM.EditorView.updateListener.of(update => {
                if (update.docChanged) S.teach._cmCode = update.state.doc.toString();
            }),
        ];

        _cmView = new CM.EditorView({
            state: CM.EditorState.create({
                doc: S.teach._cmCode || '',
                extensions,
            }),
            parent: container,
        });
    }


    // 切换语言时重建编辑器（保留代码内容）
    async function switchCmLanguage(language) {
        if (!_cmView) return;
        const CM = window._CM;
        if (!CM) return;
        const currentCode = _cmView.state.doc.toString();
        S.teach._cmCode = currentCode;
        _cmView.destroy();
        _cmView = null;
        await initCodeMirror();
        // 恢复代码
        if (_cmView && currentCode) {
            _cmView.dispatch({
                changes: { from: 0, to: _cmView.state.doc.length, insert: currentCode }
            });
        }
    }

    async function submitTeach() {
        const pid = S.teach.mode === 'contest' ? S.teach.currentDisplayId : S.teach.currentPid;
        if (!pid) return alert('请先从题单选择题目');
        const code = (_cmView ? _cmView.state.doc.toString() : '') || S.teach._cmCode || '';
        if (!code.trim()) return alert('代码不能为空');
        const language = $('#htool-teach-lang')?.value || 'C++ With O2';
        S.teach.language = language;

        let payload;
        if (S.teach.mode === 'contest') {
            payload = {
                pid: S.teach.currentDisplayId,
                language, code,
                cid: parseInt(S.teach.cid, 10),
                tid: null,
                gid: null,
                isRemote: false,
                seconds: 2,
                platform: 0,
            };
        } else {
            // 训练模式：tid/gid 从当前页面 URL 实时取，防止状态丢失
            const curTid = S.teach.tid || S.targetTid || '';
            const curGid = S.teach.gid || (location.href.match(/group\/(\d+)/) || [])[1] || '';
            payload = {
                pid: S.teach.currentDisplayId,  // 提交用 "P1472"
                language, code,
                cid: 0,
                tid: curTid ? String(curTid) : null,
                gid: curGid ? String(curGid) : null,
                isRemote: false,
                seconds: 0,
                platform: 0,
            };
        }




        setBusy(true);
        const resultEl = $('#htool-teach-result');
        if (resultEl) {
            resultEl.className = 'htool-teach-result running';
            resultEl.innerHTML = '<span class="htool-ai-spin"></span><span>提交中...</span>';
        }
        try {
            const submitId = await submitTeachJudge(payload);
            S.teach.lastSubmitId = submitId;
            log('提交成功 submitId=' + submitId + '，轮询评测结果...');
            await pollTeachResult(submitId);
        } catch (e) {
            if (resultEl) {
                resultEl.className = 'htool-teach-result err';
                resultEl.innerHTML = '<span>提交失败：' + esc(e.message) + '</span>';
            }
            log('提交失败：' + e.message);
        } finally { setBusy(false); }
    }

    async function pollTeachResult(submitId) {
        const resultEl = $('#htool-teach-result');
        S.teach.polling = true;
        const RUNNING = new Set(['6', '7', '9', '11', '13', '14', '15']);

        for (let i = 0; i < 30; i++) {
            await sleep(1200);
            try {
                const sub = await fetchTeachSubmitInfo(submitId);   // ← 改这里
                const status = String(sub.status ?? sub.judgeStatus ?? '');
                const label = TEACH_STATUS_MAP[status] || ('状态 ' + status);
                const isRunning = RUNNING.has(status);
                const isAC = status === '0';
                const cls = isAC ? 'ok' : isRunning ? 'running' : 'err';
                const color = STATUS_COLOR[status] || (isRunning ? 'var(--hp)' : '#64748b');
                const memMB = sub.memory != null ? (sub.memory / 1024).toFixed(1) + 'MB' : '-';

                let casesHtml = '';
                if (!isRunning) {
                    const cases = await fetchAllCaseResult(submitId);
                    casesHtml = renderCaseResults(Array.isArray(cases) ? cases : []);
                }

                if (resultEl) {
                    resultEl.className = 'htool-teach-result ' + cls;
                    resultEl.innerHTML =
                        '<div class="htool-teach-result-head">' +
                        (isRunning ? '<span class="htool-ai-spin"></span>' : '') +
                        '<span class="htool-teach-result-status" style="color:' + color + ';">' + esc(label) + '</span>' +
                        '<span class="htool-muted" style="margin-left:8px;">时间 ' + (sub.time ?? '-') + 'ms ｜ 内存 ' + memMB
                        + ' ｜ 分数 ' + (sub.score ?? '-') + '</span>' +
                        '</div>' +
                        (sub.errorMessage && sub.errorMessage !== 'The error message does not support viewing.'
                            ? '<pre class="htool-teach-pre" style="margin-top:6px;max-height:100px;overflow:auto;color:#b91c1c;font-size:11px;">'
                            + esc(sub.errorMessage) + '</pre>'
                            : '') +
                        casesHtml;
                }

                if (!isRunning) { S.teach.polling = false; return; }
            } catch (e) { /* 静默重试 */ }
        }

        S.teach.polling = false;
        if (resultEl) resultEl.innerHTML += '<div class="htool-muted" style="margin-top:4px;">轮询超时，请稍后查看</div>';
    }


    /* ═══════════════════════════════════════════
       构建 UI
    ═══════════════════════════════════════════ */
    let _md = null;
    loadMarkdownIt(() => {
        _md = null;
        loadKatex(() => {
            loadHighlightJs(() => {
                _md = null; // 触发 getMd 重新初始化，此时三个库都已就绪
            });
        });
    });


    (function buildUI() {
        const style = document.createElement('style');
        style.textContent = `
:root{
  --hp:#2563eb;--hpd:#1d4ed8;--hpbg:#eff6ff;
  --hr:#dc2626;--hrd:#b91c1c;
  --ht:#0f172a;--hs:#64748b;
  --hl:rgba(148,163,184,.16);--hls:rgba(148,163,184,.09);
  --shd:0 20px 48px rgba(15,23,42,.18);
  --shds:0 4px 14px rgba(15,23,42,.07);
}
#htool-fab{
  all:initial;position:fixed;left:0;top:0;
  width:44px;height:44px;border-radius:14px;
  background:linear-gradient(135deg,var(--hp),var(--hpd));
  color:#fff;display:flex;align-items:center;justify-content:center;
  font:800 15px/1 system-ui,sans-serif;cursor:grab;z-index:999999;
  user-select:none;box-shadow:0 8px 24px rgba(37,99,235,.32);
  transition:transform .15s,box-shadow .15s;
}
#htool-fab:hover{transform:translateY(-1px) scale(1.04);}
#htool-fab.drag{cursor:grabbing;}
#htool-panel{
  all:initial;position:fixed;
  width:900px;max-width:calc(100vw - 12px);
  height:660px;max-height:calc(100vh - 12px);
  display:none;flex-direction:row;
  z-index:1000000;border-radius:18px;overflow:hidden;
  background:#f8fafc;
  border:1px solid rgba(148,163,184,.20);
  box-shadow:var(--shd);
  font-family:Inter,system-ui,-apple-system,sans-serif;
  color:var(--ht);
}
#htool-panel.show{display:flex;}
#htool-panel *{box-sizing:border-box;}
.htool-side{
  width:90px;flex:none;
  display:flex;flex-direction:column;
  padding:12px 7px;gap:7px;
  background:linear-gradient(180deg,#eef2fb,#e4eaf6);
  border-right:1px solid var(--hl);
}
.htool-nav-btn{
  height:72px;border:none;border-radius:13px;
  background:rgba(255,255,255,.50);color:#475569;
  font-size:11px;font-weight:800;cursor:pointer;
  display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px;
  transition:all .15s;
}
.htool-nav-btn:hover{background:rgba(37,99,235,.10);color:var(--hpd);}
.htool-nav-btn.on{
  background:linear-gradient(135deg,var(--hp),var(--hpd));
  color:#fff;box-shadow:0 8px 18px rgba(37,99,235,.28);
}
.htool-nav-ic{font-size:19px;line-height:1;}
.htool-nav-tx{font-size:11px;line-height:1;}
.htool-main{flex:1;min-width:0;display:flex;flex-direction:column;overflow:hidden;}
.htool-hd{
  display:flex;align-items:center;justify-content:space-between;
  padding:10px 14px;flex:none;
  background:rgba(255,255,255,.92);
  border-bottom:1px solid var(--hl);
}
.htool-hd-left{display:flex;align-items:center;gap:10px;}
.htool-hd-title{font-size:14px;font-weight:900;letter-spacing:.2px;}
.htool-badge{
  display:inline-flex;align-items:center;height:22px;padding:0 9px;
  border-radius:999px;font-size:11px;font-weight:800;white-space:nowrap;
  border:1px solid transparent;
}
.htool-badge.training{background:#ecfdf5;color:#047857;border-color:#a7f3d0;}
.htool-badge.contest{background:#eff6ff;color:#1d4ed8;border-color:#bfdbfe;}
.htool-badge.empty{background:#f1f5f9;color:#64748b;border-color:#e2e8f0;}
.htool-close{
  width:28px;height:28px;border:none;border-radius:8px;
  background:rgba(148,163,184,.14);color:#475569;
  font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;
  transition:all .15s;
}
.htool-close:hover{background:rgba(239,68,68,.14);color:var(--hr);}
.htool-subnav{
  display:flex;gap:6px;padding:10px 14px;flex:none;
  background:#f8fafc;
  border-bottom:1px solid var(--hl);
}
.htool-sub-btn{
  height:32px;padding:0 14px;border:none;border-radius:9px;
  background:rgba(255,255,255,.80);color:#475569;
  font-size:12px;font-weight:800;cursor:pointer;
  box-shadow:inset 0 0 0 1px rgba(148,163,184,.22);
  transition:all .15s;
}
.htool-sub-btn:hover{background:var(--hpbg);color:var(--hpd);}
.htool-sub-btn.on{
  background:var(--hpbg);color:var(--hpd);
  box-shadow:inset 0 0 0 1.5px rgba(37,99,235,.28);
}
.htool-body{
  flex:1;min-height:0;padding:12px 14px;
  overflow:hidden;display:flex;flex-direction:column;
}
.htool-view{
  display:none;flex-direction:column;
  flex:1;min-height:0;overflow-y:auto;gap:10px;
}
.htool-view::-webkit-scrollbar{width:5px;}
.htool-view::-webkit-scrollbar-thumb{background:rgba(148,163,184,.28);border-radius:999px;}
.htool-card{
  background:#fff;border-radius:13px;
  border:1px solid var(--hl);box-shadow:var(--shds);
  padding:12px;display:flex;flex-direction:column;gap:9px;flex:none;
}
.htool-card.grow{flex:1;min-height:0;}
.htool-card.grow .htool-list{flex:1;min-height:0;}
.htool-card-title{
  font-size:11px;font-weight:900;color:var(--hs);
  letter-spacing:.4px;text-transform:uppercase;
}
.htool-seg{display:grid;gap:6px;}
.htool-seg3{grid-template-columns:repeat(3,1fr);}
.htool-seg2{grid-template-columns:repeat(2,1fr);}
.htool-seg-btn{
  height:32px;border:none;border-radius:9px;
  background:#f1f5f9;color:#475569;
  font-size:11px;font-weight:800;cursor:pointer;
  box-shadow:inset 0 0 0 1px rgba(148,163,184,.16);
  transition:all .15s;
}
.htool-seg-btn:hover{background:var(--hpbg);color:var(--hpd);}
.htool-seg-btn.on{
  background:var(--hpbg);color:var(--hpd);
  box-shadow:inset 0 0 0 1.5px rgba(37,99,235,.28);
}
.htool-grid2{display:grid;grid-template-columns:1fr 1fr;gap:8px;}
.htool-ipt{
  width:100%;height:36px;padding:0 12px;
  border:1px solid rgba(148,163,184,.26);border-radius:10px;
  background:#fff;outline:none;
  font-size:12px;color:var(--ht);
  transition:border-color .15s,box-shadow .15s;
}
.htool-ipt::placeholder{color:#94a3b8;}
.htool-ipt:focus{border-color:var(--hp);box-shadow:0 0 0 3px rgba(37,99,235,.09);}
.htool-textarea{
  width:100%;padding:10px 12px;
  border:1px solid rgba(148,163,184,.26);border-radius:10px;
  background:#fff;outline:none;resize:vertical;
  font-size:12px;color:var(--ht);font-family:inherit;
  transition:border-color .15s,box-shadow .15s;
  min-height:120px;
}
.htool-textarea:focus{border-color:var(--hp);box-shadow:0 0 0 3px rgba(37,99,235,.09);}
.htool-btn{
  height:36px;padding:0 14px;border:none;border-radius:10px;
  display:inline-flex;align-items:center;justify-content:center;
  font-size:12px;font-weight:800;cursor:pointer;white-space:nowrap;
  background:linear-gradient(135deg,var(--hp),var(--hpd));color:#fff;
  transition:transform .13s,opacity .13s;flex:none;
}
.htool-btn:hover{transform:translateY(-1px);}
.htool-btn:disabled{opacity:.44;cursor:not-allowed;transform:none;}
.htool-btn.gray{background:#fff;color:#334155;box-shadow:inset 0 0 0 1px rgba(148,163,184,.26);}
.htool-btn.red{background:linear-gradient(135deg,#ef4444,var(--hr));}
.htool-btn.teal{background:var(--hpbg);color:var(--hpd);box-shadow:inset 0 0 0 1px rgba(37,99,235,.22);}
.htool-btn.green{background:linear-gradient(135deg,#10b981,#047857);color:#fff;}
.htool-row{display:flex;gap:8px;align-items:center;}
.htool-row>.htool-ipt{flex:1;}
.htool-list{
  overflow-y:auto;border-radius:10px;
  border:1px solid var(--hl);background:#fff;min-height:60px;
}
.htool-list::-webkit-scrollbar{width:5px;}
.htool-list::-webkit-scrollbar-thumb{background:rgba(148,163,184,.26);border-radius:999px;}
.htool-item{
  display:grid;grid-template-columns:18px 66px 1fr;
  gap:8px;align-items:center;
  padding:9px 10px;border-bottom:1px solid var(--hls);
  cursor:pointer;transition:background .10s;
}
.htool-item:last-child{border-bottom:none;}
.htool-item:hover{background:#f8fbff;}
.htool-item input[type=checkbox]{width:13px;height:13px;accent-color:var(--hp);}
.htool-pid{font-size:11px;font-weight:900;color:var(--hp);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.htool-ptitle{font-size:12px;color:var(--ht);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.htool-empty{
  min-height:90px;display:flex;flex-direction:column;
  align-items:center;justify-content:center;gap:6px;color:#94a3b8;
}
.htool-empty-ic{font-size:20px;}
.htool-empty-tx{font-size:12px;}
.htool-draggable{cursor:grab;}
.htool-draggable.dragging{opacity:.48;}
.htool-draggable.drag-over{outline:2px dashed rgba(37,99,235,.38);background:#eff6ff;}
.htool-bar{display:flex;align-items:center;justify-content:space-between;gap:8px;}
.htool-bar-l{display:flex;align-items:center;gap:10px;flex-wrap:wrap;}
.htool-bar-r{display:flex;align-items:center;gap:8px;}
.htool-cnt-wrap{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--hs);}
.htool-cnt{
  display:inline-flex;align-items:center;justify-content:center;
  min-width:42px;height:20px;padding:0 7px;border-radius:999px;
  background:var(--hpbg);color:var(--hpd);font-size:11px;font-weight:900;
}
.htool-chk{
  display:inline-flex;align-items:center;gap:5px;
  font-size:12px;font-weight:700;color:#334155;
  cursor:pointer;user-select:none;white-space:nowrap;
}
.htool-chk input{width:13px;height:13px;accent-color:var(--hp);}
.htool-select{position:relative;}
.htool-drop{
  position:absolute;left:0;right:0;top:40px;
  max-height:176px;overflow-y:auto;
  background:#fff;border:1px solid var(--hl);
  border-radius:12px;box-shadow:0 10px 24px rgba(15,23,42,.12);
  display:none;z-index:50;padding:4px;
}
.htool-select.open .htool-drop{display:block;}
.htool-drop-item{padding:8px 10px;border-radius:8px;font-size:12px;color:var(--ht);cursor:pointer;}
.htool-drop-item:hover{background:#f1f5f9;}
.htool-drop-empty{padding:9px 10px;color:#94a3b8;font-size:11px;}
.htool-drop::-webkit-scrollbar{width:4px;}
.htool-drop::-webkit-scrollbar-thumb{background:rgba(148,163,184,.26);border-radius:999px;}
.htool-muted{font-size:11px;color:var(--hs);line-height:1.7;}
#htool-log{
  padding:7px 14px;flex:none;
  background:rgba(255,255,255,.90);border-top:1px solid var(--hl);
  font-size:11px;color:var(--hs);min-height:30px;display:flex;align-items:center;
}
.htool-ai-status{font-size:11px;color:var(--hs);display:flex;align-items:center;gap:6px;min-height:20px;}
.htool-ai-status.running{color:var(--hp);}
.htool-ai-status.ok{color:#047857;}
.htool-ai-status.err{color:var(--hr);}
@keyframes htool-spin{to{transform:rotate(360deg);}}
.htool-ai-spin{
  display:inline-block;width:12px;height:12px;
  border:2px solid rgba(37,99,235,.25);border-top-color:var(--hp);
  border-radius:50%;animation:htool-spin .7s linear infinite;flex:none;
}
.htool-desc-ta{
  font-family:'Fira Mono',Consolas,'Courier New',monospace;
  font-size:12px;line-height:1.7;
}
.htool-md-preview{
  flex:1;min-height:0;overflow-y:auto;padding:4px 6px;
  font-size:13px;line-height:1.8;color:var(--ht);word-break:break-word;
}
.htool-md-preview::-webkit-scrollbar{width:5px;}
.htool-md-preview::-webkit-scrollbar-thumb{background:rgba(148,163,184,.26);border-radius:999px;}
.htool-md-preview h1{font-size:18px;font-weight:900;margin:14px 0 8px;padding-bottom:6px;border-bottom:2px solid var(--hl);}
.htool-md-preview h2{font-size:15px;font-weight:900;margin:12px 0 6px;padding-bottom:4px;border-bottom:1px solid var(--hl);}
.htool-md-preview h3{font-size:13px;font-weight:900;margin:10px 0 5px;}
.htool-md-preview h4,.htool-md-preview h5,.htool-md-preview h6{font-size:12px;font-weight:800;margin:8px 0 4px;}
.htool-md-preview p{margin:6px 0;}
.htool-md-preview ul,.htool-md-preview ol{margin:6px 0;padding-left:20px;}
.htool-md-preview li{margin:3px 0;}
.htool-md-preview strong{font-weight:900;color:#0f172a;}
.htool-md-preview em{font-style:italic;color:#475569;}
.htool-md-preview code{font-family:'Fira Mono',Consolas,monospace;font-size:11px;padding:1px 5px;border-radius:5px;background:#f1f5f9;color:#be185d;border:1px solid var(--hl);}
.htool-md-preview pre{background:#f8fafc;border:1px solid var(--hl);border-radius:10px;padding:10px 12px;overflow-x:auto;margin:8px 0;}
.htool-md-preview pre code{background:none;border:none;padding:0;color:#334155;font-size:11px;}
.htool-md-preview blockquote{border-left:3px solid var(--hp);margin:8px 0;padding:6px 12px;background:var(--hpbg);border-radius:0 8px 8px 0;color:#475569;font-size:12px;}
.htool-md-preview hr{border:none;border-top:1px solid var(--hl);margin:12px 0;}
.htool-md-preview table{width:100%;border-collapse:collapse;font-size:12px;margin:8px 0;}
.htool-md-preview th{background:#f1f5f9;font-weight:800;padding:6px 10px;border:1px solid var(--hl);text-align:left;}
.htool-md-preview td{padding:6px 10px;border:1px solid var(--hl);}
.htool-md-preview tr:nth-child(even) td{background:#f8fafc;}
.htool-md-preview a{color:var(--hp);text-decoration:none;}
.htool-md-preview a:hover{text-decoration:underline;}
.htool-md-preview img{max-width:100%;border-radius:8px;}
.htool-btn.tab-on{background:var(--hpbg);color:var(--hpd);box-shadow:inset 0 0 0 1.5px rgba(37,99,235,.28);}
/* 教学模块专属样式 */
.htool-teach-pane{
  display:flex;flex-direction:row;flex:1;min-height:0;gap:10px;overflow:hidden;
}
.htool-teach-left{
  flex:1;min-width:0;display:flex;flex-direction:column;overflow:hidden;
}
.htool-teach-right{
  flex:1;min-width:0;display:flex;flex-direction:column;gap:8px;overflow:hidden;
}
.htool-teach-problem-wrap{
  flex:1;min-height:0;overflow-y:auto;
  background:#fff;border:1px solid var(--hl);border-radius:12px;
  padding:12px 14px;font-size:13px;line-height:1.8;color:var(--ht);word-break:break-word;
}
.htool-teach-problem-wrap::-webkit-scrollbar{width:5px;}
.htool-teach-problem-wrap::-webkit-scrollbar-thumb{background:rgba(148,163,184,.26);border-radius:999px;}
.htool-teach-section{margin-bottom:10px;}
.htool-teach-sec-title{
  font-size:11px;font-weight:900;color:var(--hs);
  letter-spacing:.4px;text-transform:uppercase;
  margin-bottom:4px;
}
.htool-teach-pre{
  background:#f8fafc;border:1px solid var(--hl);border-radius:8px;
  padding:8px 10px;overflow-x:auto;margin:4px 0;
  font-family:'Fira Mono',Consolas,monospace;font-size:11px;color:#334155;
  white-space:pre;
}
.htool-teach-code-wrap{
  flex:1;min-height:0;display:flex;flex-direction:column;
}
.htool-teach-code{
  flex:1;min-height:0;resize:none;
  font-family:'Fira Mono',Consolas,'Courier New',monospace;
  font-size:12px;line-height:1.6;
  background:#1e1e2e;color:#cdd6f4;
  border:1px solid rgba(148,163,184,.20);border-radius:10px;
  padding:10px 12px;outline:none;
  transition:border-color .15s;
}
.htool-teach-code:focus{border-color:var(--hp);}
.htool-teach-result{
  padding:8px 10px;border-radius:10px;
  border:1px solid var(--hl);background:#f8fafc;
  font-size:12px;min-height:38px;
  display:flex;flex-direction:column;gap:4px;
}
.htool-teach-result.running{border-color:#bfdbfe;background:#eff6ff;color:var(--hp);}
.htool-teach-result.ok{border-color:#a7f3d0;background:#ecfdf5;color:#047857;}
.htool-teach-result.err{border-color:#fecaca;background:#fef2f2;color:var(--hr);}
@media(max-width:780px){
  #htool-panel{width:calc(100vw - 8px);height:calc(100vh - 8px);max-height:none;border-radius:14px;}
  .htool-side{width:80px;padding:10px 6px;}
  .htool-nav-btn{height:64px;}
  .htool-grid2{grid-template-columns:1fr;}
  .htool-item{grid-template-columns:18px 58px 1fr;}
  .htool-teach-pane{flex-direction:column;}
}
@media(max-width:520px){
  #htool-panel{flex-direction:column;}
  .htool-side{width:100%;flex-direction:row;border-right:none;border-bottom:1px solid var(--hl);padding:8px;}
  .htool-nav-btn{flex:1;height:46px;border-radius:10px;}
  .htool-seg3{grid-template-columns:1fr;}
  .htool-bar{flex-direction:column;align-items:flex-start;}
  .htool-bar-r{width:100%;justify-content:flex-end;}
}
/* 教学题单列表 */
.htool-teach-prob-item{
  display:flex;align-items:center;gap:8px;
  padding:9px 12px;border-bottom:1px solid var(--hls);
  cursor:pointer;transition:background .10s;
}
.htool-teach-prob-item:last-child{border-bottom:none;}
.htool-teach-prob-item:hover{background:#f0f7ff;}
.htool-teach-prob-item.active{background:var(--hpbg);border-left:3px solid var(--hp);}
.htool-teach-prob-id{font-size:11px;font-weight:900;color:var(--hp);min-width:40px;flex:none;}
.htool-teach-prob-title{font-size:12px;color:var(--ht);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
/* 教学答题布局 */
.htool-teach-pane{display:flex;flex-direction:row;flex:1;min-height:0;gap:10px;overflow:hidden;}
.htool-teach-left{flex:1;min-width:0;display:flex;flex-direction:column;overflow:hidden;}
.htool-teach-right{flex:1;min-width:0;display:flex;flex-direction:column;gap:6px;overflow:hidden;}
.htool-teach-problem-wrap{
  flex:1;min-height:0;overflow-y:auto;
  background:#fff;border:1px solid var(--hl);border-radius:12px;
  padding:12px 14px;word-break:break-word;
}
.htool-teach-problem-wrap::-webkit-scrollbar{width:5px;}
.htool-teach-problem-wrap::-webkit-scrollbar-thumb{background:rgba(148,163,184,.26);border-radius:999px;}
/* 题目内容区内的 md-preview 不要额外 overflow */
.htool-teach-problem-wrap .htool-md-preview{
  overflow:visible;padding:0;flex:none;min-height:0;
}
.htool-teach-prob-header{margin-bottom:10px;padding-bottom:8px;border-bottom:1px solid var(--hl);}
.htool-teach-prob-name{font-size:15px;font-weight:900;color:var(--ht);margin-bottom:4px;}
.htool-teach-prob-meta{display:flex;gap:10px;flex-wrap:wrap;}
.htool-teach-prob-meta span{font-size:11px;color:var(--hs);background:#f1f5f9;padding:2px 8px;border-radius:999px;}
.htool-teach-section{margin-bottom:12px;}
.htool-teach-sec-title{
  font-size:11px;font-weight:900;color:var(--hs);
  letter-spacing:.4px;text-transform:uppercase;
  margin-bottom:5px;
  padding-left:6px;border-left:3px solid var(--hp);
}
.htool-teach-sample{margin-bottom:8px;}
.htool-teach-sample-label{font-size:11px;font-weight:800;color:#475569;margin:4px 0 2px;}
.htool-teach-pre{
  background:#f8fafc;border:1px solid var(--hl);border-radius:8px;
  padding:8px 10px;overflow-x:auto;margin:0;
  font-family:'Fira Mono',Consolas,monospace;font-size:11px;color:#334155;
  white-space:pre;line-height:1.6;
}
/* 代码编辑器 */
.htool-teach-code-wrap{flex:1;min-height:0;display:flex;flex-direction:column;}
.htool-teach-code{
  flex:1;min-height:0;resize:none;
  font-family:'Fira Mono',Consolas,'Courier New',monospace;
  font-size:12px;line-height:1.6;
  background:#1e1e2e;color:#cdd6f4;
  border:1px solid rgba(148,163,184,.20);border-radius:10px;
  padding:10px 12px;outline:none;
  transition:border-color .15s;
}
.htool-teach-code:focus{border-color:var(--hp);}
/* 评测结果区 */
.htool-teach-result{
  flex:none;padding:8px 10px;border-radius:10px;
  border:1px solid var(--hl);background:#f8fafc;
  font-size:12px;max-height:180px;overflow-y:auto;
}
.htool-teach-result::-webkit-scrollbar{width:4px;}
.htool-teach-result::-webkit-scrollbar-thumb{background:rgba(148,163,184,.26);border-radius:999px;}
.htool-teach-result.running{border-color:#bfdbfe;background:#eff6ff;}
.htool-teach-result.ok{border-color:#a7f3d0;background:#ecfdf5;}
.htool-teach-result.err{border-color:#fecaca;background:#fef2f2;}
.htool-teach-result-head{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:6px;}
.htool-teach-result-status{font-weight:900;font-size:13px;}
/* 测试点列表 */
.htool-teach-cases{
  display:flex;flex-wrap:wrap;gap:4px;margin-top:4px;
}
.htool-teach-case{
  display:flex;align-items:center;gap:4px;
  padding:3px 8px;border-radius:6px;font-size:11px;
  background:#f1f5f9;border:1px solid var(--hl);
}
.htool-teach-case.ok{background:#ecfdf5;border-color:#a7f3d0;}
.htool-teach-case.err{background:#fef2f2;border-color:#fecaca;}
.htool-teach-case-no{font-weight:800;color:var(--hs);min-width:20px;}
.htool-teach-case-status{font-weight:700;}
.htool-teach-case-meta{color:var(--hs);font-size:10px;}
@media(max-width:780px){
  .htool-teach-pane{flex-direction:column;}
  .htool-teach-left,.htool-teach-right{flex:none;height:50%;}
}
/* KaTeX 块级公式居中 */
.htool-math-block{
  overflow-x:auto;padding:6px 0;text-align:center;margin:8px 0;
}
/* highlight.js 代码块覆盖，保持和工具箱风格一致 */
.htool-md-preview pre.hljs,
.htool-teach-problem-wrap pre.hljs{
  background:#f8fafc;border:1px solid var(--hl);border-radius:10px;
  padding:10px 12px;overflow-x:auto;margin:8px 0;
}
.htool-md-preview pre.hljs code,
.htool-teach-problem-wrap pre.hljs code{
  background:none;border:none;padding:0;font-size:11px;
  font-family:'Fira Mono',Consolas,monospace;
}
/* KaTeX 行内公式不换行 */
.katex{font-size:1em !important;
}
/* CodeMirror 6 编辑器容器适配 */
#htool-teach-code-cm {
  flex: 1;
  min-height: 0;
  height: 100%;
  border-radius: 13px;
  overflow: hidden;
}
#htool-teach-code-cm .cm-editor {
  height: 100%;
  border-radius: 13px;
  font-family: 'Fira Mono', Consolas, 'Courier New', monospace;
  font-size: 12px;
}
#htool-teach-code-cm .cm-scroller {
  overflow: auto;
  border-radius: 13px;
}
#htool-teach-code-cm .cm-editor.cm-focused {
  outline: none;
  box-shadow: 0 0 0 2px rgba(37,99,235,.35);
}
/* 字体大小控制器 */
.htool-fontsize-ctrl {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  height: 30px;
  border: 1px solid rgba(148,163,184,.26);
  border-radius: 10px;
  overflow: hidden;
  background: #fff;
  flex: none;
}
.htool-fontsize-ctrl button {
  height: 100%;
  padding: 0 8px;
  border: none;
  background: transparent;
  color: #475569;
  font-size: 11px;
  font-weight: 800;
  cursor: pointer;
  transition: background .12s;
}
.htool-fontsize-ctrl button:hover {
  background: var(--hpbg);
  color: var(--hpd);
}
.htool-fontsize-ctrl button:disabled {
  opacity: .35;
  cursor: not-allowed;
}
#htool-font-val {
  font-size: 11px;
  font-weight: 800;
  color: #334155;
  min-width: 22px;
  text-align: center;
  user-select: none;
}
/* 自测输入输出布局 */
.htool-test-io {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
.htool-test-col {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.htool-test-col-title {
  font-size: 11px;
  font-weight: 800;
  color: var(--hs);
  letter-spacing: .3px;
}
/* 自测结果对比 */
.htool-test-compare {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-top: 6px;
}
.htool-test-pre.ok {
  border-color: #a7f3d0;
  background: #ecfdf5;
}
.htool-test-pre.err {
  border-color: #fecaca;
  background: #fef2f2;
}
@media (max-width: 600px) {
  .htool-test-io,
  .htool-test-compare { grid-template-columns: 1fr; }
}
/* 自测页布局 */
#htool-view-teachtest .htool-test-io {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  flex: 1;
  min-height: 0;
}
#htool-view-teachtest .htool-test-col {
  display: flex;
  flex-direction: column;
  min-height: 0;
}
#htool-view-teachtest .htool-test-col textarea {
  flex: 1;
  min-height: 0;
}
@media (max-width: 600px) {
  #htool-view-teachtest .htool-test-io {
    grid-template-columns: 1fr;
  }
}

`;
        document.head.appendChild(style);

        const fab = document.createElement('div');
        fab.id = 'htool-fab';
        fab.textContent = '题';

        const panel = document.createElement('div');
        panel.id = 'htool-panel';
        panel.innerHTML = `
<div class="htool-side">
  <button class="htool-nav-btn on" data-primary="sync">
    <span class="htool-nav-ic">⇄</span>
    <span class="htool-nav-tx">搜索同步</span>
  </button>
  <button class="htool-nav-btn" data-primary="manage">
    <span class="htool-nav-ic">≡</span>
    <span class="htool-nav-tx">管理</span>
  </button>
  <button class="htool-nav-btn" data-primary="teach">
    <span class="htool-nav-ic">✎</span>
    <span class="htool-nav-tx">教学</span>
  </button>
</div>

<div class="htool-main">
  <div class="htool-hd">
      <div class="htool-hd-left">
      <span class="htool-hd-title">OJ教学工具</span>
      <span class="htool-badge empty" id="htool-page-badge">当前：未识别页面</span>
      <button id="htool-hd-jump" title="在新标签页打开当前训练/比赛" style="display:none;height:22px;padding:0 10px;border:none;border-radius:999px;background:#10b981;color:#fff;font-size:11px;font-weight:800;cursor:pointer;white-space:nowrap;">↗ 跳转</button>
    </div>

    <button class="htool-close" id="htool-close">×</button>
  </div>

  <div class="htool-subnav" id="htool-subnav">
    <button class="htool-sub-btn on" data-secondary="search">搜索题目</button>
    <button class="htool-sub-btn" data-secondary="syncdesc">同步简介</button>
    <button class="htool-sub-btn" data-secondary="syncprob">同步题单</button>
  </div>

  <div class="htool-body">

    <!-- ══ 搜索同步 > 搜索题目 ══ -->
    <div class="htool-view" id="htool-view-search">
      <div class="htool-card">
        <div class="htool-card-title">搜索公共题库</div>
        <div class="htool-row">
          <input class="htool-ipt" id="htool-kw-search" placeholder="题号 / 标题，多个题号用逗号分开">
          <button class="htool-btn" id="htool-run-search">搜索</button>
        </div>
        <div class="htool-row">
          <button class="htool-btn gray" id="htool-search-all" style="flex:1">全选</button>
          <button class="htool-btn gray" id="htool-search-rev" style="flex:1">反选</button>
          <button class="htool-btn gray" id="htool-search-clear" style="flex:1">清空未选</button>
        </div>
      </div>
      <div class="htool-card grow">
        <div class="htool-bar">
          <div class="htool-bar-l">
            <div class="htool-cnt-wrap">已选 <span class="htool-cnt" id="htool-search-cnt">0/0</span></div>
          </div>
          <div class="htool-bar-r">
            <button class="htool-btn" id="htool-run-add">添加到题单</button>
          </div>
        </div>
        <div class="htool-list" id="htool-search-list">
          <div class="htool-empty"><span class="htool-empty-ic">⌕</span><span class="htool-empty-tx">暂无结果</span></div>
        </div>
      </div>
    </div>

    <!-- ══ 搜索同步 > 同步简介 ══ -->
    <div class="htool-view" id="htool-view-syncdesc">
      <div class="htool-card">
        <div class="htool-card-title">来源选择</div>
        <div class="htool-seg htool-seg3">
          <button class="htool-seg-btn on" id="htool-descsrc-group">团队题单</button>
          <button class="htool-seg-btn" id="htool-descsrc-contest">团队比赛</button>
          <button class="htool-seg-btn" id="htool-descsrc-public">公共训练</button>
        </div>
        <div class="htool-grid2" id="htool-descsrc-group-wrap">
          <div id="htool-sel-desc-group"></div>
          <div id="htool-sel-desc-train"></div>
        </div>
        <div class="htool-grid2" id="htool-descsrc-contest-wrap" style="display:none">
          <div id="htool-sel-desc-gcontest"></div>
          <div id="htool-sel-desc-contest"></div>
        </div>
        <div class="htool-grid2" id="htool-descsrc-public-wrap" style="display:none">
          <div id="htool-sel-desc-cat"></div>
          <div id="htool-sel-desc-public"></div>
        </div>
        <div class="htool-row">
          <button class="htool-btn" id="htool-load-desc-source" style="flex:1">加载来源简介</button>
        </div>
      </div>
      <div class="htool-card grow">
        <div class="htool-bar" style="margin-bottom:6px;">
          <div class="htool-card-title">来源简介（可编辑后再同步）</div>
          <div class="htool-bar-r">
            <button class="htool-btn gray" id="htool-sync-desc-tab-edit" onclick="htoolSwitchSyncDescTab('edit')">编辑</button>
            <button class="htool-btn gray" id="htool-sync-desc-tab-preview" onclick="htoolSwitchSyncDescTab('preview')">预览</button>
          </div>
        </div>
        <div id="htool-sync-desc-editor-wrap" style="display:flex;flex-direction:column;flex:1;min-height:0;">
          <textarea class="htool-textarea htool-desc-ta" id="htool-desc-source-preview"
            placeholder="加载来源后将在此显示简介内容..."
            style="flex:1;min-height:0;resize:none;"></textarea>
        </div>
        <div id="htool-sync-desc-preview-wrap" style="display:none;flex-direction:column;flex:1;min-height:0;">
          <div class="htool-md-preview" id="htool-sync-md-preview" style="flex:1;min-height:0;overflow-y:auto;"></div>
        </div>
        <div class="htool-bar" style="margin-top:6px;">
          <span></span>
          <div class="htool-bar-r">
            <button class="htool-btn" id="htool-run-desc-sync">同步到当前</button>
          </div>
        </div>
      </div>
    </div>

    <!-- ══ 搜索同步 > 同步题单 ══ -->
    <div class="htool-view" id="htool-view-syncprob">
      <div class="htool-card">
        <div class="htool-card-title">来源选择</div>
        <div class="htool-seg htool-seg3">
          <button class="htool-seg-btn on" id="htool-probsrc-group">团队题单</button>
          <button class="htool-seg-btn" id="htool-probsrc-contest">团队比赛</button>
          <button class="htool-seg-btn" id="htool-probsrc-public">公共训练</button>
        </div>
        <div class="htool-grid2" id="htool-probsrc-group-wrap">
          <div id="htool-sel-prob-group"></div>
          <div id="htool-sel-prob-train"></div>
        </div>
        <div class="htool-grid2" id="htool-probsrc-contest-wrap" style="display:none">
          <div id="htool-sel-prob-gcontest"></div>
          <div id="htool-sel-prob-contest"></div>
        </div>
        <div class="htool-grid2" id="htool-probsrc-public-wrap" style="display:none">
          <div id="htool-sel-prob-cat"></div>
          <div id="htool-sel-prob-public"></div>
        </div>
        <div class="htool-row">
          <button class="htool-btn" id="htool-load-sync" style="flex:1">加载题目</button>
          <button class="htool-btn gray" id="htool-sync-all">全选</button>
          <button class="htool-btn gray" id="htool-sync-rev">反选</button>
        </div>
      </div>
      <div class="htool-card grow">
        <div class="htool-bar">
          <div class="htool-bar-l">
            <div class="htool-cnt-wrap">已选 <span class="htool-cnt" id="htool-sync-cnt">0/0</span></div>
            <label class="htool-chk">
              <input type="checkbox" id="htool-sync-rank">
              <span id="htool-sync-rank-label">同步题单顺序</span>
            </label>
          </div>
          <div class="htool-bar-r">
            <button class="htool-btn" id="htool-run-sync">同步题目</button>
          </div>
        </div>
        <div class="htool-list" id="htool-sync-list">
          <div class="htool-empty"><span class="htool-empty-ic">∅</span><span class="htool-empty-tx">请先加载</span></div>
        </div>
      </div>
    </div>

    <!-- ══ 管理 > 简介 ══ -->
    <div class="htool-view" id="htool-view-managedesc">
      <div class="htool-card">
        <div class="htool-bar">
          <div class="htool-card-title" id="htool-manage-desc-title">当前训练简介</div>
          <div class="htool-bar-r">
            <button class="htool-btn gray" id="htool-desc-tab-edit" onclick="htoolSwitchDescTab('edit')">编辑</button>
            <button class="htool-btn gray" id="htool-desc-tab-preview" onclick="htoolSwitchDescTab('preview')">预览</button>
            <button class="htool-btn gray" id="htool-reload-desc">重新加载</button>
            <button class="htool-btn" id="htool-save-desc">保存修改</button>
          </div>
        </div>
        <p class="htool-muted">直接编辑下方内容，切换到"预览"查看渲染效果，确认后点击"保存修改"。</p>
      </div>
      <div class="htool-card grow" id="htool-desc-editor-wrap">
        <textarea class="htool-textarea htool-desc-ta" id="htool-manage-desc-editor"
          placeholder="加载中..." style="flex:1;min-height:0;resize:none;"></textarea>
      </div>
      <div class="htool-card grow" id="htool-desc-preview-wrap" style="display:none;">
        <div class="htool-md-preview" id="htool-md-preview"></div>
      </div>
    </div>

    <!-- ══ 管理 > 题单 ══ -->
    <div class="htool-view" id="htool-view-manageprob">
      <div class="htool-card">
        <div class="htool-card-title" id="htool-manage-prob-title">训练题单管理</div>
        <div class="htool-row">
          <input class="htool-ipt" id="htool-kw-delete" placeholder="题号 / 标题筛选">
          <button class="htool-btn gray" id="htool-run-filter">筛选</button>
          <button class="htool-btn gray" id="htool-reset-filter">重置</button>
        </div>
        <div class="htool-row">
          <button class="htool-btn red" id="htool-reload-delete" style="flex:1">重新加载</button>
          <button class="htool-btn gray" id="htool-delete-all">全选</button>
          <button class="htool-btn gray" id="htool-delete-rev">反选</button>
        </div>
      </div>
      <div class="htool-card grow">
        <div class="htool-bar">
          <div class="htool-bar-l">
            <div class="htool-cnt-wrap">已选 <span class="htool-cnt" id="htool-delete-cnt">0/0</span></div>
          </div>
          <div class="htool-bar-r">
            <button class="htool-btn teal" id="htool-save-delete-rank">保存顺序</button>
            <button class="htool-btn red" id="htool-run-delete">删除已选</button>
          </div>
        </div>
        <div class="htool-list" id="htool-delete-list">
          <div class="htool-empty"><span class="htool-empty-ic">⌫</span><span class="htool-empty-tx">加载中...</span></div>
        </div>
      </div>
    </div>

    <!-- ══ 教学 > 题单 ══ -->
    <div class="htool-view" id="htool-view-teachpick">
      <div class="htool-card" style="flex:none;">
        <div class="htool-bar">
          <div class="htool-card-title" id="htool-teach-list-title">题单</div>
          <button class="htool-btn gray" id="htool-teach-reload" style="height:28px;font-size:11px;padding:0 10px;">刷新</button>
        </div>
      </div>
      <div class="htool-card grow">
        <div class="htool-list" id="htool-teach-list" style="flex:1;min-height:0;">
          <div class="htool-empty"><span class="htool-empty-ic">∅</span><span class="htool-empty-tx">加载中...</span></div>
        </div>
      </div>
    </div>

    <!-- ══ 教学 > 题目 ══ -->
    <div class="htool-view" id="htool-view-teachproblem">
      <div class="htool-card" style="flex:none;">
        <div class="htool-bar">
        <button class="htool-btn gray" id="htool-load-page-prob" style="height:28px;font-size:11px;padding:0 10px;">加载当前页面题目</button>
          <div class="htool-card-title" id="htool-teach-prob-title">题目详情</div>
          <div class="htool-bar-r">
            <button class="htool-btn gray" id="htool-teach-to-submit" style="height:28px;font-size:11px;padding:0 10px;">去提交 →</button>
          </div>
        </div>
      </div>
      <div class="htool-card grow">
        <div class="htool-teach-problem-wrap" id="htool-teach-problem" style="flex:1;min-height:0;">
          <span class="htool-muted">请从「题单」中选择题目</span>
        </div>
      </div>
    </div>

    <!-- ══ 教学 > 提交 ══ -->
    <div class="htool-view" id="htool-view-teachsubmit">
    <div class="htool-card" style="flex:none;">
        <div class="htool-bar">
        <div class="htool-card-title" id="htool-teach-submit-title">提交代码</div>
        <div class="htool-bar-r">
        <button class="htool-btn gray" id="htool-load-ac-code" style="height:28px;font-size:11px;padding:0 10px;">获取AC代码</button>
            <select class="htool-ipt" id="htool-teach-lang" style="width:150px;height:30px;font-size:11px;">
            <option>C++ With O2</option>
            </select>
            <select class="htool-ipt" id="htool-teach-theme" style="width:100px;height:30px;font-size:11px;" title="编辑器主题">
            <option value="dark">暗色</option>
            <option value="light">亮色</option>
            </select>
            <div class="htool-fontsize-ctrl" title="字体大小">
            <button id="htool-font-dec">A-</button>
            <span id="htool-font-val">16</span>
            <button id="htool-font-inc">A+</button>
            </div>
            <button class="htool-btn" id="htool-teach-submit">提交</button>
        </div>
        </div>
    </div>

     <div class="htool-card grow" style="overflow:hidden;padding:0;">
        <div id="htool-teach-code-cm" style="flex:1;min-height:0;height:100%;overflow:auto;border-radius:13px;"></div>
    </div>
      <div class="htool-card" style="flex:none;">
        <div id="htool-teach-result" class="htool-teach-result">
          <span class="htool-muted">提交后在此显示评测结果</span>
        </div>
      </div>
    </div>
    <!-- ══ 教学 > 自测 ══ -->
<div class="htool-view" id="htool-view-teachtest">
  <div class="htool-card" style="flex:none;">
    <div class="htool-bar">
    <div class="htool-bar" style="margin-bottom:6px;">
  <div class="htool-bar-l" style="gap:8px;">
    <div class="htool-card-title">在线自测</div>
    <!-- ↓ 新增样例选择器 -->
    <select class="htool-ipt" id="htool-test-sample-sel"
      style="width:140px;height:28px;font-size:11px;display:none;">
      <option value="">选择填充样例...</option>
    </select>
  </div>
</div>
      <div class="htool-bar-r">
        <button class="htool-btn gray" id="htool-test-to-submit" style="height:28px;font-size:11px;padding:0 10px;">← 返回提交</button>
        <button class="htool-btn teal" id="htool-run-test" style="height:28px;font-size:11px;padding:0 12px;">▶ 运行自测</button>
      </div>
    </div>
    <span class="htool-muted">使用「提交」页编辑器中的当前代码进行自测，无需切换页面。</span>
  </div>
  <div class="htool-card grow">
    <div class="htool-test-io" style="flex:1;min-height:0;">
      <div class="htool-test-col">
        <div class="htool-test-col-title">输入数据</div>
        <textarea class="htool-textarea htool-teach-pre" id="htool-test-input"
          placeholder="输入测试数据..." style="flex:1;min-height:0;resize:none;font-size:12px;"></textarea>
      </div>
      <div class="htool-test-col">
        <div class="htool-test-col-title">期望输出（可选）</div>
        <textarea class="htool-textarea htool-teach-pre" id="htool-test-expected"
          placeholder="留空则只显示实际输出..." style="flex:1;min-height:0;resize:none;font-size:12px;"></textarea>
      </div>
    </div>
  </div>
  <div class="htool-card" style="flex:none;">
    <div id="htool-test-result" class="htool-teach-result">
      <span class="htool-muted">点击「运行自测」后在此显示结果</span>
    </div>
  </div>
</div>

    <!-- ══ 教学 > 完成情况 ══ -->
    <div class="htool-view" id="htool-view-teachrank">
      <div class="htool-card" style="flex:none;">
        <div class="htool-bar">
          <div class="htool-card-title" id="htool-rank-title">完成情况</div>
          <div class="htool-bar-r">
            <button class="htool-btn gray" id="htool-rank-reload" style="height:28px;font-size:11px;padding:0 12px;">↻ 刷新</button>
          </div>
        </div>
        <div id="htool-rank-summary" style="display:flex;gap:16px;flex-wrap:wrap;"></div>
      </div>
      <div class="htool-card grow">
        <div id="htool-rank-list" class="htool-list" style="flex:1;min-height:0;">
          <div class="htool-empty"><span class="htool-empty-ic">📊</span><span class="htool-empty-tx">切换到此页自动加载</span></div>
        </div>
      </div>
    </div>


    


  </div><!-- /.htool-body -->

  <div id="htool-log">准备就绪</div>
</div><!-- /.htool-main -->
`;
        document.body.appendChild(fab);
        document.body.appendChild(panel);
    })();

    /* ═══════════════════════════════════════════
       markdown-it 实例
    ═══════════════════════════════════════════ */
    function getMd() {
        if (_md) return _md;
        if (!window.markdownit) return null;

        _md = window.markdownit({
            html: false,
            xhtmlOut: false,
            breaks: true,
            linkify: true,
            typographer: false,
            highlight: function (str, lang) {
                if (lang && window.hljs) {
                    const validLang = window.hljs.getLanguage(lang);
                    try {
                        const code = validLang
                            ? window.hljs.highlight(str, { language: lang, ignoreIllegals: true }).value
                            : window.hljs.highlightAuto(str).value;
                        return '<pre class="hljs htool-teach-pre"><code class="hljs language-' + esc(lang) + '">'
                            + code + '</code></pre>';
                    } catch (e) { }
                }
                return '<pre class="htool-teach-pre"><code>'
                    + _md.utils.escapeHtml(str) + '</code></pre>';
            }
        });

        // 注入 KaTeX 数学公式插件（手动实现，不依赖额外插件包）
        // 支持 $...$ 行内 和 $$...$$ 块级
        function escapedReplace(state, silent) { return false; }

        // 块级 $$...$$
        _md.block.ruler.before('fence', 'math_block', (state, start, end, silent) => {
            let pos = state.bMarks[start] + state.tShift[start];
            let max = state.eMarks[start];
            if (pos + 2 > max) return false;
            if (state.src.slice(pos, pos + 2) !== '$$') return false;
            pos += 2;
            let firstLine = state.src.slice(pos, max).trim();
            if (silent) return true;
            let nextLine = start;
            let found = false;
            if (firstLine.slice(-2) === '$$') { firstLine = firstLine.slice(0, -2).trim(); found = true; }
            let lastLine = '';
            while (!found) {
                nextLine++;
                if (nextLine >= end) break;
                pos = state.bMarks[nextLine] + state.tShift[nextLine];
                max = state.eMarks[nextLine];
                if (pos < max && state.tShift[nextLine] < state.blkIndent) break;
                const line = state.src.slice(pos, max).trim();
                if (line.slice(-2) === '$$') { lastLine = line.slice(0, -2).trim(); found = true; }
            }
            state.line = nextLine + (found ? 1 : 0);
            const token = state.push('math_block', 'math', 0);
            token.block = true;
            token.content = (firstLine ? firstLine + '\n' : '')
                + state.getLines(start + 1, nextLine, state.tShift[start + 1], true)
                + (lastLine ? lastLine : '');
            token.map = [start, state.line];
            token.markup = '$$';
            return true;
        }, { alt: ['paragraph', 'reference', 'blockquote', 'list'] });

        // 行内 $...$
        _md.inline.ruler.after('escape', 'math_inline', (state, silent) => {
            if (state.src[state.pos] !== '$') return false;
            const start = state.pos + 1;
            let end = state.src.indexOf('$', start);
            if (end < 0 || end === start) return false;
            const content = state.src.slice(start, end);
            if (content.includes('\n')) return false;
            if (!silent) {
                const token = state.push('math_inline', 'math', 0);
                token.markup = '$';
                token.content = content;
            }
            state.pos = end + 1;
            return true;
        });

        // 渲染规则
        _md.renderer.rules['math_inline'] = (tokens, idx) => {
            if (!window.katex) return '<code>' + esc(tokens[idx].content) + '</code>';
            try {
                return window.katex.renderToString(tokens[idx].content, { throwOnError: false, displayMode: false });
            } catch (e) { return '<code>' + esc(tokens[idx].content) + '</code>'; }
        };
        _md.renderer.rules['math_block'] = (tokens, idx) => {
            if (!window.katex) return '<pre>' + esc(tokens[idx].content) + '</pre>';
            try {
                return '<div class="htool-math-block">'
                    + window.katex.renderToString(tokens[idx].content, { throwOnError: false, displayMode: true })
                    + '</div>';
            } catch (e) { return '<pre>' + esc(tokens[idx].content) + '</pre>'; }
        };

        return _md;
    }


    function renderMarkdown(md) {
        if (!md || !md.trim()) return '<span style="color:#94a3b8;font-size:12px;">暂无内容</span>';
        const engine = getMd();
        if (!engine) {
            return '<pre style="white-space:pre-wrap;font-size:12px;">'
                + md.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</pre>';
        }
        return engine.render(md);
    }

    /* ═══════════════════════════════════════════
       初始化 makeSelect
    ═══════════════════════════════════════════ */
    selDescGroup = makeSelect('htool-sel-desc-group', '搜索团队', async v => {
        if (!v) return;
        selDescTrain.setOptions([{ value: '', label: '加载中...' }], true);
        try { await loadTrainingOpts(v, selDescTrain); S.syncSourceTid = ''; }
        catch (e) { selDescTrain.setOptions([{ value: '', label: '加载失败' }], true); log('题单加载失败：' + e.message); }
    });

    selDescGroupContest = makeSelect('htool-sel-desc-gcontest', '搜索团队', async v => {
        if (!v) return;
        selDescContest.setOptions([{ value: '', label: '加载中...' }], true);
        try { await loadContestOpts(v, selDescContest); S.syncSourceCid = ''; }
        catch (e) { selDescContest.setOptions([{ value: '', label: '加载失败' }], true); log('比赛加载失败：' + e.message); }
    });

    selDescTrain = makeSelect('htool-sel-desc-train', '搜索题单', async v => { S.syncSourceTid = v || ''; });
    selDescContest = makeSelect('htool-sel-desc-contest', '搜索比赛', async v => { S.syncSourceCid = v || ''; });
    selDescCat = makeSelect('htool-sel-desc-cat', '搜索分类', async v => { await loadPublicTrainingOpts(v); });
    selDescPublic = makeSelect('htool-sel-desc-public', '搜索训练', async v => { S.syncSourceTid = v || ''; });

    selProbGroup = makeSelect('htool-sel-prob-group', '搜索团队', async v => {
        if (!v) return;
        selProbTrain.setOptions([{ value: '', label: '加载中...' }], true);
        try { await loadTrainingOpts(v, selProbTrain); S.syncSourceTid = ''; }
        catch (e) { selProbTrain.setOptions([{ value: '', label: '加载失败' }], true); log('题单加载失败：' + e.message); }
    });

    selProbGroupContest = makeSelect('htool-sel-prob-gcontest', '搜索团队', async v => {
        if (!v) return;
        selProbContest.setOptions([{ value: '', label: '加载中...' }], true);
        try { await loadContestOpts(v, selProbContest); S.syncSourceCid = ''; }
        catch (e) { selProbContest.setOptions([{ value: '', label: '加载失败' }], true); log('比赛加载失败：' + e.message); }
    });

    selProbTrain = makeSelect('htool-sel-prob-train', '搜索题单', async v => { S.syncSourceTid = v || ''; });
    selProbContest = makeSelect('htool-sel-prob-contest', '搜索比赛', async v => { S.syncSourceCid = v || ''; });
    selProbCat = makeSelect('htool-sel-prob-cat', '搜索分类', async v => { await loadPublicTrainingOpts(v); });
    selProbPublic = makeSelect('htool-sel-prob-public', '搜索训练', async v => { S.syncSourceTid = v || ''; });

    /* ═══════════════════════════════════════════
       FAB & 面板定位
    ═══════════════════════════════════════════ */
    function setFabPos() {
        const f = $('#htool-fab');
        if (f) { f.style.left = S.fabX + 'px'; f.style.top = S.fabY + 'px'; }
    }

    function setPanelPos() {
        const p = $('#htool-panel');
        if (!p) return;
        const w = Math.min(900, innerWidth - 12);
        const h = Math.min(660, innerHeight - 12);
        let l = S.fabX + 54;
        if (l + w > innerWidth - 6) l = S.fabX - w - 10;
        l = clamp(l, 6, innerWidth - w - 6);
        const t = clamp(S.fabY - 4, 6, innerHeight - h - 6);
        p.style.left = l + 'px';
        p.style.top = t + 'px';
    }

    function openPanel() {
        refreshTid();
        updateBadge();
        S.open = true;
        setPanelPos();
        $('#htool-panel').classList.add('show');
        switchSecondary(S.secondaryTab);
    }

    function closePanel() {
        S.open = false;
        $('#htool-panel').classList.remove('show');
    }

    setFabPos();

    $('#htool-fab').addEventListener('mousedown', e => {
        let moved = false;
        $('#htool-fab').classList.add('drag');
        const sx = e.clientX, sy = e.clientY, ox = S.fabX, oy = S.fabY;
        const move = ev => {
            const dx = ev.clientX - sx, dy = ev.clientY - sy;
            if (Math.abs(dx) > 3 || Math.abs(dy) > 3) moved = true;
            S.fabX = clamp(ox + dx, 8, innerWidth - 52);
            S.fabY = clamp(oy + dy, 8, innerHeight - 52);
            setFabPos();
            if (S.open) setPanelPos();
        };
        const up = () => {
            removeEventListener('mousemove', move);
            removeEventListener('mouseup', up);
            $('#htool-fab').classList.remove('drag');
            if (!moved) S.open ? closePanel() : openPanel();
        };
        addEventListener('mousemove', move);
        addEventListener('mouseup', up);
    });

    addEventListener('resize', () => {
        S.fabX = clamp(S.fabX, 8, innerWidth - 52);
        S.fabY = clamp(S.fabY, 8, innerHeight - 52);
        setFabPos();
        if (S.open) setPanelPos();
    });

    /* ═══════════════════════════════════════════
       二级 Tab 渲染
    ═══════════════════════════════════════════ */
    function renderSubnav() {
        const subnav = $('#htool-subnav');
        if (!subnav) return;

        const tabMap = {
            sync: ['search', 'syncdesc', 'syncprob'],
            manage: ['managedesc', 'manageprob'],
            teach: ['teachpick', 'teachproblem', 'teachsubmit', 'teachtest', 'teachrank'],
        };
        const labelMap = {
            search: '搜索题目', syncdesc: '同步简介', syncprob: '同步题单',
            managedesc: '简介', manageprob: '题单',
            teachpick: '题单', teachproblem: '题目', teachsubmit: '提交',
            teachtest: '自测', teachrank: '完成情况',
        };

        const tabs = tabMap[S.primaryTab] || [];
        subnav.innerHTML = tabs.map(t =>
            `<button class="htool-sub-btn" data-secondary="${t}">${labelMap[t]}</button>`
        ).join('');

        $$('.htool-sub-btn', subnav).forEach(btn => {
            btn.classList.toggle('on', btn.dataset.secondary === S.secondaryTab);
            btn.onclick = () => {
                refreshTid();
                switchSecondary(btn.dataset.secondary);
            };
        });
    }


    /* ═══════════════════════════════════════════
       简介 Tab 切换
    ═══════════════════════════════════════════ */
    window.htoolSwitchDescTab = function (tab) {
        const editWrap = $('#htool-desc-editor-wrap');
        const previewWrap = $('#htool-desc-preview-wrap');
        const editBtn = $('#htool-desc-tab-edit');
        const previewBtn = $('#htool-desc-tab-preview');
        const editor = $('#htool-manage-desc-editor');
        const previewEl = $('#htool-md-preview');
        if (tab === 'preview') {
            if (editWrap) editWrap.style.display = 'none';
            if (previewWrap) previewWrap.style.display = 'flex';
            editBtn?.classList.remove('tab-on');
            previewBtn?.classList.add('tab-on');
            if (previewEl && editor) previewEl.innerHTML = renderMarkdown(editor.value);
        } else {
            if (editWrap) editWrap.style.display = 'flex';
            if (previewWrap) previewWrap.style.display = 'none';
            editBtn?.classList.add('tab-on');
            previewBtn?.classList.remove('tab-on');
        }
    };

    window.htoolSwitchSyncDescTab = function (tab) {
        const editWrap = $('#htool-sync-desc-editor-wrap');
        const previewWrap = $('#htool-sync-desc-preview-wrap');
        const editBtn = $('#htool-sync-desc-tab-edit');
        const previewBtn = $('#htool-sync-desc-tab-preview');
        const editor = $('#htool-desc-source-preview');
        const previewEl = $('#htool-sync-md-preview');
        if (tab === 'preview') {
            if (editWrap) editWrap.style.display = 'none';
            if (previewWrap) previewWrap.style.display = 'flex';
            editBtn?.classList.remove('tab-on');
            previewBtn?.classList.add('tab-on');
            if (previewEl && editor) previewEl.innerHTML = renderMarkdown(editor.value);
        } else {
            if (editWrap) editWrap.style.display = 'flex';
            if (previewWrap) previewWrap.style.display = 'none';
            editBtn?.classList.add('tab-on');
            previewBtn?.classList.remove('tab-on');
        }
    };

    /* ═══════════════════════════════════════════
       事件绑定
    ═══════════════════════════════════════════ */
    $('#htool-close').onclick = closePanel;
    $('#htool-load-ac-code').onclick = loadAcCode;
    $('#htool-load-page-prob').onclick = () => {
        S.teachManualPick = false;  // 重置手动标记，允许重新加载
        loadProblemFromCurrentPage();
    };


    // 一级导航
    $$('.htool-nav-btn').forEach(btn => btn.onclick = () => {
        refreshTid();
        S.primaryTab = btn.dataset.primary;
        $$('.htool-nav-btn').forEach(b => b.classList.toggle('on', b.dataset.primary === S.primaryTab));
        renderSubnav();
        const defaultSub = SECONDARY_TABS[S.primaryTab][0];
        switchSecondary(defaultSub);
    });

    // ── 同步简介：来源切换 ──
    $('#htool-descsrc-group').onclick = () => {
        S.descSourceType = 'group';
        ['group', 'contest', 'public'].forEach(t => $('#htool-descsrc-' + t)?.classList.toggle('on', t === 'group'));
        $('#htool-descsrc-group-wrap').style.display = 'grid';
        $('#htool-descsrc-contest-wrap').style.display = 'none';
        $('#htool-descsrc-public-wrap').style.display = 'none';
        if (S.groups.length) selDescGroup.setOptions(groupOpts(), true);
    };
    $('#htool-descsrc-contest').onclick = () => {
        S.descSourceType = 'contest';
        ['group', 'contest', 'public'].forEach(t => $('#htool-descsrc-' + t)?.classList.toggle('on', t === 'contest'));
        $('#htool-descsrc-group-wrap').style.display = 'none';
        $('#htool-descsrc-contest-wrap').style.display = 'grid';
        $('#htool-descsrc-public-wrap').style.display = 'none';
        if (S.groups.length) selDescGroupContest.setOptions(groupOpts(), true);
    };
    $('#htool-descsrc-public').onclick = () => {
        S.descSourceType = 'public';
        ['group', 'contest', 'public'].forEach(t => $('#htool-descsrc-' + t)?.classList.toggle('on', t === 'public'));
        $('#htool-descsrc-group-wrap').style.display = 'none';
        $('#htool-descsrc-contest-wrap').style.display = 'none';
        $('#htool-descsrc-public-wrap').style.display = 'grid';
        if (!S.publicCategoryLoaded) ensurePublicCategories('desc');
    };

    // ── 同步题单：来源切换 ──
    $('#htool-probsrc-group').onclick = () => {
        S.probSourceType = 'group';
        ['group', 'contest', 'public'].forEach(t => $('#htool-probsrc-' + t)?.classList.toggle('on', t === 'group'));
        $('#htool-probsrc-group-wrap').style.display = 'grid';
        $('#htool-probsrc-contest-wrap').style.display = 'none';
        $('#htool-probsrc-public-wrap').style.display = 'none';
        S.syncList = []; S.checkedSync.clear();
        render($('#htool-sync-list'), [], S.checkedSync, $('#htool-sync-cnt'), '∅', '请先加载');
        if (S.groups.length) selProbGroup.setOptions(groupOpts(), true);
    };
    $('#htool-probsrc-contest').onclick = () => {
        S.probSourceType = 'contest';
        ['group', 'contest', 'public'].forEach(t => $('#htool-probsrc-' + t)?.classList.toggle('on', t === 'contest'));
        $('#htool-probsrc-group-wrap').style.display = 'none';
        $('#htool-probsrc-contest-wrap').style.display = 'grid';
        $('#htool-probsrc-public-wrap').style.display = 'none';
        S.syncList = []; S.checkedSync.clear();
        render($('#htool-sync-list'), [], S.checkedSync, $('#htool-sync-cnt'), '∅', '请先加载');
        if (S.groups.length) selProbGroupContest.setOptions(groupOpts(), true);
    };
    $('#htool-probsrc-public').onclick = () => {
        S.probSourceType = 'public';
        ['group', 'contest', 'public'].forEach(t => $('#htool-probsrc-' + t)?.classList.toggle('on', t === 'public'));
        $('#htool-probsrc-group-wrap').style.display = 'none';
        $('#htool-probsrc-contest-wrap').style.display = 'none';
        $('#htool-probsrc-public-wrap').style.display = 'grid';
        S.syncList = []; S.checkedSync.clear();
        render($('#htool-sync-list'), [], S.checkedSync, $('#htool-sync-cnt'), '∅', '请先加载');
        if (!S.publicCategoryLoaded) ensurePublicCategories('prob');
    };


    // ── 同步简介操作 ──
    $('#htool-load-desc-source').onclick = loadDescSource;
    $('#htool-run-desc-sync').onclick = runDescSync;

    // ── 同步简介实时预览 ──
    document.addEventListener('input', e => {
        if (e.target.id === 'htool-desc-source-preview') {
            const previewWrap = $('#htool-sync-desc-preview-wrap');
            if (previewWrap && previewWrap.style.display !== 'none') {
                const previewEl = $('#htool-sync-md-preview');
                if (previewEl) previewEl.innerHTML = renderMarkdown(e.target.value);
            }
        }
    });

    // ── 管理简介实时预览 ──
    document.addEventListener('input', e => {
        if (e.target.id !== 'htool-manage-desc-editor') return;
        const previewWrap = $('#htool-desc-preview-wrap');
        if (previewWrap && previewWrap.style.display !== 'none') {
            const previewEl = $('#htool-md-preview');
            if (previewEl) previewEl.innerHTML = renderMarkdown(e.target.value);
        }
    });

    // ── 同步题单操作 ──
    $('#htool-load-sync').onclick = loadSyncProblems;
    $('#htool-sync-all').onclick = () => {
        S.syncList.forEach(p => S.checkedSync.add(ppv(p)));
        render($('#htool-sync-list'), S.syncList, S.checkedSync, $('#htool-sync-cnt'), '∅', '请先加载');
    };
    $('#htool-sync-rev').onclick = () => {
        const n = new Set();
        S.syncList.forEach(p => { if (!S.checkedSync.has(ppv(p))) n.add(ppv(p)); });
        S.checkedSync = n;
        render($('#htool-sync-list'), S.syncList, S.checkedSync, $('#htool-sync-cnt'), '∅', '请先加载');
    };
    $('#htool-run-sync').onclick = runSync;

    // ── 搜索题目操作 ──
    $('#htool-run-search').onclick = runSearch;
    $('#htool-kw-search').addEventListener('keydown', e => { if (e.key === 'Enter') runSearch(); });
    $('#htool-search-all').onclick = () => {
        S.searchList.forEach(p => S.checkedSearch.add(ppv(p)));
        render($('#htool-search-list'), S.searchList, S.checkedSearch, $('#htool-search-cnt'), '⌕', '暂无结果');
    };
    $('#htool-search-rev').onclick = () => {
        const n = new Set();
        S.searchList.forEach(p => { if (!S.checkedSearch.has(ppv(p))) n.add(ppv(p)); });
        S.checkedSearch = n;
        render($('#htool-search-list'), S.searchList, S.checkedSearch, $('#htool-search-cnt'), '⌕', '暂无结果');
    };
    $('#htool-search-clear').onclick = () => {
        S.searchList = S.searchList.filter(p => S.checkedSearch.has(ppv(p)));
        render($('#htool-search-list'), S.searchList, S.checkedSearch, $('#htool-search-cnt'), '⌕', '暂无结果');
        log('已清空未勾选结果');
    };
    $('#htool-run-add').onclick = runAdd;

    // ── 简介：重新加载 & 保存 ──
    $('#htool-reload-desc').onclick = autoLoadCurrentDesc;
    $('#htool-save-desc').onclick = saveCurrentDesc;

    // ── 管理>题单操作 ──
    $('#htool-reload-delete').onclick = reloadDelete;
    $('#htool-run-filter').onclick = () => {
        refreshTid();
        const q = $('#htool-kw-delete').value.trim().toLowerCase();
        S.deleteList = q
            ? S.deleteRaw.filter(p => sid(p).toLowerCase().includes(q) || ptitle(p).toLowerCase().includes(q))
            : S.deleteRaw;
        renderDeleteList($('#htool-delete-list'), S.deleteList, S.checkedDelete, $('#htool-delete-cnt'));
        log(q ? '筛选后 ' + S.deleteList.length + ' 题' : '已重置筛选');
    };
    $('#htool-reset-filter').onclick = () => {
        $('#htool-kw-delete').value = '';
        S.deleteList = S.deleteRaw;
        renderDeleteList($('#htool-delete-list'), S.deleteList, S.checkedDelete, $('#htool-delete-cnt'));
        log('已重置筛选');
    };
    $('#htool-kw-delete').addEventListener('keydown', e => { if (e.key === 'Enter') $('#htool-run-filter').click(); });
    $('#htool-delete-all').onclick = () => {
        S.deleteList.forEach(p => S.checkedDelete.add(ppv(p)));
        renderDeleteList($('#htool-delete-list'), S.deleteList, S.checkedDelete, $('#htool-delete-cnt'));
    };
    $('#htool-delete-rev').onclick = () => {
        const n = new Set();
        S.deleteList.forEach(p => { if (!S.checkedDelete.has(ppv(p))) n.add(ppv(p)); });
        S.checkedDelete = n;
        renderDeleteList($('#htool-delete-list'), S.deleteList, S.checkedDelete, $('#htool-delete-cnt'));
    };

    $('#htool-save-delete-rank').onclick = async () => {
        refreshTid();
        if (S.pageType !== 'training' && S.pageType !== 'contest') return alert('请在训练页面或比赛页面运行');
        if (S.pageType === 'training' && !S.targetTid) return alert('请在目标训练页面运行');
        if (S.pageType === 'contest' && !S.targetCid) return alert('请在目标比赛页面运行');
        if (!S.deleteList.length) return alert('当前没有可排序的题目');
        if (S.deleteList.length !== S.deleteRaw.length) return alert('当前处于筛选状态，请先点击"重置"再保存顺序');
        const msg = S.pageType === 'contest'
            ? '确定按当前顺序重建比赛题单吗？这会先删除所有题目，再按 A、B、C... 重新添加。'
            : '确定按当前顺序更新题单 rank 吗？';
        if (!confirm(msg)) return;
        setBusy(true);
        try {
            if (S.pageType === 'training') {
                await syncRanksBySourceOrder(S.deleteList.map((p, i) => ({ ...p, _srcRank: i + 1 })));
                log('题单顺序保存成功'); alert('题单顺序保存成功');
            } else {
                await rebuildContestProblemsByOrder(S.deleteList);
                log('比赛题单顺序保存成功'); alert('比赛题单顺序保存成功');
            }
            await reloadDelete();
        } catch (e) {
            log('保存顺序失败：' + e.message); alert('保存顺序失败：' + e.message);
        } finally { setBusy(false); }
    };

    $('#htool-run-delete').onclick = async () => {
        refreshTid();
        if (S.pageType !== 'training' && S.pageType !== 'contest') return alert('请在训练页面或比赛页面运行');
        const list = S.deleteList.filter(p => S.checkedDelete.has(ppv(p)));
        if (!list.length) return alert('请至少选择一道题目');
        if (!confirm('确定删除 ' + list.length + ' 道题目吗？')) return;
        setBusy(true);
        let ok = 0, bad = [];
        try {
            for (let i = 0; i < list.length; i++) {
                const p = list[i];
                log('删除 ' + (i + 1) + '/' + list.length + '：' + sid(p));
                try {
                    if (S.pageType === 'contest') await retry(() => delContestProblem(p));
                    else await retry(() => delTrainingProblem(p));
                    ok++; S.checkedDelete.delete(ppv(p));
                } catch (e) { bad.push({ id: sid(p), reason: e.message || '未知错误' }); }
                await sleep(200);
            }
            if (S.pageType === 'contest') {
                const remainList = S.deleteRaw.filter(p =>
                    !list.some(x => ppv(x) === ppv(p) && !bad.some(b => b.id === sid(x)))
                );
                try {
                    log('重建比赛题目顺序...');
                    await rebuildContestProblemsByOrder(remainList);
                } catch (e) { bad.push({ id: '[顺序重建失败]', reason: e.message || '未知错误' }); }
            }
        } finally { setBusy(false); }
        S.deleteRaw = S.deleteRaw.filter(p =>
            !list.some(x => ppv(x) === ppv(p) && !bad.some(b => b.id === sid(x)))
        );
        S.deleteList = S.deleteList.filter(p =>
            !list.some(x => ppv(x) === ppv(p) && !bad.some(b => b.id === sid(x)))
        );
        renderDeleteList($('#htool-delete-list'), S.deleteList, S.checkedDelete, $('#htool-delete-cnt'));
        log('删除完成：成功 ' + ok + '，失败 ' + bad.length);
        alert('删除完成：成功 ' + ok + '，失败 ' + bad.length
            + (bad.length ? '\n\n' + bad.slice(0, 10).map(x => '- ' + x.id + '：' + x.reason).join('\n') : ''));
        if (S.pageType === 'contest') await reloadDelete();
    };

    // ── 教学模块事件绑定 ──
    $('#htool-teach-reload').onclick = () => autoLoadTeachProblems();
    // 题目页：去提交
    $('#htool-teach-to-submit').onclick = () => switchSecondary('teachsubmit');

    // 提交页：返回题目
    //$('#htool-teach-to-problem').onclick = () => switchSecondary('teachproblem');

    $('#htool-teach-submit').onclick = submitTeach;

    $('#htool-teach-lang').addEventListener('change', e => {
        S.teach.language = e.target.value;
        switchCmLanguage(e.target.value).catch(() => { });
    });
    // 主题切换
    $('#htool-teach-theme').addEventListener('change', e => {
        S.teach.theme = e.target.value;
        switchCmLanguage(S.teach.language).catch(() => { });  // 复用重建逻辑
    });
    $('#htool-test-to-submit').onclick = () => switchSecondary('teachsubmit');
    // 字体大小
    const FONT_MIN = 10, FONT_MAX = 20;

    function updateFontSize(delta) {
        S.teach.fontSize = Math.min(FONT_MAX, Math.max(FONT_MIN, S.teach.fontSize + delta));
        const fontVal = $('#htool-font-val');
        if (fontVal) fontVal.textContent = S.teach.fontSize;
        $('#htool-font-dec').disabled = S.teach.fontSize <= FONT_MIN;
        $('#htool-font-inc').disabled = S.teach.fontSize >= FONT_MAX;
        if (_cmView) {
            const fs = S.teach.fontSize + 'px';
            _cmView.dom.style.fontSize = fs;
            const content = _cmView.dom.querySelector('.cm-content');
            if (content) content.style.fontSize = fs;
            const gutters = _cmView.dom.querySelector('.cm-gutters');
            if (gutters) gutters.style.fontSize = fs;
        }
    }



    $('#htool-font-dec').onclick = () => updateFontSize(-1);
    $('#htool-font-inc').onclick = () => updateFontSize(+1);
    /* ═══════════════════════════════════════════
   完成情况
═══════════════════════════════════════════ */
    async function autoLoadTeachRank(force) {
        refreshTid();
        const listEl = $('#htool-rank-list');
        const summaryEl = $('#htool-rank-summary');
        const titleEl = $('#htool-rank-title');
        if (!listEl) return;

        const tid = S.targetTid;
        const cid = S.targetCid;
        const type = S.pageType || S.manualTargetType;

        if (!type || (!tid && !cid)) {
            listEl.innerHTML = '<div class="htool-empty"><span class="htool-empty-ic">⚠</span><span class="htool-empty-tx">请先选择训练或比赛</span></div>';
            return;
        }

        // 获取当前选中的题目 pid/displayId，用于高亮该题完成情况
        const curPid = S.teach.currentDisplayId || S.teach.currentPid || '';

        listEl.innerHTML = '<div class="htool-empty"><span class="htool-ai-spin"></span><span class="htool-empty-tx">加载中...</span></div>';
        if (summaryEl) summaryEl.innerHTML = '';

        try {
            let records = [], problems = [];

            if (type === 'training') {
                if (titleEl) titleEl.textContent = '训练完成情况';
                const r = await req('/api/oj/get-training-rank?tid=' + encodeURIComponent(tid));
                records = r?.data?.records || [];
                // 从已加载的题单拿题目列表
                problems = S.teach.problems.length ? S.teach.problems : [];
            } else {
                if (titleEl) titleEl.textContent = '比赛完成情况';
                const r = await req('/api/oj/get-contest-rank', 'POST', {
                    currentPage: 1, limit: 200, cid: parseInt(cid, 10),
                    forceRefresh: !!force, removeStar: false, concernedList: [], keyword: null
                });
                records = r?.data?.records || [];
                problems = S.teach.problems.length ? S.teach.problems : [];
            }

            if (!records.length) {
                listEl.innerHTML = '<div class="htool-empty"><span class="htool-empty-ic">∅</span><span class="htool-empty-tx">暂无参与数据</span></div>';
                return;
            }

            // ── 统计摘要 ──
            const total = records.length;
            if (type === 'training') {
                // 训练：统计当前题目的 AC 人数
                const acCount = curPid
                    ? records.filter(r => r.submissionInfo?.[curPid]?.isAC).length
                    : records.filter(r => r.ac > 0).length;
                const acRate = total ? Math.round(acCount / total * 100) : 0;
                const avgAc = total ? (records.reduce((s, r) => s + (r.ac || 0), 0) / total).toFixed(1) : 0;

                if (summaryEl) summaryEl.innerHTML = [
                    ['👥 参与人数', total],
                    curPid ? ['✅ 本题AC', acCount + ' (' + acRate + '%)'] : ['✅ 有AC', acCount],
                    ['📈 人均AC题', avgAc],
                ].map(([label, val]) =>
                    '<div style="background:#f1f5f9;border-radius:10px;padding:8px 14px;display:flex;flex-direction:column;gap:2px;">' +
                    '<span style="font-size:10px;font-weight:800;color:#64748b;">' + label + '</span>' +
                    '<span style="font-size:16px;font-weight:900;color:#0f172a;">' + val + '</span>' +
                    '</div>'
                ).join('');

                // ── 训练排名表 ──
                listEl.innerHTML = records.map((r, i) => {
                    const curInfo = curPid ? r.submissionInfo?.[curPid] : null;
                    const isAC = curInfo?.isAC;
                    const score = curInfo?.score ?? '-';
                    const acTotal = r.ac || 0;
                    const avatar = r.avatar
                        ? '<img src="' + esc(r.avatar) + '" style="width:22px;height:22px;border-radius:50%;object-fit:cover;flex:none;" onerror="this.style.display=\'none\'">'
                        : '<div style="width:22px;height:22px;border-radius:50%;background:#e2e8f0;flex:none;"></div>';
                    const rankColor = i === 0 ? '#f59e0b' : i === 1 ? '#94a3b8' : i === 2 ? '#cd7f32' : '#64748b';
                    return '<div style="display:grid;grid-template-columns:28px 22px 1fr auto auto;gap:6px;align-items:center;padding:8px 10px;border-bottom:1px solid rgba(148,163,184,.09);">' +
                        '<span style="font-size:12px;font-weight:900;color:' + rankColor + ';text-align:center;">' + (i + 1) + '</span>' +
                        avatar +
                        '<div style="min-width:0;">' +
                        '<div class="htool-stu-name" '
                        + 'data-sc="' + esc(r.username || '') + '" '
                        + 'title="' + esc(r.username || '') + '" '
                        + 'style="font-size:12px;font-weight:800;color:#0f172a;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'
                        + esc(r.nickname || r.username || '未知')
                        + '</div>' +

                        (r.school ? '<div style="font-size:10px;color:#94a3b8;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + esc(r.school) + '</div>' : '') +
                        '</div>' +
                        '<span style="font-size:11px;color:#475569;white-space:nowrap;">AC ' + acTotal + '</span>' +
                        (curPid
                            ? '<span style="font-size:11px;font-weight:800;padding:2px 8px;border-radius:999px;white-space:nowrap;' +
                            (isAC ? 'background:#ecfdf5;color:#047857;' : score > 0 ? 'background:#fef9c3;color:#92400e;' : 'background:#f1f5f9;color:#94a3b8;') + '">' +
                            (isAC ? '✓ AC' : score !== '-' && score > 0 ? score + '分' : '—') + '</span>'
                            : '<span></span>') +
                        '</div>';
                }).join('');
                applyRealNamesToList('#htool-rank-list');

            } else {
                // 比赛：统计当前题目得分
                const displayId = S.teach.currentDisplayId || curPid;
                const acCount = displayId
                    ? records.filter(r => (r.submissionInfo?.[displayId] ?? 0) >= 100).length
                    : records.filter(r => (r.totalScore || 0) > 0).length;
                const acRate = total ? Math.round(acCount / total * 100) : 0;
                const avgScore = total
                    ? (records.reduce((s, r) => s + (r.totalScore || 0), 0) / total).toFixed(1)
                    : 0;

                if (summaryEl) summaryEl.innerHTML = [
                    ['👥 参与人数', total],
                    displayId ? ['✅ 本题AC', acCount + ' (' + acRate + '%)'] : ['✅ 有得分', acCount],
                    ['📊 人均总分', avgScore],
                ].map(([label, val]) =>
                    '<div style="background:#f1f5f9;border-radius:10px;padding:8px 14px;display:flex;flex-direction:column;gap:2px;">' +
                    '<span style="font-size:10px;font-weight:800;color:#64748b;">' + label + '</span>' +
                    '<span style="font-size:16px;font-weight:900;color:#0f172a;">' + val + '</span>' +
                    '</div>'
                ).join('');

                // ── 比赛排名表 ──
                listEl.innerHTML = records.map((r, i) => {
                    const score = displayId ? (r.submissionInfo?.[displayId] ?? null) : null;
                    const isAC = score >= 100;
                    const rankColor = i === 0 ? '#f59e0b' : i === 1 ? '#94a3b8' : i === 2 ? '#cd7f32' : '#64748b';
                    const awardBadge = r.awardName
                        ? '<span style="font-size:10px;font-weight:800;padding:1px 6px;border-radius:999px;background:' + esc(r.awardBackground || '#e2e8f0') + ';color:' + esc(r.awardColor || '#fff') + ';">' + esc(r.awardName) + '</span>'
                        : '';
                    const avatar = r.avatar
                        ? '<img src="' + esc(r.avatar) + '" style="width:22px;height:22px;border-radius:50%;object-fit:cover;flex:none;" onerror="this.style.display=\'none\'">'
                        : '<div style="width:22px;height:22px;border-radius:50%;background:#e2e8f0;flex:none;"></div>';
                    return '<div style="display:grid;grid-template-columns:28px 22px 1fr auto auto;gap:6px;align-items:center;padding:8px 10px;border-bottom:1px solid rgba(148,163,184,.09);">' +
                        '<span style="font-size:12px;font-weight:900;color:' + rankColor + ';text-align:center;">' + (r.rank ?? i + 1) + '</span>' +
                        avatar +
                        '<div style="min-width:0;">' +
                        '<div style="display:flex;align-items:center;gap:4px;">' +
                        '<span class="htool-stu-name" '
                        + 'data-sc="' + esc(r.username || '') + '" '
                        + 'title="' + esc(r.username || '') + '" '
                        + 'style="font-size:12px;font-weight:800;color:#0f172a;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'
                        + esc(r.nickname || r.username || '未知')
                        + '</span>' +

                        awardBadge +
                        '</div>' +
                        (r.school ? '<div style="font-size:10px;color:#94a3b8;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + esc(r.school) + '</div>' : '') +
                        '</div>' +
                        '<span style="font-size:11px;color:#475569;white-space:nowrap;">总分 ' + (r.totalScore ?? 0) + '</span>' +
                        (displayId !== ''
                            ? '<span style="font-size:11px;font-weight:800;padding:2px 8px;border-radius:999px;white-space:nowrap;' +
                            (isAC ? 'background:#ecfdf5;color:#047857;' : score > 0 ? 'background:#fef9c3;color:#92400e;' : 'background:#f1f5f9;color:#94a3b8;') + '">' +
                            (score === null ? '—' : isAC ? '✓ AC' : score + '分') + '</span>'
                            : '<span></span>') +
                        '</div>';
                }).join('');
                applyRealNamesToList('#htool-rank-list');

            }

            log('完成情况已加载：' + total + ' 人');
        } catch (e) {
            listEl.innerHTML = '<div class="htool-empty"><span class="htool-empty-ic">✕</span><span class="htool-empty-tx">加载失败：' + esc(e.message) + '</span></div>';
            log('完成情况加载失败：' + e.message);
        }
    }

    $('#htool-run-test').onclick = runTestJudge;
    $('#htool-rank-reload').onclick = () => autoLoadTeachRank(true);
    $('#htool-test-sample-sel').addEventListener('change', e => {
        const idx = e.target.value;
        if (idx === '') return;
        const s = S.teach._samples?.[+idx];
        if (!s) return;
        const inputEl = $('#htool-test-input');
        const expectedEl = $('#htool-test-expected');
        if (inputEl) inputEl.value = String(s.input || '').replace(/^\n/, '');
        if (expectedEl) expectedEl.value = String(s.output || '').replace(/^\n/, '');
        // 填充后重置为提示文字，方便下次再选
        e.target.value = '';
    });




    /* ═══════════════════════════════════════════
       初始化
    ═══════════════════════════════════════════ */
    updateBadge();
    renderSubnav();
    switchSecondary('search');
    // 确保 subnav 内的按钮事件在 switchSecondary 之后再绑定一次
    $$('.htool-sub-btn', $('#htool-subnav')).forEach(btn => {
        btn.onclick = () => {
            refreshTid();
            switchSecondary(btn.dataset.secondary);
        };
    });
    initGroups();

    log(
        S.pageType === 'training' ? '题单工具箱已就绪'
            : S.pageType === 'contest' ? '比赛工具箱已就绪'
                : '未检测到 tid/cid，请在训练页面或比赛页面使用'
    );

    // URL 变化监听
    let lastUrl = location.href;
    setInterval(() => {
        if (location.href !== lastUrl) {
            lastUrl = location.href;
            refreshTid();
            updateBadge();
        }
    }, 500);

})();

