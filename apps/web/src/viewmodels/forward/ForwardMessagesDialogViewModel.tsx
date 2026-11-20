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
import { formatList } from "../../utils/FormattingUtils";

/** The most chats messages can be forwarded to at once, as on Element X. */
export const MAX_FORWARD_DESTINATIONS = 5;

/**
 * Above this many sends, a default Synapse starts slowing the client down (about 10 messages, then one every
 * 5 seconds), so the summary warns that the forward may take a few minutes.
 */
const SLOW_FORWARD_THRESHOLD = 10;

/** How many chats to list before the user searches, as in the other chat pickers. */
const UNFILTERED_ROOM_LIMIT = 8;

export interface ForwardMessagesDialogViewSnapshot extends RoomPickerViewSnapshot {
    /** Whether Send can be pressed: at least one chat is selected. */
    canSend: boolean;
    /** Shown when 5 chats are selected and the rest are disabled. Provisional until the design review. */
    limitText?: string;
    /** How many messages go to which chats, shown before Send. Provisional until the design review. */
    summaryText?: string;
    /** For messages from a thread: they arrive in the main chat. Provisional until the design review. */
    threadText?: string;
    /** For large forwards: it may take a few minutes. Provisional until the design review. */
    slowText?: string;
}

interface ForwardMessagesDialogViewModelProps {
    /** The client whose rooms are offered. */
    matrixClient: MatrixClient;
    /** The room the messages come from. It is not offered. */
    sourceRoomId: string;
    /** How many messages are being forwarded. */
    messageCount: number;
    /** Whether the messages come from a thread. */
    fromThread: boolean;
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
    /** The rooms that can be chosen, most recent first. */
    private readonly roomsByRecency: Room[];
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
        this.roomsByRecency = sortRoomsByRecency(
            props.matrixClient.getVisibleRooms().filter((room) => this.canForwardTo(room)),
            props.matrixClient.getSafeUserId(),
        );
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
            description: dmUserId ?? room.getCanonicalAlias() ?? "",
            selected,
            disabled: !selected && this.selectedRoomIds.length >= MAX_FORWARD_DESTINATIONS,
        };
    }

    private refresh(): void {
        const query = this.query.toLocaleLowerCase();
        let rooms = this.roomsByRecency.filter((room) => room.name.toLocaleLowerCase().includes(query));
        if (!query) rooms = rooms.slice(0, UNFILTERED_ROOM_LIMIT);

        const selectedRooms = this.selectedRoomIds
            .map((id) => this.props.matrixClient.getRoom(id))
            .filter((room): room is Room => !!room);
        const { messageCount, fromThread } = this.props;
        const count = selectedRooms.length;

        this.snapshot.merge({
            rooms: rooms.map((room) => this.toViewRoom(room)),
            selectedRooms: selectedRooms.map((room) => this.toViewRoom(room)),
            canSend: count > 0,
            limitText:
                count >= MAX_FORWARD_DESTINATIONS
                    ? _t("forward|multi|limit", { count: MAX_FORWARD_DESTINATIONS })
                    : undefined,
            summaryText:
                count > 0
                    ? _t("forward|multi|summary", {
                          count: messageCount,
                          chats: formatList(selectedRooms.map((room) => room.name)),
                      })
                    : undefined,
            threadText: count > 0 && fromThread ? _t("forward|multi|from_thread") : undefined,
            slowText: count > 0 && messageCount * count > SLOW_FORWARD_THRESHOLD ? _t("forward|multi|slow") : undefined,
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
