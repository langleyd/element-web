/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import type React from "react";

/** Timeline rendering modes supported by the EventTile shell. */
export type EventTileRenderingMode =
    | "Room"
    | "Card"
    | "Thread"
    | "ThreadsList"
    | "File"
    | "Notification"
    | "Search"
    | "Pinned";

/** Conditional state used to derive EventTile root classes. */
export interface EventTileViewRootState {
    /** Whether the event belongs to the current user. */
    isOwnEvent: boolean;
    /** Whether EventTile renders a reply chain. */
    hasReply: boolean;
    /** Whether the event is an informational timeline item. */
    info?: boolean;
    /** Whether the event uses the bubble container shell. */
    bubbleContainer?: boolean;
    /** Whether the bubble is aligned to the left. */
    leftAlignedBubble?: boolean;
    /** Whether the event is aligned between bubble columns. */
    alignedBetweenBubbles?: boolean;
    /** Whether bubble styling is suppressed for this event. */
    noBubble?: boolean;
    /** Whether sender details are hidden. */
    noSender?: boolean;
    /** Whether the event failed decryption. */
    encryptionFailure?: boolean;
    /** Whether the event body is an emote. */
    emote?: boolean;
    /** Whether the event is highlighted by search or navigation. */
    highlighted?: boolean;
    /** Whether the event is selected. */
    selected?: boolean;
    /** Whether the event is currently being edited. */
    editing?: boolean;
    /** Whether the event continues the previous event block. */
    continuation?: boolean;
    /** Whether this is the last event in a section. */
    lastInSection?: boolean;
    /** Whether the tile is a contextual search result. */
    contextual?: boolean;
    /** Whether the action bar currently has focus. */
    actionBarFocused?: boolean;
    /** Whether the body should be clamped to a preview. */
    previewClamped?: boolean;
}

/** Semantic state consumed by EventTileView for the event line. */
export interface EventTileViewLine {
    /** Whether the event body is likely to render media content. */
    media?: boolean;
    /** Whether the event is a sticker. */
    sticker?: boolean;
    /** Whether the event body is an emote. */
    emote?: boolean;
    /** Whether the event body is an image. */
    image?: boolean;
}

/** Complete root state consumed by EventTileView. */
export interface EventTileViewRoot {
    /** Stable unique id for the component instance. */
    id: string;
    /** Element used for the EventTile root. Defaults to `li`. */
    as?: React.ElementType;
    /** Optional aria-live value for the root element. */
    ariaLive?: "off";
    /** Stable event scroll token. */
    scrollToken?: string;
    /** Optional permalink used by sender details. */
    permalink?: string;
    /** Optional event identifier exposed through `data-event-id`. */
    eventId?: string;
    /** Timeline rendering mode. */
    shape: EventTileRenderingMode;
    /** Conditional state classes and styling state. */
    state: EventTileViewRootState;
}

/** Optional application CSS class overrides for shell-owned structural elements and slot boundaries. */
export interface EventTileViewClassNames {
    root?: string;
    line?: string;
    details?: string;
    senderDetails?: string;
    senderDetailsLink?: string;
    slotActionBar?: string;
    slotAvatar?: string;
    slotBody?: string;
    slotContextMenu?: string;
    slotFooter?: string;
    slotNotificationRoomLabel?: string;
    slotNotificationBadge?: string;
    slotPadlock?: string;
    slotReceipt?: string;
    slotReplyChain?: string;
    slotSender?: string;
    slotThreadInfo?: string;
    slotTimestamp?: string;
}

/** Render-ready children supplied by the application integration layer. */
export interface EventTileViewSlots {
    /** Sender avatar for the current rendering mode. */
    avatar?: React.ReactNode;
    /** Sender profile/details. */
    sender?: React.ReactNode;
    /** Main event body. */
    body: React.ReactNode;
    /** Timestamp rendered by the shell according to the current layout. */
    timestamp?: React.ReactNode;
    /** Padlock rendered by the shell according to the current layout. */
    padlock?: React.ReactNode;
    /** Reply chain rendered above the event body. */
    replyChain?: React.ReactNode;
    /** Action bar rendered by the shell according to the current rendering mode. */
    actionBar?: React.ReactNode;
    /** Event footer rendered by the shell according to the current layout. */
    footer?: React.ReactNode;
    /** Thread information rendered by the shell according to the current layout. */
    threadInfo?: React.ReactNode;
    /** Read receipt or send-state indicator. */
    receipt?: React.ReactNode;
    /** Room avatar used by notification tiles. */
    roomAvatar?: React.ReactNode;
    /** Notification room-name label. */
    notificationRoomLabel?: React.ReactNode;
    /** Unread notification badge. */
    notificationBadge?: React.ReactNode;
    /** Context menu rendered inside the event line. */
    contextMenu?: React.ReactNode;
}

/** DOM refs supplied by the application integration layer. */
export interface EventTileViewRefs {
    /** Ref attached to the root element. */
    root?: React.Ref<HTMLElement>;
}

/** DOM handlers supplied by the application integration layer. */
export interface EventTileViewHandlers {
    /** Root hover start. */
    onMouseEnter?: React.MouseEventHandler<HTMLElement>;
    /** Root hover end. */
    onMouseLeave?: React.MouseEventHandler<HTMLElement>;
    /** Root focus entry. */
    onFocus?: React.FocusEventHandler<HTMLElement>;
    /** Root focus exit. */
    onBlur?: React.FocusEventHandler<HTMLElement>;
    /** Event click. */
    onClick?: React.MouseEventHandler<HTMLElement>;
    /** Event context menu. */
    onContextMenu?: React.MouseEventHandler<HTMLElement>;
    /** Permalink click. */
    onPermalinkClick?: React.MouseEventHandler<HTMLAnchorElement>;
    /** Permalink context menu. */
    onPermalinkContextMenu?: React.MouseEventHandler<HTMLElement>;
}

/** How a tile takes part in timeline selection mode. */
export type EventTileSelectionState = "selected" | "unselected" | "unavailable";

/**
 * Selection mode state for a tile. When set, the tile is an option in a multi-select list: it shows a checkbox
 * (unless it can't be selected), its content stops being interactive, and a click toggles it.
 */
export interface EventTileViewSelection {
    /** Whether the tile is selected, can be selected, or can't be selected. */
    state: EventTileSelectionState;
    /** Accessible name for the tile, as its content is not interactive while selecting. */
    label: string;
    /** Whether the tile is the list's tab stop (roving tabindex). */
    tabbable: boolean;
    /**
     * Where the checkbox sits against the message: level with the line where a text message starts, or centred on
     * the content of a media message (image, video, audio, file, location). Defaults to "start".
     */
    align?: "start" | "center";
    /** Click anywhere on the tile. */
    onToggle: React.MouseEventHandler<HTMLElement>;
    /** Keyboard handling for the list (arrows, Space, Escape). */
    onKeyDown: React.KeyboardEventHandler<HTMLElement>;
}

/** Props for the shared EventTile shell. */
export interface EventTileViewProps extends EventTileViewHandlers {
    /** Pure root render state. */
    root: EventTileViewRoot;
    /** Optional semantic state for the event line. */
    line?: EventTileViewLine;
    /** Optional application CSS class overrides for shell-owned elements. */
    classNames?: EventTileViewClassNames;
    /** Render-ready children supplied by the application layer. Each slot is rendered inside a named shell boundary. */
    slots: EventTileViewSlots;
    /** DOM refs supplied by the application layer. */
    refs?: EventTileViewRefs;
    /** Selection mode state; omitted outside selection mode. */
    selection?: EventTileViewSelection;
}
