/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";
import {
    BaseViewModel,
    type RoomOfRoomPickerView,
    type RoomPickerViewActions,
    type RoomPickerViewSnapshot,
} from "@element-hq/web-shared-components";
import { EventType, KnownMembership, type MatrixClient, type Room } from "matrix-js-sdk/src/matrix";
import throttle from "lodash/throttle";

import { _t } from "../../languageHandler";
import RoomAvatar from "../../components/views/avatars/RoomAvatar";
import DMRoomMap from "../../utils/DMRoomMap";
import { sortRoomsByRecency } from "../../utils/room/sortRoomsByRecency";
import { BreadcrumbsStore } from "../../stores/BreadcrumbsStore";
import RoomListStoreV3 from "../../stores/room-list-v3/RoomListStoreV3";

/** The most chats messages can be forwarded to at once, as on Element X. */
export const MAX_FORWARD_DESTINATIONS = 5;

/** How many recently viewed chats the "Suggestions" section shows. */
const SUGGESTION_LIMIT = 5;

export interface ForwardMessagesDialogViewSnapshot extends RoomPickerViewSnapshot {
    /** Whether Send can be pressed: at least one chat is selected. */
    canSend: boolean;
    /** Shown when 5 chats are selected and the rest are disabled. Provisional until the design review. */
    limitText?: string;
}

interface ForwardMessagesDialogViewModelProps {
    /** The client whose rooms are offered. */
    matrixClient: MatrixClient;
    /** The room the messages come from. It is not offered. */
    sourceRoomId: string;
    /** Called with the chosen room ids on Send, or with nothing on Cancel. */
    onFinished: (roomIds?: string[]) => void;
}

/**
 * View model for the "Forward to" picker: up to 5 chats, chosen with the shared {@link RoomPickerView}.
 */
export class ForwardMessagesDialogViewModel
    extends BaseViewModel<ForwardMessagesDialogViewSnapshot, ForwardMessagesDialogViewModelProps>
    implements RoomPickerViewActions
{
    /** The chosen rooms, in the order they were chosen. */
    private readonly selectedRoomIds: string[] = [];
    /** Recently viewed rooms that can be chosen, most recently viewed first. At most {@link SUGGESTION_LIMIT}. */
    private readonly suggestedRooms: Room[];
    /** Every room that can be chosen, in room list order. */
    private readonly allRooms: Room[];
    private query = "";

    public constructor(props: ForwardMessagesDialogViewModelProps) {
        super(props, {
            rooms: [],
            selectedRooms: [],
            placeholder: _t("forward|multi|search_placeholder"),
            listTitle: _t("forward|multi|list_title"),
            emptyListText: _t("forward|multi|empty"),
            canSend: false,
        });
        this.suggestedRooms = BreadcrumbsStore.instance.rooms
            .filter((room) => this.canForwardTo(room))
            .slice(0, SUGGESTION_LIMIT);
        // The room list's own order, across all spaces; by recency if the room list hasn't loaded.
        const roomListRooms = RoomListStoreV3.instance.getSortedRooms();
        this.allRooms = (
            roomListRooms.length
                ? roomListRooms
                : sortRoomsByRecency(props.matrixClient.getVisibleRooms(), props.matrixClient.getSafeUserId())
        ).filter((room) => this.canForwardTo(room));
        this.disposables.track(() => this.search.cancel());
        this.refresh();
    }

    /**
     * Joined chats the user can post in. Not spaces, not the source chat (as on iOS) and not upgraded rooms.
     */
    private canForwardTo(room: Room): boolean {
        return (
            room.roomId !== this.props.sourceRoomId &&
            room.getMyMembership() === KnownMembership.Join &&
            !room.isSpaceRoom() &&
            !room.currentState.getStateEvents(EventType.RoomTombstone, "") &&
            room.maySendMessage()
        );
    }

    private toViewRoom(room: Room): RoomOfRoomPickerView {
        const selected = this.selectedRoomIds.includes(room.roomId);
        const dmUserId = DMRoomMap.shared().getUserIdForRoomId(room.roomId);
        return {
            id: room.roomId,
            name: room.name,
            // Every row shows an id under its name: the person's for a DM, the room's address, or its room id.
            description: dmUserId ?? room.getCanonicalAlias() ?? room.roomId,
            selected,
            disabled: !selected && this.selectedRoomIds.length >= MAX_FORWARD_DESTINATIONS,
        };
    }

    private refresh(): void {
        let suggestions: Room[] = [];
        let chats: Room[];
        if (this.query) {
            // Searching: every match is listed once, under "Chats", in room list order.
            const query = this.query.toLocaleLowerCase();
            chats = this.allRooms.filter((room) => room.name.toLocaleLowerCase().includes(query));
        } else {
            suggestions = this.suggestedRooms;
            const suggestedIds = new Set(suggestions.map((room) => room.roomId));
            chats = this.allRooms.filter((room) => !suggestedIds.has(room.roomId));
        }
        const suggestionRooms = suggestions.map((room) => this.toViewRoom(room));
        const chatRooms = chats.map((room) => this.toViewRoom(room));

        const selectedRooms = this.selectedRoomIds
            .map((id) => this.props.matrixClient.getRoom(id))
            .filter((room): room is Room => !!room);
        const count = selectedRooms.length;

        this.snapshot.merge({
            rooms: [...suggestionRooms, ...chatRooms],
            sections: [
                { id: "suggestions", title: _t("forward|multi|suggestions"), rooms: suggestionRooms },
                { id: "chats", title: _t("forward|multi|chats"), rooms: chatRooms },
            ],
            selectedRooms: selectedRooms.map((room) => this.toViewRoom(room)),
            canSend: count > 0,
            limitText:
                count >= MAX_FORWARD_DESTINATIONS
                    ? _t("forward|multi|limit", { count: MAX_FORWARD_DESTINATIONS })
                    : undefined,
        });
    }

    public toggleRoom = (roomId: string): void => {
        const index = this.selectedRoomIds.indexOf(roomId);
        if (index >= 0) {
            this.selectedRoomIds.splice(index, 1);
        } else if (this.selectedRoomIds.length < MAX_FORWARD_DESTINATIONS) {
            this.selectedRoomIds.push(roomId);
            this.query = "";
        }
        this.refresh();
    };

    public unSelectLastRoom = (): void => {
        this.selectedRoomIds.pop();
        this.refresh();
    };

    public search = throttle((query: string): void => {
        this.query = query;
        this.refresh();
    }, 300);

    public renderRoomAvatar = (room: RoomOfRoomPickerView, size: string): React.ReactNode => {
        const sdkRoom = this.props.matrixClient.getRoom(room.id);
        return sdkRoom ? <RoomAvatar room={sdkRoom} size={size} /> : null;
    };

    /** Forward to the chosen chats. */
    public send = (): void => {
        if (this.selectedRoomIds.length === 0) return;
        this.props.onFinished([...this.selectedRoomIds]);
    };

    /** Close without forwarding. The selection in the timeline is kept. */
    public cancel = (): void => {
        this.props.onFinished(undefined);
    };
}
