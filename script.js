// === CONFIG ===
const apiKey = "c56b72857de64dc3ba596e45ed5b79a6";
let currentUser = null;
let users = JSON.parse(localStorage.getItem("tradex_users")) || {};
let prices = {};
let intervalId = null;
let usdToInrRate = 83.0;
let currency = "USD";
let latestChartData = {};
let chartInstances = {};
let tradeSymbol = null;
let tradeAction = null;

// === STOCKS ===
const stockSymbols = ["AAPL", "MSFT", "GOOGL"];

const sections = {
  auth: document.getElementById("auth"),
  home: document.getElementById("home"),
  portfolio: document.getElementById("portfolio"),
  orders: document.getElementById("orders"),
};

function showSection(id) {
  for (let key in sections) {
    sections[key].classList.add("hidden");
    sections[key].classList.remove("active");
  }
  sections[id].classList.remove("hidden");
  sections[id].classList.add("active");
}

function loadWallet() {
  if (!currentUser) return;
  const balance = users[currentUser].wallet || 0;
  const displayBalance = currency === "INR"
    ? `₹${(balance * usdToInrRate).toFixed(2)}`
    : `$${balance.toFixed(2)}`;
  document.getElementById("walletBalance").innerText = displayBalance;
}

function fetchExchangeRate() {
  return fetch("https://api.exchangerate.host/latest?base=USD&symbols=INR")
    .then(res => res.json())
    .then(data => {
      if (data && data.rates && data.rates.INR) {
        usdToInrRate = data.rates.INR;
        console.log("✅ USD to INR:", usdToInrRate);
      } else {
        console.warn("⚠️ INR rate not found in response. Using fallback.");
        usdToInrRate = 83.0;
      }
    })
    .catch(err => {
      console.warn("⚠️ Exchange rate fetch failed. Using fallback.", err);
      usdToInrRate = 83.0;
    });
}

function fetchStockPrices() {
  const symbols = stockSymbols.join(",");
  const url = `https://api.twelvedata.com/price?symbol=${symbols}&apikey=${apiKey}`;

  fetch(url)
    .then(res => res.json())
    .then(data => {
      stockSymbols.forEach(symbol => {
        const price = parseFloat(data[symbol]?.price || 0);
        prices[symbol] = price;

        const displayPrice = currency === "INR"
          ? `₹${(price * usdToInrRate).toFixed(2)}`
          : `$${price.toFixed(2)}`;

        const el = document.getElementById(`price-${symbol}`);
        if (el) el.innerText = displayPrice;
      });

      renderPortfolio();
    })
    .catch(err => {
      console.error("Stock price fetch error:", err);
    });
}

function fetchChartData(symbol) {
  const url = `https://api.twelvedata.com/time_series?symbol=${symbol}&interval=15min&apikey=${apiKey}&outputsize=20`;

  fetch(url)
    .then(res => res.json())
    .then(data => {
      if (!data.values) return;

      const labels = data.values.map(v => v.datetime).reverse();
      const rawPrices = data.values.map(v => parseFloat(v.close)).reverse();

      const chartPrices = currency === "INR"
        ? rawPrices.map(p => p * usdToInrRate)
        : rawPrices;

      latestChartData[symbol] = rawPrices;

      const ctx = document.getElementById(`chart-${symbol}`).getContext("2d");

      if (chartInstances[symbol]) {
        chartInstances[symbol].destroy();
      }

      chartInstances[symbol] = new Chart(ctx, {
        type: 'line',
        data: {
          labels,
          datasets: [{
            label: `${symbol} Price (${currency})`,
            data: chartPrices,
            borderColor: 'green',
            backgroundColor: 'rgba(0,255,0,0.1)',
            fill: true,
            tension: 0.3
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            x: { display: false },
            y: {
              ticks: {
                callback: value => currency === "INR" ? `₹${value.toFixed(2)}` : `$${value.toFixed(2)}`
              }
            }
          }
        }
      });
    })
    .catch(err => console.error(`Chart fetch error for ${symbol}:`, err));
}

function renderStocks() {
  const stockListEl = document.getElementById("stockList");
  stockListEl.innerHTML = "";

  const fakeNews = {
    AAPL: [
      "Apple plans to release new AR headset.",
      "Tim Cook hints at electric vehicle collaboration.",
      "iPhone sales hit all-time high."
    ],
    MSFT: [
      "Microsoft invests $10B in AI startup.",
      "Windows 12 rumored to launch in 2025.",
      "Azure revenue up 25% YoY."
    ],
    GOOGL: [
      "Google introduces new AI chatbot.",
      "YouTube adds real-time sports scores.",
      "Alphabet stock hits new peak."
    ]
  };

  stockSymbols.forEach((symbol) => {
    const news = fakeNews[symbol];
    const randomIndex = Math.floor(Math.random() * news.length);
    const displayNews = news.slice(randomIndex, randomIndex + 2).join("<br>");

    const card = document.createElement("div");
    card.className = "stock-card";
    card.innerHTML = `
      <h3>${symbol}</h3>
      <div class="price" id="price-${symbol}">Loading...</div>
      <button onclick="initiateBuy('${symbol}')">Buy</button>
      <button onclick="initiateSell('${symbol}')">Sell</button>
      <div class="chart-wrapper">
        <canvas id="chart-${symbol}"></canvas>
      </div>
      <div class="news" style="font-size: 12px; color: #555; margin-top: 8px;">
        📰 <strong>News:</strong><br>${displayNews}
      </div>
    `;
    stockListEl.appendChild(card);
    fetchChartData(symbol);
  });
}


document.getElementById("searchInput").addEventListener("input", function () {
  const query = this.value.toUpperCase().trim();
  const stockCards = document.querySelectorAll(".stock-card");

  stockCards.forEach((card) => {
    const symbol = card.querySelector("h3").innerText.toUpperCase();
    if (symbol.includes(query)) {
      card.style.display = "block";
    } else {
      card.style.display = "none";
    }
  });
});



// === AUTH ===
document.getElementById("showSignup").addEventListener("click", () => {
  const username = prompt("Create a username:");
  const password = prompt("Create a password:");
  if (!username || !password) return alert("Username and password cannot be empty!");
  if (users[username]) return alert("Username already exists!");

  users[username] = { password, wallet: 100000, portfolio: {}, orders: [] };
  localStorage.setItem("tradex_users", JSON.stringify(users));
  alert("Account created! Please log in.");
});

document.getElementById("loginBtn").addEventListener("click", () => {
  const username = document.getElementById("auth-username").value.trim();
  const password = document.getElementById("auth-password").value.trim();
  if (!users[username]) return alert("User does not exist.");
  if (users[username].password !== password) return alert("Incorrect password.");

  currentUser = username;
  showSection("home");
  loadWallet();
  renderStocks();

  fetchExchangeRate()
    .then(fetchStockPrices)
    .catch((e) => {
      console.warn("Exchange rate fetch failed, using fallback.", e);
      fetchStockPrices();
    });

  intervalId = setInterval(fetchStockPrices, 300000); // 300,000 ms = 5 minutes

});

document.getElementById("logoutBtn").addEventListener("click", () => {
  clearInterval(intervalId);
  currentUser = null;
  showSection("auth");
  document.getElementById("auth-username").value = "";
  document.getElementById("auth-password").value = "";
});

// === NAVIGATION ===
document.querySelectorAll(".nav-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    showSection(btn.dataset.target);
    if (btn.dataset.target === "portfolio") renderPortfolio();
    if (btn.dataset.target === "orders") renderOrders();
  });
});

// === Currency toggle logic ===
document.getElementById("currencyToggle").addEventListener("change", (e) => {
  currency = e.target.value;
  fetchExchangeRate()
    .then(() => {
      loadWallet();
      fetchStockPrices();
      renderPortfolio();
      Object.keys(chartInstances).forEach(symbol => fetchChartData(symbol));
    })
    .catch(err => {
      console.warn("Exchange rate fetch failed, using fallback.", err);
      loadWallet();
      fetchStockPrices();
    });
});

// === Chart Modal Logic ===
function showChartModal(symbol) {
  tradeSymbol = symbol;
  document.getElementById("chartTitle").innerText = `📊 ${symbol} Price Chart`;
  document.getElementById("chartModal").classList.remove("hidden");
  fetchChartData(symbol);
}

window.showChartModal = showChartModal;

document.getElementById("closeChartBtn").addEventListener("click", () => {
  document.getElementById("chartModal").classList.add("hidden");
  if (chartInstances[tradeSymbol]) {
    chartInstances[tradeSymbol].destroy();
    delete chartInstances[tradeSymbol];
  }
});

// === Trade Logic ===
window.initiateBuy = function(symbol) {
  if (!currentUser) return;
  tradeAction = "BUY";
  showTradeModal("BUY", symbol);
};

window.initiateSell = function(symbol) {
  if (!currentUser) return;
  tradeAction = "SELL";
  showTradeModal("SELL", symbol);
};

function showTradeModal(action, symbol) {
  tradeSymbol = symbol;
  document.getElementById("modalTitle").innerText = `${action} - ${symbol}`;
  document.getElementById("modalQuantity").value = "";
  document.getElementById("modalPassword").value = "";
  document.getElementById("tradeModal").classList.remove("hidden");
}

function hideTradeModal() {
  document.getElementById("tradeModal").classList.add("hidden");
}

document.getElementById("cancelTradeBtn").addEventListener("click", hideTradeModal);

document.getElementById("confirmTradeBtn").addEventListener("click", () => {
  const qty = parseInt(document.getElementById("modalQuantity").value);
  const pass = document.getElementById("modalPassword").value.trim();

  if (!qty || qty <= 0) return alert("Enter valid quantity.");
  if (pass !== users[currentUser].password) return alert("Incorrect password");

  const price = prices[tradeSymbol];
  const totalCost = price * qty;

  if (!users[currentUser].portfolio[tradeSymbol]) {
    users[currentUser].portfolio[tradeSymbol] = 0;
  }

  if (tradeAction === "BUY") {
    if (users[currentUser].wallet >= totalCost) {
      users[currentUser].wallet -= totalCost;
      users[currentUser].portfolio[tradeSymbol] += qty;
      users[currentUser].orders.push({
        symbol: tradeSymbol,
        type: "BUY",
        price,
        qty,
        date: new Date().toLocaleString()
      });
      alert(`Bought ${qty} shares of ${tradeSymbol}`);
    } else {
      return alert("Insufficient funds.");
    }
  } else if (tradeAction === "SELL") {
    const owned = users[currentUser].portfolio[tradeSymbol] || 0;
    if (owned >= qty) {
      users[currentUser].wallet += totalCost;
      users[currentUser].portfolio[tradeSymbol] -= qty;
      users[currentUser].orders.push({
        symbol: tradeSymbol,
        type: "SELL",
        price,
        qty,
        date: new Date().toLocaleString()
      });
      alert(`Sold ${qty} shares of ${tradeSymbol}`);
    } else {
      return alert("Not enough shares to sell.");
    }
  }

  localStorage.setItem("tradex_users", JSON.stringify(users));
  loadWallet();
  renderPortfolio();
  renderOrders();
  hideTradeModal();
  document.getElementById("searchInput").addEventListener("input", renderStocks);
  renderStocks();

});

function renderPortfolio() {
  if (!currentUser) return;
  const portfolioContent = document.getElementById("portfolioContent");
  portfolioContent.innerHTML = "";

  const portfolio = users[currentUser].portfolio;
  if (!portfolio || Object.keys(portfolio).length === 0) {
    portfolioContent.innerHTML = "<p>No stocks owned yet.</p>";
    return;
  }

  let totalValue = 0;
  for (let symbol in portfolio) {
    const qty = portfolio[symbol];
    const price = prices[symbol] || 0;
    const total = qty * price;
    totalValue += total;

    const displayPrice = currency === "INR" ? `₹${(price * usdToInrRate).toFixed(2)}` : `$${price.toFixed(2)}`;
    const displayTotal = currency === "INR" ? `₹${(total * usdToInrRate).toFixed(2)}` : `$${total.toFixed(2)}`;
    
    portfolioContent.innerHTML += `
      <div><strong>${symbol}:</strong> ${qty} shares @ ${displayPrice} = ${displayTotal}</div>
    `;
  }

  const wallet = users[currentUser].wallet || 0;
  const netWorth = totalValue + wallet;
  const displayNetWorth = currency === "INR" ? `₹${(netWorth * usdToInrRate).toFixed(2)}` : `$${netWorth.toFixed(2)}`;

  portfolioContent.innerHTML = `
    <div style="font-weight: bold; font-size: 18px; margin-bottom: 10px;">
      💼 Total Portfolio Value: ${displayNetWorth}
    </div>
  ` + portfolioContent.innerHTML;
}



function renderOrders() {
  if (!currentUser) return;
  const orderContent = document.getElementById("orderContent");
  orderContent.innerHTML = "";
  const orders = users[currentUser].orders || [];
  if (orders.length === 0) {
    orderContent.innerHTML = "<p>No orders yet.</p>";
    return;
  }
  orders.slice().reverse().forEach((o) => {
    const displayPrice = currency === "INR" ? `₹${(o.price * usdToInrRate).toFixed(2)}` : `$${o.price.toFixed(2)}`;
    orderContent.innerHTML += `<div>${o.date} - <strong>${o.type}</strong> ${o.symbol} @ ${displayPrice}</div>`;
  });
}
document.addEventListener("DOMContentLoaded", () => {
  const usernameInput = document.getElementById("auth-username");
  const passwordInput = document.getElementById("auth-password");
  const loginBtn = document.getElementById("loginBtn");

  function triggerLogin(event) {
    if (event.key === "Enter") {
      event.preventDefault();
      loginBtn.click();
    }
  }

  usernameInput.addEventListener("keypress", triggerLogin);
  passwordInput.addEventListener("keypress", triggerLogin);
});
