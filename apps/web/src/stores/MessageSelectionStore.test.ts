/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

// @vitest-environment happy-dom

import { describe, it, expect, beforeEach } from "vitest";
import { EventType, MatrixEvent, MsgType, Room, RoomEvent, type MatrixClient } from "matrix-js-sdk/src/matrix";
import { stubClient } from "test-utils";

import { MAX_SELECTED_MESSAGES, MessageSelectionStore } from "./MessageSelectionStore";
import { isSelectableForForward } from "../events/forward/isSelectableForForward";

const roomId = "!room:server.org";

function message(n: number, content: Record<string, unknown> = { msgtype: MsgType.Text, body: `Message ${n}` }) {
    return new MatrixEvent({
        type: EventType.RoomMessage,
        event_id: `$event${n}`,
        sender: "@bob:server.org",
        room_id: roomId,
        origin_server_ts: n,
        content,
    });
}

describe("MessageSelectionStore", () => {
    let client: MatrixClient;
    let room: Room;
    let store: MessageSelectionStore;

    beforeEach(() => {
        client = stubClient();
        room = new Room(roomId, client, "@alice:server.org");
        store = new MessageSelectionStore();
    });

    it("starts with the chosen message selected, in the main timeline", () => {
        store.start(room, null, message(1), "forward");
        expect(store.isActiveFor(roomId, null)).toBe(true);
        expect(store.isActiveFor(roomId, "$thread")).toBe(false);
        expect([...store.getSnapshot().selectedIds]).toEqual(["$event1"]);
    });

    it("rejects an 11th message and shows the limit notice", () => {
        store.start(room, null, message(0), "forward");
        for (let n = 1; n < MAX_SELECTED_MESSAGES; n++) expect(store.toggle(message(n))).toBe("selected");
        expect(store.toggle(message(99))).toBe("limit");
        expect(store.getSnapshot().selectedIds.size).toBe(MAX_SELECTED_MESSAGES);
        expect(store.getSnapshot().notice?.text).toBe("Maximum messages selected");
    });

    it("stays in selection mode when everything is deselected", () => {
        const first = message(1);
        store.start(room, null, first, "forward");
        expect(store.toggle(first)).toBe("deselected");
        expect(store.getSnapshot().active).toBe(true);
        expect(store.getSnapshot().selectedIds.size).toBe(0);
    });

    it("deselects a message that gets deleted", () => {
        store.start(room, null, message(1), "forward");
        store.toggle(message(2));
        const redaction = new MatrixEvent({ type: EventType.RoomRedaction, redacts: "$event2", room_id: roomId });
        room.emit(RoomEvent.Redaction, redaction, room);
        expect([...store.getSnapshot().selectedIds]).toEqual(["$event1"]);
    });

    it("ends a main-timeline selection when one starts in a thread", () => {
        store.start(room, null, message(1), "forward");
        store.start(room, "$root", message(2), "forward");
        expect(store.isActiveFor(roomId, null)).toBe(false);
        expect(store.isActiveFor(roomId, "$root")).toBe(true);
        store.endIfActiveFor(roomId, null);
        expect(store.isActiveFor(roomId, "$root")).toBe(true);
        store.endIfActiveFor(roomId, "$root");
        expect(store.getSnapshot().active).toBe(false);
    });

    it("returns the selection in timeline order, not selection order", () => {
        store.start(room, null, message(3), "forward");
        store.toggle(message(1));
        store.toggle(message(2));
        expect(store.selectedInTimelineOrder().map((e) => e.getId())).toEqual(["$event1", "$event2", "$event3"]);
    });
});

describe("isSelectableForForward", () => {
    it.each([MsgType.Text, MsgType.Emote, MsgType.Notice, MsgType.Image, MsgType.File, MsgType.Location])(
        "allows %s",
        (msgtype) => {
            expect(isSelectableForForward(message(1, { msgtype, body: "x" }))).toBe(true);
        },
    );

    it("excludes undecryptable messages, verification requests, stickers and state events", () => {
        expect(isSelectableForForward(message(1, { msgtype: "m.bad.encrypted", body: "x" }))).toBe(false);
        expect(isSelectableForForward(message(1, { msgtype: "m.key.verification.request", body: "x" }))).toBe(false);
        const sticker = new MatrixEvent({ type: EventType.Sticker, content: { body: "s", url: "mxc://a/b" } });
        expect(isSelectableForForward(sticker)).toBe(false);
        const topic = new MatrixEvent({ type: EventType.RoomTopic, state_key: "", content: { topic: "t" } });
        expect(isSelectableForForward(topic)).toBe(false);
    });
});
