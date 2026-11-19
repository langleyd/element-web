/*
Copyright 2026 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type Page } from "@playwright/test";

import { test, expect } from "../../element-web-test";
import { SettingLevel } from "../../../src/settings/SettingLevel";

/** Resolve a Compound colour token to the rgb() string the browser computes for it. */
async function resolveToken(page: Page, token: string): Promise<string> {
    return page.evaluate((token) => {
        const probe = document.createElement("div");
        probe.style.backgroundColor = `var(${token})`;
        document.body.appendChild(probe);
        const colour = getComputedStyle(probe).backgroundColor;
        probe.remove();
        return colour;
    }, token);
}

test.describe("Room header bar colour", () => {
    test.use({ displayName: "Sakura" });

    test.beforeEach(async ({ app, user }) => {
        await app.client.createRoom({ name: "Test Room" });
        await app.viewRoomByName("Test Room");
    });

    for (const [ac, theme] of [
        ["AC-1", "light"],
        ["AC-2", "dark"],
    ] as const) {
        test(`${ac}: in the ${theme} theme the room header background is the pink token`, async ({ page, app }) => {
            await app.settings.setValue("theme", null, SettingLevel.ACCOUNT, theme);
            const header = page.locator(".mx_RoomHeader");
            await expect(header).toBeVisible();
            // Move the pointer away so the header is not in its hover state.
            await page.mouse.move(0, 0);
            const pink = await resolveToken(page, "--cpd-color-bg-decorative-5");
            await expect(header).toHaveCSS("background-color", pink);
        });
    }

    test.fixme("AC-3: header text and icons meet WCAG 2.2 AA contrast on the pink background", () => {
        // Not covered yet: the room asked for a quick implementation without AC tests (revisions 1-3).
    });

    test.fixme("AC-4: encryption and verification indicators stay distinguishable from the pink background", () => {
        // Not covered yet: the room asked for a quick implementation without AC tests (revisions 1-3).
    });

    test.fixme("AC-5: room list, right panel and thread headers keep their colours", () => {
        // Not covered yet: the room asked for a quick implementation without AC tests (revisions 1-3).
    });
});
