import { SVGIcon } from "../utils/config";
import { config } from "../../package.json";
import { getString } from "../utils/locale";
import { getPref, setPref } from "../utils/prefs";
import { addTranslateTask, getLastTranslateTask } from "../utils/task";
import { slice } from "../utils/str";
import {
  adjustFontSize,
  applyFontSizeStyle,
  getFontSize,
  getLineHeightPx,
  MAX_FONT_SIZE,
  MIN_FONT_SIZE,
  registerFontSizeWheelZoom,
  setFontSize,
} from "../utils/fontSize";
import type { TagElementProps } from "zotero-plugin-toolkit";

export function updateReaderPopup() {
  const popup = addon.data.popup.currentPopup;
  if (!popup) {
    return;
  }
  const enablePopup = getPref("enablePopup");
  const hidePopupTextarea = getPref("enableHidePopupTextarea") as boolean;
  Array.from(popup.querySelectorAll(`.${config.addonRef}-readerpopup`)).forEach(
    (elem) => ((elem as HTMLElement).hidden = !enablePopup),
  );

  const idPrefix = popup?.getAttribute(`${config.addonRef}-prefix`);
  const makeId = (type: string) => `${idPrefix}-${type}`;
  const audiobox = popup?.querySelector(
    `#${makeId("audiobox")}`,
  ) as HTMLDivElement;
  const translateButton = popup?.querySelector(
    `#${makeId("translate")}`,
  ) as HTMLDivElement;
  const textarea = popup?.querySelector(
    `#${makeId("text")}`,
  ) as HTMLTextAreaElement;
  const addToNoteButton = popup?.querySelector(
    `#${makeId("addtonote")}`,
  ) as HTMLDivElement;
  const fontSizeBox = popup?.querySelector(
    `#${makeId("fontsizebox")}`,
  ) as HTMLDivElement;

  const updateHidden = (elem: HTMLElement, hidden: boolean) => {
    if (hidden) {
      elem.style.display = "none";
    } else {
      elem.style.removeProperty("display");
    }
  };

  // The font size row must keep its `display: flex`, so never remove the
  // property here - that would break the layout into several lines.
  const updateFontSizeBoxHidden = (hidden: boolean) => {
    if (fontSizeBox) {
      fontSizeBox.style.display = hidden ? "none" : "flex";
    }
  };

  if (!enablePopup) {
    updateHidden(audiobox, true);
    updateHidden(translateButton, true);
    updateHidden(textarea, true);
    updateHidden(addToNoteButton, true);
    updateFontSizeBoxHidden(true);
    return;
  }

  updateFontSizeBoxHidden(!getPref("showPopupFontSizeControls"));
  updatePopupFontSize(popup);

  const task = getLastTranslateTask({ type: "text" });
  if (!task) {
    return;
  }
  popup.setAttribute("translate-task-id", task.id);

  if (task.audio.length > 0 && getPref("showPlayBtn")) {
    audiobox.innerHTML = "";
    updateHidden(audiobox, false);
    ztoolkit.UI.appendElement(
      {
        tag: "fragment",
        children: task.audio.map((audioData) => ({
          tag: "button",
          namespace: "html",
          classList: ["toolbar-button", "wide-button"],
          attributes: {
            tabindex: "-1",
            title: audioData.text,
          },
          properties: {
            innerHTML: `🔊 ${audioData.text}`,
            onclick: () => {
              new (ztoolkit.getGlobal("Audio"))(audioData.url).play();
            },
          },
          styles: { whiteSpace: "nowrap", flexGrow: "1" },
        })),
      },
      audiobox,
    );
  }

  if (task.audio.length > 0 && getPref("showPlayBtn") && getPref("autoPlay")) {
    const firstAudio = task.audio[0];
    const audio = new (ztoolkit.getGlobal("Audio"))(firstAudio.url);
    audio.play();
  }

  const hideTranslateButton = task.status !== "waiting";
  updateHidden(translateButton, hideTranslateButton);

  switch (task.langto?.split("-")[0]) {
    case "ar":
    case "fa":
    case "he":
      textarea.style.direction = "rtl";
      break;
    default:
      textarea.style.direction = "ltr";
  }

  textarea.hidden = hidePopupTextarea || !hideTranslateButton;
  textarea.value = task.result || task.raw;
  applyFontSizeStyle(textarea, { lineHeightInPx: true });

  const enableAddToNote = getPref("enableNote") as boolean;
  if (
    !Zotero.getMainWindow().ZoteroContextPane.activeEditor ||
    !enableAddToNote
  ) {
    updateHidden(addToNoteButton, true);
  }

  updatePopupSize(popup, textarea);
}

export function buildReaderPopup(
  event: _ZoteroTypes.Reader.EventParams<"renderTextSelectionPopup">,
) {
  const { reader, doc, append } = event;
  const annotation = event.params.annotation;
  const popup = doc.querySelector(".selection-popup") as HTMLDivElement;
  addon.data.popup.currentPopup = popup;
  popup.style.maxWidth = "none";
  popup.setAttribute(
    `${config.addonRef}-prefix`,
    `${config.addonRef}-${reader._instanceID}`,
  );

  const ZoteroContextPane = Zotero.getMainWindow().ZoteroContextPane;

  const colors = popup.querySelector(".colors") as HTMLDivElement;
  colors.style.width = "100%";
  colors.style.justifyContent = "space-evenly";

  const keepSize = getPref("keepPopupSize") as boolean;

  const makeId = (type: string) =>
    `${config.addonRef}-${reader._instanceID}-${type}`;
  const onTextAreaCopy = getOnTextAreaCopy(popup, makeId("text"));

  const hidePopupTextarea = getPref("enableHidePopupTextarea") as boolean;
  append(
    ztoolkit.UI.createElement(doc, "fragment", {
      children: [
        {
          tag: "div",
          id: makeId("audiobox"),
          classList: [`${config.addonRef}-readerpopup`],
          styles: {
            display: "flex",
            width: "calc(100% - 4px)",
            marginLeft: "2px",
            justifyContent: "space-evenly",
          },
          ignoreIfExists: true,
        },
        {
          tag: "button",
          namespace: "html",
          id: makeId("translate"),
          classList: [
            "toolbar-button",
            "wide-button",
            `${config.addonRef}-readerpopup`,
          ],
          properties: {
            innerHTML: `${SVGIcon}${getString("readerpopup-translate-label")}`,
            hidden: getPref("enableAuto"),
          },
          listeners: [
            {
              type: "click",
              listener: (ev: Event) => {
                addon.hooks.onTranslate({
                  noCheckZoteroItemLanguage: true,
                  noCache: true,
                });
                const button = ev.target as HTMLDivElement;
                button.hidden = true;
                (
                  button.ownerDocument.querySelector(
                    `#${makeId("text")}`,
                  ) as HTMLTextAreaElement
                ).hidden = hidePopupTextarea;
              },
            },
          ],
          ignoreIfExists: true,
        },
        {
          tag: "textarea",
          id: makeId("text"),
          attributes: {
            rows: "3",
            columns: "10",
          },
          classList: [
            `${config.addonRef}-popup-textarea`,
            `${config.addonRef}-readerpopup`,
          ],
          styles: {
            fontSize: `${getFontSize()}px`,
            fontFamily: "inherit",
            lineHeight: `${getLineHeightPx()}px`,
            width: keepSize ? `${getPref("popupWidth")}px` : "-moz-available",
            // Minimum width to prevent the textarea from being smaller than the popup
            minWidth: "184px",
            height: `${Math.max(
              keepSize ? Number(getPref("popupHeight")) : 30,
            )}px`,
            marginInline: "2px",
            border: "none",
            background: "var(--color-sidepane)",
            borderRadius: "6px",
            padding: "5px",
          },
          properties: {
            onpointerup: (e: Event) => e.stopPropagation(),
            ondragstart: (e: Event) => e.stopPropagation(),
            spellcheck: false,
            value: addon.data.translate.selectedText,
          },
          ignoreIfExists: true,
          listeners: [
            {
              type: "mousedown",
              listener: (_ev) => {
                _ev.target?.addEventListener(
                  "mousemove",
                  onTextAreaResize as (ev: Event) => void,
                );
              },
            },
            {
              type: "mouseup",
              listener: (_ev) => {
                _ev.target?.removeEventListener(
                  "mousemove",
                  onTextAreaResize as (ev: Event) => void,
                );
              },
            },
            {
              type: "keydown",
              listener: onTextAreaCopy as (ev: Event) => void,
            },
            {
              type: "dblclick",
              listener: (_ev) => {
                const textarea = popup.querySelector(
                  `#${makeId("text")}`,
                ) as HTMLTextAreaElement;
                textarea.selectionStart = 0;
                textarea.selectionEnd = textarea.value.length;
                const text = textarea.value.slice(
                  textarea.selectionStart,
                  textarea.selectionEnd,
                );
                new ztoolkit.Clipboard().addText(text, "text/plain").copy();
                new ztoolkit.ProgressWindow("Copied to Clipboard")
                  .createLine({
                    text: slice(text, 50),
                    progress: 100,
                    type: "default",
                  })
                  .show();
              },
            },
          ],
        },
        {
          tag: "button",
          namespace: "html",
          id: makeId("addtonote"),
          classList: [
            "toolbar-button",
            "wide-button",
            `${config.addonRef}-readerpopup`,
          ],
          styles: {
            marginTop: "8px",
          },
          properties: {
            innerHTML: `${SVGIcon}${getString("readerpopup-addToNote-label")}`,
          },
          ignoreIfExists: true,
          listeners: [
            {
              type: "click",
              listener: async (ev) => {
                const noteEditor =
                  ZoteroContextPane && ZoteroContextPane.activeEditor;
                if (!noteEditor) {
                  return;
                }
                const editorInstance = noteEditor.getCurrentInstance();
                if (!editorInstance) {
                  return;
                }
                const task = addTranslateTask(
                  addon.data.translate.selectedText,
                  reader.itemID,
                  "addtonote",
                );
                if (!task) {
                  return;
                }
                await addon.hooks.onTranslate(task, {
                  noCheckZoteroItemLanguage: true,
                  noDisplay: true,
                });
                if (task.status !== "success") {
                  return;
                }
                const replaceMode = getPref("enableNoteReplaceMode") as boolean;
                if (replaceMode) {
                  annotation.text = task.result;
                } else {
                  annotation.comment = task.result;
                }
                // @ts-ignore should be fixed in the zotero-types
                reader._addToNote([annotation]);
              },
            },
          ],
        },
        {
          tag: "div",
          id: makeId("fontsizebox"),
          classList: [
            `${config.addonRef}-readerpopup`,
            `${config.addonRef}-popup-fontsizebox`,
          ],
          styles: {
            display: getPref("showPopupFontSizeControls") ? "flex" : "none",
            flexDirection: "row",
            flexWrap: "nowrap",
            alignItems: "center",
            justifyContent: "center",
            whiteSpace: "nowrap",
            width: "calc(100% - 4px)",
            marginLeft: "2px",
            marginTop: "6px",
            marginBottom: "2px",
          },
          ignoreIfExists: true,
          children: [
            {
              tag: "span",
              namespace: "html",
              styles: {
                flex: "0 0 auto",
                fontSize: "12px",
                lineHeight: "1",
                whiteSpace: "nowrap",
                opacity: "0.8",
                // Gap between the label and the box
                marginInlineEnd: "10px",
              },
              properties: {
                innerHTML: getString("readerpopup-fontSize-label"),
              },
            },
            {
              tag: "input",
              namespace: "html",
              id: makeId("fontsize-value"),
              attributes: {
                type: "number",
                min: String(MIN_FONT_SIZE),
                max: String(MAX_FONT_SIZE),
                step: "1",
                title: getString("readerpopup-fontSize-hint"),
              },
              styles: {
                // Hide the native spinner, the steppers sit outside the box
                appearance: "textfield",
                flex: "0 0 auto",
                boxSizing: "border-box",
                fontSize: "12px",
                lineHeight: "1.2",
                width: "52px",
                // Breathing room between the digits and the box border
                padding: "4px 8px",
                textAlign: "center",
                border: "1px solid var(--fill-quinary)",
                borderRadius: "5px",
                background: "var(--color-sidepane)",
                color: "inherit",
                margin: "0",
                verticalAlign: "middle",
              },
              properties: {
                value: String(getFontSize()),
                spellcheck: false,
                // Do not let the reader swallow the typing/clicks
                onpointerup: (e: Event) => e.stopPropagation(),
                onpointerdown: (e: Event) => e.stopPropagation(),
                ondragstart: (e: Event) => e.stopPropagation(),
              },
              listeners: [
                {
                  type: "keydown",
                  listener: (ev) => {
                    const event = ev as KeyboardEvent;
                    event.stopPropagation();
                    if (event.key === "Enter") {
                      applyPopupFontSizeInput(popup, makeId("fontsize-value"));
                    } else if (
                      event.key === "ArrowUp" ||
                      event.key === "ArrowDown"
                    ) {
                      // Step immediately, like the arrows next to the box
                      event.preventDefault();
                      const newSize = adjustFontSize(
                        event.key === "ArrowUp" ? 1 : -1,
                      );
                      (event.target as HTMLInputElement).value =
                        String(newSize);
                      updatePopupFontSize(popup);
                    }
                  },
                },
                {
                  type: "change",
                  listener: () => {
                    applyPopupFontSizeInput(popup, makeId("fontsize-value"));
                  },
                },
              ],
            },
            {
              tag: "div",
              styles: {
                display: "inline-flex",
                flex: "0 0 auto",
                flexWrap: "nowrap",
                alignItems: "center",
                verticalAlign: "middle",
                // Gap between the box and the arrows (+2px from the button)
                marginInlineStart: "8px",
              },
              children: [
                makeFontSizeStepper(
                  makeId("fontsize-down"),
                  "‹",
                  -1,
                  popup,
                  getString("readerpopup-fontSize-decrease"),
                ),
                makeFontSizeStepper(
                  makeId("fontsize-up"),
                  "›",
                  1,
                  popup,
                  getString("readerpopup-fontSize-increase"),
                ),
              ],
            },
          ],
        },
      ],
    }),
  );

  // Ctrl/Cmd + wheel over the translation text zooms it
  const textarea = popup.querySelector(
    `#${makeId("text")}`,
  ) as HTMLTextAreaElement | null;
  if (textarea) {
    registerFontSizeWheelZoom(textarea, () => updatePopupFontSize(popup));
  }
}

/**
 * A small stepper arrow sitting outside the font size box.
 */
function makeFontSizeStepper(
  id: string,
  glyph: string,
  delta: number,
  popup: HTMLDivElement,
  title: string,
): TagElementProps {
  return {
    tag: "button",
    namespace: "html",
    id,
    attributes: {
      tabindex: "-1",
      title,
    },
    styles: {
      display: "inline-flex",
      flex: "0 0 auto",
      alignItems: "center",
      justifyContent: "center",
      verticalAlign: "middle",
      width: "18px",
      height: "18px",
      padding: "0",
      margin: "0",
      marginInlineStart: "2px",
      minWidth: "auto",
      maxWidth: "18px",
      border: "none",
      borderRadius: "4px",
      background: "transparent",
      color: "inherit",
      fontSize: "13px",
      // Keep the row on a single, even baseline
      lineHeight: "1",
      opacity: "0.6",
      cursor: "pointer",
    },
    properties: { innerHTML: glyph },
    listeners: [
      {
        type: "click",
        listener: (ev: Event) => {
          ev.stopPropagation();
          adjustFontSize(delta);
          updatePopupFontSize(popup);
        },
      },
      {
        type: "mouseover",
        listener: (ev: Event) => {
          const button = ev.currentTarget as HTMLElement;
          button.style.opacity = "1";
          button.style.background = "var(--fill-quinary)";
        },
      },
      {
        type: "mouseout",
        listener: (ev: Event) => {
          const button = ev.currentTarget as HTMLElement;
          button.style.opacity = "0.6";
          button.style.background = "transparent";
        },
      },
    ],
  };
}

/**
 * Apply the current font size to the popup textarea and sync the input box.
 */
export function updatePopupFontSize(popup?: HTMLDivElement | null) {
  const targetPopup = popup || addon.data.popup.currentPopup;
  if (!targetPopup) {
    return;
  }
  const idPrefix = targetPopup.getAttribute(`${config.addonRef}-prefix`);
  const input = targetPopup.querySelector(
    `#${idPrefix}-fontsize-value`,
  ) as HTMLInputElement | null;
  // Don't fight the user while they are typing in the box
  if (input && input.ownerDocument.activeElement !== input) {
    input.value = String(getFontSize());
  }
  const textarea = targetPopup.querySelector(
    `#${idPrefix}-text`,
  ) as HTMLTextAreaElement | null;
  if (textarea) {
    applyFontSizeStyle(textarea, { lineHeightInPx: true });
    updatePopupSize(targetPopup as HTMLDivElement, textarea);
  }
}

/**
 * Read the font size typed in the popup input box and apply it.
 */
function applyPopupFontSizeInput(popup: HTMLDivElement, inputId: string) {
  const input = popup.querySelector(`#${inputId}`) as HTMLInputElement | null;
  if (!input) {
    return;
  }
  const value = Number(input.value);
  if (!Number.isFinite(value) || input.value.trim() === "") {
    // Invalid input: restore the current size
    input.value = String(getFontSize());
    return;
  }
  const newSize = setFontSize(value);
  input.value = String(newSize);
  updatePopupFontSize(popup);
}

function onTextAreaResize(ev: MouseEvent) {
  if (getPref("keepPopupSize")) {
    const textarea = ev.target as HTMLTextAreaElement;
    setPref("popupWidth", textarea.offsetWidth);
    setPref("popupHeight", textarea.offsetHeight);
  }
}

function getOnTextAreaCopy(selectionMenu: HTMLElement, targetId: string) {
  return (ev: KeyboardEvent) => {
    const textarea = selectionMenu.querySelector(
      `#${targetId}`,
    ) as HTMLTextAreaElement;
    const isMod = ev.ctrlKey || ev.metaKey;
    if (ev.key === "c" && isMod) {
      ztoolkit.getGlobal("setTimeout")(() => {
        new ztoolkit.Clipboard()
          .addText(
            textarea.value.slice(
              textarea.selectionStart,
              textarea.selectionEnd,
            ),
            "text/plain",
          )
          .copy();
      }, 10);
      ev.stopPropagation();
    } else if (ev.key === "a" && isMod) {
      textarea.selectionStart = 0;
      textarea.selectionEnd = textarea.value.length;
      ev.stopPropagation();
    } else if (ev.key === "x" && isMod) {
      new ztoolkit.Clipboard()
        .addText(
          textarea.value.slice(textarea.selectionStart, textarea.selectionEnd),
          "text/plain",
        )
        .copy();
      textarea.value = `${textarea.value.slice(
        0,
        textarea.selectionStart,
      )}${textarea.value.slice(textarea.selectionEnd)}`;
      ev.stopPropagation();
    }
  };
}

function updatePopupSize(
  selectionMenu: HTMLDivElement,
  textarea: HTMLTextAreaElement,
  resetSize: boolean = true,
): void {
  const keepSize = getPref("keepPopupSize") as boolean;
  if (keepSize) {
    return;
  }
  if (resetSize) {
    textarea.style.width = "-moz-available";
    textarea.style.height = "30px";
  }
  const viewer = selectionMenu.ownerDocument.body;
  // Get current H & W
  const textHeight = textarea.scrollHeight;
  const textWidth = textarea.scrollWidth;
  const newWidth = textWidth + 20;
  // Check until H/W<0.75 and don't overflow viewer border
  if (
    textHeight / textWidth > 0.75 &&
    selectionMenu.offsetLeft + newWidth < viewer.offsetWidth
  ) {
    // Update width
    textarea.style.width = `${newWidth}px`;
    updatePopupSize(selectionMenu, textarea, false);
    return;
  }
  // Update height
  textarea.style.height = `${textHeight + 3}px`;
}
