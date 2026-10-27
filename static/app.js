const pageNames = ["home", "programme", "artists", "venues", "now", "admin"];
let festivalInfo = {};
let artistsData = [];
let venuesData = [];
let allShows = [];
let activeDay = "2027-06-10";
let activeKind = "all";

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => {
    const replacements = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
    return replacements[character];
  });
}

async function getJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
  });
  const result = await response.json();
  if (!response.ok) {
    throw new Error(result.error || "Something went wrong. Please try again.");
  }
  return result;
}

function showPage(pageName) {
  if (!pageNames.includes(pageName)) pageName = "home";
  document.querySelectorAll(".page").forEach((page) => page.classList.remove("active"));
  document.querySelector(`#page-${pageName}`).classList.add("active");
  document.querySelectorAll("[data-page-link]").forEach((button) => {
    button.classList.toggle("active", button.dataset.pageLink === pageName);
  });
  document.querySelector("#main-nav").classList.remove("open");
  document.querySelector("#menu-button").setAttribute("aria-expanded", "false");
  window.scrollTo({ top: 0, behavior: "smooth" });
  if (pageName === "now") loadNowResults();
  if (pageName === "admin") loadAdminShows();
}

function prettyDay(day) {
  const date = new Date(`${day}T12:00:00`);
  return date.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
}

function shortDay(day) {
  return new Date(`${day}T12:00:00`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric" });
}

function localIsoDay(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function timeRange(show) {
  return `${show.start.slice(11, 16)}–${show.end.slice(11, 16)}`;
}

function typeName(kind) {
  return { solo: "Solo show", lineup: "Lineup", workshop: "Workshop" }[kind] || kind;
}

function showCard(show) {
  let peopleLine = "";
  if (show.kind === "solo") peopleLine = show.artist_name;
  if (show.kind === "lineup") peopleLine = `Hosted by ${show.host_name} · ${show.act_names.join(", ")}`;
  if (show.kind === "workshop") peopleLine = `With ${show.teacher_name}`;
  const age = show.min_age > 0 ? `<span class="age-tag">${show.min_age}+</span>` : "";
  const description = show.description ? `<p>${escapeHtml(show.description)}</p>` : "";
  return `
    <article class="show-card">
      <div class="show-time">${escapeHtml(timeRange(show))}</div>
      <div class="show-main">
        <div class="show-meta"><span class="kind-tag ${escapeHtml(show.kind)}">${escapeHtml(typeName(show.kind))}</span><span>⌖ ${escapeHtml(show.venue_name)}</span></div>
        <h3>${escapeHtml(show.title)}</h3>
        <p>${escapeHtml(peopleLine)}</p>${description}
      </div>${age}
    </article>`;
}

function renderDayTabs() {
  const first = new Date(`${festivalInfo.first_day}T12:00:00`);
  const last = new Date(`${festivalInfo.last_day}T12:00:00`);
  const tabs = [];
  for (let day = new Date(first); day <= last; day.setDate(day.getDate() + 1)) {
    const isoDay = localIsoDay(day);
    const dayName = day.toLocaleDateString("en-GB", { weekday: "long" });
    tabs.push(`<button class="day-tab ${isoDay === activeDay ? "active" : ""}" role="tab" aria-selected="${isoDay === activeDay}" data-day="${isoDay}"><span>${dayName}</span><strong>${day.toLocaleDateString("en-GB", { day: "numeric", month: "long" })}</strong></button>`);
  }
  document.querySelector("#day-tabs").innerHTML = tabs.join("");
}

async function loadProgramme() {
  const shows = await getJson(`/api/programme?day=${encodeURIComponent(activeDay)}`);
  const filtered = activeKind === "all" ? shows : shows.filter((show) => show.kind === activeKind);
  document.querySelector("#programme-count").textContent = `${filtered.length} ${filtered.length === 1 ? "performance" : "performances"} on ${prettyDay(activeDay)}`;
  document.querySelector("#programme-list").innerHTML = filtered.length
    ? filtered.map(showCard).join("")
    : `<div class="empty-state">No ${escapeHtml(typeName(activeKind).toLowerCase())}s on this day. Try another day.</div>`;
}

function renderArtists() {
  document.querySelector("#artists-list").innerHTML = artistsData.map((artist) => {
    const firstShow = artist.performances[0];
    const nextText = artist.performances.length
      ? `${artist.performances.length} ${artist.performances.length === 1 ? "show" : "shows"} · next on ${prettyDay(firstShow.day)}`
      : "No performances scheduled yet";
    const initial = artist.name.trim().charAt(0);
    return `<article class="person-card"><div class="person-initial">${escapeHtml(initial)}</div><h3>${escapeHtml(artist.name)}</h3><p>${escapeHtml(artist.bio)}</p><button data-artist-day="${firstShow ? firstShow.day : ""}">${escapeHtml(nextText)}${firstShow ? " →" : ""}</button></article>`;
  }).join("");
}

function renderVenues() {
  document.querySelector("#venues-list").innerHTML = venuesData.map((venue, index) => {
    const showCount = venue.performances.length;
    return `<article class="venue-card"><span class="venue-number">VENUE 0${index + 1}</span><span class="venue-mark">⌖</span><h3>${escapeHtml(venue.name)}</h3><p>${escapeHtml(venue.address)}</p><p>Capacity ${venue.capacity}</p><p class="venue-count">${showCount} scheduled ${showCount === 1 ? "performance" : "performances"}</p></article>`;
  }).join("");
}

async function loadNowResults() {
  const moment = document.querySelector("#moment-input").value;
  const results = document.querySelector("#now-results");
  try {
    const data = await getJson(`/api/now?at=${encodeURIComponent(moment)}`);
    const playing = data.now_playing.length
      ? data.now_playing.map(showCard).join("")
      : `<p class="empty-state">Nothing is on stage at this moment.</p>`;
    const next = data.up_next.length
      ? data.up_next.map(showCard).join("")
      : `<p class="empty-state">There are no later shows in this edition.</p>`;
    results.innerHTML = `<h2>Playing now</h2><div class="show-list">${playing}</div><h2>Coming up</h2><div class="show-list">${next}</div>`;
  } catch (error) {
    results.innerHTML = `<p class="empty-state">${escapeHtml(error.message)}</p>`;
  }
}

function addOptions(select, options, firstLabel) {
  const firstOption = firstLabel ? `<option value="">${escapeHtml(firstLabel)}</option>` : "";
  select.innerHTML = firstOption + options.map((person) => `<option value="${escapeHtml(person.slug)}">${escapeHtml(person.name)}</option>`).join("");
}

function renderAdminPeople() {
  const options = artistsData.map(({ slug, name }) => ({ slug, name }));
  addOptions(document.querySelector("#artist-input"), options, "Choose an artist");
  addOptions(document.querySelector("#host-input"), options, "Choose a host");
  addOptions(document.querySelector("#teacher-input"), options, "Choose a teacher");
  addOptions(document.querySelector("#acts-input"), options);
  addOptions(document.querySelector("#venue-input"), venuesData.map(({ slug, name }) => ({ slug, name })), "Choose a venue");
}

function showKindFields() {
  const kind = document.querySelector("#kind-input").value;
  document.querySelectorAll("[data-kind-fields]").forEach((group) => {
    group.classList.toggle("hidden", group.dataset.kindFields !== kind);
  });
}

async function loadAdminShows() {
  try {
    allShows = await getJson("/api/performances");
    document.querySelector("#admin-count").textContent = allShows.length;
    document.querySelector("#admin-show-list").innerHTML = allShows.map((show) => `
      <article class="admin-row">
        <div><h3>${escapeHtml(show.title)}</h3><p>${escapeHtml(shortDay(show.day))} · ${escapeHtml(timeRange(show))} · ${escapeHtml(show.venue_name)}</p></div>
        <div class="admin-row-actions"><button class="small-button" data-edit-show="${escapeHtml(show.id)}">Edit</button><button class="small-button" data-delete-show="${escapeHtml(show.id)}">Cancel</button></div>
      </article>`).join("");
  } catch (error) {
    document.querySelector("#admin-show-list").innerHTML = `<p class="empty-state">${escapeHtml(error.message)}</p>`;
  }
}

function resetForm() {
  const form = document.querySelector("#performance-form");
  form.reset();
  document.querySelector("#show-id").value = "";
  document.querySelector("#duration-input").value = "60";
  document.querySelector("#age-input").value = "0";
  document.querySelector("#participants-input").value = "12";
  document.querySelector("#form-title").textContent = "Add a performance";
  document.querySelector("#save-show").innerHTML = "Save performance <span>→</span>";
  document.querySelector("#cancel-edit").classList.add("hidden");
  document.querySelector("#form-message").textContent = "";
  document.querySelector("#form-message").classList.remove("success");
  showKindFields();
}

function editShow(showId) {
  const show = allShows.find((item) => item.id === showId);
  if (!show) return;
  document.querySelector("#show-id").value = show.id;
  document.querySelector("#title-input").value = show.title;
  document.querySelector("#kind-input").value = show.kind;
  document.querySelector("#venue-input").value = show.venue;
  document.querySelector("#start-input").value = show.start;
  document.querySelector("#duration-input").value = show.duration_minutes;
  document.querySelector("#description-input").value = show.description || "";
  if (show.kind === "solo") {
    document.querySelector("#artist-input").value = show.artist;
    document.querySelector("#age-input").value = show.min_age;
  } else if (show.kind === "lineup") {
    document.querySelector("#host-input").value = show.host;
    const acts = new Set(show.acts);
    Array.from(document.querySelector("#acts-input").options).forEach((option) => { option.selected = acts.has(option.value); });
  } else if (show.kind === "workshop") {
    document.querySelector("#teacher-input").value = show.teacher;
    document.querySelector("#participants-input").value = show.max_participants;
  }
  document.querySelector("#form-title").textContent = "Edit a performance";
  document.querySelector("#save-show").innerHTML = "Save changes <span>→</span>";
  document.querySelector("#cancel-edit").classList.remove("hidden");
  document.querySelector("#form-message").textContent = "";
  showKindFields();
  document.querySelector("#performance-form").scrollIntoView({ behavior: "smooth", block: "start" });
}

function formDataForShow() {
  const kind = document.querySelector("#kind-input").value;
  const info = {
    kind,
    title: document.querySelector("#title-input").value.trim(),
    venue: document.querySelector("#venue-input").value,
    start: document.querySelector("#start-input").value,
    duration_minutes: Number(document.querySelector("#duration-input").value),
    description: document.querySelector("#description-input").value.trim(),
  };
  if (kind === "solo") {
    info.artist = document.querySelector("#artist-input").value;
    info.min_age = Number(document.querySelector("#age-input").value);
  } else if (kind === "lineup") {
    info.host = document.querySelector("#host-input").value;
    info.acts = Array.from(document.querySelector("#acts-input").selectedOptions).map((option) => option.value);
  } else {
    info.teacher = document.querySelector("#teacher-input").value;
    info.max_participants = Number(document.querySelector("#participants-input").value);
  }
  return info;
}

async function saveShow(event) {
  event.preventDefault();
  const showId = document.querySelector("#show-id").value;
  const message = document.querySelector("#form-message");
  const button = document.querySelector("#save-show");
  button.disabled = true;
  message.classList.remove("success");
  message.textContent = "Saving…";
  try {
    await getJson(showId ? `/api/performances/${encodeURIComponent(showId)}` : "/api/performances", {
      method: showId ? "PUT" : "POST",
      body: JSON.stringify(formDataForShow()),
    });
    resetForm();
    document.querySelector("#form-message").textContent = showId ? "Changes saved." : "Performance added to the programme.";
    document.querySelector("#form-message").classList.add("success");
    await Promise.all([loadAdminShows(), loadProgramme(), loadArtists(), loadVenues()]);
  } catch (error) {
    message.textContent = error.message;
  } finally {
    button.disabled = false;
  }
}

async function loadArtists() {
  artistsData = await getJson("/api/artists");
  renderArtists();
  renderAdminPeople();
}

async function loadVenues() {
  venuesData = await getJson("/api/venues");
  renderVenues();
  renderAdminPeople();
}

async function startSite() {
  try {
    festivalInfo = await getJson("/api/festival");
    document.querySelector("#stat-days").textContent = "4";
    document.querySelector("#stat-shows").textContent = festivalInfo.performance_count;
    document.querySelector("#stat-artists").textContent = festivalInfo.artist_count;
    activeDay = festivalInfo.first_day;
    renderDayTabs();
    await Promise.all([loadProgramme(), loadArtists(), loadVenues(), loadAdminShows()]);
    showKindFields();
  } catch (error) {
    document.querySelector("#programme-list").innerHTML = `<p class="empty-state">Could not load the festival data: ${escapeHtml(error.message)}</p>`;
  }
}

document.querySelectorAll("[data-page-link]").forEach((button) => {
  button.addEventListener("click", () => showPage(button.dataset.pageLink));
});

document.querySelector("#menu-button").addEventListener("click", (event) => {
  const menu = document.querySelector("#main-nav");
  menu.classList.toggle("open");
  event.currentTarget.setAttribute("aria-expanded", menu.classList.contains("open"));
});

document.querySelector("#day-tabs").addEventListener("click", (event) => {
  const button = event.target.closest("[data-day]");
  if (!button) return;
  activeDay = button.dataset.day;
  renderDayTabs();
  loadProgramme();
});

document.querySelector("#kind-filter").addEventListener("change", (event) => {
  activeKind = event.target.value;
  loadProgramme();
});

document.querySelectorAll("[data-go-kind]").forEach((button) => {
  button.addEventListener("click", () => {
    activeKind = button.dataset.goKind;
    document.querySelector("#kind-filter").value = activeKind;
    showPage("programme");
    loadProgramme();
  });
});

document.querySelector("#artists-list").addEventListener("click", (event) => {
  const button = event.target.closest("[data-artist-day]");
  if (!button || !button.dataset.artistDay) return;
  activeDay = button.dataset.artistDay;
  activeKind = "all";
  document.querySelector("#kind-filter").value = "all";
  renderDayTabs();
  showPage("programme");
  loadProgramme();
});

document.querySelector("#check-now").addEventListener("click", loadNowResults);
document.querySelector("#kind-input").addEventListener("change", showKindFields);
document.querySelector("#performance-form").addEventListener("submit", saveShow);
document.querySelector("#cancel-edit").addEventListener("click", resetForm);

document.querySelector("#admin-show-list").addEventListener("click", async (event) => {
  const editButton = event.target.closest("[data-edit-show]");
  const cancelButton = event.target.closest("[data-delete-show]");
  if (editButton) editShow(editButton.dataset.editShow);
  if (cancelButton && window.confirm("Cancel this performance?")) {
    try {
      await getJson(`/api/performances/${encodeURIComponent(cancelButton.dataset.deleteShow)}`, { method: "DELETE" });
      await Promise.all([loadAdminShows(), loadProgramme(), loadArtists(), loadVenues()]);
    } catch (error) {
      window.alert(error.message);
    }
  }
});

startSite();
