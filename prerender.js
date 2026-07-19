// prerender.js
// Run this BEFORE every deploy (e.g. as a Netlify "build command", or
// manually / on a cron job): `node prerender.js`
//
// It fetches the current approved+active groups from Supabase and writes
// real, crawlable <div class="group-card"> HTML straight into index.html,
// inside the #groupsGridContainer div. Your existing client-side
// loadGroups()/renderGroups() JS is untouched — it will still run on
// page load and overwrite this container with the live, filterable data.
// This block only exists so that search engines (and users with JS
// disabled/slow) see real content on the very first HTML response.

const fs = require("fs");

const SUPABASE_URL = "https://imnzgzusnghppgbgfdsh.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImltbnpnenVzbmdocHBnYmdmZHNoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIwNTYyNDIsImV4cCI6MjA5NzYzMjI0Mn0.XIMHM7lyUJM-dbmrIIkM7eWIzu7znrKxjHkfU-XhJLk";
const HTML_FILE = "index.html";
const MAX_GROUPS = 60; // enough for real content without bloating page weight

const START_MARKER = "<!-- PRERENDER:START -->";
const END_MARKER = "<!-- PRERENDER:END -->";

function escapeHtml(str) {
  return String(str || "").replace(/[&<>"']/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
  });
}

function cardHtml(g) {
  const name = escapeHtml(g.name);
  const desc = escapeHtml((g.description || "Join this community!").substring(0, 140));
  const link = escapeHtml(g.link);
  const country = escapeHtml(g.country || "Worldwide");
  const language = escapeHtml(g.language || "English");
  const category = escapeHtml(g.category || "General");
  return (
    '<div class="group-card">' +
      '<div class="card-header">' +
        '<div class="group-title">' +
          "<h4>" + name + "</h4>" +
          '<div class="group-meta">' +
            '<span><i class="fas fa-globe"></i> ' + country + "</span>" +
            '<span><i class="fas fa-language"></i> ' + language + "</span>" +
            '<span class="badge-category">' + category + "</span>" +
          "</div>" +
        "</div>" +
      "</div>" +
      '<div class="card-body">' +
        '<div class="description">' + desc + "</div>" +
        '<div class="card-actions">' +
          '<a href="' + link + '" target="_blank" rel="noopener noreferrer" class="join-link-btn">Open</a>' +
        "</div>" +
      "</div>" +
    "</div>"
  );
}

async function fetchGroups() {
  const url =
    SUPABASE_URL +
    "/rest/v1/groups?select=name,link,description,category,country,language" +
    "&is_approved=eq.true&is_active=eq.true&order=created_at.desc&limit=" +
    MAX_GROUPS;

  const res = await fetch(url, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: "Bearer " + SUPABASE_ANON_KEY,
    },
  });

  if (!res.ok) {
    throw new Error("Supabase fetch failed: " + res.status + " " + (await res.text()));
  }
  return res.json();
}

async function main() {
  const groups = await fetchGroups();
  console.log("Fetched " + groups.length + " groups for prerender.");

  const cardsHtml = groups.map(cardHtml).join("");
  const block = START_MARKER + cardsHtml + END_MARKER;

  let html = fs.readFileSync(HTML_FILE, "utf8");

  const containerRegex = /(<div id="groupsGridContainer" class="groups-grid">)([\s\S]*?)(<\/div>)/;

  if (!containerRegex.test(html)) {
    throw new Error("Could not find #groupsGridContainer in " + HTML_FILE);
  }

  html = html.replace(containerRegex, function (_match, open, inner, close) {
    // Strip any previous prerendered block, then insert a fresh one.
    const cleanedInner = inner
      .replace(new RegExp(START_MARKER + "[\\s\\S]*?" + END_MARKER), "")
      .trim();
    return open + block + cleanedInner + close;
  });

  fs.writeFileSync(HTML_FILE, html, "utf8");
  console.log("Prerendered " + groups.length + " groups into " + HTML_FILE);
}

main().catch(function (err) {
  console.error(err);
  process.exit(1);
});
