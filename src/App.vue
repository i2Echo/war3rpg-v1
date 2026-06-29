<template>
  <div
    @click="onClick"
    @input="onInput"
    @compositionstart="onCompositionStart"
    @compositionend="onCompositionEnd"
    @keydown="onKeydown"
    @focusin="onFocusIn"
    @focusout="onFocusOut"
    @pointerdown="onPointerDown"
    @pointerover="onPointerOver"
    @pointerup="clearLongPress"
    @pointercancel="clearLongPress"
    @pointerleave="clearLongPress"
    @contextmenu="onContextMenu"
    @selectstart="onSelectStart"
    @scroll.capture="onScrollCapture"
    @dragstart="onDragStart"
    @dragover="onDragOver"
    @dragleave="onDragLeave"
    @drop="onDrop"
    @touchstart="onTouchStart"
    @touchend="onTouchEnd"
  >
    <header class="topbar">
      <div class="brand">
        <button
          class="brand-mark"
          id="brand-theme-toggle"
          type="button"
          :aria-label="state.theme === 'mono' ? '切换为原始风格' : '切换为黑白简洁风格'"
          :aria-pressed="state.theme === 'mono'"
          :title="state.theme === 'mono' ? '切换为原始风格' : '切换为黑白简洁风格'"
        >
          W3
        </button>
        <span class="brand-title">西方世界的劫难3 · 装备图鉴</span>
        <span class="brand-version">v2.4.6</span>
      </div>
      <div class="topbar-search" :class="{ open: state.mobileSearchPopoverOpen }" v-html="topbarSearchHtml"></div>
      <nav class="topbar-nav" aria-label="顶部功能">
        <a
          class="nav-pill nav-pill-secondary"
          href="https://war3rpg.677233.xyz/"
          target="_blank"
          rel="noreferrer"
        >
          旧版入口
        </a>
        <button class="nav-pill" id="quiz-open" type="button">帝都答题</button>
      </nav>
    </header>
    <main>
      <section class="hero">
        <div>
          <p class="notice">装备图鉴 · 炼化路线</p>
          <h1>西方世界的劫难3 · 装备图鉴</h1>
          <p>{{ equipmentCount }} 件装备，{{ recipeCount }} 条合成卷轴，{{ refiningRuleCount }} 条炼化规则。</p>
        </div>
      </section>

      <section class="query-band">
        <aside class="filter-panel" :class="{ 'mobile-filters-open': state.filtersOpen }" v-html="filterHtml"></aside>
        <section class="catalog-area" v-html="catalogHtml"></section>
        <aside class="sim-panel" :class="{ open: state.simOpen }" aria-label="炼化查询" v-html="simulationHtml"></aside>
      </section>
    </main>
    <footer class="site-footer">
      <span>© {{ currentYear }} 爱吃海苔的猫</span>
      <span class="footer-separator" aria-hidden="true">·</span>
      <a class="footer-contact" href="mailto:sama2echo@gmail.com" aria-label="发送邮件到 sama2echo@gmail.com">
        <span v-html="renderIcon('mail')"></span>
      </a>
    </footer>
    <button v-if="!state.simOpen" class="sim-anchor" id="sim-anchor" type="button" aria-label="展开炼化查询">
      <span v-html="renderIcon('keyboard_arrow_left')"></span>
    </button>
    <div v-if="state.simOpen" class="sim-scrim" id="sim-scrim"></div>
    <button
      class="to-top t-panel-slide"
      id="to-top"
      type="button"
      aria-label="回到顶部"
      :aria-hidden="state.showToTop ? 'false' : 'true'"
      :data-open="state.showToTop ? 'true' : 'false'"
      :tabindex="state.showToTop ? 0 : -1"
    >
      <span v-html="renderIcon('arrow_upward')"></span>
    </button>
    <div v-if="state.filtersOpen && state.isMobileLayout" class="filter-sheet-shell" id="filter-sheet-scrim">
      <div class="filter-sheet" role="dialog" aria-label="筛选条件" v-html="filterSheetHtml"></div>
    </div>
    <div v-if="selectedItem" class="detail-shell" v-html="detailHtml"></div>
    <div v-if="state.quizOpen" class="modal-shell" role="dialog" aria-label="帝都答题答案">
      <div class="quiz-modal t-modal is-open">
        <div class="modal-head">
          <div>
            <span class="category">v2.4.6</span>
          <h2>帝都答题</h2>
        </div>
        <button class="icon-button" id="close-quiz" type="button" aria-label="关闭帝都答题">
          <span v-html="renderIcon('close')"></span>
        </button>
      </div>
        <div class="quiz-tabs">
          <button
            v-for="tab in quizTabs"
            :key="tab"
            type="button"
            :class="{ active: state.quizTab === tab }"
            :data-quiz-tab="tab"
          >
            {{ tab }}
          </button>
        </div>
        <div class="quiz-list">
          <div
            v-for="([question, answer], index) in quizAnswers[state.quizTab]"
            :key="`${state.quizTab}-${index}`"
            class="quiz-row"
          >
            <span>{{ index + 1 }}</span>
            <p>{{ question }}</p>
            <strong>{{ answer }}</strong>
          </div>
        </div>
      </div>
    </div>
    <div v-html="mobilePickHtml"></div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, watch } from "vue";
import equipmentUrl from "./data/equipment.catalog.json?url";
import recipesUrl from "./data/recipes.catalog.json?url";
import refiningUrl from "./data/refining-rules.catalog.json?url";
import { quizAnswers } from "./data/quiz";
import type { Equipment, Output, Recipe, RefiningGroup, RefiningRule } from "./types";

const itemDisplayNameOverrides: Record<string, string> = {
  I05N: "罪神之枪A",
  I061: "罪神之枪S",
};

let allEquipment: Equipment[] = [];
let equipment: Equipment[] = [];
let recipes: Recipe[] = [];
let refiningRules: RefiningRule[] = [];

const gradeInfo = {
  G: { label: "白色 G", color: "#8d8d93" },
  F: { label: "绿色 F", color: "#44a75d" },
  E: { label: "天青 E", color: "#27a7c2" },
  D: { label: "黄色 D", color: "#d29a18" },
  C: { label: "红色 C", color: "#d94848" },
  B: { label: "紫色 B", color: "#8d55e6" },
  A: { label: "粉色 A", color: "#d94f9b" },
  S: { label: "暗金 S", color: "#aa761d" },
} as const;

const gradeOrder = ["S", "A", "B", "C", "D", "E", "F", "G"] as const;
const levelToGrade: Record<number, keyof typeof gradeInfo> = { 1: "G", 2: "F", 3: "E", 4: "D", 5: "C", 6: "B", 7: "A", 8: "S" };
const hotTags = ["梵天纹章", "天皇祭冠", "古代神铠", "奥姆幽刃", "雾幻云珠", "谛听天镯", "千棱幻玉", "银河幻星鞋", "炽凰天衣", "北斗炼日印"];
const quizTabs = Object.keys(quizAnswers) as Array<keyof typeof quizAnswers>;
const refiningAttributes = ["全能", "力量", "敏捷", "智力"] as const;
const equipmentSlots = ["衣服", "鞋子", "武器", "饰品"] as const;
const deprecatedItemIds = new Set(["I04M", "I04U"]);
const currentYear = new Date().getFullYear();
const initialCatalogLimit = 12;
const catalogLimitStep = 48;
const lazyImagePlaceholder = "data:image/gif;base64,R0lGODlhAQABAAAAACw=";
const itemTypeToClass: Record<string, string> = {
  ITEM_TYPE_PERMANENT: "Permanent",
  ITEM_TYPE_PURCHASABLE: "Purchasable",
  ITEM_TYPE_ARTIFACT: "Artifact",
  ITEM_TYPE_CAMPAIGN: "Campaign",
};

const itemById = new Map<string, Equipment>();
const itemByName = new Map<string, Equipment>();

type State = {
  nameQuery: string;
  refiningAttribute: string;
  equipmentSlot: string;
  grade: string;
  searchHistory: string[];
  mobileSearchPopoverOpen: boolean;
  filtersOpen: boolean;
  selectedItemId: string;
  assistantTarget: string;
  assistantMain: string;
  assistantMaterial: string;
  quizOpen: boolean;
  quizTab: keyof typeof quizAnswers;
  simOpen: boolean;
  mobilePickItemId: string;
  showToTop: boolean;
  isMobileLayout: boolean;
  isDrawerLayout: boolean;
  theme: Theme;
  dataVersion: number;
  routeDataLoaded: boolean;
  visibleLimit: number;
};

type Theme = "classic" | "mono";

const state = reactive<State>({
  nameQuery: "",
  refiningAttribute: "",
  equipmentSlot: "",
  grade: "",
  searchHistory: [],
  mobileSearchPopoverOpen: false,
  filtersOpen: false,
  selectedItemId: "",
  assistantTarget: "",
  assistantMain: "",
  assistantMaterial: "",
  quizOpen: false,
  quizTab: "普通",
  simOpen: false,
  mobilePickItemId: "",
  showToTop: false,
  isMobileLayout: false,
  isDrawerLayout: false,
  theme: "classic",
  dataVersion: 0,
  routeDataLoaded: false,
  visibleLimit: initialCatalogLimit,
});

const themeStorageKey = "war3rpg-theme";
const searchHistoryStorageKey = "war3rpg-search-history";
let composing = false;
let lockedScrollY = 0;
let activeToken: HTMLElement | undefined;
let lazyImageObserver: IntersectionObserver | undefined;
let catalogMoreObserver: IntersectionObserver | undefined;
let routeDataPromise: Promise<void> | undefined;
let routeDataTimer = 0;
let tokenPopoverFrame = 0;
let pendingTokenTarget: EventTarget | Element | null = null;
function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[char] ?? char);
}

function renderIcon(name: string, className = "ui-icon") {
  const icons: Record<string, string> = {
    arrow_upward: '<path d="M12 19V5" /><path d="m5 12 7-7 7 7" />',
    close: '<path d="M18 6 6 18" /><path d="m6 6 12 12" />',
    expand_more: '<path d="m6 9 6 6 6-6" />',
    keyboard_arrow_left: '<path d="m15 18-6-6 6-6" />',
    mail: '<path d="M4 6h16v12H4z" /><path d="m4 7 8 6 8-6" />',
    swap_vert: '<path d="M7 7h10" /><path d="m14 4 3 3-3 3" /><path d="M17 17H7" /><path d="m10 14-3 3 3 3" />',
  };
  return `<svg class="${className}" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${icons[name] || ""}</svg>`;
}

function readJson<T>(url: string) {
  return fetch(url).then(response => response.json() as Promise<T>);
}

async function loadCatalogData() {
  const equipmentData = await readJson<{ items: Equipment[] }>(equipmentUrl);

  allEquipment = equipmentData.items;
  equipment = dedupeCatalogItems(allEquipment);
  rebuildCatalogIndexes();
  state.dataVersion += 1;
  scheduleRouteDataLoad();
}

function ensureRouteData() {
  if (state.routeDataLoaded) return routeDataPromise || Promise.resolve();
  window.clearTimeout(routeDataTimer);
  routeDataPromise ||= Promise.all([
    readJson<{ recipes: Recipe[] }>(recipesUrl),
    readJson<{ rules: RefiningRule[] }>(refiningUrl),
  ]).then(([recipesData, refiningData]) => {
    recipes = recipesData.recipes;
    refiningRules = refiningData.rules;
    state.routeDataLoaded = true;
    state.dataVersion += 1;
  });
  return routeDataPromise;
}

function scheduleRouteDataLoad() {
  window.clearTimeout(routeDataTimer);
  routeDataTimer = window.setTimeout(() => {
    ensureRouteData().catch(error => {
      console.error("Failed to load route data", error);
    });
  }, 2500);
}

function rebuildCatalogIndexes() {
  itemById.clear();
  itemByName.clear();
  for (const item of allEquipment) itemById.set(item.id, item);
  for (const item of equipment) {
    for (const name of itemAliases(item)) {
      if (!itemByName.has(name)) itemByName.set(name, item);
    }
  }
}

function cleanGameText(value = "") {
  return value
    .replace(/\|[cC][0-9a-fA-F]{8}/g, "")
    .replace(/\|[rR]/g, "")
    .replace(/\|n/g, "\n")
    .replace(/\r/g, "")
    .trim();
}

function dedupeCatalogItems(items: Equipment[]) {
  const seen = new Set<string>();
  return items.filter(item => {
    const key = itemName(item);
    if (!key) return true;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function normalize(value: string) {
  return cleanGameText(value).trim().toLocaleLowerCase("zh-CN");
}

function normalizeForSearch(value: string) {
  return normalize(value)
    .replaceAll("首饰", "饰品")
    .replaceAll("其他", "全能")
    .replaceAll("法武", "法师武器")
    .replaceAll("战武", "非法师武器")
    .replaceAll("非法武", "非法师武器");
}

function assetUrl(path?: string) {
  return path ? `/assets/${path.replaceAll("\\", "/")}` : "";
}

function iconUrl(item: Equipment) {
  return assetUrl(item.icon?.realesrganX4 || item.icon?.png128 || item.icon?.png);
}

function thumbnailUrl(item: Equipment) {
  const source = item.icon?.realesrganX4 || item.icon?.png128 || item.icon?.png;
  const normalizedSource = source?.replaceAll("\\", "/");
  const thumb = normalizedSource?.replace("icons/jpg-128/", "icons/jpg-64/");
  return assetUrl(thumb || normalizedSource);
}

function renderLazyImage(className: string, classicSrc: string, alt: string, monoSrc = classicSrc) {
  return `<img class="${className} lazy-image" src="${lazyImagePlaceholder}" data-src-classic="${escapeHtml(classicSrc)}" data-src-mono="${escapeHtml(monoSrc)}" alt="${escapeHtml(alt)}" loading="lazy" decoding="async" />`;
}

function rawItemName(item: Equipment) {
  return cleanGameText(item.name);
}

function itemName(item: Equipment) {
  return itemDisplayNameOverrides[item.id] || rawItemName(item);
}

function itemAliases(item: Equipment) {
  return Array.from(new Set([itemName(item), rawItemName(item), item.id].filter(Boolean)));
}

function baseGrade(level = "") {
  const match = cleanGameText(level).match(/[SGFEDCBA]/i);
  return match ? match[0].toUpperCase() : "";
}

function gradeClass(level = "") {
  const grade = baseGrade(level).toLowerCase();
  return grade ? `grade-${grade}` : "grade-unknown";
}

function itemDisplayGrade(item: Equipment) {
  return cleanGameText(item.level || item.refining?.displayLevel || "未知");
}

function displayRefiningLabel(label = "") {
  return cleanGameText(label).replaceAll("非法师武器", "战士武器");
}

function itemCategoryLabel(item: Equipment) {
  return displayRefiningLabel(item.refining?.label || item.kind || "未分类");
}

function itemStatusLabel(item: Equipment) {
  return deprecatedItemIds.has(item.id) ? " · 已废弃" : "";
}

function levelValueForItem(item: Equipment) {
  return item.refining?.itemLevel || Number(Object.entries(levelToGrade).find(([, grade]) => grade === baseGrade(item.level))?.[0] || 0);
}

function outputLabel(output: Output) {
  if (output.kind === "fixed") {
    const item = output.id ? itemById.get(output.id) : undefined;
    return item ? itemName(item) : cleanGameText(output.name || output.id || output.expression);
  }
  const level = output.levelExpression?.replace("Uc[120]", "主物品等级") || "?";
  return `${level}级随机池`;
}

function materialLabel(input: { name: string; id?: string; quantity?: number }) {
  const item = input.id ? itemById.get(input.id) : undefined;
  const name = item ? itemName(item) : displayRefiningLabel(input.name || input.id || "");
  return `${name}${(input.quantity || 1) > 1 ? ` x${input.quantity}` : ""}`;
}

function renderItemLink(name: string, className = "item-link") {
  const clean = cleanGameText(name);
  return `<button class="${className}" type="button" data-item-name="${escapeHtml(clean)}">${escapeHtml(clean)}</button>`;
}

function renderGearTag(item: Equipment, label = itemName(item)) {
  const clean = cleanGameText(label);
  return `
    <button class="gear-tag ${gradeClass(item.level)}" type="button" data-draggable-item data-item-id="${escapeHtml(item.id)}" data-item-name="${escapeHtml(itemName(item))}" draggable="true">
      ${escapeHtml(clean)}
      <small>${escapeHtml(tagLabelForItem(item))}</small>
    </button>
  `;
}

type ProbabilityBranch = NonNullable<RefiningRule["probabilityBranches"]>[number];

const canghuanChihuangOverlapRuleId = "dynamic-refining-15";
const yinheCanghuanOverlapRuleId = "dynamic-refining-5";
const canghuanJieyiId = "I00S";
const chihuangTianyiId = "I00R";
const yinheHuanxingxieId = "I01C";
const jiaohuangJinpaoId = "I00O";
type BranchContext = NonNullable<ProbabilityBranch["context"]>;
type DynamicSourceMatch = {
  rule: RefiningRule;
  branch: ProbabilityBranch;
  probability: number;
  mainLevel: number;
  materialGroup?: RefiningGroup;
};

function outputLevelOffset(output: Output) {
  const relative = output.levelExpression?.match(/^Uc\[120\](?:([+-])(\d+))?$/);
  if (!relative) return undefined;
  return relative[1] === "-" ? -Number(relative[2] || 0) : Number(relative[2] || 0);
}

function mainLevelForOutputTarget(output: Output, item: Equipment, context?: BranchContext) {
  if (context?.mainItemLevel?.value) return context.mainItemLevel.value;
  const offset = outputLevelOffset(output);
  if (offset == null) return undefined;
  const mainLevel = levelValueForItem(item) - offset;
  return mainLevel >= 1 && mainLevel <= 8 ? mainLevel : undefined;
}

function levelsForOutput(output: Output, context?: BranchContext, mainLevelOverride?: number) {
  if (output.kind !== "random-pool") return [];
  const expression = output.levelExpression || "";
  const numeric = expression.match(/^\d+$/);
  if (numeric) return [Number(numeric[0])].filter(level => level >= 1 && level <= 8);

  const offset = outputLevelOffset(output);
  const mainLevel = mainLevelOverride || context?.mainItemLevel?.value || 0;
  if (offset == null || !mainLevel) return [];
  return [mainLevel + offset].filter(level => level >= 1 && level <= 8);
}

function sortEquipment(a: Equipment, b: Equipment) {
  return gradeOrder.indexOf(baseGrade(b.level) as keyof typeof gradeInfo) - gradeOrder.indexOf(baseGrade(a.level) as keyof typeof gradeInfo)
    || itemName(a).localeCompare(itemName(b), "zh-CN");
}

function randomPoolCandidates(output: Output, context?: BranchContext, mainLevelOverride?: number) {
  const levels = levelsForOutput(output, context, mainLevelOverride);
  const itemClass = itemTypeToClass[output.itemType || ""];
  return equipment
    .filter(item => item.randomPool)
    .filter(item => levels.includes(levelValueForItem(item)))
    .filter(item => !itemClass || item.class === itemClass)
    .sort(sortEquipment);
}

function outputChanceForItem(output: Output, item: Equipment, context?: BranchContext, chance?: number) {
  if (output.kind === "fixed") {
    return !isBlockedDynamicFixedOutput(output, context) && outputMatchesItem(output, item) ? chance : undefined;
  }
  const candidates = randomPoolCandidates(output, context, mainLevelForOutputTarget(output, item, context));
  if (!candidates.some(candidate => candidate.id === item.id)) return undefined;
  return chance == null ? undefined : Number((chance / candidates.length).toFixed(4));
}

function isBlockedDynamicFixedOutput(output: Output, context?: BranchContext) {
  return output.id === "I00A"
    && context?.levelDifference?.code === "same-level"
    && context?.mainItemLevel?.value === 8;
}

function dynamicOutputEligible(output: Output, context?: BranchContext, mainLevelOverride?: number) {
  if (output.kind === "random-pool") return randomPoolCandidates(output, context, mainLevelOverride).length > 0;
  const item = output.id ? itemById.get(output.id) : readItemByName(outputLabel(output));
  return Boolean(item && !isBlockedDynamicFixedOutput(output, context));
}

function renderTokenItems(items: Equipment[], chance?: number) {
  return items.map(item => `
    <span class="token-choice">
      ${renderGearTag(item)}
      ${chance == null ? "" : renderProbability(chance)}
    </span>
  `).join("");
}

function renderTokenHint() {
  return `
    <span class="token-hint token-hint-desktop">将可选装备拖入继续查询</span>
    <span class="token-hint token-hint-mobile">长按可选装备继续查询</span>
  `;
}

function renderRandomPoolToken(output: Output, context?: BranchContext, chance?: number, mainLevelOverride?: number) {
  const candidates = randomPoolCandidates(output, context, mainLevelOverride);
  const itemChance = chance == null || !candidates.length ? undefined : Number((chance / candidates.length).toFixed(4));
  const label = outputLabel(output);
  const chanceText = itemChance == null ? "" : `，每件约 ${Number.isInteger(itemChance) ? itemChance : itemChance.toFixed(4).replace(/0+$/, "").replace(/\.$/, "")}%`;
  return `
    <span class="route-token pool-token" tabindex="0">
      ${escapeHtml(label)}
      <span class="token-popover">
        <strong>${escapeHtml(label)} 可选项</strong>
        <span>${candidates.length ? `共 ${candidates.length} 件${chanceText}` : "没有匹配装备"}</span>
        <span class="token-items">
          ${renderTokenItems(candidates, itemChance) || "<em>没有匹配装备</em>"}
        </span>
        ${candidates.length ? renderTokenHint() : ""}
      </span>
    </span>
  `;
}

function renderOutputLink(output: Output, context?: BranchContext, chance?: number, mainLevelOverride?: number) {
  if (output.kind === "random-pool") return renderRandomPoolToken(output, context, chance, mainLevelOverride);
  return renderFormulaItem(outputLabel(output));
}

function tagLabelForItem(item: Equipment) {
  return `${baseGrade(item.level)}${groupShortLabel({
    label: item.refining?.label || "",
    hpValues: item.refining?.hp ? [item.refining.hp] : [],
    slots: item.refining?.slot ? [item.refining.slot] : [],
    attributes: item.refining?.attribute ? [item.refining.attribute] : [],
    names: item.refining?.label ? [item.refining.label] : [],
    bySlot: {},
    byAttribute: {},
    unknownHpValues: [],
  })}`;
}

function renderFormulaItem(name: string) {
  const clean = cleanGameText(name);
  const item = itemByName.get(clean.replace(/\s+x\d+$/i, ""));
  if (!item) return renderItemLink(clean);
  return renderGearTag(item, clean);
}

function probabilityClass(value?: number) {
  if (value == null) return "rate-muted";
  if (value === 100) return "rate-100";
  if (value >= 75) return "rate-high";
  if (value >= 50) return "rate-mid";
  if (value >= 25) return "rate-low";
  return "rate-very-low";
}

function renderProbability(value?: number) {
  if (value == null) return "";
  return `<span class="probability ${probabilityClass(value)}">${Number.isInteger(value) ? value : value.toFixed(4).replace(/0+$/, "").replace(/\.$/, "")}%</span>`;
}

function compactHtmlText(html = "") {
  return html
    .replace(/<small[\s\S]*?<\/small>/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isAttributeLine(line: string) {
  return /^(攻击力|力量|敏捷|智力|生命上限|魔法上限|生命恢复|魔法恢复|法术抗性|护甲|攻击速度|移动速度|全能力|闪避|格挡|暴击伤害)[^\n]*[+\-]\d/.test(cleanGameText(line));
}

function isSystemLine(line: string) {
  return /^等级[:：]/.test(line) || /^ID\b/.test(line) || /^源码行/.test(line);
}

function splitDescription(item: Equipment) {
  const rawLines = cleanGameText(item.description).split("\n");
  const attributes: string[] = [];
  const effects: string[] = [];
  const exclusive: string[] = [];
  const lore: string[] = [];
  let currentExclusive = "";
  let afterBlank = false;

  for (const rawLine of rawLines) {
    const line = cleanGameText(rawLine);
    if (!line) {
      afterBlank = true;
      continue;
    }
    if (isSystemLine(line)) continue;
    if (afterBlank) {
      lore.push(line);
      continue;
    }
    if (line.includes("专属：")) {
      if (currentExclusive) exclusive.push(currentExclusive);
      currentExclusive = line;
      continue;
    }
    if (currentExclusive) {
      currentExclusive += ` ${line}`;
      continue;
    }
    if (isAttributeLine(line)) attributes.push(line);
    else effects.push(line);
  }

  if (currentExclusive) exclusive.push(currentExclusive);
  return { attributes, effects, exclusive, lore };
}

function renderAttributeEffects(item: Equipment, compact = false) {
  const parsed = splitDescription(item);
  const attributes = parsed.attributes.slice(0, compact ? 4 : 24);
  const exclusive = parsed.exclusive.slice(0, compact ? 1 : 24);
  const effects = parsed.effects.slice(0, compact ? 2 : 24);
  return `
    <div class="attribute-list">
      ${attributes.map(line => `<span class="attribute-chip">${escapeHtml(line)}</span>`).join("") || `<span class="attribute-chip muted">暂无属性数值</span>`}
    </div>
    <div class="effect-list">
      ${exclusive.map(line => `<span class="exclusive-chip">${escapeHtml(line)}</span>`).join("")}
      ${effects.map(line => `<span class="effect-chip">${escapeHtml(line)}</span>`).join("") || (!exclusive.length ? `<span class="effect-chip muted">暂无效果说明</span>` : "")}
    </div>
  `;
}

function readItemByName(name: string) {
  const clean = cleanGameText(name);
  if (!clean) return undefined;
  const exact = itemByName.get(clean);
  if (exact) return exact;
  const needle = normalize(clean);
  return equipment.find(item => itemAliases(item).some(alias => normalize(alias).includes(needle)));
}

function outputMatchesItem(output: Output, item: Equipment) {
  const name = outputLabel(output);
  return output.kind === "fixed" && (output.id === item.id || name === itemName(item));
}

function outputMatchesName(output: Output, name: string) {
  return outputLabel(output) === cleanGameText(name);
}

function groupShortLabel(group: RefiningGroup | undefined, role: "main" | "material" = "main") {
  if (!group) return "分类";
  if (role === "material" && group.attributes.length === 1 && group.label.includes("非法师武器")) return `${group.attributes[0]}/战武`;
  if (role === "material" && group.attributes.length === 1 && group.label.includes("法师武器")) return `${group.attributes[0]}/法武`;
  if (role === "material" && group.attributes.length === 1 && group.attributes[0] !== "全能") return group.attributes[0];
  if (group.label.includes("全能型武器") && group.slots.length > 1 && group.attributes.length === 1) return "全能武/饰/衣/鞋";
  if (group.label.includes("全能型武器") && group.label.includes("非法师武器")) return "全能武/战武";
  if (group.label.includes("非法师武器")) return "战武";
  if (group.label.includes("法师武器")) return "法武";
  if (group.label.includes("全能型武器")) return "全能武";
  if (role === "material" && group.attributes.length > 1 && group.attributes.length < refiningAttributes.length) return group.attributes.join("/");
  if (group.attributes.length === 1 && group.attributes[0] !== "全能") return group.attributes[0];
  if (group.slots.length === 1 && group.attributes.length > 1) return group.slots[0];
  if (group.attributes.length === 1) return group.attributes[0];
  if (group.slots.length === 1) return group.slots[0];
  return "任意";
}

function materialLevels(mainLevel: number, code?: string) {
  if (!mainLevel) return [];
  if (code === "same-level") return [mainLevel];
  if (code === "material-higher-by-1") return [mainLevel + 1].filter(level => level <= 8);
  if (code === "material-higher-by-2-plus") return [mainLevel + 2, mainLevel + 3, mainLevel + 4].filter(level => level <= 8);
  if (code === "main-higher-by-1-to-2") return [mainLevel - 1, mainLevel - 2].filter(level => level >= 1);
  if (code === "main-higher-by-3-plus") return [mainLevel - 3, mainLevel - 4, mainLevel - 5, mainLevel - 6, mainLevel - 7].filter(level => level >= 1);
  return [];
}

function gradeTextFromLevels(levels: number[]) {
  const grades = Array.from(new Set(levels.map(level => levelToGrade[level]).filter(Boolean)));
  return grades.length === 1 ? grades[0] : grades.join("/");
}

function groupCandidates(group: RefiningGroup | undefined, levels: number[], excludedItemIds = new Set<string>()) {
  const hpValues = new Set(group?.hpValues || []);
  return equipment
    .filter(item => hpValues.has(Number(item.refining?.hp)))
    .filter(item => !levels.length || levels.includes(levelValueForItem(item)))
    .filter(item => !excludedItemIds.has(item.id))
    .sort(sortEquipment);
}

function itemRefiningGroup(items: Equipment[], label: string): RefiningGroup {
  const entries = items
    .map(item => item.refining)
    .filter((refining): refining is NonNullable<Equipment["refining"]> => Boolean(refining?.hp));
  const hpValues = Array.from(new Set(entries.map(entry => entry.hp))).sort((a, b) => a - b);
  const slots = equipmentSlots.filter(slot => entries.some(entry => entry.slot === slot));
  const attributes = refiningAttributes.filter(attribute => entries.some(entry => entry.attribute === attribute));
  return {
    label,
    hpValues,
    slots,
    attributes,
    names: Array.from(new Set(entries.map(entry => entry.label).filter(Boolean))),
    bySlot: Object.fromEntries(slots.map(slot => [
      slot,
      refiningAttributes.filter(attribute => entries.some(entry => entry.slot === slot && entry.attribute === attribute)),
    ])),
    byAttribute: Object.fromEntries(attributes.map(attribute => [
      attribute,
      equipmentSlots.filter(slot => entries.some(entry => entry.attribute === attribute && entry.slot === slot)),
    ])),
    unknownHpValues: [],
  };
}

function allMaterialCandidates(levels: number[], excludedItemIds = new Set<string>()) {
  return equipment
    .filter(item => item.refining?.slot && item.refining?.attribute)
    .filter(item => !levels.length || levels.includes(levelValueForItem(item)))
    .filter(item => !excludedItemIds.has(item.id))
    .sort(sortEquipment);
}

function combinedMaterialGroup(matches: DynamicSourceMatch[]) {
  if (matches.length < 2) return undefined;
  const first = matches[0];
  const diffCode = first.branch.context?.levelDifference?.code;
  const materialLevelList = materialLevels(first.mainLevel, diffCode);
  if (!materialLevelList.length) return undefined;
  const excludedItemIds = new Set((first.rule.requiredItems || []).map(item => item.id));
  const allCandidates = allMaterialCandidates(materialLevelList, excludedItemIds);
  if (!allCandidates.length) return undefined;
  const coveredIds = new Set(matches.flatMap(match =>
    groupCandidates(match.rule.readable?.material, materialLevelList, excludedItemIds).map(item => item.id),
  ));
  return allCandidates.every(item => coveredIds.has(item.id))
    ? itemRefiningGroup(allCandidates, "任意装备 · 任意炼化属性")
    : undefined;
}

function dynamicMatchKey(match: DynamicSourceMatch) {
  return JSON.stringify({
    probability: match.probability,
    mainLevel: match.mainLevel,
    diffCode: match.branch.context?.levelDifference?.code || "",
    mainHpValues: match.rule.readable?.main.hpValues || [],
  });
}

function mergeDynamicMatches(matches: DynamicSourceMatch[]) {
  const groups = new Map<string, DynamicSourceMatch[]>();
  for (const match of matches) {
    const key = dynamicMatchKey(match);
    groups.set(key, [...(groups.get(key) || []), match]);
  }

  const merged: DynamicSourceMatch[] = [];
  for (const group of groups.values()) {
    const materialGroup = combinedMaterialGroup(group);
    if (materialGroup) {
      merged.push({ ...group[0], materialGroup });
    } else {
      merged.push(...group);
    }
  }
  return merged;
}

function renderGroupToken(label: string, group: RefiningGroup | undefined, levels: number[], excludedItemIds = new Set<string>()) {
  const candidates = groupCandidates(group, levels, excludedItemIds);
  return `
    <span class="route-token" tabindex="0">
      ${escapeHtml(label)}
      <span class="token-popover">
        <strong>${escapeHtml(label)} 可选项</strong>
        <span>${escapeHtml(displayRefiningLabel(group?.label || "未分类"))}</span>
        <span class="token-items">
          ${renderTokenItems(candidates) || "<em>没有匹配装备</em>"}
        </span>
        ${candidates.length ? renderTokenHint() : ""}
      </span>
    </span>
  `;
}

function isCanghuanChihuangOverlapBranch(rule: RefiningRule, branch: ProbabilityBranch) {
  return rule.id === canghuanChihuangOverlapRuleId
    && branch.context?.levelDifference?.code === "same-level"
    && branch.context?.mainItemLevel?.value === 8;
}

function isYinheCanghuanOverlapBranch(rule: RefiningRule, branch: ProbabilityBranch) {
  return rule.id === yinheCanghuanOverlapRuleId
    && branch.context?.levelDifference?.code === "same-level"
    && branch.context?.mainItemLevel?.value === 8;
}

function exactMainItemForOverlapTarget(rule: RefiningRule, branch: ProbabilityBranch, target: Equipment) {
  if (!isCanghuanChihuangOverlapBranch(rule, branch)) return undefined;
  if (target.id !== canghuanJieyiId) return undefined;
  return itemById.get(chihuangTianyiId);
}

function excludedMainItemsForOverlapTarget(rule: RefiningRule, branch: ProbabilityBranch, target: Equipment) {
  if (!isCanghuanChihuangOverlapBranch(rule, branch)) return new Set<string>();
  if (target.id !== chihuangTianyiId) return new Set<string>();
  return new Set<string>([chihuangTianyiId]);
}

function exactMaterialItemForOverlapTarget(rule: RefiningRule, branch: ProbabilityBranch, target: Equipment) {
  if (!isYinheCanghuanOverlapBranch(rule, branch)) return undefined;
  if (target.id !== yinheHuanxingxieId) return undefined;
  return itemById.get(jiaohuangJinpaoId);
}

function excludedMaterialItemsForOverlapTarget(rule: RefiningRule, branch: ProbabilityBranch, target: Equipment) {
  if (!isYinheCanghuanOverlapBranch(rule, branch)) return new Set<string>();
  if (target.id !== canghuanJieyiId) return new Set<string>();
  return new Set<string>([jiaohuangJinpaoId]);
}

function mainTokenLabel(rule: RefiningRule, branch: ProbabilityBranch, target: Equipment, mainLevels: number[]) {
  const exactMainItem = exactMainItemForOverlapTarget(rule, branch, target);
  if (exactMainItem) return itemName(exactMainItem);
  const baseLabel = `${gradeTextFromLevels(mainLevels)}${groupShortLabel(rule.readable?.main, "main")}`;
  return excludedMainItemsForOverlapTarget(rule, branch, target).size ? `${baseLabel}（不含炽凰天衣）` : baseLabel;
}

function materialTokenLabel(rule: RefiningRule, branch: ProbabilityBranch, target: Equipment, materialLevels: number[], materialGroup: RefiningGroup | undefined) {
  const exactMaterialItem = exactMaterialItemForOverlapTarget(rule, branch, target);
  if (exactMaterialItem) return itemName(exactMaterialItem);
  const baseLabel = `${gradeTextFromLevels(materialLevels)}${groupShortLabel(materialGroup, "material")}`;
  return excludedMaterialItemsForOverlapTarget(rule, branch, target).size ? `${baseLabel}（不含教皇禁袍）` : baseLabel;
}

function renderDynamicFormula(rule: RefiningRule, branch: ProbabilityBranch, target: Equipment, chance?: number, mainLevelOverride?: number, materialGroupOverride?: RefiningGroup) {
  const mainLevel = branch.context?.mainItemLevel?.value || mainLevelOverride || 0;
  const diffCode = branch.context?.levelDifference?.code;
  const mainLevels = mainLevel ? [mainLevel] : [];
  const materialLevelList = materialLevels(mainLevel, diffCode);
  const materialGroup = materialGroupOverride || rule.readable?.material;
  const exactMainItem = exactMainItemForOverlapTarget(rule, branch, target);
  const excludedMainItemIds = excludedMainItemsForOverlapTarget(rule, branch, target);
  const exactMaterialItem = exactMaterialItemForOverlapTarget(rule, branch, target);
  const excludedMaterialItemIds = excludedMaterialItemsForOverlapTarget(rule, branch, target);
  const mainToken = mainTokenLabel(rule, branch, target, mainLevels);
  const materialToken = materialTokenLabel(rule, branch, target, materialLevelList, materialGroup);
  const blockedItemIds = new Set([
    ...((rule.requiredItems || []).map(item => item.id)),
    ...excludedMainItemIds,
    ...excludedMaterialItemIds,
  ]);
  return `
    <span class="formula-line">
      ${renderFormulaItem(itemName(target))}
      <span class="formula-eq">=</span>
      ${exactMainItem ? renderFormulaItem(itemName(exactMainItem)) : renderGroupToken(mainToken, rule.readable?.main, mainLevels, blockedItemIds)}
      <span class="formula-plus">+</span>
      ${exactMaterialItem ? renderFormulaItem(itemName(exactMaterialItem)) : renderGroupToken(materialToken, materialGroup, materialLevelList, blockedItemIds)}
    </span>
  `;
}

function dynamicFormulaText(rule: RefiningRule, branch: ProbabilityBranch, target: Equipment, chance?: number, mainLevelOverride?: number, materialGroupOverride?: RefiningGroup) {
  const mainLevel = branch.context?.mainItemLevel?.value || mainLevelOverride || 0;
  const diffCode = branch.context?.levelDifference?.code;
  const mainToken = mainTokenLabel(rule, branch, target, mainLevel ? [mainLevel] : []);
  const materialToken = materialTokenLabel(
    rule,
    branch,
    target,
    materialLevels(mainLevel, diffCode),
    materialGroupOverride || rule.readable?.material,
  );
  return `${itemName(target)} = ${mainToken} + ${materialToken}${chance != null ? ` ${Number.isInteger(chance) ? chance : chance.toFixed(2)}%` : ""}`;
}

function isEligibleOverlapSimulationOutput(rule: RefiningRule, branch: ProbabilityBranch, output: Output, main: Equipment, material: Equipment) {
  if (output.kind !== "fixed") return true;
  if (isCanghuanChihuangOverlapBranch(rule, branch) && (output.id === canghuanJieyiId || output.id === chihuangTianyiId)) {
    return main.id === chihuangTianyiId ? output.id === canghuanJieyiId : output.id === chihuangTianyiId;
  }
  if (isYinheCanghuanOverlapBranch(rule, branch) && (output.id === yinheHuanxingxieId || output.id === canghuanJieyiId)) {
    return material.id === jiaohuangJinpaoId ? output.id === yinheHuanxingxieId : output.id === canghuanJieyiId;
  }
  return true;
}

function dynamicRuleBlockedItemIds(rule: RefiningRule) {
  return new Set((rule.requiredItems || []).map(item => item.id));
}

function isAllowedDynamicSelection(rule: RefiningRule, main: Equipment, material: Equipment) {
  const blockedItemIds = dynamicRuleBlockedItemIds(rule);
  return !blockedItemIds.has(main.id) && !blockedItemIds.has(material.id);
}

function recipeSources(item: Equipment) {
  return recipes
    .filter(recipe => recipe.result.id === item.id || cleanGameText(recipe.result.name) === itemName(item))
    .map(recipe => ({
      kind: "recipe",
      title: "合成卷轴",
      probability: 100,
      plain: `${recipe.materials.map(materialLabel).join(" + ")} = ${itemNameById(recipe.result.id)} 100%`,
      html: `<span class="formula-line">${recipe.materials.map(material => renderFormulaItem(materialLabel(material))).join('<span class="formula-plus">+</span>')}<span class="formula-eq">=</span>${renderFormulaItem(itemNameById(recipe.result.id))}</span>`,
    }));
}

function isSynthesisScrollRule(rule: RefiningRule) {
  const output = rule.possibleOutputs.find(output => output.kind === "fixed");
  if (!output) return false;
  return recipes.some(recipe =>
    (recipe.result.id === output.id || cleanGameText(recipe.result.name) === cleanGameText(output.name || ""))
    && requiredInputs(rule).some(input => input.id === recipe.scroll.id),
  );
}

function isPenglaiVariantRule(rule: RefiningRule) {
  return rule.functionName === "BSK" && rule.possibleOutputs.some(output => output.id === "I07X");
}

function itemNameById(id: string) {
  return itemById.get(id) ? itemName(itemById.get(id) as Equipment) : id;
}

function renderPenglaiFormula() {
  const alternatives = ["I07T", "I07W", "I07Y"]
    .map(id => renderFormulaItem(itemNameById(id)))
    .join('<span class="formula-alt-sep">/</span>');
  return `
    <span class="formula-line">
      ${renderFormulaItem(itemNameById("I04I"))}
      <span class="formula-plus">+</span>
      <span class="formula-alternatives">${alternatives}</span>
      <span class="formula-eq">=</span>
      ${renderFormulaItem(itemNameById("I07X"))}
    </span>
  `;
}

function exactSpecialNote(rule: RefiningRule) {
  if (isPenglaiVariantRule(rule)) return "须弥仙人【真】专属炼化：仙气葫芦 / 仙气葫芦+ / 变异葫芦为同一公式的材料变体，共用一次炼化机会。";
  const outputIds = new Set(rule.possibleOutputs.map(output => output.id));
  if (outputIds.has("I06W")) return "工会主席专属炼化，成功后该炼化机会关闭。";
  if (outputIds.has("I077")) return "星月游侠专属炼化，成功后该炼化机会关闭。";
  if (outputIds.has("I07D")) return "灵谷药师专属炼化，成功后该炼化机会关闭。";
  if (outputIds.has("I07E")) return "大队长专属炼化，成功后该炼化机会关闭。";
  if (outputIds.has("I07N")) return "金色魔王专属炼化，成功后该炼化机会关闭。";
  if (outputIds.has("I07U")) return "古代军师【司马懿】皮肤形态专属炼化，成功后该炼化机会关闭。";
  if (outputIds.has("I07S")) return "神蝉侍女【白藤儿】皮肤形态专属炼化，成功后该炼化机会关闭。";
  if (outputIds.has("I083")) return "赤色斗神【兰多夫.奥尔杰】皮肤形态专属炼化，成功后该炼化机会关闭。";
  if (outputIds.has("I07Z") || outputIds.has("I080") || outputIds.has("I07B")) return "特殊一次性炼化，成功后该炼化机会关闭。";
  return "";
}

function renderExactFormula(rule: RefiningRule) {
  if (isPenglaiVariantRule(rule)) return renderPenglaiFormula();
  return `<span class="formula-line">${(rule.requiredItems || []).map(input => renderFormulaItem(materialLabel(input))).join('<span class="formula-plus">+</span>')}<span class="formula-eq">=</span>${rule.possibleOutputs.map(output => renderOutputLink(output)).join(" / ")}</span>`;
}

function exactFormulaPlain(rule: RefiningRule) {
  if (isPenglaiVariantRule(rule)) {
    return `${itemNameById("I04I")} + ${itemNameById("I07T")} / ${itemNameById("I07W")} / ${itemNameById("I07Y")} = ${itemNameById("I07X")} 100%`;
  }
  return `${(rule.requiredItems || []).map(materialLabel).join(" + ")} = ${rule.possibleOutputs.map(outputLabel).join(" / ")} 100%`;
}

function renderExactRoute(rule: RefiningRule, title = "精确炼化", missing: NonNullable<RefiningRule["requiredItems"]> = []) {
  const note = exactSpecialNote(rule);
  return `
    <div class="route-detail exact">
      <div class="route-title"><strong>${escapeHtml(title)}</strong>${renderProbability(100)}</div>
      ${renderExactFormula(rule)}
      ${missing.length ? `<p>还需要：${missing.map(input => renderFormulaItem(materialLabel(input))).join("、")}</p>` : ""}
      ${note ? `<small>${escapeHtml(note)}</small>` : ""}
    </div>
  `;
}

function requiredInputs(rule: RefiningRule) {
  return [
    ...(rule.requiredItems || []),
    ...(rule.requiredItemGroups || []).flatMap(group => group.items),
  ];
}

function missingRequiredInputs(rule: RefiningRule, selected: Set<string>) {
  const missing = (rule.requiredItems || [])
    .filter(input => !selected.has(input.id) && !selected.has(cleanGameText(input.name)));
  const missingGroups = (rule.requiredItemGroups || [])
    .filter(group => !group.items.some(input => selected.has(input.id) || selected.has(cleanGameText(input.name))))
    .map(group => ({
      id: group.label,
      name: group.label,
      expression: group.label,
    }));
  return [...missing, ...missingGroups];
}

function mergeExactDisplayRules(rules: RefiningRule[]) {
  const seenPenglai = rules.some(isPenglaiVariantRule);
  return [
    ...rules.filter(rule => !isPenglaiVariantRule(rule)),
    ...(seenPenglai ? [rules.find(isPenglaiVariantRule) as RefiningRule] : []),
  ];
}

function exactRefiningSources(item: Equipment) {
  const rules = refiningRules
    .filter(rule => rule.type === "exact-refining")
    .filter(rule => !isSynthesisScrollRule(rule))
    .filter(rule => rule.possibleOutputs.some(output => outputMatchesItem(output, item)));
  return mergeExactDisplayRules(rules)
    .map(rule => ({
      kind: "exact",
      title: "精确炼化",
      probability: 100,
      plain: exactFormulaPlain(rule),
      html: `${renderExactFormula(rule)}${exactSpecialNote(rule) ? `<small>${escapeHtml(exactSpecialNote(rule))}</small>` : ""}`,
    }));
}

function dynamicRefiningSources(item: Equipment) {
  const matches: DynamicSourceMatch[] = [];
  const seen = new Set<string>();
  for (const rule of refiningRules.filter(rule => rule.type === "dynamic-refining")) {
    for (const branch of rule.probabilityBranches || []) {
      for (const outcome of branch.outcomes) {
        const inferredMainLevel = outcome.outputs
          .map(output => mainLevelForOutputTarget(output, item, branch.context))
          .find(level => level != null);
        const matchedChance = outcome.outputs
          .map(output => outputChanceForItem(output, item, branch.context, outcome.chancePercent))
          .find(chance => chance != null);
        if (matchedChance == null) continue;
        const key = `${rule.id}:${JSON.stringify(branch.context)}:${matchedChance}:${outcome.outputs.map(outputLabel).join("|")}`;
        if (seen.has(key)) continue;
        seen.add(key);
        matches.push({ rule, branch, probability: matchedChance, mainLevel: inferredMainLevel || branch.context?.mainItemLevel?.value || 0 });
      }
    }
  }
  return mergeDynamicMatches(matches)
    .map(match => ({
      kind: "dynamic",
      title: "动态炼化",
      probability: match.probability,
      plain: dynamicFormulaText(match.rule, match.branch, item, match.probability, match.mainLevel, match.materialGroup),
      html: renderDynamicFormula(match.rule, match.branch, item, match.probability, match.mainLevel, match.materialGroup),
    }))
    .sort((a, b) => (b.probability || 0) - (a.probability || 0));
}

function getSources(item: Equipment) {
  return [...recipeSources(item), ...exactRefiningSources(item), ...dynamicRefiningSources(item)];
}

function fuzzyItems(query: string, limit = 8) {
  const needle = normalize(query);
  if (!needle) return [];
  const searchNeedle = normalizeForSearch(query);
  return equipment
    .map(item => ({ item, names: itemAliases(item).map(normalizeForSearch) }))
    .filter(entry => entry.names.some(name => name.includes(searchNeedle)) || searchableText(entry.item).includes(searchNeedle))
    .slice(0, limit)
    .map(entry => entry.item);
}

function filterItems() {
  const queryNeedle = normalizeForSearch(state.nameQuery);
  return equipment.filter(item => {
    const queryOk = !queryNeedle
      || itemAliases(item).some(name => normalizeForSearch(name).includes(queryNeedle))
      || searchableText(item).includes(queryNeedle);
    const refiningOk = !state.refiningAttribute || item.refining?.attribute === state.refiningAttribute;
    const slotOk = !state.equipmentSlot || item.refining?.slot === state.equipmentSlot;
    const gradeOk = !state.grade || baseGrade(item.level) === state.grade;
    return queryOk && refiningOk && slotOk && gradeOk;
  });
}

function searchableText(item: Equipment, includeRefining = true) {
  const parsed = splitDescription(item);
  const aliases = [
    item.refining?.label,
    displayRefiningLabel(item.refining?.label),
    item.refining?.slot,
    item.refining?.attribute,
    item.refining?.label === "法师武器" ? "法武" : "",
    item.refining?.label === "非法师武器" ? "战武 非法武" : "",
    item.refining?.attribute === "全能" ? "其他" : "",
    item.refining?.slot === "饰品" ? "首饰" : "",
  ];
  return normalizeForSearch([
    itemName(item),
    rawItemName(item),
    ...parsed.attributes,
    ...parsed.effects,
    ...parsed.exclusive,
    item.kind,
    ...(includeRefining ? aliases : []),
  ].join(" "));
}

function renderInput(id: string, label: string, value: string, placeholder: string, stateKey: keyof State, className = "") {
  return `
    <label class="field ${className}">
      <span class="field-label">${label}</span>
      <span class="field-shell">
        <input id="${id}" data-state-key="${String(stateKey)}" value="${escapeHtml(value)}" placeholder="${escapeHtml(placeholder)}" autocomplete="off" />
        ${value ? `<button class="clear-input" type="button" data-clear="${String(stateKey)}" aria-label="清除 ${escapeHtml(label)}">${renderIcon("close")}</button>` : ""}
      </span>
    </label>
  `;
}

function renderSearchHistory() {
  if (!state.searchHistory.length) return "";
  return `
    <div class="search-history">
      <div class="search-popover-head">
        <span>历史</span>
        <button id="clear-search-history" type="button">清空</button>
      </div>
      <div class="search-chip-list">
        ${state.searchHistory.map(query => `<button type="button" data-search-history="${escapeHtml(query)}">${escapeHtml(query)}</button>`).join("")}
      </div>
    </div>
  `;
}

function renderDesktopSearchHistory() {
  const history = renderSearchHistory();
  return history ? `<div class="desktop-search-history">${history}</div>` : "";
}

function renderQuickSearches() {
  return `
    <div class="quick-searches">
      <div class="search-popover-head"><span>快筛</span></div>
      ${renderHotTags()}
    </div>
  `;
}

function renderTopbarSearch() {
  return `
    <label class="topbar-search-field">
      <span class="visually-hidden">模糊查询</span>
      <span class="field-shell">
        <input id="mobile-name-query" data-state-key="nameQuery" value="${escapeHtml(state.nameQuery)}" placeholder="查询装备名/攻速/专属" autocomplete="off" />
        ${state.nameQuery ? `<button class="clear-input" type="button" data-clear="nameQuery" aria-label="清除模糊查询">${renderIcon("close")}</button>` : ""}
      </span>
    </label>
    <div class="mobile-search-popover">
      ${renderSearchHistory()}
      ${renderQuickSearches()}
    </div>
  `;
}

function mobileFilterLabel(label: string, value: string) {
  return escapeHtml(value || label);
}

function renderMobileFilterBar() {
  return `
    <div class="mobile-filter-bar">
      <button class="mobile-filter-chip ${state.refiningAttribute ? "active" : ""}" type="button" data-open-filters aria-label="筛选属性">${mobileFilterLabel("属性", state.refiningAttribute)}</button>
      <button class="mobile-filter-chip ${state.equipmentSlot ? "active" : ""}" type="button" data-open-filters aria-label="筛选类别">${mobileFilterLabel("类别", state.equipmentSlot)}</button>
      <button class="mobile-filter-chip ${state.grade ? "active" : ""}" type="button" data-open-filters aria-label="筛选品级">${mobileFilterLabel("品级", state.grade)}</button>
      <button id="toggle-filters" class="filter-toggle mobile-filter-toggle" type="button">${state.filtersOpen ? "收起" : "筛选"}</button>
    </div>
  `;
}

function renderFilterSheet() {
  return `
    <div class="filter-sheet-head">
      <div>
        <span class="category">Filters</span>
        <h2>筛选条件</h2>
      </div>
      <button class="icon-button" id="close-filter-sheet" type="button" aria-label="关闭筛选">${renderIcon("close")}</button>
    </div>
    <div class="filter-sheet-body">
      <div class="field">
        <span>炼化属性</span>
        ${renderRefiningAttributeFilters()}
      </div>
      <div class="field">
        <span>装备类别</span>
        ${renderEquipmentSlotFilters()}
      </div>
      <div class="field">
        <span>装备品级</span>
        ${renderGradeFilters()}
      </div>
    </div>
    <div class="filter-sheet-actions">
      <button id="reset-filters" class="reset-button" type="button">重置筛选</button>
      <button id="apply-filter-sheet" class="filter-sheet-done" type="button">完成</button>
    </div>
  `;
}

function renderGradeFilters() {
  return `
    <div class="grade-filter" role="group" aria-label="品级查询">
      <button class="grade-pill ${state.grade ? "" : "active"}" type="button" data-grade="">全部</button>
      ${gradeOrder.map(grade => `
        <button class="grade-pill grade-${grade.toLowerCase()} ${state.grade === grade ? "active" : ""}" type="button" data-grade="${grade}">
          <span>${grade}</span>
        </button>
      `).join("")}
    </div>
  `;
}

function renderRefiningAttributeFilters() {
  return `
    <div class="refining-filter" role="group" aria-label="炼化属性">
      <button class="grade-pill ${state.refiningAttribute ? "" : "active"}" type="button" data-refining-attribute="">全部</button>
      ${refiningAttributes.map(attribute => `
        <button class="grade-pill ${state.refiningAttribute === attribute ? "active" : ""}" type="button" data-refining-attribute="${attribute}">
          <span>${attribute}</span>
        </button>
      `).join("")}
    </div>
  `;
}

function renderEquipmentSlotFilters() {
  return `
    <div class="slot-filter" role="group" aria-label="装备类别">
      <button class="grade-pill ${state.equipmentSlot ? "" : "active"}" type="button" data-equipment-slot="">全部</button>
      ${equipmentSlots.map(slot => `
        <button class="grade-pill ${state.equipmentSlot === slot ? "active" : ""}" type="button" data-equipment-slot="${slot}">
          <span>${slot}</span>
        </button>
      `).join("")}
    </div>
  `;
}

function renderHotTags() {
  return `<div class="hot-tags">${hotTags.map(tag => `<button type="button" data-hot-tag="${escapeHtml(tag)}">${escapeHtml(tag)}</button>`).join("")}</div>`;
}

function renderFuzzySuggestions(query: string, target: "assistantTarget" | "assistantMain" | "assistantMaterial") {
  const hits = fuzzyItems(query, 7);
  if (!query || !hits.length) return "";
  return `
    <div class="suggestions">
      ${hits.map(item => `<button class="suggestion-item ${gradeClass(item.level)}" type="button" data-pick="${target}" data-value="${escapeHtml(itemName(item))}"><img src="${escapeHtml(thumbnailUrl(item))}" alt="" loading="lazy" decoding="async" /><strong>${escapeHtml(itemName(item))}</strong><span>${escapeHtml(itemDisplayGrade(item))}</span></button>`).join("")}
    </div>
  `;
}

function renderCard(item: Equipment) {
  const parsed = splitDescription(item);
  return `
    <article class="equipment-card t-resize" data-item-id="${escapeHtml(item.id)}" data-item-name="${escapeHtml(itemName(item))}" data-card-expanded="false" tabindex="0" draggable="true">
      <div class="card-image">
        ${renderLazyImage("item-icon", iconUrl(item), itemName(item), thumbnailUrl(item))}
        <span class="grade-badge ${gradeClass(item.level)}">${escapeHtml(itemDisplayGrade(item))}</span>
      </div>
      <div class="card-body">
        <span class="category">装备 · ${escapeHtml(itemCategoryLabel(item))}${escapeHtml(itemStatusLabel(item))}</span>
        <div class="card-title-row">
          <h2 class="${gradeClass(item.level)}">${escapeHtml(itemName(item))}</h2>
          <span class="card-grade-text">${escapeHtml(itemDisplayGrade(item))}</span>
          <button class="card-expand-toggle" type="button" data-toggle-card-details aria-expanded="false" aria-label="展开装备说明">
            ${renderIcon("expand_more", "ui-icon card-expand-icon")}
          </button>
        </div>
        <div class="card-expand-content">
          ${renderAttributeEffects(item, true)}
          <p class="lore">${escapeHtml(parsed.lore.join("") || "暂无说明")}</p>
        </div>
      </div>
    </article>
  `;
}

function renderRouteList(item: Equipment) {
  if (!state.routeDataLoaded) return `<p class="empty-note">正在加载炼化与合成路线...</p>`;
  const sources = getSources(item);
  if (!sources.length) return `<p class="empty-note">没有在当前解析数据中找到合成或炼化来源。</p>`;
  return sources.map(source => `
    <div class="route-detail ${source.kind}">
      <div class="route-title">
        <strong>${escapeHtml(source.title)}</strong>
        ${renderProbability(source.probability)}
      </div>
      ${source.html}
    </div>
  `).join("");
}

function renderTargetRoutes() {
  const target = readItemByName(state.assistantTarget);
  if (!state.assistantTarget) return `<div class="empty-note">输入目标装备后，会展示精确公式和动态炼化路线。</div>`;
  if (!target) {
    const needle = normalize(state.assistantTarget);
    const exactRules = refiningRules
      .filter(rule => rule.type === "exact-refining")
      .filter(rule => !isSynthesisScrollRule(rule))
      .filter(rule => rule.possibleOutputs.some(output => normalize(outputLabel(output)).includes(needle)))
      .slice(0, 8);
    if (!exactRules.length) return `<div class="empty-note">没有找到目标装备或材料公式，试试更短的关键词。</div>`;
    return `
      <div class="assistant-target">
        <div>
          <strong>${escapeHtml(cleanGameText(state.assistantTarget))}</strong>
          <span>非装备材料 / 特殊产物</span>
        </div>
      </div>
      <div class="route-stack">
        ${mergeExactDisplayRules(exactRules).map(rule => renderExactRoute(rule)).join("")}
      </div>
    `;
  }
  return `
    <div class="assistant-target selected-target ${gradeClass(target.level)}">
      <img src="${escapeHtml(iconUrl(target))}" alt="" />
      <div>
        <strong>${escapeHtml(itemName(target))}</strong>
        <span>${escapeHtml(itemDisplayGrade(target))} · ${escapeHtml(itemCategoryLabel(target))}</span>
      </div>
    </div>
    <div class="route-stack">${renderRouteList(target)}</div>
  `;
}

function branchMatchesItems(branch: ProbabilityBranch, main: Equipment, material: Equipment) {
  const mainLevel = levelValueForItem(main);
  const materialLevel = levelValueForItem(material);
  const context = branch.context;
  if (context?.mainItemLevel?.value && context.mainItemLevel.value !== mainLevel) return false;
  const diff = mainLevel - materialLevel;
  const code = context?.levelDifference?.code;
  if (!code) return true;
  if (code === "same-level") return diff === 0;
  if (code === "material-higher-by-1") return diff === -1;
  if (code === "material-higher-by-2-plus") return diff < -1;
  if (code === "main-higher-by-1-to-2") return diff <= 2 && diff > 0;
  if (code === "main-higher-by-3-plus") return diff > 2;
  return true;
}

function renderInputPairRoutes() {
  const main = readItemByName(state.assistantMain);
  const material = readItemByName(state.assistantMaterial);
  const hasQuery = state.assistantMain || state.assistantMaterial;
  if (!hasQuery) return `<div class="empty-note">也可以输入主装备与材料，直接展示会得到什么。</div>`;

  const exactMatches = refiningRules
    .filter(rule => rule.type === "exact-refining")
    .filter(rule => !isSynthesisScrollRule(rule))
    .map(rule => {
      const selected = new Set([
        main?.id,
        material?.id,
        main ? itemName(main) : "",
        material ? itemName(material) : "",
        cleanGameText(state.assistantMain),
        cleanGameText(state.assistantMaterial),
      ].filter((value): value is string => Boolean(value)));
      const hits = requiredInputs(rule).filter(input => selected.has(input.id) || selected.has(cleanGameText(input.name)));
      const missing = missingRequiredInputs(rule, selected);
      return { rule, hits, missing };
    })
    .filter(match => match.hits.length)
    .filter(match => !(state.assistantMain && state.assistantMaterial) || match.missing.length === 0)
    .sort((a, b) => a.missing.length - b.missing.length)
    .slice(0, 6);

  const dynamicMatches = main && material
    ? refiningRules
      .filter(rule => rule.type === "dynamic-refining")
      .filter(rule => (rule.mainHpValues || []).includes(Number(main.refining?.hp)) && (rule.materialHpValues || []).includes(Number(material.refining?.hp)))
      .filter(rule => isAllowedDynamicSelection(rule, main, material))
      .flatMap(rule => (rule.probabilityBranches || [])
        .filter(branch => branchMatchesItems(branch, main, material))
        .flatMap(branch => branch.outcomes
          .map(outcome => ({
            ...outcome,
            outputs: outcome.outputs.filter(output => dynamicOutputEligible(output, branch.context, levelValueForItem(main)))
              .filter(output => isEligibleOverlapSimulationOutput(rule, branch, output, main, material)),
          }))
          .filter(outcome => outcome.outputs.length)
          .map(outcome => ({ rule, branch, outcome }))))
    : [];

  return `
    ${renderFuzzySuggestions(state.assistantMain, "assistantMain")}
    ${renderFuzzySuggestions(state.assistantMaterial, "assistantMaterial")}
    <div class="route-stack">
      ${exactMatches.map(({ rule, missing }) => renderExactRoute(rule, `精确炼化${missing.length ? " · 缺材料" : ""}`, missing)).join("")}
      ${dynamicMatches.map(({ rule, branch, outcome }) => `
        <div class="route-detail dynamic">
          <div class="route-title"><strong>动态炼化</strong>${renderProbability(outcome.chancePercent)}</div>
          <span class="formula-line">${renderFormulaItem(itemName(main as Equipment))}<span class="formula-plus">+</span>${renderFormulaItem(itemName(material as Equipment))}<span class="formula-eq">=</span>${outcome.outputs.map(output => renderOutputLink(output, branch.context, outcome.chancePercent, levelValueForItem(main as Equipment))).join(" / ")}</span>
          <small>${escapeHtml(branch.context?.levelDifference?.label || "固定条件")}</small>
        </div>
      `).join("")}
      ${!exactMatches.length && !dynamicMatches.length ? `<div class="empty-note">没有找到直接匹配。可以只输入一个名字，先看精确炼化是否缺少其他材料。</div>` : ""}
    </div>
  `;
}

function renderSimulationPanel() {
  const materialLabel = state.assistantMain || state.assistantMaterial
    ? `材料 <button class="swap-button" id="swap-assistant-items" type="button" aria-label="互换主装备与材料">${renderIcon("swap_vert")}</button>`
    : "材料";
  const canClear = state.assistantTarget || state.assistantMain || state.assistantMaterial;
  return `
    <span class="filter-kicker">Refine</span>
    <div class="section-title compact">
      <div>
        <span>炼化查询</span>
        <h2>目标反查 / 模拟炼化</h2>
      </div>
      <button class="sim-clear-button" id="clear-simulation" type="button" aria-label="一键清除炼化查询" ${canClear ? "" : "disabled"}>清除</button>
    </div>
    <div class="sim-section">
      <span class="sim-section-label">路线反查 <span class="sim-section-hint"> 支持连续查询</span></span>
      <div class="sim-drop" data-drop-slot="assistantTarget">
        ${renderInput("assistant-target", "目标装备", state.assistantTarget, "输入 / 拖入目标装备", "assistantTarget")}
      </div>
      <div class="assistant-results sim-results">${renderTargetRoutes()}</div>
    </div>
    <div class="sim-section">
      <span class="sim-section-label">模拟炼化</span>
      <p class="sim-touch-hint">移动端长按卡片选择位置</p>
      <div class="sim-drop" data-drop-slot="assistantMain">
        ${renderInput("assistant-main", "主装备", state.assistantMain, "输入 / 拖入装备", "assistantMain")}
      </div>
      <div class="sim-drop" data-drop-slot="assistantMaterial">
        ${renderInput("assistant-material", materialLabel, state.assistantMaterial, "输入 / 拖入材料", "assistantMaterial")}
      </div>
      <div class="assistant-results sim-results">${renderInputPairRoutes()}</div>
    </div>
  `;
}

function renderMobilePickModal(opening: boolean) {
  const item = state.mobilePickItemId ? itemById.get(state.mobilePickItemId) : undefined;
  if (!item) return "";
  return `
    <div class="pick-shell" role="dialog" aria-label="选择炼化位置">
      <div class="pick-card t-modal ${opening ? "" : "is-open"}" ${opening ? 'data-transition-enter="modal"' : ""}>
        <div class="assistant-target">
          <img src="${escapeHtml(iconUrl(item))}" alt="" />
          <div>
            <strong>${escapeHtml(itemName(item))}</strong>
            <span>${escapeHtml(itemDisplayGrade(item))} · ${escapeHtml(itemCategoryLabel(item))}</span>
          </div>
        </div>
        <div class="pick-actions">
          <button type="button" data-pick-slot="assistantTarget">作为目标装备</button>
          <button type="button" data-pick-slot="assistantMain">作为主装备</button>
          <button type="button" data-pick-slot="assistantMaterial">作为材料</button>
        </div>
        <button class="reset-button" id="close-pick" type="button">取消</button>
      </div>
    </div>
  `;
}

function renderDetail(item: Equipment, opening: boolean) {
  const parsed = splitDescription(item);
  return `
    <aside class="detail-panel t-modal ${opening ? "" : "is-open"}" ${opening ? 'data-transition-enter="modal"' : ""} role="dialog" aria-label="${escapeHtml(itemName(item))}详情">
      <div class="detail-head">
        <img class="detail-icon" src="${escapeHtml(iconUrl(item))}" alt="${escapeHtml(itemName(item))}" />
        <div>
          <span class="category">${escapeHtml(item.kind || "装备")} · ${escapeHtml(displayRefiningLabel(item.refining?.label || "未分类"))}${escapeHtml(itemStatusLabel(item))}</span>
          <h2 class="${gradeClass(item.level)}">${escapeHtml(itemName(item))} · <span style="font-weight: normal;font-size: 24px;">${escapeHtml(itemDisplayGrade(item))}</span></h2>
        </div>
        <button class="icon-button" id="close-detail" type="button" aria-label="关闭详情">${renderIcon("close")}</button>
      </div>
      <section class="detail-section">
        <h3>属性功能</h3>
        ${renderAttributeEffects(item)}
      </section>
      <section class="detail-section">
        <h3>来源与炼化路径</h3>
        <div class="route-stack">${renderRouteList(item)}</div>
      </section>
      <section class="detail-section">
        <h3>说明</h3>
        <p>${escapeHtml(parsed.lore.join("\n") || "暂无说明").replaceAll("\n", "<br />")}</p>
      </section>
    </aside>
  `;
}

function renderQuizModal(opening: boolean) {
  if (!state.quizOpen) return "";
  const rows = quizAnswers[state.quizTab];
  return `
    <div class="modal-shell" role="dialog" aria-label="帝都答题答案">
      <div class="quiz-modal t-modal ${opening ? "" : "is-open"}" ${opening ? 'data-transition-enter="modal"' : ""}>
        <div class="modal-head">
          <div>
            <span class="category">v2.4.6</span>
            <h2>帝都答题</h2>
          </div>
          <button class="icon-button" id="close-quiz" type="button" aria-label="关闭帝都答题">${renderIcon("close")}</button>
        </div>
        <div class="quiz-tabs">
          ${quizTabs.map(tab => `<button type="button" class="${state.quizTab === tab ? "active" : ""}" data-quiz-tab="${escapeHtml(tab)}">${escapeHtml(tab)}</button>`).join("")}
        </div>
        <div class="quiz-list">
          ${rows.map(([question, answer], index) => `
            <div class="quiz-row">
              <span>${index + 1}</span>
              <p>${escapeHtml(question)}</p>
              <strong>${escapeHtml(answer)}</strong>
            </div>
          `).join("")}
        </div>
      </div>
    </div>
  `;
}

const equipmentCount = computed(() => (state.dataVersion, equipment.length));
const recipeCount = computed(() => (state.dataVersion, recipes.length));
const refiningRuleCount = computed(() => (state.dataVersion, refiningRules.length));
const selectedItem = computed(() => (state.dataVersion, state.selectedItemId ? itemById.get(state.selectedItemId) : undefined));
const hasBlockingLayer = computed(() => Boolean(
  selectedItem.value || state.quizOpen || state.mobilePickItemId || (state.simOpen && state.isDrawerLayout) || (state.filtersOpen && state.isMobileLayout),
));

watch(hasBlockingLayer, locked => {
  setPageScrollLock(locked);
}, { immediate: true });

watch(() => [
  state.dataVersion,
  state.routeDataLoaded,
  state.visibleLimit,
  state.nameQuery,
  state.refiningAttribute,
  state.equipmentSlot,
  state.grade,
], () => {
  nextTick(prepareCatalogLoading);
}, { flush: "post" });

const topbarSearchHtml = computed(() => renderTopbarSearch());
const filterSheetHtml = computed(() => renderFilterSheet());
const filterHtml = computed(() => `
  <span class="filter-kicker">Search</span>
  ${renderInput("name-query", "模糊查询", state.nameQuery, "查询装备名/攻速/专属", "nameQuery", "catalog-search-field")}
  ${renderDesktopSearchHistory()}
  ${renderHotTags()}
  ${renderMobileFilterBar()}
  <div class="advanced-filters t-resize ${state.filtersOpen ? "open" : ""}" data-open="${state.filtersOpen ? "true" : "false"}">
    <div class="field">
      <span>炼化属性</span>
      ${renderRefiningAttributeFilters()}
    </div>
    <div class="field">
      <span>装备类别</span>
      ${renderEquipmentSlotFilters()}
    </div>
    <div class="field">
      <span>装备品级</span>
      ${renderGradeFilters()}
    </div>
  </div>
  <div class="filter-actions">
    <button id="reset-filters" class="reset-button" type="button">重置筛选</button>
  </div>
`);

const catalogHtml = computed(() => {
  if (!state.dataVersion) return `<div class="empty-note wide">正在加载装备数据...</div>`;
  const items = filterItems();
  const visibleItems = items.slice(0, state.visibleLimit);
  const hasMore = visibleItems.length < items.length;

  return `
    <div class="catalog-head">
      <div>
        <span class="category">Gears</span>
        <h2>${items.length} 件匹配装备</h2>
      </div>
    </div>
    <div class="catalog-grid">
      ${visibleItems.map(renderCard).join("") || `<div class="empty-note wide">没有匹配结果，换一个名称、属性或品级试试。</div>`}
    </div>
    ${hasMore ? `<button class="load-more-button" id="load-more-catalog" type="button">加载更多 · ${visibleItems.length}/${items.length}</button><div class="catalog-more-sentinel" id="catalog-more-sentinel" aria-hidden="true"></div>` : ""}
  `;
});

const simulationHtml = computed(() => (state.dataVersion, renderSimulationPanel()));
const detailHtml = computed(() => selectedItem.value ? renderDetail(selectedItem.value, false) : "");
const mobilePickHtml = computed(() => (state.dataVersion, renderMobilePickModal(false)));

function setStateValue(key: keyof State, value: string) {
  if (typeof state[key] === "string") {
    (state[key] as string) = value;
  }
}

function resetTagFilters() {
  state.refiningAttribute = "";
  state.equipmentSlot = "";
  state.grade = "";
}

function resetCatalogLimit() {
  state.visibleLimit = initialCatalogLimit;
}

function isSearchHistoryQueryValid(value: string) {
  const query = cleanGameText(value).trim();
  return Boolean(query) && fuzzyItems(query, 1).length > 0;
}

function normalizeSearchHistory(entries: unknown[]) {
  const seen = new Set<string>();
  return entries
    .filter((entry): entry is string => typeof entry === "string")
    .map(entry => cleanGameText(entry).trim())
    .filter(entry => entry && !seen.has(entry) && isSearchHistoryQueryValid(entry) && seen.add(entry))
    .slice(0, 8);
}

function commitSearchHistory(value = state.nameQuery) {
  const query = cleanGameText(value).trim();
  if (!isSearchHistoryQueryValid(query)) return;
  state.searchHistory = normalizeSearchHistory([query, ...state.searchHistory]);
  window.localStorage.setItem(searchHistoryStorageKey, JSON.stringify(state.searchHistory));
}

function loadSearchHistory() {
  const raw = window.localStorage.getItem(searchHistoryStorageKey);
  if (!raw) return;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      state.searchHistory = normalizeSearchHistory(parsed);
      window.localStorage.setItem(searchHistoryStorageKey, JSON.stringify(state.searchHistory));
    }
  } catch {
    state.searchHistory = [];
  }
}

function loadMoreCatalogItems() {
  state.visibleLimit += catalogLimitStep;
}

function toggleCardDetails(toggle: HTMLElement) {
  const card = toggle.closest<HTMLElement>(".equipment-card");
  if (!card) return;
  const nextExpanded = card.classList.toggle("is-expanded");
  card.dataset.cardExpanded = nextExpanded ? "true" : "false";
  toggle.setAttribute("aria-expanded", nextExpanded ? "true" : "false");
  toggle.setAttribute("aria-label", nextExpanded ? "收起装备说明" : "展开装备说明");
}

function openItemByName(name: string) {
  const item = readItemByName(name);
  if (item) {
    state.selectedItemId = item.id;
  } else {
    state.nameQuery = cleanGameText(name).replace(/\s+x\d+$/i, "");
  }
}

function rememberFocus(input?: HTMLInputElement) {
  const focus = input
    ? { id: input.id, selectionStart: input.selectionStart }
    : undefined;
  nextTick(() => {
    if (!focus || composing) return;
    const nextActive = document.getElementById(focus.id);
    if (nextActive instanceof HTMLInputElement) {
      nextActive.focus();
      if (focus.selectionStart !== null) {
        nextActive.setSelectionRange(focus.selectionStart, focus.selectionStart);
      }
    }
  });
}

function clickedElement(event: Event, selector: string) {
  return event.target instanceof Element ? event.target.closest<HTMLElement>(selector) : null;
}

function setTextState(key: keyof State, value: string, input?: HTMLInputElement) {
  setStateValue(key, value);
  if (key === "assistantTarget" || key === "assistantMain" || key === "assistantMaterial") {
    ensureRouteData().catch(error => console.error("Failed to load route data", error));
  }
  if (key === "nameQuery") {
    state.visibleLimit = initialCatalogLimit;
    if (value) resetTagFilters();
  }
  rememberFocus(input);
}

function onCompositionStart() {
  composing = true;
}

function onCompositionEnd(event: CompositionEvent) {
  composing = false;
  if (event.target instanceof HTMLInputElement) {
    const key = event.target.dataset.stateKey as keyof State | undefined;
    if (key) setTextState(key, event.target.value, event.target);
  }
}

function onInput(event: Event) {
  if (composing || !(event.target instanceof HTMLInputElement)) return;
  const key = event.target.dataset.stateKey as keyof State | undefined;
  if (key) setTextState(key, event.target.value, event.target);
}

function onClick(event: MouseEvent) {
  if (!clickedElement(event, ".topbar-search")) {
    state.mobileSearchPopoverOpen = false;
  }

  if (clickedElement(event, "#brand-theme-toggle")) {
    setTheme(state.theme === "mono" ? "classic" : "mono");
    return;
  }

  const draggableItem = clickedElement(event, "[data-draggable-item]");
  if (draggableItem && longPressedItemId === draggableItem.dataset.itemId) {
    longPressedItemId = "";
    event.stopPropagation();
    return;
  }

  const clickedInSimPanel = clickedElement(event, ".sim-panel");

  if (draggableItem) {
    event.stopPropagation();
    ensureRouteData().catch(error => console.error("Failed to load route data", error));
    openItemByName(draggableItem.dataset.itemName || draggableItem.textContent || "");
    if (clickedInSimPanel && state.isDrawerLayout) state.simOpen = false;
    return;
  }

  const itemLink = clickedElement(event, ".item-link");
  if (itemLink) {
    event.stopPropagation();
    ensureRouteData().catch(error => console.error("Failed to load route data", error));
    openItemByName(itemLink.dataset.itemName || itemLink.textContent || "");
    if (clickedInSimPanel && state.isDrawerLayout) state.simOpen = false;
    return;
  }

  const clearButton = clickedElement(event, "[data-clear]");
  if (clearButton) {
    const key = clearButton.dataset.clear as keyof State;
    setStateValue(key, "");
    if (key === "nameQuery") resetCatalogLimit();
    rememberFocus();
    return;
  }

  const gradeButton = clickedElement(event, "[data-grade]");
  if (gradeButton) {
    state.grade = gradeButton.dataset.grade || "";
    resetCatalogLimit();
    return;
  }

  const refiningButton = clickedElement(event, "[data-refining-attribute]");
  if (refiningButton) {
    state.refiningAttribute = refiningButton.dataset.refiningAttribute || "";
    resetCatalogLimit();
    return;
  }

  const slotButton = clickedElement(event, "[data-equipment-slot]");
  if (slotButton) {
    state.equipmentSlot = slotButton.dataset.equipmentSlot || "";
    resetCatalogLimit();
    return;
  }

  const hotButton = clickedElement(event, "[data-hot-tag]");
  if (hotButton) {
    state.nameQuery = hotButton.dataset.hotTag || "";
    commitSearchHistory(state.nameQuery);
    resetTagFilters();
    resetCatalogLimit();
    state.mobileSearchPopoverOpen = false;
    return;
  }

  const historyButton = clickedElement(event, "[data-search-history]");
  if (historyButton) {
    state.nameQuery = historyButton.dataset.searchHistory || "";
    commitSearchHistory(state.nameQuery);
    resetTagFilters();
    resetCatalogLimit();
    state.mobileSearchPopoverOpen = false;
    return;
  }

  if (clickedElement(event, "#clear-search-history")) {
    state.searchHistory = [];
    window.localStorage.removeItem(searchHistoryStorageKey);
    return;
  }

  if (clickedElement(event, "#toggle-filters")) {
    state.mobileSearchPopoverOpen = false;
    state.filtersOpen = state.isMobileLayout ? true : !state.filtersOpen;
    return;
  }

  if (clickedElement(event, "[data-open-filters]")) {
    state.mobileSearchPopoverOpen = false;
    state.filtersOpen = true;
    return;
  }

  if (clickedElement(event, "#reset-filters")) {
    state.nameQuery = "";
    state.refiningAttribute = "";
    state.equipmentSlot = "";
    state.grade = "";
    resetCatalogLimit();
    return;
  }

  if (clickedElement(event, "#close-filter-sheet, #apply-filter-sheet")) {
    state.filtersOpen = false;
    return;
  }

  if (event.target instanceof HTMLElement && event.target.classList.contains("filter-sheet-shell")) {
    state.filtersOpen = false;
    return;
  }

  if (clickedElement(event, "#load-more-catalog")) {
    loadMoreCatalogItems();
    return;
  }

  const suggestion = clickedElement(event, "[data-pick]");
  if (suggestion) {
    event.stopPropagation();
    setStateValue(suggestion.dataset.pick as keyof State, suggestion.dataset.value || "");
    return;
  }

  const cardDetailsToggle = clickedElement(event, "[data-toggle-card-details]");
  if (cardDetailsToggle) {
    event.stopPropagation();
    toggleCardDetails(cardDetailsToggle);
    return;
  }

  if (clickedElement(event, "#to-top")) {
    window.scrollTo({ top: 0, behavior: "smooth" });
    return;
  }

  if (clickedElement(event, "#sim-anchor")) {
    ensureRouteData().catch(error => console.error("Failed to load route data", error));
    state.simOpen = !state.simOpen;
    return;
  }

  if (clickedElement(event, "#sim-scrim")) {
    state.simOpen = false;
    return;
  }

  if (clickedElement(event, "#swap-assistant-items")) {
    const main = state.assistantMain;
    state.assistantMain = state.assistantMaterial;
    state.assistantMaterial = main;
    return;
  }

  if (clickedElement(event, "#clear-simulation")) {
    state.assistantTarget = "";
    state.assistantMain = "";
    state.assistantMaterial = "";
    return;
  }

  const pickSlot = clickedElement(event, "[data-pick-slot]");
  if (pickSlot) {
    ensureRouteData().catch(error => console.error("Failed to load route data", error));
    const item = itemById.get(state.mobilePickItemId);
    if (item) setStateValue(pickSlot.dataset.pickSlot as keyof State, itemName(item));
    state.mobilePickItemId = "";
    state.simOpen = true;
    return;
  }

  if (clickedElement(event, "#close-pick")) {
    state.mobilePickItemId = "";
    return;
  }

  if (event.target instanceof HTMLElement && event.target.classList.contains("pick-shell")) {
    state.mobilePickItemId = "";
    return;
  }

  if (clickedElement(event, "#close-detail")) {
    state.selectedItemId = "";
    return;
  }

  if (event.target instanceof HTMLElement && event.target.classList.contains("detail-shell")) {
    state.selectedItemId = "";
    return;
  }

  if (clickedElement(event, "#quiz-open")) {
    state.quizOpen = true;
    state.quizTab = quizTabs[0];
    return;
  }

  if (clickedElement(event, "#close-quiz")) {
    state.quizOpen = false;
    return;
  }

  const quizTab = clickedElement(event, "[data-quiz-tab]");
  if (quizTab) {
    state.quizTab = quizTab.dataset.quizTab as keyof typeof quizAnswers;
    return;
  }

  if (event.target instanceof HTMLElement && event.target.classList.contains("modal-shell")) {
    state.quizOpen = false;
    return;
  }

  const card = clickedElement(event, ".equipment-card");
  if (card) {
    ensureRouteData().catch(error => console.error("Failed to load route data", error));
    const itemId = card.dataset.itemId || "";
    if (longPressedItemId === itemId) {
      longPressedItemId = "";
      return;
    }
    state.selectedItemId = itemId;
  }
}

function onKeydown(event: KeyboardEvent) {
  if (event.key !== "Enter") return;
  if (event.target instanceof HTMLInputElement && event.target.dataset.stateKey === "nameQuery") {
    commitSearchHistory(event.target.value);
    return;
  }
  const card = clickedElement(event, ".equipment-card");
  if (card) state.selectedItemId = card.dataset.itemId || "";
}

let longPressTimer = 0;
let longPressedItemId = "";

function onPointerDown(event: PointerEvent) {
  if (clickedElement(event, ".topbar-search")) {
    state.mobileSearchPopoverOpen = true;
  } else if (state.mobileSearchPopoverOpen) {
    state.mobileSearchPopoverOpen = false;
  }

  const itemSource = clickedElement(event, ".equipment-card, [data-draggable-item]");
  if (!itemSource || !window.matchMedia("(max-width: 1040px)").matches || event.pointerType === "mouse") return;
  clearLongPress();
  const itemId = itemSource.dataset.itemId || "";
  longPressTimer = window.setTimeout(() => {
    longPressedItemId = itemId;
    state.mobilePickItemId = itemId;
  }, 520);
}

function clearLongPress() {
  window.clearTimeout(longPressTimer);
}

function onDragStart(event: DragEvent) {
  const card = clickedElement(event, ".equipment-card");
  const itemSource = card || clickedElement(event, "[data-draggable-item]");
  if (!itemSource) return;
  event.stopPropagation();
  if (event.dataTransfer) event.dataTransfer.effectAllowed = "copy";
  event.dataTransfer?.setData("text/plain", itemSource.dataset.itemName || "");
  event.dataTransfer?.setData("application/x-war3-item", itemSource.dataset.itemName || "");
  if (itemSource.closest(".detail-panel") && !state.isMobileLayout) {
    window.requestAnimationFrame(() => {
      state.selectedItemId = "";
    });
  }
}

function onContextMenu(event: MouseEvent) {
  if (!clickedElement(event, ".equipment-card, [data-draggable-item]")) return;
  event.preventDefault();
  event.stopPropagation();
}

function onSelectStart(event: Event) {
  if (!clickedElement(event, ".equipment-card, [data-draggable-item]")) return;
  event.preventDefault();
}

function onDragOver(event: DragEvent) {
  const drop = clickedElement(event, "[data-drop-slot]");
  if (!drop) return;
  event.preventDefault();
  drop.classList.add("drag-over");
}

function onDragLeave(event: DragEvent) {
  clickedElement(event, "[data-drop-slot]")?.classList.remove("drag-over");
}

function onDrop(event: DragEvent) {
  const drop = clickedElement(event, "[data-drop-slot]");
  if (!drop) return;
  event.preventDefault();
  drop.classList.remove("drag-over");
  const value = event.dataTransfer?.getData("application/x-war3-item") || event.dataTransfer?.getData("text/plain") || "";
  setStateValue(drop.dataset.dropSlot as keyof State, value);
}

function positionTokenPopover(target: EventTarget | Element | null) {
  const element = target instanceof Element ? target : undefined;
  const token = element?.closest<HTMLElement>(".sim-panel .route-token");
  const popover = token?.querySelector<HTMLElement>(".token-popover");
  if (!token || !popover) {
    activeToken = undefined;
    return;
  }

  const margin = 14;
  const gap = 8;
  const rect = token.getBoundingClientRect();
  const panel = token.closest<HTMLElement>(".sim-panel");
  const panelHasTransform = panel && getComputedStyle(panel).transform !== "none";
  const panelRect = panelHasTransform
    ? panel.getBoundingClientRect()
    : { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };

  const containerWidth = panelRect.width;
  const width = Math.max(220, Math.min(360, containerWidth - margin * 2));
  const left = Math.max(margin, Math.min(rect.left, window.innerWidth - width - margin));
  const below = window.innerHeight - rect.bottom - margin - gap;
  const above = rect.top - margin - gap;
  const placeBelow = below >= 170 || below >= above;
  const maxHeight = Math.max(120, Math.min(420, placeBelow ? below : above));
  const rawTop = placeBelow ? rect.bottom + gap : rect.top - maxHeight - gap;
  const top = Math.max(margin, Math.min(rawTop, window.innerHeight - maxHeight - margin));

  const safeLeft = Math.max(0, Math.min(left - panelRect.left, containerWidth - width));
  const safeTop = Math.max(0, Math.min(top - panelRect.top, panelRect.height - maxHeight));

  popover.style.left = `${safeLeft}px`;
  popover.style.top = `${safeTop}px`;
  popover.style.width = `${Math.min(width, containerWidth)}px`;
  popover.style.maxHeight = `${Math.min(maxHeight, panelRect.height)}px`;
  activeToken = token;
}

function scheduleTokenPopover(target: EventTarget | Element | null, force = false) {
  const element = target instanceof Element ? target : undefined;
  const token = element?.closest<HTMLElement>(".sim-panel .route-token");
  if (!force && token && token === activeToken) return;
  pendingTokenTarget = token || target;
  if (tokenPopoverFrame) return;
  tokenPopoverFrame = window.requestAnimationFrame(() => {
    tokenPopoverFrame = 0;
    positionTokenPopover(pendingTokenTarget);
  });
}

function onPointerOver(event: PointerEvent) {
  scheduleTokenPopover(event.target);
}

function onFocusIn(event: FocusEvent) {
  if (clickedElement(event, ".topbar-search")) {
    state.mobileSearchPopoverOpen = true;
  }
  scheduleTokenPopover(event.target, true);
}

function onFocusOut(event: FocusEvent) {
  if (event.target instanceof HTMLInputElement && event.target.dataset.stateKey === "nameQuery") {
    commitSearchHistory(event.target.value);
  }
}

function onScrollCapture() {
  if (!activeToken?.isConnected || !activeToken.matches(":hover, :focus, :focus-within")) return;
  scheduleTokenPopover(activeToken, true);
}

let swipeStartX = 0;
let trackingSwipe = false;

function onTouchStart(event: TouchEvent) {
  if (!clickedElement(event, "#sim-anchor, .sim-panel")) return;
  trackingSwipe = true;
  swipeStartX = event.touches[0]?.clientX || 0;
}

function onTouchEnd(event: TouchEvent) {
  if (!trackingSwipe) return;
  trackingSwipe = false;
  const endX = event.changedTouches[0]?.clientX || swipeStartX;
  const delta = endX - swipeStartX;
  if (delta < -35) state.simOpen = true;
  if (delta > 35) state.simOpen = false;
}

function updateShowToTop() {
  state.showToTop = window.scrollY > 240;
}

function updateDrawerLayout() {
  state.isMobileLayout = window.innerWidth <= 680;
  state.isDrawerLayout = window.innerWidth <= 760;
  if (!state.isMobileLayout) {
    state.filtersOpen = false;
    state.mobileSearchPopoverOpen = false;
  }
}

function catalogImageSource(image: HTMLImageElement) {
  return state.theme === "mono"
    ? image.dataset.srcMono || image.dataset.srcClassic || ""
    : image.dataset.srcClassic || image.dataset.srcMono || "";
}

function syncLoadedCatalogImageSources() {
  document.querySelectorAll<HTMLImageElement>("img.lazy-image[data-loaded='true']").forEach(image => {
    const src = catalogImageSource(image);
    if (src && image.getAttribute("src") !== src) image.src = src;
  });
}

function prepareCatalogLoading() {
  if (!lazyImageObserver) {
    lazyImageObserver = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting || !(entry.target instanceof HTMLImageElement)) continue;
        const src = catalogImageSource(entry.target);
        if (!src) continue;
        entry.target.onload = () => entry.target.classList.add("loaded");
        entry.target.src = src;
        if (entry.target.complete) entry.target.classList.add("loaded");
        entry.target.dataset.loaded = "true";
        lazyImageObserver?.unobserve(entry.target);
      }
    }, { rootMargin: "420px 0px" });
  }

  document.querySelectorAll<HTMLImageElement>("img.lazy-image:not([data-loaded='true'])").forEach(image => {
    lazyImageObserver?.observe(image);
  });

  catalogMoreObserver?.disconnect();
  const sentinel = document.getElementById("catalog-more-sentinel");
  if (sentinel) {
    catalogMoreObserver = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting)) return;
      catalogMoreObserver?.disconnect();
      loadMoreCatalogItems();
    }, { rootMargin: "680px 0px" });
    catalogMoreObserver.observe(sentinel);
  }
}

function setTheme(theme: Theme) {
  state.theme = theme;
  document.documentElement.dataset.theme = theme;
  window.localStorage.setItem(themeStorageKey, theme);
  nextTick(syncLoadedCatalogImageSources);
}

function setPageScrollLock(locked: boolean) {
  const root = document.documentElement;
  const body = document.body;
  if (locked) {
    if (body.classList.contains("layer-open")) return;
    lockedScrollY = window.scrollY;
    root.classList.add("layer-open");
    body.classList.add("layer-open");
    body.style.top = `-${lockedScrollY}px`;
    return;
  }

  if (!body.classList.contains("layer-open")) return;
  root.classList.remove("layer-open");
  body.classList.remove("layer-open");
  body.style.top = "";
  window.scrollTo(0, lockedScrollY);
  updateShowToTop();
}

onMounted(() => {
  const savedTheme = window.localStorage.getItem(themeStorageKey);
  setTheme(savedTheme === "mono" ? "mono" : "classic");
  loadCatalogData()
    .then(loadSearchHistory)
    .catch(error => {
      console.error("Failed to load catalog data", error);
    });
  updateDrawerLayout();
  updateShowToTop();
  window.addEventListener("resize", updateDrawerLayout);
  window.addEventListener("scroll", updateShowToTop, { passive: true });
});

onBeforeUnmount(() => {
  setPageScrollLock(false);
  window.clearTimeout(routeDataTimer);
  window.cancelAnimationFrame(tokenPopoverFrame);
  lazyImageObserver?.disconnect();
  catalogMoreObserver?.disconnect();
  window.removeEventListener("resize", updateDrawerLayout);
  window.removeEventListener("scroll", updateShowToTop);
});
</script>
