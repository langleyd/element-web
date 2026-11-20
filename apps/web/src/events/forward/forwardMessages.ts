/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { type MatrixClient, type MatrixEvent } from "matrix-js-sdk/src/matrix";
import { logger } from "matrix-js-sdk/src/logger";

import { transformForwardedEvent } from "./transformForwardedEvent";

/**
 * Forward messages to one or more rooms.
 *
 * Each message becomes an ordinary new message in each destination's main timeline, queued through the normal send
 * queue: it shows as sending, sent or failed there, and a failed one can be retried there like any other.
 * The messages are queued in the order given (callers pass them in timeline order), one destination after another.
 * This does not wait for delivery: the returned promise settles once every send has been queued.
 *
 * @param cli - The client to send with.
 * @param events - The messages to forward, in the order they should arrive.
 * @param roomIds - The destination rooms.
 */
export function forwardMessages(cli: MatrixClient, events: MatrixEvent[], roomIds: string[]): void {
    const transformed = events.map((event) => transformForwardedEvent(event, cli));
    for (const roomId of roomIds) {
        for (const { type, content } of transformed) {
            // Failures are not reported here: the local echo shows as unsent in the destination, with retry.
            cli.sendEvent(roomId, type as any, content as any).catch((e) => {
                logger.warn(`Failed to forward a message to ${roomId}`, e);
            });
        }
    }
}
