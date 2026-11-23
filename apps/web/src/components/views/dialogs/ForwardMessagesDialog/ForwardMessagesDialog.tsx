/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX } from "react";
import { type MatrixClient } from "matrix-js-sdk/src/matrix";
import { Button, Text } from "@vector-im/compound-web";
import { RoomPickerView, useCreateAutoDisposedViewModel, useViewModel } from "@element-hq/web-shared-components";

import BaseDialog from "../BaseDialog";
import { _t } from "../../../../languageHandler";
import { ForwardMessagesDialogViewModel } from "../../../../viewmodels/forward/ForwardMessagesDialogViewModel";

interface ForwardMessagesDialogProps {
    /** The client whose rooms are offered. */
    matrixClient: MatrixClient;
    /** The room the messages come from. */
    sourceRoomId: string;
    /** Called with the chosen room ids on Forward, or with nothing on Cancel. */
    onFinished: (roomIds?: string[]) => void;
}

/**
 * The "Forward to" picker for forwarding several messages: up to 5 chats, then Forward.
 * It keeps the same height whatever the list holds, so it doesn't jump while the user searches.
 */
export function ForwardMessagesDialog({ onFinished, ...props }: ForwardMessagesDialogProps): JSX.Element {
    const vm = useCreateAutoDisposedViewModel(() => new ForwardMessagesDialogViewModel({ ...props, onFinished }));
    const { canSend, limitText } = useViewModel(vm);

    return (
        <BaseDialog
            className="mx_ForwardMessagesDialog"
            onFinished={vm.cancel}
            title={_t("forward|multi|title")}
            hasCancel={true}
        >
            <RoomPickerView vm={vm} className="mx_ForwardMessagesDialog_picker" />
            <div className="mx_ForwardMessagesDialog_notes" aria-live="polite">
                {limitText && (
                    <Text as="p" size="sm" className="mx_ForwardMessagesDialog_limit">
                        {limitText}
                    </Text>
                )}
            </div>
            <div className="mx_ForwardMessagesDialog_buttons">
                <Button size="lg" kind="secondary" onClick={vm.cancel}>
                    {_t("action|cancel")}
                </Button>
                <Button size="lg" kind="primary" disabled={!canSend} onClick={vm.send}>
                    {_t("action|forward")}
                </Button>
            </div>
        </BaseDialog>
    );
}
