// ── PAYSTACK KEY — replace with your real key from dashboard.paystack.com ──
const PAYSTACK_PUBLIC_KEY = "pk_test_070a13f604baa63f612fefac070c6664f720f470";
const FARM_LAT = 4.8156,
  FARM_LNG = 7.0498;

// ── SESSION & STORAGE ──
// Load user from sessionStorage (logged in this session) or localStorage (remembered)
let currentUser = JSON.parse(
  sessionStorage.getItem("eog_user") ||
    localStorage.getItem("eog_user") ||
    "null",
);

if (!currentUser) {
  // Not logged in — redirect to login
  // window.location.href = 'login.html'; // Uncomment when backend is ready
  currentUser = {
    fname: "John",
    lname: "Doe",
    email: "john@email.com",
    phone: "+234 800 000 0000",
    address: "12 Farm Road, Port Harcourt",
  };
}

// Save session
sessionStorage.setItem("eog_user", JSON.stringify(currentUser));

// Load orders from localStorage
let orders = JSON.parse(
  localStorage.getItem("eog_orders_" + (currentUser?.email || "guest")) || "[]",
);

let selectedService = null,
  selectedServicePrice = 0;
let selectedDelivery = "pickup",
  selectedPayment = "card";
let orderToDelete = null,
  map = null;

// ── INIT UI WITH USER DATA ──
function initUI() {
  const name = currentUser.fname || "User";
  document.getElementById("welcome-name").textContent = name + "!";
  document.getElementById("sidebar-name").textContent =
    (currentUser.fname || "") + " " + (currentUser.lname || "");
  document.getElementById("sidebar-email").textContent =
    currentUser.email || "";
  document.getElementById("sidebar-avatar").textContent = (
    name[0] || "U"
  ).toUpperCase();
  document.getElementById("profile-fname").value = currentUser.fname || "";
  document.getElementById("profile-lname").value = currentUser.lname || "";
  document.getElementById("profile-email").value = currentUser.email || "";
  document.getElementById("profile-phone").value = currentUser.phone || "";
  document.getElementById("profile-address").value = currentUser.address || "";
  if (document.getElementById("pay-email"))
    document.getElementById("pay-email").value = currentUser.email || "";
  renderOverview();
}

// ── LOG OUT ──
function logOut() {
  sessionStorage.removeItem("eog_user");
  window.location.href = "login.html";
}

// ── TABS ──
function showTab(tab) {
  ["overview", "order", "orders", "track", "profile"].forEach((t) => {
    const el = document.getElementById("tab-" + t);
    if (el) el.style.display = t === tab ? "block" : "none";
  });
  const titles = {
    overview: "Overview",
    order: "Place New Order",
    orders: "My Orders",
    track: "Track Order",
    profile: "My Profile",
  };
  document.getElementById("topbar-title").textContent =
    titles[tab] || "Dashboard";
  document
    .querySelectorAll(".nav-item")
    .forEach((el) => el.classList.remove("active"));
  const navMap = { overview: 0, order: 1, orders: 2, track: 3, profile: 4 };
  const navItems = document.querySelectorAll(".nav-item");
  if (navItems[navMap[tab]]) navItems[navMap[tab]].classList.add("active");
  if (tab === "overview") renderOverview();
  if (tab === "orders") renderOrdersTable();
  if (tab === "track") renderTrack();
}

// ── ORDER STEPS ──
function goOrderStep(step) {
  if (step === 2 && !selectedService) {
    showToast("Please select a service first!");
    return;
  }
  if (step === 2) {
    document.getElementById("selected-service-name").textContent =
      selectedService;
  }
  if (step === 3) {
    if (!validateStep2()) return;
    updateSummary();
  }
  document
    .querySelectorAll(".order-step-panel")
    .forEach((p) => p.classList.remove("active"));
  document.getElementById("order-step-" + step).classList.add("active");
  updateStepIndicator(step);
}

function updateStepIndicator(step) {
  for (let i = 1; i <= 4; i++) {
    const el = document.getElementById("step-ind-" + i);
    el.className =
      "step " + (i < step ? "done" : i === step ? "active" : "pending");
  }
  for (let i = 1; i <= 3; i++) {
    const line = document.getElementById("line-" + i + "-" + (i + 1));
    if (line) line.className = "step-line " + (i < step ? "done" : "");
  }
}

// ── VALIDATE STEP 2 ──
function validateStep2() {
  let valid = true;

  const qty = document.getElementById("order-qty").value;
  const date = document.getElementById("order-date").value;
  const time = document.getElementById("order-time").value;
  const address = document.getElementById("delivery-address").value;

  // Reset errors
  ["qty", "date", "time", "address"].forEach((f) => {
    document.getElementById("err-" + f)?.classList.remove("show");
    document.getElementById("order-" + f)?.classList.remove("error");
    document.getElementById("delivery-address")?.classList.remove("error");
  });

  if (!qty || parseInt(qty) < 1) {
    document.getElementById("err-qty").classList.add("show");
    document.getElementById("order-qty").classList.add("error");
    valid = false;
  }
  if (!date) {
    document.getElementById("err-date").classList.add("show");
    document.getElementById("order-date").classList.add("error");
    valid = false;
  }
  if (!time) {
    document.getElementById("err-time").classList.add("show");
    document.getElementById("order-time").classList.add("error");
    valid = false;
  }
  if (selectedDelivery === "delivery" && !address.trim()) {
    document.getElementById("err-address").classList.add("show");
    document.getElementById("delivery-address").classList.add("error");
    valid = false;
  }

  if (!valid) showToast("Please fill in all required fields!");
  return valid;
}

// ── VALIDATE PAYMENT ──
function validatePayment() {
  let valid = true;

  // Reset
  document.getElementById("err-pay-email")?.classList.remove("show");
  document.getElementById("pay-email")?.classList.remove("error");
  document.getElementById("err-transfer")?.classList.remove("show");

  if (selectedPayment === "card") {
    const email = document.getElementById("pay-email").value.trim();
    if (!email || !email.includes("@")) {
      document.getElementById("err-pay-email").classList.add("show");
      document.getElementById("pay-email").classList.add("error");
      valid = false;
    }
  }

  if (selectedPayment === "transfer") {
    const proof = document.getElementById("transfer-proof").files.length;
    if (!proof) {
      document.getElementById("err-transfer").classList.add("show");
      valid = false;
    }
  }

  if (!valid) showToast("Please complete all payment fields!");
  return valid;
}

// ── SELECT SERVICE ──
function selectService(el, name, price) {
  document
    .querySelectorAll(".service-opt")
    .forEach((s) => s.classList.remove("selected"));
  el.classList.add("selected");
  selectedService = name;
  selectedServicePrice = price;
}

// ── SELECT DELIVERY ──
function selectDelivery(type) {
  selectedDelivery = type;
  document
    .getElementById("opt-pickup")
    .classList.toggle("selected", type === "pickup");
  document
    .getElementById("opt-delivery")
    .classList.toggle("selected", type === "delivery");
  document.getElementById("delivery-address-group").style.display =
    type === "delivery" ? "flex" : "none";
  updateSummary();
}

// ── SELECT PAYMENT ──
function selectPayment(type) {
  selectedPayment = type;
  ["card", "transfer", "cash"].forEach((t) => {
    document
      .getElementById("pay-" + t)
      .classList.toggle("selected", t === type);
    document.getElementById(t + "-fields").style.display =
      t === type ? "flex" : "none";
  });
  const total = calcTotal();
  const btn = document.getElementById("pay-btn-text");
  if (type === "cash") btn.textContent = "Confirm Order (Pay on Delivery)";
  else if (type === "transfer") btn.textContent = "Confirm & Submit Receipt";
  else btn.textContent = "Pay " + formatCurrency(total) + " via Paystack";
}

// ── CALCULATE ──
function calcTotal() {
  const qty = parseInt(document.getElementById("order-qty")?.value || 1);
  return (
    selectedServicePrice * qty + (selectedDelivery === "delivery" ? 3000 : 0)
  );
}

function formatCurrency(n) {
  return "₦" + n.toLocaleString("en-NG");
}

function updateSummary() {
  if (!selectedService) return;
  const qty = parseInt(document.getElementById("order-qty")?.value || 1);
  const subtotal = selectedServicePrice * qty;
  const deliveryFee = selectedDelivery === "delivery" ? 3000 : 0;
  const total = subtotal + deliveryFee;
  document.getElementById("sum-service").textContent = selectedService;
  document.getElementById("sum-qty").textContent = qty;
  document.getElementById("sum-unit").textContent =
    selectedServicePrice === 0 ? "TBD" : formatCurrency(selectedServicePrice);
  document.getElementById("sum-subtotal").textContent =
    selectedServicePrice === 0 ? "TBD" : formatCurrency(subtotal);
  document.getElementById("sum-delivery").textContent =
    deliveryFee > 0 ? formatCurrency(deliveryFee) : "₦0 (Pickup)";
  document.getElementById("sum-total").textContent =
    selectedServicePrice === 0 ? "TBD" : formatCurrency(total);
  const btn = document.getElementById("pay-btn-text");
  if (selectedPayment === "cash")
    btn.textContent = "Confirm Order (Pay on Delivery)";
  else if (selectedPayment === "transfer")
    btn.textContent = "Confirm & Submit Receipt";
  else
    btn.textContent =
      "Pay " +
      (selectedServicePrice === 0 ? "TBD" : formatCurrency(total)) +
      " via Paystack";
}

// ── HANDLE PAYMENT ──
function handlePayment() {
  if (!validatePayment()) return;

  if (selectedPayment === "card") {
    // Paystack inline payment
    const total = calcTotal();
    const email = document.getElementById("pay-email").value.trim();

    const handler = PaystackPop.setup({
      key: PAYSTACK_PUBLIC_KEY,
      email: email,
      amount: total * 100, // Paystack uses kobo
      currency: "NGN",
      ref: "EOG_" + Date.now(),
      metadata: {
        service: selectedService,
        qty: document.getElementById("order-qty").value,
      },
      callback: function (response) {
        // Payment successful
        finalizeOrder("Paid", response.reference);
      },
      onClose: function () {
        showToast("Payment window closed. Try again to complete your order.");
      },
    });
    handler.openIframe();
  } else {
    // Transfer or Cash — finalize directly
    finalizeOrder(
      selectedPayment === "cash" ? "Pending" : "Pending Confirmation",
      "",
    );
  }
}

// ── FINALIZE ORDER ──
function finalizeOrder(paymentStatus, reference) {
  const qty = parseInt(document.getElementById("order-qty").value || 1);
  const total = calcTotal();
  const now = new Date();

  const order = {
    id: "EOG-" + String(Date.now()).slice(-6),
    service: selectedService,
    qty: qty,
    unitPrice: selectedServicePrice,
    total: total,
    delivery: selectedDelivery,
    address: document.getElementById("delivery-address").value || "Farm Pickup",
    payment: selectedPayment,
    paymentStatus: paymentStatus,
    paymentRef: reference,
    status: "Pending",
    date: now.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }),
    time: now.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
    }),
    notes: document.getElementById("order-notes").value,
    preferredDate: document.getElementById("order-date").value,
    steps: [
      {
        title: "Order Placed",
        desc: "Your order has been received.",
        time: now.toLocaleString(),
        done: true,
      },
      {
        title: "Payment Confirmed",
        desc: "Your payment has been verified.",
        time: paymentStatus === "Paid" ? now.toLocaleString() : "",
        done: paymentStatus === "Paid",
      },
      {
        title: "Order Confirmed",
        desc: "The farm is preparing your order.",
        time: "",
        done: false,
      },
      {
        title:
          selectedDelivery === "delivery"
            ? "Out for Delivery"
            : "Ready for Pickup",
        desc:
          selectedDelivery === "delivery"
            ? "Your order is on the way."
            : "Come pick up your order at the farm.",
        time: "",
        done: false,
      },
      {
        title: "Completed",
        desc: "Order successfully completed.",
        time: "",
        done: false,
      },
    ],
  };

  orders.push(order);
  saveOrders();

  // Simulate order status progression
  simulateOrderProgress(order.id);

  document.getElementById("success-message").textContent =
    `Order #${order.id} for ${order.service} × ${qty}. Total: ${formatCurrency(total)}. ${paymentStatus === "Paid" ? "Payment confirmed! 💳" : "Pay on " + (selectedPayment === "cash" ? "delivery/pickup." : "confirmation.")}`;

  goOrderStep(4);
  showToast("Order placed successfully! 🎉");
  renderOverview();
}

// ── SIMULATE ORDER PROGRESS ──
// This simulates the farm receiving and processing the order
// In production this would be driven by your backend
function simulateOrderProgress(orderId) {
  const delays = [5000, 10000, 20000, 35000]; // ms — confirm, prep, dispatch, complete
  const statuses = ["Confirmed", "Confirmed", "Out for Delivery", "Delivered"];
  const stepIndices = [1, 2, 3, 4]; // which step to mark done

  delays.forEach((delay, i) => {
    setTimeout(() => {
      const order = orders.find((o) => o.id === orderId);
      if (!order) return;
      order.status = statuses[i];
      if (order.steps[stepIndices[i]]) {
        order.steps[stepIndices[i]].done = true;
        order.steps[stepIndices[i]].time = new Date().toLocaleString();
      }
      saveOrders();
      renderOverview();
      if (i === 0) showToast(`Order #${orderId} confirmed by the farm! ✅`);
      if (i === 2 && order.delivery === "delivery")
        showToast(`Order #${orderId} is out for delivery! 🚚`);
      if (i === 3) showToast(`Order #${orderId} completed! Thank you 🎉`);
    }, delay);
  });
}

// ── RESET ORDER ──
function resetOrder() {
  selectedService = null;
  selectedServicePrice = 0;
  selectedDelivery = "pickup";
  selectedPayment = "card";
  document
    .querySelectorAll(".service-opt")
    .forEach((s) => s.classList.remove("selected"));
  [
    "order-qty",
    "order-date",
    "order-time",
    "order-notes",
    "delivery-address",
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = id === "order-qty" ? 1 : "";
  });
  selectDelivery("pickup");
  selectPayment("card");
  goOrderStep(1);
}

// ── RENDER OVERVIEW ──
function renderOverview() {
  const active = orders.filter((o) =>
    ["Pending", "Confirmed", "Out for Delivery"].includes(o.status),
  ).length;
  const delivered = orders.filter((o) => o.status === "Delivered").length;
  const spent = orders
    .filter((o) => o.paymentStatus === "Paid")
    .reduce((s, o) => s + o.total, 0);
  document.getElementById("stat-total").textContent = orders.length;
  document.getElementById("stat-active").textContent = active;
  document.getElementById("stat-delivered").textContent = delivered;
  document.getElementById("stat-spent").textContent = formatCurrency(spent);

  const recent = [...orders].reverse().slice(0, 5);
  const container = document.getElementById("overview-orders-table");
  if (!recent.length) {
    container.innerHTML = `<div class="empty-state"><p>No orders yet. Place your first order!</p><button class="topbar-btn" onclick="showTab('order')">+ Place Order</button></div>`;
    return;
  }
  container.innerHTML = buildTable(recent);

  // Update welcome subtitle
  if (active > 0)
    document.getElementById("welcome-sub").textContent =
      `You have ${active} active order${active > 1 ? "s" : ""}. Track them below.`;
  else
    document.getElementById("welcome-sub").textContent =
      "Welcome back! Ready to place a new order?";
}

// ── RENDER ORDERS TABLE ──
function renderOrdersTable() {
  const container = document.getElementById("orders-table-container");
  if (!orders.length) {
    container.innerHTML = `<div class="empty-state"><p>No orders yet.</p><button class="topbar-btn" onclick="showTab('order')">+ Place Order</button></div>`;
    return;
  }
  container.innerHTML = buildTable([...orders].reverse());
}

function buildTable(list) {
  const sc = {
    Pending: "badge-pending",
    Confirmed: "badge-confirmed",
    "Out for Delivery": "badge-confirmed",
    Delivered: "badge-delivered",
    Cancelled: "badge-cancelled",
  };
  const pc = {
    Paid: "badge-paid",
    Pending: "badge-unpaid",
    "Pending Confirmation": "badge-unpaid",
  };
  const rows = list
    .map(
      (o) => `
      <tr>
        <td><span class="order-id">#${o.id}</span></td>
        <td>${o.service}</td>
        <td>${o.qty}</td>
        <td>${formatCurrency(o.total)}</td>
        <td><span class="badge ${pc[o.paymentStatus] || "badge-unpaid"}">${o.paymentStatus}</span></td>
        <td>${o.delivery === "delivery" ? "Delivery" : "Pickup"}</td>
        <td>${o.date}</td>
        <td><span class="badge ${sc[o.status] || "badge-pending"}">${o.status}</span></td>
        <td>
          <a class="td-action" onclick="trackOrder('${o.id}')">Track</a>
          <a class="td-delete" onclick="confirmDelete('${o.id}')">Remove</a>
        </td>
      </tr>`,
    )
    .join("");
  return `<table><thead><tr><th>Order ID</th><th>Service</th><th>Qty</th><th>Amount</th><th>Payment</th><th>Delivery</th><th>Date</th><th>Status</th><th>Action</th></tr></thead><tbody>${rows}</tbody></table>`;
}

// ── RENDER TRACK ──
function renderTrack() {
  const container = document.getElementById("track-content");
  if (!orders.length) {
    container.innerHTML = `<div class="empty-state"><p>No orders to track yet.</p></div>`;
    return;
  }
  const opts = [...orders]
    .reverse()
    .map(
      (o) =>
        `<option value="${o.id}">#${o.id} — ${o.service} (${o.status})</option>`,
    )
    .join("");
  container.innerHTML = `
      <div style="padding:20px 24px;border-bottom:1px solid rgba(42,96,65,0.08)">
        <div class="form-group" style="max-width:420px">
          <label>Select Order to Track</label>
          <select onchange="renderTrackForOrder(this.value)" id="track-select">
            <option value="">Choose an order...</option>
            ${opts}
          </select>
        </div>
      </div>
      <div id="track-detail"></div>`;
}

function trackOrder(id) {
  showTab("track");
  setTimeout(() => {
    const sel = document.getElementById("track-select");
    if (sel) sel.value = id;
    renderTrackForOrder(id);
  }, 150);
}

function renderTrackForOrder(id) {
  if (!id) return;
  const order = orders.find((o) => o.id === id);
  if (!order) return;

  const container = document.getElementById("track-detail");
  if (!container) return;

  const stepsHTML = order.steps
    .map((s, i) => {
      const isActive = !s.done && (i === 0 || order.steps[i - 1]?.done);
      const cls = s.done ? "done" : isActive ? "active" : "idle";
      return `
        <div class="track-step">
          <div class="track-step-left">
            <div class="track-dot ${cls}"><svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg></div>
            ${i < order.steps.length - 1 ? `<div class="track-line ${s.done ? "done" : ""}"></div>` : ""}
          </div>
          <div class="track-step-body">
            <div class="track-step-title ${cls === "idle" ? "idle" : ""}">${s.title}</div>
            <div class="track-step-desc ${cls === "idle" ? "idle" : ""}">${s.desc}</div>
            ${s.time ? `<div class="track-step-time">${s.time}</div>` : ""}
          </div>
        </div>`;
    })
    .join("");

  const rightHTML =
    order.delivery === "delivery"
      ? `<div class="eta-box">
           <div>
             <div class="eta-label">Estimated Delivery Time</div>
             <div class="eta-value">${estimateDeliveryETA(order.address)}</div>
             <div class="eta-dist">Based on delivery address location</div>
           </div>
           <div style="text-align:right">
             <div class="eta-label">Delivery Address</div>
             <div style="font-size:0.74rem;color:rgba(245,240,232,0.8);margin-top:4px;max-width:180px">${order.address}</div>
           </div>
         </div>`
      : `<div class="track-order-card">
           <div class="track-order-id" style="font-size:0.85rem;margin-bottom:8px">Pickup Location</div>
           <p style="font-size:0.76rem;color:var(--brown);line-height:1.8">Era of Grace Farms<br>Port Harcourt, Rivers State<br>📞 +234 800 000 0000<br><br><strong style="color:var(--green)">Bring your Order ID: #${order.id}</strong></p>
         </div>`;

  container.innerHTML = `
      <div class="track-section">
        <div class="track-left">
          <div class="track-order-card">
            <div class="track-order-id">#${order.id}</div>
            <div class="track-order-service">${order.service} × ${order.qty}</div>
            <div class="track-meta">
              <div class="track-meta-item"><span class="track-meta-label">Amount</span><span class="track-meta-value">${formatCurrency(order.total)}</span></div>
              <div class="track-meta-item"><span class="track-meta-label">Payment</span><span class="track-meta-value" style="color:${order.paymentStatus === "Paid" ? "var(--green)" : "#a07a10"}">${order.paymentStatus}</span></div>
              <div class="track-meta-item"><span class="track-meta-label">Method</span><span class="track-meta-value">${order.delivery === "delivery" ? "Home Delivery" : "Pickup"}</span></div>
              <div class="track-meta-item"><span class="track-meta-label">Placed</span><span class="track-meta-value">${order.date} · ${order.time}</span></div>
            </div>
          </div>
          <div class="track-steps">${stepsHTML}</div>
        </div>
        <div style="display:flex;flex-direction:column;gap:14px">
          ${rightHTML}
          <div class="track-order-card">
            <div class="track-order-id" style="font-size:0.85rem;margin-bottom:8px">Need Help?</div>
            <p style="font-size:0.72rem;color:var(--brown);line-height:1.7;margin-bottom:12px">Having an issue with your order? Contact us directly.</p>
            <a href="index.html#contact"><button class ="track-order-btn" style="width:100%;padding:10px;font-size:0.6rem">Contact Support</button></a>
          </div>
        </div>
      </div>`;

}

// ── ETA ESTIMATE (no map — based on user's address location keyword) ──
function estimateDeliveryETA(address) {
  const addr = (address || '').toLowerCase();

  // Same city areas — Port Harcourt
  const sameDay = ['port harcourt', 'ph', 'rumuola', 'rumuokoro', 'woji', 'rumuigbo', 'eleme', 'trans amadi', 'obio', 'akpor'];
  // Nearby — Rivers State
  const oneDay = ['rivers', 'ikwerre', 'okrika', 'bonny', 'degema', 'etche', 'oyigbo', 'omoku'];
  // South South
  const twoDays = ['bayelsa', 'yenagoa', 'delta', 'warri', 'asaba', 'edo', 'benin', 'cross river', 'calabar', 'akwa ibom', 'uyo'];
  // Other states
  const threeDays = ['lagos', 'abuja', 'kano', 'ibadan', 'oyo', 'ogun', 'anambra', 'imo', 'enugu', 'abia', 'ondo', 'ekiti', 'osun'];

  if (sameDay.some(k => addr.includes(k))) return 'Same Day';
  if (oneDay.some(k => addr.includes(k)))  return '1 Day';
  if (twoDays.some(k => addr.includes(k))) return '1–2 Days';
  if (threeDays.some(k => addr.includes(k))) return '3–5 Days';

  return '2–4 Days'; // default
}

// ── DELETE ──
function confirmDelete(id) {
  orderToDelete = id;
  document.getElementById("delete-modal").classList.add("show");
  document.getElementById("modal-confirm-btn").onclick = () => deleteOrder(id);
}

function closeModal() {
  document.getElementById("delete-modal").classList.remove("show");
}

function deleteOrder(id) {
  orders = orders.filter((o) => o.id !== id);
  saveOrders();
  closeModal();
  renderOrdersTable();
  renderOverview();
  showToast("Order removed successfully.");
}

// ── SAVE ──
function saveOrders() {
  localStorage.setItem(
    "eog_orders_" + (currentUser?.email || "guest"),
    JSON.stringify(orders),
  );
}

// ── PROFILE ──
function saveProfile() {
  const fname   = document.getElementById('profile-fname').value.trim();
  const lname   = document.getElementById('profile-lname').value.trim();
  const email   = document.getElementById('profile-email').value.trim();
  const phone   = document.getElementById('profile-phone').value.trim();
  const address = document.getElementById('profile-address').value.trim();
  const oldPw   = document.getElementById('profile-old-password').value;
  const newPw   = document.getElementById('profile-new-password').value;
  const confirmPw = document.getElementById('profile-confirm-password').value;

  ['err-old-pw','err-new-pw','err-confirm-pw'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });

  // Handle password change if user entered old password
  if (oldPw) {
    // Check old password against saved users
    const users = JSON.parse(localStorage.getItem('eog_users') || '[]');
    const userIndex = users.findIndex(u => u.email === currentUser.email);

    if (userIndex === -1 || users[userIndex].password !== oldPw) {
      document.getElementById('err-old-pass').style.display = 'block';
      return;
    }
    if (newPw.length < 6) {
      document.getElementById('err-new-pass').style.display = 'block';
      return;
    }
    if (newPw !== confirmPw) {
      document.getElementById('err-conf-pass').style.display = 'block';
      return;
    }
    // Update password in users list
    users[userIndex].password = newPw;
    localStorage.setItem('eog_users', JSON.stringify(users));
    showToast('Password changed successfully! 🔒');
  }

  // Update profile
  currentUser.fname   = fname;
  currentUser.lname   = lname;
  currentUser.email   = email;
  currentUser.phone   = phone;
  currentUser.address = address;

  localStorage.setItem('eog_user', JSON.stringify(currentUser));
  sessionStorage.setItem('eog_user', JSON.stringify(currentUser));
  initUI();
  showToast('Profile updated successfully! ✓');
}

// ── TOAST ──
function showToast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 3500);
}

// ── START ──
initUI();
