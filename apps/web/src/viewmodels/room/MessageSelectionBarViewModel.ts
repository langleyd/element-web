/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import {
    BaseViewModel,
    type MessageSelectionBarViewActions,
    type MessageSelectionBarViewSnapshot,
} from "@element-hq/web-shared-components";

import { type MessageSelectionStore } from "../../stores/MessageSelectionStore";

interface MessageSelectionBarViewModelProps {
    /** The selection the bar shows. */
    store: MessageSelectionStore;
    /** Open the "Forward to" picker for the selected messages. */
    onForward: () => void;
    /** Leave selection mode. */
    onCancel: () => void;
}

/**
 * View model for the bar that replaces the composer in selection mode.
 */
export class MessageSelectionBarViewModel
    extends BaseViewModel<MessageSelectionBarViewSnapshot, MessageSelectionBarViewModelProps>
    implements MessageSelectionBarViewActions
{
    public constructor(props: MessageSelectionBarViewModelProps) {
        super(props, { count: props.store.getSnapshot().selectedIds.size });
        this.disposables.track(
            props.store.subscribe(() => {
                this.snapshot.merge({ count: props.store.getSnapshot().selectedIds.size });
            }),
        );
    }

    public cancel = (): void => {
        this.props.onCancel();
    };

    public forward = (): void => {
        if (this.getSnapshot().count === 0) return;
        this.props.onForward();
    };
}
