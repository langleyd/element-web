/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { useEffect, useRef, type JSX, type KeyboardEvent } from "react";
import { Button, Text } from "@vector-im/compound-web";
import ForwardIcon from "@vector-im/compound-design-tokens/assets/web/icons/forward";

import styles from "./MessageSelectionBarView.module.css";
import { type ViewModel, useViewModel } from "../../../core/viewmodel";
import { useI18n } from "../../../core/i18n/i18nContext";

export interface MessageSelectionBarViewSnapshot {
    /** How many messages are selected. */
    count: number;
}

export interface MessageSelectionBarViewActions {
    /** Leave selection mode without doing anything. Also called on Escape. */
    cancel: () => void;
    /** Go on with the action (Forward) for the selected messages. */
    forward: () => void;
}

/** The view model for {@link MessageSelectionBarView}. */
export type MessageSelectionBarViewModel = ViewModel<MessageSelectionBarViewSnapshot, MessageSelectionBarViewActions>;

interface MessageSelectionBarViewProps {
    /** The view model for the bar. */
    vm: MessageSelectionBarViewModel;
    /** Whether to move focus to Forward when the bar appears, so Enter goes straight on. */
    autoFocus?: boolean;
}

/**
 * The bar that replaces the message composer while messages are being selected:
 * a live count, Cancel, and Forward (disabled when nothing is selected).
 *
 * @example
 * ```tsx
 * <MessageSelectionBarView vm={messageSelectionBarViewModel} autoFocus />
 * ```
 */
export function MessageSelectionBarView({ vm, autoFocus }: Readonly<MessageSelectionBarViewProps>): JSX.Element {
    const { count } = useViewModel(vm);
    const i18n = useI18n();
    const forwardRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        if (!autoFocus) return;
        // Wait for the menu that started selection mode to close and hand focus back first
        const timer = window.setTimeout(() => forwardRef.current?.focus(), 0);
        return () => window.clearTimeout(timer);
    }, [autoFocus]);

    const onKeyDown = (ev: KeyboardEvent<HTMLDivElement>): void => {
        if (ev.key === "Escape") {
            ev.preventDefault();
            ev.stopPropagation();
            vm.cancel();
        }
    };

    return (
        <div
            className={styles.bar}
            role="toolbar"
            aria-label={i18n.translate("room|selection_bar|label")}
            onKeyDown={onKeyDown}
        >
            <ForwardIcon className={styles.icon} width="24px" height="24px" aria-hidden="true" />
            <Text as="span" size="md" weight="semibold" className={styles.count}>
                {i18n.translate("room|selection_bar|count", { count })}
            </Text>
            <Button kind="secondary" size="md" onClick={vm.cancel}>
                {i18n.translate("action|cancel")}
            </Button>
            <Button ref={forwardRef} kind="primary" size="md" onClick={vm.forward} disabled={count === 0}>
                {i18n.translate("action|forward")}
            </Button>
        </div>
    );
}
