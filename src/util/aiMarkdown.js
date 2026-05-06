/**
 * AI 助手消息 Markdown 渲染（GFM 表格、任务列表、代码高亮、安全消毒）
 */
import MarkdownIt from 'markdown-it';
import { escapeHtml } from 'markdown-it/lib/common/utils.mjs';
import multimdTable from 'markdown-it-multimd-table';
import taskLists from 'markdown-it-task-lists';
import hljs from 'highlight.js/lib/core';
import javascript from 'highlight.js/lib/languages/javascript';
import typescript from 'highlight.js/lib/languages/typescript';
import python from 'highlight.js/lib/languages/python';
import bash from 'highlight.js/lib/languages/bash';
import json from 'highlight.js/lib/languages/json';
import xml from 'highlight.js/lib/languages/xml';
import css from 'highlight.js/lib/languages/css';
import scss from 'highlight.js/lib/languages/scss';
import sql from 'highlight.js/lib/languages/sql';
import yaml from 'highlight.js/lib/languages/yaml';
import markdown from 'highlight.js/lib/languages/markdown';
import java from 'highlight.js/lib/languages/java';
import go from 'highlight.js/lib/languages/go';
import rust from 'highlight.js/lib/languages/rust';
import cpp from 'highlight.js/lib/languages/cpp';
import csharp from 'highlight.js/lib/languages/csharp';
import php from 'highlight.js/lib/languages/php';
import ruby from 'highlight.js/lib/languages/ruby';
import kotlin from 'highlight.js/lib/languages/kotlin';
import swift from 'highlight.js/lib/languages/swift';
import dockerfile from 'highlight.js/lib/languages/dockerfile';
import plaintext from 'highlight.js/lib/languages/plaintext';
import DOMPurify from 'dompurify';

import 'highlight.js/styles/github.css';

const LANG_REGISTRY = [
  ['javascript', javascript],
  ['js', javascript],
  ['jsx', javascript],
  ['typescript', typescript],
  ['ts', typescript],
  ['tsx', typescript],
  ['python', python],
  ['py', python],
  ['bash', bash],
  ['sh', bash],
  ['shell', bash],
  ['zsh', bash],
  ['json', json],
  ['xml', xml],
  ['html', xml],
  ['svg', xml],
  ['css', css],
  ['scss', scss],
  ['sass', scss],
  ['less', css],
  ['sql', sql],
  ['yaml', yaml],
  ['yml', yaml],
  ['markdown', markdown],
  ['md', markdown],
  ['java', java],
  ['go', go],
  ['golang', go],
  ['rust', rust],
  ['rs', rust],
  ['cpp', cpp],
  ['c++', cpp],
  ['csharp', csharp],
  ['cs', csharp],
  ['php', php],
  ['ruby', ruby],
  ['rb', ruby],
  ['kotlin', kotlin],
  ['kt', kotlin],
  ['swift', swift],
  ['dockerfile', dockerfile],
  ['docker', dockerfile],
  ['text', plaintext],
  ['plaintext', plaintext],
];

for (const [name, mod] of LANG_REGISTRY) {
  hljs.registerLanguage(name, mod);
}

function highlightCode(str, langName) {
  const escaped = escapeHtml(str);
  const lang = (langName || '').trim().toLowerCase();
  if (lang && hljs.getLanguage(lang)) {
    try {
      return `<pre class="hljs ai-md-pre"><code class="hljs language-${escapeHtml(lang)}">${hljs.highlight(str, { language: lang, ignoreIllegals: true }).value}</code></pre>`;
    } catch {
      /* fall through */
    }
  }
  try {
    const { value } = hljs.highlightAuto(str);
    return `<pre class="hljs ai-md-pre"><code class="hljs">${value}</code></pre>`;
  } catch {
    return `<pre class="hljs ai-md-pre"><code class="hljs">${escaped}</code></pre>`;
  }
}

const md = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: true,
  breaks: true,
  highlight: highlightCode,
})
  .use(multimdTable, {
    multiline: true,
    rowspan: false,
    headerless: true,
    multibody: true,
    autolabel: true,
  })
  .use(taskLists, { enabled: true, label: true });

const PURIFY_TAGS = [
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'p',
  'div',
  'ul',
  'ol',
  'li',
  'blockquote',
  'pre',
  'code',
  'a',
  'img',
  'hr',
  'br',
  'strong',
  'b',
  'em',
  'i',
  'del',
  's',
  'sub',
  'sup',
  'mark',
  'table',
  'thead',
  'tbody',
  'tr',
  'th',
  'td',
  'caption',
  'span',
  'input',
];

const PURIFY_ATTR = [
  'href',
  'src',
  'alt',
  'title',
  'class',
  'id',
  'width',
  'height',
  'colspan',
  'rowspan',
  'align',
  'target',
  'rel',
  'type',
  'checked',
  'disabled',
  'start',
];

/**
 * 流式输出时，若围栏未成对关闭，markdown-it 会把后面全文当成代码块，
 * 表现为 ###、表格、列表等「渲染不出来」。预览时在末尾临时补闭合围栏即可。
 * @param {string} text
 * @param {string} marker "```" | "~~~"
 */
function balanceStreamingFences(text, marker) {
  const parts = text.split(marker);
  if (parts.length <= 1) return text;
  if (parts.length % 2 === 0) {
    return `${text}\n${marker}\n`;
  }
  return text;
}

let linkHookInstalled = false;
function ensureExternalLinkHook() {
  if (linkHookInstalled) return;
  linkHookInstalled = true;
  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    if (node.tagName !== 'A' || !node.hasAttribute('href')) return;
    const href = node.getAttribute('href');
    if (href && /^https?:\/\//i.test(href)) {
      node.setAttribute('target', '_blank');
      node.setAttribute('rel', 'noopener noreferrer');
    }
  });
}

/**
 * @param {string} raw
 * @param {{ streaming?: boolean }} [options] streaming=true 时会对未成对的代码围栏做预览闭合
 * @returns {string} 已消毒的 HTML
 */
export function renderAiMarkdown(raw, options = {}) {
  if (raw == null || raw === '') return '';
  let normalized = String(raw).replace(/\\n/g, '\n');
  if (options.streaming) {
    normalized = balanceStreamingFences(normalized, '```');
    normalized = balanceStreamingFences(normalized, '~~~');
  }
  const html = md.render(normalized);
  ensureExternalLinkHook();
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: PURIFY_TAGS,
    ALLOWED_ATTR: PURIFY_ATTR,
    ALLOW_DATA_ATTR: false,
  });
}
