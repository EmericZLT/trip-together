import { expect, type Page } from "@playwright/test";
export async function chooseTime(
  page: Page,
  label: string,
  hour: string,
  minute: string,
) {
  const input = page.getByLabel(label, { exact: true });
  await expect(input).toHaveAttribute("readonly", "");
  await input.click();
  const picker = page.locator(".ant-picker-dropdown:visible");
  await picker
    .locator(".ant-picker-time-panel-column")
    .nth(0)
    .getByText(hour, { exact: true })
    .click();
  await picker
    .locator(".ant-picker-time-panel-column")
    .nth(1)
    .getByText(minute, { exact: true })
    .click();
  await input.press("Tab");
}
export async function chooseZone(page: Page, label: string, name: string) {
  const input = page.getByRole("combobox", { name: label, exact: true });
  await expect(input).toHaveAttribute("readonly", "");
  await input.click();
  const dropdown = page.locator(".ant-select-dropdown:visible");
  const option = dropdown
    .locator(".ant-select-item-option")
    .filter({ hasText: name });
  for (let i = 0; i < 30 && !(await option.count()); i++) {
    await dropdown
      .locator(".ant-select-dropdown-list-holder")
      .evaluate((el) => {
        el.scrollTop += 160;
      });
    await page.waitForTimeout(30);
  }
  await option.click();
}
