(() => {
  'use strict';

  const QUESTIONS = [
    {
      id: 'resor',
      category: 'Resor till jobbet',
      text: 'Har du rest till och från jobbet med egen bil eller kollektivtrafik under året?',
      followups: [
        { id: 'dagar', label: 'Antal resdagar per år', type: 'number', placeholder: 't.ex. 210', min: 0, max: 366 },
        { id: 'avstand', label: 'Avstånd enkel väg (km)', type: 'number', placeholder: 't.ex. 18', min: 0 },
        { id: 'fardsatt', label: 'Färdsätt', type: 'select', options: ['Bil', 'Kollektivtrafik'] }
      ],
      compute(a) {
        const dagar = Number(a.dagar) || 0;
        const avstand = Number(a.avstand) || 0;
        const km = dagar * avstand * 2;
        const satsPerMil = a.fardsatt === 'Bil' ? 25 : 15;
        const belopp = Math.round((km / 10) * satsPerMil);
        return {
          badge: 'Reseavdrag',
          title: 'Avdrag för resor till och från arbetet',
          amount: belopp,
          motivation: `${dagar} dagar × ${avstand} km enkel väg (${a.fardsatt.toLowerCase()}) ger ett uppskattat reseavdrag efter schablonbeloppet.`,
          source: 'Skatteverket — Avdrag för resor till och från arbetet'
        };
      }
    },
    {
      id: 'kapital',
      category: 'Ränta & kapital',
      text: 'Har du haft ränteutgifter (t.ex. bolån) eller sålt aktier/fonder med förlust under året?',
      followups: [
        { id: 'belopp', label: 'Ungefärlig ränteutgift eller förlust (kr)', type: 'number', placeholder: 't.ex. 24000', min: 0 }
      ],
      compute(a) {
        const belopp = Number(a.belopp) || 0;
        const skattereduktion = Math.round(belopp * 0.30);
        return {
          badge: 'Ränta & kapital',
          title: 'Skattereduktion för ränteutgifter / förlustavdrag',
          amount: skattereduktion,
          motivation: `Cirka 30% skattereduktion på ${belopp.toLocaleString('sv-SE')} kr i ränteutgifter/förluster, om det inte redan finns förifyllt.`,
          source: 'Skatteverket — Ränteavdrag och kapitalvinst/-förlust'
        };
      }
    },
    {
      id: 'rutrot',
      category: 'RUT & ROT',
      text: 'Har du anlitat hantverkare eller städhjälp och betalat innan avdraget drogs?',
      followups: [
        { id: 'arbetskostnad', label: 'Total arbetskostnad (kr, exkl. material)', type: 'number', placeholder: 't.ex. 15000', min: 0 }
      ],
      compute(a) {
        const kostnad = Number(a.arbetskostnad) || 0;
        const avdrag = Math.round(Math.min(kostnad * 0.5, 50000));
        return {
          badge: 'RUT / ROT',
          title: 'Ej utnyttjat RUT/ROT-avdrag',
          amount: avdrag,
          motivation: `50% av ${kostnad.toLocaleString('sv-SE')} kr i arbetskostnad, om beloppet inte redan är avdraget av utföraren.`,
          source: 'Skatteverket — RUT- och ROT-avdrag'
        };
      }
    },
    {
      id: 'dubbel',
      category: 'Dubbel bosättning',
      text: 'Har du haft tillfälligt boende på annan ort på grund av jobbet, samtidigt som du behållit bostad hemma?',
      followups: [],
      needsReview: true,
      compute() {
        return {
          badge: 'Dubbel bosättning',
          title: 'Möjligt avdrag för dubbel bosättning',
          amount: null,
          motivation: 'Beloppet beror på flera faktorer (avstånd, boendekostnad, tidsperiod) — kräver manuell kontroll mot dina uppgifter.',
          source: 'Skatteverket — Tillfälligt arbete och dubbel bosättning'
        };
      }
    }
  ];

  const state = { answers: {}, qIndex: 0, results: [] };

  const views = {
    landing: document.getElementById('view-landing'),
    upload: document.getElementById('view-upload'),
    interview: document.getElementById('view-interview'),
    report: document.getElementById('view-report')
  };

  function showView(name) {
    Object.values(views).forEach(v => v.classList.remove('active'));
    views[name].classList.add('active');
    const heading = views[name].querySelector('h1, h2');
    if (heading) {
      heading.setAttribute('tabindex', '-1');
      heading.focus({ preventScroll: false });
    }
    window.scrollTo({ top: 0, behavior: 'auto' });
  }

  // ---- Landing ----
  document.querySelectorAll('.js-start-analysis').forEach(btn => {
    btn.addEventListener('click', () => showView('upload'));
  });

  // ---- Upload ----
  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('file-input');
  const progressPanel = document.getElementById('progress-panel');
  const btnExample = document.getElementById('btn-example');

  function beginAnalysis() {
    dropzone.querySelectorAll('.icon-badge, h3, p, button, input').forEach(el => { el.style.display = 'none'; });
    progressPanel.hidden = false;
    const steps = progressPanel.querySelectorAll('.progress-step');
    steps.forEach(s => s.classList.remove('active', 'done'));

    let i = 0;
    function nextStep() {
      if (i > 0) steps[i - 1].classList.remove('active');
      if (i > 0) steps[i - 1].classList.add('done');
      if (i < steps.length) {
        steps[i].classList.add('active');
        i++;
        setTimeout(nextStep, 650);
      } else {
        setTimeout(() => {
          state.qIndex = 0;
          state.answers = {};
          renderQuestion();
          showView('interview');
        }, 500);
      }
    }
    nextStep();
  }

  dropzone.addEventListener('click', (e) => {
    if (e.target === btnExample) return;
    fileInput.click();
  });
  dropzone.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); }
  });
  fileInput.addEventListener('change', () => { if (fileInput.files.length) beginAnalysis(); });
  btnExample.addEventListener('click', beginAnalysis);

  ['dragover', 'dragenter'].forEach(evt => dropzone.addEventListener(evt, (e) => {
    e.preventDefault();
    dropzone.classList.add('dragover');
  }));
  ['dragleave', 'drop'].forEach(evt => dropzone.addEventListener(evt, (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
  }));
  dropzone.addEventListener('drop', (e) => {
    if (e.dataTransfer.files.length) beginAnalysis();
  });

  // ---- Interview ----
  const questionContainer = document.getElementById('question-container');
  const stepperFill = document.getElementById('stepper-fill');
  const stepperLabel = document.getElementById('stepper-label');
  const btnBack = document.getElementById('btn-back');
  const btnNext = document.getElementById('btn-next');

  function currentAnswer() {
    const q = QUESTIONS[state.qIndex];
    return state.answers[q.id] || (state.answers[q.id] = { yes: null });
  }

  function renderQuestion() {
    const q = QUESTIONS[state.qIndex];
    const a = currentAnswer();

    stepperFill.style.width = `${((state.qIndex + 1) / QUESTIONS.length) * 100}%`;
    stepperLabel.textContent = `Fråga ${state.qIndex + 1} av ${QUESTIONS.length}`;

    let html = `
      <div class="question-category">${q.category}</div>
      <div class="question-text">${q.text}</div>
      <div class="choice-row" role="group" aria-label="Svarsalternativ">
        <button type="button" class="choice-btn" data-choice="yes" aria-pressed="${a.yes === true}">Ja</button>
        <button type="button" class="choice-btn" data-choice="no" aria-pressed="${a.yes === false}">Nej</button>
      </div>
    `;

    if (a.yes === true && q.followups.length) {
      html += '<div class="followup">';
      for (const f of q.followups) {
        const val = a[f.id] ?? '';
        if (f.type === 'select') {
          html += `<div class="field-group"><label for="f-${f.id}">${f.label}</label>
            <select id="f-${f.id}" data-field="${f.id}">
              <option value="" ${val === '' ? 'selected' : ''} disabled>Välj...</option>
              ${f.options.map(o => `<option value="${o}" ${val === o ? 'selected' : ''}>${o}</option>`).join('')}
            </select></div>`;
        } else {
          html += `<div class="field-group"><label for="f-${f.id}">${f.label}</label>
            <input id="f-${f.id}" data-field="${f.id}" type="number" inputmode="numeric" placeholder="${f.placeholder || ''}" min="${f.min ?? ''}" ${f.max ? `max="${f.max}"` : ''} value="${val}">
            </div>`;
        }
      }
      html += '</div>';
    }

    questionContainer.innerHTML = html;

    questionContainer.querySelectorAll('.choice-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        a.yes = btn.dataset.choice === 'yes';
        renderQuestion();
      });
    });
    questionContainer.querySelectorAll('[data-field]').forEach(input => {
      input.addEventListener('input', () => {
        a[input.dataset.field] = input.value;
        updateNextState();
      });
    });

    btnBack.disabled = state.qIndex === 0;
    btnNext.textContent = state.qIndex === QUESTIONS.length - 1 ? 'Se resultat' : 'Nästa';
    updateNextState();
  }

  function updateNextState() {
    const q = QUESTIONS[state.qIndex];
    const a = currentAnswer();
    let ok = a.yes !== null;
    if (ok && a.yes === true && q.followups.length) {
      ok = q.followups.every(f => a[f.id] !== undefined && a[f.id] !== '');
    }
    btnNext.disabled = !ok;
  }

  btnBack.addEventListener('click', () => {
    if (state.qIndex > 0) { state.qIndex--; renderQuestion(); }
  });

  btnNext.addEventListener('click', () => {
    if (state.qIndex < QUESTIONS.length - 1) {
      state.qIndex++;
      renderQuestion();
    } else {
      buildReport();
      showView('report');
    }
  });

  // ---- Report ----
  const summaryAmount = document.getElementById('summary-amount');
  const summarySub = document.getElementById('summary-sub');
  const resultList = document.getElementById('result-list');

  function buildReport() {
    state.results = [];
    let total = 0;
    let reviewCount = 0;

    for (const q of QUESTIONS) {
      const a = state.answers[q.id];
      if (a && a.yes === true) {
        const r = q.compute(a);
        state.results.push(r);
        if (typeof r.amount === 'number') total += r.amount;
        if (q.needsReview) reviewCount++;
      }
    }

    summaryAmount.textContent = `${total.toLocaleString('sv-SE')} kr`;
    summarySub.textContent = reviewCount
      ? `Baserat på dina svar — ${reviewCount} post kräver manuell kontroll`
      : 'Baserat på dina svar';

    if (!state.results.length) {
      resultList.innerHTML = '<div class="empty-note">Inga uppenbara avdrag hittades utifrån dina svar den här gången. Bra jobbat — din deklaration ser redan komplett ut på de kontrollerade områdena.</div>';
      return;
    }

    resultList.innerHTML = state.results.map(r => `
      <div class="result-item">
        <div class="result-item-head">
          <div>
            <span class="badge">${r.badge}</span>
            <h3>${r.title}</h3>
          </div>
          <span class="amount">${typeof r.amount === 'number' ? r.amount.toLocaleString('sv-SE') + ' kr' : 'Kräver koll'}</span>
        </div>
        <p class="motivation">${r.motivation}</p>
        <p class="source">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3-7 3V5z"/></svg>
          Källa: ${r.source}
        </p>
      </div>
    `).join('');
  }

  document.getElementById('btn-restart').addEventListener('click', () => {
    state.answers = {};
    state.qIndex = 0;
    dropzone.querySelectorAll('.icon-badge, h3, p, button, input').forEach(el => { el.style.display = ''; });
    progressPanel.hidden = true;
    fileInput.value = '';
    showView('landing');
  });

  document.getElementById('btn-download').addEventListener('click', () => {
    const lines = [
      '# Deklarationskontrollen — rapport (mockup)',
      '',
      `**Möjlig besparing:** ${summaryAmount.textContent}`,
      '',
      ...state.results.flatMap(r => [
        `## ${r.title}`,
        `- Kategori: ${r.badge}`,
        `- Belopp: ${typeof r.amount === 'number' ? r.amount.toLocaleString('sv-SE') + ' kr' : 'Kräver manuell kontroll'}`,
        `- Motivering: ${r.motivation}`,
        `- Källa: ${r.source}`,
        ''
      ])
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'deklarationskontrollen-rapport.md';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });
})();
