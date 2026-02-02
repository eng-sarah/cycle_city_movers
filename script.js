// Cycle City Movers
// Cycle Sort is all about placing items into their final position with minimal writes.
// This game visualizes the cycle-chasing behavior on a permutation of 0..N-1.

const cityEl = document.getElementById('city');
const levelEl = document.getElementById('level');
const writesEl = document.getElementById('writes');
const timeEl = document.getElementById('time');
const optimalEl = document.getElementById('optimal');
const scoreEl = document.getElementById('score');

const toastEl = document.getElementById('toast');
const overlay = document.getElementById('overlay');
const modalTitle = document.getElementById('modalTitle');
const modalText = document.getElementById('modalText');
const cycleListEl = document.getElementById('cycleList');

const hintBtn = document.getElementById('hintBtn');
const newBtn = document.getElementById('newBtn');
const resetBtn = document.getElementById('resetBtn');
const undoBtn = document.getElementById('undoBtn');
const nextBtn = document.getElementById('nextBtn');
const replayBtn = document.getElementById('replayBtn');
const closeBtn = document.getElementById('closeBtn');

const eduToggle = document.getElementById('eduToggle');

const handEl = document.getElementById('hand');
const handCrate = document.getElementById('handCrate');
const carryingEl = document.getElementById('carrying');
const carryingHint = document.getElementById('carryingHint');

// State
let level = 1;
let N = 8;
let arr = [];     // arr[pos] = value (random int) or -1
let correctValues = []; // The sorted goal array
let writes = 0;
let score = 0;

let carrying = null; // crateId or null
let carryingFrom = null;

let historyStack = []; // Stack of states for undo

// Difficulty State
let timeRemaining = 0;
let startTime = 0;
let elapsedTime = 0;
let timerInterval = null;

let lockedIndices = [];
let cyclesCompleted = 0;

let fragileItems = [];
let fragileTimeoutId = null;
const FRAGILE_TIME = 8;

function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function colorFor(val, n) {
    if (val === -1) return 'transparent';
    // Use rank for color gradient
    const rank = correctValues.indexOf(val);
    if (rank === -1) return '#ccc'; // Should not happen

    const hue = 190 + Math.round((rank / n) * 140);
    return `linear-gradient(180deg, hsla(${hue}, 92%, 62%, .95), hsla(${hue}, 92%, 50%, .86))`;
}

function showToast(msg, kind = 'good') {
    toastEl.textContent = msg;
    toastEl.style.borderColor = kind === 'bad' ? 'rgba(255,92,122,.35)' : (kind === 'warn' ? 'rgba(255,207,92,.35)' : 'rgba(124,247,212,.35)');
    toastEl.style.background = kind === 'bad' ? 'rgba(255,92,122,.12)' : 'rgba(17,24,51,.86)';
    toastEl.classList.add('show');
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => toastEl.classList.remove('show'), 1300);
}

function isSorted() {
    for (let i = 0; i < N; i++) if (arr[i] !== correctValues[i]) return false;
    return true;
}

function cyclesOfPermutation(a) {
    const vis = new Array(a.length).fill(false);
    const cycles = [];
    for (let i = 0; i < a.length; i++) {
        if (vis[i]) continue;
        let j = i;
        const cycle = [];
        while (!vis[j]) {
            vis[j] = true;
            cycle.push(j);

            const val = a[j];
            // Target index is where 'val' belongs
            const target = correctValues.indexOf(val);

            j = target; // Next hop

            if (j === -1 || j === undefined || val === -1) {
                break;
            }
        }
        cycles.push(cycle);
    }
    return cycles;
}

function optimalWritesFor(a) {
    let misplaced = 0;
    for (let i = 0; i < a.length; i++) {
        if (a[i] !== correctValues[i]) misplaced++;
    }
    return misplaced;
}

function starsFor(w, opt) {
    if (w <= opt) return 3;
    if (w <= opt + Math.ceil(N * 0.15)) return 2;
    return 1;
}

function calcScore(w, opt) {
    const extra = Math.max(0, w - opt);
    const base = 100 + level * 20;
    const penalty = extra * 12;
    return Math.max(0, base - penalty);
}


function startTimer() {
    stopTimer();
    startTime = Date.now();
    elapsedTime = 0;

    updateTimerDisplay();
    timerInterval = setInterval(() => {
        elapsedTime = Math.floor((Date.now() - startTime) / 1000);
        updateTimerDisplay();
    }, 1000);
}

function stopTimer() {
    clearInterval(timerInterval);
}

function updateTimerDisplay() {
    timeEl.textContent = `${elapsedTime}s`;
    timeEl.style.color = 'var(--text)';
}

function failLevel(reason) {
    stopTimer();
    if (fragileTimeoutId) clearTimeout(fragileTimeoutId);
    showToast('⚠️ ' + reason + ' (Keep playing)', 'bad');
    score = Math.max(0, score - 50);
    scoreEl.textContent = score;
}

function setHand(crateId) {
    carrying = crateId;
    if (crateId == null) {
        handEl.classList.remove('hidden');

        handCrate.textContent = '—';
        handCrate.style.opacity = .25;
        handCrate.style.background = 'rgba(255,255,255,.06)';
        handCrate.style.borderColor = 'rgba(255,255,255,.10)';
        handCrate.classList.remove('fragile');
        carryingEl.textContent = 'none';
        carryingHint.style.color = 'var(--muted)';
        carryingHint.textContent = '';

        if (fragileTimeoutId) {
            clearTimeout(fragileTimeoutId);
            fragileTimeoutId = null;
        }

    } else {
        handEl.classList.remove('hidden');
        handCrate.textContent = String(crateId);
        handCrate.style.opacity = 1;
        handCrate.style.background = colorFor(crateId, N);
        handCrate.style.borderColor = 'rgba(255,255,255,.18)';
        handCrate.innerHTML = crateId;

        if (fragileItems.includes(crateId)) {
            handCrate.classList.add('fragile');
            carryingEl.innerHTML = `${crateId} <span style="color:var(--warn)">(FRAGILE)</span>`;
            carryingHint.style.color = 'var(--warn)';
            carryingHint.textContent = `Fragile! ${FRAGILE_TIME}s`;

            if (fragileTimeoutId) clearTimeout(fragileTimeoutId);
            fragileTimeoutId = setTimeout(() => {
                failLevel('Fragile crate broke.');
            }, FRAGILE_TIME * 1000);

        } else {
            handCrate.classList.remove('fragile');
            carryingEl.textContent = String(crateId);
            carryingHint.style.color = 'var(--muted)';
            carryingHint.textContent = '';
        }
    }
}

function gridColsFor(n) {
    if (n <= 8) return 4;
    if (n <= 12) return 4;
    if (n <= 16) return 4;
    if (n <= 20) return 5;
    return 6;
}

function render() {
    levelEl.textContent = level;
    writesEl.textContent = writes;
    const opt = initialOptimal;
    optimalEl.textContent = opt;
    scoreEl.textContent = score;

    cityEl.style.gridTemplateColumns = `repeat(${gridColsFor(N)}, minmax(0, 1fr))`;
    cityEl.innerHTML = '';

    if (cyclesCompleted >= 1 && lockedIndices.length > 0) {
        lockedIndices = [];
        showToast('Unlocked.', 'good');
    }

    for (let i = 0; i < N; i++) {
        const crateId = arr[i];

        const apt = document.createElement('div');
        apt.className = 'apt';
        if (crateId === correctValues[i]) apt.classList.add('sorted');

        if (lockedIndices.includes(i)) {
            apt.classList.add('locked');
        }

        if (crateId === -1) {
            apt.classList.add('picked');
            apt.style.background = 'rgba(0,0,0,0.3)';
            apt.style.borderColor = 'var(--accent)';
            apt.style.borderStyle = 'dashed';
        }

        if (carryingFrom === i && carrying != null) apt.classList.add('picked');

        const label = document.createElement('div');
        label.className = 'label';
        label.innerHTML = `<div class="small">#${i}</div><div class="big"><span class="k">${correctValues[i]}</span></div>`;

        const crate = document.createElement('div');
        crate.className = 'crate';

        if (crateId !== -1) {
            crate.textContent = crateId;
            crate.style.background = colorFor(crateId, N);
            if (fragileItems.includes(crateId)) crate.classList.add('fragile');
        } else {
            crate.style.opacity = 0;
        }

        apt.appendChild(label);
        apt.appendChild(crate);

        apt.addEventListener('click', () => onApartmentClick(i));
        cityEl.appendChild(apt);
    }
}

function onApartmentClick(i) {

    if (lockedIndices.includes(i)) {
        showToast('Locked', 'bad');
        return;
    }

    // Save state before
    pushState();

    if (carrying == null) {
        const val = arr[i];
        if (val === -1) return; // Empty

        carryingFrom = i;
        setHand(val);
        arr[i] = -1; // Leave hole
        showToast(`Picked up ${val}`, 'normal');
        render();
        return;
    }

    // Drop/Swap logic
    const homeIndex = correctValues.indexOf(carrying);
    const isCorrect = (i === homeIndex);

    const displaced = arr[i];
    const prevCarrying = carrying;
    arr[i] = carrying; // Fill spot

    if (displaced === -1) {
        // We filled the hole! Cycle Closed.
        showToast(`Cycle Closed at ${i}.`, 'good');

        setHand(null);
        carryingFrom = null;
        cyclesCompleted++;
        writes += 1; // Closing write
    } else {
        // We displaced an item.
        carrying = displaced;
        setHand(carrying);
        writes += 1;

        if (isCorrect) {
            showToast(`Correct placement in #${i}. Continue...`, 'good');
        } else {
            showToast(`Wrong placement in #${i}.`, 'bad');
        }
    }

    render();

    if (isSorted() && !overlay.classList.contains('show')) {
        setTimeout(finish, 1000);
    }
}

let initialArr = [];
let initialOptimal = 0;

// function pushState ... (needs correctValues? correctValues is constant for level)
// correctValues doesn't change during undo.

function pushState() {
    historyStack.push({
        arr: [...arr],
        writes: writes,
        score: score,
        carrying: carrying,
        carryingFrom: carryingFrom,
        cyclesCompleted: cyclesCompleted
    });
    undoBtn.disabled = false;
    undoBtn.style.opacity = 1;
}

function undoLastMove() {
    if (historyStack.length === 0) return;
    const state = historyStack.pop();

    arr = state.arr;
    writes = state.writes;
    score = state.score;
    carrying = state.carrying;
    carryingFrom = state.carryingFrom;
    cyclesCompleted = state.cyclesCompleted;

    setHand(carrying);
    render();
    showToast('Undo', 'warn');

    if (historyStack.length === 0) {
        undoBtn.disabled = true;
        undoBtn.style.opacity = 0.5;
    }
}

function openOverlay(title, htmlContent) {
    modalTitle.textContent = title;
    modalText.innerHTML = htmlContent;
    cycleListEl.innerHTML = '';
    overlay.classList.add('show');
}

function closeOverlay() {
    overlay.classList.remove('show');
}

function finish() {
    stopTimer();
    const stars = starsFor(writes, initialOptimal);
    const gained = calcScore(writes, initialOptimal);
    score += gained;

    const starStr = '<span style="color:#ffd700; font-size:1.5em; text-shadow:0 0 10px rgba(255,215,0,0.5);">' + '★'.repeat(stars) + '</span>' + '<span style="color:#555; font-size:1.5em;">' + '☆'.repeat(3 - stars) + '</span>';

    // Explicit comparison styling
    const comparison = `
    <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:12px; margin:20px 0; text-align:center;">
        <div style="background:rgba(255,255,255,0.05); padding:10px; border-radius:8px;">
            <div style="font-size:0.75em; color:var(--muted); text-transform:uppercase; letter-spacing:1px;">Moves</div>
            <div style="font-size:1.6em; font-weight:bold; color:var(--text);">${writes}</div>
        </div>
        <div style="background:rgba(255,255,255,0.05); padding:10px; border-radius:8px;">
            <div style="font-size:0.75em; color:var(--muted); text-transform:uppercase; letter-spacing:1px;">Time</div>
            <div style="font-size:1.6em; font-weight:bold; color:var(--text);">${elapsedTime}s</div>
        </div>
        <div style="background:rgba(124,247,212,0.1); padding:10px; border-radius:8px; border:1px solid rgba(124,247,212,0.3);">
            <div style="font-size:0.75em; color:var(--accent); text-transform:uppercase; letter-spacing:1px;">Optimal</div>
            <div style="font-size:1.6em; font-weight:bold; color:var(--accent);">${initialOptimal}</div>
        </div>
    </div>
    <div style="margin-top:10px; font-size:1.1em;">Rating: ${starStr}</div>
    <div style="margin-top:5px; color:var(--good);">+${gained} Points</div>
  `;

    openOverlay('Level Complete', comparison);
}

function newLevel(keepLevel = false) {
    if (!keepLevel) level += 1;
    N = Math.min(24, 8 + (level - 1) * 2);

    // Generate random values
    const pool = new Set();
    while (pool.size < N) {
        pool.add(randInt(1, 99));
    }
    correctValues = Array.from(pool).sort((a, b) => a - b);

    // Shuffle for initial arr
    arr = [...correctValues];
    for (let i = N - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    // Ensure not fully sorted
    if (arr.every((v, i) => v === correctValues[i])) {
        [arr[0], arr[1]] = [arr[1], arr[0]];
    }

    initialArr = arr.slice();
    initialOptimal = optimalWritesFor(arr);
    writes = 0;
    carryingFrom = null;
    cyclesCompleted = 0;
    historyStack = [];
    undoBtn.disabled = true;
    undoBtn.style.opacity = 0.5;
    setHand(null);

    configureDifficulty();

    render();
    startTimer();

    showToast(`Level ${level} start`, 'warn');
}

function configureDifficulty() {
    timeLimit = 0;
    lockedIndices = [];

    // Level difficulty logic
    // if (level >= 2) timeLimit = Math.max(30, N * 5); // Removed time limit

    if (level >= 3) {
        const notSorted = arr.map((v, i) => ({ v, i })).filter(x => x.v !== correctValues[x.i]);
        if (notSorted.length > 3) {
            lockedIndices = [notSorted[notSorted.length - 1].i, notSorted[notSorted.length - 2].i];
        }
    }

    if (level >= 4) {
        const count = 1 + Math.floor((level - 3) / 2);
        for (let k = 0; k < count; k++) {
            const id = correctValues[randInt(0, N - 1)]; // pick a valid value
            if (!fragileItems.includes(id)) fragileItems.push(id);
        }
    }
}

function replayLevel() {
    arr = initialArr.slice();
    writes = 0;
    cyclesCompleted = 0;
    setHand(null);
    historyStack = [];
    undoBtn.disabled = true;
    render();
    startTimer();
    showToast('Replay', 'warn');
}

function resetGame() {
    level = 1;
    score = 0;
    newLevel(true);
}

// makePermutation removed (inlined)

function showCycleHint() {
    // Clear any existing highlights first
    document.querySelectorAll('.cycle-highlight').forEach(el => el.classList.remove('cycle-highlight'));

    if (isSorted()) {
        showToast('No cycles - Sorted!', 'good');
        return;
    }

    const cycles = cyclesOfPermutation(arr);
    // Find first non-trivial cycle
    const cycle = cycles.find(c => c.length > 1);

    if (!cycle) {
        showToast('No cycles found.', 'normal');
        return;
    }

    // Highlight them
    const apts = document.querySelectorAll('.apt');
    cycle.forEach(idx => {
        if (apts[idx]) apts[idx].classList.add('cycle-highlight');
    });

    showToast(`Highlighting cycle of length ${cycle.length}`, 'normal');

    // Remove after 3s
    setTimeout(() => {
        document.querySelectorAll('.cycle-highlight').forEach(el => el.classList.remove('cycle-highlight'));
    }, 3000);
}

hintBtn.addEventListener('click', showCycleHint);
newBtn.addEventListener('click', () => newLevel(true));
resetBtn.addEventListener('click', resetGame);
undoBtn.addEventListener('click', undoLastMove);

nextBtn.addEventListener('click', () => { closeOverlay(); newLevel(false); });
replayBtn.addEventListener('click', () => { closeOverlay(); replayLevel(); });
closeBtn.addEventListener('click', closeOverlay);

resetGame();
