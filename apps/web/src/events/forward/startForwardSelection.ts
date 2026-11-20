/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { type MatrixClient, type MatrixEvent } from "matrix-js-sdk/src/matrix";

import SettingsStore from "../../settings/SettingsStore";
import { TimelineRenderingType } from "../../contexts/RoomContext";
import { SDKContextClass } from "../../contexts/SDKContextClass";
import { isSelectableForForward } from "./isSelectableForForward";

/**
 * Enter selection mode for Forward on a message, if that is the flow for where the message was chosen.
 *
 * It is when `feature_multi_select_forward` is on, the message is in a room's main timeline or a thread on the
 * default timeline, and the message can be selected. Otherwise (the image viewer, the pinned list, search results,
 * stickers, live locations, the labs timeline) the caller opens today's single-message forward dialog.
 *
 * @returns Whether selection mode was entered.
 */
export function startForwardSelection(
    cli: MatrixClient,
    event: MatrixEvent,
    timelineRenderingType: TimelineRenderingType,
    threadId: string | undefined,
): boolean {
    if (!SettingsStore.getValue("feature_multi_select_forward")) return false;
    if (SettingsStore.getValue("feature_new_timeline")) return false;
    if (timelineRenderingType !== TimelineRenderingType.Room && timelineRenderingType !== TimelineRenderingType.Thread) {
        return false;
    }
    if (!isSelectableForForward(event)) return false;
    const room = cli.getRoom(event.getRoomId());
    if (!room) return false;

    const inThread = timelineRenderingType === TimelineRenderingType.Thread;
    if (inThread && !threadId) return false;
    SDKContextClass.instance.messageSelectionStore.start(room, inThread ? threadId! : null, event, "forward");
    return true;
}
