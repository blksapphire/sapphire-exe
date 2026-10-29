const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const coarsePointer = window.matchMedia('(hover: none), (pointer: coarse)').matches;
const MOBILE = () => window.innerWidth <= 760;

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
const store = {
  get(key) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch {
      /* storage blocked; the page still works */
    }
  }
};

/* ---------- sound ---------- */

let audioOn = store.get('sapphire.audio') !== 'off';
let audioCtx = null;

function ensureAudio() {
  if (!audioOn) return null;
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
  } catch {
    return null;
  }
}

function tone(freq, duration = 0.08, { type = 'square', gain = 0.035, delay = 0, slideTo = null } = {}) {
  const ctx = ensureAudio();
  if (!ctx) return;
  const start = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const amp = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, start + duration);
  amp.gain.setValueAtTime(gain, start);
  amp.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(amp).connect(ctx.destination);
  osc.start(start);
  osc.stop(start + duration + 0.02);
}

const sfx = {
  blip: () => tone(880, 0.05, { gain: 0.025 }),
  open: () => {
    tone(523.25, 0.06, { gain: 0.03 });
    tone(783.99, 0.07, { gain: 0.03, delay: 0.05 });
  },
  close: () => tone(392, 0.07, { gain: 0.028, slideTo: 262 }),
  error: () => tone(150, 0.18, { type: 'sawtooth', gain: 0.035 }),
  success: () => [659.25, 830.61, 1046.5].forEach((f, i) => tone(f, 0.12, { type: 'triangle', gain: 0.05, delay: i * 0.08 })),
  chime: () => [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, 0.22, { type: 'triangle', gain: 0.045, delay: i * 0.1 })),
  type: () => tone(1200 + Math.random() * 300, 0.02, { gain: 0.012 })
};

function setAudio(on, { silent = false } = {}) {
  audioOn = on;
  store.set('sapphire.audio', on ? 'on' : 'off');
  $$('#sound-toggle, #boot-sound').forEach((button) => {
    button.setAttribute('aria-pressed', String(on));
    if (button.id === 'boot-sound') button.textContent = `sound: ${on ? 'on' : 'off'}`;
  });
  if (on && !silent) sfx.blip();
}

/* ---------- boot ---------- */

const boot = $('#boot');
const bootGo = $('#boot-go');
const bootSound = $('#boot-sound');
const bootLog = $('#boot-log');
const os = $('#os');
let booted = false;
let bootTimer = null;
let booting = false;

const BOOT_LINES = [
  'SAPPHIRE BIOS v1.0 — POST',
  'CPU: 1 x overthinking @ 3.2GHz ............ OK',
  'MEM: 640K (ought to be enough) ........... OK',
  'Checking vibes ........................... OK',
  'Mounting /dev/charisma ................... OK',
  'Loading personality.dll .................. 100%',
  'WARNING: one (1) user detected. Unavoidable.',
  'Starting SAPPHIRE OS ...'
];

function revealOs() {
  if (booted) return;
  booted = true;
  os.inert = false;
  os.setAttribute('aria-hidden', 'false');
  boot.classList.add('is-gone');
  window.setTimeout(() => {
    boot.hidden = true;
  }, 300);
  $('#start-button').focus({ preventScroll: true });
  window.setTimeout(() => toast('Welcome', 'You have 6 icons and no instructions. Try not to click the red one.'), 900);
  resetIdle();
}

function startBoot() {
  if (booting || booted) return;
  booting = true;
  ensureAudio();
  if (audioOn) sfx.chime();
  $$('.boot-copy, .boot-actions, .boot-hint, .boot-tagline', boot).forEach((node) => {
    node.style.display = 'none';
  });
  bootLog.textContent = '';
  const finish = () => {
    if (booted) return;
    booting = false;
    if (bootTimer) window.clearInterval(bootTimer);
    if (reduceMotion) bootLog.textContent = BOOT_LINES.join('\n');
    revealOs();
  };
  if (reduceMotion) {
    bootLog.textContent = BOOT_LINES.join('\n');
    window.setTimeout(revealOs, 120);
    return;
  }
  let index = 0;
  bootTimer = window.setInterval(() => {
    if (index >= BOOT_LINES.length) {
      finish();
      return;
    }
    bootLog.textContent += `${index ? '\n' : ''}${BOOT_LINES[index]}`;
    sfx.type();
    index += 1;
  }, 170);
  boot.addEventListener('click', finish, { once: true });
  boot.addEventListener('keydown', finish, { once: true });
}

bootGo.addEventListener('click', (event) => {
  event.stopPropagation();
  startBoot();
});

bootSound.addEventListener('click', (event) => {
  event.stopPropagation();
  setAudio(!audioOn);
});

boot.addEventListener('keydown', (event) => {
  if (!booting && booted) return;
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    startBoot();
  }
});

/* ---------- toasts ---------- */

function toast(title, message) {
  const stack = $('#toasts');
  const node = document.createElement('div');
  node.className = 'toast';
  const heading = document.createElement('strong');
  heading.textContent = title;
  const body = document.createElement('span');
  body.textContent = message;
  node.append(heading, body);
  stack.appendChild(node);
  while (stack.children.length > 3) stack.firstElementChild.remove();
  if (audioOn) sfx.blip();
  window.setTimeout(() => node.remove(), 7000);
}

/* ---------- windows ---------- */

const layer = $('#windows');
const taskWindows = $('#task-windows');
const labels = {
  about: 'about_me.txt',
  work: 'work/',
  links: 'links',
  terminal: 'terminal',
  trash: 'recycle_bin'
};
const openWindows = new Set();
let focusedWin = null;
let zCounter = 10;
let openedCount = 0;

function winEl(name) {
  return $(`.win[data-win="${name}"]`);
}

function positionWindow(win) {
  if (MOBILE()) {
    win.style.left = '';
    win.style.top = '';
    return;
  }
  const layerRect = layer.getBoundingClientRect();
  const width = win.offsetWidth;
  const height = win.offsetHeight;
  const offset = openedCount % 6;
  const left = clamp(140 + offset * 30, 8, Math.max(8, layerRect.width - width - 12));
  const top = clamp(26 + offset * 22, 8, Math.max(8, layerRect.height - Math.min(height, layerRect.height - 20) - 8));
  win.style.left = `${Math.round(left)}px`;
  win.style.top = `${Math.round(top)}px`;
}

function focusWindow(win) {
  if (!win || win.hidden) return;
  $$('.win').forEach((node) => node.classList.toggle('is-focused', node === win));
  zCounter += 1;
  win.style.zIndex = String(zCounter);
  focusedWin = win;
  updateTaskbar();
}

function updateTaskbar() {
  taskWindows.textContent = '';
  openWindows.forEach((name) => {
    const win = winEl(name);
    if (!win) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'task-win';
    button.dataset.task = name;
    button.textContent = labels[name];
    if (!win.hidden && win === focusedWin) button.classList.add('active');
    button.addEventListener('click', () => {
      if (!win.hidden && win === focusedWin) {
        minimizeWindow(win);
      } else if (win.hidden) {
        openWindow(name);
      } else {
        focusWindow(win);
        sfx.blip();
      }
    });
    taskWindows.appendChild(button);
  });
}

function openerFor(name) {
  return $$(`[data-open="${name}"]`).find((node) => node.offsetParent !== null) || $('#start-button');
}

function openWindow(name) {
  const win = winEl(name);
  if (!win) return;
  const firstOpen = win.hidden;
  if (firstOpen) {
    win.hidden = false;
    positionWindow(win);
    openedCount += 1;
  }
  openWindows.add(name);
  focusWindow(win);
  if (audioOn) sfx.open();
  const target = win.querySelector('.win-body');
  if (target) target.scrollTop = 0;
  closeLauncher();
  win.focus({ preventScroll: true });
  if (name === 'terminal') {
    const input = $('#term-input');
    if (input) input.focus({ preventScroll: true });
  }
}

function minimizeWindow(win) {
  win.hidden = true;
  if (focusedWin === win) focusedWin = null;
  const name = win.dataset.win;
  const opener = openerFor(name);
  if (opener) opener.focus({ preventScroll: true });
  if (audioOn) sfx.close();
  updateTaskbar();
}

function closeWindow(win) {
  if (!win || win.hidden) return;
  const name = win.dataset.win;
  win.hidden = true;
  openWindows.delete(name);
  if (focusedWin === win) focusedWin = null;
  const opener = openerFor(name);
  if (opener) opener.focus({ preventScroll: true });
  if (audioOn) sfx.close();
  updateTaskbar();
}

$$('.win').forEach((win) => {
  win.addEventListener('pointerdown', () => focusWindow(win));
  win.querySelectorAll('[data-win-close]').forEach((button) =>
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      closeWindow(win);
    })
  );
  win.querySelectorAll('[data-win-min]').forEach((button) =>
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      minimizeWindow(win);
    })
  );

  const bar = win.querySelector('.win-bar');
  let drag = null;
  bar.addEventListener('pointerdown', (event) => {
    if (MOBILE() || event.button !== 0 || event.target.closest('button')) return;
    const layerRect = layer.getBoundingClientRect();
    const winRect = win.getBoundingClientRect();
    drag = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      left: winRect.left - layerRect.left,
      top: winRect.top - layerRect.top,
      width: winRect.width,
      layerWidth: layerRect.width,
      layerHeight: layerRect.height
    };
    bar.setPointerCapture(event.pointerId);
    focusWindow(win);
  });
  bar.addEventListener('pointermove', (event) => {
    if (!drag || drag.pointerId !== event.pointerId) return;
    const left = clamp(drag.left + (event.clientX - drag.startX), 4, Math.max(4, drag.layerWidth - drag.width - 4));
    const top = clamp(drag.top + (event.clientY - drag.startY), 4, Math.max(4, drag.layerHeight - 120));
    win.style.left = `${Math.round(left)}px`;
    win.style.top = `${Math.round(top)}px`;
  });
  const endDrag = (event) => {
    if (!drag || drag.pointerId !== event.pointerId) return;
    drag = null;
    if (bar.hasPointerCapture(event.pointerId)) bar.releasePointerCapture(event.pointerId);
  };
  bar.addEventListener('pointerup', endDrag);
  bar.addEventListener('pointercancel', endDrag);
});

$$('[data-open]').forEach((button) => {
  if (button.closest('.win')) return;
  button.addEventListener('click', () => openWindow(button.dataset.open));
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    if (document.body.classList.contains('party')) {
      document.body.classList.remove('party');
      toast('Party over', 'Back to your regularly scheduled blues.');
      return;
    }
    if (focusedWin && !focusedWin.hidden) {
      closeWindow(focusedWin);
      return;
    }
    closeLauncher();
  }
});

/* ---------- launcher ---------- */

const launcher = $('#launcher');
const startButton = $('#start-button');

function closeLauncher() {
  launcher.hidden = true;
  startButton.setAttribute('aria-expanded', 'false');
}

startButton.setAttribute('aria-expanded', 'false');
startButton.addEventListener('click', () => {
  const willOpen = launcher.hidden;
  launcher.hidden = !willOpen;
  startButton.setAttribute('aria-expanded', String(willOpen));
  if (willOpen) {
    const first = launcher.querySelector('.launcher-item');
    if (first) first.focus();
  }
  sfx.blip();
});

launcher.addEventListener('click', (event) => {
  if (event.target === launcher) closeLauncher();
});

$$('.launcher-item[data-open]').forEach((button) =>
  button.addEventListener('click', () => openWindow(button.dataset.open))
);

document.addEventListener('pointerdown', (event) => {
  if (!launcher.hidden && !event.target.closest('#launcher') && !event.target.closest('#start-button')) closeLauncher();
});

/* ---------- clock ---------- */

function tickClock() {
  const now = new Date();
  const time = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Lagos',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(now);
  $('#clock').textContent = time;
}
tickClock();
window.setInterval(tickClock, 10000);

/* ---------- sound toggle ---------- */

$('#sound-toggle').addEventListener('click', () => setAudio(!audioOn));
setAudio(audioOn, { silent: true });

/* ---------- plain mode ---------- */

const plainAnchor = $('#plain');

function setPlainMode(on) {
  document.body.classList.toggle('plain-mode', on);
  if (on) {
    plainAnchor.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  } else {
    startButton.focus({ preventScroll: true });
  }
  sfx.blip();
}

$('#plain-toggle').addEventListener('click', () => setPlainMode(!document.body.classList.contains('plain-mode')));
$('#launcher-plain').addEventListener('click', () => setPlainMode(true));
$('#plain-back').addEventListener('click', () => setPlainMode(false));

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && document.body.classList.contains('plain-mode')) setPlainMode(false);
});

$('.skip-link').addEventListener('click', (event) => {
  event.preventDefault();
  setPlainMode(true);
});

/* ---------- terminal ---------- */

const termOut = $('#term-out');
const termForm = $('#term-form');
const termInput = $('#term-input');
const history = [];
let historyIndex = 0;

function printTerm(text, className = '') {
  const line = document.createElement('p');
  if (className) line.className = className;
  line.textContent = text;
  termOut.appendChild(line);
  termOut.scrollTop = termOut.scrollHeight;
}

function printEcho(command) {
  const line = document.createElement('p');
  const prompt = document.createElement('span');
  prompt.className = 'term-cmd';
  prompt.textContent = 'sapphire@lagos:~$ ';
  line.append(prompt, document.createTextNode(command));
  termOut.appendChild(line);
  termOut.scrollTop = termOut.scrollHeight;
}

const commands = {
  help() {
    [
      'available commands:',
      '  whoami        who is this',
      '  ls            list things',
      '  open <x>      about | work | links | trash',
      '  cat bio       the short version',
      '  date          Lagos time',
      '  sudo          do not',
      '  hack          also do not',
      '  coffee        yes',
      '  contact       how to reach me',
      '  clear         wipe the screen',
      '  exit          leave gracefully'
    ].forEach((line) => printTerm(line));
  },
  whoami() {
    printTerm('The Sapphire — product engineer. Lagos, Nigeria.');
    printTerm('Designs, builds and ships web products end to end. Open to contract work.');
  },
  ls() {
    printTerm('about_me.txt   work/   links   terminal   recycle_bin/   DO_NOT_CLICK');
  },
  contact() {
    printTerm('email     mayowaa416@gmail.com');
    printTerm('whatsapp  links window → WhatsApp (number not printed)');
    printTerm('x         @mayowaa416');
  },
  open(arg) {
    const target = (arg || '').toLowerCase().replace(/\/$/, '');
    const map = {
      about: 'about',
      'about_me.txt': 'about',
      'about_me': 'about',
      work: 'work',
      links: 'links',
      trash: 'trash',
      bin: 'trash',
      recycle_bin: 'trash'
    };
    if (!map[target]) {
      printTerm(`nothing called "${arg || 'that'}" lives here. try: about, work, links, trash`, 'term-err');
      sfx.error();
      return;
    }
    printTerm(`opening ${labels[map[target]]} ...`);
    openWindow(map[target]);
  },
  cat(arg) {
    if (!arg || !/^(bio|about|about_me\.txt)$/i.test(arg)) {
      printTerm('usage: cat bio', 'term-err');
      return;
    }
    printTerm('I build web products end to end — interface, logic, deploy. Available for');
    printTerm('contract work. Biggest build: IdeaBlend. Smaller tools are local-first by design.');
  },
  date() {
    const now = new Date();
    const lagos = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Africa/Lagos',
      dateStyle: 'full',
      timeStyle: 'medium'
    }).format(now);
    printTerm(`Lagos: ${lagos} (WAT)`);
    printTerm(`UTC:   ${now.toISOString()}`);
  },
  sudo() {
    printTerm('Permission denied. This incident has been reported to your mother.', 'term-err');
    sfx.error();
  },
  hack() {
    const steps = ['initialising exploit kit ...', 'bypassing firewall ...', 'accessing mainframe ...'];
    steps.forEach((step, index) => window.setTimeout(() => printTerm(step), index * 450));
    window.setTimeout(() => {
        printTerm("just kidding. there's no backend to hack. it's HTML and one strong opinion about kerning.", 'term-err');
      sfx.error();
    }, steps.length * 450 + 200);
  },
  coffee() {
    ['      ( (', '       ) )', '    ..........', '    |        |]', '    \\        /', "     `------'"].forEach((line) => printTerm(line));
    printTerm('coffee.exe complete. productivity not guaranteed.');
  },
  clear() {
    termOut.textContent = '';
  },
  exit() {
    printTerm('logging off. the sun is up anyway.');
    const win = winEl('terminal');
    window.setTimeout(() => closeWindow(win), 300);
  },
  konami() {
    printTerm('↑ ↑ ↓ ↓ ← → ← → B A — but you did not hear it from me.');
  },
  echo(...parts) {
    printTerm(parts.join(' '));
  }
};

termForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const raw = termInput.value.trim();
  termInput.value = '';
  if (!raw) return;
  printEcho(raw);
  history.push(raw);
  historyIndex = history.length;
  const [name, ...rest] = raw.split(/\s+/);
  const command = commands[name.toLowerCase()];
  if (!command) {
    printTerm(`command not found: ${name}. try "help".`, 'term-err');
    sfx.error();
    return;
  }
  command(rest.join(' ').trim());
});

termInput.addEventListener('keydown', (event) => {
  if (event.key === 'ArrowUp') {
    if (!history.length) return;
    event.preventDefault();
    historyIndex = Math.max(0, historyIndex - 1);
    termInput.value = history[historyIndex];
  } else if (event.key === 'ArrowDown') {
    if (!history.length) return;
    event.preventDefault();
    historyIndex = Math.min(history.length, historyIndex + 1);
    termInput.value = historyIndex >= history.length ? '' : history[historyIndex];
  }
});

/* ---------- recycle bin ---------- */

$('#restore-confidence').addEventListener('click', () => {
  const result = $('#restore-result');
  result.textContent = 'Error 404 — file not found. Some things should stay deleted. You are welcome.';
  sfx.error();
});

/* ---------- easter eggs ---------- */

const particlesCanvas = $('#sparkles');
const pctx = particlesCanvas.getContext('2d');
let particles = [];
let rafId = null;
const GEM_COLORS = ['#a6c0d8', '#6d8fb3', '#e0e8f0', '#93a78e', '#d4ad66'];

function sizeCanvas() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  particlesCanvas.width = Math.floor(window.innerWidth * dpr);
  particlesCanvas.height = Math.floor(window.innerHeight * dpr);
  pctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
sizeCanvas();
window.addEventListener('resize', sizeCanvas);

function spawn(x, y, { count = 1, speed = 2, gravity = 0, life = 34, size = 3, colors = GEM_COLORS } = {}) {
  if (reduceMotion) return;
  for (let i = 0; i < count; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const velocity = Math.random() * speed;
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * velocity,
      vy: Math.sin(angle) * velocity - (gravity ? 2.6 : 0),
      g: gravity,
      life,
      maxLife: life,
      size: size + Math.random() * 2,
      color: colors[Math.floor(Math.random() * colors.length)]
    });
  }
  if (!rafId) rafId = requestAnimationFrame(drawParticles);
}

function drawParticles() {
  pctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
  particles = particles.filter((p) => p.life > 0 && p.y < window.innerHeight + 40);
  particles.forEach((p) => {
    p.x += p.vx;
    p.y += p.vy;
    p.vy += p.g;
    p.vx *= 0.99;
    p.life -= 1;
    pctx.globalAlpha = Math.max(0, p.life / p.maxLife);
    pctx.fillStyle = p.color;
    pctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
  });
  pctx.globalAlpha = 1;
  rafId = particles.length ? requestAnimationFrame(drawParticles) : null;
  if (!rafId) pctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
}

if (!coarsePointer && !reduceMotion) {
  let lastSpawn = 0;
  window.addEventListener('pointermove', (event) => {
    const now = performance.now();
    if (now - lastSpawn < 40) return;
    lastSpawn = now;
    spawn(event.clientX, event.clientY, { count: 2, speed: 1.4, life: 26, size: 2 });
  });
}

function confetti(x, y, count = 90) {
  spawn(x, y, { count, speed: 7, gravity: 0.22, life: 90, size: 3 });
  if (audioOn) sfx.success();
}

let clickCount = 0;
const clickLines = [
  ['You clicked it', 'Achievement unlocked: Instructions Unclear. There is no prize. There never was.'],
  ['Again?', 'The button is a bit of text. You are fighting a website.'],
  ['Fine.', 'Party mode engaged. Press Esc when the colours become a problem.']
];

$('#do-not-click').addEventListener('click', (event) => {
  const [title, body] = clickLines[Math.min(clickCount, clickLines.length - 1)];
  clickCount += 1;
  toast(title, body);
  confetti(event.clientX, event.clientY, clickCount >= 3 ? 140 : 70);
  if (clickCount >= 3) document.body.classList.add('party');
});

const KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
let konamiIndex = 0;
document.addEventListener('keydown', (event) => {
  if (event.target.matches('input, textarea, select')) return;
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  if (key === KONAMI[konamiIndex]) {
    konamiIndex += 1;
    if (konamiIndex === KONAMI.length) {
      konamiIndex = 0;
      document.body.classList.add('party');
      confetti(window.innerWidth / 2, window.innerHeight / 2, 160);
      toast('Cheat code accepted', 'Party mode. You absolute nerd. Press Esc to stop.');
    }
  } else {
    konamiIndex = key === KONAMI[0] ? 1 : 0;
  }
});

/* ---------- idle screensaver ---------- */

const screensaver = $('#screensaver');
let idleTimer = null;

function hideScreensaver() {
  screensaver.hidden = true;
}

function resetIdle() {
  if (reduceMotion || !booted) return;
  if (idleTimer) window.clearTimeout(idleTimer);
  idleTimer = window.setTimeout(() => {
    if (document.hidden) return;
    screensaver.hidden = false;
  }, 120000);
}

['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart'].forEach((type) => {
  window.addEventListener(type, () => {
    if (!screensaver.hidden) hideScreensaver();
    resetIdle();
  }, { passive: true });
});

/* ---------- misc ---------- */

window.addEventListener('resize', () => {
  if (MOBILE()) return;
  $$('.win:not([hidden])').forEach((win) => {
    const layerRect = layer.getBoundingClientRect();
    const rect = win.getBoundingClientRect();
    const maxLeft = Math.max(4, layerRect.width - rect.width - 4);
    const maxTop = Math.max(4, layerRect.height - 120);
    win.style.left = `${clamp(rect.left - layerRect.left, 4, maxLeft)}px`;
    win.style.top = `${clamp(rect.top - layerRect.top, 4, maxTop)}px`;
  });
});
