/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */
import { type Meta, type StoryObj } from "@storybook/react-vite";
import React, { type JSX } from "react";
import { fn } from "storybook/test";

import { useMockedViewModel } from "../../../core/viewmodel";
import { withViewDocs } from "../../../../.storybook/withViewDocs";
import {
    MessageSelectionBarView,
    type MessageSelectionBarViewActions,
    type MessageSelectionBarViewSnapshot,
} from "./MessageSelectionBarView";

type MessageSelectionBarProps = MessageSelectionBarViewSnapshot & MessageSelectionBarViewActions;

const MessageSelectionBarViewWrapperImpl = ({ cancel, forward, ...rest }: MessageSelectionBarProps): JSX.Element => {
    const vm = useMockedViewModel(rest, { cancel, forward });
    return <MessageSelectionBarView vm={vm} />;
};
const MessageSelectionBarViewWrapper = withViewDocs(MessageSelectionBarViewWrapperImpl, MessageSelectionBarView);

const meta = {
    title: "Room/Composer/MessageSelectionBarView",
    component: MessageSelectionBarViewWrapper,
    tags: ["autodocs"],
    args: {
        count: 4,
        cancel: fn(),
        forward: fn(),
    },
} satisfies Meta<typeof MessageSelectionBarViewWrapper>;

export default meta;
type Story = StoryObj<typeof MessageSelectionBarViewWrapper>;

/** Messages are selected: Forward is enabled. */
export const Default: Story = {};

/** Everything was deselected: selection mode stays open, Forward is disabled. */
export const NothingSelected: Story = {
    args: { count: 0 },
};
