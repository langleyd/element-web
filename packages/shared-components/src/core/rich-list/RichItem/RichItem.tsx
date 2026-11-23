/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type HTMLAttributes, type JSX, memo } from "react";
import CheckIcon from "@vector-im/compound-design-tokens/assets/web/icons/check";

import classNames from "classnames";

import styles from "./RichItem.module.css";
import { Flex } from "../../utils/Flex";
import { useI18n } from "../../i18n/i18nContext";

export interface RichItemProps extends HTMLAttributes<HTMLLIElement> {
    /**
     * Avatar to display at the start of the item
     */
    avatar: React.ReactNode;
    /**
     * Title to display at the top of the item
     */
    title: string;
    /**
     * Description to display below the title
     */
    description: string;
    /**
     * Timestamp to display at the end of the item
     * The value is humanized (e.g. "5 minutes ago")
     */
    timestamp?: number;
    /**
     * Whether the item is selected
     * This will replace the avatar with a checkmark
     * @default false
     */
    selected?: boolean;
    /**
     * Whether the item can't be chosen right now, for example because a limit is reached.
     * It stays in the list and is announced as unavailable; clicks do nothing.
     * @default false
     */
    disabled?: boolean;
    /** Ref to the list item, for example to move focus to it. */
    ref?: React.Ref<HTMLLIElement>;
}

/**
 * A rich item to display in a list, with an avatar, title, description and optional timestamp.
 * If selected, the avatar is replaced with a checkmark.
 * A separator is added between items in a list.
 *
 * @example
 * ```tsx
 *   <RichItem
 *     avatar={<AvatarComponent />}
 *     title="Rich Item Title"
 *     description="This is a description of the rich item."
 *     timestamp={Date.now() - 5 * 60 * 1000} // 5 minutes ago
 *     selected={true}
 *     onClick={() => console.log("Item clicked")}
 *   />
 * ```
 */
export const RichItem = memo(function RichItem({
    avatar,
    title,
    description,
    timestamp,
    selected,
    disabled,
    onClick,
    ...props
}: RichItemProps): JSX.Element {
    const i18n = useI18n();

    return (
        // The list owns keyboard handling (RichList's listbox, or the caller's keydown handler).
        // oxlint-disable-next-line jsx-a11y/click-events-have-key-events
        <li
            className={classNames(styles.richItem, { [styles.disabled]: disabled })}
            role="option"
            tabIndex={-1}
            aria-selected={selected}
            aria-disabled={disabled || undefined}
            aria-label={title}
            onClick={disabled ? undefined : onClick}
            {...props}
        >
            {selected ? <Checkmark /> : <Flex className={styles.avatar}>{avatar}</Flex>}
            <span className={styles.title}>{title}</span>
            <span className={styles.description}>{description}</span>
            {timestamp && (
                <span role="timer" className={styles.timestamp}>
                    {i18n.humanizeTime(timestamp)}
                </span>
            )}
        </li>
    );
});

/**
 * A checkmark icon inside a circle, used to indicate selection.
 */
function Checkmark(): JSX.Element {
    return (
        <Flex align="center" justify="center" aria-hidden="true" className={styles.checkmark}>
            <CheckIcon width="24px" height="24px" color="var(--cpd-color-icon-on-solid-primary)" />
        </Flex>
    );
}
