/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

// @vitest-environment happy-dom

import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { KnownMembership, type MatrixClient, type Room } from "matrix-js-sdk/src/matrix";

import { ForwardMessagesDialogViewModel } from "./ForwardMessagesDialogViewModel";
import { BreadcrumbsStore } from "../../stores/BreadcrumbsStore";
import RoomListStoreV3 from "../../stores/room-list-v3/RoomListStoreV3";
import DMRoomMap from "../../utils/DMRoomMap";

const SOURCE_ID = "!source:server";

function fakeRoom(id: string, name: string): Room {
    return {
        roomId: id,
        name,
        getMyMembership: () => KnownMembership.Join,
        isSpaceRoom: () => false,
        currentState: { getStateEvents: () => null },
        maySendMessage: () => true,
        getCanonicalAlias: () => null,
    } as unknown as Room;
}

describe("ForwardMessagesDialogViewModel", () => {
    const rooms = Array.from({ length: 20 }, (_, i) => fakeRoom(`!room${i}:server`, `Chat ${i}`));
    const source = fakeRoom(SOURCE_ID, "Source");
    let client: MatrixClient;

    beforeEach(() => {
        client = {
            getRoom: (id: string) => [source, ...rooms].find((room) => room.roomId === id) ?? null,
            getVisibleRooms: () => [source, ...rooms],
            getSafeUserId: () => "@alice:server",
        } as unknown as MatrixClient;
        DMRoomMap.setShared({ getUserIdForRoomId: () => undefined } as unknown as DMRoomMap);
        // Recently viewed: the source chat first, then seven others.
        vi.spyOn(BreadcrumbsStore.instance, "rooms", "get").mockReturnValue([source, ...rooms.slice(10, 17)]);
        vi.spyOn(RoomListStoreV3.instance, "getSortedRooms").mockReturnValue([source, ...rooms]);
    });

    afterEach(() => {
        vi.restoreAllMocks();
        DMRoomMap.setShared(null as unknown as DMRoomMap);
    });

    function createViewModel(): ForwardMessagesDialogViewModel {
        return new ForwardMessagesDialogViewModel({
            matrixClient: client,
            sourceRoomId: SOURCE_ID,
            messageCount: 2,
            fromThread: false,
            onFinished: vi.fn(),
        });
    }

    it("suggests the five most recently viewed chats, then lists every other chat in room list order", () => {
        const vm = createViewModel();
        const [suggestions, chats] = vm.getSnapshot().sections!;

        expect(suggestions.title).toBe("Suggestions");
        expect(suggestions.rooms.map((room) => room.name)).toEqual([
            "Chat 10",
            "Chat 11",
            "Chat 12",
            "Chat 13",
            "Chat 14",
        ]);
        expect(chats.title).toBe("Chats");
        // No cap on the list, no duplicates of the suggestions, and never the source chat.
        expect(chats.rooms).toHaveLength(15);
        expect(chats.rooms[0].name).toBe("Chat 0");
        expect(chats.rooms.map((room) => room.name)).not.toContain("Chat 10");
        expect(vm.getSnapshot().rooms.map((room) => room.id)).not.toContain(SOURCE_ID);
    });

    it("filters both sections when searching", () => {
        vi.useFakeTimers();
        const vm = createViewModel();
        vm.search("Chat 1");
        vi.runAllTimers();
        const [suggestions, chats] = vm.getSnapshot().sections!;

        expect(suggestions.rooms.map((room) => room.name)).toEqual([
            "Chat 10",
            "Chat 11",
            "Chat 12",
            "Chat 13",
            "Chat 14",
        ]);
        expect(chats.rooms.map((room) => room.name)).toEqual([
            "Chat 1",
            "Chat 15",
            "Chat 16",
            "Chat 17",
            "Chat 18",
            "Chat 19",
        ]);
        vi.useRealTimers();
    });
});
