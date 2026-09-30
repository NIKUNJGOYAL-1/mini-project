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
});

// Main Page Navigation Routing
function showPage(pageName) {
    if (pageName === 'dashboard' && !appUser) {
        openAuthModal('login');
        return;
    }
    
    document.querySelectorAll('.page-content').forEach(p => p.classList.remove('active'));
    document.getElementById(`page-${pageName}`).classList.add('active');
    
    if (pageName === 'dashboard') {
        switchTab('tab-summary'); 
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
    document.getElementById('auth-modal').classList.add('open');
    document.getElementById('modal-type-login').style.display = (mode === 'login') ? 'block' : 'none';
    document.getElementById('modal-type-register').style.display = (mode === 'register') ? 'block' : 'none';
}

function closeAuthModal() {
    document.getElementById('auth-modal').classList.remove('open');
}

// Emulate Authentication Login / Registration 
function handleAuth(event, framework) {
    event.preventDefault();
    
    if (framework === 'register') {
        const nameField = document.getElementById('reg-name').value;
        appUser = nameField ? nameField : "Patient";
    } else {
        appUser = "Jane Doe"; 
    }

    // Refresh UI State Elements
    document.getElementById('user-display').innerText = `👤 ${appUser}`;
    document.getElementById('user-display').style.display = 'inline-block';
    document.getElementById('btn-logout').style.display = 'inline-block';
    document.getElementById('nav-dashboard').style.display = 'inline-block';
    
    document.getElementById('btn-login-nav').style.display = 'none';
    document.getElementById('btn-register-nav').style.display = 'none';
    
    closeAuthModal();
    showPage('dashboard');
    updateOverviewStats();
}

function logout() {
    appUser = null;
    document.getElementById('user-display').style.display = 'none';
    document.getElementById('btn-logout').style.display = 'none';
    document.getElementById('nav-dashboard').style.display = 'none';
    
    document.getElementById('btn-login-nav').style.display = 'inline-block';
    document.getElementById('btn-register-nav').style.display = 'inline-block';
    
    showPage('home');
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
