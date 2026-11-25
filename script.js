
const STORAGE_KEY = "financePro_v1";

const $ = id => document.getElementById(id);

let config = {
    initial: 10.14,
    target: 30,
    stopWin: 5,
    stopLoss: 5,
    days: 30,
    currency: "BRL"
};

let results = {};
let chart = null;

function roundMoney(value) {
    return Math.round((value + Number.EPSILON) * 100) / 100;
}

function money(value) {
    return new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: config.currency
    }).format(value);
}

function percent(value) {
    return `${value.toFixed(2).replace(".", ",")}%`;
}

function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
        config,
        results
    }));
}

function load() {
    try {
        const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));

        if (!saved || !saved.config) return;

        const c = saved.config;

        if (
            !Number.isFinite(c.initial) ||
            !Number.isFinite(c.target) ||
            !Number.isInteger(c.days) ||
            c.days < 1 || c.days > 365 ||
            !["BRL", "USD"].includes(c.currency)
        ) return;

        config = { ...config, ...c };

        results = saved.results &&
            typeof saved.results === "object" &&
            !Array.isArray(saved.results)
            ? saved.results
            : {};

        $("initial").value = config.initial;
        $("target").value = config.target;
        $("stopWin").value = config.stopWin;
        $("stopLoss").value = config.stopLoss;
        $("days").value = config.days;
        $("currency").value = config.currency;

    } catch (error) {
        console.error("Erro ao recuperar dados:", error);
    }
}

function calculate() {
    const rows = [];

    let balance = roundMoney(config.initial);

    for (let day = 1; day <= config.days; day++) {

        const startingBalance = balance;

        const projected = roundMoney(
            startingBalance * (1 + config.target / 100)
        );

        const hasResult = Object.prototype.hasOwnProperty.call(
            results,
            day
        ) && results[day] !== "";

        const actual = hasResult
            ? Number(results[day])
            : null;

        const difference = actual === null
            ? null
            : roundMoney(actual - startingBalance);

        const variation = actual === null || startingBalance === 0
            ? null
            : (difference / startingBalance) * 100;

        let status = "PENDENTE";

        if (actual !== null) {
            if (difference > 0) status = "GREEN";
            else if (difference < 0) status = "RED";
            else status = "NEUTRO";

            balance = roundMoney(actual);
        }

        let alert = "";

        if (actual !== null && difference !== null) {
            if (config.stopWin > 0 && difference >= config.stopWin) {
                alert = "LIMITE DE GANHO";
            } else if (
                config.stopLoss > 0 &&
                difference <= -config.stopLoss
            ) {
                alert = "LIMITE DE PERDA";
            }
        }

        rows.push({
            day,
            startingBalance,
            projected,
            actual,
            difference,
            variation,
            status,
            endingBalance: actual,
            alert
        });
    }

    return rows;
}

function renderTable(rows) {
    const body = $("tableBody");

    body.innerHTML = rows.map(row => {

        const statusClass = {
            GREEN: "green",
            RED: "red",
            NEUTRO: "neutral",
            PENDENTE: "neutral"
        }[row.status];

        const difference = row.difference === null
            ? "--"
            : money(row.difference);

        const variation = row.variation === null
            ? "--"
            : percent(row.variation);

        const finalValue = row.actual === null
            ? "--"
            : money(row.actual);

        const differenceClass = row.difference > 0
            ? "positive"
            : row.difference < 0
                ? "negative"
                : "";

        const alertClass = row.alert ? "warning" : "";

        return `
            <tr>
                <td class="day-number">${String(row.day).padStart(2, "0")}</td>

                <td>${money(row.startingBalance)}</td>

                <td>${percent(config.target)}</td>

                <td>${money(row.projected)}</td>

                <td>
                    <input
                        class="result-input"
                        type="number"
                        min="0"
                        step="0.01"
                        data-day="${row.day}"
                        value="${row.actual === null ? "" : row.actual.toFixed(2)}"
                        placeholder="0,00"
                        aria-label="Saldo final do dia ${row.day}"
                    >
                </td>

                <td class="${differenceClass}">${difference}</td>

                <td>
                    <span class="status ${statusClass}">
                        ${row.status}
                    </span>
                </td>

                <td>${finalValue}</td>

                <td class="alert ${alertClass}">
                    ${row.alert || "--"}
                </td>
            </tr>
        `;
    }).join("");
}

function renderDashboard(rows) {
    const completed = rows.filter(r => r.actual !== null);

    const currentBalance = completed.length
        ? completed[completed.length - 1].actual
        : config.initial;

    const profit = roundMoney(currentBalance - config.initial);

    const growth = config.initial > 0
        ? (profit / config.initial) * 100
        : 0;

    const nextDay = rows.find(r => r.actual === null);

    $("cardInitial").textContent = money(config.initial);
    $("cardBalance").textContent = money(currentBalance);
    $("cardTarget").textContent = nextDay
        ? money(nextDay.projected)
        : "--";

    $("cardProfit").textContent = money(profit);
    $("cardProfit").style.color = profit > 0
        ? "var(--green)"
        : profit < 0
            ? "var(--red)"
            : "var(--text)";

    $("cardCompleted").textContent = completed.length;
    $("daysLabel").textContent = `De ${config.days} dias`;

    $("cardGrowth").textContent = percent(growth);
    $("cardGrowth").style.color = growth >= 0
        ? "var(--green)"
        : "var(--red)";

    const greens = completed.filter(r => r.status === "GREEN");
    const reds = completed.filter(r => r.status === "RED");
    const neutrals = completed.filter(r => r.status === "NEUTRO");

    $("greens").textContent = greens.length;
    $("reds").textContent = reds.length;
    $("neutrals").textContent = neutrals.length;

    const best = completed.length
        ? completed.reduce((a, b) =>
            a.difference > b.difference ? a : b)
        : null;

    const worst = completed.length
        ? completed.reduce((a, b) =>
            a.difference < b.difference ? a : b)
        : null;

    $("bestDay").textContent = best
        ? `D${best.day} · ${money(best.difference)}`
        : "--";

    $("worstDay").textContent = worst
        ? `D${worst.day} · ${money(worst.difference)}`
        : "--";

    $("positiveRate").textContent = completed.length
        ? percent((greens.length / completed.length) * 100)
        : "0%";
}


function renderChart(rows) {
    const completed = rows.filter(row => row.actual !== null);

    const labels = [
        "Inicial",
        ...completed.map(row => `Dia ${row.day}`)
    ];

    // Histórico real: somente dias finalizados
    const actualData = [
        config.initial,
        ...completed.map(row => row.actual)
    ];

    // Projeção independente
    let projectedBalance = roundMoney(config.initial);

    const projectedData = [projectedBalance];

    completed.forEach(row => {
        projectedBalance = roundMoney(
            projectedBalance * (1 + config.target / 100)
        );

        projectedData.push(projectedBalance);
    });

    const context = $("evolutionChart").getContext("2d");

    if (chart) chart.destroy();

    chart = new Chart(context, {
        type: "line",

        data: {
            labels,

            datasets: [
                {
                    label: "Evolução real",
                    data: actualData,
                    borderColor: "#25d69a",
                    backgroundColor: "rgba(37,214,154,.12)",
                    borderWidth: 3,
                    fill: true,
                    tension: 0.25,
                    pointRadius: 5,
                    pointHoverRadius: 8
                },
                {
                    label: "Projeção teórica",
                    data: projectedData,
                    borderColor: "#9b83ff",
                    backgroundColor: "transparent",
                    borderWidth: 2,
                    borderDash: [6, 5],
                    fill: false,
                    tension: 0.25,
                    pointRadius: 3
                }
            ]
        },

        options: {
            responsive: true,
            maintainAspectRatio: false,

            interaction: {
                intersect: false,
                mode: "index"
            },

            plugins: {
                legend: {
                    labels: {
                        color: "#edf3ff",
                        usePointStyle: true,
                        padding: 20
                    }
                },

                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return context.dataset.label + ": " +
                                money(context.parsed.y);
                        }
                    }
                }
            },

            scales: {
                x: {
                    title: {
                        display: true,
                        text: "DIAS FINALIZADOS",
                        color: "#8492a8"
                    },
                    grid: {
                        color: "rgba(255,255,255,.04)"
                    },
                    ticks: {
                        color: "#8492a8"
                    }
                },

                y: {
                    title: {
                        display: true,
                        text: "VALOR DA BANCA",
                        color: "#8492a8"
                    },
                    beginAtZero: false,
                    grid: {
                        color: "rgba(255,255,255,.06)"
                    },
                    ticks: {
                        color: "#8492a8",
                        callback: value => money(value)
                    }
                }
            }
        }
    });
}


function render() {
    const rows = calculate();

    renderTable(rows);
    renderDashboard(rows);
    renderChart(rows);

    save();
}

$("configForm").addEventListener("submit", event => {
    event.preventDefault();

    const newConfig = {
        initial: Number($("initial").value),
        target: Number($("target").value),
        stopWin: Number($("stopWin").value),
        stopLoss: Number($("stopLoss").value),
        days: Number($("days").value),
        currency: $("currency").value
    };

    if (
        !Number.isFinite(newConfig.initial) ||
        newConfig.initial <= 0 ||
        !Number.isFinite(newConfig.target) ||
        newConfig.target < 0 ||
        newConfig.target > 1000 ||
        !Number.isFinite(newConfig.stopWin) ||
        newConfig.stopWin < 0 ||
        !Number.isFinite(newConfig.stopLoss) ||
        newConfig.stopLoss < 0 ||
        !Number.isInteger(newConfig.days) ||
        newConfig.days < 1 ||
        newConfig.days > 365
    ) {
        alert("Verifique os valores informados.");
        return;
    }

    const changingInitial =
        newConfig.initial !== config.initial;

    if (changingInitial && Object.keys(results).length) {
        if (!confirm("Alterar o capital inicial e reiniciar os registros?")) {
            $("initial").value = config.initial;
            return;
        }

        results = {};
    }

    config = newConfig;

    Object.keys(results).forEach(day => {
        if (Number(day) > config.days) {
            delete results[day];
        }
    });

    render();
});

$("tableBody").addEventListener("change", event => {
    const input = event.target.closest(".result-input");

    if (!input) return;

    const day = Number(input.dataset.day);
    const value = input.value.trim();

    if (value === "") {
        delete results[day];
        render();
        return;
    }

    const amount = Number(value);

    if (!Number.isFinite(amount) || amount < 0) {
        alert("Informe um valor válido.");
        input.value = results[day] ?? "";
        return;
    }

    results[day] = roundMoney(amount);

    render();
});

$("resetSimulation").addEventListener("click", () => {
    if (!confirm("Deseja reiniciar todos os resultados registrados?")) {
        return;
    }

    results = {};
    render();
});

$("clearPlanning").addEventListener("click", () => {
    if (!confirm("Deseja apagar todo o planejamento e restaurar os valores iniciais?")) {
        return;
    }

    config = {
        initial: 10.14,
        target: 30,
        stopWin: 5,
        stopLoss: 5,
        days: 30,
        currency: "BRL"
    };

    results = {};

    $("initial").value = config.initial;
    $("target").value = config.target;
    $("stopWin").value = config.stopWin;
    $("stopLoss").value = config.stopLoss;
    $("days").value = config.days;
    $("currency").value = config.currency;

    render();
});

$("exportBtn").addEventListener("click", () => {
    const rows = calculate();

    const header = [
        "Dia",
        "Saldo inicial",
        "Meta percentual",
        "Projecao",
        "Resultado real",
        "Variacao",
        "Status",
        "Saldo final",
        "Alerta"
    ];

    const lines = rows.map(r => [
        r.day,
        r.startingBalance,
        config.target,
        r.projected,
        r.actual ?? "",
        r.variation ?? "",
        r.status,
        r.actual ?? "",
        r.alert
    ]);

    const csv = [
        header,
        ...lines
    ].map(row =>
        row.map(value =>
            `"${String(value).replace(/"/g, '""')}"`
        ).join(";")
    ).join("\n");

    const blob = new Blob(
        ["\uFEFF" + csv],
        { type: "text/csv;charset=utf-8;" }
    );

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "finance-pro-planejamento.csv";

    link.click();

    URL.revokeObjectURL(url);
});

function initialize() {
    $("currentDate").textContent =
        new Date().toLocaleDateString("pt-BR", {
            day: "2-digit",
            month: "long",
            year: "numeric"
        });

    load();
    render();
}

initialize();
