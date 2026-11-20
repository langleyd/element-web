/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import {
    type IContent,
    type MatrixEvent,
    EventType,
    type MatrixClient,
    ContentHelpers,
    type ILocationContent,
    LocationAssetType,
    M_TIMESTAMP,
    M_BEACON,
} from "matrix-js-sdk/src/matrix";

import { isLocationEvent } from "../../utils/EventUtils";
import { isSelfLocation, locationEventGeoUri } from "../../utils/location";
import { attachMentions } from "../../utils/messages";
import { CommandPartCreator } from "../../editor/parts";
import SettingsStore from "../../settings/SettingsStore";
import { parseEvent } from "../../editor/deserialize";
import EditorModel from "../../editor/model";

/**
 * Transform an event before it is forwarded.
 *
 * This is a copy of the private `transformEvent` in `components/views/dialogs/ForwardDialog.tsx`, so that the
 * single-message dialog stays untouched while the multi-message forward is behind `feature_multi_select_forward`.
 * Keep the two in step until the flag is removed, then make `ForwardDialog` use this one.
 *
 * 1. Strip all relations, so replies and thread links don't carry over.
 * 2. Convert location events into a static pin-drop location share,
 *    and remove description from self-location shares.
 * 3. Parse the event back into an EditorModel and recalculate mentions.
 *
 * @param event - The MatrixEvent to transform.
 * @param cli - The MatrixClient (used for recalculation of mentions).
 * @returns The transformed event type and content.
 */
export function transformForwardedEvent(event: MatrixEvent, cli: MatrixClient): { type: string; content: IContent } {
    const {
        "m.relates_to": _, // strip relations - in future we will attach a relation pointing at the original event
        // We're taking a shallow copy here to avoid https://github.com/vector-im/element-web/issues/10924
        ...content
    } = event.getContent();

    // beacon pulses get transformed into static locations on forward
    const type = M_BEACON.matches(event.getType()) ? EventType.RoomMessage : event.getType();

    // self location shares should have their description removed
    // and become 'pin' share type
    if (
        (isLocationEvent(event) && isSelfLocation(content as ILocationContent)) ||
        // beacon pulses get transformed into static locations on forward
        M_BEACON.matches(event.getType())
    ) {
        const timestamp = M_TIMESTAMP.findIn<number>(content as ILocationContent);
        const geoUri = locationEventGeoUri(event);
        return {
            type,
            content: {
                ...content,
                ...ContentHelpers.makeLocationContent(
                    undefined, // text
                    geoUri,
                    timestamp || Date.now(),
                    undefined, // description
                    LocationAssetType.Pin,
                ),
            },
        };
    }

    // Mentions can leak information about the context of the original message, so:
    // 1. Parse the event's message body back into an EditorModel, then
    // 2. Pass through attachMentions() to recalculate mentions.
    const room = cli.getRoom(event.getRoomId())!;
    const partCreator = new CommandPartCreator(room, cli);
    const parts = parseEvent(event, partCreator, {
        shouldEscape: SettingsStore.getValue("MessageComposerInput.useMarkdown"),
    });
    const model = new EditorModel(parts, partCreator); // Temporary EditorModel to pass through
    const userId = cli.getSafeUserId();
    attachMentions(userId, content, model, undefined);

    return { type, content };
}
