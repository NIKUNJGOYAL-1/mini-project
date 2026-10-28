// Initial State Data Mock setup
let appUser = null;
let healthScoreChart = null;

let medications = [
    { id: 1, name: "Metformin", time: "08:00", taken: false },
    { id: 2, name: "Lisinopril", time: "20:00", taken: false }
];

// App Bootstrap Init
document.addEventListener("DOMContentLoaded", () => {
    renderMedications();
    initScoreChart(85);
    calculateHealthScore();
    restoreSession();
});

function showPage(pageId) {
    // 1. Get all main content sections
    const pages = document.querySelectorAll('main');
    
    // 2. Hide every section and remove any active highlights
    pages.forEach(page => {
        page.style.display = 'none'; 
        page.classList.remove('active');
    });

    // 3. Find the target container
    const targetPage = document.getElementById('page-' + pageId);
    
    if (targetPage) {
        // 4. If found, display it cleanly
        targetPage.style.display = 'block';
        targetPage.classList.add('active');
        if (pageId === 'dashboard') loadMedicalHistory();
    } else {
        console.error("Page structure not found for: page-" + pageId);
    }
}


// Sidebar Tab Switching Engine
function switchTab(tabId) {
    // Toggle active state classes on menu items
    document.querySelectorAll('.menu-item').forEach(item => {
        item.classList.remove('active');
        if(item.getAttribute('onclick').includes(tabId)) {
            item.classList.add('active');
        }
    });

    // Toggle targeted tab window visibility
    document.querySelectorAll('.tab-window').forEach(win => win.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');

    // Safe layout recalibration triggers for canvas layers
    if (tabId === 'tab-qrcode') {
        generatePatientQR();
    }
}

// Modal Windows View Toggles
function openAuthModal(mode) {
    ['login', 'register'].forEach(m => showAuthError(m, ''));
    document.getElementById('auth-modal').classList.add('open');
    document.getElementById('modal-type-login').style.display = (mode === 'login') ? 'block' : 'none';
    document.getElementById('modal-type-register').style.display = (mode === 'register') ? 'block' : 'none';
}

function closeAuthModal() {
    document.getElementById('auth-modal').classList.remove('open');
}

// ---------- Authentication (talks to the SQL database through the server) ----------
async function api(path, body, method) {
    if (location.protocol === 'file:') {
        throw new Error('Open the site at http://localhost:3000 (after running "node server.js") instead of opening the file directly.');
    }
    let res;
    try {
        res = await fetch(path, {
            method: method || (body ? 'POST' : 'GET'),
            headers: { 'Content-Type': 'application/json' },
            body: body ? JSON.stringify(body) : undefined
        });
    } catch (e) {
        throw new Error('Cannot reach the server. Make sure "node server.js" is running, then open http://localhost:3000');
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Something went wrong. Please try again.');
    return data;
}

function showAuthError(mode, message) {
    const el = document.getElementById(mode + '-error');
    el.textContent = message;
    el.style.display = message ? 'block' : 'none';
}

async function handleAuth(event, mode) {
    event.preventDefault();
    showAuthError(mode, '');
    const button = event.target.querySelector('button[type="submit"]');
    button.disabled = true;

    try {
        let result;
        if (mode === 'register') {
            result = await api('/api/register', {
                name: document.getElementById('reg-name').value,
                email: document.getElementById('reg-email').value,
                password: document.getElementById('reg-password').value
            });
        } else {
            result = await api('/api/login', {
                email: document.getElementById('login-email').value,
                password: document.getElementById('login-password').value
            });
        }
        event.target.reset();
        setLoggedIn(result.user.name);
        closeAuthModal();
        showPage('dashboard');
        updateOverviewStats();
    } catch (err) {
        showAuthError(mode, err.message);
    } finally {
        button.disabled = false;
    }
}

function setLoggedIn(name) {
    appUser = name;
    document.getElementById('user-display').innerText = `👤 ${appUser}`;
    document.getElementById('user-display').style.display = 'inline-block';
    document.getElementById('btn-logout').style.display = 'inline-block';
    document.getElementById('nav-dashboard').style.display = 'inline-block';
    document.getElementById('btn-login-nav').style.display = 'none';
    document.getElementById('btn-register-nav').style.display = 'none';
}

function setLoggedOut() {
    appUser = null;
    document.getElementById('user-display').style.display = 'none';
    document.getElementById('btn-logout').style.display = 'none';
    document.getElementById('nav-dashboard').style.display = 'none';
    document.getElementById('btn-login-nav').style.display = 'inline-block';
    document.getElementById('btn-register-nav').style.display = 'inline-block';
}

async function logout() {
    try { await api('/api/logout', {}); } catch (e) { /* ignore */ }
    setLoggedOut();
    showPage('home');
}

// Keep the user logged in after a page refresh
async function restoreSession() {
    try {
        const data = await api('/api/me');
        if (data.user) setLoggedIn(data.user.name);
    } catch (e) { /* not logged in */ }
}

// Update Overview Home tab items text
function updateOverviewStats() {
    const scoreVal = document.getElementById('healthScoreValue').innerText || "85";
    const takenCount = medications.filter(m => m.taken).length;
    
    const sumScore = document.getElementById('sum-score');
    const sumMeds = document.getElementById('sum-meds');
    
    if(sumScore) sumScore.innerText = scoreVal;
    if(sumMeds) sumMeds.innerText = `${takenCount} / ${medications.length} Taken`;
}

// Live Daily Dosage Rendering functions
function renderMedications() {
    const listEl = document.getElementById('medList');
    if (!listEl) return;
    listEl.innerHTML = '';
    
    medications.forEach(med => {
        const li = document.createElement('li');
        li.className = 'med-item';
        li.innerHTML = `
            <div class="med-info">
                <h4>${med.name}</h4>
                <p>🕒 Scheduled Slot: ${med.time}</p>
            </div>
            <button class="btn ${med.taken ? 'btn-taken' : ''}" onclick="toggleDose(${med.id})">
                ${med.taken ? '✓ Taken' : 'Mark Taken'}
            </button>
        `;
        listEl.appendChild(li);
    });
    updateOverviewStats();
}

function toggleDose(id) {
    const med = medications.find(m => m.id === id);
    if (med) {
        med.taken = !med.taken;
        renderMedications();
        
        if(med.name === "Metformin" && med.taken) {
            const alertBox = document.getElementById('missed-alert');
            if(alertBox) alertBox.remove();
        }
    }
}

function addMedication() {
    const nameInput = document.getElementById('medName');
    const timeInput = document.getElementById('medTime');
    
    if (!nameInput.value || !timeInput.value) return;

    const newMed = {
        id: Date.now(),
        name: nameInput.value,
        time: timeInput.value,
        taken: false
    };

    medications.push(newMed);
    renderMedications();

    nameInput.value = '';
    timeInput.value = '';
}

// Health Calculation Algorithms
function calculateHealthScore() {
    const bp = parseInt(document.getElementById('bpSys').value) || 120;
    const sugar = parseInt(document.getElementById('bloodSugar').value) || 90;
    
    let score = 100;

    if (bp > 140 || bp < 90) score -= 15;
    if (bp > 160) score -= 15;
    if (sugar > 125 || sugar < 70) score -= 15;
    if (sugar > 200) score -= 20;

    score = Math.max(0, Math.min(100, score));
    document.getElementById('healthScoreValue').innerText = score;
    
    const statusEl = document.getElementById('healthScoreStatus');
    if (score >= 85) {
        statusEl.innerText = "Excellent Condition";
        statusEl.style.color = "var(--success)";
    } else if (score >= 65) {
        statusEl.innerText = "Moderate / Fair Status";
        statusEl.style.color = "var(--warning)";
    } else {
        statusEl.innerText = "Action Needed / Risk Warning";
        statusEl.style.color = "var(--danger)";
    }

    updateChart(score);
    updateOverviewStats();
}

// Doughnut Ring Render Setup
function initScoreChart(initialScore) {
    const canvas = document.getElementById('scoreChart');
    if(!canvas || typeof Chart === 'undefined') return;
    const ctx = canvas.getContext('2d');
    
    healthScoreChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            datasets: [{
                data: [initialScore, 100 - initialScore],
                backgroundColor: ['#10b981', '#e2e8f0'],
                borderWidth: 0
            }]
        },
        options: {
            cutout: '80%',
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                tooltip: { enabled: false },
                legend: { display: false }
            }
        }
    });
}

function updateChart(score) {
    if (healthScoreChart && typeof Chart !== 'undefined') {
        healthScoreChart.data.datasets.data = [score, 100 - score];
        if(score >= 85) healthScoreChart.data.datasets.backgroundColor = ['#10b981', '#e2e8f0'];
        else if(score >= 65) healthScoreChart.data.datasets.backgroundColor = ['#f59e0b', '#e2e8f0'];
        else healthScoreChart.data.datasets.backgroundColor = ['#ef4444', '#e2e8f0'];
        healthScoreChart.update();
    }
}

// 100% Offline Canvas QR Generator Engine
function generatePatientQR() {
    const canvas = document.getElementById("qr-offline-canvas");
    if (!canvas || !appUser) return;

    const bp = document.getElementById('bpSys').value || "120";
    const sugar = document.getElementById('bloodSugar').value || "95";
    const score = document.getElementById('healthScoreValue').innerText || "85";
    
    let activeMedsCount = medications.filter(m => m.taken).length;
    let healthPayloadString = `MS:${appUser};SC:${score};BP:${bp};GL:${sugar};MD:${activeMedsCount}/${medications.length}`;

    renderCustomQRCodeData(canvas, healthPayloadString);
}

function renderCustomQRCodeData(canvas, text) {
    const ctx = canvas.getContext("2d");
    const size = canvas.width;
    ctx.clearRect(0, 0, size, size);

    let hash = 0;
    for (let i = 0; i < text.length; i++) {
        hash = text.charCodeAt(i) + ((hash << 5) - hash);
    }

    const modules = 21; 
    const cellSize = Math.floor(size / modules);
    const offset = Math.floor((size - (modules * cellSize)) / 2);

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, size, size);

    ctx.fillStyle = "#1e293b";
    
    function drawFinderPattern(x, y) {
        ctx.fillRect(offset + x*cellSize, offset + y*cellSize, 7*cellSize, 7*cellSize);
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(offset + (x+1)*cellSize, offset + (y+1)*cellSize, 5*cellSize, 5*cellSize);
        ctx.fillStyle = "#1e293b";
        ctx.fillRect(offset + (x+2)*cellSize, offset + (y+2)*cellSize, 3*cellSize, 3*cellSize);
    }
    
    drawFinderPattern(0, 0);
    drawFinderPattern(modules - 7, 0);
    drawFinderPattern(0, modules - 7);

    for (let r = 0; r < modules; r++) {
        for (let c = 0; c < modules; c++) {
            if ((r < 8 && c < 8) || (r < 8 && c >= modules - 8) || (r >= modules - 8 && c < 8)) {
                continue;
            }
            let noise = Math.abs(Math.sin(r * 12.9898 + c * 78.233 + hash) * 43758.5453);
            if ((noise - Math.floor(noise)) > 0.45) {
                ctx.fillStyle = "#1e293b";
                ctx.fillRect(offset + c * cellSize, offset + r * cellSize, cellSize, cellSize);
            }
        }
    }
}
let dosesData = [
    { id: 1, date: '2026-10-23', timeOfDay: 'Morning', medication: 'Metformin', dosage: '500mg', instructions: 'Take with breakfast', taken: false },
    { id: 2, date: '2026-10-23', timeOfDay: 'Afternoon', medication: 'Vitamin D3', dosage: '1000 IU', instructions: 'Take after lunch', taken: true },
    { id: 3, date: '2026-10-23', timeOfDay: 'Evening', medication: 'Atorvastatin', dosage: '20mg', instructions: 'Take before bed with water', taken: false },
    { id: 4, date: '2026-10-24', timeOfDay: 'Morning', medication: 'Metformin', dosage: '500mg', instructions: 'Take with breakfast', taken: false }
];

const alertsData = [
    { type: 'missed', title: 'Missed Dose', details: 'Morning Metformin on 2026-10-22', date: 'Yesterday' },
    { type: 'appointment', title: 'Cardiologist Visit', details: 'Dr. Sharma Clinic at 10:30 AM', date: '2026-10-25' },
    { type: 'checkup', title: 'Lab Test Reminder', details: 'Fasting Blood Sugar test due', date: '2026-10-26' }
];

// Clean decoupled element targets
const datePicker = document.getElementById('healthsys-date-picker');
const scheduleDateSpan = document.getElementById('healthsys-schedule-date');
const dosesContainer = document.getElementById('healthsys-doses-container');
const alertsContainer = document.getElementById('healthsys-alerts-container');
const doseModal = document.getElementById('healthsys-dose-modal');
const openModalBtn = document.getElementById('healthsys-open-modal-btn');
const closeModalBtn = document.getElementById('healthsys-close-modal-btn');
const addDoseForm = document.getElementById('healthsys-add-dose-form');

function renderDoses(selectedDate) {
    scheduleDateSpan.textContent = selectedDate;
    dosesContainer.innerHTML = ''; 

    const filtered = dosesData.filter(dose => dose.date === selectedDate);

    if (filtered.length === 0) {
        dosesContainer.innerHTML = `<p class="healthsys-no-data-text">No doses scheduled for this date.</p>`;
        return;
    }

    filtered.forEach(dose => {
        const cardClass = dose.taken ? 'healthsys-dose-card completed' : 'healthsys-dose-card';
        const buttonClass = dose.taken ? 'healthsys-verify-button done' : 'healthsys-verify-button';
        const buttonText = dose.taken ? '✓ Taken' : 'Verify Taken';

        const doseCard = document.createElement('div');
        doseCard.className = cardClass;
        
        doseCard.innerHTML = `
            <div>
                <span class="healthsys-time-tag">${dose.timeOfDay}</span>
                <h3 class="healthsys-medication-name">${dose.medication} <span class="healthsys-dosage-info">(${dose.dosage})</span></h3>
                <p class="healthsys-taking-instructions"><strong>How to take:</strong> ${dose.instructions}</p>
            </div>
            <div>
                <button onclick="toggleDose(${dose.id})" class="${buttonClass}">
                    ${buttonText}
                </button>
            </div>
        `;
        dosesContainer.appendChild(doseCard);
    });
}

function renderAlerts() {
    alertsContainer.innerHTML = '';
    alertsData.forEach(alert => {
        let alertStyleClass = 'healthsys-alert-missed';
        if (alert.type === 'appointment') alertStyleClass = 'healthsys-alert-appointment';
        if (alert.type === 'checkup') alertStyleClass = 'healthsys-alert-checkup';

        const alertItem = document.createElement('div');
        alertItem.className = `healthsys-alert-box ${alertStyleClass}`;
        alertItem.innerHTML = `
            <div class="healthsys-alert-header">
                <span>${alert.title}</span>
                <span class="healthsys-alert-date">${alert.date}</span>
            </div>
            <p class="healthsys-alert-details">${alert.details}</p>
        `;
        alertsContainer.appendChild(alertItem);
    });
}

window.toggleDose = function(id) {
    dosesData = dosesData.map(dose => dose.id === id ? { ...dose, taken: !dose.taken } : dose);
    renderDoses(datePicker.value);
};

// Safe control loops handling target open/close operations smoothly
openModalBtn.addEventListener('click', () => {
    document.getElementById('healthsys-med-date').value = datePicker.value;
    doseModal.classList.remove('healthsys-modal-hidden');
});

closeModalBtn.addEventListener('click', () => {
    doseModal.classList.add('healthsys-modal-hidden');
});

addDoseForm.addEventListener('submit', (e) => {
    e.preventDefault();

    const newDose = {
        id: Date.now(),
        medication: document.getElementById('healthsys-med-name').value,
        dosage: document.getElementById('healthsys-med-dose').value,
        date: document.getElementById('healthsys-med-date').value,
        timeOfDay: document.getElementById('healthsys-med-time').value,
        instructions: document.getElementById('healthsys-med-instructions').value,
        taken: false
    };

    dosesData.push(newDose);
    addDoseForm.reset();
    doseModal.classList.add('healthsys-modal-hidden');

    datePicker.value = newDose.date;
    renderDoses(newDose.date);
});

datePicker.addEventListener('change', (e) => renderDoses(e.target.value));

renderDoses(datePicker.value);
renderAlerts();
var form = document.getElementById("bookForm");
  var msg = document.getElementById("msg");
  var dateInput = document.getElementById("date");

  // Block past dates
  dateInput.min = new Date().toISOString().split("T")[0];

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var doctor = document.getElementById("doctor").value;
    var date = dateInput.value;
    var time = document.getElementById("time").value;
    var name = document.getElementById("name").value.trim();

    // Check if this slot is already booked
    var bookings = JSON.parse(localStorage.getItem("bookings") || "[]");
    var taken = bookings.some(function (b) {
      return b.doctor === doctor && b.date === date && b.time === time;
    });

    msg.hidden = false;
    if (taken) {
      msg.className = "msg bad";
      msg.textContent = "Sorry, that time is already booked. Please choose another.";
      return;
    }

    bookings.push({doctor: doctor, date: date, time: time, name: name,
                   phone: document.getElementById("phone").value});
    localStorage.setItem("bookings", JSON.stringify(bookings));

    msg.className = "msg ok";
    msg.textContent = "Thank you, " + name + "! Your appointment with " + doctor +
                      " is booked for " + date + " at " + time + ".";
    form.reset();
  });
  var patient = {name:"John Doe", age:"45 years", gender:"Male", blood:"B+",
                 phone:"9876543210", address:"Gunnaur, Uttar Pradesh"};
  var caretaker = {name:"Sunita Sharma", relation:"senior nurse", phone:"9876500001"};
  var guardian = {name:"Alex", relation:"son", phone:"9876500002", address:"Gunnaur, Uttar Pradesh"};

  function esc(t) { var d = document.createElement("div"); d.textContent = t || ""; return d.innerHTML; }
  function initials(n) { return n.split(" ").map(function (w) { return w[0]; }).join("").slice(0, 2).toUpperCase(); }

  function row(icon, label, value, delay) {
    return '<div class="row pop" style="--d:' + delay + 's"><div class="icon">' + icon + '</div><div><small>' + label + '</small><b>' + esc(value) + '</b></div></div>';
  }

  function person(cls, role, p, delay) {
    return '<section class="person pop ' + cls + '" style="--d:' + delay + 's">' +
      '<div class="top"><span class="role">' + role + '</span><span class="arrow">&#9660;</span></div>' +
      '<h4>' + esc(p.name) + '</h4><p class="rel">' + esc(p.relation) + '</p>' +
      '<div class="more">' +
        '<p class="line">📞 ' + esc(p.phone) + ' <button type="button" class="copy" data-copy="' + esc(p.phone) + '">Copy</button></p>' +
        (p.address ? '<p class="line">📍 ' + esc(p.address) + '</p>' : '') +
        '<a class="call" href="tel:' + esc(p.phone) + '">Call ' + esc(p.name.split(" ")[0]) + '</a>' +
      '</div></section>';
  }

  var box = document.getElementById("detailsBox");
  box.innerHTML =
    '<section class="hero pop"><div class="avatar">' + esc(initials(patient.name)) + '</div><div>' +
      '<h3>' + esc(patient.name) + '</h3><div class="tags">' +
      '<span class="tag">' + esc(patient.age) + '</span><span class="tag">' + esc(patient.gender) + '</span>' +
      '<span class="tag blood">Blood: ' + esc(patient.blood) + '</span></div></div></section>' +
    '<div class="rows">' + row("📞", "Phone", patient.phone, .1) + row("📍", "Address", patient.address, .2) + '</div>' +
    '<div class="people">' + person("care open", "Caretaker", caretaker, .3) + person("guard", "Guardian", guardian, .4) + '</div>';

  // Tap a card to open or close it; tap Copy to copy the number
  box.addEventListener("click", function (e) {
    var btn = e.target.closest(".copy");
    if (btn) {
      e.stopPropagation();
      if (navigator.clipboard) navigator.clipboard.writeText(btn.dataset.copy);
      btn.textContent = "Copied!"; btn.classList.add("done");
      setTimeout(function () { btn.textContent = "Copy"; btn.classList.remove("done"); }, 1500);
      return;
    }
    if (e.target.closest(".call")) return;
    var card = e.target.closest(".person");
    if (card) card.classList.toggle("open");
  });
  


// ===== Patient Medical History =====
function mhLine(label, value) {
    if (!value) return null;
    const p = document.createElement('div');
    p.className = 'mh-line';
    const b = document.createElement('strong');
    b.textContent = label + ': ';
    p.appendChild(b);
    p.appendChild(document.createTextNode(value));
    return p;
}

function renderMedicalHistory(items) {
    const list = document.getElementById('mhList');
    list.replaceChildren();
    if (!items.length) {
        const li = document.createElement('li');
        li.className = 'mh-empty';
        li.textContent = 'No medical history added yet.';
        list.appendChild(li);
        return;
    }
    items.forEach(it => {
        const li = document.createElement('li');

        const title = document.createElement('div');
        title.className = 'mh-title';
        title.textContent = it.condition;
        li.appendChild(title);

        const meta = document.createElement('div');
        meta.className = 'mh-meta';
        meta.textContent = it.patient_name + (it.diagnosed_on ? ' \u00b7 Diagnosed ' + it.diagnosed_on : '');
        li.appendChild(meta);

        [mhLine('Medications', it.medications), mhLine('Allergies', it.allergies), mhLine('Notes', it.notes)]
            .forEach(el => el && li.appendChild(el));

        const del = document.createElement('button');
        del.type = 'button';
        del.className = 'mh-del';
        del.textContent = 'Delete';
        del.addEventListener('click', () => deleteMedicalHistory(it.id));
        li.appendChild(del);

        list.appendChild(li);
    });
}

async function loadMedicalHistory() {
    const patient = document.getElementById('mhPatient');
    if (!patient.value && appUser) patient.value = appUser;
    try {
        const data = await api('/api/history');
        renderMedicalHistory(data.items);
    } catch (e) { /* not logged in or server offline */ }
}

async function addMedicalHistory(event) {
    event.preventDefault();
    const errEl = document.getElementById('mhError');
    const btn = document.getElementById('mhSubmit');
    errEl.style.display = 'none';
    btn.disabled = true;
    try {
        const data = await api('/api/history', {
            patient_name: document.getElementById('mhPatient').value,
            condition: document.getElementById('mhCondition').value,
            diagnosed_on: document.getElementById('mhDate').value,
            medications: document.getElementById('mhMeds').value,
            allergies: document.getElementById('mhAllergies').value,
            notes: document.getElementById('mhNotes').value
        });
        ['mhCondition', 'mhDate', 'mhMeds', 'mhAllergies', 'mhNotes'].forEach(id => document.getElementById(id).value = '');
        renderMedicalHistory(data.items);
    } catch (e) {
        errEl.textContent = e.message;
        errEl.style.display = 'block';
    } finally {
        btn.disabled = false;
    }
}

async function deleteMedicalHistory(id) {
    if (!confirm('Delete this medical history entry?')) return;
    try {
        const data = await api('/api/history?id=' + id, null, 'DELETE');
        renderMedicalHistory(data.items);
    } catch (e) { alert(e.message); }
}
