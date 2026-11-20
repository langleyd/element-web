/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { EventType, MsgType, type MatrixEvent } from "matrix-js-sdk/src/matrix";

import { isContentActionable } from "../../utils/EventUtils";

/**
 * The message types that can be selected for a multi-message forward, as on Element X.
 * Voice messages are `m.audio`; static locations are `m.location`.
 */
const SELECTABLE_MSGTYPES = new Set<string>([
    MsgType.Text,
    MsgType.Emote,
    MsgType.Notice,
    MsgType.Image,
    MsgType.Video,
    MsgType.Audio,
    MsgType.File,
    MsgType.Location,
]);

/**
 * Whether an event can be selected in selection mode to be forwarded with others.
 *
 * Unsent, redacted and undecryptable messages are ruled out by {@link isContentActionable}.
 * Stickers, polls, live locations, call events and state events are not `m.room.message` and are ruled out too:
 * Forward on those keeps opening the single-message forward dialog.
 */
export function isSelectableForForward(event: MatrixEvent): boolean {
    if (!isContentActionable(event)) return false;
    if (event.getType() !== EventType.RoomMessage) return false;
    return SELECTABLE_MSGTYPES.has(event.getContent().msgtype ?? "");
}
