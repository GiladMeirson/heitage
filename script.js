// Helper index
const byId = Object.fromEntries(familyData.map((p) => [p.id, p]));

// ==========================
// Build Cytoscape graph
// ==========================
const cy = cytoscape({
  container: document.getElementById("cy"),
  wheelSensitivity: 0.23,
  minZoom: 0.2,
  maxZoom: 2.2,
  style: [
    {
      selector: 'node[type="person"]',
      style: {
        "background-color": "#35371fff",
        "border-width": 3,
        "border-color": "#475569",
        label: "data(label)",
        "text-valign": "bottom",
        "text-halign": "center",
        "text-margin-y": 10,
        "font-size": 14,
        "text-wrap": "wrap",
        "text-max-width": 110,
        "text-outline-width": 3,
        "text-outline-color": "#0b1220",
        color: "#e5e7eb",
        width: 60,
        height: 60,
        "background-image": "data(photo)",
        "background-fit": "cover cover",
        shape: "ellipse",
        "overlay-padding": 6,
      },
    },
    { selector: "node.male", style: { "border-color": "var(--male)" } },
    { selector: "node.female", style: { "border-color": "var(--female)" } },

    // Union (marriage) nodes – small diamond connectors
    {
      selector: 'node[type="union"]',
      style: {
        shape: "diamond",
        "background-color": "#f9a8d4",
        width: 10,
        height: 10,
        label: "",
        "border-width": 0,
      },
    },

    // Edges
    {
      selector: "edge",
      style: {
        width: 2,
        "line-color": "var(--edge)",
        "curve-style": "taxi",
        "taxi-direction": "downward",
        "taxi-turn-min-distance": 10,
        "target-arrow-shape": "vee",
        "target-arrow-color": "var(--edge)",
      },
    },
    {
      selector: 'edge[rel="spouse"]',
      style: {
        "line-style": "dashed",
        "target-arrow-shape": "none",
        "curve-style": "taxi",
        "line-color": "var(--union)",
      },
    },

    // Path + focus styling
    {
      selector: "edge.highlight",
      style: {
        "line-color": "var(--highlight)",
        "target-arrow-color": "var(--highlight)",
        width: 6,
        "arrow-scale": 1.4,
        "shadow-blur": 12,
        "shadow-color": "var(--highlight)",
        "shadow-opacity": 0.5,
        "z-index-compare": "manual",
        "z-index": 999,
        "underlay-color": "var(--highlight)",
        "underlay-padding": 4,
        "underlay-opacity": 0.25,
        "transition-property": "line-color, width, arrow-scale, shadow-blur",
        "transition-duration": "200ms",
      },
    },
    {
      selector: "node.highlight",
      style: {
        "border-color": "var(--highlight)",
        "border-width": 5,
        "shadow-blur": 10,
        "shadow-color": "var(--highlight)",
        "shadow-opacity": 0.45,
        "z-index-compare": "manual",
        "z-index": 1000,
        "underlay-color": "var(--highlight)",
        "underlay-padding": 6,
        "underlay-opacity": 0.22,
        "transition-property": "border-color, border-width, shadow-blur",
        "transition-duration": "200ms",
      },
    },
    { selector: ".dim", style: { opacity: 0.15 } },
  ],
});

// Build graph elements from our JSON
function buildGraph(data) {
  const elements = [];

  // person nodes
  data.forEach((p) => {
    elements.push({
      data: { id: p.id, type: "person", label: p.name, photo: p.photo },
      classes: p.gender === "M" ? "male" : "female",
    });
  });

  // marriage/union nodes to make hierarchy neat
  const unions = new Map(); // key: sorted "a|b" -> unionId
  data.forEach((p) => {
    if (p.spouse) {
      const a = p.id;
      const b = p.spouse;
      if (!byId[b]) return;
      const key = [a, b].sort().join("|");
      if (!unions.has(key)) {
        const unionId = "u_" + key.replace("|", "_");
        unions.set(key, unionId);
        elements.push({ data: { id: unionId, type: "union" } });
        // connect each spouse to union node (dashed edge)
        elements.push({
          data: {
            id: unionId + "_" + a,
            source: a,
            target: unionId,
            rel: "spouse",
          },
        });
        elements.push({
          data: {
            id: unionId + "_" + b,
            source: b,
            target: unionId,
            rel: "spouse",
          },
        });
      }
    }
  });

  // parent -> child via union when possible
  data.forEach((child) => {
    if (child.parents && child.parents.length) {
      const [pa, pb] = child.parents;
      if (pa && pb) {
        const key = [pa, pb].sort().join("|");
        const unionId = unions.get(key);
        if (unionId) {
          elements.push({
            data: {
              id: unionId + "_" + child.id,
              source: unionId,
              target: child.id,
              rel: "child",
            },
          });
        } else {
          // if for some reason no union node, draw from each parent
          if (pa)
            elements.push({
              data: {
                id: pa + "_" + child.id,
                source: pa,
                target: child.id,
                rel: "child",
              },
            });
          if (pb)
            elements.push({
              data: {
                id: pb + "_" + child.id,
                source: pb,
                target: child.id,
                rel: "child",
              },
            });
        }
      } else {
        // single parent family
        const pOnly = pa || pb;
        if (pOnly)
          elements.push({
            data: {
              id: pOnly + "_" + child.id,
              source: pOnly,
              target: child.id,
              rel: "child",
            },
          });
      }
    }
  });

  cy.add(elements);
}

buildGraph(familyData);

// Layout – hierarchical top (old) to bottom (young)
function runLayout() {
  cy.layout({
    name: "dagre",
    rankDir: "TB",
    nodeSep: 30,
    rankSep: 60,
    edgeSep: 10,
  }).run();
}
runLayout();

// Fit initially after a short tick (fonts/images)
setTimeout(() => cy.fit(undefined, 30), 200);

// Populate selects for path highlighting
function populateSelects() {
  const selA = document.getElementById("personA");
  const selB = document.getElementById("personB");
  const people = familyData.map((p) => ({ id: p.id, name: p.name }));
  for (const s of [selA, selB]) {
    s.innerHTML =
      '<option value="">בחרו אדם…</option>' +
      people.map((p) => `<option value="${p.id}">${p.name}</option>`).join("");
  }
}
populateSelects();

// Modal logic
const modal = document.getElementById("personModal");
const closeModalBtn = document.getElementById("closeModal");
function openModal(p) {
  const nameEl = document.getElementById("modalName");
  const photoEl = document.getElementById("modalPhoto");
  const metaEl = document.getElementById("modalMeta");
  const bioEl = document.getElementById("modalBio");
  const badgesEl = document.getElementById("modalBadges");

  const photoUrl = p.photo || "https://via.placeholder.com/300x300?text=Photo";
  nameEl.textContent = p.name;
  photoEl.src = photoUrl;

  metaEl.textContent = `${p.gender === "M" ? "זכר" : "נקבה"} · ${
    p.birth ?? ""
  }${p.death ? " – " + p.death : ""}`;
  bioEl.textContent = p.bio || "";

  // Build badges (minimal, מרכזיים בלבד)
  const chips = [];
  const genderColor = p.gender === "M" ? "var(--male)" : "var(--female)";
  chips.push(
    `<span class=\"chip\" style=\"--chip:${genderColor}\">${
      p.gender === "M" ? "זכר" : "נקבה"
    }</span>`
  );
  const kids = Array.isArray(p.children) ? p.children.length : 0;
  chips.push(`<span class=\"chip\">ילדים: ${kids}</span>`);
  if (p.spouse) {
    const sp = byId[p.spouse];
    if (sp) chips.push(`<span class=\"chip\">בן/בת זוג: ${sp.name}</span>`);
  }
  badgesEl.innerHTML = chips.join(" ");

  modal.classList.add("show");
  modal.setAttribute("aria-hidden", "false");
}
function closeModal() {
  modal.classList.remove("show");
  modal.setAttribute("aria-hidden", "true");
}
closeModalBtn.addEventListener("click", closeModal);
modal.querySelector(".modal-backdrop").addEventListener("click", closeModal);
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    closeModal();
  }
});

// Node click -> open info (only for persons)
cy.on("tap", 'node[type="person"]', (evt) => {
  const id = evt.target.id();
  const p = byId[id];
  if (p) openModal(p);
});

// Accessible keyboard open (focusable handling)
cy.on("cxttap", "node", (evt) => {
  // long-press context tap on mobile: center on node
  const n = evt.target;
  cy.center(n);
  cy.animate({ center: { eles: n }, zoom: 1.1 }, { duration: 200 });
});

// Path highlighting between two selected people
function clearHighlights() {
  cy.batch(() => {
    cy.elements().removeClass("highlight");
    cy.elements().removeClass("dim");
  });
}

function highlightPath(aId, bId) {
  clearHighlights();
  if (!aId || !bId || aId === bId) return;
  const a = cy.getElementById(aId);
  const b = cy.getElementById(bId);
  if (!a.nonempty() || !b.nonempty()) return;
  const res = cy.elements().aStar({ root: a, goal: b, directed: false });
  if (res.found) {
    cy.batch(() => {
      res.path.addClass("highlight");
      cy.elements().difference(res.path).addClass("dim");
    });
    cy.fit(res.path, 60);
  }
}

document.getElementById("btnPath").addEventListener("click", () => {
  const a = document.getElementById("personA").value;
  const b = document.getElementById("personB").value;
  highlightPath(a, b);
});
function maybeAutoHighlight() {
  const a = document.getElementById("personA").value;
  const b = document.getElementById("personB").value;
  if (a && b) highlightPath(a, b);
  else clearHighlights();
}
document
  .getElementById("personA")
  .addEventListener("change", maybeAutoHighlight);
document
  .getElementById("personB")
  .addEventListener("change", maybeAutoHighlight);
document.getElementById("btnClear").addEventListener("click", () => {
  document.getElementById("personA").value = "";
  document.getElementById("personB").value = "";
  clearHighlights();
  cy.fit(undefined, 30);
});
document
  .getElementById("btnFit")
  .addEventListener("click", () => cy.fit(undefined, 30));

// Resize handling (mobile orientation etc.)
window.addEventListener("resize", () => {
  cy.resize();
  runLayout();
});

// ==========================
// Enhancements – trimmed controls, improved path emphasis
// ==========================

// Zoom controls
function zoomBy(factor) {
  const current = cy.zoom();
  const target = Math.max(
    cy.minZoom(),
    Math.min(cy.maxZoom(), current * factor)
  );
  cy.animate({ zoom: target, center: { eles: cy.nodes() } }, { duration: 160 });
}
document
  .getElementById("btnZoomIn")
  .addEventListener("click", () => zoomBy(1.2));
document
  .getElementById("btnZoomOut")
  .addEventListener("click", () => zoomBy(1 / 1.2));
