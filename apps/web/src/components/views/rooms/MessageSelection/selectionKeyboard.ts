/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { type KeyboardEvent } from "react";
import { type MatrixEvent } from "matrix-js-sdk/src/matrix";

import { type MessageSelectionStore } from "../../../../stores/MessageSelectionStore";

/** The event each tile in selection mode renders, so keyboard handling can select a tile it moves to. */
const tileEvents = new WeakMap<Element, MatrixEvent>();

/** Record which event a tile's root element renders. */
export function registerSelectionTile(element: Element | null, event: MatrixEvent): void {
    if (element) tileEvents.set(element, event);
}

/** The tiles of the selection list, in timeline order. */
function getOptions(tile: HTMLElement): HTMLElement[] {
    const list = tile.closest("ol") ?? tile.parentElement;
    if (!list) return [];
    return Array.from(list.querySelectorAll<HTMLElement>("[data-selection-state]"));
}

function moveFocus(target: HTMLElement): void {
    target.focus({ preventScroll: true });
    target.scrollIntoView({ block: "nearest" });
}

/**
 * Leave selection mode and put focus back on the message selection started from, keeping the scroll position.
 */
export function endSelectionAndRestoreFocus(store: MessageSelectionStore): void {
    const { originEventId } = store.getSnapshot();
    store.end();
    if (!originEventId) return;
    // Wait for the tiles to leave selection mode and the composer to come back
    window.setTimeout(() => {
        const tile = document.querySelector<HTMLElement>(`.mx_RoomView_MessageList [data-event-id="${originEventId}"]`);
        tile?.focus({ preventScroll: true });
    }, 0);
}

/**
 * Keyboard model for the timeline in selection mode, following the WAI-ARIA multi-select listbox pattern:
 * Up and Down move focus, Space toggles, Shift+Up and Shift+Down move to the next selectable message and select it,
 * Escape leaves selection mode. Tab leaves the list, as the list is one tab stop.
 */
export function onSelectionTileKeyDown(
    ev: KeyboardEvent<HTMLElement>,
    store: MessageSelectionStore,
    event: MatrixEvent,
): void {
    const tile = ev.currentTarget;
    switch (ev.key) {
        case "ArrowUp":
        case "ArrowDown": {
            ev.preventDefault();
            ev.stopPropagation();
            const options = getOptions(tile);
            const step = ev.key === "ArrowUp" ? -1 : 1;
            let index = options.indexOf(tile) + step;
            if (ev.shiftKey) {
                // Extending the selection skips messages that can't be selected
                while (options[index]?.dataset.selectionState === "unavailable") index += step;
            }
            const target = options[index];
            if (!target) return;
            moveFocus(target);
            const targetEvent = tileEvents.get(target);
            if (ev.shiftKey && targetEvent) store.select(targetEvent);
            return;
        }
        case " ":
            ev.preventDefault();
            ev.stopPropagation();
            store.toggle(event);
            return;
        case "Escape":
            ev.preventDefault();
            ev.stopPropagation();
            endSelectionAndRestoreFocus(store);
            return;
    }
}
