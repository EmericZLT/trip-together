import { test, expect } from "@playwright/test";
import { png, tripInput } from "../support/api";
import { mkdir } from "node:fs/promises";
test("从注册到行程、文件、账本、证件和重新登录", async ({
  page,
  browserName,
}) => {
  const email = `ui${crypto.randomUUID().replaceAll("-", "").slice(0, 18)}@example.test`,
    password = `Pw-${crypto.randomUUID()}`;
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.getByRole("button", { name: "注册新账号" }).click();
  await page.getByLabel("邮箱", { exact: true }).fill(email);
  await expect(page.getByLabel("昵称", { exact: true })).toHaveCount(0);
  await page.getByLabel("密码", { exact: true }).fill(password);
  await page.getByRole("button", { name: "注册", exact: true }).click();
  await expect(page.getByRole("heading", { name: "还没有行程" })).toBeVisible();
  await page.getByRole("button", { name: "前往我的行程" }).click();
  await page.getByRole("button", { name: /创建行程/ }).click();
  await page.getByLabel("行程名称", { exact: true }).fill("周末城市旅行");
  await page.getByLabel("开始日期", { exact: true }).fill("2030-06-01");
  await page.getByLabel("结束日期", { exact: true }).fill("2030-06-10");
  await page.getByLabel("目的地时区", { exact: true }).fill("Europe/Paris");
  await page.getByLabel("常用时区", { exact: true }).fill("Asia/Shanghai");
  await page.getByLabel("目的地币种", { exact: true }).selectOption("EUR");
  await page.getByRole("button", { name: "保存行程" }).click();
  await expect(
    page.getByRole("heading", { name: "还没有行程事项" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "行程", exact: true }).click();
  await page.getByRole("button", { name: "添加事项", exact: true }).click();
  await page.getByLabel("事项名称", { exact: true }).fill("城市间航班");
  await page.getByLabel("事项类型", { exact: true }).selectOption("flight");
  await page.getByLabel("起点", { exact: true }).fill("出发机场");
  await page.getByLabel("终点", { exact: true }).fill("到达机场");
  await page.getByLabel("资料来源", { exact: true }).fill("用户提供的预订资料");
  await page
    .getByLabel("事项提醒", { exact: true })
    .fill("提前到达机场办理登机");
  await page.getByRole("button", { name: "保存事项" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "现在", exact: true }).click();
  await expect(page.getByRole("heading", { name: "城市间航班" })).toBeVisible();
  await expect(
    page.getByText("出发机场", { exact: true }).first(),
  ).toBeVisible();
  await page.getByRole("button", { name: "资料", exact: true }).click();
  await page.getByRole("button", { name: "上传旅行资料", exact: true }).click();
  await page.getByLabel("文件", { exact: true }).setInputFiles({
    name: "测试机票.png",
    mimeType: "image/png",
    buffer: png,
  });
  await page.getByLabel("分类", { exact: true }).fill("交通");
  await page.getByRole("button", { name: "上传资料", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "查看测试机票.png", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "行程", exact: true }).click();
  await page.getByRole("button", { name: /第 1 天/ }).click();
  await page
    .getByRole("button", { name: /城市间航班.*查看详情与凭证/ })
    .click();
  await page.getByRole("button", { name: "修改事项", exact: true }).click();
  await page.getByLabel("测试机票.png", { exact: true }).check();
  await page.getByRole("button", { name: "保存事项" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: /准备清单.*出发前/ }).click();
  await page.getByRole("button", { name: "添加准备事项" }).click();
  await page.getByLabel("准备事项", { exact: true }).fill("携带雨伞");
  await page.getByRole("button", { name: "保存准备事项" }).click();
  await page.getByRole("checkbox", { name: "携带雨伞" }).click();
  await expect(page.getByRole("checkbox", { name: "携带雨伞" })).toBeChecked();
  await page.getByRole("button", { name: "账本", exact: true }).click();
  await page.getByRole("button", { name: "新增支出" }).click();
  await page.getByLabel("金额", { exact: true }).fill("123.45");
  await page.getByLabel("支出名称", { exact: true }).fill("午餐");
  await page.getByLabel("上传支出凭证").setInputFiles({
    name: "餐费凭证.png",
    mimeType: "image/png",
    buffer: png,
  });
  await expect(
    page.getByRole("button", { name: "查看餐费凭证.png" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "保存支出", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "EUR", exact: true }).click();
  await expect(page.getByText("午餐", { exact: true })).toBeVisible();
  await page.getByText("午餐", { exact: true }).click();
  await expect(
    page.getByRole("button", { name: "查看餐费凭证.png" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "查看餐费凭证.png" }).click();
  await expect(
    page.getByRole("dialog").last().getByRole("img", { name: "餐费凭证.png" }),
  ).toBeVisible();
  await page
    .getByRole("dialog")
    .last()
    .getByRole("button", { name: "关闭", exact: true })
    .click();
  await page.getByRole("button", { name: "关闭", exact: true }).click();
  await page.getByRole("button", { name: "我的", exact: true }).click();
  await page.getByRole("button", { name: "编辑个人资料" }).click();
  await page.getByLabel("英文姓名", { exact: true }).fill("Test Traveller");
  await page.getByLabel("护照号码", { exact: true }).fill("TEST-DOCUMENT");
  await page.getByRole("button", { name: "保存个人资料" }).click();
  await page.getByRole("button", { name: "显示证件", exact: true }).click();
  await expect(page.getByText("TEST-DOCUMENT", { exact: true })).toBeVisible();
  await page.getByLabel("上传个人证件", { exact: true }).setInputFiles({
    name: "个人测试文件.png",
    mimeType: "image/png",
    buffer: png,
  });
  await expect(
    page.getByRole("button", { name: "查看个人测试文件.png" }),
  ).toBeVisible();
  await page.getByRole("button", { name: /我的行程.*创建/ }).click();
  await page.getByRole("button", { name: "管理行程：周末城市旅行" }).click();
  await page.getByRole("button", { name: "生成同行邀请" }).click();
  await expect(page.getByLabel("同行邀请口令")).toHaveValue(/^[A-HJ-NP-Z]{6}$/);
  await page.getByRole("button", { name: "返回我的行程", exact: true }).click();
  await page.getByRole("button", { name: "返回", exact: true }).click();
  await page.getByRole("button", { name: "现在", exact: true }).click();
  await mkdir(".local/screenshots", { recursive: true });
  for (const width of [320, 375, 430, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    await expect
      .poll(() =>
        page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      )
      .toBe(true);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: `.local/screenshots/multi-user-${browserName}.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: "我的", exact: true }).click();
  await page.getByRole("button", { name: "退出当前身份" }).click();
  await page.getByLabel("邮箱", { exact: true }).fill(email);
  await page.getByLabel("密码", { exact: true }).fill(password);
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await expect(page.getByRole("heading", { name: "城市间航班" })).toBeVisible();
  expect(errors).toEqual([]);
});
