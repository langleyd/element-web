/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX, type ReactNode, useEffect, useSyncExternalStore } from "react";
import { Toast } from "@vector-im/compound-web";
import { MessageSelectionBarView, useCreateAutoDisposedViewModel } from "@element-hq/web-shared-components";

import { SDKContextClass } from "../../../../contexts/SDKContextClass";
import { MatrixClientPeg } from "../../../../MatrixClientPeg";
import { type MessageSelectionStore } from "../../../../stores/MessageSelectionStore";
import { MessageSelectionBarViewModel } from "../../../../viewmodels/room/MessageSelectionBarViewModel";
import { forwardSelectedMessages } from "../../dialogs/ForwardMessagesDialog/forwardSelectedMessages";
import { endSelectionAndRestoreFocus } from "./selectionKeyboard";

interface MessageSelectionAreaProps {
    /** The room of the timeline above. */
    roomId: string;
    /** The thread of the timeline above, or null for the main timeline. */
    threadId: string | null;
    /** The composer, shown when the timeline above is not in selection mode. */
    children: ReactNode;
}

/** Subscribe to the selection store from a function component. */
export function useMessageSelection(): ReturnType<MessageSelectionStore["getSnapshot"]> {
    const store = SDKContextClass.instance.messageSelectionStore;
    return useSyncExternalStore(store.subscribe, store.getSnapshot);
}

function SelectionBar({ store }: { store: MessageSelectionStore }): JSX.Element {
    const vm = useCreateAutoDisposedViewModel(
        () =>
            new MessageSelectionBarViewModel({
                store,
                onCancel: () => endSelectionAndRestoreFocus(store),
                onForward: () => void forwardSelectedMessages(MatrixClientPeg.safeGet(), store),
            }),
    );
    return <MessageSelectionBarView vm={vm} autoFocus />;
}

/**
 * The bottom of a room or thread view: the composer, or the selection bar while the timeline above is in selection
 * mode. Also hosts the selection notices (limit reached, messages forwarded) and the screen reader announcements.
 * Selection mode in this timeline ends when the room or thread changes or goes away.
 */
export function MessageSelectionArea({ roomId, threadId, children }: MessageSelectionAreaProps): JSX.Element {
    const store = SDKContextClass.instance.messageSelectionStore;
    const snapshot = useMessageSelection();
    const selecting = store.isActiveFor(roomId, threadId);
    const notice =
        snapshot.notice?.roomId === roomId && snapshot.notice.threadId === threadId ? snapshot.notice : null;
    const scope = snapshot.announcementScope;
    const announcement = scope?.roomId === roomId && scope.threadId === threadId ? snapshot.announcement : "";

    useEffect(() => () => store.endIfActiveFor(roomId, threadId), [store, roomId, threadId]);

    return (
        <>
            <div className="mx_MessageSelectionArea_notice">
                {/* Announced through the live region below */}
                {notice && <Toast key={notice.id}>{notice.text}</Toast>}
            </div>
            <div className="mx_MessageSelectionArea_announcer" role="status" aria-live="polite">
                {announcement}
            </div>
            {selecting ? <SelectionBar store={store} /> : children}
        </>
    );
}
