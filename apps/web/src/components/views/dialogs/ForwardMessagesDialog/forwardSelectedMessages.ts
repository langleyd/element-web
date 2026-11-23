/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { type MatrixClient } from "matrix-js-sdk/src/matrix";

import Modal from "../../../../Modal";
import dis from "../../../../dispatcher/dispatcher";
import { _t } from "../../../../languageHandler";
import { Action } from "../../../../dispatcher/actions";
import { type ViewRoomPayload } from "../../../../dispatcher/payloads/ViewRoomPayload";
import { TimelineRenderingType } from "../../../../contexts/RoomContext";
import { type MessageSelectionStore } from "../../../../stores/MessageSelectionStore";
import { forwardMessages } from "../../../../events/forward/forwardMessages";
import { ForwardMessagesDialog } from "./ForwardMessagesDialog";

/**
 * Open the "Forward to" picker for the selected messages, then forward them.
 *
 * Cancelling the picker keeps the selection. After Send the selection ends, and:
 * - to one chat: that chat opens, with focus in its composer;
 * - to several: the user stays, focus goes back to the composer, and a toast confirms the forward.
 */
export async function forwardSelectedMessages(cli: MatrixClient, store: MessageSelectionStore): Promise<void> {
    const { roomId, threadId } = store.getSnapshot();
    if (!roomId) return;
    const events = store.selectedInTimelineOrder();
    if (events.length === 0) return;

    const { finished } = Modal.createDialog(ForwardMessagesDialog, {
        matrixClient: cli,
        sourceRoomId: roomId,
    });
    const [roomIds] = await finished;
    if (!roomIds?.length) return;

    forwardMessages(cli, events, roomIds);
    store.end();

    if (roomIds.length === 1) {
        dis.dispatch<ViewRoomPayload>({
            action: Action.ViewRoom,
            room_id: roomIds[0],
            metricsTrigger: undefined,
        });
        return;
    }

    store.showNotice(_t("timeline|selection|forwarded", { count: events.length }), roomId, threadId);
    dis.dispatch({
        action: Action.FocusSendMessageComposer,
        context: threadId ? TimelineRenderingType.Thread : TimelineRenderingType.Room,
    });
}
