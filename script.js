const numPlayers = 4;
const roundCardsSequence = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 10, 10, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1];
const maxRounds = roundCardsSequence.length;
let round = 1;
let cardsPerPlayer = roundCardsSequence[0];
let dealerIndex = 0;
let gameActive = true;
let gameRoundsHistory = [];

const players = Array.from({ length: numPlayers }, (_, i) => ({
    name: '',
    bid: 0,
    won: 0,
    total: 0
}));

function updateCurrentRoundHeader() {
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
            item.innerHTML = `
                <div>
                    <div class="game-name">${game.name}</div>
                    <div class="game-players">${game.players.map(p => p.name).join(', ')}</div>
                </div>
                <div class="game-name">${game.players[0].total} pts</div>
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
    document.getElementById("open-history").addEventListener("click", openHistoryModal);
    document.getElementById("close-history").addEventListener("click", () => {
        document.getElementById("history-modal").style.display = "none";
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
