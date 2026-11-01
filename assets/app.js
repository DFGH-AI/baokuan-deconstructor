/* 爆款拆解官 · 前端交互
 * 所有大模型调用都走后端 /api/analyze，API Key 不会出现在浏览器里。
 */
(() => {
  'use strict';

  const MAX_CHARS = 8000;

  const SAMPLE_SCRIPT = `00:00 你有没有发现，越努力的人，反而越存不下钱？
00:05 我朋友在上海月薪 3 万，工作五年，存款不到 5 万。
00:12 不是他乱花，而是他掉进了「体面陷阱」：为了配得上工资，先换了房、换了车、换了圈子。
00:21 真正拉开差距的，不是收入，是你怎么处理到手的每一笔钱。
00:28 我让他做了三件事：第一，发工资先转走 20%；第二，把「投资自己」改成「投资资产」；第三，每买一件贵东西，先等 72 小时。
00:39 半年后，他第一次有了 10 万存款。
00:44 如果你也在「精致穷」，评论区打「存钱」，我把这份预算表发你。`;

  const PLATFORM_LABELS = {
    douyin: '抖音',
    xiaohongshu: '小红书',
    shipinhao: '视频号',
    bilibili: 'B站',
    kuaishou: '快手',
    shorts: 'YouTube Shorts'
  };

  const STEP_META = [
    {
      sub: '正在清洗时间轴与口播标记，并切分脚本结构',
      progress: 10
    },
    {
      sub: 'AI 正在定位可复制的钩子',
      progress: 30
    },
    {
      sub: '正在还原视频的节奏与结构',
      progress: 52
    },
    {
      sub: '正在识别观众的点赞 / 转发动机',
      progress: 74
    },
    {
      sub: '正在生成 3 条可直接开拍的选题',
      progress: 92
    }
  ];

  const $ = (id) => document.getElementById(id);

  const els = {
    themeToggle: $('themeToggle'),
    themeColorMeta: $('themeColorMeta'),
    enginePill: $('enginePill'),
    engineText: $('engineText'),
    sampleBtn: $('sampleBtn'),
    scriptInput: $('scriptInput'),
    charCount: $('charCount'),
    platform: $('platform'),
    autoSegment: $('autoSegment'),
    pipelineState: $('pipelineState'),
    commentsInput: $('commentsInput'),
    nicheInput: $('nicheInput'),
    analyzeBtn: $('analyzeBtn'),
    ctaIcon: $('ctaIcon'),
    ctaSpinner: $('ctaSpinner'),
    ctaLabel: $('ctaLabel'),
    ctaHint: $('ctaHint'),
    copyBtn: $('copyBtn'),
    downloadBtn: $('downloadBtn'),
    resultOutput: $('resultOutput'),
    emptyState: $('emptyState'),
    loadingState: $('loadingState'),
    loadingTitle: $('loadingTitle'),
    loadingSub: $('loadingSub'),
    loadingTimer: $('loadingTimer'),
    progressBar: $('progressBar'),
    resultStatusDot: $('resultStatusDot'),
    resultStatus: $('resultStatus'),
    pipelineDetails: $('pipelineDetails'),
    cleanChars: $('cleanChars'),
    segmentCount: $('segmentCount'),
    segmentList: $('segmentList'),
    errorState: $('errorState'),
    errorMessage: $('errorMessage'),
    errorHint: $('errorHint'),
    retryBtn: $('retryBtn'),
    toast: $('toast'),
    toastIcon: $('toastIcon'),
    toastText: $('toastText')
  };

  const state = {
    busy: false,
    result: '',
    lastPayload: null,
    controller: null,
    startedAt: 0,
    timerId: null,
    toastTimer: null,
    activeStep: 0
  };

  /* ── 主题 ────────────────────────────────────────────── */

  const THEME_KEY = 'baokuan-theme';

  function applyTheme(theme, options = {}) {
    const next = theme === 'dark' ? 'dark' : 'light';
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      /* Safari 隐私模式等场景忽略即可 */
    }

    const isDark = next === 'dark';
    if (els.themeToggle) {
      els.themeToggle.setAttribute('aria-pressed', String(isDark));
      els.themeToggle.setAttribute('aria-label', isDark ? '切换到浅色模式' : '切换到深色模式');
      els.themeToggle.title = isDark ? '切换到浅色模式' : '切换到深色模式';
    }
    if (els.themeColorMeta) {
      els.themeColorMeta.setAttribute('content', isDark ? '#06080f' : '#f5f6fa');
    }
    if (options.announce) {
      showToast(isDark ? '已切换到深色模式' : '已切换到浅色模式');
    }
  }

  function initTheme() {
    let saved = 'light';
    try {
      saved = localStorage.getItem(THEME_KEY) === 'dark' ? 'dark' : 'light';
    } catch {
      saved = 'light';
    }
    applyTheme(saved);
  }

  function toggleTheme() {
    applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark', {
      announce: true
    });
  }

  /* ── 基础 UI ─────────────────────────────────────────── */

  function setEngineStatus(kind, text) {
    els.enginePill.classList.remove('is-online', 'is-demo', 'is-offline');
    els.enginePill.classList.add(`is-${kind}`);
    els.engineText.textContent = text;
    els.enginePill.title =
      kind === 'online'
        ? 'AI 引擎已连接，点击开始分析'
        : kind === 'demo'
          ? '未配置 API Key，当前返回本地演示报告'
          : '后端接口未连接，请检查部署或本地启动方式';
  }

  function showToast(message, type = 'success') {
    window.clearTimeout(state.toastTimer);
    els.toastText.textContent = message;
    els.toastIcon.textContent = type === 'error' ? '!' : type === 'warn' ? 'i' : '✓';
    els.toast.classList.toggle('is-error', type === 'error');
    els.toast.classList.toggle('is-warn', type === 'warn');
    els.toast.classList.add('is-visible');
    state.toastTimer = window.setTimeout(() => {
      els.toast.classList.remove('is-visible');
    }, 3800);
  }

  function updateCharCount() {
    const count = els.scriptInput.value.length;
    els.charCount.textContent = count.toLocaleString('en-US');
    els.charCount.classList.toggle('text-amber-300', count > MAX_CHARS * 0.9);
    els.charCount.classList.toggle('text-slate-600', count <= MAX_CHARS * 0.9);
  }

  function setBusy(next) {
    state.busy = next;
    els.analyzeBtn.disabled = next;
    els.analyzeBtn.classList.toggle('is-busy', next);
    els.analyzeBtn.setAttribute('aria-busy', String(next));

    els.ctaIcon.classList.toggle('hidden', next);
    els.ctaSpinner.classList.toggle('hidden', !next);
    els.ctaSpinner.classList.toggle('flex', next);
    els.ctaLabel.textContent = next ? '拆解中' : '开始分析';
    els.ctaHint.textContent = next ? '请稍候' : '⌘ + Enter';
  }

  function setResultStatus(label, color) {
    const palette = {
      ready: 'bg-slate-600',
      loading: 'bg-brand-400',
      done: 'bg-emerald-400',
      demo: 'bg-amber-400',
      error: 'bg-red-400'
    };
    els.resultStatus.textContent = label;
    els.resultStatusDot.className = `h-1.5 w-1.5 rounded-full ${palette[color] || palette.ready}`;
  }

  /* ── 加载态 ──────────────────────────────────────────── */

  function applyStep(index) {
    state.activeStep = index;
    const steps = els.loadingState.querySelectorAll('.analysis-step');

    steps.forEach((step, i) => {
      step.classList.toggle('is-done', i < index);
      step.classList.toggle('is-active', i === index);
      const tag = step.querySelector('.step-tag');
      if (tag) {
        tag.textContent = i < index ? 'DONE' : i === index ? 'RUNNING' : 'QUEUED';
      }
    });

    if (index >= 0) {
      els.loadingSub.textContent = STEP_META[index].sub;
      els.progressBar.style.width = `${STEP_META[index].progress}%`;
    }
  }

  function startLoading() {
    state.startedAt = performance.now();
    els.errorState.hidden = true;
    els.emptyState.hidden = true;
    els.pipelineDetails.hidden = true;
    els.pipelineDetails.open = false;
    els.segmentList.replaceChildren();
    els.loadingState.hidden = false;
    els.resultOutput.value = '';
    els.resultOutput.scrollTop = 0;
    els.copyBtn.disabled = true;
    els.downloadBtn.disabled = true;
    els.loadingTitle.textContent = '一条龙拆解中';
    els.loadingTimer.textContent = '0.0s';
    els.progressBar.style.width = '8%';
    applyStep(0);

    window.clearInterval(state.timerId);
    state.timerId = window.setInterval(() => {
      const elapsed = (performance.now() - state.startedAt) / 1000;
      els.loadingTimer.textContent = `${elapsed.toFixed(1)}s`;

      const nextStep =
        elapsed < 2 ? 0 : elapsed < 5 ? 1 : elapsed < 9 ? 2 : elapsed < 15 ? 3 : 4;
      if (nextStep !== state.activeStep) {
        applyStep(nextStep);
      }
    }, 120);

    setResultStatus('Analyzing', 'loading');
  }

  function finishLoading() {
    window.clearInterval(state.timerId);
    state.timerId = null;
    const steps = els.loadingState.querySelectorAll('.analysis-step');
    steps.forEach((step) => {
      step.classList.remove('is-active');
      step.classList.add('is-done');
      const tag = step.querySelector('.step-tag');
      if (tag) tag.textContent = 'DONE';
    });
    els.progressBar.style.width = '100%';
    els.loadingState.hidden = true;
  }

  function stopLoading() {
    window.clearInterval(state.timerId);
    state.timerId = null;
    els.loadingState.hidden = true;
  }

  /* ── 结果 / 错误 ─────────────────────────────────────── */

  function renderPipeline(pipeline) {
    const segments = Array.isArray(pipeline?.segments) ? pipeline.segments : [];
    const cleanedChars = Number(pipeline?.cleanedChars || 0);

    if (!segments.length) {
      els.pipelineDetails.hidden = true;
      return;
    }

    els.cleanChars.textContent = cleanedChars.toLocaleString('en-US');
    els.segmentCount.textContent = String(segments.length);
    els.segmentList.replaceChildren();

    for (const segment of segments) {
      const item = document.createElement('div');
      item.className = 'segment-item';

      const head = document.createElement('div');
      head.className = 'segment-head';

      const label = document.createElement('span');
      label.className = 'segment-label';
      label.textContent = segment.label || '段落';

      const chars = document.createElement('span');
      chars.className = 'segment-chars';
      chars.textContent = `${Number(segment.chars || 0)} 字`;

      const content = document.createElement('p');
      content.className = 'segment-text';
      content.textContent = segment.text || '';

      head.append(label, chars);
      item.append(head, content);
      els.segmentList.append(item);
    }

    els.pipelineDetails.hidden = false;
    els.pipelineDetails.open = false;
  }

  function showResult(text, meta) {
    state.result = text;
    els.resultOutput.value = text;
    renderPipeline(meta.pipeline);
    els.resultOutput.scrollTop = 0;
    els.loadingState.hidden = true;
    els.emptyState.hidden = true;
    els.errorState.hidden = true;
    els.copyBtn.disabled = false;
    els.downloadBtn.disabled = false;

    const chars = text.replace(/\s/g, '').length;
    const seconds = meta.elapsed ? Number(meta.elapsed).toFixed(1) : '—';
    const prefix = meta.demo ? 'DEMO' : 'DONE';
    setResultStatus(`${prefix} · ${seconds}S · ${chars.toLocaleString('en-US')}字`, meta.demo ? 'demo' : 'done');

    if (meta.demo) {
      setEngineStatus('demo', '演示模式 · 未配置 Key');
      showToast('当前为本地演示报告；配置 API Key 后即可调用真实大模型。', 'warn');
    } else {
      if (meta.providerLabel || meta.model) {
        setEngineStatus('online', `${meta.providerLabel || 'AI'} · ${meta.model || 'Online'}`);
      }
      showToast(`拆解完成，用时 ${seconds} 秒`);
    }
  }

  function showError(message, hint) {
    stopLoading();
    els.pipelineDetails.hidden = true;
    els.emptyState.hidden = true;
    els.errorState.hidden = false;
    els.errorMessage.textContent = message || '请求失败，请稍后重试。';
    els.errorHint.textContent = hint || '';
    els.errorHint.classList.toggle('hidden', !hint);
    els.copyBtn.disabled = true;
    els.downloadBtn.disabled = true;
    els.resultOutput.value = '';
    state.result = '';
    setResultStatus('Error', 'error');
    showToast(message || '分析失败，请稍后重试。', 'error');
  }

  /* ── 请求 ────────────────────────────────────────────── */

  async function analyze() {
    if (state.busy) return;

    const script = els.scriptInput.value.trim();
    if (!script) {
      showToast('先粘贴一段视频文案，再开始分析。', 'error');
      els.scriptInput.focus();
      return;
    }
    if (script.length < 20) {
      showToast('文案太短了，至少需要 20 个字。', 'error');
      els.scriptInput.focus();
      return;
    }

    const payload = {
      script,
      platform: els.platform.value,
      comments: els.commentsInput.value.trim(),
      targetNiche: els.nicheInput.value.trim().slice(0, 40),
      autoSegment: els.autoSegment.checked
    };
    state.lastPayload = payload;

    setBusy(true);
    startLoading();

    const controller = new AbortController();
    state.controller = controller;
    const timeoutId = window.setTimeout(() => controller.abort(), 75000);

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        const error = new Error(
          (data && data.error) || `分析服务返回异常（HTTP ${response.status}）`
        );
        error.hint = (data && data.hint) || '';
        throw error;
      }
      if (!data || !data.result) {
        throw new Error('模型返回了空结果，请稍后再试。');
      }

      const elapsed = ((performance.now() - state.startedAt) / 1000).toFixed(1);
      finishLoading();
      showResult(data.result, {
        elapsed,
        demo: Boolean(data.demo),
        providerLabel: data.providerLabel,
        model: data.model,
        pipeline: data.pipeline
      });
    } catch (error) {
      if (error.name === 'AbortError') {
        showError(
          '请求超时（75 秒）。',
          '大模型可能繁忙，请稍后重试。若 Vercel 函数超时，请确认 vercel.json 中的 maxDuration 已生效。'
        );
      } else if (error instanceof TypeError) {
        showError(
          '无法连接分析接口。',
          '请确认 /api/analyze.js 已部署；本地预览请运行 npm run dev，而不是直接双击 index.html。'
        );
      } else {
        showError(error.message || '分析失败，请稍后重试。', error.hint);
      }
    } finally {
      window.clearTimeout(timeoutId);
      state.controller = null;
      setBusy(false);
    }
  }

  /* ── 复制 / 下载 ─────────────────────────────────────── */

  function legacyCopy(text) {
    const helper = document.createElement('textarea');
    helper.value = text;
    helper.setAttribute('readonly', '');
    helper.style.position = 'fixed';
    helper.style.top = '0';
    helper.style.left = '0';
    helper.style.width = '2em';
    helper.style.height = '2em';
    helper.style.padding = '0';
    helper.style.border = '0';
    helper.style.outline = '0';
    helper.style.opacity = '0';
    helper.style.pointerEvents = 'none';
    document.body.appendChild(helper);

    const selection = document.getSelection();
    const previousRange = selection && selection.rangeCount ? selection.getRangeAt(0) : null;

    let copied = false;
    try {
      helper.focus();
      helper.select();
      helper.setSelectionRange(0, helper.value.length);
      copied = document.execCommand('copy');
    } catch {
      copied = false;
    } finally {
      helper.remove();
      if (selection && previousRange) {
        selection.removeAllRanges();
        selection.addRange(previousRange);
      }
    }
    return copied;
  }

  function selectResultForManualCopy() {
    els.resultOutput.focus();
    els.resultOutput.select();
    els.resultOutput.setSelectionRange(0, state.result.length);
  }

  async function copyResult() {
    if (!state.result) return;

    let copied = false;

    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(state.result);
        copied = true;
      } catch {
        copied = false;
      }
    }

    if (!copied) {
      copied = legacyCopy(state.result);
    }

    if (copied) {
      showToast('报告已复制到剪贴板');
    } else {
      selectResultForManualCopy();
      showToast('浏览器拦截了自动复制，已选中全文，请按 Ctrl+C / Command+C。', 'warn');
    }
  }

  function downloadResult() {
    if (!state.result) return;
    const platform = PLATFORM_LABELS[els.platform.value] || '视频';
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
    const filename = `爆款拆解_${platform}_${stamp}.txt`;
    const blob = new Blob([`\uFEFF${state.result}\n\n———\n由「爆款拆解官」生成`], {
      type: 'text/plain;charset=utf-8'
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast('报告已下载为 TXT');
  }

  /* ── 引擎探活 ────────────────────────────────────────── */

  async function loadEngineStatus() {
    try {
      const response = await fetch('/api/analyze', {
        headers: { Accept: 'application/json' },
        cache: 'no-store'
      });
      if (!response.ok) throw new Error('offline');
      const data = await response.json();

      if (data.demo) {
        setEngineStatus('demo', '演示模式 · 未配置 Key');
      } else if (data.configured === false) {
        setEngineStatus('offline', '未配置 API Key');
      } else {
        setEngineStatus(
          'online',
          `${data.providerLabel || 'AI'} · ${data.model || 'Online'}`
        );
      }
    } catch {
      setEngineStatus('offline', '后端未连接');
    }
  }

  /* ── 事件绑定 ────────────────────────────────────────── */

  els.themeToggle.addEventListener('click', toggleTheme);

  els.autoSegment.addEventListener('change', () => {
    const enabled = els.autoSegment.checked;
    els.pipelineState.textContent = enabled ? 'ON' : 'OFF';
    els.pipelineState.classList.toggle('is-off', !enabled);
    els.autoSegment.setAttribute('aria-label', enabled ? '开启一条龙自动切段' : '关闭一条龙自动切段');
    showToast(
      enabled
        ? '已开启一条龙：自动清洗、切段后再拆解'
        : '已关闭自动切段，将直接分析整段清洗稿'
    );
  });

  els.sampleBtn.addEventListener('click', () => {
    if (els.scriptInput.value.trim() && !window.confirm('载入示例会覆盖当前文案，继续吗？')) {
      return;
    }
    els.scriptInput.value = SAMPLE_SCRIPT;
    updateCharCount();
    els.scriptInput.focus();
    els.scriptInput.setSelectionRange(SAMPLE_SCRIPT.length, SAMPLE_SCRIPT.length);
    showToast('示例文案已载入，点击「开始分析」试试');
  });

  els.scriptInput.addEventListener('input', updateCharCount);

  els.analyzeBtn.addEventListener('click', analyze);
  els.retryBtn.addEventListener('click', analyze);
  els.copyBtn.addEventListener('click', copyResult);
  els.downloadBtn.addEventListener('click', downloadResult);

  document.addEventListener('keydown', (event) => {
    const isShortcut = (event.metaKey || event.ctrlKey) && event.key === 'Enter';
    if (!isShortcut) return;
    event.preventDefault();
    analyze();
  });

  initTheme();
  updateCharCount();
  loadEngineStatus();
})();
