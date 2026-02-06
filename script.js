const numPlayers = 4;
const roundCardsSequence = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 10, 10, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1];
const maxRounds = roundCardsSequence.length;
let round = 1;
let cardsPerPlayer = roundCardsSequence[0];
let dealerIndex = 0;
let gameActive = true;
let gameRoundsHistory = [];
let currentVisualDealerIndex = -1;
let chartInstance = null;
let activeHistoryGame = null;

const players = Array.from({ length: numPlayers }, (_, i) => ({
    name: '',
    bid: 0,
    won: 0,
    total: 0
}));

function reorderPlayers() {
    if (dealerIndex === currentVisualDealerIndex) return;

    const container = document.querySelector(".player-inputs");
    const cards = Array.from(document.querySelectorAll(".player-card"));

    for (let i = 0; i < numPlayers; i++) {
        const playerIdx = (dealerIndex + 1 + i) % numPlayers;
        const card = cards.find(c => parseInt(c.dataset.player) === playerIdx);
        if (card) {
            container.appendChild(card);
        }
    }
    currentVisualDealerIndex = dealerIndex;
}

function updateCurrentRoundHeader() {
    reorderPlayers();
    const dealerName = players[dealerIndex].name || `Jugador ${dealerIndex + 1}`;
    document.getElementById("current-round-header").textContent = `Ronda: ${round}, Cartas: ${cardsPerPlayer}, Reparte: ${dealerName}`;
}

function updateDisplay() {
    players.forEach((player, index) => {
        const card = document.querySelector(`.player-card[data-player='${index}']`);
        card.querySelector(".player-name").value = player.name;
        card.querySelector(".bid-value").textContent = player.bid;
        card.querySelector(".won-value").textContent = player.won;
    });
    checkRules();
}

function checkRules() {
    const warningEl = document.getElementById("bid-warning");
    let messages = [];

    // Validar regla 1: suma de apuestas (Dealer forcing)
    const totalBids = players.reduce((acc, p) => acc + p.bid, 0);

    if (totalBids === cardsPerPlayer) {
        const dealer = players[dealerIndex];
        const word = dealer.bid === 1 ? "apuesta" : "apuestas";
        messages.push(`${dealer.name} no puede hacer ${dealer.bid} ${word}`);
    }

    // Validar regla 2: suma de ganadas <= cartas repartidas
    const totalWon = players.reduce((acc, p) => acc + p.won, 0);
    if (totalWon > cardsPerPlayer) {
        messages.push("Hay más rondas ganadas que cartas repartidas");
    }

    if (messages.length > 0) {
        warningEl.innerHTML = messages.join("<br>");
        warningEl.style.display = "block";
    } else {
        warningEl.style.display = "none";
        warningEl.textContent = "";
    }
}

function changeValue(index, field, delta) {
    const newValue = players[index][field] + delta;

    // Para las apuestas (bid), el máximo es el número de cartas por jugador
    // Para las victorias (won), el máximo también es el número de cartas por jugador
    const maxValue = cardsPerPlayer;

    // Aplicar límites: mínimo 0, máximo según el campo
    players[index][field] = Math.max(0, Math.min(maxValue, newValue));

    updateDisplay();
}

function saveRound() {
    if (!gameActive) return;

    // Validar que la suma de bazas ganadas sea igual al número de cartas repartidas
    const totalWon = players.reduce((sum, player) => sum + player.won, 0);
    if (totalWon !== cardsPerPlayer) {
        alert(`La suma de bazas ganadas (${totalWon}) debe ser igual al número de cartas repartidas (${cardsPerPlayer}).\n\nRevisa los datos de las rondas ganadas.`);
        return;
    }

    // Crear el cuerpo de la tabla
    const tbody = document.createElement("tbody");

    // 1. Calcular puntos y actualizar totales
    const roundResults = players.map((player, index) => {
        const points =
            player.bid === player.won
                ? 5 + player.won * 3
                : -3 * Math.abs(player.bid - player.won);

        player.total += points;

        return {
            playerId: index,
            name: player.name,
            bid: player.bid,
            won: player.won,
            points: points,
            total: player.total
        };
    });

    // 2. Ordenar resultados por total de mayor a menor
    roundResults.sort((a, b) => b.total - a.total);

    // 3. Crear las filas de la tabla con los resultados ordenados
    roundResults.forEach((result) => {
        const row = document.createElement("tr");
        row.innerHTML = `
            <td>${result.name}</td>
            <td>${result.bid}</td>
            <td>${result.won}</td>
            <td>${result.points}</td>
            <td class="total">${result.total}</td>
        `;
        tbody.appendChild(row);
    });

    // 4. Reset para la siguiente ronda en el estado global
    players.forEach(player => {
        player.bid = 0;
        player.won = 0;
    });

    // 5. Crear el bloque visual y añadirlo al scoreboard
    const scoreboard = document.getElementById("scoreboard");
    const roundBlock = createRoundBlock(round, cardsPerPlayer, roundResults);
    scoreboard.insertBefore(roundBlock, scoreboard.firstChild);

    // Habilitar botón de deshacer
    document.getElementById("undo-round").disabled = false;

    // 5. Guardar en el historial de la partida actual
    gameRoundsHistory.push({
        round: round,
        cards: cardsPerPlayer,
        dealer: players[dealerIndex].name || `Jugador ${dealerIndex + 1}`,
        results: roundResults
    });

    // Avanzar a la siguiente ronda si es posible
    if (round < maxRounds) {
        cardsPerPlayer = roundCardsSequence[round]; // round ya es el índice para la "siguiente"
        dealerIndex = (dealerIndex + 1) % numPlayers;
        round++;
        updateDisplay();
        updateCurrentRoundHeader();
    } else {
        gameActive = false;
        document.getElementById("next-round").disabled = true;
        document.getElementById("next-round").textContent = "Partida Finalizada";
        document.getElementById("current-round-header").textContent = "¡Fin de la partida!";

        saveGameToHistory();
    }
}

function undoLastRound() {
    if (gameRoundsHistory.length === 0) return;

    const wasGameOver = !gameActive;
    const lastRound = gameRoundsHistory.pop();

    // Revertir puntuaciones
    lastRound.results.forEach(res => {
        let playerIndex = -1;
        if (typeof res.playerId !== 'undefined') {
            playerIndex = res.playerId;
        } else {
            // Fallback por nombre para versiones anteriores
            playerIndex = players.findIndex(p => p.name === res.name);
        }

        if (playerIndex !== -1) {
            players[playerIndex].total -= res.points;
        }
    });

    // Eliminar bloque visual del historial
    const scoreboard = document.getElementById("scoreboard");
    if (scoreboard.firstChild) {
        scoreboard.removeChild(scoreboard.firstChild);
    }

    if (wasGameOver) {
        // Estábamos en el estado de fin de partida, así que restauramos
        gameActive = true;
        document.getElementById("next-round").disabled = false;
        document.getElementById("next-round").textContent = "Guardar ronda";
    } else {
        // Retroceder ronda y dealer
        round--;
        dealerIndex = (dealerIndex - 1 + numPlayers) % numPlayers;
    }

    cardsPerPlayer = roundCardsSequence[round - 1];

    updateDisplay();
    updateCurrentRoundHeader();

    if (gameRoundsHistory.length === 0) {
        document.getElementById("undo-round").disabled = true;
    }
}

function saveGameToHistory() {
    const history = JSON.parse(localStorage.getItem("pocha_history") || "[]");

    // Formato "Partida dd/mm/aa hh.mm"
    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = String(now.getFullYear()).slice(-2);
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const gameName = `Partida ${day}/${month}/${year} ${hours}.${minutes}`;

    const gameData = {
        id: Date.now(),
        name: gameName,
        date: now.toLocaleString(),
        players: players.map(p => ({ name: p.name, total: p.total })),
        rounds: gameRoundsHistory
    };

    history.push(gameData);
    localStorage.setItem("pocha_history", JSON.stringify(history));
    console.log("Juego guardado en el historial:", gameData);
}

function createRoundBlock(roundNum, cardsNum, results) {
    const roundBlock = document.createElement("div");
    roundBlock.className = "round-block";

    const roundHeader = document.createElement("div");
    roundHeader.className = "round-label";
    roundHeader.textContent = `Ronda: ${roundNum}, Cartas: ${cardsNum}`;

    const table = document.createElement("table");
    table.className = "round-table";

    table.innerHTML = `
        <thead>
            <tr>
                <th>Jugador</th>
                <th>Bets</th>
                <th>Wins</th>
                <th>Pts</th>
                <th>Total</th>
            </tr>
        </thead>
        <tbody>
            ${results.map(res => `
                <tr>
                    <td>${res.name}</td>
                    <td>${res.bid}</td>
                    <td>${res.won}</td>
                    <td>${res.points}</td>
                    <td class="total">${res.total}</td>
                </tr>
            `).join('')}
        </tbody>
    `;

    roundBlock.appendChild(roundHeader);
    roundBlock.appendChild(table);
    return roundBlock;
}

function openHistoryModal() {
    const modal = document.getElementById("history-modal");
    const historyList = document.getElementById("history-list");
    const history = JSON.parse(localStorage.getItem("pocha_history") || "[]");

    historyList.innerHTML = "";

    if (history.length === 0) {
        historyList.innerHTML = "<p style='text-align:center; padding: 1rem;'>No hay partidas guardadas.</p>";
    } else {
        // Mostrar de más reciente a más antigua
        history.slice().reverse().forEach(game => {
            const item = document.createElement("div");
            item.className = "history-item";

            // Clonar y ordenar jugadores por puntuación (mayor a menor)
            const sortedPlayers = [...game.players].sort((a, b) => b.total - a.total);

            // Generar texto HTML: Ganador en negrita, resto normal
            const playersHtml = sortedPlayers.map((p, index) => {
                const text = `${p.name}: ${p.total}`;
                return index === 0 ? `<strong>${text}</strong>` : text;
            }).join(', ');

            item.innerHTML = `
                <div style="display: flex; align-items: center; gap: 0.5rem; width: 100%">
                    <div style="flex: 1">
                        <div class="game-name">${game.name}</div>
                        <div class="game-players" style="margin-top: 4px;">${playersHtml}</div>
                    </div>
                    <button class="btn-delete-game" data-id="${game.id}" style="background: #c44; border: none; color: white; padding: 0.3rem 0.6rem; border-radius: 4px; cursor: pointer; font-size: 0.8rem;">🗑️</button>
                </div>
            `;

            // Click en el item abre el detalle
            item.addEventListener('click', (e) => {
                if (!e.target.classList.contains('btn-delete-game')) {
                    viewGameHistory(game);
                    modal.style.display = "none";
                }
            });

            // Click en el botón de borrar
            const deleteBtn = item.querySelector('.btn-delete-game');
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (confirm(`¿Borrar la partida "${game.name}"?`)) {
                    deleteGame(game.id);
                    openHistoryModal(); // Recargar la lista
                }
            });

            historyList.appendChild(item);
        });
    }

    modal.style.display = "block";
}

function deleteGame(gameId) {
    const history = JSON.parse(localStorage.getItem("pocha_history") || "[]");
    const updatedHistory = history.filter(game => game.id !== gameId);
    localStorage.setItem("pocha_history", JSON.stringify(updatedHistory));
}

function viewGameHistory(game) {
    activeHistoryGame = game;
    const scoreboard = document.getElementById("scoreboard");
    scoreboard.innerHTML = `<h3>Visualizando: ${game.name}</h3>`;

    // Los guardamos de últimos a primeros para que el insertBefore los deje en orden inverso (nuevos arriba)
    // Pero en el historial vienen en orden cronológico, así que los recorremos y los insertamos uno tras otro arriba
    game.rounds.forEach(roundData => {
        const block = createRoundBlock(roundData.round, roundData.cards, roundData.results);
        scoreboard.insertBefore(block, scoreboard.children[1]); // Insertamos después del título
    });

    document.getElementById("current-round-header").textContent = `Historial: ${game.name}`;
    document.getElementById("next-round").disabled = true;
    document.getElementById("next-round").textContent = "Viendo historial";

    // Desactivar botones de control para evitar problemas
    document.querySelector(".controls").style.opacity = "0.3";
    document.querySelector(".controls").style.pointerEvents = "none";
}

function askPlayerNames() {
    players.forEach((player, i) => {
        const name = prompt(`Nombre del jugador ${i + 1}:`, `Jugador ${i + 1}`);
        player.name = name || `Jugador ${i + 1}`;
    });
    updateDisplay();
}

function askDealer() {
    let valid = false;
    while (!valid) {
        const input = prompt(
            `¿Qué jugador empieza repartiendo?\n1: ${players[0].name}\n2: ${players[1].name}\n3: ${players[2].name}\n4: ${players[3].name}`,
            "1"
        );
        const index = parseInt(input) - 1;
        if (index >= 0 && index < numPlayers) {
            dealerIndex = index;
            valid = true;
        } else if (input === null) {
            // Si cancela, por defecto el 1
            dealerIndex = 0;
            valid = true;
        }
    }
    updateCurrentRoundHeader();
}

function setup() {
    // Escuchar cambios en los nombres para actualizar el estado inmediatamente
    document.querySelectorAll(".player-name").forEach((input, index) => {
        input.addEventListener("input", () => {
            players[index].name = input.value;
            updateCurrentRoundHeader();
        });
    });

    document.querySelectorAll(".bid-plus").forEach((btn, i) =>
        btn.addEventListener("click", () => changeValue(getIndex(btn), "bid", 1))
    );
    document.querySelectorAll(".bid-minus").forEach((btn, i) =>
        btn.addEventListener("click", () => changeValue(getIndex(btn), "bid", -1))
    );
    document.querySelectorAll(".won-plus").forEach((btn, i) =>
        btn.addEventListener("click", () => changeValue(getIndex(btn), "won", 1))
    );
    document.querySelectorAll(".won-minus").forEach((btn, i) =>
        btn.addEventListener("click", () => changeValue(getIndex(btn), "won", -1))
    );

    document.getElementById("next-round").addEventListener("click", saveRound);
    document.getElementById("undo-round").addEventListener("click", undoLastRound);
    document.getElementById("open-chart").addEventListener("click", showChart);
    document.getElementById("open-history").addEventListener("click", openHistoryModal);
    document.getElementById("close-history").addEventListener("click", () => {
        document.getElementById("history-modal").style.display = "none";
    });

    document.getElementById("close-chart").addEventListener("click", () => {
        document.getElementById("chart-modal").style.display = "none";
    });
    document.getElementById("close-chart-btn").addEventListener("click", () => {
        document.getElementById("chart-modal").style.display = "none";
    });

    window.onclick = (event) => {
        const modal = document.getElementById("history-modal");
        if (event.target == modal) {
            modal.style.display = "none";
        }
    };

    // Pequeño retardo para asegurar que el navegador permite los prompts al cargar
    setTimeout(() => {
        resetGame();
    }, 500);
}

function resetGame() {
    activeHistoryGame = null;
    // Resetear estado
    round = 1;
    cardsPerPlayer = roundCardsSequence[0];
    dealerIndex = 0;
    gameActive = true;
    players.forEach(p => {
        p.bid = 0;
        p.won = 0;
        p.total = 0;
    });

    // Limpiar UI
    document.getElementById("scoreboard").innerHTML = "";
    document.getElementById("next-round").disabled = false;
    document.getElementById("next-round").textContent = "Guardar ronda";
    document.getElementById("undo-round").disabled = true;

    // Pedir datos
    askPlayerNames();
    askDealer();

    updateDisplay();
    updateCurrentRoundHeader();
}

function getIndex(element) {
    return parseInt(element.closest(".player-card").dataset.player);
}

window.addEventListener("load", setup);

function showChart() {
    const isHistory = !!activeHistoryGame;
    const historySource = isHistory ? activeHistoryGame.rounds : gameRoundsHistory;
    const playerSource = isHistory ? activeHistoryGame.players : players;

    // Datasets init
    const datasets = playerSource.map((p, i) => ({
        label: p.name,
        data: [0], // Todos empiezan en 0
        borderColor: getPlayerColor(i),
        backgroundColor: getPlayerColor(i),
        tension: 0.1,
        fill: false,
        pointRadius: 4,
        pointHoverRadius: 6
    }));

    const labels = ["Inicio"];

    // Populate data
    historySource.forEach(roundData => {
        labels.push(`R ${roundData.round}`);

        // Los resultados están ordenados, así que buscamos al jugador correcto
        roundData.results.forEach(res => {
            let pIndex = -1;
            if (typeof res.playerId !== 'undefined') {
                pIndex = res.playerId;
            } else {
                pIndex = playerSource.findIndex(p => p.name === res.name);
            }

            if (pIndex !== -1) {
                datasets[pIndex].data.push(res.total);
            }
        });
    });

    // Sort datasets by final score descending
    datasets.sort((a, b) => {
        const lastA = a.data[a.data.length - 1];
        const lastB = b.data[b.data.length - 1];
        return lastB - lastA;
    });

    // Prepare modal
    const ctx = document.getElementById('scoreChart').getContext('2d');
    if (chartInstance) {
        chartInstance.destroy();
    }

    Chart.defaults.font.family = "'Quicksand', sans-serif";
    Chart.defaults.color = '#1e4022';

    chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false,
            },
            scales: {
                y: {
                    grid: { color: 'rgba(30, 64, 34, 0.1)' },
                    ticks: { color: '#1e4022' }
                },
                x: {
                    grid: { color: 'rgba(30, 64, 34, 0.1)' },
                    ticks: { color: '#1e4022' }
                }
            },
            plugins: {
                legend: {
                    labels: { color: '#1e4022' }
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    itemSort: function (a, b) {
                        return b.raw - a.raw; // Ordenar de mayor a menor en el tooltip
                    }
                }
            }
        }
    });

    document.getElementById("chart-modal").style.display = "block";
}

function getPlayerColor(index) {
    const colors = ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0'];
    return colors[index % colors.length];
}

// PWA Service Worker Registration
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js')
            .then(registration => {
                console.log('ServiceWorker registration successful with scope: ', registration.scope);
            })
            .catch(err => {
                console.log('ServiceWorker registration failed: ', err);
            });
    });
}

// Funcionalidad de Backup (Migración)
window.addEventListener('DOMContentLoaded', () => {
    const backupArea = document.getElementById('backup-area');
    const backupText = document.getElementById('backup-text');
    const btnSaveImport = document.getElementById('btn-save-import');
    const btnSaveSingle = document.getElementById('btn-save-single');
    const btnCopy = document.getElementById('btn-copy-clipboard');
    const backupStatus = document.getElementById('backup-status');

    if (!document.getElementById('btn-export')) return;

    document.getElementById('btn-export').addEventListener('click', () => {
        // Intentar leer de la clave correcta (pocha_history)
        const data = localStorage.getItem("pocha_history") || '[]';
        backupArea.style.display = 'block';
        backupText.value = data;
        btnSaveImport.style.display = 'none';
        btnSaveSingle.style.display = 'none';

        if (btnCopy) btnCopy.style.display = 'block';

        backupStatus.innerHTML = 'Pulsa "Copiar al Portapapeles" o selecciona el texto manualmente.';
    });

    document.getElementById('btn-import').addEventListener('click', () => {
        backupArea.style.display = 'block';
        backupText.value = '';
        backupText.placeholder = 'Pega aquí el código copiado de la otra versión...';
        btnSaveImport.style.display = 'block';
        btnSaveSingle.style.display = 'none';
        if (btnCopy) btnCopy.style.display = 'none';
        backupStatus.textContent = 'Pega el texto y pulsa "Restaurar Datos".';
    });

    document.getElementById('btn-import-single').addEventListener('click', () => {
        backupArea.style.display = 'block';
        backupText.value = '';
        backupText.placeholder = 'Pega aquí el JSON de una partida individual...';
        btnSaveImport.style.display = 'none';
        btnSaveSingle.style.display = 'block';
        if (btnCopy) btnCopy.style.display = 'none';
        backupStatus.textContent = 'Pega el JSON de una partida y pulsa "Añadir Partida".';
    });

    if (btnCopy) {
        btnCopy.addEventListener('click', () => {
            const text = backupText.value;
            if (navigator.clipboard) {
                navigator.clipboard.writeText(text).then(() => {
                    alert("¡Copiado al portapapeles!");
                }).catch(err => {
                    // Fallback select
                    backupText.select();
                    document.execCommand('copy');
                    alert("Texto seleccionado. Si no se copió, hazlo manualmente.");
                });
            } else {
                backupText.select();
                document.execCommand('copy');
                alert("Texto seleccionado. Cópialo manualmente.");
            }
        });
    }

    btnSaveImport.addEventListener('click', () => {
        try {
            const dataStr = backupText.value.trim();
            if (!dataStr) {
                alert("Por favor, pega los datos primero.");
                return;
            }

            const data = JSON.parse(dataStr);
            if (Array.isArray(data)) {
                if (confirm("Se van a sobrescribir las partidas actuales con las pegadas. ¿Continuar?")) {
                    localStorage.setItem("pocha_history", JSON.stringify(data));
                    alert("¡Datos restaurados correctamente!");
                    location.reload();
                }
            } else {
                alert("Error: El formato no es válido (no es una lista).");
            }
        } catch (e) {
            alert("Error: El texto no es un JSON válido. Revisa que lo hayas copiado todo.");
        }
    });

    // Validar que un objeto de partida tiene la estructura correcta
    function isValidGame(obj) {
        return (
            obj &&
            typeof obj === 'object' &&
            typeof obj.id === 'number' &&
            typeof obj.name === 'string' &&
            typeof obj.date === 'string' &&
            Array.isArray(obj.players) &&
            Array.isArray(obj.rounds)
        );
    }

    btnSaveSingle.addEventListener('click', () => {
        try {
            const dataStr = backupText.value.trim();
            if (!dataStr) {
                alert("Por favor, pega los datos primero.");
                return;
            }

            const game = JSON.parse(dataStr);

            // Verificar que sea un objeto de partida válido
            if (isValidGame(game)) {
                // Obtener historial actual y añadir la nueva partida
                const history = JSON.parse(localStorage.getItem("pocha_history") || "[]");

                // Verificar si ya existe una partida con el mismo ID
                const exists = history.some(g => g.id === game.id);
                if (exists) {
                    alert("Esta partida ya existe en el historial (mismo ID).");
                    return;
                }

                history.push(game);
                localStorage.setItem("pocha_history", JSON.stringify(history));
                alert("¡Partida añadida correctamente!");
                location.reload();
            } else {
                alert("Error: El formato no es válido. Debe ser un objeto de partida con los campos: id, name, date, players, rounds.");
            }
        } catch (e) {
            alert("Error: El texto no es un JSON válido. Revisa que lo hayas copiado todo.");
        }
    });
});

// ============================================
// ESTADÍSTICAS
// ============================================

// Normalizar nombres para unificar variantes
function normalizeName(name) {
    const nameMap = {
        'Angel': 'Ángel',
        'Japi': 'Cristina',
        'Pipi': 'Javi',
        'Pepa': 'Pepa'
    };
    return nameMap[name] || name;
}

// Abrir modal de estadísticas de la partida actual
document.getElementById('open-stats').addEventListener('click', () => {
    if (gameRoundsHistory.length === 0) {
        alert("No hay rondas jugadas aún para mostrar estadísticas.");
        return;
    }
    showGameStats(activeHistoryGame || { rounds: gameRoundsHistory, players: players.map(p => ({ name: p.name, total: p.total })) });
});

// Abrir modal de estadísticas globales desde el historial
document.getElementById('btn-global-stats').addEventListener('click', () => {
    const history = JSON.parse(localStorage.getItem("pocha_history") || "[]");
    if (history.length === 0) {
        alert("No hay partidas en el historial.");
        return;
    }
    document.getElementById('history-modal').style.display = 'none';
    showGlobalStats(history);
});

// Cerrar modal de estadísticas
document.getElementById('close-stats').addEventListener('click', () => {
    document.getElementById('stats-modal').style.display = 'none';
});

// Cerrar modal al hacer clic fuera
window.addEventListener('click', (e) => {
    const statsModal = document.getElementById('stats-modal');
    if (e.target === statsModal) {
        statsModal.style.display = 'none';
    }
});

// Calcular mejor racha positiva de un jugador en una partida
function calculatePositiveStreak(game, playerName) {
    let maxStreak = 0;
    let currentStreak = 0;

    game.rounds.forEach(round => {
        const playerResult = round.results.find(r => r.name === playerName);
        if (playerResult && playerResult.points >= 0) {
            currentStreak++;
            maxStreak = Math.max(maxStreak, currentStreak);
        } else {
            currentStreak = 0;
        }
    });

    return maxStreak;
}

// Calcular mejor racha negativa de un jugador en una partida
function calculateNegativeStreak(game, playerName) {
    let maxStreak = 0;
    let currentStreak = 0;

    game.rounds.forEach(round => {
        const playerResult = round.results.find(r => r.name === playerName);
        if (playerResult && playerResult.points < 0) {
            currentStreak++;
            maxStreak = Math.max(maxStreak, currentStreak);
        } else {
            currentStreak = 0;
        }
    });

    return maxStreak;
}

// Calcular % de acierto de un jugador en una partida
function calculateAccuracy(game, playerName) {
    let exactRounds = 0;
    game.rounds.forEach(round => {
        const playerResult = round.results.find(r => r.name === playerName);
        if (playerResult && playerResult.bid === playerResult.won) {
            exactRounds++;
        }
    });
    return game.rounds.length > 0 ? ((exactRounds / game.rounds.length) * 100).toFixed(1) : 0;
}

// Calcular mejor ronda individual de un jugador
function calculateBestRound(game, playerName) {
    let best = -Infinity;
    game.rounds.forEach(round => {
        const playerResult = round.results.find(r => r.name === playerName);
        if (playerResult && playerResult.points > best) {
            best = playerResult.points;
        }
    });
    return best > -Infinity ? best : 0;
}

// Calcular peor ronda individual de un jugador
function calculateWorstRound(game, playerName) {
    let worst = Infinity;
    game.rounds.forEach(round => {
        const playerResult = round.results.find(r => r.name === playerName);
        if (playerResult && playerResult.points < worst) {
            worst = playerResult.points;
        }
    });
    return worst < Infinity ? worst : 0;
}

// Mostrar estadísticas de una partida concreta
function showGameStats(game) {
    const modal = document.getElementById('stats-modal');
    const title = document.getElementById('stats-title');
    const content = document.getElementById('stats-content');

    title.textContent = `Estadísticas: ${game.name || 'Partida actual'}`;

    const playerNames = game.rounds[0]?.results.map(r => r.name) || [];

    let html = '<div class="stats-section">';

    // Mejor racha positiva
    html += '<h4 style="color: #eac77a;">🔥 Mejor Racha Positiva (rondas sin negativos)</h4>';
    const positiveStreaks = playerNames.map(originalName => {
        const normalizedName = normalizeName(originalName);
        return {
            name: normalizedName,
            streak: calculatePositiveStreak(game, originalName)
        };
    }).sort((a, b) => b.streak - a.streak);
    html += renderStreakTable(positiveStreaks);

    // Mejor racha negativa
    html += '<h4 style="color: #eac77a; margin-top: 1.5rem;">❄️ Mejor Racha Negativa (rondas seguidas con negativos)</h4>';
    const negativeStreaks = playerNames.map(originalName => {
        const normalizedName = normalizeName(originalName);
        return {
            name: normalizedName,
            streak: calculateNegativeStreak(game, originalName)
        };
    }).sort((a, b) => b.streak - a.streak);
    html += renderStreakTable(negativeStreaks);

    // % de acierto
    html += '<h4 style="color: #eac77a; margin-top: 1.5rem;">🎯 % de Acierto (bid = won)</h4>';
    const accuracies = playerNames.map(originalName => {
        const normalizedName = normalizeName(originalName);
        return {
            name: normalizedName,
            value: calculateAccuracy(game, originalName)
        };
    }).sort((a, b) => parseFloat(b.value) - parseFloat(a.value));
    html += '<table class="stats-table"><thead><tr><th>Jugador</th><th>% Acierto</th></tr></thead><tbody>';
    accuracies.forEach(({ name, value }) => {
        html += `<tr><td>${name}</td><td>${value}%</td></tr>`;
    });
    html += '</tbody></table>';

    // Mejor y peor ronda
    html += '<h4 style="color: #eac77a; margin-top: 1.5rem;">📊 Mejor y Peor Ronda Individual</h4>';
    html += '<table class="stats-table"><thead><tr><th>Jugador</th><th>Mejor</th><th>Peor</th></tr></thead><tbody>';
    playerNames.forEach(originalName => {
        const normalizedName = normalizeName(originalName);
        const best = calculateBestRound(game, originalName);
        const worst = calculateWorstRound(game, originalName);
        html += `<tr><td>${normalizedName}</td><td style="color: #4BC0C0;">+${best}</td><td style="color: #e08e79;">${worst}</td></tr>`;
    });
    html += '</tbody></table>';

    html += '</div>';
    content.innerHTML = html;
    modal.style.display = 'block';
}

// Mostrar estadísticas globales del historial
function showGlobalStats(history) {
    const modal = document.getElementById('stats-modal');
    const title = document.getElementById('stats-title');
    const content = document.getElementById('stats-content');

    title.textContent = `Estadísticas Globales (${history.length} partidas)`;

    let html = '<div class="stats-section">';

    // 1. Clasificación histórica (4pts al 1º, 3pts al 2º, 2pts al 3º, 1pt al 4º)
    html += '<h4 style="color: #eac77a;">🏆 Clasificación Histórica</h4>';
    const historicalRanking = calculateHistoricalRanking(history);
    html += '<table class="stats-table"><thead><tr><th>Jugador</th><th>Puntos</th></tr></thead><tbody>';
    historicalRanking.forEach((entry, index) => {
        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '';
        html += `<tr><td>${medal} ${entry.name}</td><td>${entry.points}</td></tr>`;
    });
    html += '</tbody></table>';

    // 2. Top 10 mejores rachas positivas
    html += '<h4 style="color: #eac77a; margin-top: 1.5rem;">🔥 Top 10 Mejores Rachas Positivas</h4>';
    const topPositive = calculateTopPositiveStreaks(history);
    html += renderTopStreaksTable(topPositive);

    // 3. Top 10 mejores rachas negativas
    html += '<h4 style="color: #eac77a; margin-top: 1.5rem;">❄️ Top 10 Mejores Rachas Negativas</h4>';
    const topNegative = calculateTopNegativeStreaks(history);
    html += renderTopStreaksTable(topNegative);

    // 4. Partidas ganadas
    html += '<h4 style="color: #eac77a; margin-top: 1.5rem;">👑 Partidas Ganadas (1º puesto)</h4>';
    const gamesWon = calculateGamesWon(history);
    html += '<table class="stats-table"><thead><tr><th>Jugador</th><th>Victorias</th></tr></thead><tbody>';
    gamesWon.sort((a, b) => b.wins - a.wins).forEach(entry => {
        html += `<tr><td>${entry.name}</td><td>${entry.wins}</td></tr>`;
    });
    html += '</tbody></table>';

    // 5. Puntuación media por partida
    html += '<h4 style="color: #eac77a; margin-top: 1.5rem;">📈 Puntuación Media por Partida</h4>';
    const avgScores = calculateAverageScores(history);
    html += '<table class="stats-table"><thead><tr><th>Jugador</th><th>Media</th></tr></thead><tbody>';
    avgScores.sort((a, b) => b.avg - a.avg).forEach(entry => {
        html += `<tr><td>${entry.name}</td><td>${entry.avg.toFixed(1)}</td></tr>`;
    });
    html += '</tbody></table>';

    // 6. % de acierto global
    html += '<h4 style="color: #eac77a; margin-top: 1.5rem;">🎯 % de Acierto Global</h4>';
    const globalAccuracy = calculateGlobalAccuracy(history);
    html += '<table class="stats-table"><thead><tr><th>Jugador</th><th>% Acierto</th></tr></thead><tbody>';
    globalAccuracy.sort((a, b) => parseFloat(b.accuracy) - parseFloat(a.accuracy)).forEach(entry => {
        html += `<tr><td>${entry.name}</td><td>${entry.accuracy}%</td></tr>`;
    });
    html += '</tbody></table>';

    // 7. NeverMiss - más rondas exactas
    html += '<h4 style="color: #eac77a; margin-top: 1.5rem;">💎 NeverMiss (más rondas exactas)</h4>';
    const neverMiss = calculateNeverMiss(history);
    html += '<table class="stats-table"><thead><tr><th>Jugador</th><th>Rondas Exactas</th></tr></thead><tbody>';
    neverMiss.sort((a, b) => b.exact - a.exact).forEach(entry => {
        html += `<tr><td>${entry.name}</td><td>${entry.exact}</td></tr>`;
    });
    html += '</tbody></table>';

    html += '</div>';
    content.innerHTML = html;
    modal.style.display = 'block';
}

// Clasificación histórica (4-3-2-1 puntos según posición)
function calculateHistoricalRanking(history) {
    const ranking = {};

    history.forEach(game => {
        const sortedPlayers = [...game.players].sort((a, b) => b.total - a.total);
        sortedPlayers.forEach((player, index) => {
            const normalizedName = normalizeName(player.name);
            if (!ranking[normalizedName]) {
                ranking[normalizedName] = 0;
            }
            // 4 puntos al 1º, 3 al 2º, 2 al 3º, 1 al 4º
            ranking[normalizedName] += Math.max(1, 4 - index);
        });
    });

    return Object.entries(ranking)
        .map(([name, points]) => ({ name, points }))
        .sort((a, b) => b.points - a.points);
}

// Top 10 rachas positivas de toda la historia
function calculateTopPositiveStreaks(history) {
    const allStreaks = [];

    history.forEach(game => {
        const playersInGame = new Set();
        game.rounds.forEach(round => {
            round.results.forEach(result => {
                const normalizedName = normalizeName(result.name);
                const key = `${game.id}-${normalizedName}`;
                if (!playersInGame.has(key)) {
                    const streak = calculatePositiveStreak(game, result.name);
                    if (streak > 0) {
                        allStreaks.push({
                            name: normalizedName,
                            streak,
                            game: game.name
                        });
                    }
                    playersInGame.add(key);
                }
            });
        });
    });

    return allStreaks.sort((a, b) => b.streak - a.streak).slice(0, 10);
}

// Top 10 rachas negativas de toda la historia
function calculateTopNegativeStreaks(history) {
    const allStreaks = [];

    history.forEach(game => {
        const playersInGame = new Set();
        game.rounds.forEach(round => {
            round.results.forEach(result => {
                const normalizedName = normalizeName(result.name);
                const key = `${game.id}-${normalizedName}`;
                if (!playersInGame.has(key)) {
                    const streak = calculateNegativeStreak(game, result.name);
                    if (streak > 0) {
                        allStreaks.push({
                            name: normalizedName,
                            streak,
                            game: game.name
                        });
                    }
                    playersInGame.add(key);
                }
            });
        });
    });

    return allStreaks.sort((a, b) => b.streak - a.streak).slice(0, 10);
}

// Partidas ganadas (veces que quedó 1º)
function calculateGamesWon(history) {
    const wins = {};

    history.forEach(game => {
        const winner = game.players.sort((a, b) => b.total - a.total)[0];
        const normalizedName = normalizeName(winner.name);
        if (!wins[normalizedName]) {
            wins[normalizedName] = 0;
        }
        wins[normalizedName]++;
    });

    return Object.entries(wins).map(([name, wins]) => ({ name, wins }));
}

// Puntuación media por partida
function calculateAverageScores(history) {
    const scores = {};

    history.forEach(game => {
        game.players.forEach(player => {
            const normalizedName = normalizeName(player.name);
            if (!scores[normalizedName]) {
                scores[normalizedName] = { total: 0, count: 0 };
            }
            scores[normalizedName].total += player.total;
            scores[normalizedName].count++;
        });
    });

    return Object.entries(scores).map(([name, data]) => ({
        name,
        avg: data.total / data.count
    }));
}

// % de acierto global
function calculateGlobalAccuracy(history) {
    const accuracy = {};

    history.forEach(game => {
        game.rounds.forEach(round => {
            round.results.forEach(result => {
                const normalizedName = normalizeName(result.name);
                if (!accuracy[normalizedName]) {
                    accuracy[normalizedName] = { exact: 0, total: 0 };
                }
                accuracy[normalizedName].total++;
                if (result.bid === result.won) {
                    accuracy[normalizedName].exact++;
                }
            });
        });
    });

    return Object.entries(accuracy).map(([name, data]) => ({
        name,
        accuracy: ((data.exact / data.total) * 100).toFixed(1)
    }));
}

// NeverMiss - más rondas exactas
function calculateNeverMiss(history) {
    const exact = {};

    history.forEach(game => {
        game.rounds.forEach(round => {
            round.results.forEach(result => {
                const normalizedName = normalizeName(result.name);
                if (!exact[normalizedName]) {
                    exact[normalizedName] = 0;
                }
                if (result.bid === result.won) {
                    exact[normalizedName]++;
                }
            });
        });
    });

    return Object.entries(exact).map(([name, exact]) => ({ name, exact }));
}

// Helpers para renderizar tablas
function renderStreakTable(streaks) {
    let html = '<table class="stats-table"><thead><tr><th>Jugador</th><th>Rondas</th></tr></thead><tbody>';
    streaks.forEach(({ name, streak }) => {
        html += `<tr><td>${name}</td><td>${streak}</td></tr>`;
    });
    html += '</tbody></table>';
    return html;
}

function renderTopStreaksTable(topStreaks) {
    let html = '<table class="stats-table"><thead><tr><th>#</th><th>Jugador</th><th>Rondas</th><th>Partida</th></tr></thead><tbody>';
    topStreaks.forEach((entry, index) => {
        html += `<tr><td>${index + 1}</td><td>${entry.name}</td><td>${entry.streak}</td><td style="font-size: 0.8rem; opacity: 0.8;">${entry.game}</td></tr>`;
    });
    html += '</tbody></table>';
    return html;
}
