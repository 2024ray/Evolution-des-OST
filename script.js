// Application State
let appData = null;
let currentQuizQuestions = [];
let currentAtelierExercises = [];
let currentExoIndex = 0;

let quizTimerInterval = null;
let quizSecondsLeft = 25 * 60; // 25 minutes pour 30 questions diversifiées

let atelierTimerInterval = null;
let atelierSecondsLeft = 90; // 90 secondes par exercice

let userQuizAnswers = {};
let userAtelierAnswers = {};

document.addEventListener("DOMContentLoaded", () => {
    loadData();
    initNavigation();
});

async function loadData() {
    try {
        const response = await fetch(`questions.json?t=${Date.now()}`);
        appData = await response.json();
        initCours();
    } catch (error) {
        console.error("Erreur de chargement du JSON :", error);
        alert("Impossible de charger les données pédagogiques.");
    }
}

function shuffle(array) {
    let arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

function normalizeText(text) {
    if (!text) return "";
    return text.toString()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim();
}

function initNavigation() {
    document.getElementById("btn-start-quiz").addEventListener("click", () => {
        switchSection("section-quiz");
        startQuizTimer();
        initQuiz();
    });

    document.getElementById("btn-submit-quiz").addEventListener("click", () => {
        clearInterval(quizTimerInterval);
        switchSection("section-atelier");
        startAtelierTimer();
        initAtelier();
    });

    document.getElementById("btn-next-exo").addEventListener("click", () => {
        if (currentExoIndex < currentAtelierExercises.length - 1) {
            currentExoIndex++;
            renderAtelierExercise();
        }
    });

    document.getElementById("btn-prev-exo").addEventListener("click", () => {
        if (currentExoIndex > 0) {
            currentExoIndex--;
            renderAtelierExercise();
        }
    });

    document.getElementById("btn-submit-atelier").addEventListener("click", () => {
        clearInterval(atelierTimerInterval);
        calculateAndDisplayResults();
        switchSection("section-bilan");
    });

    document.getElementById("btn-restart").addEventListener("click", () => {
        location.reload();
    });

    document.getElementById("btn-download-pdf").addEventListener("click", () => {
        const element = document.getElementById("pdf-content");
        const opt = {
            margin:       10,
            filename:     `Bilan_Evolution_OST_${new Date().toISOString().slice(0,10)}.pdf`,
            image:        { type: 'jpeg', quality: 0.98 },
            html2canvas:  { scale: 2, useCORS: true },
            jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };
        html2pdf().from(element).set(opt).save();
    });
}

function switchSection(sectionId) {
    document.querySelectorAll(".app-section").forEach(sec => sec.classList.remove("active"));
    document.getElementById(sectionId).classList.add("active");
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function initCours() {
    const grid = document.getElementById("cours-grid");
    grid.innerHTML = "";
    appData.cours.forEach((item, index) => {
        const card = document.createElement("div");
        card.className = `cours-card card-color-${index % 5}`;
        card.innerHTML = `
            <h3><i class="fa-solid fa-bookmark"></i> ${item.titre}</h3>
            <p>${item.texte}</p>
        `;
        grid.appendChild(card);
    });
}

// --- QUIZ : GESTION DES 30 QUESTIONS MULTIPLES ---
function startQuizTimer() {
    quizTimerInterval = setInterval(() => {
        quizSecondsLeft--;
        let m = Math.floor(quizSecondsLeft / 60);
        let s = quizSecondsLeft % 60;
        document.getElementById("quiz-time-left").textContent = `${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
        
        let pct = ((1500 - quizSecondsLeft) / 1500) * 100;
        document.getElementById("quiz-progress-bar").style.width = `${pct}%`;

        if (quizSecondsLeft <= 0) {
            clearInterval(quizTimerInterval);
            document.getElementById("btn-submit-quiz").click();
        }
    }, 1000);
}

function initQuiz() {
    currentQuizQuestions = shuffle(appData.quizComprehension);
    const container = document.getElementById("quiz-container");
    container.innerHTML = "";

    currentQuizQuestions.forEach((q, qIndex) => {
        const card = document.createElement("div");
        card.className = "question-card";
        
        let bodyHtml = `<h4>Question ${qIndex + 1} / ${currentQuizQuestions.length}</h4>`;
        bodyHtml += `<p class="question-text">${q.question}</p>`;

        // Rendu dynamique selon le type de question du quiz
        if (q.type === "choix-unique") {
            bodyHtml += `<div class="options-group">`;
            q.options.forEach((opt, oIndex) => {
                bodyHtml += `<label class="option-label"><input type="radio" name="quiz_${qIndex}" value="${oIndex}"> <span>${opt}</span></label>`;
            });
            bodyHtml += `</div>`;
        } else if (q.type === "choix-multiple") {
            bodyHtml += `<div class="options-group">`;
            q.options.forEach((opt, oIndex) => {
                bodyHtml += `<label class="option-label"><input type="checkbox" name="quiz_multi_${qIndex}" value="${oIndex}"> <span>${opt}</span></label>`;
            });
            bodyHtml += `</div>`;
        } else if (q.type === "valeur-numerique" || q.type === "reponse-saisie") {
            bodyHtml += `<input type="text" id="quiz_input_${qIndex}" class="input-styled" placeholder="Votre réponse...">`;
        } else if (q.type === "tableau-menu") {
            bodyHtml += `<table class="exo-table"><tr><th>${q.colonnes[0]}</th><th>${q.colonnes[1]}</th></tr>`;
            q.lignes.forEach(row => {
                let selectKey = row[1];
                let opts = q.optionsSelect[selectKey];
                let optionsOptsHtml = opts.map(o => `<option value="${o}">${o}</option>`).join("");
                bodyHtml += `<tr><td>${row[0]}</td><td><select class="select-styled" data-quiz-key="${selectKey}" data-qindex="${qIndex}">${optionsOptsHtml}</select></td></tr>`;
            });
            bodyHtml += `</table>`;
        } else if (q.type === "texte-trous-liste-unique") {
            let optsHtml = q.options.map(o => `<option value="${o}">${o}</option>`).join("");
            bodyHtml += `<div class="mt-3"><select id="quiz_trous_${qIndex}" class="select-styled"><option value="">-- Choisir une option --</option>${optsHtml}</select></div>`;
        } else if (q.type === "association") {
            bodyHtml += `<div class="association-grid" data-qindex="${qIndex}">`;
            q.paires.forEach((pair, pIdx) => {
                let shuffledDefs = shuffle(q.paires.map(p => p.definition));
                let defOpts = shuffledDefs.map(d => `<option value="${d}">${d}</option>`).join("");
                bodyHtml += `<div class="assoc-row"><span><strong>${pair.terme}</strong></span> <select class="select-styled quiz-assoc-select" data-pairindex="${pIdx}" data-qindex="${qIndex}"><option value="">-- Associer --</option>${defOpts}</select></div>`;
            });
            bodyHtml += `</div>`;
        }

        card.innerHTML = bodyHtml;
        container.appendChild(card);
    });
}

// --- ATELIER PRATIQUE ---
function startAtelierTimer() {
    atelierSecondsLeft = 90;
    updateAtelierTimerDisplay();

    atelierTimerInterval = setInterval(() => {
        atelierSecondsLeft--;
        updateAtelierTimerDisplay();

        if (atelierSecondsLeft <= 10) {
            document.getElementById("atelier-timer").classList.add("warning");
        }

        if (atelierSecondsLeft <= 0) {
            if (currentExoIndex < currentAtelierExercises.length - 1) {
                document.getElementById("btn-next-exo").click();
            } else {
                document.getElementById("btn-submit-atelier").click();
            }
        }
    }, 1000);
}

function updateAtelierTimerDisplay() {
    let m = Math.floor(atelierSecondsLeft / 60);
    let s = atelierSecondsLeft % 60;
    document.getElementById("atelier-time-left").textContent = `${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
}

function initAtelier() {
    currentAtelierExercises = shuffle(appData.evaluation);
    currentExoIndex = 0;
    renderAtelierExercise();
}

function renderAtelierExercise() {
    saveCurrentExoAnswers();
    atelierSecondsLeft = 90;
    document.getElementById("atelier-timer").classList.remove("warning");

    const container = document.getElementById("atelier-container");
    container.innerHTML = "";

    const exo = currentAtelierExercises[currentExoIndex];
    const card = document.createElement("div");
    card.className = "question-card atelier-card";

    let badgeClass = "badge-facile";
    if (exo.niveau === "Moyen") badgeClass = "badge-moyen";
    if (exo.niveau === "Avancé") badgeClass = "badge-avance";

    let bodyHtml = `<div class="exo-meta"><span class="badge ${badgeClass}">${exo.niveau}</span> <span class="exo-pts">${exo.points} points</span></div>`;
    bodyHtml += `<p class="question-text">${exo.enonce}</p>`;

    if (exo.type === "choix-unique") {
        exo.options.forEach((opt, idx) => {
            bodyHtml += `<label class="option-label"><input type="radio" name="exo_active" value="${idx}"> <span>${opt}</span></label>`;
        });
    } else if (exo.type === "choix-multiple") {
        exo.options.forEach((opt, idx) => {
            bodyHtml += `<label class="option-label"><input type="checkbox" name="exo_active_multi" value="${idx}"> <span>${opt}</span></label>`;
        });
    } else if (exo.type === "valeur-numerique" || exo.type === "reponse-saisie" || exo.type === "texte-trous-libre") {
        bodyHtml += `<input type="text" id="exo_input_text" class="input-styled" placeholder="Votre réponse ici...">`;
    } else if (exo.type === "tableau-menu") {
        bodyHtml += `<table class="exo-table"><tr><th>${exo.colonnes[0]}</th><th>${exo.colonnes[1]}</th></tr>`;
        exo.lignes.forEach(row => {
            let selectKey = row[1];
            let opts = exo.optionsSelect[selectKey];
            let optionsOptsHtml = opts.map(o => `<option value="${o}">${o}</option>`).join("");
            bodyHtml += `<tr><td>${row[0]}</td><td><select class="select-styled" data-key="${selectKey}">${optionsOptsHtml}</select></td></tr>`;
        });
        bodyHtml += `</table>`;
    } else if (exo.type === "texte-trous-liste-unique") {
        let optsHtml = exo.options.map(o => `<option value="${o}">${o}</option>`).join("");
        bodyHtml += `<div class="mt-3"><select id="exo_trous_select" class="select-styled"><option value="">-- Choisir une option --</option>${optsHtml}</select></div>`;
    } else if (exo.type === "association") {
        bodyHtml += `<div class="association-grid">`;
        exo.paires.forEach((pair, pIdx) => {
            let shuffledDefs = shuffle(exo.paires.map(p => p.definition));
            let defOpts = shuffledDefs.map(d => `<option value="${d}">${d}</option>`).join("");
            bodyHtml += `<div class="assoc-row"><span><strong>${pair.terme}</strong></span> <select class="select-styled assoc-select" data-index="${pIdx}"><option value="">-- Associer --</option>${defOpts}</select></div>`;
        });
        bodyHtml += `</div>`;
    }

    card.innerHTML = bodyHtml;
    container.appendChild(card);
    restoreCurrentExoAnswers();

    document.getElementById("btn-prev-exo").style.display = currentExoIndex > 0 ? "inline-block" : "none";
    if (currentExoIndex === currentAtelierExercises.length - 1) {
        document.getElementById("btn-next-exo").style.display = "none";
        document.getElementById("btn-submit-atelier").style.display = "inline-block";
    } else {
        document.getElementById("btn-next-exo").style.display = "inline-block";
        document.getElementById("btn-submit-atelier").style.display = "none";
    }

    let progressPct = ((currentExoIndex + 1) / currentAtelierExercises.length) * 100;
    document.getElementById("atelier-progress-bar").style.width = `${progressPct}%`;
}

function saveCurrentExoAnswers() {
    const exo = currentAtelierExercises[currentExoIndex];
    if (!exo) return;

    if (exo.type === "choix-unique") {
        const checked = document.querySelector('input[name="exo_active"]:checked');
        userAtelierAnswers[exo.id] = checked ? parseInt(checked.value) : null;
    } else if (exo.type === "choix-multiple") {
        const checkedBoxes = document.querySelectorAll('input[name="exo_active_multi"]:checked');
        userAtelierAnswers[exo.id] = Array.from(checkedBoxes).map(cb => parseInt(cb.value));
    } else if (exo.type === "valeur-numerique" || exo.type === "reponse-saisie" || exo.type === "texte-trous-libre") {
        const input = document.getElementById("exo_input_text");
        userAtelierAnswers[exo.id] = input ? input.value : "";
    } else if (exo.type === "tableau-menu") {
        let selects = document.querySelectorAll(".exo-table select");
        let ans = {};
        selects.forEach(sel => {
            ans[sel.getAttribute("data-key")] = sel.value;
        });
        userAtelierAnswers[exo.id] = ans;
    } else if (exo.type === "texte-trous-liste-unique") {
        const sel = document.getElementById("exo_trous_select");
        userAtelierAnswers[exo.id] = sel ? sel.value : "";
    } else if (exo.type === "association") {
        let selects = document.querySelectorAll(".assoc-select");
        let ans = {};
        selects.forEach(sel => {
            ans[sel.getAttribute("data-index")] = sel.value;
        });
        userAtelierAnswers[exo.id] = ans;
    }
}

function restoreCurrentExoAnswers() {
    const exo = currentAtelierExercises[currentExoIndex];
    const saved = userAtelierAnswers[exo.id];
    if (saved === undefined) return;

    if (exo.type === "choix-unique" && saved !== null) {
        const radio = document.querySelector(`input[name="exo_active"][value="${saved}"]`);
        if (radio) radio.checked = true;
    } else if (exo.type === "choix-multiple" && Array.isArray(saved)) {
        saved.forEach(val => {
            const cb = document.querySelector(`input[name="exo_active_multi"][value="${val}"]`);
            if (cb) cb.checked = true;
        });
    } else if ((exo.type === "valeur-numerique" || exo.type === "reponse-saisie" || exo.type === "texte-trous-libre") && saved) {
        const input = document.getElementById("exo_input_text");
        if (input) input.value = saved;
    } else if (exo.type === "tableau-menu" && typeof saved === "object") {
        let selects = document.querySelectorAll(".exo-table select");
        selects.forEach(sel => {
            let key = sel.getAttribute("data-key");
            if (saved[key]) sel.value = saved[key];
        });
    } else if (exo.type === "texte-trous-liste-unique" && saved) {
        const sel = document.getElementById("exo_trous_select");
        if (sel) sel.value = saved;
    } else if (exo.type === "association" && typeof saved === "object") {
        let selects = document.querySelectorAll(".assoc-select");
        selects.forEach(sel => {
            let idx = sel.getAttribute("data-index");
            if (saved[idx]) sel.value = saved[idx];
        });
    }
}

// --- BILAN & CALCUL DES SCORES (Quiz /30 + Atelier /40 = /70) ---
function calculateAndDisplayResults() {
    saveCurrentExoAnswers();

    // Calcul score Quiz (/30)
    let quizScore = 0;
    currentQuizQuestions.forEach((q, qIndex) => {
        if (q.type === "choix-unique") {
            const checked = document.querySelector(`input[name="quiz_${qIndex}"]:checked`);
            if (checked && parseInt(checked.value) === q.correct) quizScore++;
        } else if (q.type === "choix-multiple") {
            const checkedBoxes = document.querySelectorAll(`input[name="quiz_multi_${qIndex}"]:checked`);
            let userAns = Array.from(checkedBoxes).map(cb => parseInt(cb.value));
            let correctSet = new Set(q.correct);
            let userSet = new Set(userAns);
            if (correctSet.size === userSet.size && [...correctSet].every(val => userSet.has(val))) {
                quizScore++;
            }
        } else if (q.type === "valeur-numerique" || q.type === "reponse-saisie") {
            const input = document.getElementById(`quiz_input_${qIndex}`);
            if (input && normalizeText(input.value) === normalizeText(q.correct)) quizScore++;
        } else if (q.type === "tableau-menu") {
            let selects = document.querySelectorAll(`select[data-qindex="${qIndex}"]`);
            let allCorrect = true;
            selects.forEach(sel => {
                let key = sel.getAttribute("data-quiz-key");
                if (sel.value !== q.correct[key]) allCorrect = false;
            });
            if (allCorrect) quizScore++;
        } else if (q.type === "texte-trous-liste-unique") {
            const sel = document.getElementById(`quiz_trous_${qIndex}`);
            if (sel && sel.value === q.correct) quizScore++;
        } else if (q.type === "association") {
            let selects = document.querySelectorAll(`.quiz-assoc-select[data-qindex="${qIndex}"]`);
            let allCorrect = true;
            selects.forEach(sel => {
                let pIdx = sel.getAttribute("data-pairindex");
                if (sel.value !== q.paires[pIdx].definition) allCorrect = false;
            });
            if (allCorrect) quizScore++;
        }
    });

    // Calcul score Atelier (/40)
    let atelierScore = 0;
    appData.evaluation.forEach(exo => {
        const ans = userAtelierAnswers[exo.id];
        if (ans === undefined || ans === null) return;

        if (exo.type === "choix-unique") {
            if (ans === exo.correct) atelierScore += exo.points;
        } else if (exo.type === "choix-multiple") {
            if (Array.isArray(ans) && Array.isArray(exo.correct)) {
                let correctSet = new Set(exo.correct);
                let userSet = new Set(ans);
                if (correctSet.size === userSet.size && [...correctSet].every(val => userSet.has(val))) {
                    atelierScore += exo.points;
                }
            }
        } else if (exo.type === "valeur-numerique" || exo.type === "reponse-saisie" || exo.type === "texte-trous-libre") {
            if (normalizeText(ans) === normalizeText(exo.correct)) atelierScore += exo.points;
        } else if (exo.type === "tableau-menu") {
            let allCorrect = true;
            for (let key in exo.correct) {
                if (ans[key] !== exo.correct[key]) allCorrect = false;
            }
            if (allCorrect) atelierScore += exo.points;
        } else if (exo.type === "texte-trous-liste-unique") {
            if (ans === exo.correct) atelierScore += exo.points;
        } else if (exo.type === "association") {
            let allCorrect = true;
            exo.paires.forEach((pair, pIdx) => {
                if (ans[pIdx] !== pair.definition) allCorrect = false;
            });
            if (allCorrect) atelierScore += exo.points;
        }
    });

    let totalScore = quizScore + atelierScore; // Sur 70 points au total

    document.getElementById("final-score").textContent = `${totalScore} / 70`;
    document.getElementById("score-quiz-detail").textContent = `${quizScore} / 30`;
    document.getElementById("score-atelier-detail").textContent = `${atelierScore} / 40`;

    let mentionEl = document.getElementById("final-mention");
    let percentage = (totalScore / 70) * 100;
    let mentionText = "";
    if (percentage >= 85) { mentionText = "Excellent - Maîtrise parfaite"; mentionEl.className = "badge-mention bg-emerald"; }
    else if (percentage >= 70) { mentionText = "Très Bien - Solides acquis"; mentionEl.className = "badge-mention bg-cyan"; }
    else if (percentage >= 50) { mentionText = "Bien - Acquis satisfaisants"; mentionEl.className = "badge-mention bg-blue"; }
    else if (percentage >= 35) { mentionText = "Passable - Des efforts à poursuivre"; mentionEl.className = "badge-mention bg-amber"; }
    else { mentionText = "Insuffisant - Reprendre le cours"; mentionEl.className = "badge-mention bg-rose"; }
    mentionEl.textContent = mentionText;

    const recapContainer = document.getElementById("recap-container");
    recapContainer.innerHTML = `
        <div class="recap-summary-box">
            <p><i class="fa-solid fa-circle-check"></i> Quiz validé : <strong>${quizScore} / 30</strong></p>
            <p><i class="fa-solid fa-circle-check"></i> Atelier pratique validé : <strong>${atelierScore} / 40</strong></p>
        </div>
    `;
}
