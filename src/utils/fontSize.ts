import { getPref, setPref } from "./prefs";

export const MIN_FONT_SIZE = 6;
export const MAX_FONT_SIZE = 48;
export const DEFAULT_FONT_SIZE = 12;
export const DEFAULT_LINE_HEIGHT = 1.5;

/**
 * Clamp a font size into the allowed range.
 */
export function clampFontSize(size: number) {
  if (!Number.isFinite(size)) {
    return DEFAULT_FONT_SIZE;
  }
  return Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, Math.round(size)));
}

/**
 * Current font size (px) of the translation text, from the `fontSize` pref.
 */
export function getFontSize() {
  const size = Number(getPref("fontSize"));
  if (!Number.isFinite(size) || size <= 0) {
    return DEFAULT_FONT_SIZE;
  }
  return clampFontSize(size);
}

/**
 * Current line height multiplier, from the `lineHeight` pref.
 */
export function getLineHeight() {
  const lineHeight = Number(getPref("lineHeight"));
  if (!Number.isFinite(lineHeight) || lineHeight <= 0) {
    return DEFAULT_LINE_HEIGHT;
  }
  return lineHeight;
}

/**
 * Line height (px) matching the current font size.
 */
export function getLineHeightPx(fontSize: number = getFontSize()) {
  return getLineHeight() * fontSize;
}

/**
 * Save a new font size and refresh every place showing translation text.
 *
 * @returns the applied (clamped) font size.
 */
export function setFontSize(size: number) {
  const newSize = clampFontSize(size);
  if (newSize !== getFontSize()) {
    setPref("fontSize", String(newSize));
  }
  refreshFontSize();
  return newSize;
}

/**
 * Increase/decrease the font size by `delta` px.
 *
 * @returns the applied (clamped) font size.
 */
export function adjustFontSize(delta: number) {
  return setFontSize(getFontSize() + delta);
}

/**
 * Restore the default font size.
 *
 * @returns the applied font size.
 */
export function resetFontSize() {
  return setFontSize(DEFAULT_FONT_SIZE);
}

/**
 * Apply the current font size & line height to a text element.
 */
export function applyFontSizeStyle(
  elem: HTMLElement,
  options: { lineHeightInPx?: boolean } = {},
) {
  const fontSize = getFontSize();
  elem.style.fontSize = `${fontSize}px`;
  elem.style.lineHeight = options.lineHeightInPx
    ? `${getLineHeightPx(fontSize)}px`
    : String(getLineHeight());
}

/**
 * Let the user zoom the translation text with `Ctrl/Cmd + wheel` on `elem`.
 *
 * @param elem element to listen on.
 * @param onChange called with the new font size after each change.
 */
export function registerFontSizeWheelZoom(
  elem: HTMLElement,
  onChange?: (fontSize: number) => void,
) {
  if (elem.dataset.fontSizeZoom === "true") {
    return;
  }
  elem.dataset.fontSizeZoom = "true";
  elem.addEventListener(
    "wheel",
    (ev: WheelEvent) => {
      if (!ev.ctrlKey && !ev.metaKey) {
        return;
      }
      if (ev.deltaY === 0) {
        return;
      }
      ev.preventDefault();
      ev.stopPropagation();
      const newSize = adjustFontSize(ev.deltaY < 0 ? 1 : -1);
      onChange?.(newSize);
    },
    { passive: false },
  );
}

function refreshFontSize() {
  addon.hooks.onReaderPopupRefresh();
  addon.hooks.onReaderTabPanelRefresh();
}
