import { expect, test, type Page } from "@playwright/test";
import type { Stroke } from "../client/src/components/Canvas";

const BLANK = [0, 0, 0, 0];
const BLACK = [0, 0, 0, 255];
const RED = [255, 0, 0, 255];

type Spot = [x: number, y: number];

// Stands in for the "Stroke" table in Supabase
let saved: { id: string; boardId?: string; data: unknown }[];

// Wait until the canvas exists and has sized its pixel grid to the page
function canvasReady(page: Page) {
  return page.waitForFunction(() => {
    const canvas = document.querySelector("canvas");
    return (
      canvas !== null &&
      canvas.width === Math.round(canvas.clientWidth * window.devicePixelRatio)
    );
  });
}

test.beforeEach(async ({ page }) => {
  // The board and its drawing come from Supabase. Answer those requests here
  // so the tests need no database and never write to the real one.
  await page.route("**/rest/v1/Board*", (route) =>
    route.fulfill({
      json: { id: "test", name: "Test board", createdAt: "2026-01-01" },
    }),
  );
  saved = [];
  await page.route("**/rest/v1/Stroke*", (route) => {
    const request = route.request();
    const query = new URL(request.url()).searchParams;
    if (request.method() === "POST") {
      saved.push(request.postDataJSON());
      return route.fulfill({ status: 201 });
    }
    if (request.method() === "DELETE") {
      // The row to delete arrives as "id=eq.<id>"
      const id = query.get("id")!.replace("eq.", "");
      saved = saved.filter((row) => row.id !== id);
      return route.fulfill({ status: 204 });
    }
    // Like Supabase, hand out at most 1000 rows per request
    const offset = Number(query.get("offset") ?? 0);
    const limit = Math.min(Number(query.get("limit") ?? 1000), 1000);
    return route.fulfill({ json: saved.slice(offset, offset + limit) });
  });
  await page.goto("/board/test");
  await canvasReady(page);
});

// What the stand-in table holds, in order: "clear", or for a stroke the
// height it starts at
function savedRows() {
  return saved.map((row) =>
    row.data === "clear"
      ? "clear"
      : Math.round((row.data as Stroke).points[0].y),
  );
}

// Turns a spot on the canvas into a spot on the page
async function onPage(page: Page, [x, y]: Spot): Promise<Spot> {
  const box = (await page.locator("canvas").boundingBox())!;
  // +1 skips the canvas border
  return [box.x + 1 + x, box.y + 1 + y];
}

// Reads the color of one canvas pixel as [red, green, blue, alpha]
function pixel(page: Page, spot: Spot) {
  return page.evaluate(([x, y]) => {
    const canvas = document.querySelector("canvas")!;
    const dpr = window.devicePixelRatio;
    const { data } = canvas
      .getContext("2d")!
      .getImageData(x * dpr, y * dpr, 1, 1);
    return Array.from(data);
  }, spot);
}

// Presses the mouse at the first spot, moves through the rest, and releases
async function drag(page: Page, ...spots: Spot[]) {
  const [first, ...rest] = spots;
  await page.mouse.move(...(await onPage(page, first)));
  await page.mouse.down();
  for (const spot of rest) {
    await page.mouse.move(...(await onPage(page, spot)), { steps: 10 });
  }
  await page.mouse.up();
}

test("pen draws with the chosen color and size", async ({ page }) => {
  await drag(page, [100, 100], [300, 100]);
  expect(await pixel(page, [200, 100])).toEqual(BLACK);
  // The default pen is 4px wide, so 12px below the line is untouched
  expect(await pixel(page, [200, 112])).toEqual(BLANK);

  await page.getByLabel("Color").fill("#ff0000");
  await page.getByLabel("Size").fill("30");
  await drag(page, [100, 200], [300, 200]);
  expect(await pixel(page, [200, 200])).toEqual(RED);
  expect(await pixel(page, [200, 212])).toEqual(RED);
});

test("a fast stroke is curved, not a chain of straight lines", async ({
  page,
}) => {
  // Three points only: a right-angle corner at (200, 100)
  const [a, b, c]: Spot[] = [
    [100, 100],
    [200, 100],
    [200, 200],
  ];
  await page.mouse.move(...(await onPage(page, a)));
  await page.mouse.down();
  await page.mouse.move(...(await onPage(page, b)));
  await page.mouse.move(...(await onPage(page, c)));
  await page.mouse.up();

  // Straight segments would put ink on the corner itself
  expect(await pixel(page, [200, 100])).toEqual(BLANK);
  // The curve cuts inside the corner, and still reaches both ends
  expect(await pixel(page, [187, 112])).toEqual(BLACK);
  expect(await pixel(page, [100, 100])).toEqual(BLACK);
  expect(await pixel(page, [200, 200])).toEqual(BLACK);
});

test("eraser, undo and clear", async ({ page }) => {
  await drag(page, [100, 100], [300, 100]);

  await page.getByLabel("Eraser").check();
  await drag(page, [200, 60], [200, 140]);
  expect(await pixel(page, [200, 100])).toEqual(BLANK);
  expect(await pixel(page, [120, 100])).toEqual(BLACK);

  // Undo takes back the eraser stroke
  await page.getByRole("button", { name: "Undo" }).click();
  expect(await pixel(page, [200, 100])).toEqual(BLACK);

  await page.getByRole("button", { name: "Clear" }).click();
  expect(await pixel(page, [200, 100])).toEqual(BLANK);

  // Undo takes back the clear as well
  await page.getByRole("button", { name: "Undo" }).click();
  expect(await pixel(page, [200, 100])).toEqual(BLACK);

  await page.getByRole("button", { name: "Undo" }).click();
  expect(await pixel(page, [200, 100])).toEqual(BLANK);
});

test("the drawing, a clear and an undo all survive a reload", async ({
  page,
}) => {
  await drag(page, [100, 100], [300, 100]);
  await drag(page, [100, 200], [300, 200]);
  await page.getByRole("button", { name: "Undo" }).click();
  await drag(page, [100, 300], [300, 300]);
  // Reloading too early would cut off a save that is still on its way
  await expect.poll(savedRows).toEqual([100, 300]);
  expect(saved[0]).toMatchObject({ boardId: "test", data: { tool: "pen" } });

  await page.reload();
  await canvasReady(page);
  expect(await pixel(page, [200, 100])).toEqual(BLACK);
  expect(await pixel(page, [200, 200])).toEqual(BLANK);
  expect(await pixel(page, [200, 300])).toEqual(BLACK);

  await page.getByRole("button", { name: "Clear" }).click();
  await expect.poll(savedRows).toEqual([100, 300, "clear"]);
  await page.reload();
  await canvasReady(page);
  expect(await pixel(page, [200, 100])).toEqual(BLANK);

  // Undo still works on entries that were loaded, not drawn in this visit
  await page.getByRole("button", { name: "Undo" }).click();
  expect(await pixel(page, [200, 100])).toEqual(BLACK);
  await expect.poll(savedRows).toEqual([100, 300]);
});

test("an undo right after a stroke does not overtake its save", async ({
  page,
}) => {
  // Slow down saves only, so the delete would arrive first if both were
  // sent at once
  await page.route("**/rest/v1/Stroke*", async (route) => {
    if (route.request().method() === "POST") {
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
    await route.fallback();
  });
  const bothAnswered = Promise.all(
    ["POST", "DELETE"].map((method) =>
      page.waitForResponse(
        (response) =>
          response.url().includes("/rest/v1/Stroke") &&
          response.request().method() === method,
      ),
    ),
  );

  await drag(page, [100, 100], [300, 100]);
  await page.getByRole("button", { name: "Undo" }).click();
  await bothAnswered;
  expect(saved).toEqual([]);
});

test("a long history loads in full, and broken rows are skipped", async ({
  page,
}) => {
  // 1001 rows: one more than a single request returns
  saved = [
    ...Array.from({ length: 999 }, (_, i) => ({ id: `c${i}`, data: "clear" })),
    { id: "broken", data: { tool: "pen" } },
    {
      id: "line",
      data: {
        tool: "pen",
        color: "#000000",
        size: 4,
        points: [
          { x: 100, y: 100 },
          { x: 300, y: 100 },
        ],
      },
    },
  ];
  await page.reload();
  await canvasReady(page);
  expect(await pixel(page, [200, 100])).toEqual(BLACK);
});

test("a failed save is shown, and the Save button sends it again", async ({
  page,
}) => {
  let down = true;
  await page.route("**/rest/v1/Stroke*", (route) =>
    down
      ? route.fulfill({ status: 500, json: { message: "database is down" } })
      : route.fallback(),
  );
  await drag(page, [100, 100], [300, 100]);
  await drag(page, [100, 200], [300, 200]);
  await expect(page.getByRole("status")).toContainText(
    "Not saved: database is down",
  );
  expect(saved).toEqual([]);
  // The message did not push the canvas down: the second line is where it
  // was drawn
  expect(await pixel(page, [200, 200])).toEqual(BLACK);

  down = false;
  await page.getByRole("button", { name: "Save" }).click();
  // Both strokes arrive, in the order they were drawn
  await expect.poll(savedRows).toEqual([100, 200]);
  await expect(page.getByRole("status")).toHaveText("Saved");
});

test("a stroke survives a window resize", async ({ page }) => {
  await drag(page, [100, 100], [300, 100]);
  await page.setViewportSize({ width: 900, height: 600 });
  await expect.poll(() => pixel(page, [200, 100])).toEqual(BLACK);
});

test("releasing the mouse outside the canvas ends the stroke", async ({
  page,
}) => {
  // Drag up and out through the top edge, then let go above the canvas
  await drag(page, [100, 100], [100, -20]);
  expect(await pixel(page, [100, 5])).toEqual(BLACK);

  // Back over the canvas with no button held: this must not draw
  await page.mouse.move(...(await onPage(page, [300, 200])));
  await page.mouse.move(...(await onPage(page, [400, 200])), { steps: 10 });
  expect(await pixel(page, [350, 200])).toEqual(BLANK);
});

test("a stylus draws", async ({ page }) => {
  const cdp = await page.context().newCDPSession(page);
  await page.evaluate(() => {
    document.querySelector("canvas")!.addEventListener("pointerdown", (e) => {
      document.body.dataset.pointerType = e.pointerType;
    });
  });

  const pen = async (type: string, spot: Spot, buttons: number) => {
    const [x, y] = await onPage(page, spot);
    await cdp.send("Input.dispatchMouseEvent", {
      type: type as "mousePressed",
      x,
      y,
      button: "left",
      buttons,
      clickCount: 1,
      pointerType: "pen",
    });
  };
  await pen("mousePressed", [100, 100], 1);
  for (let x = 120; x <= 300; x += 20) {
    await pen("mouseMoved", [x, 100], 1);
  }
  await pen("mouseReleased", [300, 100], 0);

  // Proves the browser really reported a pen, not a mouse
  expect(await page.evaluate(() => document.body.dataset.pointerType)).toBe(
    "pen",
  );
  expect(await pixel(page, [200, 100])).toEqual(BLACK);
});

test.describe("touch screen", () => {
  test.use({ hasTouch: true });

  test("a finger drag draws without scrolling the page", async ({ page }) => {
    const cdp = await page.context().newCDPSession(page);
    const touch = async (type: string, spot?: Spot) => {
      const touchPoints = [];
      if (spot) {
        const [x, y] = await onPage(page, spot);
        touchPoints.push({ x, y });
      }
      await cdp.send("Input.dispatchTouchEvent", {
        type: type as "touchStart",
        touchPoints,
      });
    };

    // A downward drag is the gesture that would normally scroll the page
    await touch("touchStart", [100, 50]);
    for (let y = 70; y <= 250; y += 20) {
      await touch("touchMove", [100, y]);
    }
    await touch("touchEnd");

    // If the browser had taken the drag for scrolling, the stroke would stop
    // near the start and never reach this far
    expect(await pixel(page, [100, 200])).toEqual(BLACK);
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
  });
});

test.describe("high-density screen", () => {
  test.use({ deviceScaleFactor: 2 });

  test("the canvas has two real pixels per page pixel", async ({ page }) => {
    const { width, clientWidth } = await page
      .locator("canvas")
      .evaluate((canvas: HTMLCanvasElement) => ({
        width: canvas.width,
        clientWidth: canvas.clientWidth,
      }));
    expect(width).toBe(clientWidth * 2);

    // The stroke still lands where the pointer was
    await drag(page, [100, 100], [300, 100]);
    expect(await pixel(page, [200, 100])).toEqual(BLACK);
    expect(await pixel(page, [200, 112])).toEqual(BLANK);
  });
});
