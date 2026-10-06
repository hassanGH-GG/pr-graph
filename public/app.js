const $ = (id) => document.getElementById(id);
const number = new Intl.NumberFormat('en-US');
let activity;
const monthName = (key, full = false) => new Date(`${key}-01T00:00:00Z`).toLocaleDateString('en-US', { month: full ? 'long' : 'short', year: full ? 'numeric' : '2-digit', timeZone: 'UTC' });
function draw(data) {
  const width = $('graph').clientWidth, height = $('graph').clientHeight;
  const mobile = width < 550, right = mobile ? 49 : 82, bottom = 36, top = 15;
  const plotW = width - right, plotH = height - bottom - top;
  const now = new Date();
  const first = Object.keys(data.counts).sort()[0] || now.toISOString().slice(0, 7);
  const start = new Date(`${Math.min(2023, Number(first.slice(0, 4)))}-01-01T00:00:00Z`);
  const months = [];
  while (start <= now) { const key = start.toISOString().slice(0, 7); months.push({ key, count: data.counts[key] || 0 }); start.setUTCMonth(start.getUTCMonth() + 1); }
  const max = Math.max(1, ...months.map(m => m.count));
  const rough = max / 4, magnitude = 10 ** Math.floor(Math.log10(rough));
  const step = Math.max(1, [1, 2, 2.5, 5, 10].find(n => n * magnitude >= rough) * magnitude);
  const ceiling = Math.ceil(max / step) * step, slot = plotW / months.length;
  const tickEvery = mobile ? 12 : 6;
  let markup = `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${number.format(data.total)} pull requests, by creation month"><defs><linearGradient id="blue" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#6c91d3"/><stop offset="1" stop-color="#527fc8"/></linearGradient></defs>`;
  for (let value = 0; value <= ceiling; value += step) {
    const y = top + plotH * (1 - value / ceiling);
    markup += `<line class="${value ? 'grid' : 'baseline'}" x1="0" y1="${y}" x2="${plotW}" y2="${y}"/><text class="axis" x="${plotW + 10}" y="${y + 5}">${number.format(value)}</text>`;
  }
  months.forEach((m, i) => {
    const x = i * slot, barH = m.count / ceiling * plotH;
    if (i % tickEvery === 0) markup += `<line class="grid" x1="${x}" x2="${x}" y1="${top}" y2="${top + plotH}"/><text class="axis" x="${x}" y="${height - 3}">${monthName(m.key).replace(' ', " ’")}</text>`;
    markup += `<g class="month" data-month="${m.key}" tabindex="0" role="img" aria-label="${monthName(m.key, true)}: ${m.count} pull requests"><rect class="hit" x="${x}" y="${top}" width="${slot}" height="${plotH}" fill="transparent"/><rect class="bar" pointer-events="none" x="${x + 1.5}" y="${top + plotH - barH}" width="${Math.max(1, slot - 3)}" height="${barH}" rx="1"/></g>`;
  });
  if (!mobile) markup += `<text class="axis" text-anchor="middle" transform="translate(${width - 6},${top + plotH / 2}) rotate(90)">Pull requests</text>`;
  markup += '</svg>';
  $('graph').innerHTML = markup;
  $('graph').setAttribute('aria-busy', 'false');
  for (const node of document.querySelectorAll('.month')) {
    const show = () => {
      const key = node.dataset.month;
      $('tooltip').replaceChildren(document.createTextNode(monthName(key, true)));
      const strong = document.createElement('strong'); strong.textContent = `${number.format(data.counts[key] || 0)} pull requests`; $('tooltip').append(strong);
      $('tooltip').hidden = false;
      const bounds = node.getBoundingClientRect(), card = document.querySelector('.card').getBoundingClientRect();
      $('tooltip').style.left = `${Math.max(8, Math.min(bounds.x - card.x, card.width - $('tooltip').offsetWidth - 8))}px`;
      $('tooltip').style.top = '87px';
    };
    node.addEventListener('pointerenter', show); node.addEventListener('focus', show);
    node.addEventListener('pointerleave', () => $('tooltip').hidden = true); node.addEventListener('blur', () => $('tooltip').hidden = true);
  }
}
async function sync() {
  $('refresh').disabled = true;
  $('status').textContent = 'Checking GitHub…';
  try {
    const response = await fetch('/api/activity');
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Could not load GitHub activity.');
    activity = data;
    $('username').textContent = data.name || data.login;
    $('handle').textContent = data.name ? `@${data.login}` : '';
    $('history-link').href = `https://github.com/pulls?q=${encodeURIComponent(`is:pr author:${data.login}`)}`;
    $('profile').href = data.url;
    $('avatar').src = data.avatarUrl; $('avatar').hidden = false;
    $('total').textContent = `${number.format(data.total)} pull requests`;
    document.title = `${number.format(data.total)} PRs · ${data.name || data.login}`;
    draw(data);
    $('status').textContent = data.stale ? `Saved data · ${data.warning}` : `Updated ${new Date(data.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    $('status').classList.toggle('error', !!data.stale);
  } catch (error) {
    $('status').textContent = error.message; $('status').classList.add('error');
    if (!activity) { $('total').textContent = 'Unable to load pull requests'; $('graph').innerHTML = '<div class="placeholder">GitHub is unavailable<span>Check your connection, then press refresh.</span></div>'; $('graph').setAttribute('aria-busy', 'false'); }
  } finally { $('refresh').disabled = false; }
}
$('refresh').addEventListener('click', sync);
new ResizeObserver(() => { if (activity) draw(activity); }).observe($('graph'));
setInterval(sync, 300000);
sync();
