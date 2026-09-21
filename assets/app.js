/* Par Value — Eastside green fee finder.
   Static data in data/courses.json; everything below is presentation + filtering. */

(function () {
  "use strict";

  var DATA_URL = "data/courses.json";
  var WEEKDAYS = [1, 2, 3, 4];          // Mon–Thu: the cheap days at most WA courses
  var WEEKEND = [5, 6, 0];              // Fri–Sun: most courses price Friday as weekend
  var HEADLINE_TAGS = ["standard", "resident"]; // senior/junior aren't universal, so they don't set the headline

  var state = {
    data: null,
    when: "now",
    holes: "any",
    sort: "price",
    maxPrice: 150,
    maxDrive: 45,
    walkOnly: false,
    confirmedOnly: false
  };

  var el = {};

  /* ---------- helpers ---------- */

  function $(id) { return document.getElementById(id); }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function money(n) {
    return "$" + (n % 1 === 0 ? n.toFixed(0) : n.toFixed(2));
  }

  function minutesOf(hhmm) {
    var p = String(hhmm).split(":");
    return parseInt(p[0], 10) * 60 + parseInt(p[1], 10);
  }

  function nowMinutes() {
    var d = new Date();
    return d.getHours() * 60 + d.getMinutes();
  }

  function searchLink(course) {
    return "https://www.google.com/search?q=" +
      encodeURIComponent(course.name + " " + course.city + " WA golf green fees");
  }

  /* ---------- rate resolution ---------- */

  // Which weekdays does the current "when" filter allow?
  function allowedDays() {
    var today = new Date().getDay();
    switch (state.when) {
      case "now":
      case "today": return [today];
      case "weekday": return WEEKDAYS.slice();
      case "weekend": return WEEKEND.slice();
      default: return [0, 1, 2, 3, 4, 5, 6];
    }
  }

  function bandMatches(band, days, checkTime) {
    if (state.holes !== "any" && String(band.holes) !== state.holes) return false;

    var dayHit = band.days.some(function (d) { return days.indexOf(d) !== -1; });
    if (!dayHit) return false;

    if (checkTime) {
      var t = nowMinutes();
      if (t < minutesOf(band.start) || t >= minutesOf(band.end)) return false;
    }
    return true;
  }

  // Cheapest band that fits the filters, preferring "headline" rates over senior/junior.
  function pickBand(course, days, checkTime) {
    var bands = (course.rates && course.rates.bands) || [];
    var fits = bands.filter(function (b) { return bandMatches(b, days, checkTime); });
    if (!fits.length) return null;

    var headline = fits.filter(function (b) { return HEADLINE_TAGS.indexOf(b.tag) !== -1; });
    var pool = headline.length ? headline : fits;

    return pool.reduce(function (best, b) { return b.price < best.price ? b : best; });
  }

  // Resolve what price to show for a course under the current filters.
  function resolvePrice(course) {
    var days = allowedDays();
    var checkTime = state.when === "now";

    var band = pickBand(course, days, checkTime);
    // If nothing is open at this exact minute, fall back to today's rates generally.
    if (!band && checkTime) band = pickBand(course, days, false);

    if (band) {
      return {
        kind: "exact",
        value: band.price,
        display: money(band.price),
        label: band.label + (band.cart ? " · cart included" : " · walking"),
        band: band
      };
    }

    var est = course.rates && course.rates.estimate;
    if (est) {
      return {
        kind: "estimate",
        value: est.low,
        display: "≈" + money(est.low) + "–" + money(est.high),
        label: est.basis,
        band: null
      };
    }

    return { kind: "none", value: Infinity, display: "—", label: "No price on record", band: null };
  }

  function confidenceOf(course) {
    return (course.rates && course.rates.confidence) || "unknown";
  }

  var CONF_RANK = { verified: 0, reported: 1, unknown: 2 };

  /* ---------- filtering ---------- */

  function visibleCourses() {
    return state.data.courses.filter(function (c) {
      if (c.driveMinutes > state.maxDrive) return false;
      if (state.walkOnly && !c.walkable) return false;
      if (state.confirmedOnly && confidenceOf(c) === "unknown") return false;

      // Holes filter: a 9-hole-only course can't serve an 18-hole request.
      if (state.holes === "18" && c.holes < 18) return false;

      var p = resolvePrice(c);
      if (p.value > state.maxPrice) return false;

      return true;
    });
  }

  function sortCourses(list) {
    var sorted = list.slice();
    sorted.sort(function (a, b) {
      switch (state.sort) {
        case "drive":
          return a.driveMinutes - b.driveMinutes || a.name.localeCompare(b.name);
        case "confidence":
          return CONF_RANK[confidenceOf(a)] - CONF_RANK[confidenceOf(b)] ||
                 resolvePrice(a).value - resolvePrice(b).value;
        case "name":
          return a.name.localeCompare(b.name);
        default: {
          var pa = resolvePrice(a), pb = resolvePrice(b);
          // Exact prices win ties against estimates — a known number is worth more.
          return pa.value - pb.value ||
                 (pa.kind === "exact" ? 0 : 1) - (pb.kind === "exact" ? 0 : 1) ||
                 a.name.localeCompare(b.name);
        }
      }
    });
    return sorted;
  }

  /* ---------- rendering ---------- */

  function badgeFor(conf) {
    if (conf === "verified") return '<span class="badge badge-verified">Confirmed price</span>';
    if (conf === "reported") return '<span class="badge badge-reported">Reported price</span>';
    return '<span class="badge badge-unknown">Price unconfirmed</span>';
  }

  function rateTable(course) {
    var bands = (course.rates && course.rates.bands) || [];
    if (!bands.length) return "";

    var rows = bands.map(function (b) {
      return "<tr><td>" + esc(b.label) + "</td><td>" + (b.cart ? "With cart" : "Walking") +
             "</td><td>" + money(b.price) + "</td></tr>";
    }).join("");

    return '<details class="rate-details"><summary>All ' + bands.length +
      ' recorded rates</summary><table class="rate-table">' +
      "<thead><tr><th>Rate</th><th>Cart</th><th>Price</th></tr></thead><tbody>" +
      rows + "</tbody></table></details>";
  }

  function courseCard(course) {
    var price = resolvePrice(course);
    var conf = confidenceOf(course);

    var badges = [badgeFor(conf)];
    if (course.dynamicPricing) {
      badges.push('<span class="badge badge-dynamic">Demand pricing</span>');
    }
    badges.push('<span class="badge badge-plain">' + esc(course.type.replace(/-/g, " ")) + "</span>");
    if (course.walkable) badges.push('<span class="badge badge-plain">Walkable</span>');

    var links = [];
    if (course.ratesUrl) {
      links.push('<a href="' + esc(course.ratesUrl) + '" target="_blank" rel="noopener">Course rate page ↗</a>');
    }
    if (course.site && course.site !== course.ratesUrl) {
      links.push('<a href="' + esc(course.site) + '" target="_blank" rel="noopener">Website ↗</a>');
    }
    if (!course.ratesUrl && !course.site) {
      links.push('<a href="' + esc(searchLink(course)) + '" target="_blank" rel="noopener">Find current rates ↗</a>');
    }

    return '<li class="course">' +
      '<div class="course-top">' +
        "<div>" +
          '<h3 class="course-name">' + esc(course.name) + "</h3>" +
          '<p class="course-meta">' + esc(course.city) + " · ~" + course.driveMinutes +
            " min from Bellevue · " + course.holes + " holes, par " + course.par + "</p>" +
        "</div>" +
        '<div class="price-block">' +
          '<span class="price' + (price.kind === "exact" ? "" : " is-estimate") + '">' +
            esc(price.display) + "</span>" +
          '<span class="price-label">' + esc(price.label) + "</span>" +
        "</div>" +
      "</div>" +
      '<div class="badges">' + badges.join("") + "</div>" +
      (course.notes ? '<p class="course-notes">' + esc(course.notes) + "</p>" : "") +
      rateTable(course) +
      '<div class="course-links">' + links.join("") + "</div>" +
    "</li>";
  }

  function renderNowBar() {
    var d = new Date();
    var dayName = d.toLocaleDateString("en-US", { weekday: "long" });
    var timeStr = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

    el.nowLabel.textContent = dayName + " " + timeStr + " — cheapest nearby right now";

    // Independent of the user's filters: nearest + cheapest, confirmed prices preferred.
    var saved = { when: state.when, holes: state.holes, maxPrice: state.maxPrice, maxDrive: state.maxDrive };
    state.when = "now"; state.holes = "any"; state.maxPrice = 999; state.maxDrive = 45;

    var picks = state.data.courses
      .map(function (c) { return { course: c, price: resolvePrice(c) }; })
      .filter(function (x) { return x.price.kind !== "none"; })
      .sort(function (a, b) {
        return (a.price.kind === "exact" ? 0 : 1) - (b.price.kind === "exact" ? 0 : 1) ||
               a.price.value - b.price.value;
      })
      .slice(0, 3);

    state.when = saved.when; state.holes = saved.holes;
    state.maxPrice = saved.maxPrice; state.maxDrive = saved.maxDrive;

    if (!picks.length) {
      el.nowPicks.innerHTML = '<p class="now-empty">No rates on record yet.</p>';
      return;
    }

    el.nowPicks.innerHTML = picks.map(function (x) {
      var href = x.course.ratesUrl || x.course.site || searchLink(x.course);
      return '<a class="now-pick" href="' + esc(href) + '" target="_blank" rel="noopener">' +
        '<span class="np-name">' + esc(x.course.name) + "</span>" +
        '<span class="np-meta">' + esc(x.course.city) + " · ~" + x.course.driveMinutes + " min</span>" +
        '<span class="np-price">' + esc(x.price.display) + "</span>" +
      "</a>";
    }).join("");
  }

  function renderDataHealth() {
    var counts = { verified: 0, reported: 0, unknown: 0 };
    state.data.courses.forEach(function (c) { counts[confidenceOf(c)]++; });
    var total = state.data.courses.length;

    var rows = [
      { key: "verified", label: "Confirmed", color: "var(--accent)" },
      { key: "reported", label: "Reported", color: "var(--warn)" },
      { key: "unknown", label: "Unconfirmed", color: "var(--unknown)" }
    ];

    el.dhBars.innerHTML = rows.map(function (r) {
      var pct = total ? Math.round((counts[r.key] / total) * 100) : 0;
      return '<div class="dh-row"><span>' + r.label + "</span>" +
        '<span class="dh-track"><span class="dh-fill" style="width:' + pct +
          "%;background:" + r.color + ';"></span></span>' +
        '<span class="dh-count">' + counts[r.key] + " / " + total + "</span></div>";
    }).join("");

    var levels = state.data.confidenceLevels || {};
    el.dhLegend.innerHTML = Object.keys(levels).map(function (k) {
      return "<dt>" + esc(k.charAt(0).toUpperCase() + k.slice(1)) + "</dt><dd>" + esc(levels[k]) + "</dd>";
    }).join("");

    var needsWork = state.data.courses
      .filter(function (c) { return confidenceOf(c) === "unknown"; })
      .map(function (c) { return c.name; });

    el.dhTodo.innerHTML = needsWork.length
      ? "<strong>" + needsWork.length + " courses still need a real price.</strong> " +
        "Each one is a five-minute job: open the course's rate page, type the numbers into " +
        "<code>data/courses.json</code>, set <code>confidence</code> to <code>verified</code>." +
        '<details class="dh-details"><summary>Which ones</summary><ul class="dh-todo-list"><li>' +
        needsWork.map(esc).join("</li><li>") + "</li></ul></details>"
      : "<strong>Every course has a confirmed price.</strong> Re-check them at the start of each season.";
  }

  function render() {
    var list = sortCourses(visibleCourses());

    el.courseList.innerHTML = list.map(courseCard).join("");
    el.emptyState.hidden = list.length > 0;

    el.resultsCount.textContent = list.length + (list.length === 1 ? " course" : " courses");

    var whenText = {
      now: "playable right now",
      today: "today",
      weekday: "Mon–Thu",
      weekend: "Fri–Sun",
      any: "any day"
    }[state.when];
    el.resultsNote.textContent = "Showing " + whenText + " rates, within ~" +
      state.maxDrive + " min of Bellevue.";

    renderNowBar();
  }

  /* ---------- wiring ---------- */

  function bind() {
    el.when.addEventListener("change", function () { state.when = this.value; render(); });
    el.holes.addEventListener("change", function () { state.holes = this.value; render(); });
    el.sort.addEventListener("change", function () { state.sort = this.value; render(); });

    el.price.addEventListener("input", function () {
      state.maxPrice = Number(this.value);
      el.priceOut.textContent = state.maxPrice >= 150 ? "Any" : "$" + state.maxPrice;
      render();
    });

    el.drive.addEventListener("input", function () {
      state.maxDrive = Number(this.value);
      el.driveOut.textContent = state.maxDrive + " min";
      render();
    });

    el.walk.addEventListener("change", function () { state.walkOnly = this.checked; render(); });
    el.confirmed.addEventListener("change", function () { state.confirmedOnly = this.checked; render(); });

    el.reset.addEventListener("click", function () {
      state.when = "now"; state.holes = "any"; state.sort = "price";
      state.maxPrice = 150; state.maxDrive = 45;
      state.walkOnly = false; state.confirmedOnly = false;

      el.when.value = "now"; el.holes.value = "any"; el.sort.value = "price";
      el.price.value = 150; el.drive.value = 45;
      el.walk.checked = false; el.confirmed.checked = false;
      el.priceOut.textContent = "Any"; el.driveOut.textContent = "45 min";
      render();
    });

    el.themeToggle.addEventListener("click", function () {
      var root = document.documentElement;
      var current = root.getAttribute("data-theme");
      var systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      var next = current ? (current === "dark" ? "light" : "dark") : (systemDark ? "light" : "dark");
      root.setAttribute("data-theme", next);
      try { localStorage.setItem("pv-theme", next); } catch (e) { /* private mode */ }
    });
  }

  function restoreTheme() {
    try {
      var saved = localStorage.getItem("pv-theme");
      if (saved === "dark" || saved === "light") {
        document.documentElement.setAttribute("data-theme", saved);
      }
    } catch (e) { /* storage blocked; system preference still applies */ }
  }

  function init() {
    el = {
      nowLabel: $("now-label"), nowPicks: $("now-picks"),
      when: $("f-when"), holes: $("f-holes"), sort: $("f-sort"),
      price: $("f-price"), priceOut: $("f-price-out"),
      drive: $("f-drive"), driveOut: $("f-drive-out"),
      walk: $("f-walk"), confirmed: $("f-confirmed"), reset: $("f-reset"),
      courseList: $("course-list"), emptyState: $("empty-state"),
      resultsCount: $("results-count"), resultsNote: $("results-note"),
      dhBars: $("dh-bars"), dhLegend: $("dh-legend"), dhTodo: $("dh-todo"),
      footerDisclaimer: $("footer-disclaimer"), footerUpdated: $("footer-updated"),
      themeToggle: $("theme-toggle")
    };

    restoreTheme();

    fetch(DATA_URL)
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then(function (data) {
        state.data = data;
        el.priceOut.textContent = "Any";
        el.footerDisclaimer.textContent = data.meta.disclaimer + " " + data.meta.season;
        el.footerUpdated.textContent = data.meta.updated;
        bind();
        renderDataHealth();
        render();
      })
      .catch(function (err) {
        el.nowLabel.textContent = "Couldn't load course data";
        el.nowPicks.innerHTML = '<p class="now-empty">' + esc(String(err.message)) +
          ". If you opened this file directly, serve it over HTTP instead " +
          '(<code>python3 -m http.server</code>) — <code>fetch</code> is blocked on <code>file://</code>.</p>';
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
