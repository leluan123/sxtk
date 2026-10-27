const periodInputs = document.getElementById('period-inputs');
const dataStatus = document.getElementById('data-status');
const emptyState = document.getElementById('empty-state');
const resultsContent = document.getElementById('results-content');
const historyBody = document.getElementById('history-body');
const probabilityList = document.getElementById('probability-list');
const samplePill = document.getElementById('sample-pill');
const resultsTitle = document.getElementById('results-title');
const minuteHoaBody = document.getElementById('minute-hoa-body');
const minuteCoverage = document.getElementById('minute-coverage');
const hoaStatus = document.getElementById('hoa-status');
const hoaList = document.getElementById('hoa-list');
const periodButtons = [...document.querySelectorAll('.period-choice')];

let data = null;
let periodCount = 1;
const periods = [[null, null, null], [null, null, null]];
const PRIOR_STRENGTH = 56;

const allCombinations = [];
for (let a = 1; a <= 6; a++) {
  for (let b = a; b <= 6; b++) {
    for (let c = b; c <= 6; c++) {
      allCombinations.push([a, b, c]);
    }
  }
}

function combinationKey(faces) {
  return [...faces].sort((a, b) => a - b).join(',');
}

function theoryProbability(faces) {
  if (faces[0] === faces[2]) return 1 / 216;
  if (faces[0] === faces[1] || faces[1] === faces[2]) return 3 / 216;
  return 6 / 216;
}

function renderInputs() {
  periodInputs.replaceChildren();
  for (let period = 0; period < periodCount; period++) {
    const group = document.createElement('div');
    group.className = 'period-row';
    const head = document.createElement('div');
    head.className = 'period-row-head';
    const label = document.createElement('strong');
    label.textContent = periodCount === 2 ? `Kỳ ${period + 1} ${period === 0 ? '(trước)' : '(sau)'}` : 'Kỳ đã biết';
    head.append(label);
    if (periodCount === 2) {
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'remove-period';
      remove.textContent = 'Xóa kỳ này ×';
      remove.addEventListener('click', () => {
        if (period === 0) periods[0] = [...periods[1]];
        periods[1] = [null, null, null];
        setPeriodCount(1);
      });
      head.append(remove);
    }
    const selectors = document.createElement('div');
    selectors.className = 'face-selectors';
    for (let position = 0; position < 3; position++) {
      const select = document.createElement('select');
      select.setAttribute('aria-label', `Kỳ ${period + 1}, số thứ ${position + 1}`);
      const placeholder = document.createElement('option');
      placeholder.value = '';
      placeholder.textContent = `Số ${position + 1}`;
      select.append(placeholder);
      for (let face = 1; face <= 6; face++) {
        const option = document.createElement('option');
        option.value = String(face);
        option.textContent = String(face);
        select.append(option);
      }
      select.value = periods[period][position] ?? '';
      select.addEventListener('change', () => {
        periods[period][position] = select.value ? Number(select.value) : null;
        clearResults('Nhấn “Phân tích kết quả” để xem bộ lọc mới.');
      });
      selectors.append(select);
    }
    group.append(head, selectors);
    periodInputs.append(group);
  }
}

function setPeriodCount(count) {
  periodCount = count;
  periodButtons.forEach(button => {
    const active = Number(button.dataset.periods) === count;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  renderInputs();
  if (count === 1 && periods[0].every(Number.isInteger)) analyze();
  else clearResults('Chọn đủ các số rồi nhấn “Phân tích kết quả”.');
}

function clearResults(message) {
  resultsContent.hidden = true;
  emptyState.hidden = false;
  emptyState.querySelector('h2').textContent = 'Sẵn sàng phân tích';
  emptyState.querySelector('p').textContent = message;
}

function showNoMatch() {
  resultsContent.hidden = true;
  emptyState.hidden = false;
  emptyState.querySelector('h2').textContent = 'Không có dữ liệu khớp';
  emptyState.querySelector('p').textContent = periodCount === 2
    ? 'Chưa có kỳ tiếp theo cho chuỗi hai kỳ này. Xóa một kỳ để lọc lại theo một kỳ.'
    : 'Chưa có kỳ tiếp theo cho bộ số này trong dữ liệu hiện có.';
}

function analyze() {
  if (!data) {
    clearResults('Dữ liệu chưa tải xong. Vui lòng thử lại.');
    return;
  }
  if (periods.slice(0, periodCount).some(faces => faces.some(face => !Number.isInteger(face)))) {
    clearResults('Vui lòng chọn đủ 3 số cho mỗi kỳ.');
    return;
  }

  const context = periods.slice(0, periodCount).map(combinationKey).join('|');
  const counts = data.counts[String(periodCount)][context];
  if (!counts) {
    showNoMatch();
    return;
  }
  const sampleSize = Object.values(counts).reduce((sum, count) => sum + count, 0);
  if (!sampleSize) {
    showNoMatch();
    return;
  }

  const historical = Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'en', { numeric: true })).slice(0, 10);
  historyBody.replaceChildren();
  historical.forEach(([key, count], index) => {
    const row = document.createElement('tr');
    const faces = key.split(',').map(Number);
    for (const [text, className] of [[String(index + 1).padStart(2, '0'), 'rank'], [faces.join(' · '), 'face-set'], [String(faces.reduce((a, b) => a + b, 0)), ''], [count.toLocaleString('vi-VN'), 'count']]) {
      const cell = document.createElement('td');
      cell.textContent = text;
      if (className) cell.className = className;
      row.append(cell);
    }
    historyBody.append(row);
  });

  const estimated = allCombinations.map(faces => {
    const key = faces.join(',');
    const count = counts[key] || 0;
    return { faces, count, probability: (count + PRIOR_STRENGTH * theoryProbability(faces)) / (sampleSize + PRIOR_STRENGTH) };
  }).sort((a, b) => b.probability - a.probability || b.count - a.count || combinationKey(a.faces).localeCompare(combinationKey(b.faces), 'en', { numeric: true })).slice(0, 3);

  probabilityList.replaceChildren();
  estimated.forEach((item, index) => {
    const li = document.createElement('li');
    const heading = document.createElement('div');
    heading.className = 'probability-item-main';
    const name = document.createElement('div');
    name.innerHTML = `<span class="prob-rank">0${index + 1}</span><span class="prob-faces"></span>`;
    name.querySelector('.prob-faces').textContent = item.faces.join(' · ');
    const value = document.createElement('strong');
    value.textContent = `${(item.probability * 100).toLocaleString('vi-VN', { maximumFractionDigits: 2, minimumFractionDigits: 2 })}%`;
    heading.append(name, value);
    const detail = document.createElement('p');
    detail.textContent = `Tổng ${item.faces.reduce((a, b) => a + b, 0)}  ·  Lịch sử: ${item.count} lần`;
    const bar = document.createElement('div');
    bar.className = 'prob-bar';
    const fill = document.createElement('span');
    fill.style.width = `${Math.min(100, (item.probability / estimated[0].probability) * 100)}%`;
    bar.append(fill);
    li.append(heading, detail, bar);
    probabilityList.append(li);
  });

  const hoaResults = Array.from({ length: 6 }, (_, index) => {
    const face = index + 1;
    return { face, count: counts[`${face},${face},${face}`] || 0 };
  }).filter(item => item.count > 0).sort((a, b) => b.count - a.count || a.face - b.face);
  hoaList.replaceChildren();
  if (hoaResults.length) {
    const totalHoa = hoaResults.reduce((sum, item) => sum + item.count, 0);
    hoaStatus.textContent = `Có Hoa: ${totalHoa.toLocaleString('vi-VN')} lần trong ${sampleSize.toLocaleString('vi-VN')} kết quả tiếp theo.`;
    hoaResults.forEach(({ face, count }) => {
      const item = document.createElement('div');
      item.className = 'hoa-item';
      const faces = document.createElement('strong');
      faces.textContent = `${face} · ${face} · ${face}`;
      const detail = document.createElement('span');
      detail.textContent = `${count.toLocaleString('vi-VN')} lần · tổng ${face * 3}`;
      item.append(faces, detail);
      hoaList.append(item);
    });
  } else {
    hoaStatus.textContent = `Không có Hoa trong ${sampleSize.toLocaleString('vi-VN')} kết quả tiếp theo đã lọc.`;
  }

  const minutes = [29, 35, 41, 47, 53];
  const minuteData = data.minute_stats?.[String(periodCount)]?.[context] || {};
  minuteHoaBody.replaceChildren();
  minutes.forEach(minute => {
    const bucket = minuteData[String(minute)] || { sample: 0, hoa: {} };
    const hoaEntries = Object.entries(bucket.hoa).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'en', { numeric: true }));
    const row = document.createElement('tr');
    const minuteCell = document.createElement('td');
    minuteCell.className = 'minute-value';
    minuteCell.textContent = `:${minute}`;
    const sampleCell = document.createElement('td');
    sampleCell.textContent = bucket.sample.toLocaleString('vi-VN');
    const countCell = document.createElement('td');
    countCell.className = 'count';
    countCell.textContent = hoaEntries.reduce((sum, [, count]) => sum + count, 0).toLocaleString('vi-VN');
    const setsCell = document.createElement('td');
    setsCell.className = 'minute-sets';
    if (hoaEntries.length) {
      hoaEntries.forEach(([key, count]) => {
        const badge = document.createElement('span');
        badge.className = 'minute-set';
        badge.textContent = `${key.split(',').join(' · ')} (${count})`;
        setsCell.append(badge);
      });
    } else {
      setsCell.textContent = 'Không có';
    }
    row.append(minuteCell, sampleCell, countCell, setsCell);
    minuteHoaBody.append(row);
  });
  const unmapped = data.minute_coverage?.unmapped_records || 0;
  minuteCoverage.textContent = `Phút được suy ra theo lịch Bingo18: kỳ đầu 06:05, mỗi kỳ cách 6 phút.${unmapped ? ` Bỏ qua ${unmapped.toLocaleString('vi-VN')} kỳ chưa xác định chắc chắn phút.` : ''}`;

  samplePill.textContent = `${sampleSize.toLocaleString('vi-VN')} lần khớp`;
  resultsTitle.textContent = `Sau ${periodCount} kỳ đã nhập`;
  emptyState.hidden = true;
  resultsContent.hidden = false;
  document.getElementById('results').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

periodButtons.forEach(button => button.addEventListener('click', () => setPeriodCount(Number(button.dataset.periods))));
document.getElementById('analyze').addEventListener('click', analyze);
renderInputs();

fetch('./data.json')
  .then(response => {
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  })
  .then(payload => {
    data = payload;
    dataStatus.textContent = `${payload.records.toLocaleString('vi-VN')} kỳ · Đến ${new Date(`${payload.latest_date}T12:00:00`).toLocaleDateString('vi-VN')}`;
  })
  .catch(() => {
    dataStatus.textContent = 'Không tải được dữ liệu';
    clearResults('Không tải được dữ liệu. Vui lòng tải lại trang.');
  });
