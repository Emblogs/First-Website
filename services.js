function showTab(tab) {
  const tabs = ["overview", "order", "orders", "track", "profile"];
  const titles = {
    overview: "Overview",
    order: "Place New Order",
    orders: "My Orders",
    track: "Track Order",
    profile: "My Profile",
  };

  tabs.forEach((t) => {
    const el = document.getElementById("tab-" + t);
    if (el) el.style.display = t === tab ? "block" : "none";
  });

  document
    .querySelectorAll(".nav-item")
    .forEach((item) => item.classList.remove("active"));
  document.getElementById("topbar-title").textContent =
    titles[tab] || "Dashboard";
}
