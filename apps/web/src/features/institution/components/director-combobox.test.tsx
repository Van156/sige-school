import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import DirectorCombobox, { type DirectorStatus } from "./director-combobox";

const control = {
  id: "directorPersonId",
  name: "directorPersonId",
  value: "gone",
  onBlur: () => {},
  onChange: () => {},
  "aria-invalid": undefined,
  "aria-describedby": undefined,
};

const render = (status: DirectorStatus) =>
  renderToStaticMarkup(
    <DirectorCombobox
      control={control}
      teachers={[]}
      current={{ directorPersonId: "gone", directorName: "Grace Hopper", directorActive: false }}
      status={status}
      onSearchChange={() => {}}
    />,
  );

describe("DirectorCombobox", () => {
  test("shows the current director as the value even when the results omit them", () => {
    expect(render("ready")).toContain('value="Grace Hopper (inactivo)"');
  });

  test("is disabled, still showing the current value, when teachers are unavailable", () => {
    const html = render("unavailable");
    expect(html).toContain('value="Grace Hopper (inactivo)"');
    expect(html).toMatch(/<input[^>]*\sdisabled[="\s]/);
  });

  test("stays enabled while a search is in flight", () => {
    expect(render("searching")).not.toMatch(/<input[^>]*\sdisabled[="\s]/);
  });
});
