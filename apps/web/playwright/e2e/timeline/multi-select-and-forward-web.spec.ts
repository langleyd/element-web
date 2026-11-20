/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

/* Multi-select and forward: one test per acceptance criterion in the feature's spec. */

import { type Locator, type Page } from "@playwright/test";

import { test as base, expect } from "../../element-web-test";
import { type ElementAppPage } from "../../pages/ElementAppPage";
import { type Bot } from "../../pages/bot";

const SOURCE = "Source chat";

const test = base.extend<{
    sourceRoomId: string;
}>({
    displayName: "Alice",
    botCreateOpts: { displayName: "Bob" },
    labsFlags: ["feature_multi_select_forward"],
    sourceRoomId: async ({ app, user, bot }, use) => {
        const roomId = await app.client.createRoom({ name: SOURCE, invite: [bot.credentials!.userId] });
        await bot.awaitRoomMembership(roomId);
        await use(roomId);
    },
});

/** Wait until the app's client has the event, so messages arrive in the order they were sent. */
async function waitForEvent(app: ElementAppPage, roomId: string, eventId: string): Promise<void> {
    await expect
        .poll(() =>
            app.client.evaluate(
                (cli, { roomId, eventId }) => !!cli.getRoom(roomId)?.findEventById(eventId),
                { roomId, eventId },
            ),
        )
        .toBe(true);
}

/** Bob sends text messages to the room (or a thread), one after another. Returns their event ids. */
async function receiveMessages(
    app: ElementAppPage,
    bot: Bot,
    roomId: string,
    bodies: string[],
    threadId: string | null = null,
): Promise<string[]> {
    const ids: string[] = [];
    for (const body of bodies) {
        const content = threadId
            ? { msgtype: "m.text", body, "m.relates_to": { rel_type: "m.thread", event_id: threadId } }
            : { msgtype: "m.text", body };
        const { event_id: eventId } = await bot.sendMessage(roomId, content);
        if (!threadId) await waitForEvent(app, roomId, eventId);
        ids.push(eventId);
    }
    return ids;
}

/** Create a room for Alice to forward to. */
async function createDestination(app: ElementAppPage, name: string): Promise<string> {
    return app.client.createRoom({ name });
}

function mainTimeline(page: Page): Locator {
    return page.getByTestId("timeline");
}

/** The tile for a message, in or out of selection mode. */
function tile(scope: Locator, text: string): Locator {
    return scope.getByTestId("event-tile").filter({ hasText: text }).last();
}

function selectionBar(page: Page): Locator {
    return page.getByRole("toolbar", { name: "Selected messages" });
}

function announcer(page: Page): Locator {
    return page.locator(".mx_MessageSelectionArea_announcer").first();
}

/** Choose Forward from a message's options menu. */
async function chooseForward(page: Page, scope: Locator, text: string): Promise<void> {
    const messageTile = tile(scope, text);
    await messageTile.hover();
    await messageTile.getByRole("button", { name: "Options" }).click();
    await page.getByRole("menuitem", { name: "Forward" }).click();
}

/** Choose chats in the "Forward to" picker by name. */
async function pickChats(page: Page, names: string[]): Promise<Locator> {
    const dialog = page.getByRole("dialog", { name: "Forward to" });
    for (const name of names) {
        await dialog.getByRole("option", { name, exact: true }).click();
    }
    return dialog;
}

/** The text bodies at the end of a room's main timeline. */
async function lastBodies(page: Page, count: number): Promise<string[]> {
    const bodies = mainTimeline(page).getByTestId("event-tile-slot-body");
    const all = await bodies.allInnerTexts();
    return all.slice(-count).map((s) => s.trim());
}

test.describe("Multi-select and forward", () => {
    test("AC-1: Forward from the options menu enters selection mode with that message selected", async ({
        page,
        app,
        bot,
        sourceRoomId,
    }) => {
        await receiveMessages(app, bot, sourceRoomId, ["First message", "Second message", "Third message"]);
        await app.viewRoomByName(SOURCE);

        await chooseForward(page, mainTimeline(page), "Second message");

        await expect(mainTimeline(page).getByRole("listbox")).toBeVisible();
        await expect(tile(mainTimeline(page), "Second message")).toHaveAttribute("aria-selected", "true");
        await expect(tile(mainTimeline(page), "First message")).toHaveAttribute("aria-selected", "false");

        const bar = selectionBar(page);
        await expect(bar).toContainText("1 selected");
        await expect(bar.getByRole("button", { name: "Cancel" })).toBeVisible();
        await expect(bar.getByRole("button", { name: "Forward" })).toBeEnabled();
        await expect(page.getByRole("textbox", { name: /Send an? .*message/ })).toHaveCount(0);
    });

    test("AC-2: Clicking messages toggles them; polls, deleted messages and room events can't be selected", async ({
        page,
        app,
        bot,
        sourceRoomId,
    }) => {
        await receiveMessages(app, bot, sourceRoomId, ["Message A", "Message B"]);
        const { event_id: pollId } = await bot.sendEvent(sourceRoomId, null, "org.matrix.msc3381.poll.start", {
            "org.matrix.msc3381.poll.start": {
                question: { "org.matrix.msc1767.text": "Lunch today?" },
                kind: "org.matrix.msc3381.poll.disclosed",
                max_selections: 1,
                answers: [
                    { "id": "yes", "org.matrix.msc1767.text": "Yes" },
                    { "id": "no", "org.matrix.msc1767.text": "No" },
                ],
            },
            "org.matrix.msc1767.text": "Lunch today?\n1. Yes\n2. No",
        });
        await waitForEvent(app, sourceRoomId, pollId);
        const [deletedId] = await receiveMessages(app, bot, sourceRoomId, ["Soon to be deleted"]);
        await bot.redactEvent(sourceRoomId, deletedId);
        await app.client.sendStateEvent(sourceRoomId, "m.room.topic", { topic: "A brand new topic" });
        await receiveMessages(app, bot, sourceRoomId, ["Message C", "Message D"]);
        await app.viewRoomByName(SOURCE);
        await expect(tile(mainTimeline(page), "Message deleted")).toBeVisible();

        await chooseForward(page, mainTimeline(page), "Message A");
        const timeline = mainTimeline(page);

        // Messages that are not next to each other
        await tile(timeline, "Message C").click();
        await expect(tile(timeline, "Message C")).toHaveAttribute("aria-selected", "true");
        await expect(selectionBar(page)).toContainText("2 selected");
        await tile(timeline, "Message A").click();
        await expect(tile(timeline, "Message A")).toHaveAttribute("aria-selected", "false");
        await expect(selectionBar(page)).toContainText("1 selected");
        await tile(timeline, "Message A").click();
        await expect(selectionBar(page)).toContainText("2 selected");

        for (const text of ["Lunch today?", "Message deleted", "A brand new topic"]) {
            const unavailable = tile(timeline, text);
            await expect(unavailable).toHaveAttribute("aria-disabled", "true");
            await expect(unavailable.getByTestId("event-tile-selection-checkbox").locator("input")).toHaveCount(0);
            await unavailable.click({ force: true });
            await expect(unavailable).toHaveAttribute("aria-selected", "false");
        }
        await expect(selectionBar(page)).toContainText("2 selected");
    });

    test("AC-3: An 11th message can't be selected and the limit notice shows", async ({
        page,
        app,
        bot,
        sourceRoomId,
    }) => {
        const bodies = Array.from({ length: 11 }, (_, i) => `Numbered message ${i + 1}.`);
        await receiveMessages(app, bot, sourceRoomId, bodies);
        await app.viewRoomByName(SOURCE);
        const timeline = mainTimeline(page);

        await chooseForward(page, timeline, bodies[0]);
        for (const body of bodies.slice(1, 10)) {
            await tile(timeline, body).click();
        }
        await expect(selectionBar(page)).toContainText("10 selected");

        await tile(timeline, bodies[10]).click();
        await expect(tile(timeline, bodies[10])).toHaveAttribute("aria-selected", "false");
        await expect(selectionBar(page)).toContainText("10 selected");
        await expect(page.getByText("Maximum messages selected", { exact: true }).first()).toBeVisible();
    });

    test("AC-4: New messages keep the selection and scroll; Cancel or Escape restores the composer", async ({
        page,
        app,
        bot,
        sourceRoomId,
    }) => {
        const bodies = Array.from({ length: 25 }, (_, i) => `Scroll message ${i + 1}.`);
        await receiveMessages(app, bot, sourceRoomId, bodies);
        await app.viewRoomByName(SOURCE);
        const timeline = mainTimeline(page);
        await expect(tile(timeline, bodies[24])).toBeVisible();

        await chooseForward(page, timeline, bodies[22]);
        await tile(timeline, bodies[20]).click();
        await expect(selectionBar(page)).toContainText("2 selected");
        const anchor = tile(timeline, bodies[21]);
        const before = (await anchor.boundingBox())!.y;

        await receiveMessages(app, bot, sourceRoomId, ["A message that arrives while selecting"]);
        await expect(tile(timeline, "A message that arrives while selecting")).toBeAttached();

        await expect(tile(timeline, bodies[22])).toHaveAttribute("aria-selected", "true");
        await expect(tile(timeline, bodies[20])).toHaveAttribute("aria-selected", "true");
        await expect(selectionBar(page)).toContainText("2 selected");
        expect(Math.abs((await anchor.boundingBox())!.y - before)).toBeLessThanOrEqual(1);

        // Escape from the bar
        await selectionBar(page).getByRole("button", { name: "Forward" }).focus();
        await page.keyboard.press("Escape");
        await expect(selectionBar(page)).toHaveCount(0);
        await expect(page.getByRole("textbox", { name: /Send an? .*message/ })).toBeVisible();
        await expect(tile(timeline, bodies[22])).toBeFocused();
        expect(Math.abs((await anchor.boundingBox())!.y - before)).toBeLessThanOrEqual(1);

        // Cancel works the same way, and nothing was sent
        await chooseForward(page, timeline, bodies[23]);
        await selectionBar(page).getByRole("button", { name: "Cancel" }).click();
        await expect(page.getByRole("textbox", { name: /Send an? .*message/ })).toBeVisible();
        await expect(tile(timeline, bodies[23])).toBeFocused();
        expect(await lastBodies(page, 1)).toEqual(["A message that arrives while selecting"]);
    });

    test("AC-5: The Forward to picker takes up to 5 chats, explains the limit and summarises the send", async ({
        page,
        app,
        bot,
        sourceRoomId,
    }) => {
        const names = ["Dest 1", "Dest 2", "Dest 3", "Dest 4", "Dest 5", "Dest 6"];
        for (const name of names) await createDestination(app, name);
        await receiveMessages(app, bot, sourceRoomId, ["Picker message one", "Picker message two"]);
        await app.viewRoomByName(SOURCE);
        const timeline = mainTimeline(page);

        await chooseForward(page, timeline, "Picker message one");
        await tile(timeline, "Picker message two").click();
        await selectionBar(page).getByRole("button", { name: "Forward" }).click();

        const dialog = page.getByRole("dialog", { name: "Forward to" });
        await expect(dialog).toBeVisible();
        await expect(dialog.getByRole("option", { name: SOURCE, exact: true })).toHaveCount(0);
        await expect(dialog.getByRole("button", { name: "Send" })).toBeDisabled();

        await pickChats(page, names.slice(0, 5));
        await expect(dialog.getByRole("option", { name: "Dest 6", exact: true })).toHaveAttribute(
            "aria-disabled",
            "true",
        );
        await expect(dialog.getByText("You can forward to up to 5 chats at a time.")).toBeVisible();
        await expect(dialog.getByText(/2 messages will be sent to Dest .*Dest 5\./)).toBeVisible();
        await expect(dialog.getByRole("button", { name: "Send" })).toBeEnabled();

        // Cancelling the picker keeps the selection
        await dialog.getByRole("button", { name: "Cancel" }).click();
        await expect(dialog).toHaveCount(0);
        await expect(selectionBar(page)).toContainText("2 selected");
    });

    test("AC-6: Thread messages selected out of order arrive in order in the main timeline", async ({
        page,
        app,
        bot,
        sourceRoomId,
    }) => {
        await createDestination(app, "Thread destination");
        const [rootId] = await receiveMessages(app, bot, sourceRoomId, ["Thread root message"]);
        await receiveMessages(app, bot, sourceRoomId, ["Thread one", "Thread two", "Thread three"], rootId);
        await app.viewRoomByName(SOURCE);

        const root = tile(mainTimeline(page), "Thread root message");
        await root.hover();
        await root.getByRole("button", { name: "Reply in thread" }).click();
        const thread = page.locator(".mx_ThreadView");
        await expect(tile(thread, "Thread three")).toBeVisible();

        await chooseForward(page, thread, "Thread three");
        await tile(thread, "Thread one").click();
        await tile(thread, "Thread two").click();
        const bar = thread.getByRole("toolbar", { name: "Selected messages" });
        await expect(bar).toContainText("3 selected");
        await bar.getByRole("button", { name: "Forward" }).click();

        const dialog = await pickChats(page, ["Thread destination"]);
        await expect(dialog.getByText("They will arrive in the main chat, not in a thread.")).toBeVisible();
        await dialog.getByRole("button", { name: "Send" }).click();

        await expect(page.getByRole("banner").getByText("Thread destination")).toBeVisible();
        await expect(tile(mainTimeline(page), "Thread three")).toBeVisible();
        expect(await lastBodies(page, 3)).toEqual(["Thread one", "Thread two", "Thread three"]);
    });

    test("AC-7: One chat opens it; two or more stay here with a toast", async ({ page, app, bot, sourceRoomId }) => {
        await createDestination(app, "Only destination");
        await createDestination(app, "Second destination");
        await receiveMessages(app, bot, sourceRoomId, ["Toast message one", "Toast message two"]);
        await app.viewRoomByName(SOURCE);
        const timeline = mainTimeline(page);

        // Two chats: stay in the source chat with a toast
        await chooseForward(page, timeline, "Toast message one");
        await tile(timeline, "Toast message two").click();
        await selectionBar(page).getByRole("button", { name: "Forward" }).click();
        let dialog = await pickChats(page, ["Only destination", "Second destination"]);
        await dialog.getByRole("button", { name: "Send" }).click();
        await expect(page.getByText("2 messages forwarded", { exact: true }).first()).toBeVisible();
        await expect(page.getByRole("banner").getByText(SOURCE)).toBeVisible();
        await expect(page.getByRole("textbox", { name: /Send an? .*message/ })).toBeFocused();

        // One chat: go there
        await chooseForward(page, timeline, "Toast message one");
        await selectionBar(page).getByRole("button", { name: "Forward" }).click();
        dialog = await pickChats(page, ["Only destination"]);
        await dialog.getByRole("button", { name: "Send" }).click();
        await expect(page.getByRole("banner").getByText("Only destination")).toBeVisible();
        await expect(tile(mainTimeline(page), "Toast message one")).toBeVisible();
    });

    test("AC-8: A forward that fails shows as unsent in the destination and can be retried there", async ({
        page,
        app,
        bot,
        sourceRoomId,
    }) => {
        const destinationId = await createDestination(app, "Failing destination");
        await receiveMessages(app, bot, sourceRoomId, ["Message that fails at first"]);
        await app.viewRoomByName(SOURCE);

        const failSends = (url: URL): boolean =>
            url.pathname.includes(`/rooms/${encodeURIComponent(destinationId)}/send/`) ||
            url.pathname.includes(`/rooms/${destinationId}/send/`);
        await page.route(failSends, (route) =>
            route.fulfill({ status: 400, json: { errcode: "M_UNKNOWN", error: "Forward refused for the test" } }),
        );

        await chooseForward(page, mainTimeline(page), "Message that fails at first");
        await selectionBar(page).getByRole("button", { name: "Forward" }).click();
        const dialog = await pickChats(page, ["Failing destination"]);
        await dialog.getByRole("button", { name: "Send" }).click();

        await expect(page.getByRole("banner").getByText("Failing destination")).toBeVisible();
        await expect(page.getByText("Some of your messages have not been sent")).toBeVisible();

        await page.unroute(failSends);
        await page.getByRole("button", { name: "Retry all" }).click();
        await expect(page.getByText("Some of your messages have not been sent")).toHaveCount(0);
        const sent = tile(mainTimeline(page), "Message that fails at first");
        await expect(sent.getByRole("status")).toHaveAccessibleName("Your message was sent");
    });

    test("AC-9: The whole flow works from the keyboard and ends in the destination's composer", async ({
        page,
        app,
        bot,
        sourceRoomId,
    }) => {
        await createDestination(app, "Keyboard destination");
        await receiveMessages(app, bot, sourceRoomId, ["Key one", "Key two", "Key three", "Key four"]);
        await app.viewRoomByName(SOURCE);
        const timeline = mainTimeline(page);

        // Open the options of "Key four" from the keyboard: focus reaches the message, Tab into its action bar
        await page.keyboard.press("Shift");
        await tile(timeline, "Key four").focus();
        const options = tile(timeline, "Key four").getByRole("button", { name: "Options" });
        // Tab into the message's action bar, then move along it with the arrow keys (it is a roving toolbar)
        for (let i = 0; i < 15; i++) {
            const where = await page.evaluate(() => {
                const el = document.activeElement;
                if (el?.getAttribute("aria-label") === "Options") return "options";
                return el?.closest("[role=toolbar]") ? "toolbar" : "other";
            });
            if (where === "options") break;
            await page.keyboard.press(where === "toolbar" ? "ArrowRight" : "Tab");
        }
        await expect(options).toBeFocused();
        await page.keyboard.press("Enter");
        const forwardItem = page.getByRole("menuitem", { name: "Forward" });
        for (let i = 0; i < 20 && !(await forwardItem.evaluate((el) => el === document.activeElement)); i++) {
            await page.keyboard.press("ArrowDown");
        }
        await page.keyboard.press("Enter");

        // Focus starts on the bar's Forward button; Shift+Tab twice reaches the messages
        const bar = selectionBar(page);
        await expect(bar.getByRole("button", { name: "Forward" })).toBeFocused();
        await page.keyboard.press("Shift+Tab");
        await page.keyboard.press("Shift+Tab");
        await expect(tile(timeline, "Key four")).toBeFocused();

        // Move up and toggle with Space, then extend with Shift+Up
        await page.keyboard.press("ArrowUp");
        await expect(tile(timeline, "Key three")).toBeFocused();
        await page.keyboard.press("Space");
        await expect(bar).toContainText("2 selected");
        await page.keyboard.press("Shift+ArrowUp");
        await expect(tile(timeline, "Key two")).toBeFocused();
        await expect(tile(timeline, "Key two")).toHaveAttribute("aria-selected", "true");
        await expect(bar).toContainText("3 selected");

        // Tab to Forward and open the picker
        const forwardButton = bar.getByRole("button", { name: "Forward" });
        for (let i = 0; i < 6 && !(await forwardButton.evaluate((el) => el === document.activeElement)); i++) {
            await page.keyboard.press("Tab");
        }
        await expect(forwardButton).toBeFocused();
        await page.keyboard.press("Enter");

        const dialog = page.getByRole("dialog", { name: "Forward to" });
        await expect(dialog).toBeVisible();
        await page.keyboard.type("Keyboard");
        const option = dialog.getByRole("option", { name: "Keyboard destination", exact: true });
        await expect(option).toBeVisible();
        await page.keyboard.press("Tab");
        await expect(option).toBeFocused();
        await page.keyboard.press("Enter");
        await expect(option).toHaveAttribute("aria-selected", "true");
        const send = dialog.getByRole("button", { name: "Send" });
        for (let i = 0; i < 6 && !(await send.evaluate((el) => el === document.activeElement)); i++) {
            await page.keyboard.press("Tab");
        }
        await expect(send).toBeFocused();
        await page.keyboard.press("Enter");

        await expect(page.getByRole("banner").getByText("Keyboard destination")).toBeVisible();
        await expect(page.getByRole("textbox", { name: /Send an? .*message/ })).toBeFocused();
        expect(await lastBodies(page, 3)).toEqual(["Key two", "Key three", "Key four"]);
    });

    test("AC-10: Entering, each count change and leaving are announced", async ({ page, app, bot, sourceRoomId }) => {
        await receiveMessages(app, bot, sourceRoomId, ["Spoken one", "Spoken two"]);
        await app.viewRoomByName(SOURCE);
        const timeline = mainTimeline(page);

        await chooseForward(page, timeline, "Spoken one");
        await expect(announcer(page)).toHaveAttribute("aria-live", "polite");
        await expect(announcer(page)).toContainText("Selecting messages to forward. 1 message selected");

        await tile(timeline, "Spoken two").click();
        await expect(announcer(page)).toHaveText("2 messages selected");
        await tile(timeline, "Spoken two").click();
        await expect(announcer(page)).toHaveText("1 message selected");

        await page.keyboard.press("Escape");
        await expect(announcer(page)).toHaveText("Stopped selecting messages");
    });

    test("AC-11: Forward on a sticker opens today's single-message dialog", async ({
        page,
        app,
        bot,
        sourceRoomId,
    }) => {
        const { event_id: stickerId } = await bot.sendEvent(sourceRoomId, null, "m.sticker", {
            body: "A sticker",
            info: { w: 64, h: 64, mimetype: "image/png" },
            url: "mxc://localhost/not-a-real-sticker",
        });
        await waitForEvent(app, sourceRoomId, stickerId);
        await app.viewRoomByName(SOURCE);

        const sticker = mainTimeline(page).locator(`[data-event-id="${stickerId}"]`);
        await sticker.hover();
        await sticker.getByRole("button", { name: "Options" }).click();
        await page.getByRole("menuitem", { name: "Forward" }).click();

        await expect(page.getByRole("dialog", { name: "Forward message" })).toBeVisible();
        await expect(selectionBar(page)).toHaveCount(0);
    });

    test.fixme(
        "AC-12: Forward, opening the picker and Send are tracked with counts only, for opted-in users",
        // Not built: Forward click tracking was taken out of this delivery in plan revision 2.
        async () => {},
    );
});
