const HOST = 'https://leetcode.cn';
const PROBLEM_PATH = /^\/problems\/([a-z0-9][a-z0-9-]*)\//i;

export function problemLink(value) {
  try {
    const url = new URL(value);
    if (url.origin !== HOST || url.username || url.password) return null;
    const match = (url.pathname + '/').match(PROBLEM_PATH);
    if (!match) return null;
    const slug = match[1].toLowerCase();
    const clean = new URL('/problems/' + slug + '/', HOST);
    for (const key of ['envType', 'envId', 'favoriteSlug']) {
      const parameter = url.searchParams.get(key);
      if (parameter) clean.searchParams.set(key, parameter);
    }
    return { slug, url: clean.href };
  } catch {
    return null;
  }
}

export function parseImport(source, name) {
  const value = source.trim();
  const unique = new Map();
  let exportedName = '';
  function add(link, label = '') {
    const problem = problemLink(link);
    if (!problem || unique.has(problem.slug)) return;
    const text = typeof label === 'string' ? label.trim().slice(0, 200) : '';
    const numbered = text.match(/^(.{1,24}?)[.．、]\s+(.+)$/);
    unique.set(problem.slug, {
      ...problem,
      number: numbered?.[1] ?? '',
      title: numbered?.[2] || text || problem.slug.split('-').join(' '),
    });
  }
  if (value.startsWith('{')) {
    let data;
    try { data = JSON.parse(value); } catch { throw new Error('题单导出内容不完整，请重新复制。'); }
    if (!Array.isArray(data?.problems)) throw new Error('无法识别题单导出内容。');
    exportedName = typeof data.name === 'string' ? data.name.trim() : '';
    for (const item of data.problems) add(item?.url, item?.title);
  } else {
    for (const line of value.split(/\r?\n/)) {
      const links = [...line.matchAll(/https:\/\/leetcode\.cn\/problems\/[a-z0-9-]+[^\s<>()\[\]，。；、”]*/gi)];
      const label = links.length === 1
        ? line.replace(links[0][0], '').trim().replace(/^[\[\s]+|[\]()\s]+$/g, '')
        : '';
      for (const match of links) add(match[0], label);
    }
  }
  if (!unique.size) throw new Error('请粘贴力扣题目链接，或从力扣题单页面复制题单。');
  return { name: (name.trim() || exportedName || '我的题单').slice(0, 80), problems: [...unique.values()] };
}

// This function is serialized into a bookmark. It runs only on leetcode.cn.
export async function copyLeetCodeList() {
  if (location.origin !== 'https://leetcode.cn') {
    alert('请先打开力扣题单页面。');
    return;
  }
  async function copy(text) {
    try { await navigator.clipboard.writeText(text); }
    catch { prompt('复制内容', text); }
  }
  if (location.pathname.startsWith('/problems/')) {
    const selected = String(getSelection()).trim();
    if (selected) await copy(selected);
    else alert('请先选中要复制的条目内容。');
    return;
  }
  const links = new Map();
  const main = document.querySelector('main') || document.body;
  for (const link of main.querySelectorAll('a[href]')) {
    const url = new URL(link.href, location.origin);
    const match = url.origin === location.origin && url.pathname.match(/^\/problems\/([a-z0-9-]+)(?:\/|$)/i);
    if (!match) continue;
    const title = (link.innerText || link.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ');
    if (!links.has(match[1]) || (title && !links.get(match[1]).title)) {
      links.set(match[1], { title, url: url.href });
    }
  }
  if (!links.size) {
    alert('没有找到题目链接。请等题目加载完成后重试，或手动复制题目链接。');
    return;
  }
  const heading = main.querySelector('h1')?.innerText?.trim();
  const name = heading || document.title.split(' - ')[0].trim();
  await copy(JSON.stringify({ name, problems: [...links.values()] }));
}
