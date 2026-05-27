"use strict";

const state = {
  images: [],
  visibleIds: new Set(),
  scanning: false,
  lang: "en",
  pageTitle: "",
  pendingScan: false
};

const LANGUAGE_KEY = "tdimagedown.language";
let scanTimer = null;

const messages = {
  en: {
    language: "Language",
    rescan: "Reload",
    statusReady: "Ready to scan this page",
    scanning: "Scanning this page...",
    detectingTypes: "Detecting image types...",
    foundImages: "Found {count} images",
    statusSummary: "Found {total}, visible {visible}, selected {selected}",
    noActiveTab: "No active tab found",
    scanFailed: "Scan failed",
    pageNotSupported: "This page cannot be scanned (browser internal page)",
    noImages: "No downloadable images were found on this page.",
    previewFailed: "Preview failed",
    unknownSize: "unknown size",
    unknownSizeBadge: "size ?",
    selectAll: "Select all",
    clear: "Clear",
    download: "Download",
    downloadCount: "Download ({count})",
    downloading: "Downloading...",
    downloadingFile: "Downloading {current}/{total}: {filename}",
    downloadDone: "Done: {count} downloaded",
    downloadDoneWithFailures: "Done: {ok} downloaded, {failed} failed",
    filterPlaceholder: "Filter by URL or filename",
    imageType: "Image type",
    allTypes: "All types",
    other: "Unknown",
    sort: "Sort",
    largest: "Largest",
    pageOrder: "Page order",
    open: "Open",
    openNewTab: "Open in new tab"
  },
  zh: {
    language: "语言",
    rescan: "重新加载",
    statusReady: "准备扫描当前页面",
    scanning: "正在扫描当前页面...",
    detectingTypes: "正在识别图片类型...",
    foundImages: "找到 {count} 张图片",
    statusSummary: "找到 {total} 张，可见 {visible} 张，已选 {selected} 张",
    noActiveTab: "没有找到当前标签页",
    scanFailed: "扫描失败",
    pageNotSupported: "该页面无法扫描（浏览器内置页面）",
    noImages: "当前页面没有扫描到可下载图片。",
    previewFailed: "预览失败",
    unknownSize: "未知尺寸",
    unknownSizeBadge: "尺寸未知",
    selectAll: "全选",
    clear: "清空",
    download: "下载",
    downloadCount: "下载 ({count})",
    downloading: "下载中...",
    downloadingFile: "正在下载 {current}/{total}: {filename}",
    downloadDone: "完成：已下载 {count} 张",
    downloadDoneWithFailures: "完成：成功 {ok} 张，失败 {failed} 张",
    filterPlaceholder: "按 URL 或文件名过滤",
    imageType: "图片类型",
    allTypes: "全部类型",
    other: "未知",
    sort: "排序",
    largest: "尺寸最大",
    pageOrder: "页面顺序",
    open: "打开",
    openNewTab: "新标签打开"
  }
};

const els = {
  statusText: document.getElementById("statusText"),
  scanBtn: document.getElementById("scanBtn"),
  languageSelect: document.getElementById("languageSelect"),
  searchInput: document.getElementById("searchInput"),
  typeFilter: document.getElementById("typeFilter"),
  minWidth: document.getElementById("minWidth"),
  minHeight: document.getElementById("minHeight"),
  sortSelect: document.getElementById("sortSelect"),
  selectAllBtn: document.getElementById("selectAllBtn"),
  clearBtn: document.getElementById("clearBtn"),
  downloadBtn: document.getElementById("downloadBtn"),
  imageList: document.getElementById("imageList"),
  template: document.getElementById("imageCardTemplate")
};

document.addEventListener("DOMContentLoaded", init);

function init() {
  state.lang = getInitialLanguage();
  els.languageSelect.value = state.lang;
  applyTranslations();

  els.languageSelect.addEventListener("change", changeLanguage);
  els.scanBtn.addEventListener("click", scanCurrentTab);
  els.searchInput.addEventListener("input", applyFilters);
  els.typeFilter.addEventListener("change", applyFilters);
  els.minWidth.addEventListener("input", applyFilters);
  els.minHeight.addEventListener("input", applyFilters);
  els.sortSelect.addEventListener("change", renderImages);
  els.selectAllBtn.addEventListener("click", selectVisible);
  els.clearBtn.addEventListener("click", clearSelection);
  els.downloadBtn.addEventListener("click", downloadSelected);
  chrome.runtime.onMessage.addListener((message) => {
    if (message && message.type === "tdimagedown:tabChanged") {
      scheduleScan();
    }
  });
  scanCurrentTab();
}

function scheduleScan(delay = 350) {
  window.clearTimeout(scanTimer);
  scanTimer = window.setTimeout(() => {
    scanCurrentTab();
  }, delay);
}

function getInitialLanguage() {
  const saved = localStorage.getItem(LANGUAGE_KEY);
  if (saved && messages[saved]) return saved;

  const browserLang = navigator.language || "";
  return browserLang.toLowerCase().startsWith("zh") ? "zh" : "en";
}

function changeLanguage() {
  state.lang = messages[els.languageSelect.value] ? els.languageSelect.value : "en";
  localStorage.setItem(LANGUAGE_KEY, state.lang);
  applyTranslations();
  renderImages();
  if (!state.scanning) updateStatusSummary();
}

function t(key, params = {}) {
  const template = (messages[state.lang] && messages[state.lang][key]) || messages.en[key] || key;
  return template.replace(/\{(\w+)\}/g, (match, name) => String(params[name] ?? match));
}

function applyTranslations() {
  document.documentElement.lang = state.lang === "zh" ? "zh-CN" : "en";

  document.querySelectorAll("[data-i18n]").forEach((node) => {
    node.textContent = t(node.dataset.i18n);
  });
  document.querySelectorAll("[data-i18n-title]").forEach((node) => {
    node.title = t(node.dataset.i18nTitle);
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((node) => {
    node.placeholder = t(node.dataset.i18nPlaceholder);
  });
  document.querySelectorAll("[data-i18n-aria-label]").forEach((node) => {
    node.setAttribute("aria-label", t(node.dataset.i18nAriaLabel));
  });

  updateButtons();
}

async function scanCurrentTab() {
  if (state.scanning) {
    state.pendingScan = true;
    return;
  }
  setScanning(true);
  state.pendingScan = false;

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) {
      throw Object.assign(new Error(t("noActiveTab")), { expected: true });
    }
    state.pageTitle = tab.title || "";

    // chrome://、about:、edge:// 等特权页面无法注入脚本，提前拦截
    const tabUrl = tab.url || "";
    if (/^(chrome|about|edge|brave|opera):\/\//i.test(tabUrl)) {
      throw Object.assign(new Error(t("pageNotSupported")), { expected: true });
    }

    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id, allFrames: true },
      func: scanImagesInPage
    });

    const merged = [];
    for (const result of results || []) {
      if (result && result.result && Array.isArray(result.result.images)) {
        merged.push(...result.result.images);
      }
    }

    state.images = dedupeImages(merged);
    if (state.images.some((image) => image.type === "other")) {
      setStatus(t("detectingTypes"));
      await enrichImageTypes(state.images);
    }
    renderImages();
    setStatus(t("foundImages", { count: state.images.length }));
  } catch (error) {
    // 预期内的中止（如内置页面、无 tab）不写入扩展错误日志
    if (!error.expected) console.error(error);
    state.images = [];
    renderImages();
    setStatus(error.message || t("scanFailed"), true);
  } finally {
    setScanning(false);
    if (state.pendingScan) scheduleScan(100);
  }
}

function renderImages() {
  els.imageList.textContent = "";

  const sorted = [...state.images].sort((a, b) => {
    const sortBy = els.sortSelect.value;
    if (sortBy === "index") return a.index - b.index;
    if (sortBy === "url") return a.url.localeCompare(b.url);
    return imageArea(b) - imageArea(a);
  });

  if (!sorted.length) {
    renderEmpty(t("noImages"));
    updateButtons();
    return;
  }

  const fragment = document.createDocumentFragment();
  for (const image of sorted) {
    const node = createImageCard(image);
    fragment.appendChild(node);
  }

  els.imageList.appendChild(fragment);
  applyFilters();
}

function createImageCard(image) {
  const node = els.template.content.firstElementChild.cloneNode(true);
  node.dataset.id = image.id;
  node.dataset.type = image.type;
  node.dataset.width = String(image.width || 0);
  node.dataset.height = String(image.height || 0);
  node.dataset.url = image.url.toLowerCase();

  const input = node.querySelector(".select-input");
  input.checked = image.selected !== false;
  input.addEventListener("change", () => {
    image.selected = input.checked;
    updateButtons();
  });

  const thumb = node.querySelector(".thumb");
  thumb.src = image.url;
  thumb.title = image.url;
  thumb.addEventListener("error", () => {
    // Preview failed → remove from data and DOM entirely
    state.images = state.images.filter((img) => img.id !== image.id);
    state.visibleIds.delete(image.id);
    node.remove();
    updateStatusSummary();
    updateButtons();
  });

  node.querySelector(".filename").textContent = image.filename;
  node.querySelector(".details").textContent = formatDetails(image);
  node.querySelector(".url").textContent = image.url;
  node.querySelector(".type-badge").textContent = image.type.toUpperCase();
  node.querySelector(".size-badge").textContent = image.width && image.height ? `${image.width}x${image.height}` : t("unknownSizeBadge");

  const openLink = node.querySelector(".open-link");
  openLink.href = image.url;
  openLink.textContent = t("open");
  openLink.title = t("openNewTab");

  return node;
}

function applyFilters() {
  const query = els.searchInput.value.trim().toLowerCase();
  const type = els.typeFilter.value;
  const minWidth = Number(els.minWidth.value) || 0;
  const minHeight = Number(els.minHeight.value) || 0;

  state.visibleIds = new Set();

  for (const node of els.imageList.querySelectorAll(".image-card")) {
    const image = state.images.find((item) => item.id === node.dataset.id);
    if (!image) continue;

    const typeOk = !type || image.type === type;
    const queryOk = !query || node.dataset.url.includes(query) || image.filename.toLowerCase().includes(query);
    const sizeOk = (image.width || 0) >= minWidth && (image.height || 0) >= minHeight;
    const visible = typeOk && queryOk && sizeOk;

    node.classList.toggle("hidden", !visible);
    if (visible) state.visibleIds.add(image.id);
  }

  updateStatusSummary();
  updateButtons();
}

function selectVisible() {
  for (const image of state.images) {
    if (state.visibleIds.has(image.id)) image.selected = true;
  }
  syncCheckboxes();
}

function clearSelection() {
  for (const image of state.images) {
    image.selected = false;
  }
  syncCheckboxes();
}

function syncCheckboxes() {
  for (const node of els.imageList.querySelectorAll(".image-card")) {
    const image = state.images.find((item) => item.id === node.dataset.id);
    const input = node.querySelector(".select-input");
    if (image && input) input.checked = image.selected !== false;
  }
  updateButtons();
  updateStatusSummary();
}

async function downloadSelected() {
  const images = selectedImages();
  if (!images.length) return;

  els.downloadBtn.disabled = true;
  els.downloadBtn.textContent = t("downloading");

  let ok = 0;
  let failed = 0;

  for (let i = 0; i < images.length; i += 1) {
    const image = images[i];
    setStatus(t("downloadingFile", { current: i + 1, total: images.length, filename: image.filename }));
    try {
      await chrome.downloads.download({
        url: image.url,
        filename: buildDownloadPath(image, i),
        conflictAction: "uniquify",
        saveAs: false
      });
      ok += 1;
    } catch (error) {
      console.error("download failed", image.url, error);
      failed += 1;
    }
  }

  els.downloadBtn.textContent = t("download");
  updateButtons();
  setStatus(failed ? t("downloadDoneWithFailures", { ok, failed }) : t("downloadDone", { count: ok }));
}

function isFilterActive() {
  return !!(
    els.typeFilter.value ||
    els.searchInput.value.trim() ||
    Number(els.minWidth.value) ||
    Number(els.minHeight.value)
  );
}

function selectedImages() {
  // 当筛选条件激活时，只返回可见且已选中的图片（可见数量为 0 时也应返回空）
  if (isFilterActive()) {
    return state.images.filter((image) => image.selected !== false && state.visibleIds.has(image.id));
  }
  return state.images.filter((image) => image.selected !== false);
}

function updateButtons() {
  const hasImages = state.images.length > 0;
  // 下载数量只统计当前可见且已选中的图片
  const selectedCount = selectedImages().length;
  const allSelectedCount = state.images.filter((image) => image.selected !== false).length;
  els.selectAllBtn.disabled = !hasImages || state.visibleIds.size === 0;
  els.clearBtn.disabled = !hasImages || allSelectedCount === 0;
  els.downloadBtn.disabled = state.scanning || selectedCount === 0;
  els.downloadBtn.textContent = selectedCount ? t("downloadCount", { count: selectedCount }) : t("download");
}

function setScanning(scanning) {
  state.scanning = scanning;
  els.scanBtn.disabled = scanning;
  if (scanning) {
    setStatus(t("scanning"));
  }
  updateButtons();
}

function setStatus(message, isError = false) {
  els.statusText.textContent = message;
  els.statusText.classList.toggle("error", isError);
}

function renderEmpty(message) {
  const empty = document.createElement("div");
  empty.className = "empty";
  empty.textContent = message;
  els.imageList.appendChild(empty);
}

function updateStatusSummary() {
  setStatus(t("statusSummary", {
    total: state.images.length,
    visible: state.visibleIds.size,
    selected: selectedImages().length
  }));
}

function dedupeImages(images) {
  const map = new Map();
  for (const image of images) {
    if (!image || !image.url) continue;
    const key = image.url;
    const current = map.get(key);
    if (!current || imageArea(image) > imageArea(current)) {
      map.set(key, {
        id: stableId(key),
        url: key,
        filename: filenameFromUrl(key),
        width: Number(image.width) || 0,
        height: Number(image.height) || 0,
        type: normalizeType(image.type || typeFromUrl(key)),
        source: image.source || "unknown",
        index: Number(image.index) || 0,
        selected: true
      });
    }
  }
  return [...map.values()];
}

function imageArea(image) {
  return (Number(image.width) || 0) * (Number(image.height) || 0);
}

function formatDetails(image) {
  const size = image.width && image.height ? `${image.width}x${image.height}` : t("unknownSize");
  return `${size} - ${image.type.toUpperCase()} - ${image.source}`;
}

function buildDownloadPath(image, index) {
  const prefix = String(index + 1).padStart(3, "0");
  const folder = sanitizeFilename(state.pageTitle || "tdimagedown");
  return `${folder}/${prefix}-${sanitizeFilename(image.filename)}`;
}

function filenameFromUrl(url) {
  if (url.startsWith("data:image/")) {
    const type = normalizeType(url.slice(11, url.indexOf(";") > 0 ? url.indexOf(";") : url.indexOf(",")));
    return `image.${type === "jpg" ? "jpg" : type}`;
  }

  try {
    const parsed = new URL(url);
    const last = decodeURIComponent(parsed.pathname.split("/").filter(Boolean).pop() || "");
    if (last && last.includes(".")) return sanitizeFilename(last);
  } catch (error) {
    console.debug("filename parse failed", error);
  }

  const type = normalizeType(typeFromUrl(url));
  return `image.${type === "other" ? "jpg" : type}`;
}

function sanitizeFilename(name) {
  const cleaned = String(name || "image")
    .replace(/[\\/:*?"<>|]+/g, "_")
    .replace(/[\u0000-\u001f]+/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[. ]+$/g, "");
  return cleaned || "image";
}

function typeFromUrl(url) {
  const lower = url.toLowerCase();
  if (lower.startsWith("data:image/")) {
    return lower.slice(11, lower.indexOf(";") > 0 ? lower.indexOf(";") : lower.indexOf(","));
  }
  const clean = lower.split("#")[0].split("?")[0];
  const match = clean.match(/\.([a-z0-9]+)$/);
  return match ? match[1] : "other";
}

function normalizeType(type) {
  const value = String(type || "")
    .toLowerCase()
    .split(";")[0]
    .trim()
    .replace("image/", "")
    .replace("jpeg", "jpg");
  if (["jpg", "png", "webp", "gif", "svg", "avif"].includes(value)) return value;
  if (value === "svg+xml") return "svg";
  return "other";
}

async function enrichImageTypes(images) {
  const targets = images.filter((image) => image.type === "other" && /^https?:\/\//i.test(image.url));
  await mapWithConcurrency(targets, 8, enrichImageType);
}

async function enrichImageType(image) {
  const contentType = await readImageContentType(image.url);
  const detectedType = normalizeType(contentType);
  if (detectedType === "other") return;

  image.type = detectedType;
  if (/^image\.(jpg|jpeg)$/i.test(image.filename)) {
    image.filename = `image.${extensionForType(detectedType)}`;
  }
}

async function readImageContentType(url) {
  const headType = await fetchContentType(url, { method: "HEAD" });
  if (headType) return headType;

  return fetchContentType(url, {
    method: "GET",
    headers: { Range: "bytes=0-0" }
  });
}

async function fetchContentType(url, options) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(url, {
      ...options,
      cache: "force-cache",
      credentials: "include",
      signal: controller.signal
    });
    return response.headers.get("content-type") || "";
  } catch (error) {
    return "";
  } finally {
    window.clearTimeout(timeout);
    controller.abort();
  }
}

async function mapWithConcurrency(items, limit, worker) {
  let cursor = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const item = items[cursor];
      cursor += 1;
      await worker(item);
    }
  });
  await Promise.all(runners);
}

function extensionForType(type) {
  return type === "jpg" ? "jpg" : type;
}

function stableId(value) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return `img-${hash.toString(16)}`;
}

function scanImagesInPage() {
  const images = [];
  const seen = new Set();
  let index = 0;

  function add(url, meta) {
    const absolute = toAbsoluteUrl(url);
    if (!absolute || seen.has(absolute)) return;
    if (!isSupportedUrl(absolute)) return;
    seen.add(absolute);
    images.push({
      url: absolute,
      width: meta && meta.width ? Math.round(meta.width) : 0,
      height: meta && meta.height ? Math.round(meta.height) : 0,
      type: meta && meta.type ? meta.type : typeFromUrlInPage(absolute),
      source: meta && meta.source ? meta.source : "page",
      index: index++
    });
  }

  function toAbsoluteUrl(url) {
    if (!url || typeof url !== "string") return "";
    const trimmed = url.trim().replace(/^['"]|['"]$/g, "");
    if (!trimmed || trimmed === "none" || trimmed.startsWith("chrome-extension:")) return "";
    if (trimmed.startsWith("data:image/")) return trimmed;
    if (trimmed.startsWith("blob:")) return "";
    try {
      return new URL(trimmed, document.baseURI).href;
    } catch (error) {
      return "";
    }
  }

  function isSupportedUrl(url) {
    return url.startsWith("http://") || url.startsWith("https://") || url.startsWith("data:image/");
  }

  function parseSrcset(value) {
    if (!value) return [];
    return value
      .split(",")
      .map((part) => part.trim().split(/\s+/)[0])
      .filter(Boolean);
  }

  function extractCssUrls(value) {
    if (!value || value === "none") return [];
    const urls = [];
    const re = /url\((['"]?)(.*?)\1\)/g;
    let match;
    while ((match = re.exec(value))) {
      if (match[2]) urls.push(match[2]);
    }
    return urls;
  }

  function normalizeEmbeddedText(value) {
    return String(value || "")
      .replace(/\\u002f/gi, "/")
      .replace(/\\\//g, "/")
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");
  }

  function cleanEmbeddedUrl(value) {
    return String(value || "")
      .replace(/^['"]+|['"]+$/g, "")
      .replace(/[),;\]}]+$/g, "")
      .trim();
  }

  function hasImageExtension(url) {
    return /\.(png|svg|jpe?g|gif|bmp|ico|webp|tiff?|apng|jfif|pjpeg|pjp)(?:[?#].*)?$/i.test(url);
  }

  function addUrlsFromText(text, source) {
    const normalized = normalizeEmbeddedText(text);
    const urlPattern = /https?:\/\/[^\s"'<>`]+/gi;
    let match;
    while ((match = urlPattern.exec(normalized))) {
      const url = cleanEmbeddedUrl(match[0]);
      if (hasImageExtension(url)) add(url, { source });
    }
  }

  function scanLoadedResources() {
    if (!performance || typeof performance.getEntriesByType !== "function") return;
    try {
      performance.getEntriesByType("resource").forEach((entry) => {
        if (entry && entry.name && hasImageExtension(entry.name)) {
          add(entry.name, { source: `resource:${entry.initiatorType || "unknown"}` });
        }
      });
    } catch (error) {
      console.debug("resource entries skipped", error);
    }
  }

  function scanStyleSheets() {
    Array.from(document.styleSheets || []).forEach((sheet) => {
      try {
        Array.from(sheet.cssRules || []).forEach((rule) => {
          addUrlsFromText(rule.cssText, "stylesheet");
        });
      } catch (error) {
        console.debug("stylesheet skipped", error);
      }
    });
  }

  function typeFromUrlInPage(url) {
    const lower = url.toLowerCase();
    if (lower.startsWith("data:image/")) {
      return lower.slice(11, lower.indexOf(";") > 0 ? lower.indexOf(";") : lower.indexOf(","));
    }
    const clean = lower.split("#")[0].split("?")[0];
    const match = clean.match(/\.([a-z0-9]+)$/);
    return match ? match[1] : "other";
  }

  function visitRoot(root) {
    root.querySelectorAll("img").forEach((img) => {
      add(img.currentSrc || img.src, {
        width: img.naturalWidth || img.width || img.clientWidth,
        height: img.naturalHeight || img.height || img.clientHeight,
        source: "img"
      });
      parseSrcset(img.getAttribute("srcset")).forEach((src) => {
        add(src, {
          width: img.naturalWidth || img.width || img.clientWidth,
          height: img.naturalHeight || img.height || img.clientHeight,
          source: "srcset"
        });
      });
    });

    root.querySelectorAll("source[srcset]").forEach((source) => {
      parseSrcset(source.getAttribute("srcset")).forEach((src) => add(src, { source: "source" }));
    });

    root.querySelectorAll("input[type='image']").forEach((input) => {
      add(input.src || input.getAttribute("src"), {
        width: input.width || input.clientWidth,
        height: input.height || input.clientHeight,
        source: "input"
      });
    });

    root.querySelectorAll("a[href]").forEach((link) => {
      const href = link.getAttribute("href");
      if (hasImageExtension(href || "")) {
        add(href, { source: "link" });
      }
    });

    root.querySelectorAll("svg").forEach((svg) => {
      try {
        const clone = svg.cloneNode(true);
        if (!clone.getAttribute("xmlns")) clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
        const text = new XMLSerializer().serializeToString(clone);
        const dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(text)}`;
        const rect = svg.getBoundingClientRect();
        add(dataUrl, {
          width: rect.width,
          height: rect.height,
          type: "svg",
          source: "inline-svg"
        });
      } catch (error) {
        console.debug("inline svg skipped", error);
      }
    });

    root.querySelectorAll("*").forEach((el) => {
      const style = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      const sourceMeta = {
        width: rect.width,
        height: rect.height,
        source: "css"
      };
      extractCssUrls(style.backgroundImage).forEach((url) => add(url, sourceMeta));
      extractCssUrls(style.background).forEach((url) => add(url, sourceMeta));
      extractCssUrls(style.borderImageSource).forEach((url) => add(url, sourceMeta));
      extractCssUrls(style.listStyleImage).forEach((url) => add(url, sourceMeta));
      extractCssUrls(style.maskImage).forEach((url) => add(url, { ...sourceMeta, source: "mask" }));
      extractCssUrls(style.webkitMaskImage).forEach((url) => add(url, { ...sourceMeta, source: "mask" }));
      for (const attr of el.attributes || []) {
        if (attr && attr.value && /(?:src|url|image|icon|bg|background|data)/i.test(attr.name)) {
          addUrlsFromText(attr.value, "attribute");
        }
      }
      if (el.shadowRoot) visitRoot(el.shadowRoot);
    });
  }

  visitRoot(document);
  scanLoadedResources();
  scanStyleSheets();
  addUrlsFromText(document.documentElement ? document.documentElement.innerHTML : "", "html");

  return {
    title: document.title,
    url: location.href,
    images
  };
}
