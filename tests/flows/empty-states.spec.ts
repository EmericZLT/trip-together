import { test, expect } from "@playwright/test";
import { Client, createTrip } from "../support/api";

test("空白行程的账本、资料、准备清单没有空白细条", async ({
  page,
  browserName,
}) => {
  const account = await new Client().register();
  await createTrip(account);
  await page.goto("/");
  await page.getByLabel("邮箱", { exact: true }).fill(account.email);
  await page.getByLabel("密码", { exact: true }).fill(account.password);
  await page.getByRole("button", { name: "登录", exact: true }).click();
  for (const [tab, heading] of [
    ["账本", "还没有支出记录"],
    ["资料", "还没有旅行资料"],
    ["行程", "还没有准备事项"],
  ]) {
    await page.getByRole("button", { name: tab, exact: true }).click();
    await expect(page.getByRole("heading", { name: heading })).toBeVisible();
    await expect(page.locator(".surface.divided:empty")).toHaveCount(0);
    await expect(page.getByText(/待核对.*预订/)).toHaveCount(0);
    for (const width of [320, 390, 1280]) {
      await page.setViewportSize({ width, height: 844 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBeTruthy();
      const box = await page.locator(".surface.empty-state").boundingBox();
      expect(box!.height).toBeGreaterThan(150);
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({
      path: `.local/empty-${tab}-${browserName}.png`,
      fullPage: true,
    });
  }
  await page.getByRole("button", { name: "资料", exact: true }).click();
  await page.getByRole("button", { name: "上传第一份资料" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
});
