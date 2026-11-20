/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { type MatrixEvent, type Room, RoomEvent, type EventTimelineSet } from "matrix-js-sdk/src/matrix";

import { _t } from "../languageHandler";
import { isSelectableForForward } from "../events/forward/isSelectableForForward";

/** The most messages that can be selected at once, as on Element X. */
export const MAX_SELECTED_MESSAGES = 10;

/** How long a notice (limit reached, messages forwarded) stays up. */
const NOTICE_TIMEOUT_MS = 4000;

/** The action selection mode was entered for. Forward is the only one today; Delete may follow. */
export type MessageSelectionAction = "forward";

/** A short-lived notice shown at the bottom of a room or thread, such as "Maximum messages selected". */
export interface MessageSelectionNotice {
    /** Increases with each notice, so the same text shown twice is still a new notice. */
    id: number;
    /** The room the notice belongs to. */
    roomId: string;
    /** The thread the notice belongs to, or null for the main timeline. */
    threadId: string | null;
    /** The text to show. */
    text: string;
}

/** An immutable view of the store, for `useSyncExternalStore` and class components alike. */
export interface MessageSelectionSnapshot {
    /** Whether a timeline is in selection mode. */
    active: boolean;
    /** The action selection mode was entered for. */
    action: MessageSelectionAction | null;
    /** The room in selection mode. */
    roomId: string | null;
    /** The thread in selection mode, or null when it is the main timeline. */
    threadId: string | null;
    /** The message Forward was chosen on. Focus returns to it when selection mode ends without sending. */
    originEventId: string | null;
    /** The ids of the selected messages, in the order they were selected. */
    selectedIds: ReadonlySet<string>;
    /** The message that has keyboard focus in the timeline (roving tab stop). */
    focusedEventId: string | null;
    /** The current notice, if any. */
    notice: MessageSelectionNotice | null;
    /** Text for the screen reader live region: entering, each count change, and leaving. */
    announcement: string;
    /** The room and thread whose view should announce {@link announcement}. Outlives the selection. */
    announcementScope: { roomId: string; threadId: string | null } | null;
}

const EMPTY: MessageSelectionSnapshot = {
    active: false,
    action: null,
    roomId: null,
    threadId: null,
    originEventId: null,
    selectedIds: new Set(),
    focusedEventId: null,
    notice: null,
    announcement: "",
    announcementScope: null,
};

/** The outcome of trying to select or deselect a message. */
export type ToggleResult = "selected" | "deselected" | "limit" | "unavailable";

/**
 * Selection mode for the timeline: which messages are selected, in which room or thread, and for which action.
 *
 * There is one store per client, so there is at most one selection anywhere: starting a selection in a thread ends
 * one in the main timeline, and the other way round. The selection is not persisted; a reload ends it.
 */
export class MessageSelectionStore {
    private snapshot: MessageSelectionSnapshot = EMPTY;
    private readonly listeners = new Set<() => void>();
    private selected = new Map<string, MatrixEvent>();
    private room: Room | null = null;
    private noticeSeq = 0;
    private noticeTimer?: number;

    /** Subscribe to changes. Returns the function that unsubscribes. */
    public readonly subscribe = (listener: () => void): (() => void) => {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    };

    /** The current state. A new object after every change. */
    public readonly getSnapshot = (): MessageSelectionSnapshot => this.snapshot;

    /** Whether the given room and thread (null for the main timeline) is the timeline in selection mode. */
    public isActiveFor(roomId: string | undefined, threadId: string | null | undefined): boolean {
        return this.snapshot.active && this.snapshot.roomId === roomId && this.snapshot.threadId === (threadId ?? null);
    }

    /**
     * Enter selection mode in a room's main timeline or one of its threads, with the given message selected.
     * Ends any selection that was going on elsewhere.
     */
    public start(room: Room, threadId: string | null, event: MatrixEvent, action: MessageSelectionAction): void {
        this.detachRoom();
        this.room = room;
        room.on(RoomEvent.Redaction, this.onRedaction);
        this.selected = new Map([[event.getId()!, event]]);
        this.update({
            active: true,
            action,
            roomId: room.roomId,
            threadId,
            originEventId: event.getId()!,
            focusedEventId: event.getId()!,
            announcement: _t("timeline|selection|entered", { count: 1 }),
            announcementScope: { roomId: room.roomId, threadId },
        });
    }

    /** Select a message, or deselect it if it is already selected. */
    public toggle(event: MatrixEvent): ToggleResult {
        const id = event.getId();
        if (!this.snapshot.active || !id) return "unavailable";
        if (this.selected.has(id)) {
            this.selected.delete(id);
            this.updateSelection();
            return "deselected";
        }
        return this.select(event);
    }

    /** Select a message if it isn't already. Shows the limit notice when 10 are already selected. */
    public select(event: MatrixEvent): ToggleResult {
        const id = event.getId();
        if (!this.snapshot.active || !id || !isSelectableForForward(event)) return "unavailable";
        if (this.selected.has(id)) return "selected";
        if (this.selected.size >= MAX_SELECTED_MESSAGES) {
            this.showNotice(_t("timeline|selection|maximum_selected"));
            return "limit";
        }
        this.selected.set(id, event);
        this.updateSelection();
        return "selected";
    }

    /** Record which message has keyboard focus, so it is the timeline's tab stop. */
    public setFocused(eventId: string): void {
        if (!this.snapshot.active || this.snapshot.focusedEventId === eventId) return;
        this.update({ focusedEventId: eventId });
    }

    /** Leave selection mode. */
    public end(): void {
        if (!this.snapshot.active) return;
        this.detachRoom();
        this.selected = new Map();
        this.update({
            ...EMPTY,
            notice: this.snapshot.notice,
            announcement: _t("timeline|selection|left"),
            announcementScope: this.snapshot.announcementScope,
        });
    }

    /** Leave selection mode if it is on in the given timeline; used when a room or thread view goes away. */
    public endIfActiveFor(roomId: string | undefined, threadId: string | null | undefined): void {
        if (this.isActiveFor(roomId, threadId)) this.end();
    }

    /** The selected messages in timeline order, whatever order they were selected in. */
    public selectedInTimelineOrder(): MatrixEvent[] {
        const timelineSet = this.getTimelineSet();
        const position = (event: MatrixEvent): [number, number] => {
            const timeline = timelineSet?.getTimelineForEvent(event.getId()!);
            const index = timeline ? timeline.getEvents().indexOf(event) : -1;
            return [event.getTs(), index];
        };
        return [...this.selected.values()].sort((a, b) => {
            const [tsA, indexA] = position(a);
            const [tsB, indexB] = position(b);
            if (timelineSet?.getTimelineForEvent(a.getId()!) === timelineSet?.getTimelineForEvent(b.getId()!)) {
                if (indexA >= 0 && indexB >= 0) return indexA - indexB;
            }
            return tsA - tsB;
        });
    }

    /** Show a short-lived notice at the bottom of a room or thread (the current selection's by default). */
    public showNotice(text: string, roomId = this.snapshot.roomId, threadId = this.snapshot.threadId): void {
        if (!roomId) return;
        window.clearTimeout(this.noticeTimer);
        const notice = { id: ++this.noticeSeq, roomId, threadId, text };
        this.update({ notice, announcement: text, announcementScope: { roomId, threadId } });
        this.noticeTimer = window.setTimeout(() => {
            if (this.snapshot.notice?.id === notice.id) this.update({ notice: null });
        }, NOTICE_TIMEOUT_MS);
    }

    private getTimelineSet(): EventTimelineSet | undefined {
        if (!this.room) return undefined;
        if (this.snapshot.threadId) return this.room.getThread(this.snapshot.threadId)?.timelineSet;
        return this.room.getUnfilteredTimelineSet();
    }

    private readonly onRedaction = (redaction: MatrixEvent): void => {
        const redactedId = redaction.event.redacts ?? redaction.getContent().redacts;
        if (redactedId && this.selected.delete(redactedId)) this.updateSelection();
    };

    private detachRoom(): void {
        this.room?.off(RoomEvent.Redaction, this.onRedaction);
        this.room = null;
    }

    private updateSelection(): void {
        this.update({
            selectedIds: new Set(this.selected.keys()),
            announcement: _t("timeline|selection|count_a11y", { count: this.selected.size }),
        });
    }

    private update(partial: Partial<MessageSelectionSnapshot>): void {
        const selectedIds = partial.selectedIds ?? (partial.active ? new Set(this.selected.keys()) : undefined);
        this.snapshot = { ...this.snapshot, ...partial, ...(selectedIds ? { selectedIds } : {}) };
        for (const listener of this.listeners) listener();
    }
}
