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
        messages.push(`${dealer.name} no puede apostar ${dealer.bid} rondas`);
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
                <div style="width: 100%">
                    <div class="game-name">${game.name}</div>
                    <div class="game-players" style="margin-top: 4px;">${playersHtml}</div>
                </div>
            `;
            item.onclick = () => {
                viewGameHistory(game);
                modal.style.display = "none";
            };
            historyList.appendChild(item);
        });
    }

    modal.style.display = "block";
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
                    intersect: false
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
    const backupStatus = document.getElementById('backup-status');

    if (!document.getElementById('btn-export')) return;

    document.getElementById('btn-export').addEventListener('click', () => {
        const data = localStorage.getItem("pocha_game_history") || '[]';
        backupArea.style.display = 'block';
        backupText.value = data;
        btnSaveImport.style.display = 'none';
        backupStatus.innerHTML = '<strong>COPIAR:</strong> Selecciona todo el texto de arriba y cópialo.';
        backupText.select();
    });

    document.getElementById('btn-import').addEventListener('click', () => {
        backupArea.style.display = 'block';
        backupText.value = '';
        backupText.placeholder = 'Pega aquí el código copiado de la otra versión...';
        btnSaveImport.style.display = 'block';
        backupStatus.textContent = 'Pega el texto y pulsa "Restaurar Datos".';
    });

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
                    localStorage.setItem("pocha_game_history", JSON.stringify(data));
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
});
