/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX, useCallback, useEffect, useMemo, useRef } from "react";

import {
    GroupedVirtualizedList,
    getContainerAccessibleProps,
    type Group,
    type VirtualizedListContext,
} from "../VirtualizedList";
import { RichItem } from "../rich-list/RichItem";
import type { RoomOfRoomPickerView, RoomPickerViewSection } from "./RoomPickerView";
import styles from "./RoomPickerView.module.css";

interface Context {
    /** Total number of rooms across all sections, for `aria-setsize`. */
    roomCount: number;
    /** The first room in the list, which is the tab stop until the user moves to another. */
    firstRoomId?: string;
}

interface RoomPickerSectionedListProps {
    /** The sections to show, each with a title and its rooms. Empty sections are not shown. */
    sections: RoomPickerViewSection[];
    /** Accessible name of the list. */
    label: string;
    /** Renders the avatar of a room. */
    renderRoomAvatar: (room: RoomOfRoomPickerView, size: string) => React.ReactNode;
    /** Called when a room is clicked, or chosen with Enter or Space. */
    onRoomClick: (room: RoomOfRoomPickerView) => void;
}

const getItemKey = (room: RoomOfRoomPickerView): string => room.id;
const getHeaderKey = (section: RoomPickerViewSection): string => `section-${section.id}`;
const isItemFocusable = (): boolean => true;
// Section titles are labels, not stops: arrow keys move from room to room.
const isGroupHeaderFocusable = (): boolean => false;

interface RoomPickerItemProps {
    room: RoomOfRoomPickerView;
    index: number;
    setSize: number;
    /** Whether the room is the list's tab stop. */
    isTabStop: boolean;
    /** Whether the room should have DOM focus: the list has focus and this room is its tab stop. */
    isFocused: boolean;
    avatar: React.ReactNode;
    onFocus: (room: RoomOfRoomPickerView, e: React.FocusEvent) => void;
    onRoomClick: (room: RoomOfRoomPickerView) => void;
}

/** A room in the sectioned list. It takes focus when the list moves its tab stop here with the arrow keys. */
function RoomPickerItem({
    room,
    index,
    setSize,
    isTabStop,
    isFocused,
    avatar,
    onFocus,
    onRoomClick,
}: Readonly<RoomPickerItemProps>): JSX.Element {
    const ref = useRef<HTMLLIElement>(null);
    useEffect(() => {
        if (isFocused && document.activeElement !== ref.current) ref.current?.focus({ preventScroll: true });
    }, [isFocused]);

    return (
        <RichItem
            ref={ref}
            title={room.name}
            description={room.description}
            timestamp={room.timestamp}
            avatar={avatar}
            selected={room.selected}
            disabled={room.disabled}
            tabIndex={isTabStop ? 0 : -1}
            aria-posinset={index + 1}
            aria-setsize={setSize}
            onFocus={(e) => onFocus(room, e)}
            onClick={() => onRoomClick(room)}
            onKeyDown={(e) => {
                if (e.key !== "Enter" && e.key !== " ") return;
                e.preventDefault();
                if (!room.disabled) onRoomClick(room);
            }}
        />
    );
}

/**
 * The room list of the {@link RoomPickerView} when it has sections: a virtualized listbox with a title above
 * each section, which scrolls through every room however many there are.
 */
export function RoomPickerSectionedList({
    sections,
    label,
    renderRoomAvatar,
    onRoomClick,
}: Readonly<RoomPickerSectionedListProps>): JSX.Element {
    const groups = useMemo<Group<RoomPickerViewSection, RoomOfRoomPickerView>[]>(
        () =>
            sections
                .filter((section) => section.rooms.length > 0)
                .map((section) => ({ header: section, items: section.rooms })),
        [sections],
    );
    const context = useMemo<Context>(
        () => ({
            roomCount: groups.reduce((count, group) => count + group.items.length, 0),
            firstRoomId: groups[0]?.items[0]?.id,
        }),
        [groups],
    );

    const getGroupHeaderComponent = useCallback(
        (_groupIndex: number, section: RoomPickerViewSection): JSX.Element => (
            <div key={section.id} role="presentation" className={styles.sectionTitle}>
                {section.title}
            </div>
        ),
        [],
    );

    const getItemComponent = useCallback(
        (
            index: number,
            room: RoomOfRoomPickerView,
            listContext: VirtualizedListContext<Context>,
            onFocus: (item: RoomOfRoomPickerView, e: React.FocusEvent) => void,
        ): JSX.Element => {
            // Before the user has moved within the list, its tab stop is the first room (not a section title).
            const tabIndexKey = listContext.tabIndexKey?.startsWith("section-")
                ? listContext.context.firstRoomId
                : listContext.tabIndexKey;
            const isTabStop = tabIndexKey === room.id;
            return (
                <RoomPickerItem
                    key={room.id}
                    room={room}
                    index={index}
                    setSize={listContext.context.roomCount}
                    isTabStop={isTabStop}
                    isFocused={listContext.focused && isTabStop}
                    avatar={renderRoomAvatar(room, "32px")}
                    onFocus={onFocus}
                    onRoomClick={onRoomClick}
                />
            );
        },
        [renderRoomAvatar, onRoomClick],
    );

    return (
        <div className={styles.sectionedList}>
            <div className={styles.sectionedListContent}>
                <GroupedVirtualizedList<RoomPickerViewSection, RoomOfRoomPickerView, Context>
                    {...getContainerAccessibleProps("listbox")}
                    aria-label={label}
                    aria-multiselectable={true}
                    groups={groups}
                    context={context}
                    getItemKey={getItemKey}
                    getHeaderKey={getHeaderKey}
                    isItemFocusable={isItemFocusable}
                    isGroupHeaderFocusable={isGroupHeaderFocusable}
                    getGroupHeaderComponent={getGroupHeaderComponent}
                    getItemComponent={getItemComponent}
                />
            </div>
        </div>
    );
}
