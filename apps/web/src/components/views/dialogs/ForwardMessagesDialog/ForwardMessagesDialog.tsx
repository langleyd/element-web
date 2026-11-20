/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX } from "react";
import { type MatrixClient } from "matrix-js-sdk/src/matrix";
import { Text } from "@vector-im/compound-web";
import { RoomPickerView, useCreateAutoDisposedViewModel, useViewModel } from "@element-hq/web-shared-components";

import BaseDialog from "../BaseDialog";
import DialogButtons from "../../elements/DialogButtons";
import { _t } from "../../../../languageHandler";
import { ForwardMessagesDialogViewModel } from "../../../../viewmodels/forward/ForwardMessagesDialogViewModel";

interface ForwardMessagesDialogProps {
    /** The client whose rooms are offered. */
    matrixClient: MatrixClient;
    /** The room the messages come from. */
    sourceRoomId: string;
    /** How many messages are being forwarded. */
    messageCount: number;
    /** Whether the messages come from a thread. */
    fromThread: boolean;
    /** Called with the chosen room ids on Send, or with nothing on Cancel. */
    onFinished: (roomIds?: string[]) => void;
}

/**
 * The "Forward to" picker for forwarding several messages: up to 5 chats, then Send.
 */
export function ForwardMessagesDialog({ onFinished, ...props }: ForwardMessagesDialogProps): JSX.Element {
    const vm = useCreateAutoDisposedViewModel(() => new ForwardMessagesDialogViewModel({ ...props, onFinished }));
    const { canSend, limitText, summaryText, threadText, slowText } = useViewModel(vm);

    return (
        <BaseDialog
            className="mx_ForwardMessagesDialog"
            onFinished={vm.cancel}
            title={_t("forward|multi|title")}
            hasCancel={true}
        >
            <RoomPickerView vm={vm} />
            <div className="mx_ForwardMessagesDialog_notes" aria-live="polite">
                {limitText && (
                    <Text as="p" size="sm" className="mx_ForwardMessagesDialog_limit">
                        {limitText}
                    </Text>
                )}
                {summaryText && (
                    <Text as="p" size="sm" weight="semibold">
                        {summaryText}
                    </Text>
                )}
                {threadText && (
                    <Text as="p" size="sm">
                        {threadText}
                    </Text>
                )}
                {slowText && (
                    <Text as="p" size="sm">
                        {slowText}
                    </Text>
                )}
            </div>
            <DialogButtons
                primaryButton={_t("forward|send_label")}
                primaryDisabled={!canSend}
                hasCancel={true}
                onCancel={vm.cancel}
                onPrimaryButtonClick={vm.send}
            />
        </BaseDialog>
    );
}
