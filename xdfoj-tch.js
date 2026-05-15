(function () {
    'use strict';
    if (window.__DevHOJ) { alert('DevC++ XDFOJ 已在运行'); return; }
    window.__DevHOJ = 1;


    function isAllowedPage() {
        try {
            var host = location.hostname;
            var path = location.pathname || '';
            // 严格匹配：host 必须是 code.xdf.cn，路径必须以 /oj 开头
            return host === 'code.xdf.cn' && (path === '/oj' || path.indexOf('/oj/') === 0 || path.indexOf('/oj') === 0);
        } catch (e) {
            return false;
        }
    }
    if (!isAllowedPage()) {
        window.__DevHOJ = 0;
        return;
    }
    /* ============== 工具 ============== */

    const $ = (s, p = document) => p.querySelector(s);
    const $$ = (s, p = document) => [...p.querySelectorAll(s)];
    const esc = s => String(s ?? '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    let _md = null;

    function getMd() {
        if (_md) return _md;
        if (!window.markdownit) return null;
        
        _md = window.markdownit({
            html: false,
            xhtmlOut: false,
            breaks: true,
            linkify: false,
            typographer: false
        });

        // 不再 disable emphasis，* 和 _ 的加粗斜体全部正常工作
        // LaTeX 下标冲突问题在 renderMarkdown 的占位保护阶段处理

        return _md;
    }


    function renderMarkdown(text) {
        if (text == null || !String(text).trim()) return '';
        var md = getMd();

        // ── 在 markdown 渲染前，把 $...$ 和 $$...$$ 占位保护 ──
        var mathBlocks = [];
        var str = String(text);

        // 先保护 $$...$$（多行/行间公式），再保护 $...$（行内公式）
        str = str.replace(/\$\$([\s\S]*?)\$\$/g, function (_, inner) {
            var idx = mathBlocks.length;
            mathBlocks.push({ type: 'block', content: inner });
            return '\x02MATH_BLOCK_' + idx + '\x03';
        });
        str = str.replace(/\$([^\$\n]+?)\$/g, function (_, inner) {
            var idx = mathBlocks.length;
            mathBlocks.push({ type: 'inline', content: inner });
            return '\x02MATH_INLINE_' + idx + '\x03';
        });

        var html;
        if (!md) {
            html = '<pre style="white-space:pre-wrap;font-size:12px;">' + esc(str) + '</pre>';
        } else {
            html = md.render(str);
        }

        // ── 还原占位符为原始 $...$ 形式（让 KaTeX 的 auto-render 来处理）──
        html = html.replace(/\x02MATH_BLOCK_(\d+)\x03/g, function (_, idx) {
            return '$$' + mathBlocks[+idx].content + '$$';
        });
        html = html.replace(/\x02MATH_INLINE_(\d+)\x03/g, function (_, idx) {
            return '$' + mathBlocks[+idx].content + '$';
        });

        return html;
    }



    const token = () => {
        for (const k of ['token', 'sharding-oj-token', 'admin-token', 'vuex']) {
            const v = localStorage.getItem(k); if (!v) continue;
            if (k === 'vuex') { try { const j = JSON.parse(v); if (j.user?.token) return j.user.token; } catch (e) { } }
            else return v;
        }
        return '';
    };

    async function req(url, method = 'GET', body) {
        const h = {
            'Content-Type': 'application/json',
            'Accept': 'application/json, text/plain, */*'
        };

        const tk = token();
        if (tk) {
            h.Authorization = tk;
            h.token = tk;
            h['sharding-oj-token'] = tk;
        }

        const r = await fetch(url, {
            method: method,
            headers: h,
            credentials: 'include',
            body: body ? JSON.stringify(body) : undefined
        });

        var text = '';
        try {
            text = await r.text();
        } catch (e) { }

        var j = null;
        try {
            j = text ? JSON.parse(text) : null;
        } catch (e) {
            if (r.ok) {
                throw new Error('接口返回的不是 JSON，可能请求到了页面路由: ' + url);
            }
            throw new Error('HTTP ' + r.status);
        }

        if (j && (j.status === 200 || j.code === 200)) return j;

        throw new Error(
            (j && (j.msg || j.message))
            || ('HTTP ' + r.status)
        );
    }

    /* ============== 权限检查 API ============== */
    async function checkGroupAccess(gid) {
        var r = await req('/api/oj/get-group-access?gid=' + encodeURIComponent(gid));
        return (r && r.data && r.data.access === true);
    }
    async function checkTrainingAccess(tid) {
        var r = await req('/api/oj/get-training-access?tid=' + encodeURIComponent(tid));
        return (r && r.data && r.data.access === true);
    }
    async function registerTraining(tid, password) {
        return await req('/api/oj/register-training', 'POST', {
            tid: String(tid), password: String(password)
        });
    }
    async function checkContestAccess(cid) {
        var r = await req('/api/oj/get-contest-access?cid=' + encodeURIComponent(cid));
        return (r && r.data && r.data.access === true);
    }
    async function registerContest(cid, password) {
        return await req('/api/oj/register-contest', 'POST', {
            cid: String(cid), password: String(password)
        });
    }

    /* ============== 密码输入弹窗 ============== */
    function promptPassword(title, label) {
        return new Promise(function (resolve) {
            var overlay = document.createElement('div');
            overlay.style.cssText = 'position:fixed;inset:0;z-index:2000001;background:rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;font-family:"Microsoft YaHei","Segoe UI",sans-serif;';
            overlay.innerHTML =
                '<div style="background:#ECE9D8;border:2px solid #fff;box-shadow:0 0 0 1px #404040,4px 4px 12px rgba(0,0,0,.4);width:360px;">' +
                '<div style="height:24px;background:linear-gradient(to bottom,#0058E1,#3A93FF);color:#fff;font-weight:bold;padding:0 8px;display:flex;align-items:center;font-size:12px;">' + esc(title || '需要密码') + '</div>' +
                '<div style="padding:14px;">' +
                '<div style="margin-bottom:10px;font-size:12px;">' + esc(label || '该项目') + ' 设有访问密码，请输入后继续。</div>' +
                '<input id="dev-pwd-ipt" type="password" placeholder="请输入密码" style="width:100%;height:26px;padding:0 6px;border:1px solid #7F9DB9;font-size:12px;box-sizing:border-box;margin-bottom:12px;font-family:inherit;">' +
                '<div style="text-align:right;">' +
                '<button id="dev-pwd-cancel" style="height:26px;padding:0 16px;background:#ECE9D8;border:1px solid #ACA899;cursor:pointer;font-size:11px;margin-right:6px;font-family:inherit;">取消</button>' +
                '<button id="dev-pwd-ok" style="height:26px;padding:0 16px;background:#ECE9D8;border:1px solid #ACA899;cursor:pointer;font-size:11px;font-weight:bold;font-family:inherit;">确认</button>' +
                '</div></div></div>';
            document.body.appendChild(overlay);
            var ipt = overlay.querySelector('#dev-pwd-ipt');
            var okBtn = overlay.querySelector('#dev-pwd-ok');
            var cancelBtn = overlay.querySelector('#dev-pwd-cancel');
            var done = function (val) { overlay.remove(); resolve(val); };
            okBtn.onclick = function () { done(ipt.value.trim()); };
            cancelBtn.onclick = function () { done(null); };
            ipt.addEventListener('keydown', function (e) { if (e.key === 'Enter') done(ipt.value.trim()); });
            ipt.focus();
        });
    }

    const sid = p => String(p?.displayId ?? p?.problemId ?? p?.pid ?? p?.id ?? '');
    const ptitle = p => p?.displayTitle || p?.title || p?.problemName || '未命名';
    const LS = { get: k => { try { return JSON.parse(localStorage.getItem('__devhoj_' + k)); } catch (e) { return null; } }, set: (k, v) => localStorage.setItem('__devhoj_' + k, JSON.stringify(v)) };

    // ===== 新增：Session 持久化 =====
    function saveSession() {
        try {
            var filesToSave = files.map(function (f) {
                return {
                    id: f.id, name: f.name, code: f.code, lang: f.lang,
                    displayId: f.displayId, title: f.title, mode: f.mode,
                    pid: f.pid, cid: f.cid, tid: f.tid, gid: f.gid,
                    languages: f.languages, problem: f.problem || null
                };
            });
            LS.set('session_files', filesToSave);
            LS.set('session_activeFile', activeFile);
            LS.set('session_pls', {
                mode: problemListState.mode, tid: problemListState.tid,
                cid: problemListState.cid, gid: problemListState.gid,
                label: problemListState.label, problems: problemListState.problems
            });
            LS.set('session_acSet', Array.from(acSet));
        } catch (e) { }
    }

    function restoreSession() {
        try {
            var savedFiles = LS.get('session_files');
            var savedActive = LS.get('session_activeFile');
            if (savedFiles && Array.isArray(savedFiles) && savedFiles.length) {
                files.length = 0;
                savedFiles.forEach(function (f) {
                    files.push({
                        id: f.id || (Date.now() + '_' + Math.random().toString(36).slice(2, 6)),
                        name: f.name || '未命名.cpp',
                        code: f.code != null ? f.code : tplFor(f.lang || 'C++ With O2'),
                        lang: f.lang || 'C++ With O2',
                        displayId: f.displayId || '', title: f.title || '',
                        mode: f.mode || '', pid: f.pid || '',
                        cid: f.cid || '', tid: f.tid || '', gid: f.gid || '',
                        problem: f.problem || null,
                        languages: f.languages || ['C++ With O2', 'C++', 'Python3', 'Java', 'C']
                    });
                });
                activeFile = (typeof savedActive === 'number' && savedActive >= 0 && savedActive < files.length)
                    ? savedActive : 0;
                return true;
            }
        } catch (e) { }
        return false;
    }

    function restoreProblemListState() {
        try {
            var s = LS.get('session_pls');
            if (s && s.mode && Array.isArray(s.problems) && s.problems.length) {
                problemListState = s;
                var savedAc = LS.get('session_acSet'); if (savedAc && Array.isArray(savedAc)) { acSet = new Set(savedAc); }
                return true;
            }
        } catch (e) { }
        return false;
    }
    // ===== 新增结束 =====



    /* ============== 动态加载 KaTeX ============== */
    function loadMarkdownIt() {
        return new Promise(function (resolve) {
            if (window.markdownit) return resolve();
            var script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/markdown-it@14/dist/markdown-it.min.js';
            script.onload = function () { resolve(); };
            script.onerror = function () {
                var s2 = document.createElement('script');
                s2.src = 'https://unpkg.com/markdown-it@14/dist/markdown-it.min.js';
                s2.onload = function () { resolve(); };
                s2.onerror = function () { resolve(); };
                document.head.appendChild(s2);
            };
            document.head.appendChild(script);
        });
    }

    function loadKatex() {
        return new Promise(resolve => {
            if (window.katex && window.renderMathInElement) return resolve();
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = 'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css';
            document.head.appendChild(link);
            const s1 = document.createElement('script');
            s1.src = 'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js';
            s1.onload = () => {
                const s2 = document.createElement('script');
                s2.src = 'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/contrib/auto-render.min.js';
                s2.onload = () => resolve();
                s2.onerror = () => resolve();
                document.head.appendChild(s2);
            };
            s1.onerror = () => resolve();
            document.head.appendChild(s1);
        });
    }
    function renderLatex(el) {
        if (window.renderMathInElement) {
            try {
                window.renderMathInElement(el, {
                    delimiters: [
                        { left: '$$', right: '$$', display: true },
                        { left: '$', right: '$', display: false }
                    ],
                    throwOnError: false
                });
            } catch (e) { }
        }
    }

    loadKatex();
    loadMarkdownIt();

    /* ============== 全局状态 ============== */
    const cfg = {
        codeFont: LS.get('codeFont') || 14,
        probFont: LS.get('probFont') || 14,
        fontFamily: LS.get('fontFamily') || 'Courier New',
        probFontFamily: LS.get('probFontFamily') || 'Times New Roman'
    };

    // 多文件
    const files = [];
    let activeFile = -1;
    const newFile = (init = {}) => {
        const id = Date.now() + '_' + Math.random().toString(36).slice(2, 6);
        const f = {
            id,
            name: init.name || '未命名.cpp',
            code: init.code != null ? init.code : tplFor(init.lang || 'C++ With O2'),
            lang: init.lang || 'C++ With O2',
            displayId: init.displayId || '',
            title: init.title || '',
            mode: init.mode || '',
            pid: init.pid || '',
            cid: init.cid || '', tid: init.tid || '', gid: init.gid || '',
            problem: init.problem || null,
            languages: init.languages || ['C++ With O2', 'C++', 'Python3', 'Java', 'C']
        };
        files.push(f);
        return files.length - 1;
    };
    const cur = () => files[activeFile];

    function tplFor(lang) {
        lang = String(lang || '').toLowerCase();
        if (lang.includes('python')) {
            return ``;
        }
        if (lang.includes('java')) {
            return `import java.io.*;\nimport java.util.*;\n\npublic class Main {\n    static class FastScanner {\n        private final InputStream in = System.in;\n        private final byte[] buffer = new byte[1 << 16];\n        private int ptr = 0, len = 0;\n\n        private int read() throws IOException {\n            if (ptr >= len) {\n                len = in.read(buffer);\n                ptr = 0;\n                if (len <= 0) return -1;\n            }\n            return buffer[ptr++];\n        }\n\n        String next() throws IOException {\n            StringBuilder sb = new StringBuilder();\n            int c;\n            do { c = read(); } while (c <= ' ' && c != -1);\n            while (c > ' ') { sb.append((char)c); c = read(); }\n            return sb.toString();\n        }\n\n        int nextInt() throws IOException { return Integer.parseInt(next()); }\n        long nextLong() throws IOException { return Long.parseLong(next()); }\n    }\n\n    public static void main(String[] args) throws Exception {\n        FastScanner fs = new FastScanner();\n        StringBuilder ans = new StringBuilder();\n\n        // 在这里编写代码\n\n        System.out.print(ans.toString());\n    }\n}\n`;
        }
        if (lang === 'c' || lang.includes('gcc')) {
            return `#include <stdio.h>\n#include <string.h>\n#include <stdlib.h>\n#include <math.h>\n\nint main() {\n    \n    return 0;\n}\n`;
        }
        return `#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {    \n\n    return 0;\n}\n`;
    }

    function extFor(lang) {
        if (/Python/i.test(lang)) return '.py';
        if (/Java/i.test(lang)) return '.java';
        if (lang === 'C') return '.c';
        return '.cpp';
    }
    function fileNameOf(f) {
        var ext = extFor(f.lang);
        if (f.displayId && f.title) return '[' + f.displayId + ']' + f.title + ext;
        if (f.displayId) return '[' + f.displayId + ']' + ext;
        return '未命名' + ext;
    }

    /* ============== 题目列表全局状态 ============== */
    let acSet = new Set();
    let problemListState = {
        mode: '',       // 'training' or 'contest'
        tid: '', cid: '', gid: '',
        problems: [],   // 当前题单的题目列表
        label: ''       // 题单名称
    };

    const css = `
    .dev-root{position:fixed;inset:0;z-index:999999;background:#ECE9D8;font-family:"Microsoft YaHei","Segoe UI",sans-serif;font-size:12px;color:#000;display:flex;flex-direction:column;}
    .dev-menubar{height:22px;background:#ECE9D8;border-bottom:1px solid #ACA899;display:flex;align-items:center;padding:0 2px;flex-shrink:0;position:relative;}
    .dev-menubar .mi{padding:3px 10px;cursor:default;font-size:12px;}
    .dev-menubar .mi:hover,.dev-menubar .mi.on{background:#316AC5;color:#fff;}
    .dev-menu-pop{position:fixed;background:#ECE9D8;border:1px solid #404040;box-shadow:2px 2px 6px rgba(0,0,0,.3);min-width:200px;z-index:1000006;padding:2px;max-height:calc(100vh - 30px);overflow:auto;}

    .dev-menu-pop .it{padding:4px 22px 4px 28px;cursor:pointer;font-size:12px;display:flex;justify-content:space-between;align-items:center;position:relative;}
    .dev-menu-pop .it:hover{background:#316AC5;color:#fff;}
    .dev-menu-pop .it.disabled{color:#888;}
    .dev-menu-pop .it .sc{color:#666;font-size:11px;}
    .dev-menu-pop .it:hover .sc{color:#fff;}
    .dev-menu-pop .sep{height:1px;background:#ACA899;margin:3px 0;}
    .dev-menu-pop .it.has-sub::after{content:'▶';position:absolute;right:6px;font-size:9px;}

    .dev-toolbar{min-height:32px;background:#ECE9D8;border-bottom:1px solid #ACA899;display:flex;align-items:center;padding:2px 4px;gap:1px;flex-wrap:wrap;flex-shrink:0;}
    .dev-tb-btn{height:26px;min-width:30px;padding:0 8px;background:#ECE9D8;border:1px solid transparent;display:inline-flex;align-items:center;gap:4px;cursor:pointer;font-size:11px;border-radius:2px;}
    .dev-tb-btn:hover{border-color:#316AC5;background:#FFF6CB;}
    .dev-tb-btn:active{border-color:#316AC5;background:#C1D2EE;}
    .dev-tb-btn.primary{background:#0A8043;color:#fff;border:1px solid #0A8043;font-weight:bold;}
    .dev-tb-btn.primary:hover{background:#0DAA56;}
    .dev-tb-btn.warn{background:#D97706;color:#fff;border:1px solid #D97706;font-weight:bold;}
    .dev-tb-sep{width:1px;height:22px;background:#ACA899;margin:0 4px;}

    .dev-body{flex:1;display:flex;min-height:0;overflow:hidden;}
    .dev-left{width:42%;min-width:200px;max-width:75%;display:flex;flex-direction:row;border-right:none;background:#fff;min-height:0;flex-shrink:0;}
    .dev-body-resizer{width:4px;background:#ACA899;cursor:ew-resize;flex-shrink:0;transition:background .1s;}
    .dev-body-resizer:hover{background:#0058E1;}
    .dev-right{flex:1;display:flex;flex-direction:column;min-height:0;min-width:200px;overflow:hidden;}


    .dev-tabs{min-height:26px;height:26px;background:#ECE9D8;border-bottom:1px solid #ACA899;display:flex;align-items:flex-end;padding:0 2px;flex-shrink:0;overflow-x:auto;overflow-y:hidden;scrollbar-width:none;}
    .dev-tabs::-webkit-scrollbar{display:none;}

    .dev-tab{padding:4px 10px;border:1px solid #ACA899;border-bottom:none;background:#D4D0C8;cursor:pointer;font-size:11px;margin:2px 1px 0 0;border-radius:3px 3px 0 0;display:inline-flex;align-items:center;gap:6px;white-space:nowrap;}
    .dev-tab.on{background:#fff;font-weight:bold;border-bottom:1px solid #fff;margin-bottom:-1px;}
    .dev-tab .x{color:#888;cursor:pointer;padding:0 2px;}
    .dev-tab .x:hover{color:#C00;background:#FBB;border-radius:2px;}

    .dev-prob-wrap{flex:1;display:flex;flex-direction:column;min-height:0;}
    .dev-desc-wrap{flex:1;display:flex;flex-direction:column;min-height:0;overflow:hidden;}
    .dev-desc-toolbar{height:24px;background:#ECE9D8;border-bottom:1px solid #ACA899;display:flex;align-items:center;padding:0 6px;flex-shrink:0;gap:4px;}
    .dev-desc-edit-panel{flex:1;display:flex;flex-direction:column;min-height:0;overflow:hidden;}
    .dev-desc-textarea{flex:1;min-height:0;resize:none;border:none;border-bottom:1px solid #ACA899;padding:8px 10px;font-family:"Courier New",monospace;font-size:12px;line-height:1.5;outline:none;box-sizing:border-box;overflow:auto;}
    .dev-desc-actions{display:flex;gap:3px;padding:3px 6px;background:#EEF4FF;border-bottom:1px solid #ACA899;flex-shrink:0;}
    .dev-prob{flex:1;overflow:auto;padding:14px 18px;font-family:"Times New Roman","SimSun",serif;line-height:1.7;background:#fff;color:#000;}
    .dev-prob h2{font-size:1.35em;margin:0 0 8px;color:#000080;border-bottom:2px solid #ACA899;padding-bottom:4px;}
    .dev-prob h3{font-size:1.1em;margin:14px 0 6px;color:#000080;border-left:4px solid #0058E1;padding-left:8px;background:#F0F4FA;}
    .dev-prob h4{font-size:1.05em;margin:10px 0 4px;color:#000080;font-weight:bold;}
    .dev-prob h5{font-size:1em;margin:8px 0 4px;color:#333;font-weight:bold;}
    .dev-prob h6{font-size:.95em;margin:6px 0 4px;color:#555;font-weight:bold;}
    .dev-prob p{margin:4px 0;}
    .dev-prob table{border-collapse:collapse;margin:6px 0;font-size:.95em;}
    .dev-prob th{background:#E8EEF8;color:#000080;border:1px solid #ACA899;padding:4px 10px;font-weight:bold;text-align:left;}
    .dev-prob td{border:1px solid #ACA899;padding:3px 8px;}
    .dev-prob tr:nth-child(even) td{background:#F5F8FF;}

    .dev-prob pre{background:#FFFBE6;border:1px solid #E0D070;padding:8px 10px;font-family:"Courier New",Consolas,monospace;font-size:.92em;white-space:pre-wrap;overflow:auto;border-radius:2px;}
    .dev-prob code{background:#FFF3CD;padding:1px 4px;border-radius:2px;font-family:"Courier New",monospace;}
    .dev-prob .meta{color:#555;font-size:.85em;margin-bottom:8px;background:#F5F5DC;padding:4px 8px;border-radius:2px;}
    .dev-prob img{max-width:100%;}
    .dev-md-preview img{max-width:100%;height:auto;border-radius:4px;display:block;margin:8px 0;}
    .dev-md-preview p{margin:4px 0;}
    .dev-md-preview pre{overflow:auto;}
    .dev-md-preview table{border-collapse:collapse;margin:6px 0;font-size:.95em;}
    .dev-md-preview th{background:#E8EEF8;color:#000080;border:1px solid #ACA899;padding:4px 10px;font-weight:bold;text-align:left;}
    .dev-md-preview td{border:1px solid #ACA899;padding:3px 8px;}

        /* === 题目列表侧栏 === */
    .dev-plist-sidebar{width:auto;min-width:100px;display:flex;flex-direction:column;border-right:1px solid #ACA899;background:#fff;flex-shrink:0;overflow:hidden;transition:width .15s,min-width .15s;}
    .dev-plist-sidebar.collapsed{width:0;min-width:0;border-right:none;}
    .dev-plist-sidebar-hd{height:26px;background:linear-gradient(to bottom,#0058E1,#3A93FF);color:#fff;font-weight:bold;display:flex;align-items:center;padding:0 6px;font-size:11px;flex-shrink:0;gap:4px;}
    .dev-plist-sidebar-hd .toggle{cursor:pointer;margin-left:auto;font-size:13px;}
        .dev-plist-loader{padding:4px 6px;background:#EEF4FF;border-bottom:1px solid #ACA899;flex-shrink:0;display:flex;flex-direction:column;gap:3px;overflow:hidden;transition:max-height .2s,padding .2s;max-height:200px;}
    .dev-plist-loader.collapsed{max-height:0;padding:0;border-bottom:none;}
    .dev-plist-loader select{height:22px;width:100%;border:1px solid #7F9DB9;font-size:11px;padding:0 4px;font-family:inherit;box-sizing:border-box;background:#fff;}
    .dev-plist-loader select:focus{outline:none;border-color:#0058E1;}
    .dev-plist-loader .loader-row{display:flex;gap:3px;align-items:center;}
    .dev-plist-loader .loader-label{font-size:10px;color:#555;flex-shrink:0;width:28px;text-align:right;}
    .dev-plist-loader .loader-btns{display:flex;gap:3px;margin-top:1px;}
    .dev-plist-loader .loader-btn{flex:1;height:22px;background:#ECE9D8;border:1px solid #ACA899;cursor:pointer;font-size:11px;border-radius:2px;}
    .dev-plist-loader .loader-btn:hover{border-color:#316AC5;background:#FFF6CB;}
    .dev-plist-loader .loader-btn.primary{background:#0A8043;color:#fff;border-color:#0A8043;font-weight:bold;}
    .dev-plist-loader .loader-btn.primary:hover{background:#0DAA56;}
    .dev-plist-sidebar-bd{flex:1;overflow-y:auto;overflow-x:hidden;background:#fff;}
    .dev-plist-sidebar-bd .dev-plist-hd{padding:4px 8px 6px;font-size:11px;color:#555;background:#F5F5DC;border-bottom:1px solid #ACA899;font-weight:bold;}
        .dev-plist-sidebar-search{padding:4px 6px;border-bottom:1px solid #ACA899;background:#F5F5DC;display:flex;gap:4px;align-items:center;}
    .dev-plist-sidebar-search input{flex:1;height:22px;border:1px solid #7F9DB9;font-size:11px;padding:0 4px;font-family:inherit;box-sizing:border-box;}
    .dev-plist-sidebar-search input:focus{outline:none;border-color:#0058E1;}
    .dev-plist-sidebar-search .count{font-size:10px;color:#666;white-space:nowrap;flex-shrink:0;}
    .dev-plist-sidebar-bd .dev-plist-item{padding:5px 8px;cursor:pointer;border-bottom:1px dotted #ddd;font-size:11px;display:flex;gap:6px;align-items:center;white-space:nowrap;overflow:hidden;}
    .dev-plist-sidebar-bd .dev-plist-item:hover{background:#C1D2EE;}
    .dev-plist-sidebar-bd .dev-plist-item.active{background:#316AC5;color:#fff;}
    .dev-plist-sidebar-bd .dev-plist-item .pid{color:#0058E1;font-weight:bold;font-family:"Courier New";min-width:28px;flex-shrink:0;}
    .dev-plist-sidebar-bd .dev-plist-item.active .pid{color:#fff;}
    .dev-plist-sidebar-bd .dev-plist-item .ptitle{overflow:hidden;text-overflow:ellipsis;flex:1;}
    .dev-plist-sidebar-bd .dev-plist-item .ac-mark{color:#0A8043;font-weight:bold;font-size:12px;flex-shrink:0;margin-left:2px;}
    .dev-plist-sidebar-bd .dev-plist-item.ac-done .ptitle{color:#0A8043;}
    .dev-plist-sidebar-bd .dev-plist-item.active .ac-mark{color:#90EE90;}
    .dev-plist-sidebar-bd .dev-plist-item.active.ac-done .ptitle{color:#fff;}

    .dev-plist-sidebar-empty{color:#888;text-align:center;margin-top:40px;font-size:11px;}
    .dev-content-area{flex:1;display:flex;flex-direction:column;min-width:0;min-height:0;}

    /* === 题目列表 === */
    .dev-plist{flex:1;overflow:auto;padding:6px 0;background:#fff;}
    .dev-plist-hd{padding:4px 12px 6px;font-size:11px;color:#555;background:#F5F5DC;border-bottom:1px solid #ACA899;font-weight:bold;}
    .dev-plist-item{padding:6px 12px;cursor:pointer;border-bottom:1px dotted #ddd;font-size:12px;display:flex;gap:8px;align-items:center;}
    .dev-plist-item:hover{background:#C1D2EE;}
    .dev-plist-item.active{background:#316AC5;color:#fff;}
    .dev-plist-item .pid{color:#0058E1;font-weight:bold;font-family:"Courier New";min-width:36px;}
    .dev-plist-item.active .pid{color:#fff;}
    .dev-plist-item .ptitle{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;}

    /* === 编辑器 === */
    .dev-editor-col{flex:1;display:flex;flex-direction:column;min-height:0;min-width:0;overflow:hidden;}
    .dev-codeline{flex:1 1 0;display:flex;min-height:0;min-width:0;position:relative;background:#fff;overflow:hidden;}
    .dev-gutter{width:46px;background:#ECE9D8;border-right:1px solid #ACA899;color:#666;font-family:"Courier New",monospace;font-size:13px;text-align:right;padding:4px 6px 4px 0;overflow:hidden;user-select:none;flex-shrink:0;line-height:1.45;}
    .dev-code-wrap{flex:1;position:relative;min-width:0;overflow:hidden;}
    .dev-code-pre,.dev-code{position:absolute;inset:0;margin:0;padding:4px 8px;font-family:"Courier New",Consolas,monospace;font-size:14px;line-height:1.45;tab-size:4;border:none;outline:none;white-space:pre;overflow:auto;box-sizing:border-box;}
    .dev-code-pre{color:#000;background:#fff;pointer-events:none;z-index:1;}
    .dev-code{color:transparent;caret-color:#000;background:transparent;resize:none;z-index:2;}
    .dev-code::selection{background:#316AC5;color:#fff;}
    .tk-kw{color:#0000FF;font-weight:bold;}
    .tk-tp{color:#0000C0;}
    .tk-st{color:#A31515;}
    .tk-cm{color:#008000;font-style:italic;}
    .tk-nm{color:#098658;}
    .tk-fn{color:#795E26;}
    .tk-pp{color:#A52A2A;font-weight:bold;}

    .dev-resizer{height:4px;background:#ACA899;cursor:ns-resize;flex-shrink:0;}
    .dev-resizer:hover{background:#0058E1;}

    .dev-output{
        height:180px;
        flex:0 0 180px;
        background:#fff;
        border-top:1px solid #ACA899;
        display:flex;
        flex-direction:column;
        min-height:60px;
        overflow:hidden;
    }

    .dev-output-hd{
        height:24px;
        background:#D4D0C8;
        border-bottom:1px solid #ACA899;
        display:flex;
        align-items:center;
        padding:0 6px;
        font-weight:bold;
        font-size:11px;
        flex-shrink:0;
        gap:8px;
    }

    .dev-output-hd .otab{
        padding:2px 10px;
        cursor:pointer;
        border:1px solid transparent;
    }

    .dev-output-hd .otab.on{
        background:#fff;
        border:1px solid #ACA899;
        border-bottom-color:#fff;
    }

    .dev-output-hd .x{
        margin-left:auto;
        cursor:pointer;
        padding:0 8px;
    }

    .dev-output-bd{
        flex:1;
        overflow:auto;
        padding:6px 10px;
        font-family:"Courier New",Consolas,monospace;
        font-size:12px;
        white-space:pre-wrap;
        background:#fff;
    }

    .dev-output-bd .ok{color:#0A8043;font-weight:bold;}
    .dev-output-bd .err{color:#C00;font-weight:bold;}
    .dev-output-bd .run{color:#0058E1;}
    .dev-output-bd .ts{color:#888;}

    /* ============================================
       评测结果面板 — 与 Dev-C++ 整体风格一致
       ============================================ */
    .dev-result-bd{
        font-family:"Microsoft YaHei","Segoe UI",sans-serif;
        line-height:1.4;
        white-space:normal;
        padding:6px 8px;
        overflow-y:auto;
        background:#fff;
    }

    /* ── 状态横幅 ── */
    .dev-result-banner{
        display:flex;
        align-items:center;
        gap:8px;
        padding:5px 10px;
        border:1px solid #ACA899;
        border-radius:2px;
        margin-bottom:6px;
    }
    .dev-result-banner.res-ac{background:#E8F5E9;border-left:3px solid #0A8043;}
    .dev-result-banner.res-wa{background:#FFEBEE;border-left:3px solid #C00;}
    .dev-result-banner.res-ce{background:#F3E5F5;border-left:3px solid #7B1FA2;}
    .dev-result-banner.res-tle{background:#FFF8E1;border-left:3px solid #D97706;}
    .dev-result-banner.res-re{background:#FFEBEE;border-left:3px solid #C00;}
    .dev-result-banner.res-mle{background:#FFF8E1;border-left:3px solid #D97706;}
    .dev-result-banner.res-pe{background:#E3F2FD;border-left:3px solid #0058E1;}
    .dev-result-banner.res-se{background:#F5F5F5;border-left:3px solid #666;}
    .dev-result-banner.res-pa{background:#FFF8E1;border-left:3px solid #E6A817;}
    .dev-result-banner .banner-left{display:flex;align-items:center;gap:6px;flex-shrink:0;}
    .dev-result-banner .banner-icon{font-size:16px;line-height:1;}
    .dev-result-banner .banner-status{font-size:13px;font-weight:bold;}
    .dev-result-banner.res-ac .banner-status{color:#0A8043;}
    .dev-result-banner.res-wa .banner-status{color:#C00;}
    .dev-result-banner.res-ce .banner-status{color:#7B1FA2;}
    .dev-result-banner.res-tle .banner-status{color:#D97706;}
    .dev-result-banner.res-re .banner-status{color:#C00;}
    .dev-result-banner.res-mle .banner-status{color:#D97706;}
    .dev-result-banner.res-pe .banner-status{color:#0058E1;}
    .dev-result-banner.res-se .banner-status{color:#666;}
    .dev-result-banner.res-pa .banner-status{color:#E6A817;}
    .dev-result-banner .banner-right{display:flex;align-items:center;gap:4px;margin-left:auto;flex-shrink:0;flex-wrap:wrap;}

    /* ── 指标标签 — 风格同状态栏分段 ── */
    .dev-result-banner .metric-tag{
        display:inline-flex;
        align-items:center;
        gap:2px;
        padding:1px 6px;
        font-size:11px;
        border-left:1px solid #ACA899;
    }
    .dev-result-banner .metric-tag:first-child{border-left:none;}
    .dev-result-banner .metric-tag .ml{color:#666;}
    .dev-result-banner .metric-tag .mv{font-weight:bold;color:#000;font-family:"Courier New",Consolas,monospace;}

    /* ── 测试点网格 ── */
    .dev-result-cases{margin-bottom:4px;}
    .dev-result-cases-hd{
        font-size:11px;
        font-weight:bold;
        color:#333;
        margin-bottom:4px;
        display:flex;
        align-items:center;
        gap:6px;
    }
    .dev-result-cases-hd .cases-stat{font-weight:normal;font-size:10px;color:#888;}
    .dev-result-cases-grid{
        display:flex;
        flex-wrap:wrap;
        gap:3px;
        margin-bottom:4px;
    }

    /* ── 测试点方块 ── */
    .dev-case-dot{
        width:30px;
        height:22px;
        border-radius:2px;
        display:inline-flex;
        align-items:center;
        justify-content:center;
        font-size:10px;
        font-weight:bold;
        cursor:pointer;
        border:1px solid;
        font-family:"Courier New",Consolas,monospace;
        transition:background .1s,border-color .1s;
    }
    .dev-case-dot:hover{box-shadow:0 0 0 1px #316AC5;}
    .dev-case-dot.dot-ac{background:#C8E6C9;color:#1B5E20;border-color:#81C784;}
    .dev-case-dot.dot-wa{background:#FFCDD2;color:#B71C1C;border-color:#E57373;}
    .dev-case-dot.dot-tle{background:#FFE0B2;color:#E65100;border-color:#FFB74D;}
    .dev-case-dot.dot-mle{background:#FFE0B2;color:#E65100;border-color:#FFB74D;}
    .dev-case-dot.dot-re{background:#FFCDD2;color:#B71C1C;border-color:#E57373;}
    .dev-case-dot.dot-ce{background:#E1BEE7;color:#4A148C;border-color:#BA68C8;}
    .dev-case-dot.dot-pe{background:#BBDEFB;color:#0D47A1;border-color:#64B5F6;}
    .dev-case-dot.dot-se{background:#E0E0E0;color:#424242;border-color:#9E9E9E;}
    .dev-case-dot.dot-pa{background:#FFE0B2;color:#E65100;border-color:#FFB74D;}
    .dev-case-dot.dot-pending{background:#EEEEEE;color:#9E9E9E;border-color:#BDBDBD;}

    /* ── 测试点详情展开 ── */
    .dev-case-detail{
        background:#F5F5DC;
        border:1px solid #ACA899;
        border-radius:2px;
        padding:4px 8px;
        margin-top:4px;
        display:none;
        font-size:11px;
    }
    .dev-case-detail.on{display:block;}
    .dev-case-detail .detail-row{display:flex;gap:10px;margin-bottom:2px;}
    .dev-case-detail .detail-label{color:#555;font-weight:bold;min-width:40px;}
    .dev-case-detail .detail-val{color:#000;font-family:"Courier New",Consolas,monospace;}

    /* ── 错误信息区 ── */
    .dev-result-error{
        background:#FFEBEE;
        border:1px solid #E57373;
        border-radius:2px;
        margin-bottom:6px;
        overflow:hidden;
    }
    .dev-result-error-hd{
        padding:3px 8px;
        font-size:11px;
        font-weight:bold;
        color:#B71C1C;
        background:#FFCDD2;
        border-bottom:1px solid #E57373;
    }
    .dev-result-error-bd{
        padding:6px 8px;
        font-family:"Courier New",Consolas,monospace;
        font-size:11px;
        white-space:pre-wrap;
        color:#B71C1C;
        max-height:80px;
        overflow:auto;
        background:#fff;
    }

    /* ── 底部信息 ── */
    .dev-result-footer{
        margin-top:4px;
        padding-top:3px;
        border-top:1px solid #ACA899;
        font-size:10px;
        color:#888;
    }

    /* ── 评测中动画 ── */
    .dev-result-judging{
        display:flex;
        align-items:center;
        justify-content:center;
        padding:18px;
        gap:8px;
    }
    .dev-result-judging .spinner{
        width:18px;height:18px;
        border:2px solid #ACA899;
        border-top-color:#0058E1;
        border-radius:50%;
        animation:dev-spin .8s linear infinite;
    }
    @keyframes dev-spin{to{transform:rotate(360deg);}}
    .dev-result-judging .judging-text{color:#0058E1;font-size:12px;font-weight:bold;}
    .dev-result-judging .judging-sub{color:#888;font-size:10px;}

    /* === Dev-C++ 本地运行黑框 === */
    .dev-run-modal{
        background:rgba(0,0,0,.45);
    }

    .dev-run-modal .dev-modal-bd{
        width:720px;
        max-width:92vw;
        background:#0C0C0C;
        border:1px solid #222;
        box-shadow:0 0 0 1px #000, 6px 6px 18px rgba(0,0,0,.55);
    }

    .dev-run-titlebar{
        height:28px;
        background:linear-gradient(to bottom,#2B2B2B,#111);
        color:#fff;
        border-bottom:1px solid #333;
        font-family:"Microsoft YaHei","Segoe UI",sans-serif;
        font-size:12px;
        display:flex;
        align-items:center;
        justify-content:space-between;
        padding:0 0 0 8px;
        cursor:move;
        box-sizing:border-box;
    }

    .dev-run-close{
        width:42px;
        height:28px;
        border:none;
        outline:none;
        background:transparent;
        color:#ddd;
        font-size:18px;
        line-height:28px;
        cursor:pointer;
        font-family:Arial,sans-serif;
        padding:0;
    }

    .dev-run-close:hover{
        background:#2A2A2A;
        color:#fff;
    }

    .dev-run-close:active{
        background:#3A3A3A;
        color:#fff;
    }



    .dev-run-console{
        background:#0C0C0C;
        color:#CCCCCC;
        font-family:"Consolas","Courier New",monospace;
        font-size:14px;
        line-height:1.45;
    }

    .dev-run-screen{
        min-height:360px;
        max-height:72vh;
        overflow:auto;
        padding:10px 12px;
        white-space:pre-wrap;
        box-sizing:border-box;
        background:#0C0C0C;
        color:#CCCCCC;
        cursor:text;
    }

    .dev-run-console .line{
        margin:0;
        min-height:19px;
    }

    .dev-run-stdin{
        min-height:120px;
        outline:none;
        border:none;
        background:#0C0C0C;
        color:#CCCCCC;
        font-family:"Consolas","Courier New",monospace;
        font-size:14px;
        line-height:1.45;
        white-space:pre-wrap;
        caret-color:#CCCCCC;
        margin:0;
        padding:0;
    }

    .dev-run-stdin:focus{
        outline:none;
        border:none;
    }

    .dev-run-block{
        background:#0C0C0C;
        border:none;
        color:#CCCCCC;
        padding:0;
        margin:0;
        white-space:pre-wrap;
        font-family:"Consolas","Courier New",monospace;
        font-size:14px;
        line-height:1.45;
    }



    .dev-status{height:22px;background:#ECE9D8;border-top:1px solid #ACA899;display:flex;align-items:center;padding:0 8px;font-size:11px;color:#333;gap:14px;flex-shrink:0;}
    .dev-status .seg{border-right:1px solid #ACA899;padding-right:14px;}

    .dev-search-wrap{position:relative;margin-left:auto;display:flex;align-items:center;gap:2px;}
    .dev-search-wrap input{width:150px;height:22px;border:1px solid #7F9DB9;font-size:11px;padding:0 6px;font-family:inherit;box-sizing:border-box;}
    .dev-search-wrap input:focus{outline:none;border-color:#0058E1;}
    .dev-search-btn{height:22px;min-width:30px;padding:0 6px;background:#ECE9D8;border:1px solid #ACA899;cursor:pointer;font-size:11px;border-radius:2px;}
    .dev-search-btn:hover{border-color:#316AC5;background:#FFF6CB;}
    .dev-search-dropdown{position:absolute;top:100%;right:0;width:300px;max-height:320px;background:#fff;border:1px solid #ACA899;box-shadow:2px 4px 10px rgba(0,0,0,.2);overflow-y:auto;display:none;z-index:1000003;}
    .dev-search-dropdown.on{display:block;}
    .dev-search-dropdown .dev-sr-item{padding:6px 10px;cursor:pointer;border-bottom:1px dotted #ddd;font-size:11px;display:flex;gap:8px;align-items:center;}
    .dev-search-dropdown .dev-sr-item:hover{background:#C1D2EE;}
    .dev-search-dropdown .dev-sr-item .sid{color:#0058E1;font-weight:bold;font-family:"Courier New";min-width:40px;flex-shrink:0;}
    .dev-search-dropdown .dev-sr-item .stitle{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;}
    .dev-search-dropdown .dev-sr-empty{padding:16px;text-align:center;color:#888;font-size:11px;}
    .dev-search-dropdown .dev-sr-loading{padding:16px;text-align:center;color:#0058E1;font-size:11px;}

    .dev-row{display:flex;gap:4px;}

    .dev-modal{position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:1000002;display:flex;align-items:center;justify-content:center;}
    .dev-modal-bd{background:#ECE9D8;border:2px solid #fff;box-shadow:0 0 0 1px #404040,4px 4px 12px rgba(0,0,0,.4);width:520px;max-width:92vw;}
    .dev-modal-hd{height:24px;background:linear-gradient(to bottom,#0058E1,#3A93FF);color:#fff;font-weight:bold;padding:0 8px;display:flex;align-items:center;font-size:12px;}
    .dev-modal-bd textarea{width:100%;height:90px;font-family:"Courier New";font-size:12px;border:1px solid #7F9DB9;box-sizing:border-box;padding:4px;resize:vertical;}
    .dev-modal-ft{padding:8px;text-align:right;background:#ECE9D8;}
    .dev-modal-ft button{height:26px;padding:0 16px;margin-left:6px;background:#ECE9D8;border:1px solid #ACA899;cursor:pointer;}
    .dev-modal-ft button:hover{background:#FFF6CB;border-color:#316AC5;}

    .dev-acomp{position:fixed;background:#FFFBE6;border:1px solid #404040;box-shadow:2px 2px 6px rgba(0,0,0,.3);z-index:1000005;font-family:"Courier New",monospace;font-size:12px;max-height:180px;overflow:auto;min-width:140px;}
    .dev-acomp .ai{padding:3px 10px;cursor:pointer;}
    .dev-acomp .ai.on{background:#316AC5;color:#fff;}
    .dev-acomp .ai .ty{float:right;color:#888;margin-left:12px;font-size:10px;}
    /* === 题单编辑模式 === */
.dev-edit-bar{display:flex;align-items:center;gap:2px;padding:3px 6px;background:#FFF6CB;border-bottom:1px solid #ACA899;flex-shrink:0;}
    .dev-edit-bar .dev-edit-btn{height:22px;padding:0 8px;background:#ECE9D8;border:1px solid #ACA899;cursor:pointer;font-size:11px;border-radius:2px;white-space:nowrap;display:inline-flex;align-items:center;gap:3px;}
    .dev-edit-bar .dev-edit-btn:hover{border-color:#316AC5;background:#FFF6CB;}
    .dev-edit-bar .dev-edit-btn.danger{color:#C00;border-color:#E57373;}
    .dev-edit-bar .dev-edit-btn.danger:hover{background:#FFCDD2;}
    .dev-edit-bar .dev-edit-btn.primary{background:#0A8043;color:#fff;border:1px solid #0A8043;font-weight:bold;}
    .dev-edit-bar .dev-edit-btn.primary:hover{background:#0DAA56;}
    .dev-edit-bar .dev-edit-sep{width:1px;height:16px;background:#ACA899;margin:0 2px;}
    .dev-edit-item{display:flex;gap:6px;align-items:center;padding:4px 8px;border-bottom:1px dotted #ddd;font-size:11px;cursor:grab;user-select:none;}
    .dev-edit-item:active{cursor:grabbing;}
    .dev-edit-item.dragging{opacity:.4;background:#FFF6CB;}
    .dev-edit-item.drag-over{border-top:2px solid #0058E1;}
    .dev-edit-item .drag-handle{color:#888;cursor:grab;font-size:10px;flex-shrink:0;}
    .dev-edit-item .pid{color:#0058E1;font-weight:bold;font-family:"Courier New";min-width:28px;flex-shrink:0;}
    .dev-edit-item .ptitle{overflow:hidden;text-overflow:ellipsis;flex:1;white-space:nowrap;}
    .dev-edit-item .del-btn{color:#C00;cursor:pointer;font-size:12px;flex-shrink:0;padding:0 3px;border-radius:2px;}
    .dev-edit-item .del-btn:hover{background:#FFCDD2;}
    .dev-edit-item .idx{color:#888;font-size:10px;min-width:18px;text-align:right;flex-shrink:0;}
    .dev-edit-search{display:flex;gap:4px;align-items:center;padding:4px 6px;background:#F5F5DC;border-bottom:1px solid #ACA899;}
    .dev-edit-search input{flex:1;height:22px;border:1px solid #7F9DB9;font-size:11px;padding:0 4px;font-family:inherit;box-sizing:border-box;}
    .dev-edit-search input:focus{outline:none;border-color:#0058E1;}
    .dev-edit-search .dev-edit-btn{height:22px;padding:0 6px;}
    .dev-edit-search-results{max-height:160px;overflow-y:auto;background:#fff;border-bottom:1px solid #ACA899;}
    .dev-edit-search-results .sr-item{padding:4px 8px;cursor:pointer;border-bottom:1px dotted #ddd;font-size:11px;display:flex;gap:6px;align-items:center;}
    .dev-edit-search-results .sr-item:hover{background:#C1D2EE;}
    .dev-edit-search-results .sr-item .pid{color:#0058E1;font-weight:bold;font-family:"Courier New";min-width:40px;flex-shrink:0;}
    .dev-edit-search-results .sr-item .ptitle{overflow:hidden;text-overflow:ellipsis;flex:1;white-space:nowrap;}
    .dev-edit-search-results .sr-item .add-btn{color:#0A8043;cursor:pointer;font-weight:bold;flex-shrink:0;}
    .dev-edit-search-results .sr-item .add-btn:hover{background:#C8E6C9;}
    `;




    const styleEl = document.createElement('style'); styleEl.textContent = css; document.head.appendChild(styleEl);
    /* ============== 锁定主站页面滚动 ============== */
    const pageScrollLock = (function () {
        var scrollX = window.scrollX || window.pageXOffset || 0;
        var scrollY = window.scrollY || window.pageYOffset || 0;

        var html = document.documentElement;
        var body = document.body;

        var oldHtmlStyle = {
            overflow: html.style.overflow,
            overflowX: html.style.overflowX,
            overflowY: html.style.overflowY,
            height: html.style.height,
            width: html.style.width
        };

        var oldBodyStyle = {
            overflow: body.style.overflow,
            overflowX: body.style.overflowX,
            overflowY: body.style.overflowY,
            height: body.style.height,
            width: body.style.width,
            position: body.style.position,
            top: body.style.top,
            left: body.style.left,
            right: body.style.right,
            overscrollBehavior: body.style.overscrollBehavior
        };

        function lock() {
            scrollX = window.scrollX || window.pageXOffset || 0;
            scrollY = window.scrollY || window.pageYOffset || 0;

            html.style.overflow = 'hidden';
            html.style.overflowX = 'hidden';
            html.style.overflowY = 'hidden';
            html.style.height = '100%';
            html.style.width = '100%';

            body.style.overflow = 'hidden';
            body.style.overflowX = 'hidden';
            body.style.overflowY = 'hidden';
            body.style.height = '100%';
            body.style.width = '100%';
            body.style.position = 'fixed';
            body.style.top = '-' + scrollY + 'px';
            body.style.left = '-' + scrollX + 'px';
            body.style.right = '0';
            body.style.overscrollBehavior = 'none';
        }

        function restore() {
            html.style.overflow = oldHtmlStyle.overflow;
            html.style.overflowX = oldHtmlStyle.overflowX;
            html.style.overflowY = oldHtmlStyle.overflowY;
            html.style.height = oldHtmlStyle.height;
            html.style.width = oldHtmlStyle.width;

            body.style.overflow = oldBodyStyle.overflow;
            body.style.overflowX = oldBodyStyle.overflowX;
            body.style.overflowY = oldBodyStyle.overflowY;
            body.style.height = oldBodyStyle.height;
            body.style.width = oldBodyStyle.width;
            body.style.position = oldBodyStyle.position;
            body.style.top = oldBodyStyle.top;
            body.style.left = oldBodyStyle.left;
            body.style.right = oldBodyStyle.right;
            body.style.overscrollBehavior = oldBodyStyle.overscrollBehavior;

            try {
                window.scrollTo(scrollX, scrollY);
            } catch (e) { }
        }

        lock();

        return {
            lock: lock,
            restore: restore
        };
    })();

    /* ============== 主 UI ============== */
    const root = document.createElement('div');
    root.className = 'dev-root theme-' + cfg.theme;
    root.innerHTML = `
        <div class="dev-menubar" id="dev-menubar">

            <span class="mi" data-m="file">文件(F)</span>
            <span class="mi" data-m="edit">编辑(E)</span>
            <span class="mi" data-m="run">运行(R)</span>
            <span class="mi" data-m="view">查看(V)</span>
            <span class="mi" data-m="help">帮助(H)</span>
        </div>
        <div class="dev-toolbar">
            <button class="dev-tb-btn" id="dev-new" title="新建 Ctrl+N">📄 新建</button>
            <button class="dev-tb-btn" id="dev-open" title="打开 Ctrl+O">📂 打开</button>
            <button class="dev-tb-btn" id="dev-save" title="保存 Ctrl+S">💾 保存</button>
            <div class="dev-tb-sep"></div>
            <button class="dev-tb-btn" id="dev-compile" title="编译 F9">⚙ 编译</button>
            <button class="dev-tb-btn primary" id="dev-run" title="运行 F10">▶ 运行</button>
            <div class="dev-tb-sep"></div>
            <button class="dev-tb-btn warn" id="dev-submit" title="提交 F11">📤 提交</button>
            <button class="dev-tb-btn" id="dev-loadac">📥 加载AC</button>
            <div class="dev-tb-sep"></div>
            <select id="dev-lang" style="height:24px;border:1px solid #7F9DB9;font-size:11px;padding:0 4px;"></select>
            <div class="dev-search-wrap">
                <input id="dev-search-kw" placeholder="搜索题号/关键词">
                <button class="dev-search-btn" id="dev-search-go">🔍</button>
                <div class="dev-search-dropdown" id="dev-search-dropdown"></div>
            </div>
            <button id="dev-login-btn" title="登录"
                style="height:26px;padding:0 10px;background:#0A8043;color:#fff;border:1px solid #0A8043;font-weight:bold;font-size:11px;border-radius:2px;white-space:nowrap;">
                👤 登录
            </button>
        </div>


        </div>
        <div class="dev-body">
                        <div class="dev-left">
                <div class="dev-plist-sidebar collapsed" id="dev-plist-sidebar">
                    <div class="dev-plist-sidebar-hd">
                        <span>📋题单</span>
                        <span id="dev-loader-toggle" title="展开/收起加载器" style="cursor:pointer;font-size:11px;opacity:.85;margin-left:4px;">▲</span>
                        <span class="toggle" id="dev-plist-collapse" title="收起">◀</span>
                    </div>
                    <div class="dev-plist-loader" id="dev-plist-loader">
                        <div class="loader-row">
                            <span class="loader-label">类型</span>
                            <select id="dev-loader-type">
                                <option value="public-training">公共训练</option>
                                <option value="group-training">团队训练</option>
                                <option value="group-contest">团队比赛</option>
                            </select>
                        </div>
                        <div class="loader-row" id="dev-loader-group-row" style="display:none;">
                            <span class="loader-label">团队</span>
                            <select id="dev-loader-group"><option value="">-- 请选择 --</option></select>
                        </div>
                        <div class="loader-row" id="dev-loader-cat-row">
                            <span class="loader-label">分类</span>
                            <select id="dev-loader-cat"><option value="">加载中...</option></select>
                        </div>
                        <div class="loader-row">
                            <span class="loader-label">题单</span>
                            <select id="dev-loader-item"><option value="">请先选择分类</option></select>
                        </div>
                        <div class="loader-btns">
                            <button class="loader-btn primary" id="dev-loader-load">▶ 加载</button>
                        <button class="loader-btn" id="dev-loader-refresh" title="管理团队">🏢 团队</button>

                        </div>
                    </div>
                <div class="dev-plist-sidebar-bd" id="dev-plist">

                    <div class="dev-plist-sidebar-search">
                        <span class="count" id="dev-plist-count" style="color:#888;">未加载题单</span>
                        <span style="flex:1;"></span>
                        <button id="dev-plist-edit" title="编辑题单" style="height:20px;padding:0 5px;background:#ECE9D8;border:1px solid #ACA899;cursor:pointer;font-size:11px;border-radius:2px;flex-shrink:0;">✏</button>
                        <button id="dev-plist-settings" title="加载题单" style="height:20px;padding:0 5px;background:#ECE9D8;border:1px solid #ACA899;cursor:pointer;font-size:11px;border-radius:2px;flex-shrink:0;">⟳</button>
                    </div>
                    <div class="dev-plist-sidebar-empty">点击 ⚙ 加载题单</div>
                    </div>
                </div>
                <div class="dev-content-area">
                    <div class="dev-tabs" style="flex-shrink:0;">
                    <div class="dev-tab" data-v="plist-toggle" id="dev-tab-plist-toggle">📋 </div>
                    <div class="dev-tab" data-v="desc">简介</div>
                    <div class="dev-tab on" data-v="prob">题目描述</div>
                </div>
                    <div class="dev-prob-wrap">
                    <div id="dev-prob" class="dev-prob"><p style="color:#888;text-align:center;margin-top:50px;">未选择题目</p></div>
                    <div id="dev-desc" class="dev-desc-wrap" style="display:none;">
                        <div class="dev-desc-toolbar">
                            <span id="dev-desc-title" style="flex:1;font-size:11px;color:#555;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"></span>
                            <button id="dev-desc-edit-btn" style="height:20px;padding:0 6px;background:#ECE9D8;border:1px solid #ACA899;cursor:pointer;font-size:11px;border-radius:2px;">⚙ 编辑</button>
                        </div>
                        <div id="dev-desc-view" class="dev-prob" style="flex:1;overflow:auto;"></div>
                        <div id="dev-desc-edit-panel" class="dev-desc-edit-panel" style="display:none;">
                            <div class="dev-desc-actions">
                                <button id="dev-desc-save" class="dev-tb-btn primary" style="height:22px;">💾 保存并更新</button>
                                <button id="dev-desc-sync-from" class="dev-tb-btn" style="height:22px;">🔗 从其他题单同步</button>
                            </div>
                            <div style="flex:1;display:flex;min-height:0;overflow:hidden;">
                                <textarea id="dev-desc-textarea" class="dev-desc-textarea"
                                    style="flex:1;min-height:0;resize:none;border:none;border-right:1px solid #ACA899;
                                           padding:8px 10px;font-family:'Courier New',monospace;font-size:12px;
                                           line-height:1.5;outline:none;box-sizing:border-box;overflow:auto;"
                                    placeholder="在此输入 Markdown 格式的简介..."></textarea>
                                <div id="dev-desc-live-preview"
                                    style="flex:1;min-height:0;overflow:auto;padding:10px 14px;
                                           font-family:'Times New Roman','SimSun',serif;font-size:13px;line-height:1.7;
                                           background:#FAFAF5;color:#000;"
                                    class="dev-prob"></div>
                            </div>
                        </div>

</div>

                    </div>
                </div>

            </div>
            <div class="dev-body-resizer" id="dev-body-resizer"></div>
            <div class="dev-right">

                <div class="dev-tabs" id="dev-file-tabs"></div>
                <div class="dev-editor-col">
                    <div class="dev-codeline">
                        <div class="dev-gutter" id="dev-gutter">1</div>
                        <div class="dev-code-wrap">
                            <pre class="dev-code-pre" id="dev-pre"></pre>
                            <textarea class="dev-code" id="dev-code" spellcheck="false"></textarea>
                        </div>
                    </div>
                    <div class="dev-resizer" id="dev-resizer"></div>
                    <div class="dev-output">
                        <div class="dev-output-hd">
                            <span class="otab on" data-o="run">运行</span>
                            <span class="otab" data-o="result">结果</span>
                            <span class="x" id="dev-clear-out">[ 清除 ]</span>
                        </div>
                        <div class="dev-output-bd" id="dev-output"></div>
                        <div class="dev-output-bd dev-result-bd" id="dev-result" style="display:none;"><p style="color:#888;">尚未提交</p></div>
                    </div>
                    </div>
                </div>
            </div>
        </div>
        <div class="dev-status">
            <span class="seg">行: <b id="dev-ln">1</b>  列: <b id="dev-col">1</b></span>
            <span class="seg" id="dev-status-mode">未加载题目</span>
            <span class="seg" id="dev-status-lang">C++ With O2</span>
            <span class="seg">UTF-8</span>
            <span id="dev-status-msg">就绪</span>
        </div>
    `;
    document.body.appendChild(root);

    /* ============== 引用 ============== */
    const codeEl = $('#dev-code');
    const preEl = $('#dev-pre');
    const gutter = $('#dev-gutter');
    const output = $('#dev-output');
    const statusMsg = $('#dev-status-msg');
    const statusMode = $('#dev-status-mode');
    const statusLang = $('#dev-status-lang');

    /* ============== 应用 cfg ============== */
    function applyCfg() {
        root.className = 'dev-root theme-classic';
        codeEl.style.fontSize = cfg.codeFont + 'px';
        preEl.style.fontSize = cfg.codeFont + 'px';
        gutter.style.fontSize = cfg.codeFont + 'px';
        codeEl.style.fontFamily = '"' + cfg.fontFamily + '",Consolas,monospace';
        preEl.style.fontFamily = '"' + cfg.fontFamily + '",Consolas,monospace';
        var probEl = $('#dev-prob');
        var descEl = $('#dev-desc');
        if (descEl) {
            descEl.style.fontSize = cfg.probFont + 'px';
            descEl.style.fontFamily = '"' + cfg.probFontFamily + '","SimSun",serif';
        }

        probEl.style.fontSize = cfg.probFont + 'px';
        probEl.style.fontFamily = '"' + cfg.probFontFamily + '","SimSun",serif';
        var resultEl = $('#dev-result');
        if (resultEl) resultEl.style.fontSize = Math.max(12, cfg.probFont - 1) + 'px';
        LS.set('codeFont', cfg.codeFont);
        LS.set('probFont', cfg.probFont);
        LS.set('fontFamily', cfg.fontFamily);
        LS.set('probFontFamily', cfg.probFontFamily);
    }



    /* ============== 语法高亮 ============== */
    const KW_CPP = new Set(['if', 'else', 'for', 'while', 'do', 'return', 'break', 'continue', 'switch', 'case', 'default', 'goto', 'typedef', 'struct', 'class', 'public', 'private', 'protected', 'virtual', 'override', 'template', 'typename', 'namespace', 'using', 'new', 'delete', 'try', 'catch', 'throw', 'const', 'static', 'extern', 'inline', 'friend', 'operator', 'this', 'auto', 'register', 'volatile', 'sizeof', 'true', 'false', 'nullptr', 'NULL']);
    const TP_CPP = new Set(['int', 'long', 'short', 'char', 'float', 'double', 'void', 'bool', 'signed', 'unsigned', 'string', 'vector', 'map', 'set', 'queue', 'stack', 'deque', 'list', 'pair', 'size_t', 'FILE']);
    const KW_PY = new Set(['def', 'return', 'if', 'elif', 'else', 'for', 'while', 'break', 'continue', 'import', 'from', 'as', 'class', 'try', 'except', 'finally', 'raise', 'with', 'pass', 'lambda', 'yield', 'global', 'nonlocal', 'in', 'is', 'not', 'and', 'or', 'True', 'False', 'None', 'print', 'input', 'range', 'len', 'int', 'str', 'float', 'list', 'dict', 'set', 'tuple']);
    const KW_JAVA = new Set(['public', 'private', 'protected', 'class', 'interface', 'extends', 'implements', 'static', 'final', 'void', 'int', 'long', 'short', 'char', 'float', 'double', 'boolean', 'if', 'else', 'for', 'while', 'do', 'return', 'break', 'continue', 'switch', 'case', 'default', 'new', 'this', 'super', 'try', 'catch', 'finally', 'throw', 'throws', 'import', 'package', 'null', 'true', 'false', 'String', 'System']);

    function highlight(code, lang) {
        const isPy = /Python/i.test(lang);
        const isJava = /Java/i.test(lang);
        const KW = isPy ? KW_PY : isJava ? KW_JAVA : KW_CPP;
        const TP = isPy || isJava ? null : TP_CPP;
        let html = '';
        let i = 0, n = code.length;
        while (i < n) {
            const c = code[i];
            if (!isPy && c === '/' && code[i + 1] === '/') {
                let j = code.indexOf('\n', i); if (j < 0) j = n;
                html += '<span class="tk-cm">' + esc(code.slice(i, j)) + '</span>';
                i = j; continue;
            }
            if (!isPy && c === '/' && code[i + 1] === '*') {
                let j = code.indexOf('*/', i + 2); j = j < 0 ? n : j + 2;
                html += '<span class="tk-cm">' + esc(code.slice(i, j)) + '</span>';
                i = j; continue;
            }
            if (isPy && c === '#') {
                let j = code.indexOf('\n', i); if (j < 0) j = n;
                html += '<span class="tk-cm">' + esc(code.slice(i, j)) + '</span>';
                i = j; continue;
            }
            if (!isPy && !isJava && c === '#' && (i === 0 || code[i - 1] === '\n')) {
                let j = code.indexOf('\n', i); if (j < 0) j = n;
                html += '<span class="tk-pp">' + esc(code.slice(i, j)) + '</span>';
                i = j; continue;
            }
            if (c === '"' || c === "'") {
                let j = i + 1;
                while (j < n && code[j] !== c) { if (code[j] === '\\') j++; j++; }
                j = Math.min(j + 1, n);
                html += '<span class="tk-st">' + esc(code.slice(i, j)) + '</span>';
                i = j; continue;
            }
            if (/\d/.test(c) && (i === 0 || !/[A-Za-z_]/.test(code[i - 1]))) {
                let j = i;
                while (j < n && /[\d.xXa-fA-F]/.test(code[j])) j++;
                html += '<span class="tk-nm">' + esc(code.slice(i, j)) + '</span>';
                i = j; continue;
            }
            if (/[A-Za-z_]/.test(c)) {
                let j = i;
                while (j < n && /[A-Za-z0-9_]/.test(code[j])) j++;
                const w = code.slice(i, j);
                if (KW.has(w)) html += '<span class="tk-kw">' + esc(w) + '</span>';
                else if (TP && TP.has(w)) html += '<span class="tk-tp">' + esc(w) + '</span>';
                else if (code[j] === '(') html += '<span class="tk-fn">' + esc(w) + '</span>';
                else html += esc(w);
                i = j; continue;
            }
            html += esc(c); i++;
        }
        return html;
    }

    function refreshHighlight() {
        const f = cur(); if (!f) { preEl.innerHTML = ''; return; }
        preEl.innerHTML = highlight(codeEl.value + '\n', f.lang);
        preEl.scrollTop = codeEl.scrollTop;
        preEl.scrollLeft = codeEl.scrollLeft;
    }
    function refreshGutter() {
        const lines = codeEl.value.split('\n').length;
        gutter.innerHTML = Array.from({ length: lines }, (_, i) => i + 1).join('<br>');
        gutter.scrollTop = codeEl.scrollTop;
    }
    function refreshLnCol() {
        const v = codeEl.value, p = codeEl.selectionStart;
        const before = v.slice(0, p), ln = before.split('\n').length;
        const col = p - before.lastIndexOf('\n');
        $('#dev-ln').textContent = ln; $('#dev-col').textContent = col;
    }
    var _saveTimer = null;
    codeEl.addEventListener('input', () => {
        const f = cur(); if (f) f.code = codeEl.value;
        refreshHighlight(); refreshGutter(); refreshLnCol(); maybeAutocomplete();
        clearTimeout(_saveTimer);
        _saveTimer = setTimeout(saveSession, 2000);
    });

    codeEl.addEventListener('click', () => { refreshLnCol(); hideAutocomplete(); });
    codeEl.addEventListener('keyup', e => { if (!['ArrowUp', 'ArrowDown', 'Tab', 'Enter', 'Escape'].includes(e.key)) refreshLnCol(); });
    codeEl.addEventListener('scroll', () => {
        gutter.scrollTop = codeEl.scrollTop;
        preEl.scrollTop = codeEl.scrollTop;
        preEl.scrollLeft = codeEl.scrollLeft;
        hideAutocomplete();
    });
    codeEl.addEventListener('keydown', e => {
        if (handleAutocompleteKey(e)) return;

        const v = codeEl.value;
        const s = codeEl.selectionStart, end = codeEl.selectionEnd;

        // ── Tab：缩进 / 多行缩进 ──
        if (e.key === 'Tab' && !e.shiftKey) {
            e.preventDefault();
            if (s !== end) {
                // 多行选中：整体缩进
                const lineStart = v.lastIndexOf('\n', s - 1) + 1;
                const before = v.slice(0, lineStart);
                const selected = v.slice(lineStart, end);
                const after = v.slice(end);
                const indented = selected.replace(/^/gm, '    ');
                codeEl.value = before + indented + after;
                codeEl.selectionStart = lineStart;
                codeEl.selectionEnd = lineStart + indented.length;
            } else {
                codeEl.value = v.slice(0, s) + '    ' + v.slice(end);
                codeEl.selectionStart = codeEl.selectionEnd = s + 4;
            }
            const f = cur(); if (f) f.code = codeEl.value;
            refreshHighlight(); refreshGutter();
            return;
        }

        // ── Shift+Tab：反向缩进 ──
        if (e.key === 'Tab' && e.shiftKey) {
            e.preventDefault();
            const lineStart = v.lastIndexOf('\n', s - 1) + 1;
            const selEnd = end === s ? v.indexOf('\n', s) : end;
            const actualEnd = selEnd === -1 ? v.length : selEnd;
            const before = v.slice(0, lineStart);
            const selected = v.slice(lineStart, actualEnd);
            const after = v.slice(actualEnd);
            const dedented = selected.replace(/^    /gm, '').replace(/^ {1,3}/gm, '');
            const newEnd = lineStart + dedented.length;
            codeEl.value = before + dedented + after;
            codeEl.selectionStart = Math.max(lineStart, s - (selected.length - dedented.length));
            codeEl.selectionEnd = newEnd;
            const f = cur(); if (f) f.code = codeEl.value;
            refreshHighlight(); refreshGutter();
            return;
        }

        // ── Enter：自动缩进 ──
        if (e.key === 'Enter') {
            const lineStart = v.lastIndexOf('\n', s - 1) + 1;
            const lineText = v.slice(lineStart, s);
            const indent = lineText.match(/^[ \t]*/)[0];
            const extra = /[\{:]\s*$/.test(lineText) ? '    ' : '';
            if (indent || extra) {
                e.preventDefault();
                const ins = '\n' + indent + extra;
                // 如果光标在 { 后面且下一行是 }，插入空行并把 } 单独放一行
                const afterCursor = v.slice(end);
                const nextChar = afterCursor.trimStart()[0];
                if (extra && nextChar === '}') {
                    const closingIndent = indent;
                    const fullIns = '\n' + indent + extra + '\n' + closingIndent;
                    codeEl.value = v.slice(0, s) + fullIns + v.slice(end);
                    codeEl.selectionStart = codeEl.selectionEnd = s + ('\n' + indent + extra).length;
                } else {
                    codeEl.value = v.slice(0, s) + ins + v.slice(end);
                    codeEl.selectionStart = codeEl.selectionEnd = s + ins.length;
                }
                const f = cur(); if (f) f.code = codeEl.value;
                refreshHighlight(); refreshGutter();
            }
            return;
        }

        // ── 括号/引号自动配对 ──
        if ((e.key === '{' || e.key === '(' || e.key === '[' || e.key === '"' || e.key === "'") && s === end) {
            const pair = { '{': '}', '(': ')', '[': ']', '"': '"', "'": "'" }[e.key];
            e.preventDefault();
            codeEl.value = v.slice(0, s) + e.key + pair + v.slice(s);
            codeEl.selectionStart = codeEl.selectionEnd = s + 1;
            const f = cur(); if (f) f.code = codeEl.value;
            refreshHighlight();
            return;
        }

        // ── 选中文本后输入括号：包裹选中内容 ──
        if ((e.key === '{' || e.key === '(' || e.key === '[' || e.key === '"' || e.key === "'") && s !== end) {
            const pair = { '{': '}', '(': ')', '[': ']', '"': '"', "'": "'" }[e.key];
            e.preventDefault();
            const selected = v.slice(s, end);
            codeEl.value = v.slice(0, s) + e.key + selected + pair + v.slice(end);
            codeEl.selectionStart = s + 1;
            codeEl.selectionEnd = s + 1 + selected.length;
            const f = cur(); if (f) f.code = codeEl.value;
            refreshHighlight();
            return;
        }

        // ── 右括号/引号：跳过已有的配对字符 ──
        if ((e.key === '}' || e.key === ')' || e.key === ']' || e.key === '"' || e.key === "'") && s === end) {
            if (v[s] === e.key) {
                e.preventDefault();
                codeEl.selectionStart = codeEl.selectionEnd = s + 1;
                return;
            }
        }

        // ── Backspace：删除配对括号 ──
        if (e.key === 'Backspace' && s === end && s > 0) {
            const pairs = { '{': '}', '(': ')', '[': ']', '"': '"', "'": "'" };
            const left = v[s - 1], right = v[s];
            if (pairs[left] === right) {
                e.preventDefault();
                codeEl.value = v.slice(0, s - 1) + v.slice(s + 1);
                codeEl.selectionStart = codeEl.selectionEnd = s - 1;
                const f = cur(); if (f) f.code = codeEl.value;
                refreshHighlight(); refreshGutter();
                return;
            }
        }

        // ── Ctrl+D：复制当前行 / 复制选中内容 ──
        if (e.ctrlKey && e.key === 'd') {
            e.preventDefault();
            if (s !== end) {
                // 复制选中内容
                const selected = v.slice(s, end);
                codeEl.value = v.slice(0, end) + selected + v.slice(end);
                codeEl.selectionStart = end;
                codeEl.selectionEnd = end + selected.length;
            } else {
                // 复制当前行
                const lineStart = v.lastIndexOf('\n', s - 1) + 1;
                const lineEnd = v.indexOf('\n', s);
                const actualEnd = lineEnd === -1 ? v.length : lineEnd;
                const line = v.slice(lineStart, actualEnd);
                codeEl.value = v.slice(0, actualEnd) + '\n' + line + v.slice(actualEnd);
                codeEl.selectionStart = codeEl.selectionEnd = actualEnd + 1 + (s - lineStart);
            }
            const f = cur(); if (f) f.code = codeEl.value;
            refreshHighlight(); refreshGutter();
            return;
        }

        // ── Ctrl+Shift+K / Ctrl+Shift+D：删除当前行 ──
        if ((e.ctrlKey && e.shiftKey && (e.key === 'K' || e.key === 'k' || e.key === 'D' || e.key === 'd'))) {
            e.preventDefault();
            const lineStart = v.lastIndexOf('\n', s - 1) + 1;
            const lineEnd = v.indexOf('\n', s);
            if (lineEnd === -1) {
                // 最后一行
                const newVal = lineStart > 0 ? v.slice(0, lineStart - 1) : '';
                codeEl.value = newVal;
                codeEl.selectionStart = codeEl.selectionEnd = Math.min(lineStart - 1, newVal.length);
            } else {
                codeEl.value = v.slice(0, lineStart) + v.slice(lineEnd + 1);
                codeEl.selectionStart = codeEl.selectionEnd = lineStart;
            }
            const f = cur(); if (f) f.code = codeEl.value;
            refreshHighlight(); refreshGutter();
            return;
        }

        // ── Alt+Up / Alt+Down：移动当前行 ──
        if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
            e.preventDefault();
            const lineStart = v.lastIndexOf('\n', s - 1) + 1;
            const lineEnd = v.indexOf('\n', s);
            const actualLineEnd = lineEnd === -1 ? v.length : lineEnd;
            const line = v.slice(lineStart, actualLineEnd);

            if (e.key === 'ArrowUp' && lineStart > 0) {
                const prevLineStart = v.lastIndexOf('\n', lineStart - 2) + 1;
                const prevLine = v.slice(prevLineStart, lineStart - 1);
                const before = v.slice(0, prevLineStart);
                const after = lineEnd === -1 ? '' : v.slice(lineEnd + 1);
                const newVal = before + line + '\n' + prevLine + (lineEnd === -1 ? '' : '\n' + after);
                codeEl.value = newVal;
                const newPos = prevLineStart + (s - lineStart);
                codeEl.selectionStart = codeEl.selectionEnd = newPos;
            } else if (e.key === 'ArrowDown' && lineEnd !== -1) {
                const nextLineEnd = v.indexOf('\n', lineEnd + 1);
                const actualNextEnd = nextLineEnd === -1 ? v.length : nextLineEnd;
                const nextLine = v.slice(lineEnd + 1, actualNextEnd);
                const before = v.slice(0, lineStart);
                const after = nextLineEnd === -1 ? '' : v.slice(nextLineEnd + 1);
                const newVal = before + nextLine + '\n' + line + (nextLineEnd === -1 ? '' : '\n' + after);
                codeEl.value = newVal;
                const newPos = lineStart + nextLine.length + 1 + (s - lineStart);
                codeEl.selectionStart = codeEl.selectionEnd = newPos;
            }
            const f = cur(); if (f) f.code = codeEl.value;
            refreshHighlight(); refreshGutter();
            return;
        }

        // ── Ctrl+/：切换行注释 ──
        if (e.ctrlKey && e.key === '/') {
            e.preventDefault();
            const f = cur();
            const isPy = f && /Python/i.test(f.lang);
            const isJava = f && /Java/i.test(f.lang);
            const commentStr = isPy ? '# ' : '// ';

            const lineStart = v.lastIndexOf('\n', s - 1) + 1;
            const selEnd = s !== end ? end : v.indexOf('\n', s);
            const actualSelEnd = selEnd === -1 ? v.length : selEnd;

            // 找到所有涉及的行
            const before = v.slice(0, lineStart);
            const region = v.slice(lineStart, actualSelEnd);
            const after = v.slice(actualSelEnd);

            const lines = region.split('\n');
            // 判断是否全部已注释
            const allCommented = lines.every(l => l.trimStart().startsWith(commentStr.trim()));
            const toggled = allCommented
                ? lines.map(l => l.replace(new RegExp('^(\\s*)' + commentStr.trim().replace('/', '\\/') + '\\s?'), '$1'))
                : lines.map(l => l.replace(/^(\s*)/, '$1' + commentStr));

            const newRegion = toggled.join('\n');
            codeEl.value = before + newRegion + after;
            codeEl.selectionStart = lineStart;
            codeEl.selectionEnd = lineStart + newRegion.length;
            if (f) f.code = codeEl.value;
            refreshHighlight(); refreshGutter();
            return;
        }

        // ── Ctrl+← / Ctrl+→：按词跳转 ──
        if (e.ctrlKey && e.key === 'ArrowLeft') {
            e.preventDefault();
            let pos = s;
            // 跳过空白
            while (pos > 0 && /\s/.test(v[pos - 1])) pos--;
            // 跳过单词字符
            while (pos > 0 && /\w/.test(v[pos - 1])) pos--;
            if (e.shiftKey) {
                codeEl.selectionStart = pos;
            } else {
                codeEl.selectionStart = codeEl.selectionEnd = pos;
            }
            return;
        }
        if (e.ctrlKey && e.key === 'ArrowRight') {
            e.preventDefault();
            let pos = end;
            // 跳过单词字符
            while (pos < v.length && /\w/.test(v[pos])) pos++;
            // 跳过空白
            while (pos < v.length && /\s/.test(v[pos])) pos++;
            if (e.shiftKey) {
                codeEl.selectionEnd = pos;
            } else {
                codeEl.selectionStart = codeEl.selectionEnd = pos;
            }
            return;
        }

        // ── Home：跳到行首（智能，先跳非空字符起始，再跳列0） ──
        if (e.key === 'Home' && !e.ctrlKey) {
            e.preventDefault();
            const lineStart = v.lastIndexOf('\n', s - 1) + 1;
            const firstNonSpace = v.slice(lineStart).match(/^[ \t]*/)[0].length;
            const smartPos = lineStart + firstNonSpace;
            const newPos = s === smartPos ? lineStart : smartPos;
            if (e.shiftKey) {
                if (s <= smartPos) {
                    codeEl.selectionStart = newPos;
                } else {
                    codeEl.selectionEnd = newPos;
                }
            } else {
                codeEl.selectionStart = codeEl.selectionEnd = newPos;
            }
            return;
        }

        // ── Ctrl+Home / Ctrl+End：跳到文件首尾 ──
        if (e.ctrlKey && e.key === 'Home') {
            e.preventDefault();
            codeEl.selectionStart = codeEl.selectionEnd = 0;
            codeEl.scrollTop = 0;
            return;
        }
        if (e.ctrlKey && e.key === 'End') {
            e.preventDefault();
            codeEl.selectionStart = codeEl.selectionEnd = v.length;
            codeEl.scrollTop = codeEl.scrollHeight;
            return;
        }

        // ── 原有快捷键 ──
        if (e.ctrlKey && e.key === 's') { e.preventDefault(); doSave(); }
        if (e.ctrlKey && e.key === 'n') { e.preventDefault(); doNew(); }
        if (e.ctrlKey && e.key === 'o') { e.preventDefault(); doOpen(); }
        if (e.ctrlKey && e.key === 'f') { e.preventDefault(); doFind(); }
        if (e.key === 'F9') { e.preventDefault(); doCompile(); }
        if (e.key === 'F10') { e.preventDefault(); doRun(); }
        if (e.key === 'F11') { e.preventDefault(); doSubmit(); }
    });


    /* ============== 自动补全 ============== */
    let acompEl = null, acompList = [], acompIdx = 0, acompPrefix = '';
    function removeAcompPopupOnly() {
        try {
            if (acompEl) acompEl.remove();
        } catch (e) { }
        acompEl = null;
        acompList = [];
        acompIdx = 0;

        try {
            document.querySelectorAll('.dev-acomp').forEach(function (el) { el.remove(); });
        } catch (e) { }
    }

    function buildAcomp(prefix, lang) {
        const isPy = /Python/i.test(lang);
        const isJava = /Java/i.test(lang);
        const dict = [
            ...(isPy ? [...KW_PY].map(w => ({ w, t: 'kw' })) : isJava ? [...KW_JAVA].map(w => ({ w, t: 'kw' })) : [
                ...[...KW_CPP].map(w => ({ w, t: 'kw' })),
                ...[...TP_CPP].map(w => ({ w, t: 'type' })),
                { w: 'cout', t: 'std' }, { w: 'cin', t: 'std' }, { w: 'endl', t: 'std' },
                { w: 'printf', t: 'fn' }, { w: 'scanf', t: 'fn' }, { w: 'memset', t: 'fn' },
                { w: 'sort', t: 'fn' }, { w: 'swap', t: 'fn' }, { w: 'max', t: 'fn' }, { w: 'min', t: 'fn' },
                { w: 'push_back', t: 'fn' }, { w: 'size', t: 'fn' }, { w: 'begin', t: 'fn' }, { w: 'end', t: 'fn' },
                { w: 'iostream', t: 'h' }, { w: 'cstdio', t: 'h' }, { w: 'algorithm', t: 'h' }, { w: 'vector', t: 'h' }
            ])
        ];
        const ids = new Set();
        (codeEl.value.match(/[A-Za-z_][A-Za-z0-9_]{2,}/g) || []).forEach(x => ids.add(x));
        ids.forEach(w => { if (!dict.find(d => d.w === w)) dict.push({ w, t: 'id' }); });
        const lp = prefix.toLowerCase();
        return dict.filter(d => d.w.toLowerCase().startsWith(lp) && d.w !== prefix).slice(0, 12);
    }
    function showAcomp(items) {
        removeAcompPopupOnly();
        if (!items.length) return;

        acompEl = document.createElement('div');
        acompEl.className = 'dev-acomp';
        acompList = items;
        acompIdx = 0;

        renderAcomp();

        const rect = codeEl.getBoundingClientRect();
        const lh = parseFloat(getComputedStyle(codeEl).lineHeight) || 18;
        const v = codeEl.value;
        const p = codeEl.selectionStart;
        const before = v.slice(0, p);
        const ln = before.split('\n').length;
        const col = p - before.lastIndexOf('\n') - 1;
        const charW = cfg.codeFont * 0.6;

        acompEl.style.left = (rect.left + 8 + col * charW - codeEl.scrollLeft) + 'px';
        acompEl.style.top = (rect.top + 4 + ln * lh - codeEl.scrollTop) + 'px';

        document.body.appendChild(acompEl);
    }

    function renderAcomp() {
        if (!acompEl) return;
        var html = '';
        for (var i = 0; i < acompList.length; i++) {
            var x = acompList[i];
            html += '<div class="ai' + (i === acompIdx ? ' on' : '') + '" data-i="' + i + '">'
                + esc(x.w) + '<span class="ty">' + esc(x.t || '') + '</span></div>';
        }
        acompEl.innerHTML = html;
        $$('.ai', acompEl).forEach(function (el) {
            el.onclick = function () { acompIdx = +el.dataset.i; applyAcomp(); };
            el.onmouseenter = function () { acompIdx = +el.dataset.i; renderAcomp(); };
        });
    }
    function applyAcomp() {
        if (!acompEl || !acompList.length) return;

        const item = acompList[acompIdx];
        const s = codeEl.selectionStart;
        const e = codeEl.selectionEnd;

        const before = codeEl.value.slice(0, s);
        const m = before.match(/[A-Za-z_][A-Za-z0-9_]*$/);
        const prefix = m ? m[0] : acompPrefix;

        const start = Math.max(0, s - prefix.length);

        codeEl.value = codeEl.value.slice(0, start) + item.w + codeEl.value.slice(e);
        codeEl.selectionStart = codeEl.selectionEnd = start + item.w.length;

        const f = cur();
        if (f) f.code = codeEl.value;

        hideAutocomplete();
        refreshHighlight();
        refreshGutter();
        refreshLnCol();
    }

    function hideAutocomplete() {
        try {
            if (acompEl) acompEl.remove();
        } catch (e) { }
        acompEl = null;
        acompList = [];
        acompIdx = 0;
        acompPrefix = '';

        try {
            document.querySelectorAll('.dev-acomp').forEach(function (el) { el.remove(); });
        } catch (e) { }
    }

    function maybeAutocomplete() {
        const s = codeEl.selectionStart;
        const before = codeEl.value.slice(0, s);
        const m = before.match(/[A-Za-z_][A-Za-z0-9_]*$/);
        if (!m || m[0].length < 2) { hideAutocomplete(); return; }
        acompPrefix = m[0];
        const f = cur(); if (!f) return;
        const items = buildAcomp(acompPrefix, f.lang);
        if (items.length) showAcomp(items); else hideAutocomplete();
    }
    function handleAutocompleteKey(e) {
        if (!acompEl || !acompList.length) return false;
        if (e.key === 'ArrowDown') { e.preventDefault(); acompIdx = (acompIdx + 1) % acompList.length; renderAcomp(); return true; }
        if (e.key === 'ArrowUp') { e.preventDefault(); acompIdx = (acompIdx - 1 + acompList.length) % acompList.length; renderAcomp(); return true; }
        if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); applyAcomp(); return true; }
        if (e.key === 'Escape') { e.preventDefault(); hideAutocomplete(); return true; }
        return false;
    }
    document.addEventListener('mousedown', function (e) {
        if (!acompEl) return;
        if (e.target === codeEl) return;
        if (acompEl.contains(e.target)) return;
        hideAutocomplete();
    }, true);


    /* ============== 文件 Tab 渲染 ============== */
    function renderFileTabs() {
        var wrap = $('#dev-file-tabs');
        var html = '';
        for (var i = 0; i < files.length; i++) {
            var f = files[i];
            var on = i === activeFile ? ' on' : '';
            html += '<div class="dev-tab' + on + '" data-i="' + i + '" title="' + esc(f.name) + '">'
                + '<span>' + esc(f.name) + '</span>'
                + '<span class="x" data-cx="' + i + '">✕</span>'
                + '</div>';
        }
        html += '<div class="dev-tab" id="dev-tab-add" title="新建文件 (Ctrl+N)" style="background:#ECE9D8;">+</div>';
        wrap.innerHTML = html;
        $$('.dev-tab[data-i]', wrap).forEach(function (t) {
            t.onclick = function (e) {
                if (e.target.classList.contains('x')) return;
                switchFile(+t.dataset.i);
            };
        });
        $$('.x[data-cx]', wrap).forEach(function (x) {
            x.onclick = function (e) { e.stopPropagation(); closeFile(+x.dataset.cx); };
        });
        $('#dev-tab-add').onclick = doNew;
        var f = cur();

    }

    function switchFile(i) {
        if (i < 0 || i >= files.length) return;
        if (cur()) cur().code = codeEl.value;
        activeFile = i;
        var f = cur();
        codeEl.value = f.code;
        S_lang_select(f);
        if (f.problem) renderProblem(f.problem);
        else $('#dev-prob').innerHTML = '<p style="color:#888;text-align:center;margin-top:50px;">点击左下角 🔍 搜索题目</p>';
        statusMode.textContent = f.displayId ? ((f.mode === 'contest' ? '比赛 ' : '训练 ') + f.displayId) : '未加载题目';
        $('#dev-desc').style.display = 'none';
        refreshHighlight(); refreshGutter(); refreshLnCol();
        renderFileTabs();
        renderProblemListHighlight();
        saveSession();
    }


    function closeFile(i) {
        if (i < 0 || i >= files.length) return;
        if (i === activeFile && files[i]) files[i].code = codeEl.value;
        var f0 = files[i];
        if (f0 && f0.code && f0.code.trim() && f0.code !== tplFor(f0.lang)) {
            if (!confirm('文件「' + f0.name + '」可能未保存,确认关闭?')) return;
        }
        files.splice(i, 1);
        if (!files.length) {
            newFile({ lang: 'C++ With O2' });
            activeFile = 0;
        } else {
            if (activeFile > i) activeFile -= 1;
            else if (activeFile === i) activeFile = Math.min(i, files.length - 1);
            if (activeFile < 0) activeFile = 0;
        }
        var nf = cur();
        codeEl.value = nf.code;
        S_lang_select(nf);
        if (nf.problem) renderProblem(nf.problem);
        else $('#dev-prob').innerHTML = '<p style="color:#888;text-align:center;margin-top:50px;">在工具栏右侧搜索题目</p>';
        statusMode.textContent = nf.displayId ? ((nf.mode === 'contest' ? '比赛 ' : '训练 ') + nf.displayId) : '未加载题目';
        $('#dev-desc').style.display = 'none';
        refreshHighlight(); refreshGutter(); refreshLnCol();
        renderFileTabs();
        renderProblemListHighlight();
        saveSession();
    }


    function S_lang_select(f) {
        var sel = $('#dev-lang');
        var langs = f.languages || ['C++ With O2', 'C++', 'Python3', 'Java', 'C'];
        var html = '';
        for (var i = 0; i < langs.length; i++) {
            var l = langs[i];
            html += '<option value="' + esc(l) + '"' + (l === f.lang ? ' selected' : '') + '>' + esc(l) + '</option>';
        }
        sel.innerHTML = html;
        sel.value = f.lang;
        statusLang.textContent = f.lang;
    }

    /* ============== 输出 ============== */
    function out(html, cls) {
        var t = new Date().toLocaleTimeString();
        output.innerHTML += '<div class="' + (cls || '') + '"><span class="ts">[' + t + ']</span> ' + html + '</div>';
        output.scrollTop = output.scrollHeight;
    }
    function setStatus(t) { statusMsg.textContent = t; }
    function showBottomPanel(name) {
        $$('.dev-output-hd .otab').forEach(function (t) {
            t.classList.toggle('on', t.dataset.o === name);
        });

        $('#dev-output').style.display = name === 'run' ? '' : 'none';
        $('#dev-result').style.display = name === 'result' ? '' : 'none';
    }

    $$('.dev-output-hd .otab').forEach(function (t) {
        t.onclick = function () {
            showBottomPanel(t.dataset.o);
        };
    });

    $('#dev-clear-out').onclick = function () {
        var resultOn = $('.dev-output-hd .otab[data-o="result"]')?.classList.contains('on');

        if (resultOn) {
            $('#dev-result').innerHTML = '<p style="color:#888;">尚未提交</p>';
        } else {
            output.innerHTML = '';
        }
    };
    // 简介缓存，避免重复请求
    var _descCache = {};

    async function loadDescription() {
        var descEl = $('#dev-desc-view');
        if (!descEl) return;

        var mode = problemListState.mode;
        var tid = problemListState.tid;
        var cid = problemListState.cid;

        if (!mode) {
            descEl.innerHTML = '<p style="color:#888;text-align:center;margin-top:50px;">加载题单后可查看简介</p>';
            var titleEl = $('#dev-desc-title');
            if (titleEl) titleEl.textContent = '';
            return;
        }

        var cacheKey = mode + '_' + (tid || cid);
        if (_descCache[cacheKey] !== undefined) {
            descEl.innerHTML = _descCache[cacheKey] || '<p style="color:#888;text-align:center;margin-top:30px;">该题单暂无简介</p>';
            renderLatex(descEl);
            return;
        }

        descEl.innerHTML = '<p style="color:#0058E1;text-align:center;margin-top:50px;">加载中...</p>';

        try {
            var r, title = '', desc = '';
            if (mode === 'contest' && cid) {
                r = await req('/api/oj/get-contest-info?cid=' + encodeURIComponent(cid));
                title = (r && r.data && (r.data.title || r.data.name)) || ('比赛 #' + cid);
                desc = String((r && r.data && r.data.description) || '');
            } else if (mode === 'training' && tid) {
                r = await req('/api/oj/get-training-detail?tid=' + encodeURIComponent(tid));
                title = (r && r.data && (r.data.title || r.data.name)) || ('训练 #' + tid);
                desc = String((r && r.data && r.data.description) || '');
            }

            // 更新标题栏
            var titleEl = $('#dev-desc-title');
            if (titleEl) titleEl.textContent = title;

            var html = '<h2>' + esc(title) + ' 简介</h2>';
            if (desc.trim()) {
                html += '<div class="dev-md-preview">' + renderMarkdown(desc) + '</div>';
            } else {
                html += '<p style="color:#888;text-align:center;margin-top:30px;">该题单暂无简介</p>';
            }

            _descCache[cacheKey] = desc.trim() ? html : '';
            descEl.innerHTML = html;
            renderLatex(descEl);
        } catch (e) {
            descEl.innerHTML = '<p style="color:#C00;text-align:center;margin-top:30px;">加载简介失败: ' + esc(e.message) + '</p>';
        }
    }


    /* ============== 简介面板编辑事件 ============== */
    var descEditBtn = $('#dev-desc-edit-btn');
    if (descEditBtn) {
        descEditBtn.onclick = async function () {
            var panel = $('#dev-desc-edit-panel');
            var view = $('#dev-desc-view');
            var isEditing = panel.style.display !== 'none';
            if (isEditing) {
                panel.style.display = 'none';
                view.style.display = '';
                descEditBtn.textContent = '⚙ 编辑';
            } else {
                if (!problemListState.mode) { out('请先加载题单', 'err'); return; }
                try {
                    setStatus('读取简介...');
                    var result = await fetchDescForEdit();
                    var ta = $('#dev-desc-textarea');
                    var previewEl = $('#dev-desc-live-preview');
                    if (ta) {
                        ta.value = result.desc;
                        if (previewEl) {
                            previewEl.innerHTML = result.desc.trim()
                                ? renderMarkdown(result.desc)
                                : '<p style="color:#888;text-align:center;margin-top:30px;">暂无内容</p>';
                            renderLatex(previewEl);
                        }
                        if (!ta._previewBound) {
                            ta._previewBound = true;
                            ta.oninput = function () {
                                if (!previewEl) return;
                                var val = ta.value;
                                previewEl.innerHTML = val.trim()
                                    ? renderMarkdown(val)
                                    : '<p style="color:#888;text-align:center;margin-top:30px;">暂无内容</p>';
                                renderLatex(previewEl);
                            };
                        }
                    }
                    panel.style.display = 'flex';
                    view.style.display = 'none';
                    descEditBtn.textContent = '✕ 关闭';
                    setStatus('就绪');
                } catch (e) {
                    out('读取简介失败: ' + e.message, 'err');
                    setStatus('读取失败');
                }
            }
        };
    }

    var descSaveBtn = $('#dev-desc-save');
    if (descSaveBtn) {
        descSaveBtn.onclick = async function () {
            if (!problemListState.mode) { out('请先加载题单', 'err'); return; }
            var newDesc = $('#dev-desc-textarea').value;
            try {
                setStatus('保存简介...');
                out('正在保存简介...', 'run');
                await saveDescription(newDesc);
                out('简介已保存', 'ok');
                setStatus('保存成功');
                // 保存后切回预览，刷新内容
                $('#dev-desc-edit-panel').style.display = 'none';
                $('#dev-desc-view').style.display = '';
                $('#dev-desc-edit-btn').textContent = '⚙ 编辑';
                loadDescription();
            } catch (e) {
                out('保存失败: ' + e.message, 'err');
                setStatus('保存失败');
            }
        };
    }

    var descSyncBtn = $('#dev-desc-sync-from');
    if (descSyncBtn) {
        descSyncBtn.onclick = function () {
            if (!problemListState.mode) { out('请先加载题单', 'err'); return; }

            var m = modal('从其他题单同步简介',
                '<div style="padding:12px;font-size:12px;">' +
                '<div style="margin-bottom:6px;">选择来源类型：</div>' +
                '<select id="dev-ds-type" style="width:100%;height:26px;border:1px solid #7F9DB9;font-size:12px;box-sizing:border-box;margin-bottom:8px;">' +
                '<option value="public-training">公共训练</option>' +
                '<option value="group-training">团队训练</option>' +
                '<option value="group-contest">团队比赛</option>' +
                '</select>' +
                '<div id="dev-ds-group-wrap" style="display:none;margin-bottom:8px;">' +
                '<div style="margin-bottom:4px;">选择团队：</div>' +
                '<select id="dev-ds-group" style="width:100%;height:26px;border:1px solid #7F9DB9;font-size:12px;box-sizing:border-box;"><option value="">加载中...</option></select>' +
                '</div>' +
                '<div id="dev-ds-cat-wrap" style="margin-bottom:8px;">' +
                '<div style="margin-bottom:4px;">选择分类：</div>' +
                '<select id="dev-ds-cat" style="width:100%;height:26px;border:1px solid #7F9DB9;font-size:12px;box-sizing:border-box;"><option value="">加载中...</option></select>' +
                '</div>' +
                '<div id="dev-ds-item-wrap" style="margin-bottom:4px;">' +
                '<div style="margin-bottom:4px;" id="dev-ds-item-label">选择训练：</div>' +
                '<select id="dev-ds-item" style="width:100%;height:26px;border:1px solid #7F9DB9;font-size:12px;box-sizing:border-box;"><option value="">请先选择分类</option></select>' +
                '</div>' +
                '</div>',
                [
                    {
                        t: '填入简介', f: async function (mm) {
                            var type = mm.querySelector('#dev-ds-type').value;
                            var itemVal = mm.querySelector('#dev-ds-item').value;
                            var groupSel = mm.querySelector('#dev-ds-group');
                            var gid = groupSel ? groupSel.value : '';
                            if (type !== 'public-training' && !gid) { alert('请选择团队'); return; }
                            if (!itemVal) { alert('请选择题单'); return; }
                            mm.remove();
                            try {
                                setStatus('读取来源简介...');
                                var sourceMode = (type === 'group-contest') ? 'contest' : 'training';
                                var desc = await fetchDescFromSource(sourceMode, itemVal);
                                if (!desc.trim()) { out('来源题单暂无简介', 'err'); setStatus('无内容'); return; }
                                $('#dev-desc-textarea').value = desc;
                                var previewEl = $('#dev-desc-live-preview');
                                if (previewEl) {
                                    previewEl.innerHTML = renderMarkdown(desc);
                                    renderLatex(previewEl);
                                }
                                out('已填入来源简介，请确认后点击「保存并更新」', 'ok');
                                setStatus('填入完成');
                            } catch (e) {
                                out('同步失败: ' + e.message, 'err');
                                setStatus('同步失败');
                            }
                        }
                    },
                    { t: '取消', f: function (mm) { mm.remove(); } }
                ]
            );

            var typeSel = m.querySelector('#dev-ds-type');
            var catWrap = m.querySelector('#dev-ds-cat-wrap');
            var catSel = m.querySelector('#dev-ds-cat');
            var groupWrap = m.querySelector('#dev-ds-group-wrap');
            var itemWrap = m.querySelector('#dev-ds-item-wrap');
            var groupSel = m.querySelector('#dev-ds-group');
            var itemSel = m.querySelector('#dev-ds-item');
            var itemLabel = m.querySelector('#dev-ds-item-label');

            typeSel.onchange = function () {
                var t = typeSel.value;
                if (t === 'public-training') {
                    catWrap.style.display = '';
                    groupWrap.style.display = 'none';
                    itemLabel.textContent = '选择训练：';
                    itemSel.innerHTML = '<option value="">请先选择分类</option>';
                    loadPublicCategoriesInto(catSel, itemSel);
                } else {
                    catWrap.style.display = 'none';
                    groupWrap.style.display = '';
                    itemWrap.style.display = 'none';
                    itemSel.innerHTML = '<option value="">请先选择团队</option>';
                    itemLabel.textContent = (t === 'group-contest') ? '选择比赛：' : '选择训练：';
                    loadGroupsInto(groupSel);
                }
            };

            catSel.onchange = function () {
                itemWrap.style.display = '';
                loadPublicTrainingsInto(itemSel, catSel.value);
            };

            groupSel.onchange = function () {
                var g = groupSel.value;
                if (!g) { itemSel.innerHTML = '<option value="">请先选择团队</option>'; itemWrap.style.display = 'none'; return; }
                itemWrap.style.display = '';
                if (typeSel.value === 'group-contest') {
                    loadGroupContestsInto(itemSel, g);
                } else {
                    loadGroupTrainingsInto(itemSel, g);
                }
            };

            loadPublicCategoriesInto(catSel, itemSel);
        };
    }


    /* ============== 左侧 Tab 切换（题目描述/评测结果/题目列表侧栏） ============== */

    $$('.dev-left .dev-tab').forEach(t => {
        if (!t.dataset.v) return;

        t.onclick = () => {
            if (t.dataset.v === 'plist-toggle') {
                var sb = $('#dev-plist-sidebar');
                sb.classList.toggle('collapsed');
                if (sb.classList.contains('collapsed')) {
                    t.classList.remove('on');
                } else {
                    t.classList.add('on');
                }
                return;
            }

            $$('.dev-left .dev-tab').forEach(x => {
                if (x.dataset.v && x.dataset.v !== 'plist-toggle') x.classList.remove('on');
            });

            t.classList.add('on');

            var probEl = $('#dev-prob');
            var descEl = $('#dev-desc');
            if (t.dataset.v === 'prob') {
                probEl.style.display = '';
                descEl.style.display = 'none';
            } else if (t.dataset.v === 'desc') {
                probEl.style.display = 'none';
                descEl.style.display = '';
                loadDescription();
            }
        };
    });




    // 侧栏收起按钮
    $('#dev-plist-collapse').onclick = function () {
        $('#dev-plist-sidebar').classList.add('collapsed');
        var toggleTab = $('#dev-tab-plist-toggle');
        if (toggleTab) toggleTab.classList.remove('on');
    };


    /* ============== 题目列表渲染 ============== */
    /* ============== 获取做题状态 ============== */
    async function fetchAcStatus() {
        var probs = problemListState.problems;
        if (!probs.length) return;

        var mode = problemListState.mode;
        var newAcSet = new Set();

        try {
            if (mode === 'contest') {
                var cid = problemListState.cid;
                if (!cid) return;

                var ids = probs.map(function (p) {
                    return p.displayId || sid(p);
                }).filter(Boolean);

                var tasks = ids.map(function (displayId) {
                    return (async function () {
                        var page = 1;
                        var limit = 50;

                        while (true) {
                            var url = '/api/oj/contest-submissions'
                                + '?onlyMine=true'
                                + '&problemID=' + encodeURIComponent(displayId)
                                + '&currentPage=' + page
                                + '&limit=' + limit
                                + '&completeProblemID=true'
                                + '&contestID=' + encodeURIComponent(cid)
                                + '&beforeContestSubmit=false';

                            var r = await req(url);

                            var records = (r && r.data && r.data.records) || [];

                            for (var i = 0; i < records.length; i++) {
                                var rec = records[i];
                                var st = String(rec.status == null ? '' : rec.status);
                                var did = String(rec.displayId || '');

                                if (st === '0' && (!did || did === String(displayId))) {
                                    newAcSet.add(String(displayId));
                                    return;
                                }
                            }

                            var pages = Number((r && r.data && r.data.pages) || 1);
                            if (page >= pages) break;
                            page++;
                        }
                    })().catch(function () { });
                });

                await Promise.all(tasks);
            } else {
                var gid = problemListState.gid;
                var ids2 = probs.map(function (p) {
                    return p.displayId || sid(p);
                }).filter(Boolean);

                var tasks2 = ids2.map(function (displayId) {
                    var url = '/api/oj/get-submission-list'
                        + '?onlyMine=true'
                        + '&status=0'
                        + '&problemID=' + encodeURIComponent(displayId)
                        + '&completeProblemID=false';

                    if (gid) {
                        url += '&gid=' + encodeURIComponent(gid);
                    }

                    return req(url).then(function (r) {
                        var records =
                            (r && r.data && r.data.records)
                            || (r && r.data && r.data.submissionList && r.data.submissionList.records)
                            || [];

                        if (Array.isArray(records) && records.length > 0) {
                            newAcSet.add(String(displayId));
                        }
                    }).catch(function () { });
                });

                await Promise.all(tasks2);
            }
        } catch (e) {
            out('获取做题状态失败: ' + e.message, 'err');
            return;
        }

        acSet = newAcSet;
        renderProblemListAcMarks();
        setStatus('状态已刷新');
        saveSession();
    }


    function renderProblemListAcMarks() {
        var el = $('#dev-plist');
        if (!el) return;
        el.querySelectorAll('.dev-plist-item').forEach(function (item) {
            var i = +item.dataset.i;
            var p = problemListState.problems[i];
            if (!p) return;
            var displayId = p.displayId || sid(p);
            var markEl = item.querySelector('.ac-mark');
            if (acSet.has(displayId)) {
                item.classList.add('ac-done');
                if (!markEl) {
                    var span = document.createElement('span');
                    span.className = 'ac-mark';
                    span.textContent = '✓';
                    item.appendChild(span);
                }
            } else {
                item.classList.remove('ac-done');
                if (markEl) markEl.remove();
            }
        });
    }


    function renderProblemList() {
        var el = $('#dev-plist');
        var probs = problemListState.problems;
        if (!probs.length) {
            // 区分"从未加载"和"题单为空"
            var hasLoaded = !!problemListState.mode;
            var countText = hasLoaded ? '题单为空' : '未加载题单';
            var hintText = hasLoaded
                ? '当前题单没有题目，点击 ✏ 编辑或 ⟳ 重新加载'
                : '请先加载题单';
            el.innerHTML = '<div class="dev-plist-sidebar-search">'
                + '<span class="count" id="dev-plist-count" style="color:#888;">' + countText + '</span>'
                + '<span style="flex:1;"></span>'
                + (hasLoaded ? '<button id="dev-plist-edit" title="编辑题单" style="height:20px;padding:0 5px;background:#ECE9D8;border:1px solid #ACA899;cursor:pointer;font-size:11px;border-radius:2px;flex-shrink:0;">✏</button>' : '')
                + '<button id="dev-plist-settings" title="加载题单" style="height:20px;padding:0 5px;background:#ECE9D8;border:1px solid #ACA899;cursor:pointer;font-size:11px;border-radius:2px;flex-shrink:0;">⟳</button>'
                + '</div>'
                + '<div class="dev-plist-sidebar-empty">' + hintText + '</div>';
            var settingsBtn = $('#dev-plist-settings');
            if (settingsBtn) settingsBtn.onclick = function () { var mode = problemListState.mode; if (!mode) { out('请先通过加载器加载题单', 'err'); return; } if (mode === 'training') { loadProblemListFromTraining(problemListState.tid, problemListState.gid, !!problemListState.gid); } else { loadProblemListFromContest(problemListState.cid, problemListState.gid); } };
            var editBtn = $('#dev-plist-edit');
            if (editBtn) editBtn.onclick = function () { toggleEditMode(); };
            return;
        }


        var label = problemListState.label || (problemListState.mode === 'contest' ? '比赛题单' : '训练题单');
        var html = '<div class="dev-plist-sidebar-search">'
            + '<input id="dev-plist-search" placeholder="在题单内搜索...">'
            + '<span class="count" id="dev-plist-count">' + probs.length + '题</span>'
            + '<button id="dev-plist-edit" title="编辑题单" style="height:20px;padding:0 5px;background:#ECE9D8;border:1px solid #ACA899;cursor:pointer;font-size:11px;border-radius:2px;flex-shrink:0;">✏</button>'
            + '<button id="dev-plist-settings" title="刷新题单" style="height:20px;padding:0 5px;background:#ECE9D8;border:1px solid #ACA899;cursor:pointer;font-size:11px;border-radius:2px;flex-shrink:0;">⟳</button>'
            + '</div>';


        var curFile = cur();
        for (var i = 0; i < probs.length; i++) {
            var p = probs[i];
            var isActive = curFile && curFile.displayId === (p.displayId || sid(p));
            html += '<div class="dev-plist-item' + (isActive ? ' active' : '') + '" data-i="' + i + '">'
                + '<span class="pid">' + esc(p.displayId || sid(p)) + '</span>'
                + '<span class="ptitle" title="' + esc(ptitle(p)) + '">' + esc(ptitle(p)) + '</span>'
                + '</div>';
        }
        el.innerHTML = html;

        // 绑定刷新按钮
        // 绑定设置按钮（加载题单）
        var settingsBtn = $('#dev-plist-settings'); if (settingsBtn) { settingsBtn.onclick = function () { var mode = problemListState.mode; if (!mode) { out('请先通过加载器加载题单', 'err'); return; } if (mode === 'training') { loadProblemListFromTraining(problemListState.tid, problemListState.gid, !!problemListState.gid); } else { loadProblemListFromContest(problemListState.cid, problemListState.gid); } }; }
        var editBtn = $('#dev-plist-edit');
        if (editBtn) {
            editBtn.onclick = function () {
                toggleEditMode();
            };
        }


        // 绑定题单内搜索
        var searchIpt = $('#dev-plist-search');
        if (searchIpt) {
            searchIpt.oninput = function () {
                var kw = searchIpt.value.trim().toLowerCase();
                var items = el.querySelectorAll('.dev-plist-item');
                var visible = 0;
                for (var j = 0; j < items.length; j++) {
                    var idx = +items[j].dataset.i;
                    var pp = probs[idx];
                    if (!pp) { items[j].style.display = 'none'; continue; }
                    var idStr = (pp.displayId || sid(pp) || '').toLowerCase();
                    var titleStr = (ptitle(pp) || '').toLowerCase();
                    var match = !kw || idStr.indexOf(kw) !== -1 || titleStr.indexOf(kw) !== -1;
                    items[j].style.display = match ? '' : 'none';
                    if (match) visible++;
                }
                var countEl = $('#dev-plist-count');
                if (countEl) countEl.textContent = kw ? (visible + '/' + probs.length + '题') : (probs.length + '题');
            };
        }

        el.querySelectorAll('.dev-plist-item').forEach(function (item) {
            item.onclick = function () {
                var p = probs[+item.dataset.i];
                openProblemFromList(p);
            };
        });
    }
    /* ============== 题单编辑模式 ============== */
    let editMode = false;
    let editList = [];       // 编辑中的题目列表（可变顺序的副本）
    let editDragIdx = -1;
    let editSearchOpen = false;

    // 辅助：获取题目的数字 pid（用于 API 调用）
    const ppv = p => String((p && ((p.pid != null && p.pid) || (p.problemId != null && p.problemId) || (p.id != null && p.id))) || '');

    // 辅助：数字转字母编号（比赛用）
    function numToLetters(n) {
        var s = ''; n = parseInt(n, 10);
        while (n > 0) { n--; s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26); }
        return s || 'A';
    }

    // 辅助：带重试的请求
    async function retryReq(fn, n, gap) {
        n = n || 3; gap = gap || 500;
        var err;
        for (var i = 0; i < n; i++) {
            try { return await fn(); } catch (e) { err = e; }
            if (i < n - 1) await sleep(gap + i * 200);
        }
        throw err;
    }
    /* ============== 简介编辑 API ============== */
    async function fetchDescForEdit() {
        var mode = problemListState.mode;
        var tid = problemListState.tid;
        var cid = problemListState.cid;
        if (!mode) throw new Error('请先加载题单');
        var r, title = '', desc = '';
        if (mode === 'training') {
            r = await req('/api/oj/get-training-detail?tid=' + encodeURIComponent(tid));
            title = (r && r.data && (r.data.title || r.data.name)) || ('训练 #' + tid);
            desc = String((r && r.data && r.data.description) || '');
        } else {
            r = await req('/api/oj/get-contest-info?cid=' + encodeURIComponent(cid));
            title = (r && r.data && (r.data.title || r.data.name)) || ('比赛 #' + cid);
            desc = String((r && r.data && r.data.description) || '');
        }
        return { desc: desc, title: title };
    }

    async function saveDescription(newDesc) {
        var mode = problemListState.mode;
        var tid = problemListState.tid;
        var cid = problemListState.cid;
        if (!mode) throw new Error('请先加载题单');

        if (mode === 'training') {
            var groupRes = await retryReq(function () {
                return req('/api/oj/group/training?tid=' + encodeURIComponent(tid));
            });
            var raw = (groupRes && groupRes.data) || {};
            var targetData = raw.training || raw;
            if (!targetData || !targetData.id) throw new Error('训练信息获取失败');
            var categoryId = (raw.trainingCategory && raw.trainingCategory.id)
                || (targetData.trainingCategory && targetData.trainingCategory.id)
                || targetData.categoryId || 0;
            await retryReq(function () {
                return req('/api/oj/group/training', 'PUT', {
                    training: {
                        id: targetData.id,
                        title: targetData.title || '',
                        description: newDesc,
                        author: targetData.author || '',
                        auth: targetData.auth || 'Private',
                        privatePwd: targetData.privatePwd || '',
                        status: typeof targetData.status === 'boolean' ? targetData.status : true,
                        rank: typeof targetData.rank === 'number' ? targetData.rank : 0,
                        isGroup: typeof targetData.isGroup === 'boolean' ? targetData.isGroup : true,
                        gid: String(targetData.gid || ''),
                        gmtCreate: targetData.gmtCreate,
                        gmtModified: targetData.gmtModified
                    },
                    trainingCategory: { id: categoryId }
                });
            });
        } else {
            var contestRes = await retryReq(function () {
                return req('/api/oj/get-contest-info?cid=' + encodeURIComponent(cid));
            });
            var contestData = (contestRes && contestRes.data) || {};
            if (!contestData.id) throw new Error('比赛信息获取失败');
            await retryReq(function () {
                return req('/api/oj/group/contest', 'PUT', Object.assign({}, contestData, { description: newDesc }));
            });
        }
        _descCache = {};
    }

    async function fetchDescFromSource(sourceMode, sourceId) {
        var r;
        if (sourceMode === 'training') {
            r = await req('/api/oj/get-training-detail?tid=' + encodeURIComponent(sourceId));
        } else {
            r = await req('/api/oj/get-contest-info?cid=' + encodeURIComponent(sourceId));
        }
        return String((r && r.data && r.data.description) || '');
    }

    function toggleEditMode() {
        if (!problemListState.mode) {
            out('请先加载题单再编辑', 'err');
            return;
        }
        if (!token()) { alert('请先登录后再编辑题单'); return; }
        editMode = !editMode;
        if (editMode) {
            editList = problemListState.problems.map(function (p, i) {
                return Object.assign({}, p, { _editIdx: i });
            });
            renderEditMode();
        } else {
            renderProblemList();
        }
    }

    function renderEditMode() {
        var el = $('#dev-plist');
        if (!el) return;

        var label = problemListState.mode === 'contest' ? '比赛' : '训练';
        var html = '';

        // 工具栏第一行：主操作
        html += '<div class="dev-edit-bar">';
        html += '<span style="font-size:11px;color:#555;"> 共 ' + editList.length + ' 题 </span>';
        html += '<button class="dev-edit-btn" id="dev-edit-add">➕ 搜索加题</button>';
        html += '<button class="dev-edit-btn" id="dev-edit-sync">📋 同步题单</button>';
        html += '<button class="dev-edit-btn danger" id="dev-edit-del-sel">🗑 删除选中</button>';
        html += '</div>';
        // 工具栏第二行：选择操作
        html += '<div class="dev-edit-bar" style="border-top:1px solid #E0C84A;">';
        html += '<button class="dev-edit-btn" id="dev-edit-chk-all">☑ 全选</button>';
        html += '<button class="dev-edit-btn" id="dev-edit-chk-inv">⬜ 反选</button>';
        html += '<div class="dev-edit-sep"></div>';
        html += '<button class="dev-edit-btn primary" id="dev-edit-save">💾 保存题单</button>';
        html += '<button class="dev-edit-btn" id="dev-edit-exit" style="font-weight:bold;">✕ 退出编辑</button>';
        html += '</div>';


        // 搜索加题区域（默认隐藏）
        html += '<div class="dev-edit-search" id="dev-edit-search-bar" style="display:none;">';
        html += '<input id="dev-edit-search-kw" placeholder="搜索题号/关键词加题...">';
        html += '<button class="dev-edit-btn" id="dev-edit-search-go">🔍</button>';
        html += '</div>';
        html += '<div class="dev-edit-search-results" id="dev-edit-search-results" style="display:none;"></div>';

        // 题目列表（可拖动）
        for (var i = 0; i < editList.length; i++) {
            var p = editList[i];
            html += '<div class="dev-edit-item" draggable="true" data-i="' + i + '">'
                + '<input type="checkbox" class="edit-chk" data-i="' + i + '" style="flex-shrink:0;">'
                + '<span class="drag-handle">☰</span>'
                + '<span class="idx">' + (i + 1) + '</span>'
                + '<span class="pid">' + esc(p.displayId || sid(p)) + '</span>'
                + '<span class="ptitle" title="' + esc(ptitle(p)) + '">' + esc(ptitle(p)) + '</span>'
                + '<span class="del-btn" data-i="' + i + '" title="删除">✕</span>'
                + '</div>';
        }

        if (!editList.length) {
            html += '<div style="color:#888;text-align:center;margin-top:40px;font-size:11px;">题单为空，请点击「搜索加题」或「从题单同步」</div>';
        }

        el.innerHTML = html;
        bindEditModeEvents();
    }

    function bindEditModeEvents() {
        var el = $('#dev-plist');
        if (!el) return;

        // 保存顺序
        var saveBtn = $('#dev-edit-save');
        if (saveBtn) saveBtn.onclick = function () { saveEditOrder(); };

        // 搜索加题
        var addBtn = $('#dev-edit-add');
        if (addBtn) addBtn.onclick = function () {
            var bar = $('#dev-edit-search-bar');
            editSearchOpen = !editSearchOpen;
            if (bar) bar.style.display = editSearchOpen ? '' : 'none';
            var results = $('#dev-edit-search-results');
            if (results && !editSearchOpen) results.style.display = 'none';
            if (editSearchOpen) {
                var kw = $('#dev-edit-search-kw');
                if (kw) kw.focus();
            }
        };

        // 搜索执行
        var searchGo = $('#dev-edit-search-go');
        if (searchGo) searchGo.onclick = function () { doEditSearch(); };
        var searchKw = $('#dev-edit-search-kw');
        if (searchKw) searchKw.onkeydown = function (e) { if (e.key === 'Enter') doEditSearch(); };

        // 从题单同步
        var syncBtn = $('#dev-edit-sync');
        if (syncBtn) syncBtn.onclick = function () { openSyncDialog(); };

        // 全选
        var chkAllBtn = $('#dev-edit-chk-all');
        if (chkAllBtn) chkAllBtn.onclick = function () {
            el.querySelectorAll('.edit-chk').forEach(function (c) { c.checked = true; });
        };

        // 反选
        var chkInvBtn = $('#dev-edit-chk-inv');
        if (chkInvBtn) chkInvBtn.onclick = function () {
            el.querySelectorAll('.edit-chk').forEach(function (c) { c.checked = !c.checked; });
        };

        // 删除选中
        var delSelBtn = $('#dev-edit-del-sel');
        if (delSelBtn) delSelBtn.onclick = function () { deleteSelectedFromEdit(); };


        // 退出编辑
        var exitBtn = $('#dev-edit-exit');
        if (exitBtn) exitBtn.onclick = function () {
            editMode = false;
            renderProblemList();
        };

        // 单个删除按钮
        el.querySelectorAll('.del-btn').forEach(function (btn) {
            btn.onclick = function (e) {
                e.stopPropagation();
                var idx = +btn.dataset.i;
                editList.splice(idx, 1);
                renderEditMode();
            };
        });

        // 拖拽排序
        var dragItems = el.querySelectorAll('.dev-edit-item');
        dragItems.forEach(function (item) {
            item.addEventListener('dragstart', function (e) {
                editDragIdx = +item.dataset.i;
                item.classList.add('dragging');
                if (e.dataTransfer) e.dataTransfer.setData('text/plain', String(editDragIdx));
            });
            item.addEventListener('dragend', function () {
                item.classList.remove('dragging');
                editDragIdx = -1;
                el.querySelectorAll('.dev-edit-item').forEach(function (x) { x.classList.remove('drag-over'); });
            });
            item.addEventListener('dragover', function (e) {
                e.preventDefault();
                item.classList.add('drag-over');
            });
            item.addEventListener('dragleave', function () {
                item.classList.remove('drag-over');
            });
            item.addEventListener('drop', function (e) {
                e.preventDefault();
                item.classList.remove('drag-over');
                var dropIdx = +item.dataset.i;
                if (editDragIdx < 0 || editDragIdx === dropIdx) return;
                var moved = editList.splice(editDragIdx, 1)[0];
                editList.splice(dropIdx, 0, moved);
                renderEditMode();
            });
        });
    }

    // === 搜索加题 ===
    var editSearchResults = [];
    async function doEditSearch() {
        var kw = $('#dev-edit-search-kw');
        if (!kw) return;
        var q = kw.value.trim();
        if (!q) return;

        var resultsEl = $('#dev-edit-search-results');
        if (resultsEl) {
            resultsEl.style.display = '';
            resultsEl.innerHTML = '<div style="padding:8px;color:#0058E1;font-size:11px;text-align:center;">搜索中...</div>';
        }

        try {
            var r = await req('/api/oj/get-problem-list?keyword=' + encodeURIComponent(q) + '&limit=50&currentPage=1');
            var d = r && r.data;
            var arr = [];
            if (Array.isArray(d)) arr = d;
            else if (d && Array.isArray(d.records)) arr = d.records;
            else if (d && d.problemList && Array.isArray(d.problemList.records)) arr = d.problemList.records;
            else if (d && Array.isArray(d.problemList)) arr = d.problemList;

            editSearchResults = arr;

            if (!arr.length) {
                resultsEl.innerHTML = '<div style="padding:8px;color:#888;font-size:11px;text-align:center;">无结果</div>';
                return;
            }

            // 已在编辑列表中的题目 ID 集合
            var existingPids = new Set(editList.map(function (p) { return ppv(p); }));

            var html = '';
            for (var i = 0; i < arr.length; i++) {
                var p = arr[i];
                var already = existingPids.has(ppv(p));
                html += '<div class="sr-item" data-i="' + i + '">'
                    + '<span class="pid">' + esc(sid(p)) + '</span>'
                    + '<span class="ptitle">' + esc(ptitle(p)) + '</span>'
                    + (already
                        ? '<span style="color:#888;font-size:10px;flex-shrink:0;">已添加</span>'
                        : '<span class="add-btn" data-i="' + i + '">+ 加题</span>')
                    + '</div>';
            }
            resultsEl.innerHTML = html;

            resultsEl.querySelectorAll('.add-btn').forEach(function (btn) {
                btn.onclick = function (e) {
                    e.stopPropagation();
                    var p = editSearchResults[+btn.dataset.i];
                    if (!p) return;
                    editList.push(Object.assign({}, p));
                    btn.textContent = '已添加';
                    btn.style.color = '#888';
                    btn.style.cursor = 'default';
                    btn.classList.remove('add-btn');
                    // 更新计数
                    renderEditMode();
                };
            });
        } catch (e) {
            if (resultsEl) resultsEl.innerHTML = '<div style="padding:8px;color:#C00;font-size:11px;">搜索失败: ' + esc(e.message) + '</div>';
        }
    }

    // === 删除选中 ===
    function deleteSelectedFromEdit() {
        var el = $('#dev-plist');
        if (!el) return;
        var checks = el.querySelectorAll('.edit-chk:checked');
        if (!checks.length) { out('请勾选要删除的题目', 'err'); return; }
        var indices = [];
        checks.forEach(function (ch) { indices.push(+ch.dataset.i); });
        indices.sort(function (a, b) { return b - a; }); // 从后往前删
        for (var i = 0; i < indices.length; i++) {
            editList.splice(indices[i], 1);
        }
        out('已移除 ' + indices.length + ' 题（需保存才能生效）', 'ok');
        renderEditMode();
    }

    // === 保存顺序（训练模式回写 rank，比赛模式重建题目） ===
    async function saveEditOrder() {
        if (!editList.length && !problemListState.problems.length) {
            out('题单为空，无需保存', 'err');
            return;
        }

        var mode = problemListState.mode;
        var tid = problemListState.tid;
        var cid = problemListState.cid;
        var gid = problemListState.gid;

        setStatus('保存题单修改中...');
        out('正在保存题单修改...', 'run');

        try {
            if (mode === 'training' && tid) {
                await saveTrainingEdit(tid, gid);
            } else if (mode === 'contest' && cid) {
                await saveContestEdit(cid, gid);
            } else {
                out('无法识别题单类型', 'err');
                return;
            }

            // 重新加载题单
            if (mode === 'training') {
                await loadProblemListFromTraining(tid, gid, !!gid);
            } else {
                await loadProblemListFromContest(cid, gid);
            }
            editMode = false;
            out('题单修改已保存', 'ok');
            setStatus('保存成功');
        } catch (e) {
            out('保存失败: ' + e.message, 'err');
            setStatus('保存失败');
        }
    }

    // 训练模式保存：先确保新增题目已添加，再回写顺序，删除不在列表中的题目
    async function saveTrainingEdit(tid, gid) {
        var origPids = new Set(problemListState.problems.map(ppv));
        var newPids = new Set(editList.map(ppv));

        // 1. 添加新题目
        for (var i = 0; i < editList.length; i++) {
            var p = editList[i];
            if (!origPids.has(ppv(p))) {
                setStatus('添加题目: ' + sid(p) + '...');
                await retryReq(function () {
                    return req('/api/oj/group/add-training-problem-from-public', 'POST', {
                        pid: parseInt(ppv(p), 10),
                        tid: parseInt(tid, 10),
                        displayId: sid(p)
                    });
                });
                await sleep(300);
            }
        }

        // 2. 删除不再存在的题目
        for (var j = 0; j < problemListState.problems.length; j++) {
            var old = problemListState.problems[j];
            if (!newPids.has(ppv(old))) {
                setStatus('删除题目: ' + sid(old) + '...');
                await retryReq(function () {
                    return req('/api/oj/group/training-problem?pid=' + encodeURIComponent(ppv(old)) + '&tid=' + encodeURIComponent(tid), 'DELETE');
                });
                await sleep(300);
            }
        }

        // 3. 等待服务端数据同步
        await sleep(1200);

        // 4. 回写顺序 (rank)
        setStatus('回写题单顺序...');
        var metaMap = new Map();
        var allFound = false;
        for (var round = 0; round < 8; round++) {
            var res = await retryReq(function () {
                return req('/api/oj/group/get-training-problem-list?tid=' + encodeURIComponent(tid) + '&limit=1000&currentPage=1');
            });
            var rawMap = res && res.data && res.data.trainingProblemMap ? res.data.trainingProblemMap : {};
            metaMap = new Map();
            Object.keys(rawMap).forEach(function (k) {
                var item = rawMap[k];
                if (item && item.pid != null) metaMap.set(String(item.pid), item);
            });
            allFound = editList.every(function (src) { return metaMap.has(ppv(src)); });
            if (allFound) break;
            await sleep(1000);
        }

        if (!allFound) {
            throw new Error('服务端数据同步超时，部分题目未找到');
        }

        for (var m = 0; m < editList.length; m++) {
            var src = editList[m];
            var meta = metaMap.get(ppv(src));
            if (!meta) continue;
            await retryReq(function () {
                return req('/api/oj/group/training-problem', 'PUT', {
                    id: parseInt(meta.id, 10),
                    tid: parseInt(meta.tid, 10),
                    pid: parseInt(meta.pid, 10),
                    displayId: meta.displayId || sid(src),
                    rank: m + 1,
                    gmtCreate: meta.gmtCreate,
                    gmtModified: meta.gmtModified
                });
            });
            await sleep(200);
        }
    }

    // 比赛模式保存：删旧加新，按顺序赋予字母编号
    async function saveContestEdit(cid, gid) {
        setStatus('重建比赛题目...');

        // 1. 读取当前题目列表
        var rawMap = {};
        try {
            var mapR = await req('/api/oj/group/get-contest-problem-list?cid=' + encodeURIComponent(cid));
            if (mapR && mapR.data && mapR.data.contestProblemMap) {
                rawMap = mapR.data.contestProblemMap;
            } else if (mapR && mapR.data && Array.isArray(mapR.data.records)) {
                rawMap = {};
                mapR.data.records.forEach(function (x, i) {
                    var key = String(x.pid != null ? x.pid : i);
                    rawMap[key] = x;
                });
            }
        } catch (e) { }

        // 2. 删除所有旧题目
        var currentList = Object.keys(rawMap).map(function (k) {
            return rawMap[k];
        });
        for (var i = 0; i < currentList.length; i++) {
            var pid = String(currentList[i].pid ?? currentList[i].problemId ?? Object.keys(rawMap)[i]);
            setStatus('删除旧题目 ' + (i + 1) + '/' + currentList.length);
            await retryReq(function () {
                return req('/api/oj/group/contest-problem?pid=' + encodeURIComponent(pid) + '&cid=' + encodeURIComponent(cid), 'DELETE');
            });
            await sleep(200);
        }

        // 3. 按顺序添加新题目
        for (var j = 0; j < editList.length; j++) {
            var p = editList[j];
            var displayId = numToLetters(j + 1);
            setStatus('添加题目 ' + (j + 1) + '/' + editList.length + ': ' + displayId);
            await retryReq(function () {
                return req('/api/oj/group/add-contest-problem-from-public', 'POST', {
                    pid: parseInt(ppv(p), 10),
                    cid: parseInt(cid, 10),
                    displayId: displayId
                });
            });
            await sleep(300);
        }
    }

    // === 从其他题单同步弹窗 ===
    function openSyncDialog() {
        var m = modal('从其他题单同步',
            '<div style="padding:12px;font-size:12px;">' +
            '<div style="margin-bottom:8px;">选择同步来源：</div>' +
            '<select id="dev-sync-type" style="width:100%;height:26px;border:1px solid #7F9DB9;font-size:12px;box-sizing:border-box;margin-bottom:8px;">' +
            '<option value="public-training">公共训练</option>' +
            '<option value="group-training">团队训练</option>' +
            '<option value="group-contest">团队比赛</option>' +
            '</select>' +
            // 团队选择器
            '<div id="dev-sync-group-wrap" style="display:none;">' +
            '<div style="margin-bottom:4px;">选择团队：</div>' +
            '<select id="dev-sync-group" style="width:100%;height:26px;border:1px solid #7F9DB9;font-size:12px;box-sizing:border-box;margin-bottom:8px;">' +
            '<option value="">加载中...</option>' +
            '</select>' +
            '</div>' +
            // 分类选择器（公共训练）
            '<div id="dev-sync-cat-wrap" style="">' +
            '<div style="margin-bottom:4px;">选择分类：</div>' +
            '<select id="dev-sync-cat" style="width:100%;height:26px;border:1px solid #7F9DB9;font-size:12px;box-sizing:border-box;margin-bottom:8px;">' +
            '<option value="">加载中...</option>' +
            '</select>' +
            '</div>' +
            // 训练/比赛选择器
            '<div id="dev-sync-item-wrap" style="">' +
            '<div style="margin-bottom:4px;" id="dev-sync-item-label">选择训练：</div>' +
            '<select id="dev-sync-item" style="width:100%;height:26px;border:1px solid #7F9DB9;font-size:12px;box-sizing:border-box;margin-bottom:8px;">' +
            '<option value="">请先选择分类</option>' +
            '</select>' +
            '</div>' +
            // 同步模式
            '<div style="margin-top:8px;margin-bottom:4px;">同步模式：</div>' +
            '<select id="dev-sync-mode" style="width:100%;height:26px;border:1px solid #7F9DB9;font-size:12px;box-sizing:border-box;margin-bottom:8px;">' +
            '<option value="append">追加模式（保留现有题目，将新题目添加到末尾）</option>' +
            '<option value="overwrite">覆盖模式（替换全部题目为新题单内容）</option>' +
            '</select>' +
            '</div>',
            [
                {
                    t: '同步', f: function (mm) {
                        var type = mm.querySelector('#dev-sync-type').value;
                        var itemVal = mm.querySelector('#dev-sync-item').value;
                        var groupSel = mm.querySelector('#dev-sync-group');
                        var gid = groupSel ? groupSel.value : '';
                        var syncModeVal = mm.querySelector('#dev-sync-mode').value;

                        if (type !== 'public-training' && !gid) { alert('请选择团队'); return; }
                        if (!itemVal) { alert('请选择题单'); return; }
                        mm.remove();
                        doSyncFromSource(type, itemVal, gid, syncModeVal);
                    }
                },
                { t: '取消', f: function (mm) { mm.remove(); } }
            ]
        );

        var typeSel = m.querySelector('#dev-sync-type');
        var catWrap = m.querySelector('#dev-sync-cat-wrap');
        var catSel = m.querySelector('#dev-sync-cat');
        var groupWrap = m.querySelector('#dev-sync-group-wrap');
        var itemWrap = m.querySelector('#dev-sync-item-wrap');
        var groupSel = m.querySelector('#dev-sync-group');
        var itemSel = m.querySelector('#dev-sync-item');
        var itemLabel = m.querySelector('#dev-sync-item-label');

        typeSel.onchange = function () {
            var t = typeSel.value;
            if (t === 'public-training') {
                catWrap.style.display = '';
                groupWrap.style.display = 'none';
                itemLabel.textContent = '选择训练：';
                itemSel.innerHTML = '<option value="">请先选择分类</option>';
                loadPublicCategoriesInto(catSel,itemSel);
            } else {
                catWrap.style.display = 'none';
                groupWrap.style.display = '';
                itemWrap.style.display = 'none';
                itemSel.innerHTML = '<option value="">请先选择团队</option>';
                itemLabel.textContent = (t === 'group-contest') ? '选择比赛：' : '选择训练：';
                loadGroupsInto(groupSel);
            }
        };

        catSel.onchange = function () {
            var categoryId = catSel.value;
            itemWrap.style.display = '';
            loadPublicTrainingsInto(itemSel, categoryId);
        };

        groupSel.onchange = function () {
            var g = groupSel.value;
            if (!g) { itemSel.innerHTML = '<option value="">请先选择团队</option>'; itemWrap.style.display = 'none'; return; }
            itemWrap.style.display = '';
            var t = typeSel.value;
            if (t === 'group-contest') {
                loadGroupContestsInto(itemSel, g);
            } else {
                loadGroupTrainingsInto(itemSel, g);
            }
        };

        // 默认加载公共训练分类
        loadPublicCategoriesInto(catSel);
    }

async function doSyncFromSource(type, itemId, gid, syncMode) {
    setStatus('加载源题单...');
    out('正在加载源题单...', 'run');

    // ── 权限验证（与加载题单逻辑一致）──
    try {
        if (type === 'group-training') {
            if (gid) {
                var groupOk = await checkGroupAccess(gid);
                if (!groupOk) { out('暂未加入该团队，无法读取题单', 'err'); setStatus('无权限'); return; }
            }
            var trainOk = await checkTrainingAccess(itemId);
            if (!trainOk) {
                var needPwd = false;
                try {
                    var infoR = await req('/api/oj/get-training-problem-list?tid=' + encodeURIComponent(itemId));
                    var auth = infoR && infoR.data && infoR.data.training && infoR.data.training.auth;
                    needPwd = (auth === 'Private');
                } catch (e) {
                    needPwd = true;
                }
                if (needPwd) {
                    while (true) {
                        var pwd = await promptPassword('训练需要密码', '训练 #' + itemId);
                        if (pwd === null) { out('已取消', 'err'); setStatus('已取消'); return; }
                        try { await registerTraining(itemId, pwd); break; }
                        catch (e) { out('密码错误或验证失败，请重试', 'err'); }
                    }
                } else {
                    try { await registerTraining(itemId, ''); } catch (e) { }
                }
            }
        } else if (type === 'group-contest') {
            if (gid) {
                var groupOk2 = await checkGroupAccess(gid);
                if (!groupOk2) { out('暂未加入该团队，无法读取比赛', 'err'); setStatus('无权限'); return; }
            }
            var contestOk = await checkContestAccess(itemId);
            if (!contestOk) {
                while (true) {
                    var pwd2 = await promptPassword('比赛需要密码', '比赛 #' + itemId);
                    if (pwd2 === null) { out('已取消', 'err'); setStatus('已取消'); return; }
                    try { await registerContest(itemId, pwd2); break; }
                    catch (e) { out('密码错误或验证失败，请重试', 'err'); }
                }
            }
        }
        // public-training 无需权限验证
    } catch (e) {
        out('权限验证失败: ' + e.message, 'err');
        setStatus('验证失败');
        return;
    }

    try {
        var sourceProblems = [];

        if (type === 'public-training') {
                var r = await req('/api/oj/get-training-problem-list?tid=' + encodeURIComponent(itemId) + '&limit=1000&currentPage=1');
                var d = r && r.data;
                if (d && d.problemList && Array.isArray(d.problemList.records)) sourceProblems = d.problemList.records;
                else if (d && Array.isArray(d.records)) sourceProblems = d.records;
                else if (Array.isArray(d)) sourceProblems = d;
                else if (d && d.trainingProblemMap) {
                    sourceProblems = Object.keys(d.trainingProblemMap).map(function (k) {
                        var m = d.trainingProblemMap[k];
                        return { displayId: m.displayId || k, title: m.title || m.displayTitle || '', problemName: m.title || m.displayTitle || '', pid: m.pid || m.problemId || k, problemId: m.problemId || m.pid || k };
                    });
                }
            } else if (type === 'group-training') {
                var r2 = await req('/api/oj/get-training-problem-list?tid=' + encodeURIComponent(itemId) + '&limit=1000&currentPage=1');
                var d2 = r2 && r2.data;
                if (d2 && d2.problemList && Array.isArray(d2.problemList.records)) sourceProblems = d2.problemList.records;
                else if (d2 && Array.isArray(d2.records)) sourceProblems = d2.records;
                else if (Array.isArray(d2)) sourceProblems = d2;
                else if (d2 && d2.trainingProblemMap) {
                    sourceProblems = Object.keys(d2.trainingProblemMap).map(function (k) {
                        var m2 = d2.trainingProblemMap[k];
                        return { displayId: m2.displayId || k, title: m2.title || m2.displayTitle || '', problemName: m2.title || m2.displayTitle || '', pid: m2.pid || m2.problemId || k, problemId: m2.problemId || m2.pid || k };
                    });
                }
                if (!sourceProblems.length) {
                    // 降级
                    var r2b = await req('/api/oj/get-training-problem-list?tid=' + encodeURIComponent(itemId) + '&limit=1000&currentPage=1');
                    var d2b = r2b && r2b.data;
                    if (d2b && d2b.problemList && Array.isArray(d2b.problemList.records)) sourceProblems = d2b.problemList.records;
                    else if (d2b && Array.isArray(d2b.records)) sourceProblems = d2b.records;
                    else if (Array.isArray(d2b)) sourceProblems = d2b;
                }
            } else if (type === 'group-contest') {
                // 复用已有的比赛题目加载逻辑
                var mapR = await req('/api/oj/group/get-contest-problem-list?cid=' + encodeURIComponent(itemId));
                if (mapR && mapR.data && mapR.data.contestProblemMap) {
                    var cm = mapR.data.contestProblemMap;
                    sourceProblems = Object.keys(cm).map(function (k) {
                        var item = cm[k];
                        return {
                            pid: item.pid ?? item.problemId ?? k,
                            problemId: item.problemId ?? item.pid ?? k,
                            displayId: item.displayId || '',
                            title: item.displayTitle || item.title || item.problemName || '',
                            displayTitle: item.displayTitle || item.title || '',
                            problemName: item.problemName || item.title || ''
                        };
                    });
                } else {
                    var cr = await req('/api/oj/get-contest-problem?cid=' + encodeURIComponent(itemId));
                    var cd = cr && cr.data;
                    if (Array.isArray(cd)) sourceProblems = cd;
                    else if (cd && Array.isArray(cd.records)) sourceProblems = cd.records;
                }
                // 按字母序排
                var ltn = function (s) {
                    s = String(s || '').trim().toUpperCase();
                    if (!/^[A-Z]+$/.test(s)) return 1e9;
                    var n = 0; for (var i = 0; i < s.length; i++) n = n * 26 + (s.charCodeAt(i) - 64); return n;
                };
                sourceProblems.sort(function (a, b) { return ltn(a.displayId) - ltn(b.displayId); });
            }

            if (!sourceProblems.length) {
                out('源题单无题目', 'err');
                setStatus('同步完成（无题目）');
                return;
            }

            // 去重辅助
            var existingPids = new Set(editList.map(ppv));

            if (syncMode === 'overwrite') {
                // 覆盖模式：直接替换
                editList = sourceProblems.map(function (p) { return Object.assign({}, p); });
                out('已覆盖为源题单内容: ' + sourceProblems.length + ' 题（需保存生效）', 'ok');
            } else {
                // 追加模式：只加不重复的
                var added = 0;
                for (var i = 0; i < sourceProblems.length; i++) {
                    var sp = sourceProblems[i];
                    if (!existingPids.has(ppv(sp))) {
                        editList.push(Object.assign({}, sp));
                        existingPids.add(ppv(sp));
                        added++;
                    }
                }
                out('追加 ' + added + ' 题到编辑列表（需保存生效）', 'ok');
            }

            renderEditMode();
            setStatus('同步完成');
        } catch (e) {
            out('同步加载失败: ' + e.message, 'err');
            setStatus('同步失败');
        }
    }


    function renderProblemListHighlight() {
        var el = $('#dev-plist');
        if (!el) return;
        var curFile = cur();
        el.querySelectorAll('.dev-plist-item').forEach(function (item) {
            var i = +item.dataset.i;
            var p = problemListState.problems[i];
            if (!p) return;
            var isActive = curFile && curFile.displayId === (p.displayId || sid(p));
            if (isActive) item.classList.add('active');
            else item.classList.remove('active');
        });
        renderProblemListAcMarks();
    }

    async function openProblemFromList(p) {
        setStatus('加载题目中...');
        try {
            var opt;
            if (problemListState.mode === 'contest') {
                opt = { mode: 'contest', displayId: p.displayId || '', cid: problemListState.cid, pidNum: p.problemId || p.pid };
            } else {
                opt = { mode: 'training', displayIdInput: p.displayId || sid(p), tid: problemListState.tid, gid: problemListState.gid };
            }
            await openProblem(opt);
            // 切到题目描述 Tab（不收起侧栏，保持可见）
            $$('.dev-left .dev-tab').forEach(x => {
                if (x.dataset.v && x.dataset.v !== 'plist-toggle') x.classList.remove('on');
            });
            $$('.dev-left .dev-tab').forEach(x => { if (x.dataset.v === 'prob') x.classList.add('on'); });
            $('#dev-prob').style.display = '';
            $('#dev-desc').style.display = 'none';
        } catch (e) {
            setStatus('加载失败');
            out('题目加载失败: ' + e.message, 'err');
            alert('加载失败: ' + e.message);
        }
    }


    /* ============== 加载题单到题目列表 ============== */
    async function loadProblemListFromTraining(tid, gid, isGroup) {
        try {
            if (isGroup && gid) {
                var groupOk = await checkGroupAccess(gid);
                if (!groupOk) { out('暂未加入该团队，无法读取题单', 'err'); setStatus('无权限'); return; }
            }
            if (isGroup) {
                var trainOk = await checkTrainingAccess(tid);
                if (!trainOk) {
                    // 先查训练信息，判断是否真的需要密码
                    var needPwd = false;
                    try {
                        var infoR = await req('/api/oj/get-training-problem-list?tid=' + encodeURIComponent(tid));
                        var auth = infoR && infoR.data && infoR.data.training && infoR.data.training.auth;
                        needPwd = (auth === 'Private');
                    } catch (e) {
                        // 查不到训练信息，保守处理：若无权限则弹密码
                        needPwd = true;
                    }

                    if (needPwd) {
                        while (true) {
                            var pwd = await promptPassword('训练需要密码', '训练 #' + tid);
                            if (pwd === null) { out('已取消', 'err'); return; }
                            try { await registerTraining(tid, pwd); break; }
                            catch (e) { out('密码错误或验证失败，请重试', 'err'); }
                        }
                    } else {
                        // 公开训练但未注册，尝试自动注册（密码为空）
                        try {
                            await registerTraining(tid, '');
                        } catch (e) {
                            // 自动注册失败也继续，可能本来就不需要注册
                        }
                    }
                }
            }


            var arr, rankMap = {};

            if (isGroup) {
                var url = '/api/oj/get-training-problem-list?tid=' + tid + '&limit=1000&currentPage=1';
                var r = await req(url);

                // 先把 trainingProblemMap 里的 rank 存下来，key 为 pid
                if (r && r.data && r.data.trainingProblemMap) {
                    Object.keys(r.data.trainingProblemMap).forEach(function (k) {
                        var m = r.data.trainingProblemMap[k];
                        var pid = String(m.pid || m.problemId || k);
                        rankMap[pid] = m.rank != null ? Number(m.rank) : 999999;
                    });
                }

                arr = (r && r.data && r.data.problemList && r.data.problemList.records)
                    || (r && r.data && r.data.records)
                    || (r && r.data && r.data.trainingProblemMap && Object.keys(r.data.trainingProblemMap).map(function (k) {
                        var m = r.data.trainingProblemMap[k];
                        return { displayId: m.displayId || k, title: m.title || m.displayTitle || '', problemName: m.title || m.displayTitle || '', pid: m.pid || m.problemId || k };
                    }))
                    || (Array.isArray(r && r.data) ? r.data : []);

                if (!arr || !arr.length) {
                    try {
                        url = '/api/oj/get-training-problem-list?tid=' + tid + '&limit=1000&currentPage=1';
                        r = await req(url);
                        arr = (r && r.data && r.data.problemList && r.data.problemList.records)
                            || (r && r.data && r.data.records)
                            || (Array.isArray(r && r.data) ? r.data : []);
                    } catch (e2) { }
                }
            } else {
                var url2 = '/api/oj/get-training-problem-list?tid=' + tid + '&limit=1000&currentPage=1';
                var r2 = await req(url2);

                if (r2 && r2.data && r2.data.trainingProblemMap) {
                    Object.keys(r2.data.trainingProblemMap).forEach(function (k) {
                        var m = r2.data.trainingProblemMap[k];
                        var pid = String(m.pid || m.problemId || k);
                        rankMap[pid] = m.rank != null ? Number(m.rank) : 999999;
                    });
                }

                arr = (r2 && r2.data && r2.data.problemList && r2.data.problemList.records)
                    || (r2 && r2.data && r2.data.records)
                    || (Array.isArray(r2 && r2.data) ? r2.data : []);
            }

            if (!arr) arr = [];

            // 用 rankMap 排序，找不到 rank 的排最后
            if (Object.keys(rankMap).length) {
                arr.sort(function (a, b) {
                    var pa = String(a.pid || a.problemId || a.id || '');
                    var pb = String(b.pid || b.problemId || b.id || '');
                    var ra = rankMap[pa] != null ? rankMap[pa] : 999999;
                    var rb = rankMap[pb] != null ? rankMap[pb] : 999999;
                    return ra - rb;
                });
            }

            problemListState = { mode: 'training', tid: tid, cid: '', gid: isGroup ? gid : '', problems: arr, label: '训练题单' };
            renderProblemList();
            fetchAcStatus();
            //out('训练题单已加载: ' + arr.length + ' 题', 'ok');
            setStatus('题单已加载');
            _descCache = {};
            // 如果当前正在看简介 Tab，自动刷新
            var descTab = $('.dev-left .dev-tab[data-v="desc"]');
            if (descTab && descTab.classList.contains('on')) {
                loadDescription();
            }

            saveSession();
            $('#dev-plist-sidebar').classList.remove('collapsed');
            var toggleTab = $('#dev-tab-plist-toggle');
            if (toggleTab) toggleTab.classList.add('on');
            $$('.dev-left .dev-tab').forEach(function (x) {
                if (x.dataset.v && x.dataset.v !== 'plist-toggle') x.classList.remove('on');
            });
            $$('.dev-left .dev-tab').forEach(function (x) { if (x.dataset.v === 'prob') x.classList.add('on'); });
            $('#dev-prob').style.display = '';
            $('#dev-desc').style.display = 'none';
            _descCache = {};
        } catch (e) {
            out('题单加载失败: ' + e.message, 'err');
            setStatus('加载失败');
        }
    }


    async function loadProblemListFromContest(cid, gid) {
        setStatus('加载比赛题单...');
        try {
            if (gid) {
                var groupOk = await checkGroupAccess(gid);
                if (!groupOk) { out('暂未加入该团队，无法读取比赛', 'err'); setStatus('无权限'); return; }
            }
            var contestOk = await checkContestAccess(cid);
            if (!contestOk) {
                while (true) {
                    var pwd = await promptPassword('比赛需要密码', '比赛 #' + cid);
                    if (pwd === null) { out('已取消', 'err'); return; }
                    try { await registerContest(cid, pwd); break; }
                    catch (e) { out('密码错误或验证失败，请重试', 'err'); }
                }
            }


            // ── 第一步：拉 contestProblemMap（含 displayId 和完整标题）──
            var rawMap = {};
            var problemIdMap = {};
            try {
                var mapR = await req('/api/oj/group/get-contest-problem-list?cid=' + encodeURIComponent(cid));
                var plRecords = mapR && mapR.data && mapR.data.problemList && mapR.data.problemList.records;
                if (Array.isArray(plRecords)) {
                    plRecords.forEach(function (x) {
                        if (x.id != null && x.problemId) problemIdMap[String(x.id)] = x.problemId;
                    });
                }
                if (mapR && mapR.data && mapR.data.contestProblemMap) {
                    rawMap = mapR.data.contestProblemMap;
                    Object.keys(rawMap).forEach(function (k) {
                        var pid = String(rawMap[k] && rawMap[k].pid != null ? rawMap[k].pid : k);
                        if (problemIdMap[pid]) rawMap[k].problemId = problemIdMap[pid];
                    });
                } else if (mapR && mapR.data && Array.isArray(mapR.data.records)) {
                    rawMap = {};
                    mapR.data.records.forEach(function (x, i) {
                        var key = String(x.pid != null ? x.pid : x.problemId != null ? x.problemId : i);
                        rawMap[key] = x;
                        if (problemIdMap[key]) rawMap[key].problemId = problemIdMap[key];
                    });
                }
            } catch (e) { }

            // ── 第二步：拉基础题目列表（主要用于补充 rawMap 没有的条目）──
            var baseList = [];
            try {
                var rr = await req('/api/oj/get-contest-problem?cid=' + encodeURIComponent(cid));
                var dd = rr && rr.data;
                if (Array.isArray(dd)) baseList = dd;
                else if (dd && Array.isArray(dd.records)) baseList = dd.records;
                else if (dd && Array.isArray(dd.problemList)) baseList = dd.problemList;
            } catch (e) { }

            // ── 第三步：合并，rawMap 中的字段优先 ──
            // 辅助：从一个 map 条目提取标题，保证不返回空字符串
            function mapTitle(m) {
                return (m && (m.displayTitle || m.title || m.problemName || m.name)) || '';
            }

            var contestList = [];
            var letToN = function (s) {
                s = String(s || '').trim().toUpperCase();
                if (!/^[A-Z]+$/.test(s)) return 1e9;
                var n = 0;
                for (var i = 0; i < s.length; i++) n = n * 26 + (s.charCodeAt(i) - 64);
                return n;
            };

            if (Object.keys(rawMap).length) {
                // rawMap 有数据时，以 rawMap 为主建列表
                contestList = Object.keys(rawMap).map(function (k) {
                    var m = rawMap[k] || {};
                    var pidVal = m.pid != null ? m.pid : m.problemId != null ? m.problemId : k;
                    // 从 baseList 里找同 pid 的条目补充字段
                    var base = baseList.find(function (x) {
                        return String(x.pid != null ? x.pid : x.id != null ? x.id : x.problemId) === String(pidVal);
                    }) || {};
                    var titleVal = mapTitle(m) || mapTitle(base) || ('题目' + (m.displayId || k));
                    return {
                        pid: pidVal,
                        id: pidVal,
                        problemId: m.problemId || m.pid || base.problemId || pidVal,
                        displayId: m.displayId || base.displayId || '',
                        title: titleVal,
                        displayTitle: titleVal,
                        problemName: titleVal
                    };
                });
            } else if (baseList.length) {
                // rawMap 完全为空时降级用 baseList
                contestList = baseList.map(function (item, i) {
                    var titleVal = mapTitle(item) || ('题目' + (item.displayId || i));
                    return {
                        pid: item.pid != null ? item.pid : item.id != null ? item.id : i,
                        id: item.id != null ? item.id : item.pid != null ? item.pid : i,
                        problemId: item.problemId || item.pid || i,
                        displayId: item.displayId || '',
                        title: titleVal,
                        displayTitle: titleVal,
                        problemName: titleVal
                    };
                });
            }

            // ── 第四步：按 displayId 字母序排序 ──
            contestList.sort(function (a, b) { return letToN(a.displayId) - letToN(b.displayId); });

            problemListState = { mode: 'contest', tid: '', cid: cid, gid: gid || '', problems: contestList, label: '比赛题单' };
            renderProblemList();
            fetchAcStatus();
            //out('比赛题单已加载: ' + contestList.length + ' 题', 'ok');
            setStatus('题单已加载');
            _descCache = {};
            // 如果当前正在看简介 Tab，自动刷新
            var descTab = $('.dev-left .dev-tab[data-v="desc"]');
            if (descTab && descTab.classList.contains('on')) {
                loadDescription();
            }

            $('#dev-plist-sidebar').classList.remove('collapsed');
            var toggleTab = $('#dev-tab-plist-toggle');
            if (toggleTab) toggleTab.classList.add('on');
            $$('.dev-left .dev-tab').forEach(function (x) {
                if (x.dataset.v && x.dataset.v !== 'plist-toggle') x.classList.remove('on');
            });
            $$('.dev-left .dev-tab').forEach(function (x) { if (x.dataset.v === 'prob') x.classList.add('on'); });
            $('#dev-prob').style.display = '';
            $('#dev-desc').style.display = 'none';
            _descCache = {};

        } catch (e) {
            out('比赛题单加载失败: ' + e.message, 'err');
            setStatus('加载失败');
        }
    }


    /* ============== 顶部菜单 ============== */
    /* ============== 管理团队（含新建题单 & 批量删除） ============== */
    async function doManageGroup(presetGid, presetGrpName) {
        if (!token()) { alert('请先登录'); return; }

        // ── 1. 加载团队列表 ──
        var groups = [];
        try {
            var grpR = await req('/api/oj/get-group-list?onlyMine=true&limit=100&currentPage=1');
            var grpD = grpR && grpR.data;
            if (Array.isArray(grpD)) groups = grpD;
            else if (grpD && Array.isArray(grpD.records)) groups = grpD.records;
            else if (grpD && grpD.groupList && Array.isArray(grpD.groupList.records)) groups = grpD.groupList.records;
            else if (grpD && Array.isArray(grpD.groupList)) groups = grpD.groupList;
        } catch (e) { out('加载团队列表失败: ' + e.message, 'err'); }

        // ── 2. 构建团队下拉 ──
        var grpOptions = '<option value="">-- 请选择团队 --</option>';
        for (var i = 0; i < groups.length; i++) {
            var g = groups[i];
            var gid = String(g.id || g.gid || '');
            var selected = (gid && gid === String(presetGid)) ? ' selected' : '';
            grpOptions += '<option value="' + esc(gid) + '"' + selected + '>' + esc(g.name || g.title || ('团队#' + gid)) + '</option>';
        }
        if (!groups.length) grpOptions = '<option value="">暂无团队</option>';

        // ── 3. 弹窗 HTML ──
        var bodyHtml =
            '<div style="padding:10px 12px 6px;font-size:12px;">' +
            // 团队选择行
            '<div style="display:flex;align-items:center;gap:6px;margin-bottom:8px;">' +
            '<span style="flex-shrink:0;">选择团队：</span>' +
            '<select id="dev-mg-gid" style="flex:1;height:26px;border:1px solid #7F9DB9;font-size:12px;box-sizing:border-box;">' + grpOptions + '</select>' +
            '<button id="dev-mg-refresh" style="height:26px;padding:0 10px;background:#ECE9D8;border:1px solid #ACA899;cursor:pointer;font-size:11px;font-family:inherit;">刷新</button>' +
            '</div>' +
            // Tab 切换
            '<div style="display:flex;gap:0;border-bottom:1px solid #ACA899;margin-bottom:0;">' +
            '<div id="dev-mg-tab-train" style="padding:4px 14px;cursor:pointer;border:1px solid #ACA899;border-bottom:none;background:#fff;font-size:12px;font-weight:bold;margin-bottom:-1px;">训练题单</div>' +
            '<div id="dev-mg-tab-contest" style="padding:4px 14px;cursor:pointer;border:1px solid transparent;background:#D4D0C8;font-size:12px;margin-bottom:-1px;">团队比赛</div>' +
            '</div>' +
            // 列表区域
            '<div id="dev-mg-list-wrap" style="border:1px solid #ACA899;border-top:none;height:260px;overflow-y:auto;background:#fff;">' +
            '<div style="color:#888;text-align:center;padding:40px 0;font-size:12px;">请先选择团队</div>' +
            '</div>' +
            // 底部工具栏
            '<div style="display:flex;gap:6px;margin-top:8px;align-items:center;">' +
            '<button id="dev-mg-create" style="height:26px;padding:0 14px;background:#0A8043;color:#fff;border:1px solid #0A8043;cursor:pointer;font-size:12px;font-weight:bold;font-family:inherit;">➕ 新建题单</button>' +
            '<button id="dev-mg-delete" style="height:26px;padding:0 14px;background:#C00;color:#fff;border:1px solid #C00;cursor:pointer;font-size:12px;font-weight:bold;font-family:inherit;">🗑 批量删除</button>' +
            '<span id="dev-mg-sel-count" style="font-size:11px;color:#555;margin-left:4px;">已选 0 项</span>' +
            '</div>' +
            '</div>';

        var m = modal('管理团队', bodyHtml, [
            { t: '关闭', f: function (mm) { mm.remove(); } }
        ]);

        // ── 4. 内部状态 ──
        var curTab = 'train';   // 'train' | 'contest'
        var curGid = presetGid || '';
        var trainList = [];
        var contestList = [];
        var selectedTids = new Set();

        var gidSel = m.querySelector('#dev-mg-gid');
        var listWrap = m.querySelector('#dev-mg-list-wrap');
        var tabTrain = m.querySelector('#dev-mg-tab-train');
        var tabContest = m.querySelector('#dev-mg-tab-contest');
        var createBtn = m.querySelector('#dev-mg-create');
        var deleteBtn = m.querySelector('#dev-mg-delete');
        var selCount = m.querySelector('#dev-mg-sel-count');
        var refreshBtn = m.querySelector('#dev-mg-refresh');

        // ── 5. 渲染列表 ──
        function renderList() {
            selectedTids.clear();
            updateSelCount();

            var list = curTab === 'train' ? trainList : contestList;
            if (!list.length) {
                listWrap.innerHTML = '<div style="color:#888;text-align:center;padding:40px 0;font-size:12px;">' +
                    (curGid ? '暂无数据' : '请先选择团队') + '</div>';
                return;
            }

            var html = '<table style="width:100%;border-collapse:collapse;font-size:12px;">' +
                '<thead><tr style="background:#E8EEF8;">' +
                '<th style="width:28px;padding:4px 6px;border:1px solid #ACA899;text-align:center;">' +
                '<input type="checkbox" id="dev-mg-chk-all" title="全选">' +
                '</th>' +
                '<th style="padding:4px 8px;border:1px solid #ACA899;text-align:left;">ID</th>' +
                '<th style="padding:4px 8px;border:1px solid #ACA899;text-align:left;">标题</th>' +
                '<th style="padding:4px 8px;border:1px solid #ACA899;text-align:left;">权限</th>' +
                '</tr></thead><tbody>';

            for (var i = 0; i < list.length; i++) {
                var item = list[i];
                var itemId = item.rank != null ? String(item.rank) : item.id;
                var title = esc(item.title || item.name || ('项目#' + itemId));
                var auth = esc(item.auth || item.status || '');
                html += '<tr class="dev-mg-row" data-id="' + esc(itemId) + '" style="cursor:default;">' +
                    '<td style="padding:4px 6px;border:1px solid #E0E0E0;text-align:center;">' +
                    '<input type="checkbox" class="dev-mg-chk" data-id="' + esc(itemId) + '">' +
                    '</td>' +
                    '<td style="padding:4px 8px;border:1px solid #E0E0E0;color:#0058E1;font-family:Courier New;font-weight:bold;">' + esc(itemId) + '</td>' +
                    '<td style="padding:4px 8px;border:1px solid #E0E0E0;">' + title + '</td>' +
                    '<td style="padding:4px 8px;border:1px solid #E0E0E0;color:#555;">' + auth + '</td>' +
                    '</tr>';
            }
            html += '</tbody></table>';
            listWrap.innerHTML = html;

            // 全选
            var chkAll = listWrap.querySelector('#dev-mg-chk-all');
            chkAll.onchange = function () {
                listWrap.querySelectorAll('.dev-mg-chk').forEach(function (c) {
                    c.checked = chkAll.checked;
                    if (chkAll.checked) selectedTids.add(c.dataset.id);
                    else selectedTids.delete(c.dataset.id);
                });
                updateSelCount();
            };

            // 单选
            listWrap.querySelectorAll('.dev-mg-chk').forEach(function (c) {
                c.onchange = function () {
                    if (c.checked) selectedTids.add(c.dataset.id);
                    else selectedTids.delete(c.dataset.id);
                    updateSelCount();
                    var total = listWrap.querySelectorAll('.dev-mg-chk').length;
                    chkAll.checked = (selectedTids.size === total);
                };
            });

            // 行悬停
            listWrap.querySelectorAll('.dev-mg-row').forEach(function (row) {
                row.onmouseenter = function () { row.style.background = '#EEF4FF'; };
                row.onmouseleave = function () { row.style.background = ''; };
            });
        }

        function updateSelCount() {
            selCount.textContent = '已选 ' + selectedTids.size + ' 项';
        }

        // ── 6. 加载数据 ──
        async function loadData() {
            if (!curGid) { listWrap.innerHTML = '<div style="color:#888;text-align:center;padding:40px 0;font-size:12px;">请先选择团队</div>'; return; }
            listWrap.innerHTML = '<div style="color:#555;text-align:center;padding:40px 0;font-size:12px;">加载中...</div>';
            try {
                if (curTab === 'train') {
                    var r = await req('/api/oj/group/get-training-list?gid=' + encodeURIComponent(curGid) + '&limit=200&currentPage=1');
                    var d = r && r.data;
                    trainList = [];
                    if (Array.isArray(d)) trainList = d;
                    else if (d && Array.isArray(d.records)) trainList = d.records;
                    else if (d && d.trainingList && Array.isArray(d.trainingList.records)) trainList = d.trainingList.records;
                    else if (d && Array.isArray(d.trainingList)) trainList = d.trainingList;
                } else {
                    var rc = await req('/api/oj/group/get-contest-list?gid=' + encodeURIComponent(curGid) + '&limit=200&currentPage=1');
                    var dc = rc && rc.data;
                    contestList = [];
                    if (Array.isArray(dc)) contestList = dc;
                    else if (dc && Array.isArray(dc.records)) contestList = dc.records;
                    else if (dc && dc.contestList && Array.isArray(dc.contestList.records)) contestList = dc.contestList.records;
                    else if (dc && Array.isArray(dc.contestList)) contestList = dc.contestList;
                }
                renderList();
            } catch (e) {
                listWrap.innerHTML = '<div style="color:#C00;text-align:center;padding:40px 0;font-size:12px;">加载失败: ' + esc(e.message) + '</div>';
                out('加载失败: ' + e.message, 'err');
            }
        }

        // ── 7. Tab 切换 ──
        function switchTab(tab) {
            curTab = tab;
            if (tab === 'train') {
                tabTrain.style.background = '#fff';
                tabTrain.style.borderColor = '#ACA899';
                tabTrain.style.borderBottomColor = '#fff';
                tabContest.style.background = '#D4D0C8';
                tabContest.style.borderColor = 'transparent';
            } else {
                tabContest.style.background = '#fff';
                tabContest.style.borderColor = '#ACA899';
                tabContest.style.borderBottomColor = '#fff';
                tabTrain.style.background = '#D4D0C8';
                tabTrain.style.borderColor = 'transparent';
            }
            loadData();
        }

        tabTrain.onclick = function () { switchTab('train'); };
        tabContest.onclick = function () { switchTab('contest'); };

        // ── 8. 团队切换 ──
        gidSel.onchange = function () {
            curGid = gidSel.value;
            trainList = []; contestList = [];
            loadData();
        };

        // ── 9. 刷新 ──
        refreshBtn.onclick = function () { trainList = []; contestList = []; loadData(); };

        // ── 10. 新建题单 ──
        createBtn.onclick = function () {
            m.remove();
            doCreateTraining(curGid);
        };

        // ── 11. 批量删除 ──
        deleteBtn.onclick = async function () {
            if (!selectedTids.size) { alert('请先勾选要删除的题单'); return; }
            if (curTab !== 'train') { alert('目前仅支持删除训练题单'); return; }
            if (!confirm('确定要删除选中的 ' + selectedTids.size + ' 个题单吗？此操作不可恢复！')) return;

            var ids = Array.from(selectedTids);
            var ok = 0, fail = 0;
            listWrap.innerHTML = '<div style="color:#555;text-align:center;padding:40px 0;font-size:12px;">删除中，请稍候...</div>';

            for (var i = 0; i < ids.length; i++) {
                var tid = ids[i];
                try {
                    await req('/api/oj/group/training?tid=' + encodeURIComponent(tid), 'DELETE');
                    out('✓ 已删除题单 tid=' + tid, 'ok');
                    ok++;
                } catch (e) {
                    out('✗ 删除 tid=' + tid + ' 失败: ' + e.message, 'err');
                    fail++;
                }
            }

            out('批量删除完成：成功 ' + ok + ' 个，失败 ' + fail + ' 个', ok > 0 ? 'ok' : 'err');
            setStatus('删除完成');
            trainList = [];
            await loadData();
        };

        // ── 12. 初始加载 ──
        if (curGid) {
            loadData();
        }
    }


    /* ============== 新建团队训练题单 ============== */
    async function doCreateTraining(presetGid) {
        if (!token()) { alert('请先登录后再新建题单'); return; }

        var categories = [];
        var groups = [];
        var authorEmail = '';

        try {
            var results = await Promise.all([
                req('/api/oj/get-training-category'),
                req('/api/oj/get-group-list?onlyMine=true&limit=100&currentPage=1'),
                req('/api/oj/get-user-home-info')
            ]);

            var catD = results[0] && results[0].data;
            if (Array.isArray(catD)) categories = catD;
            else if (catD && Array.isArray(catD.records)) categories = catD.records;

            var grpD = results[1] && results[1].data;
            if (Array.isArray(grpD)) groups = grpD;
            else if (grpD && Array.isArray(grpD.records)) groups = grpD.records;
            else if (grpD && grpD.groupList && Array.isArray(grpD.groupList.records)) groups = grpD.groupList.records;
            else if (grpD && Array.isArray(grpD.groupList)) groups = grpD.groupList;

            authorEmail = (results[2] && results[2].data && results[2].data.username) || '';
        } catch (e) {
            out('初始化数据加载失败: ' + e.message, 'err');
        }

        // 构建分类下拉
        var catOptions = '<option value="">-- 请选择分类 --</option>';
        for (var i = 0; i < categories.length; i++) {
            var c = categories[i];
            catOptions += '<option value="' + esc(String(c.id || c.categoryId || '')) + '">'
                + esc(c.name || c.title || c.categoryName || ('分类#' + (c.id || i))) + '</option>';
        }
        if (!categories.length) catOptions = '<option value="">暂无分类数据</option>';

        // 构建团队下拉（预选 presetGid）
        var grpOptions = '<option value="">-- 请选择团队 --</option>';
        for (var j = 0; j < groups.length; j++) {
            var g = groups[j];
            var gid = String(g.id || g.gid || '');
            var selected = (presetGid && gid === String(presetGid)) ? ' selected' : '';
            grpOptions += '<option value="' + esc(gid) + '"' + selected + '>'
                + esc(g.name || g.title || ('团队#' + gid)) + '</option>';
        }
        if (!groups.length) grpOptions = '<option value="">暂无团队，请先加入或创建团队</option>';

        var bodyHtml =
            '<div style="padding:12px;font-size:12px;">' +
            '<div style="display:flex;flex-direction:column;gap:8px;">' +

            '<div style="display:flex;align-items:center;gap:6px;">' +
            '<span style="width:70px;text-align:right;flex-shrink:0;">题单标题</span>' +
            '<input id="dev-ct-title" type="text" placeholder="请输入题单标题" ' +
            'style="flex:1;height:26px;padding:0 6px;border:1px solid #7F9DB9;font-size:12px;box-sizing:border-box;">' +
            '</div>' +

            '<div style="display:flex;align-items:center;gap:6px;">' +
            '<span style="width:70px;text-align:right;flex-shrink:0;">排序 rank</span>' +
            '<input id="dev-ct-rank" type="number" min="0" value="0" ' +
            'style="flex:1;height:26px;padding:0 6px;border:1px solid #7F9DB9;font-size:12px;box-sizing:border-box;">' +
            '</div>' +

            '<div style="display:flex;align-items:center;gap:6px;">' +
            '<span style="width:70px;text-align:right;flex-shrink:0;">所属团队</span>' +
            '<select id="dev-ct-gid" style="flex:1;height:26px;border:1px solid #7F9DB9;font-size:12px;box-sizing:border-box;">' +
            grpOptions + '</select>' +
            '</div>' +

            '<div style="display:flex;align-items:center;gap:6px;">' +
            '<span style="width:70px;text-align:right;flex-shrink:0;">所属分类</span>' +
            '<select id="dev-ct-cat" style="flex:1;height:26px;border:1px solid #7F9DB9;font-size:12px;box-sizing:border-box;">' +
            catOptions + '</select>' +
            '</div>' +

            '<div style="display:flex;align-items:center;gap:6px;">' +
            '<span style="width:70px;text-align:right;flex-shrink:0;">权限</span>' +
            '<select id="dev-ct-auth" style="flex:1;height:26px;border:1px solid #7F9DB9;font-size:12px;box-sizing:border-box;">' +
            '<option value="Public">Public（公开）</option>' +
            '<option value="Private" selected>Private（密码访问）</option>' +
            '</select>' +
            '</div>' +

            '<div id="dev-ct-pwd-wrap" style="display:flex;align-items:center;gap:6px;">' +
            '<span style="width:70px;text-align:right;flex-shrink:0;">访问密码</span>' +
            '<input id="dev-ct-pwd" type="text" placeholder="Private 时必填" ' +
            'style="flex:1;height:26px;padding:0 6px;border:1px solid #7F9DB9;font-size:12px;box-sizing:border-box;">' +
            '</div>' +

            '<div style="display:flex;align-items:center;gap:6px;">' +
            '<span style="width:70px;text-align:right;flex-shrink:0;">作者邮箱</span>' +
            '<input id="dev-ct-author" type="text" readonly value="' + esc(authorEmail) + '" ' +
            'style="flex:1;height:26px;padding:0 6px;border:1px solid #ACA899;font-size:12px;' +
            'box-sizing:border-box;background:#F0F0F0;color:#555;cursor:not-allowed;">' +
            '</div>' +

            '<div style="display:flex;align-items:flex-start;gap:6px;">' +
            '<span style="width:70px;text-align:right;flex-shrink:0;padding-top:4px;">简介</span>' +
            '<textarea id="dev-ct-desc" rows="3" placeholder="（可选）题单简介" ' +
            'style="flex:1;padding:4px 6px;border:1px solid #7F9DB9;font-size:12px;' +
            'box-sizing:border-box;resize:vertical;font-family:inherit;"></textarea>' +
            '</div>' +

            '</div></div>';

        var m = modal('新建团队训练题单', bodyHtml, [
            {
                t: '创建', f: async function (mm) {
                    var titleVal = mm.querySelector('#dev-ct-title').value.trim();
                    var rankVal = parseInt(mm.querySelector('#dev-ct-rank').value, 10);
                    var gidVal = mm.querySelector('#dev-ct-gid').value.trim();
                    var catVal = mm.querySelector('#dev-ct-cat').value.trim();
                    var authVal = mm.querySelector('#dev-ct-auth').value;
                    var pwdVal = mm.querySelector('#dev-ct-pwd').value.trim();
                    var authorVal = mm.querySelector('#dev-ct-author').value.trim();
                    var descVal = mm.querySelector('#dev-ct-desc').value.trim();

                    if (isNaN(rankVal)) rankVal = 0;
                    if (!titleVal) { alert('请填写题单标题'); return; }
                    if (!gidVal) { alert('请选择所属团队'); return; }
                    if (!catVal) { alert('请选择所属分类'); return; }
                    if (!authorVal) { alert('未能获取当前账号邮箱，请重新登录后再试'); return; }
                    if (authVal === 'Private' && !pwdVal) { alert('Private 权限必须填写访问密码'); return; }

                    var payload = {
                        training: {
                            rank: rankVal,
                            title: titleVal,
                            description: descVal || '',
                            privatePwd: authVal === 'Private' ? pwdVal : '',
                            auth: authVal,
                            gid: parseInt(gidVal, 10),
                            author: authorVal
                        },
                        trainingCategory: { id: parseInt(catVal, 10) }
                    };

                    mm.remove();
                    setStatus('创建题单中...');
                    out('正在创建题单: ' + titleVal + '...', 'run');

                    try {
                        await req('/api/oj/group/training', 'POST', payload);
                        out('✓ 题单「' + titleVal + '」创建成功！', 'ok');
                        setStatus('创建成功');
                    } catch (e) {
                        out('✗ 创建失败: ' + e.message, 'err');
                        setStatus('创建失败');
                        alert('创建失败: ' + e.message);
                    }
                }
            },
            { t: '取消', f: function (mm) { mm.remove(); } }
        ]);

        var authSel = m.querySelector('#dev-ct-auth');
        var pwdWrap = m.querySelector('#dev-ct-pwd-wrap');
        authSel.onchange = function () {
            pwdWrap.style.display = authSel.value === 'Private' ? 'flex' : 'none';
        };
        pwdWrap.style.display = 'flex';
    }




    /* ============== 加载题单弹窗 ============== */
    async function doLoadProblemList() {
        closeMenu();
        if (!token()) { alert('请先登录后再加载题单'); return; }

        var m = modal('加载题单',
            '<div style="padding:12px;font-size:12px;">' +
            '<div style="margin-bottom:8px;">选择题单类型：</div>' +
            '<select id="dev-pl-type" style="width:100%;height:26px;border:1px solid #7F9DB9;font-size:12px;box-sizing:border-box;margin-bottom:8px;">' +
            '<option value="public-training">公共训练</option>' +
            '<option value="group-training">团队训练</option>' +
            '<option value="group-contest">团队比赛</option>' +
            '</select>' +
            // 公共训练：分类选择器（新增）
            '<div id="dev-pl-cat-wrap" style="">' +
            '<div style="margin-bottom:4px;">选择分类：</div>' +
            '<select id="dev-pl-cat" style="width:100%;height:26px;border:1px solid #7F9DB9;font-size:12px;box-sizing:border-box;margin-bottom:8px;">' +
            '<option value="">加载中...</option>' +
            '</select>' +
            '</div>' +
            // 团队选择器（团队训练/比赛用）
            '<div id="dev-pl-group-wrap" style="display:none;">' +
            '<div style="margin-bottom:4px;">选择团队：</div>' +
            '<select id="dev-pl-group" style="width:100%;height:26px;border:1px solid #7F9DB9;font-size:12px;box-sizing:border-box;margin-bottom:8px;">' +
            '<option value="">加载中...</option>' +
            '</select>' +
            '</div>' +
            // 训练/比赛选择器
            '<div id="dev-pl-item-wrap" style="">' +
            '<div style="margin-bottom:4px;" id="dev-pl-item-label">选择训练：</div>' +
            '<select id="dev-pl-item" style="width:100%;height:26px;border:1px solid #7F9DB9;font-size:12px;box-sizing:border-box;margin-bottom:8px;">' +
            '<option value="">请先选择分类</option>' +
            '</select>' +
            '</div>' +
            '</div>',
            [
                {
                    t: '🏢 管理团队', f: function (mm) {
                        var gid = mm.querySelector('#dev-pl-group') ? mm.querySelector('#dev-pl-group').value : '';
                        var grpSel = mm.querySelector('#dev-pl-group');
                        var grpName = grpSel && grpSel.options[grpSel.selectedIndex] ? grpSel.options[grpSel.selectedIndex].text : '';
                        mm.remove();
                        doManageGroup(gid, grpName);
                    }
                },

                {
                    t: '加载', f: function (mm) {
                        var type = mm.querySelector('#dev-pl-type').value;
                        var groupSel = mm.querySelector('#dev-pl-group');
                        var itemSel = mm.querySelector('#dev-pl-item');
                        var gid = groupSel.value;
                        var itemVal = itemSel.value;
                        if (type !== 'public-training' && !gid) { alert('请选择团队'); return; }
                        if (!itemVal) { alert('请选择题单'); return; }
                        mm.remove();
                        if (type === 'public-training') {
                            loadProblemListFromTraining(itemVal, '', false);
                        } else if (type === 'group-training') {
                            loadProblemListFromTraining(itemVal, gid, true);
                        } else {
                            loadProblemListFromContest(itemVal, gid);
                        }
                    }
                },
                { t: '取消', f: function (mm) { mm.remove(); } }
            ]
        );

        var typeSel = m.querySelector('#dev-pl-type');
        var catWrap = m.querySelector('#dev-pl-cat-wrap');
        var catSel = m.querySelector('#dev-pl-cat');
        var groupWrap = m.querySelector('#dev-pl-group-wrap');
        var itemWrap = m.querySelector('#dev-pl-item-wrap');
        var groupSel = m.querySelector('#dev-pl-group');
        var itemSel = m.querySelector('#dev-pl-item');
        var itemLabel = m.querySelector('#dev-pl-item-label');

        // 类型切换
        typeSel.onchange = function () {
            var t = typeSel.value;
            if (t === 'public-training') {
                catWrap.style.display = '';
                groupWrap.style.display = 'none';
                itemLabel.textContent = '选择训练：';
                itemSel.innerHTML = '<option value="">请先选择分类</option>';
            } else {
                catWrap.style.display = 'none';
                groupWrap.style.display = '';
                itemWrap.style.display = 'none';
                itemSel.innerHTML = '<option value="">请先选择团队</option>';
                itemLabel.textContent = (t === 'group-contest') ? '选择比赛：' : '选择训练：';
                loadGroupsInto(groupSel);
            }
        };

        // 分类切换后加载该分类下的训练
        catSel.onchange = function () {
            var cid = catSel.value;
            itemWrap.style.display = '';
            loadPublicTrainingsInto(itemSel, cid);
        };

        // 团队切换后加载训练/比赛
        groupSel.onchange = function () {
            var gid = groupSel.value;
            if (!gid) { itemSel.innerHTML = '<option value="">请先选择团队</option>'; itemWrap.style.display = 'none'; return; }
            itemWrap.style.display = '';
            var t = typeSel.value;
            if (t === 'group-contest') {
                loadGroupContestsInto(itemSel, gid);
            } else {
                loadGroupTrainingsInto(itemSel, gid);
            }
        };

        // 默认：加载公共训练分类
        loadPublicCategoriesInto(catSel);
    }


    // --- 加载团队列表 ---
    async function loadGroupsInto(selEl) {
        selEl.innerHTML = '<option value="">加载中...</option>';
        try {
            var r = await req('/api/oj/get-group-list?onlyMine=true&limit=100&currentPage=1');

            var d = r && r.data;
            var arr = [];
            if (Array.isArray(d)) arr = d;
            else if (d && Array.isArray(d.records)) arr = d.records;
            else if (d && d.groupList && Array.isArray(d.groupList.records)) arr = d.groupList.records;
            else if (d && Array.isArray(d.groupList)) arr = d.groupList;
            if (!arr.length) { selEl.innerHTML = '<option value="">暂无团队</option>'; return; }
            var html = '<option value="">-- 请选择团队 --</option>';
            for (var i = 0; i < arr.length; i++) {
                var g = arr[i];
                html += '<option value="' + esc(String(g.id ?? g.gid ?? '')) + '">' + esc(g.name || g.title || ('团队#' + (g.id || i))) + '</option>';
            }
            selEl.innerHTML = html;
        } catch (e) {
            selEl.innerHTML = '<option value="">加载失败</option>';
            out('加载团队列表失败: ' + e.message, 'err');
        }
    }
    // --- 加载公共训练分类 ---
    // --- 加载公共训练分类 ---
    async function loadPublicCategoriesInto(catSel, itemSelOverride) {
        catSel.innerHTML = '<option value="">加载中...</option>';
        try {
            var r = await req('/api/oj/get-training-category');
            var d = r && r.data;
            var arr = [];
            if (Array.isArray(d)) arr = d;
            else if (d && Array.isArray(d.records)) arr = d.records;

            // 关键修复点 1：定义当前要操作的 item 选择器（优先使用传入的 Override）
            var currentItemSel = itemSelOverride || document.querySelector('#dev-pl-item') || document.querySelector('#dev-loader-item');

            if (!arr.length) {
                // 分类接口无数据，直接降级加载全部
                catSel.innerHTML = '<option value="">全部</option>';
                if (currentItemSel) loadPublicTrainingsInto(currentItemSel, '');
                return;
            }
            
            var html = '<option value="">-- 请选择分类 --</option>'
                + '<option value="">全部</option>';
            for (var i = 0; i < arr.length; i++) {
                var c = arr[i];
                html += '<option value="' + esc(String(c.id || c.categoryId || '')) + '">'
                    + esc(c.name || c.title || c.categoryName || ('分类#' + (c.id || i))) + '</option>';
            }
            catSel.innerHTML = html;
        } catch (e) {
            // 分类加载失败，降级为直接加载全部训练
            catSel.innerHTML = '<option value="">全部（分类加载失败）</option>';
            
            // 关键修复点 2：错误处理时也要使用正确的选择器
            var currentItemSelErr = itemSelOverride || document.querySelector('#dev-pl-item') || document.querySelector('#dev-loader-item');
            if (currentItemSelErr) loadPublicTrainingsInto(currentItemSelErr, '');
            
            out('加载训练分类失败: ' + e.message, 'err');
        }
    }


    // --- 加载公共训练列表 ---
    // --- 加载公共训练列表（按分类） ---
    async function loadPublicTrainingsInto(selEl, categoryId) {
        selEl.innerHTML = '<option value="">加载中...</option>';
        try {
            var url = '/api/oj/get-training-list?limit=200&currentPage=1';
            if (categoryId) url += '&categoryId=' + encodeURIComponent(categoryId);
            var r = await req(url);
            var d = r && r.data;
            var arr = [];
            if (Array.isArray(d)) arr = d;
            else if (d && Array.isArray(d.records)) arr = d.records;
            else if (d && d.trainingList && Array.isArray(d.trainingList.records)) arr = d.trainingList.records;
            else if (d && Array.isArray(d.trainingList)) arr = d.trainingList;
            if (!arr.length) { selEl.innerHTML = '<option value="">该分类暂无训练</option>'; return; }
            var html = '<option value="">-- 请选择训练 --</option>';
            for (var i = 0; i < arr.length; i++) {
                var t = arr[i];
                html += '<option value="' + esc(String(t.id ?? t.tid ?? '')) + '">'
                    + esc(t.title || t.name || ('训练#' + (t.id || i))) + '</option>';
            }
            selEl.innerHTML = html;
        } catch (e) {
            selEl.innerHTML = '<option value="">加载失败</option>';
            out('加载公共训练列表失败: ' + e.message, 'err');
        }
    }


    // --- 加载团队训练列表 ---
    async function loadGroupTrainingsInto(selEl, gid) {
        selEl.innerHTML = '<option value="">加载中...</option>';
        try {
            var r = await req('/api/oj/group/get-training-list?gid=' + encodeURIComponent(gid) + '&limit=200&currentPage=1');
            var d = r && r.data;
            var arr = [];
            if (Array.isArray(d)) arr = d;
            else if (d && Array.isArray(d.records)) arr = d.records;
            else if (d && d.trainingList && Array.isArray(d.trainingList.records)) arr = d.trainingList.records;
            else if (d && Array.isArray(d.trainingList)) arr = d.trainingList;
            if (!arr.length) { selEl.innerHTML = '<option value="">该团队暂无训练</option>'; return; }
            var html = '<option value="">-- 请选择训练 --</option>';
            for (var i = 0; i < arr.length; i++) {
                var t = arr[i];
                html += '<option value="' + esc(String(t.id ?? t.tid ?? '')) + '">' + esc(t.title || t.name || ('训练#' + (t.id || i))) + '</option>';
            }
            selEl.innerHTML = html;
        } catch (e) {
            selEl.innerHTML = '<option value="">加载失败</option>';
            out('加载团队训练列表失败: ' + e.message, 'err');
        }
    }

    // --- 加载团队比赛列表 ---
    async function loadGroupContestsInto(selEl, gid) {
        selEl.innerHTML = '<option value="">加载中...</option>';
        try {
            var r = await req('/api/oj/group/get-contest-list?gid=' + encodeURIComponent(gid) + '&limit=200&currentPage=1');
            var d = r && r.data;
            var arr = [];
            if (Array.isArray(d)) arr = d;
            else if (d && Array.isArray(d.records)) arr = d.records;
            else if (d && d.contestList && Array.isArray(d.contestList.records)) arr = d.contestList.records;
            else if (d && Array.isArray(d.contestList)) arr = d.contestList;
            if (!arr.length) { selEl.innerHTML = '<option value="">该团队暂无比赛</option>'; return; }
            var html = '<option value="">-- 请选择比赛 --</option>';
            for (var i = 0; i < arr.length; i++) {
                var c = arr[i];
                html += '<option value="' + esc(String(c.id ?? c.cid ?? '')) + '">' + esc(c.title || c.name || ('比赛#' + (c.id || i))) + '</option>';
            }
            selEl.innerHTML = html;
        } catch (e) {
            selEl.innerHTML = '<option value="">加载失败</option>';
            out('加载团队比赛列表失败: ' + e.message, 'err');
        }
    }

    const MENUS = {
        file: [
            { l: '新建', sc: 'Ctrl+N', fn: doNew },
            { l: '打开...', sc: 'Ctrl+O', fn: doOpen },
            { l: '保存', sc: 'Ctrl+S', fn: doSave },
            { l: '另存为...', sc: '', fn: doSave },
            { sep: 1 },
            { l: '退出', sc: 'Alt+F4', fn: doClose }
        ],
        edit: [
            // { l: '撤销', sc: 'Ctrl+Z', fn: () => document.execCommand('undo') },
            // { l: '重做', sc: 'Ctrl+Y', fn: () => document.execCommand('redo') },
            // { sep: 1 },
            // { l: '剪切', sc: 'Ctrl+X', fn: () => document.execCommand('cut') },
            // { l: '复制', sc: 'Ctrl+C', fn: () => document.execCommand('copy') },
            // { l: '粘贴', sc: 'Ctrl+V', fn: () => document.execCommand('paste') },
            // { sep: 1 },
            // { l: '全选', sc: 'Ctrl+A', fn: () => codeEl.select() },
            { l: '查找替换...', sc: 'Ctrl+F', fn: doFind }
        ],
        run: [
            { l: '编译', sc: 'F9', fn: doCompile },
            { l: '运行 (自测)', sc: 'F10', fn: doRun },
            { l: '使用样例 1 自测', sc: '', fn: () => runWithSample(0) },
            { sep: 1 },
            { l: '提交评测', sc: 'F11', fn: doSubmit }
        ],
        view: [
            { l: '编辑器选项...', sc: '', fn: showEditorSettings }
        ],
        help: [
            { l: '快捷键', fn: showHelp },
            { l: '关于 DevC++ XDFOJ', fn: showAbout }
        ]
    };
    let curMenu = null;
    let menuCloseTimer = null;

    function removeMenuOutsideListener() {
        try {
            document.removeEventListener('mousedown', closeMenuOutside, true);
            document.removeEventListener('mousedown', closeMenuOutside, false);
        } catch (e) { }

        if (menuCloseTimer) {
            clearTimeout(menuCloseTimer);
            menuCloseTimer = null;
        }
    }

    function closeMenu() {
        hideAutocomplete();
        removeMenuOutsideListener();

        if (!curMenu) {
            // 兜底：即使状态已经空了，也清掉页面上残留的菜单 DOM 和高亮
            try {
                document.querySelectorAll('.dev-menu-pop').forEach(function (p) { p.remove(); });
                $$('.mi', $('#dev-menubar')).forEach(function (mi) { mi.classList.remove('on'); });
            } catch (e) { }
            return;
        }

        try { curMenu.pop.remove(); } catch (e) { }
        try { curMenu.anchor.classList.remove('on'); } catch (e) { }

        curMenu = null;

        // 再兜底清一次，防止残留多个菜单层
        try {
            document.querySelectorAll('.dev-menu-pop').forEach(function (p) { p.remove(); });
            $$('.mi', $('#dev-menubar')).forEach(function (mi) { mi.classList.remove('on'); });
        } catch (e) { }
    }

    function openMenu(name, anchor) {
        // 每次打开前，先彻底清理旧状态
        hideAutocomplete();
        closeMenu();
        removeMenuOutsideListener();

        var items = MENUS[name];
        if (!items) return;

        var popM = document.createElement('div');
        popM.className = 'dev-menu-pop';

        var html = '';
        for (var i = 0; i < items.length; i++) {
            var it = items[i];
            if (it.sep) {
                html += '<div class="sep"></div>';
                continue;
            }
            html += '<div class="it" data-i="' + i + '">'
                + '<span>' + esc(it.l) + '</span>'
                + '<span class="sc">' + esc(it.sc || '') + '</span>'
                + '</div>';
        }
        popM.innerHTML = html;

        var rct = anchor.getBoundingClientRect();
        popM.style.position = 'fixed';
        popM.style.left = Math.max(0, rct.left) + 'px';
        popM.style.top = Math.max(0, rct.bottom) + 'px';
        document.body.appendChild(popM);
        popM.addEventListener('wheel', function (ev) {
            ev.stopPropagation();
        }, { passive: true });

        // 防止右侧超出屏幕
        setTimeout(function () {
            try {
                var pr = popM.getBoundingClientRect();
                if (pr.right > window.innerWidth) {
                    popM.style.left = Math.max(0, window.innerWidth - pr.width - 4) + 'px';
                }
                if (pr.bottom > window.innerHeight) {
                    popM.style.top = Math.max(0, window.innerHeight - pr.height - 4) + 'px';
                }
            } catch (e) { }
        }, 0);


        $$('.it', popM).forEach(function (el) {
            el.addEventListener('mousedown', function (ev) {
                ev.stopPropagation();
                ev.preventDefault();

                var it = items[+el.dataset.i];

                closeMenu();

                if (it && it.fn) {
                    setTimeout(function () {
                        try { it.fn(); } catch (e) {
                            console.error('菜单执行失败:', e);
                            try { out('菜单执行失败: ' + e.message, 'err'); } catch (e2) { }
                        }
                    }, 0);
                }
            });
        });

        curMenu = {
            pop: popM,
            name: name,
            anchor: anchor
        };

        anchor.classList.add('on');

        // 延迟挂外部点击监听，但要保证只挂一个
        menuCloseTimer = setTimeout(function () {
            menuCloseTimer = null;
            document.removeEventListener('mousedown', closeMenuOutside, true);
            document.addEventListener('mousedown', closeMenuOutside, true);
        }, 0);
    }

    function closeMenuOutside(e) {
        // 如果菜单状态已经没了，主动清理监听器
        if (!curMenu) {
            removeMenuOutsideListener();
            try {
                document.querySelectorAll('.dev-menu-pop').forEach(function (p) { p.remove(); });
                $$('.mi', $('#dev-menubar')).forEach(function (mi) { mi.classList.remove('on'); });
            } catch (e2) { }
            return;
        }

        var target = e.target;

        // 点在菜单内部，不关闭
        if (curMenu.pop && curMenu.pop.contains(target)) return;

        // 点在顶部菜单栏，不让 document 监听器处理，由菜单栏自己的 mousedown 处理
        if (target && target.closest && target.closest('#dev-menubar')) return;

        closeMenu();
    }

    var menubar = $('#dev-menubar');
    if (menubar) {
        menubar.addEventListener('mousedown', function (e) {
            var mi = e.target && e.target.closest ? e.target.closest('.mi') : null;
            if (!mi || !menubar.contains(mi)) return;

            e.stopPropagation();
            e.preventDefault();

            var name = mi.dataset.m;
            if (!name) return;

            if (curMenu && curMenu.name === name) {
                closeMenu();
            } else {
                openMenu(name, mi);
            }
        });

        menubar.addEventListener('mouseover', function (e) {
            var mi = e.target && e.target.closest ? e.target.closest('.mi') : null;
            if (!mi || !menubar.contains(mi)) return;

            var name = mi.dataset.m;
            if (!name) return;

            if (curMenu && curMenu.name !== name) {
                openMenu(name, mi);
            }
        });
    }
    function showEditorSettings() {
        closeMenu();

        var origCodeFont = cfg.codeFont;
        var origProbFont = cfg.probFont;
        var origFontFamily = cfg.fontFamily;
        var origProbFontFamily = cfg.probFontFamily;

        var FONTS_EDITOR = ['Courier New', 'Consolas', 'JetBrains Mono', 'monospace'];
        var FONTS_PROB = ['Times New Roman', 'SimSun', 'SimHei', 'KaiTi', 'FangSong', 'Microsoft YaHei', 'serif', 'sans-serif'];

        function rangeList(min, max) {
            var arr = [];
            for (var i = min; i <= max; i++) arr.push(String(i));
            return arr;
        }

        function comboHtml(id, options, currentVal) {
            var h = '<div class="dev-combo" id="' + id + '" style="position:relative;flex:1;min-width:0;">'
                + '<input type="text" value="' + esc(currentVal) + '" class="dev-combo-ipt" style="width:100%;height:24px;border:1px solid #7F9DB9;font-size:12px;padding:0 20px 0 4px;box-sizing:border-box;">'
                + '<span class="dev-combo-arrow" style="position:absolute;right:1px;top:1px;width:18px;height:22px;background:#ECE9D8;border-left:1px solid #ACA899;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:10px;user-select:none;">▼</span>'
                + '<div class="dev-combo-list" style="display:none;position:absolute;top:25px;left:0;right:0;background:#fff;border:1px solid #7F9DB9;max-height:180px;overflow-y:auto;z-index:100;">';
            for (var i = 0; i < options.length; i++) {
                var isCur = options[i] === String(currentVal);
                h += '<div data-v="' + esc(options[i]) + '" style="padding:3px 6px;cursor:pointer;font-size:12px;white-space:nowrap;'
                    + (isCur ? 'background:#316AC5;color:#fff;' : '')
                    + '" class="dev-combo-opt' + (isCur ? ' dev-combo-cur' : '') + '">'
                    + esc(options[i]) + '</div>';
            }
            h += '</div></div>';
            return h;
        }

        var eSizes = rangeList(1, 30);
        var pSizes = rangeList(1, 30);

        var sizeComboStyle = 'width:52px;';

        var bodyHtml = '<div style="padding:12px 14px;font-size:12px;line-height:1.6;">'
            + '<div style="display:flex;align-items:center;gap:6px;margin-bottom:10px;">'
            + '<span style="width:72px;text-align:right;flex-shrink:0;">编辑器字体:</span>'
            + comboHtml('dev-cb-efont', FONTS_EDITOR, cfg.fontFamily)
            + '<span style="flex-shrink:0;">大小:</span>'
            + '<div style="' + sizeComboStyle + '">' + comboHtml('dev-cb-efs', eSizes, cfg.codeFont) + '</div>'
            + '</div>'
            + '<div style="display:flex;align-items:center;gap:6px;margin-bottom:10px;">'
            + '<span style="width:72px;text-align:right;flex-shrink:0;">题目字体:</span>'
            + comboHtml('dev-cb-pfont', FONTS_PROB, cfg.probFontFamily)
            + '<span style="flex-shrink:0;">大小:</span>'
            + '<div style="' + sizeComboStyle + '">' + comboHtml('dev-cb-pfs', pSizes, cfg.probFont) + '</div>'
            + '</div>'
            + '</div>';

        var m = modal('编辑器选项', bodyHtml, [
            {
                t: '确定', f: function (mm) {
                    cfg.fontFamily = getComboVal('dev-cb-efont') || 'Courier New';
                    cfg.probFontFamily = getComboVal('dev-cb-pfont') || 'Times New Roman';
                    cfg.codeFont = Math.max(1, Math.min(30, parseInt(getComboVal('dev-cb-efs')) || 14));
                    cfg.probFont = Math.max(1, Math.min(30, parseInt(getComboVal('dev-cb-pfs')) || 14));
                    LS.set('codeFont', cfg.codeFont);
                    LS.set('probFont', cfg.probFont);
                    LS.set('fontFamily', cfg.fontFamily);
                    LS.set('probFontFamily', cfg.probFontFamily);
                    applyCfg(); refreshGutter();
                    mm.remove();
                }
            },
            {
                t: '恢复默认', f: function () {
                    setComboVal('dev-cb-efont', 'Courier New');
                    setComboVal('dev-cb-pfont', 'Times New Roman');
                    setComboVal('dev-cb-efs', '14');
                    setComboVal('dev-cb-pfs', '14');
                    cfg.codeFont = 14; cfg.probFont = 14;
                    cfg.fontFamily = 'Courier New'; cfg.probFontFamily = 'Times New Roman';
                    applyCfg(); refreshGutter();
                }
            }
        ]);

        // 禁用点击外部关闭
        m.onclick = null;

        // 标题栏右上角 × 关闭按钮
        var hd = m.querySelector('.dev-modal-hd');
        if (hd) {
            hd.style.position = 'relative';
            var closeBtn = document.createElement('span');
            closeBtn.textContent = '×';
            closeBtn.style.cssText = 'position:absolute;right:0;top:0;width:24px;height:24px;display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:16px;font-weight:bold;color:#fff;';
            closeBtn.onmouseenter = function () { closeBtn.style.background = '#C00'; closeBtn.style.color = '#fff'; };
            closeBtn.onmouseleave = function () { closeBtn.style.background = ''; closeBtn.style.color = '#fff'; };
            closeBtn.onclick = function () {
                cfg.codeFont = origCodeFont;
                cfg.probFont = origProbFont;
                cfg.fontFamily = origFontFamily;
                cfg.probFontFamily = origProbFontFamily;
                applyCfg(); refreshGutter();
                m.remove();
            };
            hd.appendChild(closeBtn);
        }

        function getComboVal(id) {
            var el = document.getElementById(id);
            return el ? (el.querySelector('.dev-combo-ipt').value.trim()) : '';
        }
        function setComboVal(id, val) {
            var el = document.getElementById(id);
            if (el) el.querySelector('.dev-combo-ipt').value = val;
        }

        setTimeout(function () {
            m.querySelectorAll('.dev-combo').forEach(function (combo) {
                var ipt = combo.querySelector('.dev-combo-ipt');
                var arrow = combo.querySelector('.dev-combo-arrow');
                var list = combo.querySelector('.dev-combo-list');

                function openList() {
                    m.querySelectorAll('.dev-combo-list').forEach(function (l) { l.style.display = 'none'; });
                    list.style.display = '';
                    var cur = list.querySelector('.dev-combo-cur');
                    if (cur) cur.scrollIntoView({ block: 'center' });
                }

                function toggle() {
                    var isOpen = list.style.display !== 'none';
                    m.querySelectorAll('.dev-combo-list').forEach(function (l) { l.style.display = 'none'; });
                    if (!isOpen) openList();
                }

                arrow.onclick = function (e) { e.stopPropagation(); toggle(); };
                ipt.onfocus = function () { openList(); };

                list.querySelectorAll('.dev-combo-opt').forEach(function (opt) {
                    opt.onmousedown = function (e) {
                        e.preventDefault();
                        e.stopPropagation();
                        ipt.value = opt.dataset.v;
                        list.style.display = 'none';
                        ipt.dispatchEvent(new Event('input', { bubbles: true }));
                    };
                    opt.onmouseenter = function () {
                        list.querySelectorAll('.dev-combo-opt').forEach(function (o) { o.style.background = ''; o.style.color = ''; });
                        opt.style.background = '#316AC5'; opt.style.color = '#fff';
                    };
                });

                ipt.oninput = function () {
                    var id = combo.id;
                    if (id === 'dev-cb-efont') { cfg.fontFamily = ipt.value.trim() || 'Courier New'; applyCfg(); }
                    else if (id === 'dev-cb-pfont') { cfg.probFontFamily = ipt.value.trim() || 'Times New Roman'; applyCfg(); }
                    else if (id === 'dev-cb-efs') { cfg.codeFont = Math.max(1, Math.min(30, parseInt(ipt.value) || 1)); applyCfg(); refreshGutter(); }
                    else if (id === 'dev-cb-pfs') { cfg.probFont = Math.max(1, Math.min(30, parseInt(ipt.value) || 1)); applyCfg(); }
                };
            });

            m.addEventListener('click', function (e) {
                if (!e.target.closest('.dev-combo')) {
                    m.querySelectorAll('.dev-combo-list').forEach(function (l) { l.style.display = 'none'; });
                }
            });
        }, 0);
    }

    function showHelp() {
        closeMenu();
        modal('快捷键帮助', `
            <div style="padding:12px;font-size:12px;line-height:1.8;">
                <b>文件</b><br>
                Ctrl+N 新建 ｜ Ctrl+O 打开 ｜ Ctrl+S 保存<br><br>
                <b>编辑</b><br>
                Ctrl+Z 撤销 ｜ Ctrl+Y 重做 ｜ Ctrl+F 查找替换 ｜ Ctrl+A 全选<br><br>
                <b>运行</b><br>
                F9 编译 ｜ F10 运行 (自测) ｜ F11 提交评测<br><br>
                <b>编辑器</b><br>
                Tab 缩进 4 空格 ｜ 输入 2+ 字母触发自动补全 ｜ 上下方向键选择 ｜ Enter/Tab 确认 ｜ Esc 取消
            </div>`, [{ t: '关闭', f: m => m.remove() }]);
    }
    function showAbout() {
        closeMenu();
        modal('关于', `
            <div style="padding:16px;text-align:center;font-size:13px;line-height:1.7;">
                <div style="font-size:18px;font-weight:900;color:#0058E1;margin-bottom:8px;">DevC++ XDFOJ</div>
                <div>仿 Dev-C++ Classic 风格的 XDFOJ 在线学习工具</div>
                <div style="color:#666;margin-top:8px;">支持 C++ / C / Python <br>支持 LaTeX 题面渲染、语法高亮、自动补全</div>
                <div style="color:#888;margin-top:10px;font-size:11px;">Token 状态: </div>
            </div>`, [{ t: '确定', f: m => m.remove() }]);
    }
    function doFind() {
        closeMenu();
        modal('查找替换', `
            <div style="padding:12px;">
                <div style="margin-bottom:6px;">查找:</div>
                <input id="dev-find-q" style="width:100%;height:26px;padding:0 6px;border:1px solid #7F9DB9;box-sizing:border-box;">
                <div style="margin:8px 0 6px;">替换为:</div>
                <input id="dev-find-r" style="width:100%;height:26px;padding:0 6px;border:1px solid #7F9DB9;box-sizing:border-box;">
            </div>`, [
            {
                t: '查找下一个', f: m => {
                    const q = m.querySelector('#dev-find-q').value; if (!q) return;
                    const idx = codeEl.value.indexOf(q, codeEl.selectionEnd);
                    if (idx < 0) { alert('未找到'); return; }
                    codeEl.focus(); codeEl.selectionStart = idx; codeEl.selectionEnd = idx + q.length;
                }
            },
            {
                t: '全部替换', f: m => {
                    const q = m.querySelector('#dev-find-q').value, r = m.querySelector('#dev-find-r').value;
                    if (!q) return;
                    const n = codeEl.value.split(q).length - 1;
                    codeEl.value = codeEl.value.split(q).join(r);
                    const f = cur(); if (f) f.code = codeEl.value;
                    refreshHighlight(); refreshGutter();
                    alert('已替换 ' + n + ' 处');
                }
            },
            { t: '关闭', f: m => m.remove() }
        ]);
    }
    function modal(title, bodyHtml, btns) {
        closeMenu();
        var m = document.createElement('div');
        m.className = 'dev-modal';
        var btnHtml = '';
        for (var i = 0; i < btns.length; i++) {
            btnHtml += '<button>' + esc(btns[i].t) + '</button>';
        }
        m.innerHTML =
            '<div class="dev-modal-bd">' +
            '<div class="dev-modal-hd">' + esc(title) + '</div>' +
            '<div>' + bodyHtml + '</div>' +
            '<div class="dev-modal-ft">' + btnHtml + '</div>' +
            '</div>';
        document.body.appendChild(m);
        var btnEls = m.querySelectorAll('.dev-modal-ft button');
        btnEls.forEach(function (b, i) {
            b.onclick = function () { btns[i].f(m); };
        });
        m.onclick = function (e) { if (e.target === m) m.remove(); };
        return m;
    }

    /* ============== 工具栏按钮绑定 ============== */

    function doClose() {
        if (confirm('退出 DevC++ XDFOJ?')) {
            try { pageScrollLock.restore(); } catch (e) { }
            root.remove();
            styleEl.remove();
            window.__DevHOJ = 0;
        }
    }


    function getLoginName() {
        try {
            var vuex = localStorage.getItem('vuex');
            if (vuex) {
                var j = JSON.parse(vuex);
                var u = j && j.user ? j.user : null;
                if (u) {
                    return u.nickname || u.username || u.realname || u.name || '';
                }
            }
        } catch (e) { }
        try {
            var userInfo = localStorage.getItem('userInfo') || localStorage.getItem('user') || localStorage.getItem('profile');
            if (userInfo) {
                var j2 = JSON.parse(userInfo);
                return j2.nickname || j2.username || j2.realname || j2.name || '';
            }
        } catch (e) { }
        return '';
    }

    function updateLoginBtn() {
        var btn = $('#dev-login-btn');
        if (!btn) return;
        if (token()) {
            var name = getLoginName();
            btn.textContent = '👤 ' + (name || '已登录');
            btn.title = '点击退出登录';
            btn.style.background = '#0A8043';
            btn.style.borderColor = '#0A8043';
        } else {
            btn.textContent = '👤 登录';
            btn.title = '点击登录';
            btn.style.background = '#D97706';
            btn.style.borderColor = '#D97706';
        }
    }

    function fireClick(el) {
        if (!el) return false;
        try {
            ['pointerdown', 'mousedown', 'mouseup', 'click'].forEach(function (type) {
                el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window }));
            });
        } catch (e) { }
        try { el.click(); } catch (e) { }
        return true;
    }
    var __websiteLoginActive = false;

    function enterWebsiteLoginMode() {
        __websiteLoginActive = true;
    }

    function restoreWebsiteLoginMode() {
        __websiteLoginActive = false;
        // 恢复脚本 UI（兜底，确保不被前面的代码污染）
        try {
            root.style.zIndex = '';
            root.style.opacity = '';
            root.style.pointerEvents = '';
            root.style.display = '';
            root.style.visibility = '';
        } catch (e) { }
    }



    function raiseWebsiteLoginDialog() {
        try {
            // 检测网站是否正在显示登录或选择学员弹窗
            if (hasWebsiteLoginOrChooseDialog()) {
                // 脚本 UI 临时下沉到最底层，让网站弹窗自然显示在最上面
                root.style.zIndex = '2000';
            } else {
                // 网站没弹窗时，脚本 UI 恢复正常层级
                root.style.zIndex = '';
            }
        } catch (e) { }
    }



    function openWebsiteLoginPopup() {
        function findLoginBtn() {
            var all = document.querySelectorAll('a, button, span, div, li');
            var best = null;
            for (var i = 0; i < all.length; i++) {
                var el = all[i];
                if (el.closest('.dev-root') || el.closest('.dev-modal')) continue;
                var text = (el.innerText || el.textContent || '').replace(/\s/g, '');
                if (text !== '登录') continue;
                var r = el.getBoundingClientRect();
                if (r.top > 80) continue;
                if (r.left < window.innerWidth * 0.5) continue;
                if (r.width > 120 || r.height > 60) continue;
                if (!best || (r.width * r.height) < (best.r.width * best.r.height)) {
                    best = { el: el, r: r };
                }
            }
            return best ? best.el : null;
        }
        var btn = findLoginBtn();
        if (btn) { btn.click(); return true; }
        var fallbackX = window.innerWidth - 80, fallbackY = 40;
        var el = document.elementFromPoint(fallbackX, fallbackY);
        if (el && !el.closest('.dev-root')) { el.click(); }
        return false;
    }


    function hasWebsiteLoginOrChooseDialog() {
        try {
            var selectors = ['.el-dialog__wrapper', '.el-dialog', '.el-overlay', '.ant-modal-root', '.ant-modal-wrap', '.ant-modal', '.ant-modal-content', '.van-popup', '.modal', '[role="dialog"]', '[class*="login"]', '[class*="Login"]', '[class*="dialog"]', '[class*="Dialog"]', '[class*="popup"]', '[class*="Popup"]'];
            for (var i = 0; i < selectors.length; i++) {
                var list = document.querySelectorAll(selectors[i]);
                for (var j = 0; j < list.length; j++) {
                    var el = list[j];
                    if (!el) continue;
                    if (el.closest('.dev-root') || el.closest('.dev-modal')) continue;
                    var style = getComputedStyle(el);
                    if (style.display === 'none' || style.visibility === 'hidden' || parseFloat(style.opacity || '1') === 0) continue;
                    var rect = el.getBoundingClientRect();
                    if (rect.width < 20 || rect.height < 20) continue;
                    var txt = String(el.innerText || el.textContent || '');
                    if (/登录|账号|密码|验证码|手机|短信|获取验证码|选择用户|选择学员|选择学生|选择孩子|学员|学生|孩子|身份|进入学习|确认进入|切换学员|请选择|确认/.test(txt)) return true;
                    if (el.querySelector && el.querySelector('input, button, textarea, select')) return true;
                }
            }
        } catch (e) { }
        return false;
    }

    async function clearHojLoginStateDeep() {
        var keys = ['token', 'sharding-oj-token', 'admin-token', 'vuex', 'userInfo', 'user', 'profile', 'UserInfo', 'USER_INFO', 'accessToken', 'refreshToken', 'Authorization', 'authorization', 'loginUser', 'currentUser', 'account', 'member', 'teacher', 'student'];
        keys.forEach(function (k) {
            try { localStorage.removeItem(k); } catch (e) { }
            try { sessionStorage.removeItem(k); } catch (e) { }
        });
        function wipeStorageLikeLogin(storage) {
            try {
                var removeKeys = [];
                for (var i = 0; i < storage.length; i++) {
                    var k = storage.key(i); if (!k) continue;
                    var lk = String(k).toLowerCase();
                    if (lk.indexOf('token') !== -1 || lk.indexOf('auth') !== -1 || lk.indexOf('login') !== -1 || lk.indexOf('user') !== -1 || lk.indexOf('profile') !== -1 || lk.indexOf('account') !== -1 || lk.indexOf('student') !== -1 || lk.indexOf('teacher') !== -1 || lk.indexOf('vuex') !== -1 || lk.indexOf('oj') !== -1 || lk.indexOf('hoj') !== -1) removeKeys.push(k);
                }
                removeKeys.forEach(function (k) { try { storage.removeItem(k); } catch (e) { } });
            } catch (e) { }
        }
        wipeStorageLikeLogin(localStorage);
        wipeStorageLikeLogin(sessionStorage);
        function deleteCookie(name, domain, path) {
            try { document.cookie = name + '=; expires=Thu, 01 Jan 1970 00:00:00 GMT; max-age=0; path=' + path + (domain ? '; domain=' + domain : ''); } catch (e) { }
        }
        try {
            var cookieNames = document.cookie.split(';').map(function (c) { return c.split('=')[0].trim(); }).filter(Boolean);
            var host = location.hostname, parts = host.split('.');
            var domains = ['', host];
            if (parts.length >= 2) domains.push('.' + parts.slice(-2).join('.'));
            if (parts.length >= 3) domains.push('.' + parts.slice(-3).join('.'));
            var paths = ['/', '/oj', '/api', location.pathname || '/'];
            cookieNames.forEach(function (name) { domains.forEach(function (domain) { paths.forEach(function (path) { deleteCookie(name, domain, path); }); }); });
        } catch (e) { }
        try { if (window.caches && caches.keys) { var cacheNames = await caches.keys(); await Promise.all(cacheNames.map(function (name) { return caches.delete(name); })); } } catch (e) { }
        try { if (navigator.serviceWorker && navigator.serviceWorker.getRegistrations) { var regs = await navigator.serviceWorker.getRegistrations(); await Promise.all(regs.map(function (reg) { return reg.unregister(); })); } } catch (e) { }
        try { if (indexedDB && indexedDB.databases) { var dbs = await indexedDB.databases(); await Promise.all((dbs || []).map(function (db) { if (!db || !db.name) return Promise.resolve(); return new Promise(function (resolve) { var req = indexedDB.deleteDatabase(db.name); req.onsuccess = resolve; req.onerror = resolve; req.onblocked = resolve; }); })); } } catch (e) { }
    }

    async function doServerLogout() {
        var tk = token(); var lastErr = '';
        async function tryOne(method, withBody) {
            var headers = { 'Content-Type': 'application/json;charset=UTF-8', 'Accept': 'application/json, text/plain, */*', 'X-Requested-With': 'XMLHttpRequest' };
            if (tk) { headers.token = tk; headers.Authorization = tk; headers['sharding-oj-token'] = tk; }
            var opt = { method: method, headers: headers, credentials: 'include', cache: 'no-store' };
            if (withBody) opt.body = JSON.stringify({ token: tk });
            var r = await fetch('/api/oj/logout?_t=' + Date.now(), opt);
            var text = ''; try { text = await r.text(); } catch (e) { }
            var j = null; try { j = text ? JSON.parse(text) : null; } catch (e) { }
            if (j && (j.status === 200 || j.code === 200)) return j;
            if (r.ok && (!j || j.status === 200 || j.code === 200)) return j || { status: 200 };
            throw new Error((j && (j.msg || j.message)) || text || ('HTTP ' + r.status));
        }
        var tries = [['POST', false], ['POST', true], ['DELETE', false], ['PUT', false]];
        for (var i = 0; i < tries.length; i++) {
            var method = tries[i][0], withBody = tries[i][1];
            try { var ret = await tryOne(method, withBody); return true; }
            catch (e) { lastErr = method + (withBody ? ' with body' : '') + ' => ' + e.message; }
        }
        out('服务端退出接口未确认成功：' + lastErr, 'err'); return false;
    }

    async function doFullLogout() {
        //out('正在请求服务端退出登录...', 'run'); //setStatus('正在退出登录...');
        var serverOk = false;
        try { serverOk = await doServerLogout(); } catch (e) { out('服务端退出异常：' + e.message, 'err'); }
        out('正在清理本地登录缓存...', 'run');
        try { await clearHojLoginStateDeep(); } catch (e) { out('清理本地缓存异常：' + e.message, 'err'); }
        updateLoginBtn();
        if (serverOk) { out('已完成服务端退出和本地缓存清理。', 'ok'); setStatus('已退出登录'); }
        else { out('已清理本地缓存，但服务端退出未确认成功。如果刷新后仍自动登录，说明存在 HttpOnly Cookie，需要按官网实际 logout 请求修正接口调用方式。', 'err'); setStatus('本地已退出'); }
    }

    async function doHojLogout() {
        var tk = token();
        try {
            var headers = { 'Content-Type': 'application/json' };
            if (tk) { headers.Authorization = tk; headers.token = tk; }
            var r = await fetch('/api/oj/logout', { method: 'POST', headers: headers, credentials: 'include' });
            var j = null; try { j = await r.json(); } catch (e) { }
            if (!r.ok && !(j && j.status === 200)) throw new Error((j && (j.msg || j.message)) || ('HTTP ' + r.status));
            out('服务端退出登录成功。', 'ok');
        } catch (e) { out('服务端退出登录可能失败：' + e.message + '，继续清理本地登录状态。', 'err'); }
        clearHojLoginState();
        ['userInfo', 'user', 'profile', 'UserInfo', 'USER_INFO', 'accessToken', 'refreshToken', 'Authorization'].forEach(function (k) {
            try { localStorage.removeItem(k); } catch (e) { }
            try { sessionStorage.removeItem(k); } catch (e) { }
        });
        updateLoginBtn(); setStatus('已退出登录');
    }

    async function doStudentSelect() {
        var tk = token();
        if (!tk) { out('未检测到 token，请重新登录。', 'err'); updateLoginBtn(); return; }
        try {
            var r = await fetch('/api/oj/getStudents', { method: 'GET', headers: { 'Content-Type': 'application/json', 'token': tk }, credentials: 'include' });
            var j = await r.json();
            if (!j || j.status !== 200 || !Array.isArray(j.data) || !j.data.length) {
                out('登录完成（无需选择学生）。', 'ok'); setStatus('登录完成'); updateLoginBtn(); return;
            }
            var students = j.data;
            var listHtml = '';
            for (var i = 0; i < students.length; i++) {
                var s = students[i];
                listHtml += '<div class="dev-list-item" data-code="' + esc(s.studentCode) + '" '
                    + 'style="padding:8px 12px;cursor:pointer;border-bottom:1px solid #DDD;font-size:13px;">'
                    + '<b>' + esc(s.username || s.studentCode) + '</b>'
                    + '<span style="color:#888;margin-left:8px;font-size:11px;">' + esc(s.studentCode) + '</span>'
                    + '</div>';
            }
            var m = modal('选择学生账号',
                '<div style="padding:10px 0 4px;font-size:12px;color:#555;padding-left:12px;">检测到多个学生账号，请选择：</div>'
                + '<div id="dev-student-list" style="max-height:260px;overflow:auto;">' + listHtml + '</div>',
                [{ t: '取消', f: function (mm) { mm.remove(); updateLoginBtn(); out('已取消选择学生。', 'err'); setStatus('就绪'); } }]
            );
            m.querySelectorAll('.dev-list-item').forEach(function (el) {
                el.addEventListener('mouseenter', function () { el.style.background = '#C1D2EE'; });
                el.addEventListener('mouseleave', function () { el.style.background = ''; });
                el.onclick = function () { var code = el.dataset.code; m.remove(); loginByStudentCode(code, tk); };
            });
        } catch (e) { out('获取学生列表失败: ' + e.message + '，将直接以当前账号登录。', 'err'); setStatus('登录完成'); updateLoginBtn(); }
    }

    async function loginByStudentCode(studentCode, tk) {
        setStatus('切换学生账号...');
        try {
            var r = await fetch('/api/oj/loginByToken', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ studentCode: studentCode, token: tk }) });
            var j = await r.json();
            if (!j || j.status !== 200 || !j.data) throw new Error(j && j.msg ? j.msg : '接口返回异常');
            var userData = j.data;
            try {
                var vuexRaw = localStorage.getItem('vuex');
                var vuex = vuexRaw ? JSON.parse(vuexRaw) : {};
                if (!vuex.user) vuex.user = {};
                vuex.user = Object.assign(vuex.user, { token: tk, uid: userData.uid, username: userData.username, nickname: userData.nickname || userData.username, studentId: userData.studentId, studentCode: userData.studentCode, isTeacher: userData.isTeacher });
                localStorage.setItem('vuex', JSON.stringify(vuex));
            } catch (e2) { }
            out('已切换到学生账号: ' + (userData.nickname || userData.username) + '，登录完成。', 'ok'); setStatus('登录完成'); updateLoginBtn();
        } catch (e) { out('切换学生账号失败: ' + e.message, 'err'); setStatus('切换失败'); updateLoginBtn(); }
    }

    $('#dev-login-btn').onclick = async function () {
        if (token()) {
            if (!confirm('确定要退出当前登录吗？')) return;
            await doFullLogout();
            setTimeout(function () {
                var url = location.origin + location.pathname + '?_logout=' + Date.now();
                location.replace(url);
            }, 800);
            return;
        }
        enterWebsiteLoginMode();
        openWebsiteLoginPopup();

        var retry = 0, tokenDetectedAt = 0, studentFlowStarted = false;

        // 持续检测网站弹窗状态，自动调整脚本 UI 层级
        var raiseTimer = setInterval(function () {
            if (__websiteLoginActive) raiseWebsiteLoginDialog();
        }, 200);

        var timer = setInterval(function () {
            retry++;
            if (token()) {
                if (!tokenDetectedAt) {
                    tokenDetectedAt = Date.now();
                    setStatus('检测登录状态...');
                }
                // 如果网站还在显示自己的弹窗（如选学员），等用户操作完
                if (hasWebsiteLoginOrChooseDialog()) {
                    raiseWebsiteLoginDialog();
                    return;
                }
                if (!studentFlowStarted) {
                    studentFlowStarted = true;
                    clearInterval(timer);
                    clearInterval(raiseTimer);
                    restoreWebsiteLoginMode();
                    doStudentSelect();
                }
                return;
            }
            if (retry >= 120) {
                clearInterval(timer);
                clearInterval(raiseTimer);
                restoreWebsiteLoginMode();
                updateLoginBtn();
                out('暂未检测到完整登录状态，请手动完成登录后刷新。', 'err');
                setStatus('等待手动登录');
            }
        }, 700);
    };




    function doNew() {
        if (cur()) cur().code = codeEl.value;
        var i = newFile({ lang: (cur() && cur().lang) || 'C++ With O2' });
        switchFile(i);
    }

    function doOpen() {
        closeMenu();
        var inp = document.createElement('input');
        inp.type = 'file'; inp.accept = '.cpp,.c,.cc,.cxx,.txt,.py,.java';
        inp.onchange = function () {
            var f = inp.files[0]; if (!f) return;
            var rd = new FileReader();
            rd.onload = function () {
                if (cur()) cur().code = codeEl.value;
                var ext = (f.name.match(/\.\w+$/) || [''])[0].toLowerCase();
                var lang = ext === '.py' ? 'Python3' : ext === '.java' ? 'Java' : ext === '.c' ? 'C' : 'C++ With O2';
                var idx = newFile({ name: f.name, code: String(rd.result), lang: lang });
                switchFile(idx);
            };
            rd.readAsText(f);
        };
        inp.click();
    }

    function doSave() {
        closeMenu();
        const f = cur(); if (!f) return;
        f.code = codeEl.value; f.name = fileNameOf(f);
        const blob = new Blob([f.code], { type: 'text/plain' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob); a.download = f.name; a.click();
        out('已保存到本地: ' + f.name, 'ok'); renderFileTabs();
    }

    $('#dev-new').onclick = doNew;
    $('#dev-open').onclick = doOpen;
    $('#dev-save').onclick = doSave;
    $('#dev-compile').onclick = doCompile;
    $('#dev-run').onclick = doRun;
    $('#dev-submit').onclick = doSubmit;
    $('#dev-loadac').onclick = loadAcCode;
    $('#dev-lang').onchange = e => {
        const f = cur(); if (!f) return;
        const oldTpl = tplFor(f.lang);
        f.lang = e.target.value; statusLang.textContent = f.lang;
        if (codeEl.value.trim() === oldTpl.trim() || !codeEl.value.trim()) { codeEl.value = tplFor(f.lang); f.code = codeEl.value; }
        f.name = fileNameOf(f);
        refreshHighlight(); refreshGutter(); renderFileTabs();
    };

    /* ============== 输出区高度拖拽 ============== */
    /* ============== 输出区高度拖拽 ============== */
    (function () {
        const rz = $('#dev-resizer'), outEl = root.querySelector('.dev-output');
        let sy = 0, sh = 0, drag = false;
        rz.addEventListener('mousedown', e => { drag = true; sy = e.clientY; sh = outEl.offsetHeight; document.body.style.userSelect = 'none'; });
        document.addEventListener('mousemove', e => {
            if (!drag) return;
            const h = Math.max(60, Math.min(window.innerHeight * 0.7, sh - (e.clientY - sy)));
            outEl.style.flex = '0 0 ' + h + 'px'; outEl.style.height = h + 'px';
        });
        document.addEventListener('mouseup', () => { drag = false; document.body.style.userSelect = ''; });
    })();

    /* ============== 左右分栏拖拽 ============== */
    (function () {
        var brz = $('#dev-body-resizer');
        var leftEl = root.querySelector('.dev-left');
        var bodyEl = root.querySelector('.dev-body');
        if (!brz || !leftEl || !bodyEl) return;
        var dragging = false;
        var startX = 0;
        var startW = 0;
        brz.addEventListener('mousedown', function (e) {
            dragging = true;
            startX = e.clientX;
            startW = leftEl.offsetWidth;
            document.body.style.userSelect = 'none';
            e.preventDefault();
        });
        document.addEventListener('mousemove', function (e) {
            if (!dragging) return;
            var bodyW = bodyEl.offsetWidth;
            var newW = Math.max(200, Math.min(bodyW - 200, startW + (e.clientX - startX)));
            leftEl.style.width = newW + 'px';
        });
        document.addEventListener('mouseup', function () {
            if (!dragging) return;
            dragging = false;
            document.body.style.userSelect = '';
            // 持久化宽度
            try { localStorage.setItem('__devhoj_leftW', leftEl.offsetWidth); } catch (e) {}
        });
        // 恢复上次宽度
        try {
            var savedW = parseInt(localStorage.getItem('__devhoj_leftW'), 10);
            if (savedW && savedW >= 200) leftEl.style.width = savedW + 'px';
        } catch (e) {}
    })();



    /* ============== 工具栏内搜索 ============== */
    const searchKw = $('#dev-search-kw');
    const searchGo = $('#dev-search-go');
    const searchDropdown = $('#dev-search-dropdown');
    let searchDropdownArr = [];

    async function doToolbarSearch() {
        var kw = searchKw.value.trim();
        if (!kw) { searchDropdown.classList.remove('on'); return; }
        searchDropdown.innerHTML = '<div class="dev-sr-loading">搜索中...</div>';
        searchDropdown.classList.add('on');
        try {
            var r = await req('/api/oj/get-problem-list?keyword=' + encodeURIComponent(kw) + '&limit=50&currentPage=1');
            var d = r && r.data;
            var arr = [];
            if (Array.isArray(d)) arr = d;
            else if (d && Array.isArray(d.records)) arr = d.records;
            else if (d && d.problemList && Array.isArray(d.problemList.records)) arr = d.problemList.records;
            else if (d && Array.isArray(d.problemList)) arr = d.problemList;
            if (!arr.length) {
                searchDropdown.innerHTML = '<div class="dev-sr-empty">无结果</div>';
                searchDropdownArr = [];
                return;
            }
            searchDropdownArr = arr;
            var html = '';
            for (var i = 0; i < arr.length; i++) {
                var p = arr[i];
                html += '<div class="dev-sr-item" data-i="' + i + '">'
                    + '<span class="sid">' + esc(sid(p)) + '</span>'
                    + '<span class="stitle" title="' + esc(ptitle(p)) + '">' + esc(ptitle(p)) + '</span>'
                    + '</div>';
            }
            searchDropdown.innerHTML = html;
            searchDropdown.querySelectorAll('.dev-sr-item').forEach(function (item) {
                item.onclick = function () {
                    var p = searchDropdownArr[+item.dataset.i];
                    searchDropdown.classList.remove('on');
                    openProblem({ mode: 'training', displayIdInput: sid(p), gid: '' });
                };
            });
        } catch (e) {
            searchDropdown.innerHTML = '<div class="dev-sr-empty" style="color:#C00;">搜索失败: ' + esc(e.message) + '</div>';
        }
    }

    searchGo.onclick = doToolbarSearch;
    searchKw.onkeydown = function (e) { if (e.key === 'Enter') doToolbarSearch(); };

    document.addEventListener('mousedown', function (e) {
        if (!searchDropdown.classList.contains('on')) return;
        var wrap = searchKw.closest('.dev-search-wrap');
        if (wrap && wrap.contains(e.target)) return;
        searchDropdown.classList.remove('on');
    });




    /* ============== 加载题目 ============== */
    async function openProblem(opt) {
        closeMenu();
        setStatus('加载题目中...');
        try {
            let data, displayId, pidNum, mode;
            if (opt.mode === 'contest') {
                data = (await req('/api/oj/get-contest-problem-details?displayId=' + encodeURIComponent(opt.displayId) + '&cid=' + opt.cid))?.data || {};
                displayId = opt.displayId;
                pidNum = String(opt.pidNum ?? data?.problem?.id ?? data?.problem?.problemId ?? '');
                mode = 'contest';
            } else {
                let url = '/api/oj/get-problem-detail?problemId=' + encodeURIComponent(opt.displayIdInput);
                if (opt.gid) url += '&gid=' + opt.gid;
                data = (await req(url))?.data || {};
                displayId = opt.displayIdInput;
                pidNum = String(data?.problem?.id ?? data?.problem?.problemId ?? '');
                mode = 'training';
            }
            const langs0 = Array.isArray(data?.languages) ? data.languages : null;
            const langs = (langs0 && langs0.length ? langs0 : ['C++ With O2', 'C++', 'Python3', 'Java', 'C'])
                .map(l => typeof l === 'string' ? l : (l.name || l.language)).filter(Boolean);
            let chosen = cur()?.lang || 'C++ With O2';
            if (!langs.includes(chosen)) chosen = langs[0];
            const onlyPython = langs.every(l => /Python/i.test(l));
            if (onlyPython) chosen = langs.find(l => /Python/i.test(l)) || chosen;

            const title = data?.problem?.title || displayId;
            let f = cur();
            const empty = !f || f.code.trim() === tplFor(f.lang).trim() || !f.code.trim();
            if (!empty) {
                if (cur()) cur().code = codeEl.value;
                const i = newFile({ lang: chosen }); activeFile = i; f = cur();
            } else if (!f) {
                const i = newFile({ lang: chosen }); activeFile = i; f = cur();
            }
            f.lang = chosen; f.languages = langs; f.displayId = displayId; f.title = title;
            f.mode = mode; f.pid = pidNum; f.cid = opt.cid || ''; f.tid = opt.tid || ''; f.gid = opt.gid || '';
            f.problem = data; f.name = fileNameOf(f); f.code = tplFor(f.lang);
            codeEl.value = f.code;

            S_lang_select(f);
            renderProblem(data);
            renderFileTabs();
            renderProblemListHighlight();
            statusMode.textContent = displayId;
            refreshHighlight(); refreshGutter(); refreshLnCol();
            setStatus('题目已加载: ' + title);
            saveSession();
        } catch (e) {
            setStatus('加载失败');
            out('题目加载失败: ' + e.message, 'err');
            alert('加载失败: ' + e.message);
        }
    }


    function parseSamples(p) {
        const tries = [p.samples, p.examples];
        for (const t of tries) {
            if (Array.isArray(t) && t.length) return t;
            if (typeof t === 'string' && t) {
                try { const j = JSON.parse(t); if (Array.isArray(j) && j.length) return j; } catch (e) { }
                const re = /<input>([\s\S]*?)<\/input>\s*<output>([\s\S]*?)<\/output>/g;
                const r = []; let m;
                while ((m = re.exec(t)) !== null) r.push({ input: m[1], output: m[2] });
                if (r.length) return r;
            }
        }
        return [];
    }

    function renderProblem(data) {
        var p = (data && data.problem) || data || {};
        var samples = parseSamples(p);

        Promise.all([loadMarkdownIt(), loadKatex()]).then(function () {
            _md = null;

            var h = '';
            h += '<h2>' + esc(p.title || p.problemName || '未命名') + '</h2>';
            h += '<div class="meta">'
                + '时间限制 ' + esc(p.timeLimit || '?') + 'ms ｜ '
                + '内存限制 ' + esc(p.memoryLimit || '?') + 'MB'
                + '</div>';

            if (p.description) h += '<h3>题目描述</h3><div class="dev-md-preview">' + renderMarkdown(p.description) + '</div>';
            if (p.input) h += '<h3>输入格式</h3><div class="dev-md-preview">' + renderMarkdown(p.input) + '</div>';
            if (p.output) h += '<h3>输出格式</h3><div class="dev-md-preview">' + renderMarkdown(p.output) + '</div>';

            for (var i = 0; i < samples.length; i++) {
                var s = samples[i];
                h += '<h3>样例 ' + (i + 1) + ' 输入</h3>'
                    + '<pre>' + esc(s.input || '') + '</pre>'
                    + '<h3>样例 ' + (i + 1) + ' 输出</h3>'
                    + '<pre>' + esc(s.output || '') + '</pre>'
                    + '<button class="dev-tb-btn" data-si="' + i + '" '
                    + 'style="margin:4px 0;border:1px solid #ACA899;">▶ 用此样例自测</button>';
            }

            if (p.hint) h += '<h3>提示</h3><div class="dev-md-preview">' + renderMarkdown(p.hint) + '</div>';

            $('#dev-prob').innerHTML = h;
            // ── 注入 AC 情况 & 提交记录按钮 ──
            var _probActBar = document.createElement('div');
            _probActBar.style.cssText = 'display:flex;gap:6px;padding:6px 0 2px;';
            _probActBar.innerHTML =
                '<button id="dev-btn-ac-stats" style="height:24px;padding:0 10px;background:#ECE9D8;border:1px solid #ACA899;cursor:pointer;font-size:11px;border-radius:2px;">📊 AC情况</button>' +
                '<button id="dev-btn-sub-list" style="height:24px;padding:0 10px;background:#ECE9D8;border:1px solid #ACA899;cursor:pointer;font-size:11px;border-radius:2px;">📝 提交记录</button>';
            $('#dev-prob').insertBefore(_probActBar, $('#dev-prob').firstChild);
            _probActBar.querySelector('#dev-btn-ac-stats').onclick = function (e) { e.stopPropagation(); showAcStats(); };
            _probActBar.querySelector('#dev-btn-sub-list').onclick = function (e) { e.stopPropagation(); showSubmissionList(); };

            $('#dev-prob').querySelectorAll('button[data-si]').forEach(function (b) {
                b.addEventListener('mousedown', function (e) { e.stopPropagation(); });
                b.onclick = function (e) { e.stopPropagation(); runWithSample(+b.dataset.si); };
            });

            renderLatex($('#dev-prob'));
        });
    }


    async function runWithSample(idx) {
        closeMenu();

        const f = cur();
        if (!f || !f.problem) return alert('请先选择题目');

        const samples = parseSamples(f.problem.problem || f.problem);
        const s = samples[idx];
        if (!s) return alert('无此样例');

        const r = await openIOModal(s.input || '');
        if (!r) return;

        runTestWith(r.input, '', r.modal);
    }




    /* ============== 自测 ============== */
    async function doRun() {
        closeMenu();
        const f = cur();
        if (!f || !f.problem) return alert('请先选择题目');

        const r = await openIOModal('');
        if (!r) return;

        runTestWith(r.input, '', r.modal);
    }





    function openIOModal(defaultInput) {
        return new Promise(function (resolve) {
            closeMenu();

            var done = false;

            var m = document.createElement('div');
            m.className = 'dev-modal dev-run-modal';

            m.innerHTML =
                '<div class="dev-modal-bd dev-run-window">' +
                '<div class="dev-run-titlebar">' +
                '<span>运行</span>' +
                '<button id="dev-run-close" class="dev-run-close" title="关闭">×</button>' +
                '</div>' +
                '<div class="dev-run-console">' +
                '<div id="dev-run-screen" class="dev-run-screen">' +
                '<div id="dev-run-stdin" class="dev-run-stdin" contenteditable="true" spellcheck="false"></div>' +
                '</div>' +
                '</div>' +
                '</div>';

            document.body.appendChild(m);

            var box = m.querySelector('.dev-run-window');
            var titlebar = m.querySelector('.dev-run-titlebar');
            var closeBtn = m.querySelector('#dev-run-close');
            var stdinEl = m.querySelector('#dev-run-stdin');

            function closeModal() {
                if (!done) {
                    done = true;
                    resolve(null);
                }
                m.remove();
            }

            closeBtn.onclick = function (e) {
                e.stopPropagation();
                closeModal();
            };

            if (stdinEl) {
                stdinEl.innerText = defaultInput || '';

                setTimeout(function () {
                    stdinEl.focus();

                    try {
                        var range = document.createRange();
                        range.selectNodeContents(stdinEl);
                        range.collapse(false);

                        var sel = window.getSelection();
                        sel.removeAllRanges();
                        sel.addRange(range);
                    } catch (e) { }
                }, 0);

                stdinEl.addEventListener('keydown', function (e) {
                    if (e.key !== 'Enter') return;

                    // Shift + Enter：输入换行
                    if (e.shiftKey) return;

                    // Enter：确认运行
                    e.preventDefault();

                    if (done) return;
                    done = true;

                    resolve({
                        input: stdinEl.innerText.replace(/\u00a0/g, ' '),
                        modal: m
                    });
                });
            }

            // 窗口拖动
            (function enableDrag() {
                var dragging = false;
                var startX = 0;
                var startY = 0;
                var startLeft = 0;
                var startTop = 0;

                titlebar.addEventListener('mousedown', function (e) {
                    if (e.target === closeBtn) return;

                    dragging = true;

                    var rect = box.getBoundingClientRect();
                    startX = e.clientX;
                    startY = e.clientY;
                    startLeft = rect.left;
                    startTop = rect.top;

                    box.style.position = 'fixed';
                    box.style.left = startLeft + 'px';
                    box.style.top = startTop + 'px';
                    box.style.margin = '0';
                    box.style.transform = 'none';

                    document.body.style.userSelect = 'none';

                    e.preventDefault();
                });

                document.addEventListener('mousemove', function (e) {
                    if (!dragging) return;

                    var dx = e.clientX - startX;
                    var dy = e.clientY - startY;

                    var newLeft = startLeft + dx;
                    var newTop = startTop + dy;

                    var maxLeft = window.innerWidth - box.offsetWidth;
                    var maxTop = window.innerHeight - box.offsetHeight;

                    newLeft = Math.max(0, Math.min(newLeft, Math.max(0, maxLeft)));
                    newTop = Math.max(0, Math.min(newTop, Math.max(0, maxTop)));

                    box.style.left = newLeft + 'px';
                    box.style.top = newTop + 'px';
                });

                document.addEventListener('mouseup', function () {
                    if (!dragging) return;
                    dragging = false;
                    document.body.style.userSelect = '';
                });
            })();
        });
    }








    async function runTestWith(userInput, expectedOutput, consoleModal) {
        var consoleOutEl = consoleModal ? consoleModal.querySelector('#dev-run-screen') : null;

        function cout(text, cls) {
            if (consoleOutEl) {
                var div = document.createElement('div');
                div.className = 'line ' + (cls || '');
                div.textContent = text == null ? '' : String(text);
                consoleOutEl.appendChild(div);
                consoleOutEl.scrollTop = consoleOutEl.scrollHeight;
            } else {
                out(esc(text == null ? '' : String(text)), cls || 'run');
            }
        }

        function coutBlock(title, text, cls) {
            if (consoleOutEl) {
                var titleDiv = document.createElement('div');
                titleDiv.className = 'line prompt';
                titleDiv.textContent = title;
                consoleOutEl.appendChild(titleDiv);

                var pre = document.createElement('pre');
                pre.className = 'dev-run-block ' + (cls || '');
                pre.textContent = text == null || text === '' ? '(无)' : String(text);
                consoleOutEl.appendChild(pre);

                consoleOutEl.scrollTop = consoleOutEl.scrollHeight;
            } else {
                out(
                    esc(title) + '<br><pre style="white-space:pre-wrap;">'
                    + esc(text == null || text === '' ? '(无)' : String(text))
                    + '</pre>',
                    cls || 'run'
                );
            }
        }
        function enableAnyKeyClose() {
            if (!consoleModal) return;

            setTimeout(function () {
                var closed = false;

                function closeOnce(e) {
                    if (closed) return;
                    closed = true;

                    e.preventDefault();
                    e.stopPropagation();

                    document.removeEventListener('keydown', closeOnce, true);

                    try {
                        consoleModal.remove();
                    } catch (err) { }
                }

                document.addEventListener('keydown', closeOnce, true);
            }, 0);
        }

        var f = cur(); if (!f || !f.problem) return alert('请先选择题目');
        var code = codeEl.value; if (!code.trim()) return alert('代码不能为空');

        if (consoleOutEl) {
            consoleOutEl.innerHTML = '';
        } else {
            showBottomPanel('run');
            output.innerHTML = '';
            out('正在编译...', 'info');
            out('正在运行程序...', 'info');
        }

        var modeMap = {
            'C++ With O2': 'text/x-c++src',
            'C++': 'text/x-c++src',
            'C': 'text/x-csrc',
            'Java': 'text/x-java',
            'Python3': 'text/x-python',
            'Python2': 'text/x-python'
        };

        var pidVal = f.mode === 'contest' ? f.pid : (parseInt(f.pid, 10) || f.pid);
        if (!pidVal) {
            alert('题目数字 pid 缺失,无法自测,请重新加载题目');
            return;
        }

        var payload = {
            pid: pidVal,
            language: f.lang,
            code: code,
            type: f.mode === 'contest' ? 'contest' : 'group',
            userInput: userInput || '',
            expectedOutput: expectedOutput || '',
            mode: modeMap[f.lang] || 'text/x-c++src',
            isRemoteJudge: false,
            seconds: 0
        };

        setStatus('自测中...');

        try {
            var r = await req('/api/oj/submit-problem-test-judge', 'POST', payload);
            var key = r && r.data && (r.data.testJudgeKey || r.data.key);
            if (typeof key !== 'string') key = (r && typeof r.data === 'string') ? r.data : '';
            if (!key || key.indexOf('TEST_JUDGE') !== 0) {
                throw new Error('未返回 testJudgeKey: ' + JSON.stringify(r && r.data));
            }

            var RUNNING = { '6': 1, '7': 1, '9': 1, '11': 1, '13': 1, '14': 1, '15': 1 };

            for (var i = 0; i < 30; i++) {
                await sleep(1000);

                var dRes = await req('/api/oj/get-test-judge-result?testJudgeKey=' + encodeURIComponent(key));
                var d = (dRes && dRes.data) || {};
                var st = String(d.status == null ? '' : d.status);

                if (RUNNING[st]) {
                    setStatus('评测中... ' + i + 's');
                    continue;
                }

                var userOut = String(d.userOutput == null ? '' : d.userOutput).replace(/\s+$/, '');
                var realExp = String(d.expectedOutput == null ? (expectedOutput || '') : d.expectedOutput).replace(/\s+$/, '');

                var outputMatched = !realExp ? null : (userOut === realExp);
                var ok = false;

                if (st === '0') {
                    ok = true;
                } else if (realExp) {
                    ok = outputMatched;
                } else {
                    ok = st !== '-2' && st !== '3' && st !== '4' && st !== '-1' && st !== '1' && st !== '2' && st !== '5';
                }

                var memMB = d.memory != null ? (d.memory / 1024).toFixed(1) + 'MB' : '-';
                var stLabel = st === '0' ? 'Accepted'
                    : st === '-1' ? 'Wrong Answer'
                        : st === '-2' ? 'Compile Error'
                            : st === '1' ? 'Time Limit Exceeded'
                                : st === '2' ? 'Memory Limit Exceeded'
                                    : st === '3' ? 'Runtime Error'
                                        : st === '4' ? 'System Error'
                                            : st === '5' ? 'Presentation Error'
                                                : ('完成,status=' + st);

                if (d.stderr) {
                    cout('', 'run');
                    String(d.stderr).split('\n').forEach(function (line) {
                        cout(line, 'err');
                    });
                }

                if (userOut) {
                    String(userOut).split('\n').forEach(function (line) {
                        cout(line, 'run');
                    });
                }

                cout('', 'run');
                cout(
                    'Process exited after '
                    + (d.time == null ? '-' : (Number(d.time) / 1000).toFixed(3))
                    + ' seconds with return value '
                    + (ok ? '0' : '1'),
                    'run'
                );
                cout('请按任意键继续. . .', 'run');
                enableAnyKeyClose();

                setStatus(ok ? '自测通过' : '自测完成');
                return;
            }

            cout('自测超时', 'err');
            cout('请按任意键继续. . .', 'run');
            enableAnyKeyClose();
            setStatus('超时');
        } catch (e) {
            cout('自测失败: ' + e.message, 'err');
            enableAnyKeyClose();
            setStatus('错误');
        }
    }


    /* ============== 编译 ============== */
    async function doCompile() {
        closeMenu();
        showBottomPanel('run');
        var f = cur();
        if (!f || !f.problem) {
            var code0 = codeEl.value; var issues = [];
            var opens = (code0.match(/\{/g) || []).length; var closes = (code0.match(/\}/g) || []).length;
            if (opens !== closes) issues.push('花括号不匹配: { 有 ' + opens + ' 个, } 有 ' + closes + ' 个');
            var lp = (code0.match(/$/g) || []).length; var rp = (code0.match(/$/g) || []).length;
            if (lp !== rp) issues.push('圆括号不匹配: ( 有 ' + lp + ' 个, ) 有 ' + rp + ' 个');
            if (issues.length) issues.forEach(function (x) { out('警告: ' + x, 'err'); });
            else out('本地基础检查通过 (未加载题目,无法在线编译)', 'ok');
            return;
        }
        var code = codeEl.value; if (!code.trim()) return alert('代码不能为空');
        var modeMap = { 'C++ With O2': 'text/x-c++src', 'C++': 'text/x-c++src', 'C': 'text/x-csrc', 'Java': 'text/x-java', 'Python3': 'text/x-python', 'Python2': 'text/x-python' };
        var pidVal = f.mode === 'contest' ? f.pid : (parseInt(f.pid, 10) || f.pid);
        if (!pidVal) { alert('题目数字 pid 缺失,无法编译,请重新加载题目'); return; }
        var payload = { pid: pidVal, language: f.lang, code: code, type: f.mode === 'contest' ? 'contest' : 'group', userInput: '0', expectedOutput: '', mode: modeMap[f.lang] || 'text/x-c++src', isRemoteJudge: false, seconds: 0 };
        setStatus('编译中...');
        try {
            var r = await req('/api/oj/submit-problem-test-judge', 'POST', payload);
            var key = (r && r.data && (r.data.testJudgeKey || r.data.key)) || (r && r.data);
            if (!key || typeof key !== 'string' || key.indexOf('TEST_JUDGE') !== 0) throw new Error('未返回合法 testJudgeKey: ' + JSON.stringify(r && r.data));
            var RUNNING = { '6': 1, '7': 1, '9': 1, '11': 1, '13': 1, '14': 1, '15': 1 };
            for (var i = 0; i < 30; i++) {
                await sleep(1000);
                var dRes = await req('/api/oj/get-test-judge-result?testJudgeKey=' + encodeURIComponent(key));
                var d = (dRes && dRes.data) || {};
                var st = String(d.status == null ? '' : d.status);
                if (RUNNING[st]) { setStatus('编译中... ' + i + 's'); continue; }
                var errMsg = d.stderr || d.compileMessage || d.compilationErrorMessage || d.errorMessage || d.info || (d.judgeInfo && (d.judgeInfo.stderr || d.judgeInfo.compileMessage || d.judgeInfo.compilationErrorMessage || d.judgeInfo.errorMessage || d.judgeInfo.info)) || '';
                var stLabel = st === '0' ? 'Accepted' : st === '-2' ? 'Compile Error' : st === '3' ? 'Runtime Error' : st === '4' ? 'System Error' : ('完成,status=' + st);
                if (st === '-2') {
                    out('✗ 编译错误 (Compile Error)', 'err');
                    if (errMsg) out('编译信息:<br><pre style="white-space:pre-wrap;color:#900;">' + esc(errMsg) + '</pre>', 'err');
                    else out('未返回具体编译信息', 'err');
                    setStatus('编译错误');
                } else if (st === '3' || st === '4') {
                    out('✗ ' + stLabel, 'err');
                    if (errMsg) out('错误信息:<br><pre style="white-space:pre-wrap;color:#900;">' + esc(errMsg) + '</pre>', 'err');
                    setStatus('编译完成');
                } else {
                    out('✓ 编译通过', 'ok');
                    if (d.stderr) out('stderr:<br><pre style="white-space:pre-wrap;color:#900;">' + esc(d.stderr) + '</pre>', 'err');
                    setStatus('编译通过');
                }
                return;
            }
            out('编译检查超时', 'err'); setStatus('超时');
        } catch (e) { out('编译失败: ' + e.message, 'err'); setStatus('错误'); }
    }

    /* ============== 提交 ============== */
    async function doSubmit() {
        closeMenu();
        const f = cur(); if (!f || !f.problem) return alert('请先选择题目');
        if (!confirm('确定提交到 ' + f.displayId + ' (' + (f.title || '') + ') 吗?')) return;
        const code = codeEl.value;
        let payload;
        if (f.mode === 'contest') {
            payload = { pid: f.displayId, language: f.lang, code, cid: parseInt(f.cid, 10), tid: null, gid: null, isRemote: false, seconds: 2, platform: 0 };
        } else {
            payload = { pid: f.displayId, language: f.lang, code, cid: 0, tid: f.tid ? String(f.tid) : null, gid: f.gid ? String(f.gid) : null, isRemote: false, seconds: 0, platform: 0 };
        }
        setStatus('提交中...');
        showBottomPanel('result');
        $('#dev-result').innerHTML = '<p style="color:#0058E1;">评测中,请稍候...</p>';


        try {
            const r = await req('/api/oj/submit-problem-judge', 'POST', payload);
            const submitId = String(r?.data?.submitId ?? r?.data?.id ?? r?.data ?? '');
            if (!submitId || submitId === 'undefined') throw new Error('未返回 submitId');
            f.submitId = submitId;
            const STATUS = { '-2': 'Compile Error', '-1': 'Wrong Answer', '0': 'Accepted', '1': 'Time Limit Exceeded', '2': 'Memory Limit Exceeded', '3': 'Runtime Error', '4': 'System Error', '5': 'Presentation Error', '6': 'Pending', '7': 'Judging', '8': 'Partial Accepted', '9': 'Submitting', '10': 'Submit Failed', '11': 'Pending Rejudge', '13': 'Rejudging', '14': 'Judging', '15': 'Queueing' };
            const COLOR = { '0': '#0A8043', '-1': '#C00', '-2': '#7c3aed', '1': '#b45309', '2': '#b45309', '3': '#C00', '8': '#D97706' };
            const RUNNING = new Set(['6', '7', '9', '11', '13', '14', '15']);
            for (let i = 0; i < 40; i++) {
                await sleep(1200);
                const sub = (await req('/api/oj/get-submission-detail?submitId=' + submitId))?.data?.submission || {};
                const st = String(sub.status ?? '');
                const label = STATUS[st] || ('状态 ' + st);
                if (RUNNING.has(st)) {
                    setStatus('评测中: ' + label);
                    $('#dev-result').innerHTML = '<div class="dev-result-judging">'
                        + '<div class="spinner"></div>'
                        + '<div class="judging-text">评测中</div>'
                        + '<div class="judging-sub">正在等待评测结果，请稍候...</div>'
                        + '</div>';

                    continue;
                }
                const ok = st === '0';
                const color = COLOR[st] || '#444';

                // 判断结果分类用于样式
                var resClass = 'res-se'; // 默认 System Error
                if (st === '0') resClass = 'res-ac';
                else if (st === '-1') resClass = 'res-wa';
                else if (st === '-2') resClass = 'res-ce';
                else if (st === '1') resClass = 'res-tle';
                else if (st === '2') resClass = 'res-mle';
                else if (st === '3') resClass = 'res-re';
                else if (st === '5') resClass = 'res-pe';
                else if (st === '8') resClass = 'res-pa';

                var bannerIcon = st === '0' ? '✅'
                    : st === '-1' ? '❌'
                        : st === '-2' ? '🔧'
                            : st === '1' ? '⏱️'
                                : st === '2' ? '💾'
                                    : st === '3' ? '💥'
                                        : st === '5' ? '📝'
                                            : st === '8' ? '⚠️'
                                                : '❓';

                let cases = [];
                try {
                    cases = (await req('/api/oj/get-all-case-result?submitId=' + submitId))?.data?.judgeCaseList || [];
                } catch (e) { }

                const memMB = sub.memory != null ? (sub.memory / 1024).toFixed(1) + 'MB' : '-';
                const timeMs = sub.time == null ? '-' : sub.time;
                const scoreVal = sub.score == null ? '-' : sub.score;

                // 统计测试点通过率
                var acCount = 0, totalCount = cases.length;
                for (var ci = 0; ci < cases.length; ci++) {
                    if (String(cases[ci].status) === '0') acCount++;
                }

                var html = '';

                // ── 1. 状态横幅 ──
                html += '<div class="dev-result-banner ' + resClass + '">'
                    + '<div class="banner-left">'
                    + '<span class="banner-icon">' + bannerIcon + '</span>'
                    + '<span class="banner-status">' + esc(label) + '</span>'
                    + '</div>'
                    + '<div class="banner-right">'
                    + '<span class="metric-tag"><span class="ml">分数</span><span class="mv">' + esc(scoreVal) + '</span></span>'
                    + '<span class="metric-tag"><span class="ml">耗时</span><span class="mv">' + esc(timeMs) + 'ms</span></span>'
                    + '<span class="metric-tag"><span class="ml">内存</span><span class="mv">' + esc(memMB) + '</span></span>'
                    + '<span class="metric-tag"><span class="ml">语言</span><span class="mv">' + esc(sub.language || f.lang) + '</span></span>'
                    + '</div>'
                    + '</div>';



                // ── 3. 错误信息 ──
                if (sub.errorMessage && sub.errorMessage !== 'The error message does not support viewing.') {
                    html += '<div class="dev-result-error">'
                        + '<div class="dev-result-error-hd">错误信息</div>'
                        + '<div class="dev-result-error-bd">' + esc(sub.errorMessage) + '</div>'
                        + '</div>';
                }

                // ── 4. 测试点网格 ──
                if (cases.length) {
                    html += '<div class="dev-result-cases">'
                        + '<div class="dev-result-cases-hd">'
                        + '测试点详情'
                        + '<span class="cases-stat">' + acCount + ' / ' + totalCount + ' 通过</span>'
                        + '</div>'
                        + '<div class="dev-result-cases-grid">';

                    for (var ci = 0; ci < cases.length; ci++) {
                        var c = cases[ci];
                        var cs = String(c.status == null ? '' : c.status);
                        var dotClass = 'dot-pending';
                        if (cs === '0') dotClass = 'dot-ac';
                        else if (cs === '-1') dotClass = 'dot-wa';
                        else if (cs === '-2') dotClass = 'dot-ce';
                        else if (cs === '1') dotClass = 'dot-tle';
                        else if (cs === '2') dotClass = 'dot-mle';
                        else if (cs === '3') dotClass = 'dot-re';
                        else if (cs === '5') dotClass = 'dot-pe';
                        else if (cs === '8') dotClass = 'dot-pa';

                        var caseSeq = c.seq != null ? c.seq : (ci + 1);
                        var ctime = c.time != null ? c.time + 'ms' : '-';
                        var cmem = c.memory != null ? c.memory + 'KB' : '-';

                        html += '<div class="dev-case-dot ' + dotClass + '" '
                            + 'data-ci="' + ci + '" '
                            + 'data-time="' + esc(ctime) + '" '
                            + 'data-mem="' + esc(cmem) + '" '
                            + 'data-status="' + esc(STATUS[cs] || cs) + '" '
                            + 'title="#' + esc(caseSeq) + ' ' + esc(STATUS[cs] || cs) + '  ' + esc(ctime) + '  ' + esc(cmem) + '"'
                            + '>' + esc(caseSeq) + '</div>';
                    }

                    html += '</div>'
                        + '<div class="dev-case-detail" id="dev-case-detail"></div>'
                        + '</div>';
                }

                // ── 5. 底部信息 ──
                html += '<div class="dev-result-footer">'
                    + '<span>Submit ID: ' + esc(submitId) + '</span>'
                    + '</div>';

                $('#dev-result').innerHTML = html;

                // ── 6. 测试点点击交互 ──
                var detailEl = $('#dev-case-detail');
                var detailVisible = false;
                var detailCi = -1;
                $('#dev-result').querySelectorAll('.dev-case-dot').forEach(function (dot) {
                    dot.onclick = function () {
                        var ci = +dot.dataset.ci;
                        if (detailVisible && detailCi === ci) {
                            // 再次点击同一个 → 收起
                            detailEl.classList.remove('on');
                            detailVisible = false;
                            detailCi = -1;
                            return;
                        }
                        detailEl.innerHTML =
                            '<div class="detail-row"><span class="detail-label">测试点</span><span class="detail-val">#' + esc(cases[ci].seq != null ? cases[ci].seq : (ci + 1)) + '</span></div>'
                            + '<div class="detail-row"><span class="detail-label">状态</span><span class="detail-val">' + esc(dot.dataset.status) + '</span></div>'
                            + '<div class="detail-row"><span class="detail-label">耗时</span><span class="detail-val">' + esc(dot.dataset.time) + '</span></div>'
                            + '<div class="detail-row"><span class="detail-label">内存</span><span class="detail-val">' + esc(dot.dataset.mem) + '</span></div>';
                        detailEl.classList.add('on');
                        detailVisible = true;
                        detailCi = ci;
                    };
                });

                $('#dev-result').innerHTML = html;
                out('评测完成: ' + label + '  时间 ' + (sub.time ?? '-') + 'ms  内存 ' + memMB + '  分数 ' + (sub.score ?? '-'), ok ? 'ok' : 'err');
                setStatus(ok ? '✓ ' + label : '✗ ' + label);

                // AC 后立即更新左侧题单完成状态
                if (ok) {
                    acSet.add(String(f.displayId || ''));
                    renderProblemListAcMarks();
                    renderProblemListHighlight();
                }

                renderFileTabs();
                saveSession();
                if (problemListState && problemListState.problems && problemListState.problems.length) {
                    fetchAcStatus().catch(function () { });
                }

                return;

            }
            out('评测超时,请稍后到 OJ 查看', 'err');
            setStatus('超时');
            $('#dev-result').innerHTML = '<div class="dev-result-banner res-wa">'
                + '<span class="banner-icon">⏱️</span>'
                + '<div class="banner-text">'
                + '<div class="banner-status">评测超时</div>'
                + '<div class="banner-sub">请稍后到 OJ 查看结果</div>'
                + '</div>'
                + '</div>';

            renderFileTabs();
        } catch (e) {
            out('提交失败: ' + e.message, 'err');
            setStatus('提交失败');
            $('#dev-result').innerHTML = '<div class="dev-result-error">'
                + '<div class="dev-result-error-hd">提交失败</div>'
                + '<div class="dev-result-error-bd">' + esc(e.message) + '</div>'
                + '</div>';

            renderFileTabs();
        }
    }
    /* ============== 学员管理全局状态 ============== */
    var studentState = {
        members: [],          // 全部成员 { username, nickname, auth }
        selected: new Set(),  // 勾选的 username 集合（空 = 不过滤）
        gid: '',              // 上次加载的 gid
        loaded: false
    };
    async function showStudentPanel() {
        var f = cur();
        var gid = (f && f.gid) || '';

        var overlay = document.createElement('div');
        overlay.className = 'dev-modal';
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:1000010;display:flex;align-items:center;justify-content:center;';
        overlay.innerHTML =
            '<div style="background:#ECE9D8;border:2px solid #fff;box-shadow:0 0 0 1px #404040,4px 4px 12px rgba(0,0,0,.4);width:360px;max-width:94vw;max-height:80vh;display:flex;flex-direction:column;">' +
            '<div style="height:24px;background:linear-gradient(to bottom,#0058E1,#3A93FF);color:#fff;font-weight:bold;padding:0 8px;display:flex;align-items:center;justify-content:space-between;font-size:12px;flex-shrink:0;">' +
            '<span>👥 学员设置</span>' +
            '<button id="dev-stu-close" style="background:none;border:none;color:#fff;font-size:16px;cursor:pointer;padding:0 4px;">×</button>' +
            '</div>' +
            // 工具栏
            '<div style="padding:4px 8px;background:#F5F5DC;border-bottom:1px solid #ACA899;display:flex;align-items:center;gap:6px;flex-shrink:0;flex-wrap:wrap;">' +
            '<input id="dev-stu-gid" placeholder="团队 gid" value="' + esc(gid) + '" ' +
            'style="width:90px;height:22px;border:1px solid #7F9DB9;font-size:11px;padding:0 4px;box-sizing:border-box;">' +
            '<button id="dev-stu-load" style="height:22px;padding:0 8px;background:#0A8043;color:#fff;border:1px solid #0A8043;cursor:pointer;font-size:11px;border-radius:2px;font-weight:bold;">加载</button>' +
            '<button id="dev-stu-all" style="height:22px;padding:0 8px;background:#ECE9D8;border:1px solid #ACA899;cursor:pointer;font-size:11px;border-radius:2px;">全选</button>' +
            '<button id="dev-stu-none" style="height:22px;padding:0 8px;background:#ECE9D8;border:1px solid #ACA899;cursor:pointer;font-size:11px;border-radius:2px;">全不选</button>' +
            '<span id="dev-stu-stat" style="font-size:11px;color:#555;margin-left:2px;"></span>' +
            '</div>' +
            '<div id="dev-stu-list" style="flex:1;overflow-y:auto;background:#fff;">' +
            '<div style="text-align:center;color:#888;padding:30px;font-size:11px;">' +
            (studentState.loaded ? '点击「加载」刷新' : '请输入团队 gid 后点击「加载」') +
            '</div>' +
            '</div>' +
            '<div style="padding:6px 8px;background:#F5F5DC;border-top:1px solid #ACA899;display:flex;justify-content:flex-end;gap:6px;flex-shrink:0;">' +
            '<button id="dev-stu-clear" style="height:26px;padding:0 12px;background:#ECE9D8;border:1px solid #ACA899;cursor:pointer;font-size:11px;border-radius:2px;">清除过滤</button>' +
            '<button id="dev-stu-confirm" style="height:26px;padding:0 14px;background:#0058E1;color:#fff;border:1px solid #0058E1;cursor:pointer;font-size:11px;border-radius:2px;font-weight:bold;">确定</button>' +
            '</div>' +
            '</div>';

        document.body.appendChild(overlay);
        overlay.querySelector('#dev-stu-close').onclick = function () { overlay.remove(); };
        overlay.addEventListener('click', function (e) { if (e.target === overlay) overlay.remove(); });

        var listEl = overlay.querySelector('#dev-stu-list');
        var statEl = overlay.querySelector('#dev-stu-stat');
        var gidInput = overlay.querySelector('#dev-stu-gid');

        // 本地勾选状态（操作中暂存，确定后写入 studentState）
        var localSelected = new Set(studentState.selected);

        function renderList(members) {
            if (!members.length) {
                listEl.innerHTML = '<div style="text-align:center;color:#888;padding:30px;font-size:11px;">暂无成员</div>';
                return;
            }
            // auth=4 是管理员/教师，auth=3 是学员，按 auth 和昵称排序
            var sorted = members.slice().sort(function (a, b) {
                if (a.auth !== b.auth) return b.auth - a.auth; // 管理员在前
                return (a.nickname || a.username).localeCompare(b.nickname || b.username);
            });
            var html = '';
            for (var i = 0; i < sorted.length; i++) {
                var m = sorted[i];
                var isTeacher = m.auth >= 4;
                var checked = localSelected.has(m.username) ? ' checked' : '';
                html += '<label style="display:flex;align-items:center;gap:8px;padding:5px 10px;border-bottom:1px dotted #ddd;cursor:pointer;font-size:11px;' +
                    (isTeacher ? 'background:#F0F4FA;' : '') + '">' +
                    '<input type="checkbox" class="dev-stu-chk" data-uname="' + esc(m.username) + '"' + checked + ' style="flex-shrink:0;">' +
                    '<span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' +
                    esc(m.nickname || m.username) +
                    (isTeacher ? ' <span style="font-size:10px;color:#0058E1;background:#E8EEF8;padding:0 3px;border-radius:2px;">教师</span>' : '') +
                    '</span>' +
                    '<span style="font-size:10px;color:#aaa;flex-shrink:0;">' + esc(m.username) + '</span>' +
                    '</label>';
            }
            listEl.innerHTML = html;

            listEl.querySelectorAll('.dev-stu-chk').forEach(function (chk) {
                chk.onchange = function () {
                    if (chk.checked) localSelected.add(chk.dataset.uname);
                    else localSelected.delete(chk.dataset.uname);
                    updateStat();
                };
            });
        }

        function updateStat() {
            var total = studentState.members.length;
            var sel = localSelected.size;
            statEl.textContent = sel ? ('已选 ' + sel + '/' + total) : ('共 ' + total + ' 人');
        }

        async function loadMembers(gidVal) {
            if (!gidVal) { alert('请输入团队 gid'); return; }
            listEl.innerHTML = '<div style="text-align:center;color:#888;padding:30px;font-size:11px;">加载中...</div>';
            try {
                var allMembers = [];
                var page = 1;
                while (true) {
                    var r = await req('/api/oj/group/get-member-list?gid=' + encodeURIComponent(gidVal)
                        + '&currentPage=' + page + '&limit=50');
                    var records = (r && r.data && r.data.records) || [];
                    var pages = Number((r && r.data && r.data.pages) || 1);
                    allMembers = allMembers.concat(records.map(function (m) {
                        return { username: m.username, nickname: m.nickname || m.username, auth: m.auth || 3 };
                    }));
                    if (page >= pages || !records.length) break;
                    page++;
                }
                studentState.members = allMembers;
                studentState.gid = gidVal;
                studentState.loaded = true;
                // 默认全选学员（auth=3），不选教师
                localSelected = new Set(allMembers.filter(function (m) { return m.auth < 4; }).map(function (m) { return m.username; }));
                renderList(allMembers);
                updateStat();
            } catch (e) {
                listEl.innerHTML = '<div style="text-align:center;color:#C00;padding:30px;font-size:11px;">加载失败: ' + esc(e.message) + '</div>';
            }
        }

        overlay.querySelector('#dev-stu-load').onclick = function () {
            loadMembers(gidInput.value.trim());
        };
        overlay.querySelector('#dev-stu-all').onclick = function () {
            localSelected = new Set(studentState.members.map(function (m) { return m.username; }));
            renderList(studentState.members);
            updateStat();
        };
        overlay.querySelector('#dev-stu-none').onclick = function () {
            localSelected = new Set();
            renderList(studentState.members);
            updateStat();
        };
        overlay.querySelector('#dev-stu-clear').onclick = function () {
            studentState.selected = new Set();
            overlay.remove();
        };
        overlay.querySelector('#dev-stu-confirm').onclick = function () {
            studentState.selected = new Set(localSelected);
            overlay.remove();
        };

        // 若已有成员数据，直接渲染
        if (studentState.loaded && studentState.members.length) {
            renderList(studentState.members);
            updateStat();
        } else if (gid) {
            loadMembers(gid);
        }
    }

    /* ============== AC 情况查看 ============== */
    async function showAcStats() {
        var f = cur();
        if (!f || !f.problem) return alert('请先选择题目');
        var displayId = f.displayId;
        var gid = f.gid || '';
        var mode = f.mode || 'training';
        var cid = f.cid || '';
        var overlay = document.createElement('div');
        overlay.className = 'dev-modal';
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:1000010;display:flex;align-items:center;justify-content:center;';
        overlay.innerHTML =
            '<div style="background:#ECE9D8;border:2px solid #fff;box-shadow:0 0 0 1px #404040,4px 4px 12px rgba(0,0,0,.4);width:620px;max-width:94vw;max-height:82vh;display:flex;flex-direction:column;">' +
            '<div style="height:24px;background:linear-gradient(to bottom,#0058E1,#3A93FF);color:#fff;font-weight:bold;padding:0 8px;display:flex;align-items:center;justify-content:space-between;font-size:12px;flex-shrink:0;">' +
            '<span>📊 本题 AC 情况 — ' + esc(displayId) + '</span>' +
            '<button id="dev-ac-stu" style="height:18px;padding:0 8px;background:rgba(255,255,255,.2);border:1px solid rgba(255,255,255,.4);color:#fff;cursor:pointer;font-size:10px;border-radius:2px;margin-right:6px;">👥 学员设置' +
            '<span id="dev-ac-stu-badge" style="display:none;margin-left:4px;background:#FFD600;color:#000;border-radius:8px;padding:0 4px;font-size:9px;font-weight:bold;"></span>' +
            '</button>' +
            '<button id="dev-ac-close" style="background:none;border:none;color:#fff;font-size:16px;cursor:pointer;padding:0 4px;">×</button>' +
            '</div>' +
            '<div style="padding:5px 8px;background:#F5F5DC;border-bottom:1px solid #ACA899;display:flex;align-items:center;gap:8px;flex-shrink:0;">' +
            '<button id="dev-ac-refresh" style="height:22px;padding:0 10px;background:#ECE9D8;border:1px solid #ACA899;cursor:pointer;font-size:11px;border-radius:2px;">⟳ 刷新</button>' +
            '<span id="dev-ac-stat" style="font-size:11px;color:#555;"></span>' +
            '<span id="dev-ac-loading" style="font-size:11px;color:#0058E1;display:none;">加载中，请稍候...</span>' +
            '</div>' +
            '<div style="flex:1;overflow:hidden;display:flex;flex-direction:row;min-height:0;">' +
            // 已AC 列
            '<div style="flex:1;display:flex;flex-direction:column;border-right:1px solid #ACA899;min-width:0;">' +
            '<div style="height:24px;background:#C8E6C9;border-bottom:1px solid #ACA899;display:flex;align-items:center;padding:0 8px;font-size:11px;font-weight:bold;color:#1B5E20;flex-shrink:0;">' +
            '✅ 已 AC <span id="dev-ac-cnt" style="margin-left:6px;font-weight:normal;color:#388E3C;"></span>' +
            '</div>' +
            '<div id="dev-ac-yes" style="flex:1;overflow-y:auto;background:#fff;"></div>' +
            '</div>' +
            // 未AC 列
            '<div style="flex:1;display:flex;flex-direction:column;min-width:0;">' +
            '<div style="height:24px;background:#FFCDD2;border-bottom:1px solid #ACA899;display:flex;align-items:center;padding:0 8px;font-size:11px;font-weight:bold;color:#B71C1C;flex-shrink:0;">' +
            '❌ 未 AC <span id="dev-nac-cnt" style="margin-left:6px;font-weight:normal;color:#C62828;"></span>' +
            '</div>' +
            '<div id="dev-ac-no" style="flex:1;overflow-y:auto;background:#fff;"></div>' +
            '</div>' +
            '</div>' +
            '</div>';

        document.body.appendChild(overlay);
        overlay.querySelector('#dev-ac-close').onclick = function () { overlay.remove(); };
        overlay.addEventListener('click', function (e) { if (e.target === overlay) overlay.remove(); });
        // 学员设置按钮
        function updateAcStuBadge() {
            var badge = overlay.querySelector('#dev-ac-stu-badge');
            if (!badge) return;
            if (studentState.selected.size) {
                badge.style.display = '';
                badge.textContent = studentState.selected.size;
            } else {
                badge.style.display = 'none';
            }
        }
        overlay.querySelector('#dev-ac-stu').onclick = function () {
            showStudentPanel();
            // 学员面板关闭后自动刷新（用 MutationObserver 监听 DOM 移除）
            var observer = new MutationObserver(function () {
                if (!document.querySelector('.dev-modal[data-stu]')) {
                    observer.disconnect();
                    updateAcStuBadge();
                    load();
                }
            });
            observer.observe(document.body, { childList: true });
        };
        updateAcStuBadge();

        var statEl = overlay.querySelector('#dev-ac-stat');
        var loadingEl = overlay.querySelector('#dev-ac-loading');
        var yesEl = overlay.querySelector('#dev-ac-yes');
        var noEl = overlay.querySelector('#dev-ac-no');
        var acCntEl = overlay.querySelector('#dev-ac-cnt');
        var nacCntEl = overlay.querySelector('#dev-ac-nac-cnt') || overlay.querySelector('#dev-nac-cnt');

        async function fetchAllSubmissions() {
            // 按用户聚合：Map<username, { nickname, hasAc, langs: Set }>
            var userMap = new Map();
            var limit = 50;

            if (mode === 'contest') {
                // ── 比赛模式：contest-submissions，problemID = displayId（字母编号）
                var page = 1;
                while (true) {
                    var url = '/api/oj/contest-submissions'
                        + '?onlyMine=false'
                        + '&problemID=' + encodeURIComponent(displayId)
                        + '&completeProblemID=true'
                        + '&contestID=' + encodeURIComponent(cid)
                        + '&beforeContestSubmit=false'
                        + '&currentPage=' + page
                        + '&limit=' + limit;
                    var r = await req(url);
                    var records = (r && r.data && r.data.records) || [];
                    var pages = Number((r && r.data && r.data.pages) || 1);

                    for (var i = 0; i < records.length; i++) {
                        var rec = records[i];
                        var uname = rec.username || rec.nickname || ('user_' + i);
                        var nick = rec.nickname || rec.username || uname;
                        var st = String(rec.status != null ? rec.status : '');
                        var isAc = (st === '0');
                        if (!userMap.has(uname)) {
                            userMap.set(uname, { nickname: nick, hasAc: false, langs: new Set() });
                        }
                        var entry = userMap.get(uname);
                        if (nick && nick !== uname) entry.nickname = nick;
                        if (isAc) entry.hasAc = true;
                        if (rec.language) entry.langs.add(rec.language);
                    }

                    if (page >= pages || !records.length) break;
                    page++;
                }
            } else {
                // ── 训练模式：get-submission-list，不限状态，拉全部
                var page2 = 1;
                while (true) {
                    var url2 = '/api/oj/get-submission-list'
                        + '?onlyMine=false'
                        + '&problemID=' + encodeURIComponent(displayId)
                        + '&completeProblemID=true'
                        + '&currentPage=' + page2
                        + '&limit=' + limit;
                    if (gid) url2 += '&gid=' + encodeURIComponent(gid);

                    var r2 = await req(url2);
                    var records2 = (r2 && r2.data && r2.data.records) || [];
                    var pages2 = Number((r2 && r2.data && r2.data.pages) || 1);

                    for (var j = 0; j < records2.length; j++) {
                        var rec2 = records2[j];
                        var uname2 = rec2.username || rec2.nickname || ('user_' + j);
                        var nick2 = rec2.nickname || rec2.username || uname2;
                        var st2 = String(rec2.status != null ? rec2.status : '');
                        var isAc2 = (st2 === '0');
                        if (!userMap.has(uname2)) {
                            userMap.set(uname2, { nickname: nick2, hasAc: false, langs: new Set() });
                        }
                        var entry2 = userMap.get(uname2);
                        if (nick2 && nick2 !== uname2) entry2.nickname = nick2;
                        if (isAc2) entry2.hasAc = true;
                        if (rec2.language) entry2.langs.add(rec2.language);
                    }

                    if (page2 >= pages2 || !records2.length) break;
                    page2++;
                }
            }

            return userMap;
        }

        function renderUserItem(entry, username) {
            var langs = entry.langs.size ? Array.from(entry.langs).join(', ') : '';
            return '<div style="padding:5px 10px;border-bottom:1px dotted #ddd;font-size:11px;display:flex;align-items:center;gap:6px;">' +
                '<span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="' + esc(username) + '">' +
                esc(entry.nickname || username) +
                '</span>' +
                (langs ? '<span style="font-size:10px;color:#888;flex-shrink:0;white-space:nowrap;">' + esc(langs) + '</span>' : '') +
                '</div>';
        }

        async function load() {
            loadingEl.style.display = '';
            statEl.textContent = '';
            yesEl.innerHTML = '<div style="text-align:center;color:#888;padding:20px;font-size:11px;">加载中...</div>';
            noEl.innerHTML = '<div style="text-align:center;color:#888;padding:20px;font-size:11px;">加载中...</div>';

            try {
                var userMap = await fetchAllSubmissions();

                var acUsers = [], nacUsers = [];
                userMap.forEach(function (entry, username) {
                    if (entry.hasAc) acUsers.push({ username: username, entry: entry });
                    else nacUsers.push({ username: username, entry: entry });
                });

                // 按昵称/用户名字母排序
                acUsers.sort(function (a, b) { return (a.entry.nickname || a.username).localeCompare(b.entry.nickname || b.username); });
                nacUsers.sort(function (a, b) { return (a.entry.nickname || a.username).localeCompare(b.entry.nickname || b.username); });

                acCntEl.textContent = acUsers.length + ' 人';
                nacCntEl.textContent = nacUsers.length + ' 人';
                statEl.textContent = '共 ' + userMap.size + ' 人提交，已AC ' + acUsers.length + ' 人，未AC ' + nacUsers.length + ' 人';

                if (acUsers.length) {
                    yesEl.innerHTML = acUsers.map(function (u) { return renderUserItem(u.entry, u.username); }).join('');
                } else {
                    yesEl.innerHTML = '<div style="text-align:center;color:#888;padding:20px;font-size:11px;">暂无</div>';
                }

                if (nacUsers.length) {
                    noEl.innerHTML = nacUsers.map(function (u) { return renderUserItem(u.entry, u.username); }).join('');
                } else {
                    noEl.innerHTML = '<div style="text-align:center;color:#888;padding:20px;font-size:11px;">暂无</div>';
                }

            } catch (e) {
                yesEl.innerHTML = '<div style="text-align:center;color:#C00;padding:20px;font-size:11px;">加载失败: ' + esc(e.message) + '</div>';
                noEl.innerHTML = '';
                statEl.textContent = '加载失败';
            } finally {
                loadingEl.style.display = 'none';
            }
        }

        overlay.querySelector('#dev-ac-refresh').onclick = load;
        load();
    }



    /* ============== 提交记录查看 ============== */
    async function showSubmissionList() {
        var f = cur();
        if (!f || !f.problem) return alert('请先选择题目');
        var displayId = f.displayId;
        var gid = f.gid || '';
        var mode = f.mode || 'training';
        var cid = f.cid || '';
        var overlay = document.createElement('div');
        overlay.className = 'dev-modal';
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:1000010;display:flex;align-items:center;justify-content:center;';
        overlay.innerHTML =
            '<div style="background:#ECE9D8;border:2px solid #fff;box-shadow:0 0 0 1px #404040,4px 4px 12px rgba(0,0,0,.4);width:760px;max-width:96vw;max-height:84vh;display:flex;flex-direction:column;">' +
            '<div style="height:24px;background:linear-gradient(to bottom,#0058E1,#3A93FF);color:#fff;font-weight:bold;padding:0 8px;display:flex;align-items:center;justify-content:space-between;font-size:12px;flex-shrink:0;">' +
            // showSubmissionList 标题栏同理：
            '<span>📝 提交记录 — ' + esc(displayId) + '</span>' +
            '<button id="dev-sub-stu" style="height:18px;padding:0 8px;background:rgba(255,255,255,.2);border:1px solid rgba(255,255,255,.4);color:#fff;cursor:pointer;font-size:10px;border-radius:2px;margin-right:6px;">👥 学员设置' +
            '<span id="dev-sub-stu-badge" style="display:none;margin-left:4px;background:#FFD600;color:#000;border-radius:8px;padding:0 4px;font-size:9px;font-weight:bold;"></span>' +
            '</button>' +
            '<button id="dev-sub-close" style="background:none;border:none;color:#fff;font-size:16px;cursor:pointer;padding:0 4px;">×</button>' +
            '</div>' +
            '<div style="padding:5px 8px;background:#F5F5DC;border-bottom:1px solid #ACA899;display:flex;align-items:center;gap:8px;flex-shrink:0;flex-wrap:wrap;">' +
            '<label style="font-size:11px;display:flex;align-items:center;gap:4px;cursor:pointer;">' +
            '<input type="checkbox" id="dev-sub-only-mine"> 仅看我的' +
            '</label>' +
            '<select id="dev-sub-status" style="height:22px;border:1px solid #7F9DB9;font-size:11px;padding:0 4px;">' +
            '<option value="">全部状态</option>' +
            '<option value="0">Accepted</option>' +
            '<option value="-1">Wrong Answer</option>' +
            '<option value="-2">Compile Error</option>' +
            '<option value="1">Time Limit Exceeded</option>' +
            '<option value="2">Memory Limit Exceeded</option>' +
            '<option value="3">Runtime Error</option>' +
            '</select>' +
            '<select id="dev-sub-lang" style="height:22px;border:1px solid #7F9DB9;font-size:11px;padding:0 4px;">' +
            '<option value="">全部语言</option>' +
            (f.languages || ['C++ With O2', 'C++', 'Python3', 'Java', 'C']).map(function (l) {
                return '<option value="' + esc(l) + '">' + esc(l) + '</option>';
            }).join('') +
            '</select>' +
            '<button id="dev-sub-refresh" style="height:22px;padding:0 10px;background:#ECE9D8;border:1px solid #ACA899;cursor:pointer;font-size:11px;border-radius:2px;">⟳ 刷新</button>' +
            '<span id="dev-sub-stat" style="font-size:11px;color:#555;margin-left:4px;"></span>' +
            // 分页
            '<span style="margin-left:auto;display:flex;align-items:center;gap:4px;">' +
            '<button id="dev-sub-prev" style="height:22px;padding:0 8px;background:#ECE9D8;border:1px solid #ACA899;cursor:pointer;font-size:11px;border-radius:2px;">◀</button>' +
            '<span id="dev-sub-page-label" style="font-size:11px;color:#555;">第 1 页</span>' +
            '<button id="dev-sub-next" style="height:22px;padding:0 8px;background:#ECE9D8;border:1px solid #ACA899;cursor:pointer;font-size:11px;border-radius:2px;">▶</button>' +
            '</span>' +
            '</div>' +
            '<div id="dev-sub-list" style="flex:1;overflow-y:auto;background:#fff;min-height:200px;">' +
            '<div style="text-align:center;color:#888;padding:30px;font-size:12px;">加载中...</div>' +
            '</div>' +
            // 测试点展开区
            '<div id="dev-sub-detail-wrap" style="display:none;border-top:1px solid #ACA899;flex-shrink:0;">' +
            '<div style="height:22px;background:#D4D0C8;border-bottom:1px solid #ACA899;display:flex;align-items:center;padding:0 8px;font-size:11px;font-weight:bold;gap:8px;">' +
            '<span id="dev-sub-detail-title">测试点详情</span>' +
            '<button id="dev-sub-detail-close" style="margin-left:auto;background:none;border:none;cursor:pointer;font-size:13px;color:#555;">×</button>' +
            '</div>' +
            '<div id="dev-sub-cases" style="padding:6px 8px;max-height:160px;overflow:auto;background:#fff;"></div>' +
            '</div>' +
            '</div>';

        document.body.appendChild(overlay);

        var listEl = overlay.querySelector('#dev-sub-list');
        var statEl = overlay.querySelector('#dev-sub-stat');
        var pageLabel = overlay.querySelector('#dev-sub-page-label');
        var detailWrap = overlay.querySelector('#dev-sub-detail-wrap');
        var detailTitle = overlay.querySelector('#dev-sub-detail-title');
        var casesEl = overlay.querySelector('#dev-sub-cases');

        var currentPage = 1;
        var totalPages = 1;

        var STATUS_MAP = {
            '-2': 'Compile Error', '-1': 'Wrong Answer', '0': 'Accepted',
            '1': 'Time Limit Exceeded', '2': 'Memory Limit Exceeded',
            '3': 'Runtime Error', '4': 'System Error', '5': 'Presentation Error',
            '6': 'Pending', '7': 'Judging', '8': 'Partial Accepted',
            '9': 'Submitting', '10': 'Submit Failed', '11': 'Pending Rejudge',
            '13': 'Rejudging', '14': 'Judging', '15': 'Queueing'
        };
        var STATUS_COLOR = {
            '0': '#0A8043', '-1': '#C00', '-2': '#7c3aed',
            '1': '#b45309', '2': '#b45309', '3': '#C00', '8': '#D97706'
        };
        var DOT_CLASS = {
            '0': 'dot-ac', '-1': 'dot-wa', '-2': 'dot-ce',
            '1': 'dot-tle', '2': 'dot-mle', '3': 'dot-re',
            '5': 'dot-pe', '8': 'dot-pa'
        };

        overlay.querySelector('#dev-sub-close').onclick = function () { overlay.remove(); };
        overlay.querySelector('#dev-sub-detail-close').onclick = function () { detailWrap.style.display = 'none'; };
        overlay.addEventListener('click', function (e) { if (e.target === overlay) overlay.remove(); });

        async function loadList(page) {
            currentPage = page || 1;
            listEl.innerHTML = '<div style="text-align:center;color:#888;padding:30px;font-size:12px;">加载中...</div>';
            statEl.textContent = '';
            detailWrap.style.display = 'none';

            var onlyMine = overlay.querySelector('#dev-sub-only-mine').checked;
            var status = overlay.querySelector('#dev-sub-status').value;
            var lang = overlay.querySelector('#dev-sub-lang').value;

            try {
                // 根据模式选择接口
                var url;
                if (mode === 'contest') {
                    url = '/api/oj/contest-submissions'
                        + '?onlyMine=' + onlyMine
                        + '&problemID=' + encodeURIComponent(displayId)
                        + '&completeProblemID=true'
                        + '&contestID=' + encodeURIComponent(cid)
                        + '&beforeContestSubmit=false'
                        + '&currentPage=' + currentPage
                        + '&limit=20';
                    if (status !== '') url += '&status=' + encodeURIComponent(status);
                    if (lang) url += '&language=' + encodeURIComponent(lang);
                } else {
                    url = '/api/oj/get-submission-list'
                        + '?onlyMine=' + onlyMine
                        + '&problemID=' + encodeURIComponent(displayId)
                        + '&completeProblemID=true'
                        + '&currentPage=' + currentPage
                        + '&limit=20';
                    if (status !== '') url += '&status=' + encodeURIComponent(status);
                    if (lang) url += '&language=' + encodeURIComponent(lang);
                    if (gid) url += '&gid=' + encodeURIComponent(gid);
                }


                var r = await req(url);
                var data = (r && r.data) || {};
                var records = data.records || [];
                totalPages = data.pages || 1;
                var total = data.total || records.length;

                statEl.textContent = '共 ' + total + ' 条，第 ' + currentPage + '/' + totalPages + ' 页';
                pageLabel.textContent = '第 ' + currentPage + ' 页';

                if (!records.length) {
                    listEl.innerHTML = '<div style="text-align:center;color:#888;padding:30px;font-size:12px;">暂无提交记录</div>';
                    return;
                }

                var html = '<table style="width:100%;border-collapse:collapse;font-size:11px;">' +
                    '<thead><tr style="background:#E8EEF8;position:sticky;top:0;">' +
                    '<th style="padding:4px 8px;border:1px solid #ACA899;text-align:left;white-space:nowrap;">提交 ID</th>' +
                    '<th style="padding:4px 8px;border:1px solid #ACA899;text-align:left;">用户</th>' +
                    '<th style="padding:4px 8px;border:1px solid #ACA899;text-align:left;">状态</th>' +
                    '<th style="padding:4px 8px;border:1px solid #ACA899;text-align:left;">语言</th>' +
                    '<th style="padding:4px 8px;border:1px solid #ACA899;text-align:right;">耗时</th>' +
                    '<th style="padding:4px 8px;border:1px solid #ACA899;text-align:right;">内存</th>' +
                    '<th style="padding:4px 8px;border:1px solid #ACA899;text-align:right;">分数</th>' +
                    '<th style="padding:4px 8px;border:1px solid #ACA899;text-align:left;white-space:nowrap;">提交时间</th>' +
                    '<th style="padding:4px 8px;border:1px solid #ACA899;text-align:center;">测试点</th>' +
                    '</tr></thead><tbody>';

                for (var i = 0; i < records.length; i++) {
                    var rec = records[i];
                    var st = String(rec.status != null ? rec.status : '');
                    var stLabel = STATUS_MAP[st] || ('状态' + st);
                    var stColor = STATUS_COLOR[st] || '#444';
                    var memMB = rec.memory != null ? (rec.memory / 1024).toFixed(1) + 'MB' : '-';
                    var timeStr = rec.time != null ? rec.time + 'ms' : '-';
                    var scoreStr = rec.score != null ? String(rec.score) : '-';
                    var rawUname = rec.username || ''; var username = esc(getDisplayName(rawUname, rec.nickname || rec.username) || '匿名');
                    var submitTime = rec.submitTime ? new Date(rec.submitTime).toLocaleString('zh-CN', { hour12: false }) : '-';
                    var rowBg = i % 2 === 0 ? '' : 'background:#F5F8FF;';
                    html += '<tr style="' + rowBg + '">' +
                        '<td style="padding:3px 8px;border:1px solid #E0E0E0;font-family:Courier New;color:#0058E1;white-space:nowrap;">' + esc(String(rec.submitId || '')) + '</td>' +
                        '<td style="padding:3px 8px;border:1px solid #E0E0E0;">' + username + '</td>' +
                        '<td style="padding:3px 8px;border:1px solid #E0E0E0;font-weight:bold;white-space:nowrap;" style="color:' + stColor + ';">' +
                        '<span style="color:' + stColor + ';">' + esc(stLabel) + '</span></td>' +
                        '<td style="padding:3px 8px;border:1px solid #E0E0E0;white-space:nowrap;">' + esc(rec.language || '-') + '</td>' +
                        '<td style="padding:3px 8px;border:1px solid #E0E0E0;text-align:right;">' + esc(timeStr) + '</td>' +
                        '<td style="padding:3px 8px;border:1px solid #E0E0E0;text-align:right;">' + esc(memMB) + '</td>' +
                        '<td style="padding:3px 8px;border:1px solid #E0E0E0;text-align:right;">' + esc(scoreStr) + '</td>' +
                        '<td style="padding:3px 8px;border:1px solid #E0E0E0;white-space:nowrap;font-size:10px;">' + esc(submitTime) + '</td>' +
                        '<td style="padding:3px 8px;border:1px solid #E0E0E0;text-align:center;">' +
                        '<button class="dev-sub-case-btn" data-sid="' + esc(String(rec.submitId || '')) + '" data-user="' + username + '" data-st="' + esc(stLabel) + '" data-lang="' + esc(rec.language || '') + '" ' +
                        'style="height:18px;padding:0 8px;background:#ECE9D8;border:1px solid #ACA899;cursor:pointer;font-size:10px;border-radius:2px;">详情</button>' +
                        '</td>' +
                        '</tr>';
                }
                html += '</tbody></table>';
                listEl.innerHTML = html;

                // 绑定测试点详情按钮
                // 绑定测试点详情按钮
                listEl.querySelectorAll('.dev-sub-case-btn').forEach(function (btn) {
                    btn.onclick = async function () {
                        var sid = btn.dataset.sid;
                        var user = btn.dataset.user;
                        var stText = btn.dataset.st;
                        btn.disabled = true; btn.textContent = '加载...';
                        try {
                            // 并行拉取测试点 + 提交详情（含代码）
                            var results = await Promise.allSettled([
                                req('/api/oj/get-all-case-result?submitId=' + encodeURIComponent(sid)),
                                req('/api/oj/get-submission-detail?submitId=' + encodeURIComponent(sid))
                            ]);

                            var cases = [];
                            if (results[0].status === 'fulfilled') {
                                cases = (results[0].value && results[0].value.data && results[0].value.data.judgeCaseList) || [];
                            }

                            var subDetail = {};
                            if (results[1].status === 'fulfilled') {
                                subDetail = (results[1].value && results[1].value.data && results[1].value.data.submission) || {};
                            }
                            var code = subDetail.code || '';
                            var subLang = subDetail.language || btn.dataset.lang || '';

                            detailTitle.textContent = '详情 — ' + user + ' (' + stText + ') #' + sid;

                            var detailHtml = '';

                            // ── 测试点网格 ──
                            if (cases.length) {
                                var acC = 0;
                                detailHtml += '<div class="dev-result-cases-grid" style="display:flex;flex-wrap:wrap;gap:3px;margin-bottom:4px;">';
                                for (var ci = 0; ci < cases.length; ci++) {
                                    var c = cases[ci];
                                    var cs = String(c.status != null ? c.status : '');
                                    if (cs === '0') acC++;
                                    var dc = DOT_CLASS[cs] || 'dot-pending';
                                    var ctime = c.time != null ? c.time + 'ms' : '-';
                                    var cmem = c.memory != null ? c.memory + 'KB' : '-';
                                    var cseq = c.seq != null ? c.seq : (ci + 1);
                                    detailHtml += '<div class="dev-case-dot ' + dc + '" title="#' + esc(cseq) + ' ' + esc(STATUS_MAP[cs] || cs) + '  ' + esc(ctime) + '  ' + esc(cmem) + '">' + esc(cseq) + '</div>';
                                }
                                detailHtml += '</div>';
                                detailHtml += '<div style="font-size:10px;color:#888;margin-bottom:6px;">' + acC + ' / ' + cases.length + ' 测试点通过</div>';
                            } else {
                                detailHtml += '<div style="font-size:11px;color:#888;margin-bottom:6px;">无测试点数据</div>';
                            }

                            // ── 代码区 ──
                            if (code) {
                                detailHtml +=
                                    '<div style="border:1px solid #ACA899;border-radius:2px;overflow:hidden;">' +
                                    '<div style="height:22px;background:#D4D0C8;border-bottom:1px solid #ACA899;display:flex;align-items:center;padding:0 8px;font-size:11px;font-weight:bold;gap:6px;">' +
                                    '<span>代码' + (subLang ? ' — ' + esc(subLang) : '') + '</span>' +
                                    '<button id="dev-sub-copy-' + esc(sid) + '" style="height:18px;padding:0 8px;background:#ECE9D8;border:1px solid #ACA899;cursor:pointer;font-size:10px;border-radius:2px;margin-left:auto;">📋 复制</button>' +
                                    '<button id="dev-sub-load-' + esc(sid) + '" style="height:18px;padding:0 8px;background:#0A8043;color:#fff;border:1px solid #0A8043;cursor:pointer;font-size:10px;border-radius:2px;font-weight:bold;">⬇ 载入编辑器</button>' +
                                    '</div>' +
                                    '<pre id="dev-sub-codepre-' + esc(sid) + '" style="max-height:200px;overflow:auto;margin:0;padding:8px 10px;font-family:Courier New,Consolas,monospace;font-size:11px;background:#FFFBE6;white-space:pre-wrap;word-break:break-all;">' + esc(code) + '</pre>' +
                                    '</div>';
                            } else {
                                detailHtml += '<div style="font-size:11px;color:#888;padding:4px 0;">该提交代码不公开或无法获取</div>';
                            }

                            casesEl.innerHTML = detailHtml;
                            detailWrap.style.display = '';

                            // 绑定复制
                            var copyBtn = casesEl.querySelector('#dev-sub-copy-' + sid);
                            if (copyBtn && code) {
                                copyBtn.onclick = function () {
                                    navigator.clipboard.writeText(code).then(function () {
                                        copyBtn.textContent = '✓ 已复制';
                                        setTimeout(function () { copyBtn.textContent = '📋 复制'; }, 1500);
                                    }).catch(function () { alert('复制失败，请手动选中代码复制'); });
                                };
                            }

                            // 绑定载入编辑器
                            var loadBtn = casesEl.querySelector('#dev-sub-load-' + sid);
                            if (loadBtn && code) {
                                loadBtn.onclick = function () {
                                    if (!confirm('将用此代码覆盖当前编辑器内容，确定？')) return;
                                    codeEl.value = code;
                                    var fc = cur(); if (fc) fc.code = code;
                                    refreshHighlight(); refreshGutter();
                                    out('代码已载入（来源：' + user + '）', 'ok');
                                    overlay.remove();
                                };
                            }

                        } catch (e) {
                            casesEl.innerHTML = '<div style="color:#C00;font-size:11px;padding:8px;">加载失败: ' + esc(e.message) + '</div>';
                            detailWrap.style.display = '';
                        }
                        btn.disabled = false; btn.textContent = '详情';
                    };
                });


            } catch (e) {
                listEl.innerHTML = '<div style="text-align:center;color:#C00;padding:30px;font-size:12px;">加载失败: ' + esc(e.message) + '</div>';
            }
        }

        overlay.querySelector('#dev-sub-refresh').onclick = function () { loadList(1); };
        overlay.querySelector('#dev-sub-only-mine').onchange = function () { loadList(1); };
        overlay.querySelector('#dev-sub-status').onchange = function () { loadList(1); };
        overlay.querySelector('#dev-sub-lang').onchange = function () { loadList(1); };
        overlay.querySelector('#dev-sub-prev').onclick = function () { if (currentPage > 1) loadList(currentPage - 1); };
        overlay.querySelector('#dev-sub-next').onclick = function () { if (currentPage < totalPages) loadList(currentPage + 1); };

        loadList(1);
    }
    /* ============== 学员管理全局状态 ============== */
    // 备注名持久化：存在 localStorage 的 __devhoj_remarks，结构为 { [username]: remark }
    function loadRemarks() {
        return LS.get('remarks') || {};
    }
    function saveRemarks(remarks) {
        LS.set('remarks', remarks);
    }
    function getDisplayName(username, nickname) {
        var remarks = loadRemarks();
        return remarks[username] || nickname || username;
    }

    var studentState = {
        members: [],          // 全部成员 { username, nickname, auth }
        selected: new Set(),  // 勾选的 username 集合（空 = 不过滤）
        gid: '',
        loaded: false
    };


    /* ============== 通用代码查看弹窗 ============== */
    function showCodeViewer(code, lang, title) {
        var m = document.createElement('div');
        m.className = 'dev-modal';
        m.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.35);z-index:1000020;display:flex;align-items:center;justify-content:center;';
        m.innerHTML =
            '<div style="background:#ECE9D8;border:2px solid #fff;box-shadow:0 0 0 1px #404040,4px 4px 12px rgba(0,0,0,.4);width:700px;max-width:96vw;max-height:84vh;display:flex;flex-direction:column;">' +
            '<div style="height:24px;background:linear-gradient(to bottom,#0058E1,#3A93FF);color:#fff;font-weight:bold;padding:0 8px;display:flex;align-items:center;justify-content:space-between;font-size:12px;flex-shrink:0;">' +
            '<span>' + esc(title || '代码查看') + (lang ? ' — ' + esc(lang) : '') + '</span>' +
            '<div style="display:flex;gap:6px;align-items:center;">' +
            '<button id="dev-cv-copy" style="height:18px;padding:0 8px;background:rgba(255,255,255,.2);border:1px solid rgba(255,255,255,.4);color:#fff;cursor:pointer;font-size:10px;border-radius:2px;">📋 复制</button>' +
            '<button id="dev-cv-load" style="height:18px;padding:0 8px;background:#0A8043;border:1px solid #0A8043;color:#fff;cursor:pointer;font-size:10px;border-radius:2px;font-weight:bold;">⬇ 载入编辑器</button>' +
            '<button id="dev-cv-close" style="background:none;border:none;color:#fff;font-size:16px;cursor:pointer;padding:0 4px;">×</button>' +
            '</div>' +
            '</div>' +
            '<pre style="flex:1;overflow:auto;margin:0;padding:10px 12px;font-family:\'Courier New\',Consolas,monospace;font-size:12px;background:#FFFBE6;white-space:pre-wrap;word-break:break-all;line-height:1.5;">' + esc(code) + '</pre>' +
            '</div>';
        document.body.appendChild(m);
        m.querySelector('#dev-cv-close').onclick = function () { m.remove(); };
        m.addEventListener('click', function (e) { if (e.target === m) m.remove(); });
        m.querySelector('#dev-cv-copy').onclick = function () {
            var btn = m.querySelector('#dev-cv-copy');
            navigator.clipboard.writeText(code).then(function () {
                btn.textContent = '✓ 已复制';
                setTimeout(function () { btn.textContent = '📋 复制'; }, 1500);
            }).catch(function () { alert('复制失败，请手动选中代码复制'); });
        };
        m.querySelector('#dev-cv-load').onclick = function () {
            if (!confirm('将用此代码覆盖当前编辑器内容，确定？')) return;
            codeEl.value = code;
            var fc = cur(); if (fc) fc.code = code;
            refreshHighlight(); refreshGutter();
            out('代码已载入', 'ok');
            m.remove();
        };
    }

    /* ============== 学员设置面板 ============== */
    function showStudentPanel(onClose) {
        // 优先用题单的 gid，其次用当前文件的 gid
        var currentGid = String(problemListState.gid || (cur() && cur().gid) || '');

        // 若 gid 和上次加载的不同，清除旧数据强制重新加载
        if (currentGid && currentGid !== studentState.gid) {
            studentState.members = [];
            studentState.loaded = false;
            studentState.gid = '';
        }

        var overlay = document.createElement('div');
        overlay.className = 'dev-modal';
        overlay.dataset.stu = '1';
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:1000015;display:flex;align-items:center;justify-content:center;';
        overlay.innerHTML =
            '<div style="background:#ECE9D8;border:2px solid #fff;box-shadow:0 0 0 1px #404040,4px 4px 12px rgba(0,0,0,.4);width:420px;max-width:96vw;max-height:82vh;display:flex;flex-direction:column;">' +
            '<div style="height:24px;background:linear-gradient(to bottom,#0058E1,#3A93FF);color:#fff;font-weight:bold;padding:0 8px;display:flex;align-items:center;justify-content:space-between;font-size:12px;flex-shrink:0;">' +
            '<span>👥 学员设置</span>' +
            '<button id="dev-stu-close" style="background:none;border:none;color:#fff;font-size:16px;cursor:pointer;padding:0 4px;">×</button>' +
            '</div>' +
            // 状态栏：显示当前团队 gid + 刷新按钮
            '<div style="padding:4px 8px;background:#F5F5DC;border-bottom:1px solid #ACA899;display:flex;align-items:center;gap:6px;flex-shrink:0;flex-wrap:wrap;">' +
            '<span style="font-size:11px;color:#555;">团队：</span>' +
            '<span id="dev-stu-gid-label" style="font-size:11px;color:#0058E1;font-weight:bold;font-family:Courier New;">' +
            (currentGid ? esc(currentGid) : '<span style="color:#C00;">未加载题单</span>') +
            '</span>' +
            '<button id="dev-stu-reload" style="height:22px;padding:0 8px;background:#0A8043;color:#fff;border:1px solid #0A8043;cursor:pointer;font-size:11px;border-radius:2px;font-weight:bold;margin-left:4px;">⟳ 刷新</button>' +
            '<button id="dev-stu-all" style="height:22px;padding:0 8px;background:#ECE9D8;border:1px solid #ACA899;cursor:pointer;font-size:11px;border-radius:2px;">全选</button>' +
            '<button id="dev-stu-none" style="height:22px;padding:0 8px;background:#ECE9D8;border:1px solid #ACA899;cursor:pointer;font-size:11px;border-radius:2px;">全不选</button>' +
            '<span id="dev-stu-stat" style="font-size:11px;color:#555;margin-left:2px;"></span>' +
            '</div>' +
            // 列表头
            '<div style="display:flex;align-items:center;background:#E8EEF8;border-bottom:1px solid #ACA899;padding:3px 10px;font-size:10px;color:#555;flex-shrink:0;gap:0;">' +
            '<span style="width:18px;flex-shrink:0;"></span>' +
            '<span style="flex:1;min-width:0;padding-left:6px;">昵称 / 用户名</span>' +
            '<span style="width:110px;flex-shrink:0;text-align:left;padding-left:4px;">备注名</span>' +
            '</div>' +
            '<div id="dev-stu-list" style="flex:1;overflow-y:auto;background:#fff;">' +
            '<div style="text-align:center;color:#888;padding:30px;font-size:11px;">' +
            (currentGid ? '加载中...' : '请先加载题单（需要团队 gid）') +
            '</div>' +
            '</div>' +
            '<div style="padding:6px 8px;background:#F5F5DC;border-top:1px solid #ACA899;display:flex;justify-content:space-between;align-items:center;gap:6px;flex-shrink:0;">' +
            '<button id="dev-stu-clear-remarks" style="height:26px;padding:0 10px;background:#ECE9D8;border:1px solid #ACA899;cursor:pointer;font-size:11px;border-radius:2px;">清除所有备注</button>' +
            '<div style="display:flex;gap:6px;">' +
            '<button id="dev-stu-clear" style="height:26px;padding:0 12px;background:#ECE9D8;border:1px solid #ACA899;cursor:pointer;font-size:11px;border-radius:2px;">清除过滤</button>' +
            '<button id="dev-stu-confirm" style="height:26px;padding:0 14px;background:#0058E1;color:#fff;border:1px solid #0058E1;cursor:pointer;font-size:11px;border-radius:2px;font-weight:bold;">确定</button>' +
            '</div>' +
            '</div>' +
            '</div>';

        document.body.appendChild(overlay);

        var listEl = overlay.querySelector('#dev-stu-list');
        var statEl = overlay.querySelector('#dev-stu-stat');
        var localSelected = new Set(studentState.selected);
        var localRemarks = Object.assign({}, loadRemarks());

        function closePanel() {
            overlay.remove();
            if (typeof onClose === 'function') onClose();
        }

        overlay.querySelector('#dev-stu-close').onclick = closePanel;
        overlay.addEventListener('click', function (e) { if (e.target === overlay) closePanel(); });

        function renderList(members) {
            if (!members.length) {
                listEl.innerHTML = '<div style="text-align:center;color:#888;padding:30px;font-size:11px;">暂无成员</div>';
                return;
            }
            var sorted = members.slice().sort(function (a, b) {
                if (a.auth !== b.auth) return b.auth - a.auth;
                return (a.nickname || a.username).localeCompare(b.nickname || b.username);
            });
            var html = '';
            for (var i = 0; i < sorted.length; i++) {
                var mbr = sorted[i];
                var isTeacher = mbr.auth >= 4;
                var checked = localSelected.has(mbr.username) ? ' checked' : '';
                var remark = localRemarks[mbr.username] || '';
                html += '<div class="dev-stu-row" style="display:flex;align-items:center;gap:0;padding:4px 10px;border-bottom:1px dotted #ddd;font-size:11px;' +
                    (isTeacher ? 'background:#F0F4FA;' : '') + '">' +
                    '<input type="checkbox" class="dev-stu-chk" data-uname="' + esc(mbr.username) + '"' + checked + ' style="flex-shrink:0;margin-right:6px;">' +
                    '<span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="' + esc(mbr.username) + '">' +
                    esc(mbr.nickname || mbr.username) +
                    (isTeacher ? ' <span style="font-size:10px;color:#0058E1;background:#E8EEF8;padding:0 3px;border-radius:2px;">教师</span>' : '') +
                    '<span style="font-size:10px;color:#bbb;margin-left:4px;">@' + esc(mbr.username) + '</span>' +
                    '</span>' +
                    '<input type="text" class="dev-stu-remark" data-uname="' + esc(mbr.username) + '" value="' + esc(remark) + '" placeholder="备注名" ' +
                    'style="width:106px;flex-shrink:0;height:20px;border:1px solid #C0C0C0;font-size:11px;padding:0 4px;box-sizing:border-box;margin-left:6px;font-family:inherit;background:#FFFBE6;border-radius:2px;">' +
                    '</div>';
            }
            listEl.innerHTML = html;

            listEl.querySelectorAll('.dev-stu-chk').forEach(function (chk) {
                chk.onchange = function () {
                    if (chk.checked) localSelected.add(chk.dataset.uname);
                    else localSelected.delete(chk.dataset.uname);
                    updateStat();
                };
            });
            listEl.querySelectorAll('.dev-stu-remark').forEach(function (inp) {
                inp.oninput = function () {
                    var val = inp.value.trim();
                    if (val) localRemarks[inp.dataset.uname] = val;
                    else delete localRemarks[inp.dataset.uname];
                };
                inp.onclick = function (e) { e.stopPropagation(); };
            });
        }

        function updateStat() {
            var total = studentState.members.length;
            var sel = localSelected.size;
            statEl.textContent = sel ? ('已选 ' + sel + '/' + total) : ('共 ' + total + ' 人');
        }

        async function loadMembers(gidVal) {
            if (!gidVal) {
                listEl.innerHTML = '<div style="text-align:center;color:#C00;padding:30px;font-size:11px;">当前题单无团队 gid，请先加载团队训练/比赛题单</div>';
                return;
            }
            listEl.innerHTML = '<div style="text-align:center;color:#888;padding:30px;font-size:11px;">加载中...</div>';
            try {
                var allMembers = [];
                var page = 1;
                while (true) {
                    var r = await req('/api/oj/group/get-member-list?gid=' + encodeURIComponent(gidVal) + '&currentPage=' + page + '&limit=50');
                    var recs = (r && r.data && r.data.records) || [];
                    var pages = Number((r && r.data && r.data.pages) || 1);
                    allMembers = allMembers.concat(recs.map(function (mbr) {
                        return { username: mbr.username, nickname: mbr.nickname || mbr.username, auth: mbr.auth || 3 };
                    }));
                    if (page >= pages || !recs.length) break;
                    page++;
                }
                studentState.members = allMembers;
                studentState.gid = gidVal;
                studentState.loaded = true;
                // 若是全新加载（本地没有勾选记录），默认全选学员（auth<4）
                if (localSelected.size === 0) {
                    localSelected = new Set(allMembers.filter(function (mbr) { return mbr.auth < 4; }).map(function (mbr) { return mbr.username; }));
                }
                renderList(allMembers);
                updateStat();
            } catch (e) {
                listEl.innerHTML = '<div style="text-align:center;color:#C00;padding:30px;font-size:11px;">加载失败: ' + esc(e.message) + '</div>';
            }
        }

        // 刷新按钮：强制重新拉取
        overlay.querySelector('#dev-stu-reload').onclick = function () {
            var latestGid = String(problemListState.gid || (cur() && cur().gid) || '');
            // 更新顶部 gid 显示
            var labelEl = overlay.querySelector('#dev-stu-gid-label');
            if (labelEl) labelEl.textContent = latestGid || '未加载题单';
            studentState.loaded = false;
            loadMembers(latestGid);
        };
        overlay.querySelector('#dev-stu-all').onclick = function () {
            localSelected = new Set(studentState.members.map(function (mbr) { return mbr.username; }));
            renderList(studentState.members);
            updateStat();
        };
        overlay.querySelector('#dev-stu-none').onclick = function () {
            localSelected = new Set();
            renderList(studentState.members);
            updateStat();
        };
        overlay.querySelector('#dev-stu-clear-remarks').onclick = function () {
            if (!confirm('确定清除所有备注名？')) return;
            localRemarks = {};
            renderList(studentState.members);
        };
        overlay.querySelector('#dev-stu-clear').onclick = function () {
            studentState.selected = new Set();
            saveRemarks(localRemarks);
            closePanel();
        };
        overlay.querySelector('#dev-stu-confirm').onclick = function () {
            studentState.selected = new Set(localSelected);
            saveRemarks(localRemarks);
            closePanel();
        };

        // 打开时自动加载
        if (studentState.loaded && studentState.members.length) {
            // 已有数据，直接渲染（gid 相同时已在函数开头保留，不同时已清除）
            renderList(studentState.members);
            updateStat();
        } else if (currentGid) {
            loadMembers(currentGid);
        }
        // 若 currentGid 为空，列表保持"请先加载题单"的提示
    }



    /* ============== AC 情况查看 ============== */
    async function showAcStats() {
        var f = cur();
        if (!f || !f.problem) return alert('请先选择题目');
        var displayId = f.displayId;
        var gid = f.gid || '';
        var mode = f.mode || 'training';
        var cid = f.cid || '';

        var overlay = document.createElement('div');
        overlay.className = 'dev-modal';
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:1000010;display:flex;align-items:center;justify-content:center;';
        overlay.innerHTML =
            '<div style="background:#ECE9D8;border:2px solid #fff;box-shadow:0 0 0 1px #404040,4px 4px 12px rgba(0,0,0,.4);width:620px;max-width:94vw;max-height:82vh;display:flex;flex-direction:column;">' +
            '<div style="height:24px;background:linear-gradient(to bottom,#0058E1,#3A93FF);color:#fff;font-weight:bold;padding:0 8px;display:flex;align-items:center;justify-content:space-between;font-size:12px;flex-shrink:0;">' +
            '<span>📊 本题 AC 情况 — ' + esc(displayId) + '</span>' +
            '<div style="display:flex;align-items:center;gap:4px;">' +
            '<button id="dev-ac-stu" style="height:18px;padding:0 8px;background:rgba(255,255,255,.2);border:1px solid rgba(255,255,255,.4);color:#fff;cursor:pointer;font-size:10px;border-radius:2px;">👥 学员设置<span id="dev-ac-stu-badge" style="display:none;margin-left:4px;background:#FFD600;color:#000;border-radius:8px;padding:0 4px;font-size:9px;font-weight:bold;"></span></button>' +
            '<button id="dev-ac-close" style="background:none;border:none;color:#fff;font-size:16px;cursor:pointer;padding:0 4px;">×</button>' +
            '</div>' +
            '</div>' +
            '<div style="padding:5px 8px;background:#F5F5DC;border-bottom:1px solid #ACA899;display:flex;align-items:center;gap:8px;flex-shrink:0;">' +
            '<button id="dev-ac-refresh" style="height:22px;padding:0 10px;background:#ECE9D8;border:1px solid #ACA899;cursor:pointer;font-size:11px;border-radius:2px;">⟳ 刷新</button>' +
            '<span id="dev-ac-stat" style="font-size:11px;color:#555;"></span>' +
            '<span id="dev-ac-loading" style="font-size:11px;color:#0058E1;display:none;">加载中，请稍候...</span>' +
            '</div>' +
            '<div style="flex:1;overflow:hidden;display:flex;flex-direction:row;min-height:0;">' +
            '<div style="flex:1;display:flex;flex-direction:column;border-right:1px solid #ACA899;min-width:0;">' +
            '<div style="height:24px;background:#C8E6C9;border-bottom:1px solid #ACA899;display:flex;align-items:center;padding:0 8px;font-size:11px;font-weight:bold;color:#1B5E20;flex-shrink:0;">' +
            '✅ 已 AC <span id="dev-ac-yes-cnt" style="margin-left:6px;font-weight:normal;color:#388E3C;"></span>' +
            '</div>' +
            '<div id="dev-ac-yes" style="flex:1;overflow-y:auto;background:#fff;"></div>' +
            '</div>' +
            '<div style="flex:1;display:flex;flex-direction:column;min-width:0;">' +
            '<div style="height:24px;background:#FFCDD2;border-bottom:1px solid #ACA899;display:flex;align-items:center;padding:0 8px;font-size:11px;font-weight:bold;color:#B71C1C;flex-shrink:0;">' +
            '❌ 未 AC <span id="dev-ac-no-cnt" style="margin-left:6px;font-weight:normal;color:#C62828;"></span>' +
            '</div>' +
            '<div id="dev-ac-no" style="flex:1;overflow-y:auto;background:#fff;"></div>' +
            '</div>' +
            '</div>' +
            '</div>';

        document.body.appendChild(overlay);
        overlay.querySelector('#dev-ac-close').onclick = function () { overlay.remove(); };
        overlay.addEventListener('click', function (e) { if (e.target === overlay) overlay.remove(); });

        var statEl = overlay.querySelector('#dev-ac-stat');
        var loadingEl = overlay.querySelector('#dev-ac-loading');
        var yesEl = overlay.querySelector('#dev-ac-yes');
        var noEl = overlay.querySelector('#dev-ac-no');
        var yesCntEl = overlay.querySelector('#dev-ac-yes-cnt');
        var noCntEl = overlay.querySelector('#dev-ac-no-cnt');

        function updateAcStuBadge() {
            var badge = overlay.querySelector('#dev-ac-stu-badge');
            if (!badge) return;
            if (studentState.selected.size) {
                badge.style.display = '';
                badge.textContent = studentState.selected.size;
            } else {
                badge.style.display = 'none';
            }
        }

        overlay.querySelector('#dev-ac-stu').onclick = function () {
            showStudentPanel(function () {
                updateAcStuBadge();
                load();
            });
        };
        updateAcStuBadge();

        async function fetchAllSubmissions() {
            var userMap = new Map();
            var limit = 50;
            if (mode === 'contest') {
                var page = 1;
                while (true) {
                    var url = '/api/oj/contest-submissions?onlyMine=false&problemID=' + encodeURIComponent(displayId) +
                        '&completeProblemID=true&contestID=' + encodeURIComponent(cid) +
                        '&beforeContestSubmit=false&currentPage=' + page + '&limit=' + limit;
                    var r = await req(url);
                    var recs = (r && r.data && r.data.records) || [];
                    var pages = Number((r && r.data && r.data.pages) || 1);
                    for (var i = 0; i < recs.length; i++) {
                        var rec = recs[i];
                        var uname = rec.username || ('user_' + i);
                        var nick = rec.nickname || rec.username || uname;
                        var isAc = String(rec.status) === '0';
                        if (!userMap.has(uname)) userMap.set(uname, { nickname: nick, hasAc: false, langs: new Set() });
                        var entry = userMap.get(uname);
                        if (nick && nick !== uname) entry.nickname = nick;
                        if (isAc) entry.hasAc = true;
                        if (rec.language) entry.langs.add(rec.language);
                    }
                    if (page >= pages || !recs.length) break;
                    page++;
                }
            } else {
                var page2 = 1;
                while (true) {
                    var url2 = '/api/oj/get-submission-list?onlyMine=false&problemID=' + encodeURIComponent(displayId) +
                        '&completeProblemID=true&currentPage=' + page2 + '&limit=' + limit;
                    if (gid) url2 += '&gid=' + encodeURIComponent(gid);
                    var r2 = await req(url2);
                    var recs2 = (r2 && r2.data && r2.data.records) || [];
                    var pages2 = Number((r2 && r2.data && r2.data.pages) || 1);
                    for (var j = 0; j < recs2.length; j++) {
                        var rec2 = recs2[j];
                        var uname2 = rec2.username || ('user_' + j);
                        var nick2 = rec2.nickname || rec2.username || uname2;
                        var isAc2 = String(rec2.status) === '0';
                        if (!userMap.has(uname2)) userMap.set(uname2, { nickname: nick2, hasAc: false, langs: new Set() });
                        var entry2 = userMap.get(uname2);
                        if (nick2 && nick2 !== uname2) entry2.nickname = nick2;
                        if (isAc2) entry2.hasAc = true;
                        if (rec2.language) entry2.langs.add(rec2.language);
                    }
                    if (page2 >= pages2 || !recs2.length) break;
                    page2++;
                }
            }
            return userMap;
        }

        function renderUserItem(entry, username, clickable) {
            var langs = entry.langs && entry.langs.size ? Array.from(entry.langs).join(', ') : '';
            var displayName = getDisplayName(username, entry.nickname);   // ← 改这里
            return '<div class="' + (clickable ? 'dev-ac-user-item' : '') + '"' +
                (clickable ? ' data-uname="' + esc(username) + '" data-nick="' + esc(displayName) + '"' : '') +
                ' style="padding:5px 10px;border-bottom:1px dotted #ddd;font-size:11px;display:flex;align-items:center;gap:6px;' +
                (entry.noSubmit ? 'color:#bbb;' : '') +
                (clickable ? 'cursor:pointer;' : '') + '">' +
                '<span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="' + esc(username) + '">' +
                esc(displayName) +
                (clickable ? '<span style="font-size:9px;color:#0A8043;opacity:.6;margin-left:4px;">查看代码</span>' : '') +
                '</span>' +
                (entry.noSubmit
                    ? '<span style="font-size:10px;color:#ccc;flex-shrink:0;">未提交</span>'
                    : (langs ? '<span style="font-size:10px;color:#888;flex-shrink:0;white-space:nowrap;">' + esc(langs) + '</span>' : '')) +
                '</div>';
        }


        async function load() {
            loadingEl.style.display = '';
            statEl.textContent = '';
            yesEl.innerHTML = '<div style="text-align:center;color:#888;padding:20px;font-size:11px;">加载中...</div>';
            noEl.innerHTML = '<div style="text-align:center;color:#888;padding:20px;font-size:11px;">加载中...</div>';

            try {
                var userMap = await fetchAllSubmissions();
                var acUsers = [], nacUsers = [];
                var hasFilter = studentState.selected.size > 0;

                if (hasFilter) {
                    studentState.selected.forEach(function (uname) {
                        var memberInfo = studentState.members.find(function (m) { return m.username === uname; });
                        var nick = (memberInfo && memberInfo.nickname) || uname;
                        if (userMap.has(uname)) {
                            var entry = userMap.get(uname);
                            if (entry.hasAc) acUsers.push({ username: uname, entry: entry });
                            else nacUsers.push({ username: uname, entry: entry });
                        } else {
                            nacUsers.push({ username: uname, entry: { nickname: nick, hasAc: false, langs: new Set(), noSubmit: true } });
                        }
                    });
                } else {
                    userMap.forEach(function (entry, uname) {
                        if (entry.hasAc) acUsers.push({ username: uname, entry: entry });
                        else nacUsers.push({ username: uname, entry: entry });
                    });
                }

                acUsers.sort(function (a, b) { return (a.entry.nickname || a.username).localeCompare(b.entry.nickname || b.username); });
                nacUsers.sort(function (a, b) { return (a.entry.nickname || a.username).localeCompare(b.entry.nickname || b.username); });

                yesCntEl.textContent = acUsers.length + ' 人';
                noCntEl.textContent = nacUsers.length + ' 人';
                statEl.textContent = hasFilter
                    ? ('过滤 ' + studentState.selected.size + ' 人，已AC ' + acUsers.length + '，未AC ' + nacUsers.length)
                    : ('共 ' + userMap.size + ' 人提交，已AC ' + acUsers.length + '，未AC ' + nacUsers.length);

                if (acUsers.length) {
                    yesEl.innerHTML = acUsers.map(function (u) { return renderUserItem(u.entry, u.username, true); }).join('');
                    yesEl.querySelectorAll('.dev-ac-user-item').forEach(function (item) {
                        item.onmouseenter = function () { item.style.background = '#E8F5E9'; };
                        item.onmouseleave = function () { item.style.background = ''; };
                        item.onclick = async function () {
                            var uname = item.dataset.uname;
                            var nick = item.dataset.nick;
                            item.style.opacity = '0.5';
                            try {
                                var acUrl;
                                if (mode === 'contest') {
                                    acUrl = '/api/oj/contest-submissions?onlyMine=false&problemID=' + encodeURIComponent(displayId) +
                                        '&completeProblemID=true&contestID=' + encodeURIComponent(cid) +
                                        '&beforeContestSubmit=false&status=0&currentPage=1&limit=5';
                                } else {
                                    acUrl = '/api/oj/get-submission-list?onlyMine=false&problemID=' + encodeURIComponent(displayId) +
                                        '&completeProblemID=true&status=0&currentPage=1&limit=20';
                                    if (gid) acUrl += '&gid=' + encodeURIComponent(gid);
                                }
                                var r = await req(acUrl);
                                var recs = (r && r.data && r.data.records) || [];
                                // 找该用户的记录
                                var match = recs.find(function (rec) { return rec.username === uname; });
                                if (!match) {
                                    // 若当前页没有，再专门用 username 参数查
                                    var acUrl2 = acUrl + '&username=' + encodeURIComponent(uname);
                                    var r2 = await req(acUrl2);
                                    var recs2 = (r2 && r2.data && r2.data.records) || [];
                                    match = recs2[0];
                                }
                                if (!match) { alert('未找到该学员的 AC 提交'); return; }
                                var dr = await req('/api/oj/get-submission-detail?submitId=' + encodeURIComponent(match.submitId));
                                var code = (dr && dr.data && dr.data.submission && dr.data.submission.code) || '';
                                if (!code) { alert('该提交代码不公开'); return; }
                                showCodeViewer(code, match.language, nick + ' — AC #' + match.submitId);
                            } catch (e) {
                                alert('获取代码失败: ' + e.message);
                            } finally {
                                item.style.opacity = '';
                            }
                        };
                    });
                } else {
                    yesEl.innerHTML = '<div style="text-align:center;color:#888;padding:20px;font-size:11px;">暂无</div>';
                }

                if (nacUsers.length) {
                    noEl.innerHTML = nacUsers.map(function (u) { return renderUserItem(u.entry, u.username, false); }).join('');
                } else {
                    noEl.innerHTML = '<div style="text-align:center;color:#888;padding:20px;font-size:11px;">暂无</div>';
                }

            } catch (e) {
                yesEl.innerHTML = '<div style="text-align:center;color:#C00;padding:20px;font-size:11px;">加载失败: ' + esc(e.message) + '</div>';
                noEl.innerHTML = '';
                statEl.textContent = '加载失败';
            } finally {
                loadingEl.style.display = 'none';
            }
        }

        overlay.querySelector('#dev-ac-refresh').onclick = load;
        load();
    }

    /* ============== 提交记录查看 ============== */
    async function showSubmissionList() {
        var f = cur();
        if (!f || !f.problem) return alert('请先选择题目');
        var displayId = f.displayId;
        var gid = f.gid || '';
        var mode = f.mode || 'training';
        var cid = f.cid || '';

        var overlay = document.createElement('div');
        overlay.className = 'dev-modal';
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:1000010;display:flex;align-items:center;justify-content:center;';
        overlay.innerHTML =
            '<div style="background:#ECE9D8;border:2px solid #fff;box-shadow:0 0 0 1px #404040,4px 4px 12px rgba(0,0,0,.4);width:780px;max-width:96vw;max-height:84vh;display:flex;flex-direction:column;">' +
            '<div style="height:24px;background:linear-gradient(to bottom,#0058E1,#3A93FF);color:#fff;font-weight:bold;padding:0 8px;display:flex;align-items:center;justify-content:space-between;font-size:12px;flex-shrink:0;">' +
            '<span>📝 提交记录 — ' + esc(displayId) + '</span>' +
            '<div style="display:flex;align-items:center;gap:4px;">' +
            '<button id="dev-sub-stu" style="height:18px;padding:0 8px;background:rgba(255,255,255,.2);border:1px solid rgba(255,255,255,.4);color:#fff;cursor:pointer;font-size:10px;border-radius:2px;">👥 学员设置<span id="dev-sub-stu-badge" style="display:none;margin-left:4px;background:#FFD600;color:#000;border-radius:8px;padding:0 4px;font-size:9px;font-weight:bold;"></span></button>' +
            '<button id="dev-sub-close" style="background:none;border:none;color:#fff;font-size:16px;cursor:pointer;padding:0 4px;">×</button>' +
            '</div>' +
            '</div>' +
            '<div style="padding:5px 8px;background:#F5F5DC;border-bottom:1px solid #ACA899;display:flex;align-items:center;gap:8px;flex-shrink:0;flex-wrap:wrap;">' +
            '<label style="font-size:11px;display:flex;align-items:center;gap:4px;cursor:pointer;">' +
            '<input type="checkbox" id="dev-sub-only-mine"> 仅看我的' +
            '</label>' +
            '<select id="dev-sub-status" style="height:22px;border:1px solid #7F9DB9;font-size:11px;padding:0 4px;">' +
            '<option value="">全部状态</option>' +
            '<option value="0">Accepted</option>' +
            '<option value="-1">Wrong Answer</option>' +
            '<option value="-2">Compile Error</option>' +
            '<option value="1">Time Limit Exceeded</option>' +
            '<option value="2">Memory Limit Exceeded</option>' +
            '<option value="3">Runtime Error</option>' +
            '</select>' +
            '<select id="dev-sub-lang" style="height:22px;border:1px solid #7F9DB9;font-size:11px;padding:0 4px;">' +
            '<option value="">全部语言</option>' +
            (f.languages || ['C++ With O2', 'C++', 'Python3', 'Java', 'C']).map(function (l) {
                return '<option value="' + esc(l) + '">' + esc(l) + '</option>';
            }).join('') +
            '</select>' +
            '<button id="dev-sub-refresh" style="height:22px;padding:0 10px;background:#ECE9D8;border:1px solid #ACA899;cursor:pointer;font-size:11px;border-radius:2px;">⟳ 刷新</button>' +
            '<span id="dev-sub-stat" style="font-size:11px;color:#555;margin-left:4px;"></span>' +
            '<span style="margin-left:auto;display:flex;align-items:center;gap:4px;">' +
            '<button id="dev-sub-prev" style="height:22px;padding:0 8px;background:#ECE9D8;border:1px solid #ACA899;cursor:pointer;font-size:11px;border-radius:2px;">◀</button>' +
            '<span id="dev-sub-page-label" style="font-size:11px;color:#555;">第 1 页</span>' +
            '<button id="dev-sub-next" style="height:22px;padding:0 8px;background:#ECE9D8;border:1px solid #ACA899;cursor:pointer;font-size:11px;border-radius:2px;">▶</button>' +
            '</span>' +
            '</div>' +
            '<div id="dev-sub-list" style="flex:1;overflow-y:auto;background:#fff;min-height:200px;">' +
            '<div style="text-align:center;color:#888;padding:30px;font-size:12px;">加载中...</div>' +
            '</div>' +
            '<div id="dev-sub-detail-wrap" style="display:none;border-top:1px solid #ACA899;flex-shrink:0;">' +
            '<div style="height:22px;background:#D4D0C8;border-bottom:1px solid #ACA899;display:flex;align-items:center;padding:0 8px;font-size:11px;font-weight:bold;gap:8px;">' +
            '<span id="dev-sub-detail-title">测试点详情</span>' +
            '<button id="dev-sub-detail-close" style="margin-left:auto;background:none;border:none;cursor:pointer;font-size:13px;color:#555;">×</button>' +
            '</div>' +
            '<div id="dev-sub-cases" style="padding:6px 8px;max-height:220px;overflow:auto;background:#fff;"></div>' +
            '</div>' +
            '</div>';

        document.body.appendChild(overlay);

        var listEl = overlay.querySelector('#dev-sub-list');
        var statEl = overlay.querySelector('#dev-sub-stat');
        var pageLabel = overlay.querySelector('#dev-sub-page-label');
        var detailWrap = overlay.querySelector('#dev-sub-detail-wrap');
        var detailTitle = overlay.querySelector('#dev-sub-detail-title');
        var casesEl = overlay.querySelector('#dev-sub-cases');
        var currentPage = 1;
        var totalPages = 1;

        var STATUS_MAP = {
            '-2': 'Compile Error', '-1': 'Wrong Answer', '0': 'Accepted',
            '1': 'Time Limit Exceeded', '2': 'Memory Limit Exceeded',
            '3': 'Runtime Error', '4': 'System Error', '5': 'Presentation Error',
            '6': 'Pending', '7': 'Judging', '8': 'Partial Accepted',
            '9': 'Submitting', '10': 'Submit Failed', '11': 'Pending Rejudge',
            '13': 'Rejudging', '14': 'Judging', '15': 'Queueing'
        };
        var STATUS_COLOR = {
            '0': '#0A8043', '-1': '#C00', '-2': '#7c3aed',
            '1': '#b45309', '2': '#b45309', '3': '#C00', '8': '#D97706'
        };
        var DOT_CLASS = {
            '0': 'dot-ac', '-1': 'dot-wa', '-2': 'dot-ce',
            '1': 'dot-tle', '2': 'dot-mle', '3': 'dot-re',
            '5': 'dot-pe', '8': 'dot-pa'
        };

        overlay.querySelector('#dev-sub-close').onclick = function () { overlay.remove(); };
        overlay.querySelector('#dev-sub-detail-close').onclick = function () { detailWrap.style.display = 'none'; };
        overlay.addEventListener('click', function (e) { if (e.target === overlay) overlay.remove(); });

        function updateSubStuBadge() {
            var badge = overlay.querySelector('#dev-sub-stu-badge');
            if (!badge) return;
            if (studentState.selected.size) {
                badge.style.display = '';
                badge.textContent = studentState.selected.size;
            } else {
                badge.style.display = 'none';
            }
        }
        overlay.querySelector('#dev-sub-stu').onclick = function () {
            showStudentPanel(function () {
                updateSubStuBadge();
                loadList(1);
            });
        };
        updateSubStuBadge();

        async function loadList(page) {
            currentPage = page || 1;
            listEl.innerHTML = '<div style="text-align:center;color:#888;padding:30px;font-size:12px;">加载中...</div>';
            statEl.textContent = '';
            detailWrap.style.display = 'none';

            var onlyMine = overlay.querySelector('#dev-sub-only-mine').checked;
            var status = overlay.querySelector('#dev-sub-status').value;
            var lang = overlay.querySelector('#dev-sub-lang').value;

            try {
                var url;
                if (mode === 'contest') {
                    url = '/api/oj/contest-submissions?onlyMine=' + onlyMine +
                        '&problemID=' + encodeURIComponent(displayId) +
                        '&completeProblemID=true&contestID=' + encodeURIComponent(cid) +
                        '&beforeContestSubmit=false&currentPage=' + currentPage + '&limit=20';
                    if (status !== '') url += '&status=' + encodeURIComponent(status);
                    if (lang) url += '&language=' + encodeURIComponent(lang);
                } else {
                    url = '/api/oj/get-submission-list?onlyMine=' + onlyMine +
                        '&problemID=' + encodeURIComponent(displayId) +
                        '&completeProblemID=true&currentPage=' + currentPage + '&limit=20';
                    if (status !== '') url += '&status=' + encodeURIComponent(status);
                    if (lang) url += '&language=' + encodeURIComponent(lang);
                    if (gid) url += '&gid=' + encodeURIComponent(gid);
                }

                var r = await req(url);
                var data = (r && r.data) || {};
                var records = data.records || [];
                totalPages = data.pages || 1;
                var total = data.total || records.length;

                // 学员过滤（前端）
                if (studentState.selected.size > 0) {
                    records = records.filter(function (rec) {
                        return studentState.selected.has(rec.username || '');
                    });
                }

                statEl.textContent = '共 ' + total + ' 条，第 ' + currentPage + '/' + totalPages + ' 页' +
                    (studentState.selected.size ? '（已过滤）' : '');
                pageLabel.textContent = '第 ' + currentPage + ' 页';

                if (!records.length) {
                    listEl.innerHTML = '<div style="text-align:center;color:#888;padding:30px;font-size:12px;">暂无提交记录</div>';
                    return;
                }

                var html = '<table style="width:100%;border-collapse:collapse;font-size:11px;">' +
                    '<thead><tr style="background:#E8EEF8;position:sticky;top:0;">' +
                    '<th style="padding:4px 8px;border:1px solid #ACA899;text-align:left;white-space:nowrap;">提交 ID</th>' +
                    '<th style="padding:4px 8px;border:1px solid #ACA899;text-align:left;">用户</th>' +
                    '<th style="padding:4px 8px;border:1px solid #ACA899;text-align:left;">状态</th>' +
                    '<th style="padding:4px 8px;border:1px solid #ACA899;text-align:left;">语言</th>' +
                    '<th style="padding:4px 8px;border:1px solid #ACA899;text-align:right;">耗时</th>' +
                    '<th style="padding:4px 8px;border:1px solid #ACA899;text-align:right;">内存</th>' +
                    '<th style="padding:4px 8px;border:1px solid #ACA899;text-align:right;">分数</th>' +
                    '<th style="padding:4px 8px;border:1px solid #ACA899;text-align:left;white-space:nowrap;">提交时间</th>' +
                    '<th style="padding:4px 8px;border:1px solid #ACA899;text-align:center;">详情</th>' +
                    '</tr></thead><tbody>';

                for (var i = 0; i < records.length; i++) {
                    var rec = records[i];
                    var st = String(rec.status != null ? rec.status : '');
                    var stLabel = STATUS_MAP[st] || ('状态' + st);
                    var stColor = STATUS_COLOR[st] || '#444';
                    var memMB = rec.memory != null ? (rec.memory / 1024).toFixed(1) + 'MB' : '-';
                    var timeStr = rec.time != null ? rec.time + 'ms' : '-';
                    var scoreStr = rec.score != null ? String(rec.score) : '-';
                    var rawUname = rec.username || '';
                    var username = esc(getDisplayName(rawUname, rec.nickname || rec.username) || '匿名');
                    var submitTime = rec.submitTime ? new Date(rec.submitTime).toLocaleString('zh-CN', { hour12: false }) : '-';
                    var rowBg = i % 2 === 0 ? '' : 'background:#F5F8FF;';
                    html += '<tr style="' + rowBg + '">' +
                        '<td style="padding:3px 8px;border:1px solid #E0E0E0;font-family:Courier New;color:#0058E1;white-space:nowrap;">' + esc(String(rec.submitId || '')) + '</td>' +
                        '<td style="padding:3px 8px;border:1px solid #E0E0E0;">' + username + '</td>' +
                        '<td style="padding:3px 8px;border:1px solid #E0E0E0;white-space:nowrap;"><span style="color:' + stColor + ';font-weight:bold;">' + esc(stLabel) + '</span></td>' +
                        '<td style="padding:3px 8px;border:1px solid #E0E0E0;white-space:nowrap;">' + esc(rec.language || '-') + '</td>' +
                        '<td style="padding:3px 8px;border:1px solid #E0E0E0;text-align:right;">' + esc(timeStr) + '</td>' +
                        '<td style="padding:3px 8px;border:1px solid #E0E0E0;text-align:right;">' + esc(memMB) + '</td>' +
                        '<td style="padding:3px 8px;border:1px solid #E0E0E0;text-align:right;">' + esc(scoreStr) + '</td>' +
                        '<td style="padding:3px 8px;border:1px solid #E0E0E0;white-space:nowrap;font-size:10px;">' + esc(submitTime) + '</td>' +
                        '<td style="padding:3px 8px;border:1px solid #E0E0E0;text-align:center;">' +
                        '<button class="dev-sub-case-btn" data-sid="' + esc(String(rec.submitId || '')) + '" data-user="' + username + '" data-st="' + esc(stLabel) + '" data-lang="' + esc(rec.language || '') + '" ' +
                        'style="height:18px;padding:0 8px;background:#ECE9D8;border:1px solid #ACA899;cursor:pointer;font-size:10px;border-radius:2px;">详情</button>' +
                        '</td>' +
                        '</tr>';
                }
                html += '</tbody></table>';
                listEl.innerHTML = html;

                listEl.querySelectorAll('.dev-sub-case-btn').forEach(function (btn) {
                    btn.onclick = async function () {
                        var sid = btn.dataset.sid;
                        var user = btn.dataset.user;
                        var stText = btn.dataset.st;
                        btn.disabled = true; btn.textContent = '加载...';
                        try {
                            var results = await Promise.allSettled([
                                req('/api/oj/get-all-case-result?submitId=' + encodeURIComponent(sid)),
                                req('/api/oj/get-submission-detail?submitId=' + encodeURIComponent(sid))
                            ]);

                            var cases = [];
                            if (results[0].status === 'fulfilled') {
                                cases = (results[0].value && results[0].value.data && results[0].value.data.judgeCaseList) || [];
                            }
                            var subDetail = {};
                            if (results[1].status === 'fulfilled') {
                                subDetail = (results[1].value && results[1].value.data && results[1].value.data.submission) || {};
                            }
                            var code = subDetail.code || '';
                            var subLang = subDetail.language || btn.dataset.lang || '';

                            detailTitle.textContent = '详情 — ' + user + ' (' + stText + ') #' + sid;
                            var detailHtml = '';

                            if (cases.length) {
                                var acC = 0;
                                detailHtml += '<div style="display:flex;flex-wrap:wrap;gap:3px;margin-bottom:4px;">';
                                for (var ci = 0; ci < cases.length; ci++) {
                                    var c = cases[ci];
                                    var cs = String(c.status != null ? c.status : '');
                                    if (cs === '0') acC++;
                                    var dc = DOT_CLASS[cs] || 'dot-pending';
                                    var ctime = c.time != null ? c.time + 'ms' : '-';
                                    var cmem = c.memory != null ? c.memory + 'KB' : '-';
                                    var cseq = c.seq != null ? c.seq : (ci + 1);
                                    detailHtml += '<div class="dev-case-dot ' + dc + '" title="#' + esc(String(cseq)) + ' ' + esc(STATUS_MAP[cs] || cs) + '  ' + esc(ctime) + '  ' + esc(cmem) + '">' + esc(String(cseq)) + '</div>';
                                }
                                detailHtml += '</div>';
                                detailHtml += '<div style="font-size:10px;color:#888;margin-bottom:6px;">' + acC + ' / ' + cases.length + ' 测试点通过</div>';
                            } else {
                                detailHtml += '<div style="font-size:11px;color:#888;margin-bottom:6px;">无测试点数据</div>';
                            }

                            casesEl.innerHTML = detailHtml;
                            detailWrap.style.display = '';

                            // 代码用独立弹窗展示
                            if (code) {
                                var viewBtn = document.createElement('button');
                                viewBtn.textContent = '📄 查看代码 (' + esc(subLang) + ')';
                                viewBtn.style.cssText = 'height:22px;padding:0 10px;background:#0058E1;color:#fff;border:1px solid #0058E1;cursor:pointer;font-size:11px;border-radius:2px;margin-top:4px;';
                                viewBtn.onclick = function () {
                                    showCodeViewer(code, subLang, user + ' — ' + stText + ' #' + sid);
                                };
                                casesEl.appendChild(viewBtn);
                            }

                        } catch (e) {
                            casesEl.innerHTML = '<div style="color:#C00;font-size:11px;padding:8px;">加载失败: ' + esc(e.message) + '</div>';
                            detailWrap.style.display = '';
                        }
                        btn.disabled = false; btn.textContent = '详情';
                    };
                });

            } catch (e) {
                listEl.innerHTML = '<div style="text-align:center;color:#C00;padding:30px;font-size:12px;">加载失败: ' + esc(e.message) + '</div>';
            }
        }

        overlay.querySelector('#dev-sub-refresh').onclick = function () { loadList(1); };
        overlay.querySelector('#dev-sub-only-mine').onchange = function () { loadList(1); };
        overlay.querySelector('#dev-sub-status').onchange = function () { loadList(1); };
        overlay.querySelector('#dev-sub-lang').onchange = function () { loadList(1); };
        overlay.querySelector('#dev-sub-prev').onclick = function () { if (currentPage > 1) loadList(currentPage - 1); };
        overlay.querySelector('#dev-sub-next').onclick = function () { if (currentPage < totalPages) loadList(currentPage + 1); };

        loadList(1);
    }


    /* ============== 加载 AC 代码 ============== */
    async function loadAcCode() {
        const f = cur(); if (!f || !f.problem) return alert('请先选择题目');
        if (!confirm('将用已 AC 的代码覆盖当前编辑器内容,确定?')) return;
        setStatus('加载 AC 代码...');
        try {
            const tryFetch = async onlyMine => {
                const r = await req('/api/oj/get-submission-list?onlyMine=' + onlyMine
                    + '&status=0&problemID=' + encodeURIComponent(f.displayId)
                    + '&limit=20&currentPage=1');
                return r?.data?.records || [];
            };
            let records = await tryFetch(true);
            let match = records.find(r => r.language === f.lang);
            if (!match) {
                records = await tryFetch(false);
                match = records.find(r => r.language === f.lang);
            }
            if (!match) { out('未找到语言为「' + f.lang + '」的 AC 提交', 'err'); setStatus('无 AC 记录'); return; }
            const detail = (await req('/api/oj/get-submission-detail?submitId=' + match.submitId))?.data?.submission || {};
            const code = detail.code || '';
            if (!code) { out('该提交不公开,无法获取代码', 'err'); return; }
            codeEl.value = code; f.code = code;
            refreshHighlight(); refreshGutter();
            out('AC 代码已载入(来源: ' + (match.nickname || match.username || '匿名') + ')', 'ok');
            setStatus('AC 代码已载入');
        } catch (e) {
            out('加载 AC 代码失败: ' + e.message, 'err');
            setStatus('错误');
        }
    }

    /* ============== 启动 ============== */
    if (!restoreSession()) {
        newFile({ lang: 'C++ With O2' });
        activeFile = 0;
    }
    codeEl.value = cur().code;
    applyCfg();
    renderFileTabs();
    refreshHighlight();
    refreshGutter();
    refreshLnCol();
    var _startFile = cur();
    S_lang_select(_startFile);
    if (_startFile && _startFile.problem) {
        renderProblem(_startFile.problem);
        statusMode.textContent = _startFile.displayId
            ? ((_startFile.mode === 'contest' ? '比赛 ' : '训练 ') + _startFile.displayId)
            : '未加载题目';
    }
    statusLang.textContent = cur().lang;
    if (restoreProblemListState()) {
        renderProblemList();
        renderProblemListHighlight();
        renderProblemListAcMarks();   // ← 新增：先用缓存立即显示 AC 标记
        $('#dev-plist-sidebar').classList.remove('collapsed');
        var _toggleTab = $('#dev-tab-plist-toggle');
        if (_toggleTab) _toggleTab.classList.add('on');
        fetchAcStatus();              // ← 新增：后台静默刷新最新状态
    }

    setStatus('就绪');
    out('DevC++ XDFOJ 已启动 - ' + (token() ? '✓ 已登录' : '✗ 未登录,请点击右上角登录'), token() ? 'ok' : 'err');
    if (!token()) out('提示: 可点击右上角"登录"按钮打开 XDFOJ 登录窗口。', 'run');
    updateLoginBtn();
    // 初始化时给静态 HTML 中的 ⚙ 按钮绑定事件
    var initSettingsBtn = $('#dev-plist-settings'); if (initSettingsBtn) initSettingsBtn.onclick = function () { var mode = problemListState.mode; if (!mode) { out('请先通过加载器加载题单', 'err'); return; } if (mode === 'training') { loadProblemListFromTraining(problemListState.tid, problemListState.gid, !!problemListState.gid); } else { loadProblemListFromContest(problemListState.cid, problemListState.gid); } };
    var initEditBtn = $('#dev-plist-edit');
    if (initEditBtn) initEditBtn.onclick = function () { toggleEditMode(); };
    // ============== 题单侧栏常驻加载器 ==============
    (function initPlistLoader() {
        var loaderEl = $('#dev-plist-loader');
        var toggleBtn = $('#dev-loader-toggle');
        var typeSel = $('#dev-loader-type');
        var groupRow = $('#dev-loader-group-row');
        var catRow = $('#dev-loader-cat-row');
        var groupSel = $('#dev-loader-group');
        var catSel = $('#dev-loader-cat');
        var itemSel = $('#dev-loader-item');
        var loadBtn = $('#dev-loader-load');
        var refreshBtn = $('#dev-loader-refresh');
        if (!loaderEl || !typeSel) return;

        // 折叠/展开按钮
        if (toggleBtn) {
            toggleBtn.onclick = function () {
                var collapsed = loaderEl.classList.toggle('collapsed');
                toggleBtn.textContent = collapsed ? '▼' : '▲';
            };
        }

        // 类型切换
        typeSel.onchange = function () {
            var t = typeSel.value;
            if (t === 'public-training') {
                groupRow.style.display = 'none';
                catRow.style.display = '';
                itemSel.innerHTML = '<option value="">请先选择分类</option>';
                loadPublicCategoriesIntoLoader(catSel);
            } else {
                groupRow.style.display = '';
                catRow.style.display = 'none';
                itemSel.innerHTML = '<option value="">请先选择团队</option>';
                loadGroupsInto(groupSel);
            }
        };

        // 分类切换
        catSel.onchange = function () {
            loadPublicTrainingsInto(itemSel, catSel.value);
        };

        // 团队切换
        groupSel.onchange = function () {
            var gid = groupSel.value;
            if (!gid) { itemSel.innerHTML = '<option value="">请先选择团队</option>'; return; }
            if (typeSel.value === 'group-contest') {
                loadGroupContestsInto(itemSel, gid);
            } else {
                loadGroupTrainingsInto(itemSel, gid);
            }
        };

        // 加载按钮
        loadBtn.onclick = function () {
            if (!token()) { out('请先登录后再加载题单', 'err'); return; }
            var type = typeSel.value;
            var gid = groupSel.value;
            var item = itemSel.value;
            if (type !== 'public-training' && !gid) { out('请先选择团队', 'err'); return; }
            if (!item) { out('请先选择题单', 'err'); return; }
            if (type === 'public-training') {
                loadProblemListFromTraining(item, '', false);
            } else if (type === 'group-training') {
                loadProblemListFromTraining(item, gid, true);
            } else {
                loadProblemListFromContest(item, gid);
            }
            // 加载后自动折叠，释放题目列表空间
            loaderEl.classList.add('collapsed');
            if (toggleBtn) toggleBtn.textContent = '▼';
        };

        // 刷新按钮 → 打开团队管理弹窗
        refreshBtn.onclick = function () {
            var gid = groupSel.value;
            var grpName = '';
            if (groupSel.options && groupSel.selectedIndex >= 0) {
                grpName = groupSel.options[groupSel.selectedIndex].text;
            }
            doManageGroup(gid, grpName);
        };


        // 专用：加载公共分类到 loader 的 catSel（不依赖弹窗里的 #dev-pl-item）
        async function loadPublicCategoriesIntoLoader(sel) {
            sel.innerHTML = '<option value="">加载中...</option>';
            try {
                var r = await req('/api/oj/get-training-category');
                var d = r && r.data;
                var arr = [];
                if (Array.isArray(d)) arr = d;
                else if (d && Array.isArray(d.records)) arr = d.records;
                if (!arr.length) {
                    sel.innerHTML = '<option value="">全部</option>';
                    loadPublicTrainingsInto(itemSel, '');
                    return;
                }
                var html = '<option value="">-- 请选择分类 --</option><option value="">全部</option>';
                for (var i = 0; i < arr.length; i++) {
                    var c = arr[i];
                    html += '<option value="' + esc(String(c.id || c.categoryId || '')) + '">'
                        + esc(c.name || c.title || c.categoryName || ('分类#' + (c.id || i))) + '</option>';
                }
                sel.innerHTML = html;
            } catch (e) {
                sel.innerHTML = '<option value="">全部（分类加载失败）</option>';
                loadPublicTrainingsInto(itemSel, '');
            }
        }

        // 默认初始化：加载公共训练分类
        loadPublicCategoriesIntoLoader(catSel);
    })();

    // 扫码登录重定向回来时，网站 Vue 可能还未完成 token 写入
    // 轮询等待最多 5 秒，token 出现后立即刷新按钮和输出提示
    (function () {
        if (token()) return; // 已登录则不需要等待
        var tries = 0;
        var maxTries = 10; // 每 500ms 检查一次，最多等 5 秒
        var t = setInterval(function () {
            tries++;
            if (token()) {
                clearInterval(t);
                updateLoginBtn();
                // 重新输出登录状态提示，覆盖之前的"未登录"
                //out('✓ 检测到登录状态，欢迎回来！', 'ok');
                setStatus('就绪');
            } else if (tries >= maxTries) {
                clearInterval(t);
            }
        }, 500);
    })();
    /* ============== URL 变化监听：动态显隐脚本 UI ============== */
    (function () {
        function applyPageVisibility() {
            try {
                if (isAllowedPage()) {
                    // 在允许的页面：显示
                    root.style.display = '';
                } else {
                    // 不在允许的页面：隐藏（不销毁，路由切回来还能恢复）
                    root.style.display = 'none';
                    // 同时关闭可能打开的菜单和弹窗
                    if (typeof closeMenu === 'function') closeMenu();
                    document.querySelectorAll('.dev-modal').forEach(function (m) { m.remove(); });
                }
            } catch (e) { }
        }

        // 1. 监听 popstate（浏览器前进后退）
        window.addEventListener('popstate', applyPageVisibility);

        // 2. 监听 hashchange（hash 模式路由）
        window.addEventListener('hashchange', applyPageVisibility);

        // 3. 拦截 pushState / replaceState（history 模式 SPA 路由）
        var origPush = history.pushState;
        var origReplace = history.replaceState;
        history.pushState = function () {
            var ret = origPush.apply(this, arguments);
            setTimeout(applyPageVisibility, 0);
            return ret;
        };
        history.replaceState = function () {
            var ret = origReplace.apply(this, arguments);
            setTimeout(applyPageVisibility, 0);
            return ret;
        };

        // 4. 兜底：每秒轮询 URL，防止某些非常规跳转方式漏检
        var lastUrl = location.href;
        setInterval(function () {
            if (location.href !== lastUrl) {
                lastUrl = location.href;
                applyPageVisibility();
            }
        }, 1000);

        // 启动时执行一次
        applyPageVisibility();
    })();
})();


