// A tiny, dependency-free, HTML-safe renderer for chat messages.
// Text is escaped FIRST and only then turned into markup, so model output can
// never inject HTML.

export function escapeHtml(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}

const CODE = "\u0000CODE";

function inline(escaped) {
  const codes = [];
  let s = escaped.replace(/`([^`\n]+)`/g, (_, code) => {
    codes.push(code);
    return `${CODE}${codes.length - 1}\u0000`;
  });

  s = s.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s<]*[^\s<.,;:!?'")\]])/g,
    (match, label, url, bare) => {
      const href = url || bare;
      const text = label || bare;
      const safe = href.replace(/"/g, "%22");
      return `<a href="${safe}" target="_blank" rel="noopener noreferrer">${text}</a>`;
    }
  );

  s = s.replace(/\*\*\*([^\s*][\s\S]*?)\*\*\*/g, "<strong><em>$1</em></strong>");
  s = s.replace(/\*\*([^\s*][\s\S]*?)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/(^|[\s(>])__([^\s_][\s\S]*?)__(?=$|[\s.,!?;:)<])/g, "$1<strong>$2</strong>");
  s = s.replace(/\*([^\s*][^*]*?)\*/g, "<em>$1</em>");
  s = s.replace(/(^|[\s(>])_([^\s_][^_]*?)_(?=$|[\s.,!?;:)<])/g, "$1<em>$2</em>");
  s = s.replace(/~~([^\s~][\s\S]*?)~~/g, "<del>$1</del>");

  s = s.replace(new RegExp(`${CODE}(\\d+)\\u0000`, "g"), (_, i) => `<code>${codes[i]}</code>`);
  return s;
}

function textSegment(escaped) {
  const lines = escaped.split("\n");
  const out = [];
  let buffer = [];
  let list = null;

  const flushBuffer = () => {
    if (buffer.length) {
      out.push(buffer.join("<br>"));
      buffer = [];
    }
  };
  const flushList = () => {
    if (list) {
      out.push(`<${list.type}>${list.items.map((i) => `<li>${i}</li>`).join("")}</${list.type}>`);
      list = null;
    }
  };

  for (const raw of lines) {
    const ul = raw.match(/^\s{0,3}[-•]\s+(.*)$/);
    const ol = raw.match(/^\s{0,3}\d{1,2}[.)]\s+(.*)$/);
    const bq = raw.match(/^\s{0,3}&gt;\s?(.*)$/);

    if (ul || ol) {
      flushBuffer();
      const type = ul ? "ul" : "ol";
      if (!list || list.type !== type) {
        flushList();
        list = { type, items: [] };
      }
      list.items.push(inline((ul || ol)[1]));
      continue;
    }
    flushList();

    if (bq) {
      buffer.push(`<span class="md-quote">${inline(bq[1])}</span>`);
      continue;
    }
    buffer.push(inline(raw));
  }
  flushList();
  flushBuffer();
  return out.join("");
}

export function renderMessage(text) {
  const src = String(text ?? "");
  if (!src) return "";
  let out = "";
  let i = 0;
  while (i < src.length) {
    const start = src.indexOf("```", i);
    if (start === -1) {
      out += textSegment(escapeHtml(src.slice(i)));
      break;
    }
    out += textSegment(escapeHtml(src.slice(i, start)));
    let cursor = start + 3;
    const newline = src.indexOf("\n", cursor);
    const langEnd = newline === -1 ? src.length : newline;
    const lang = src.slice(cursor, langEnd).trim().replace(/[^a-zA-Z0-9+#-]/g, "");
    const close = src.indexOf("```", langEnd);
    const codeEnd = close === -1 ? src.length : close;
    const code = src.slice(langEnd, codeEnd).replace(/^\n/, "").replace(/\n$/, "");
    out += `<pre class="md-pre"${lang ? ` data-lang="${lang}"` : ""}><code>${escapeHtml(
      code
    )}</code></pre>`;
    if (close === -1) break;
    i = close + 3;
  }
  return out;
}

export function plainText(html) {
  const div = document.createElement("div");
  div.innerHTML = html;
  return div.textContent || "";
}
