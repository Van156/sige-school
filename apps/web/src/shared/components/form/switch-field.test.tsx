import { describe, expect, test } from "bun:test";
import type { AnyFieldApi } from "@tanstack/react-form";
import { renderToStaticMarkup } from "react-dom/server";

import SwitchField from "./switch-field";

function fakeField(value: boolean, errors: unknown[] = []): AnyFieldApi {
  return {
    name: "isMain",
    state: { value, meta: { errors } },
    handleBlur: () => {},
    handleChange: () => {},
  } as unknown as AnyFieldApi;
}

describe("SwitchField", () => {
  test("renders a labelled switch bound to the field value", () => {
    const html = renderToStaticMarkup(
      <SwitchField field={fakeField(true)} label="Sede Principal" description="Solo una." />,
    );
    expect(html).toContain('for="isMain"');
    expect(html).toContain('aria-checked="true"');
    expect(html).toContain("Solo una.");
  });

  test("shows the first error and marks the switch invalid", () => {
    const html = renderToStaticMarkup(
      <SwitchField
        field={fakeField(false, [{ message: "Ya existe una sede principal en esta institución." }])}
        label="Sede Principal"
      />,
    );
    expect(html).toContain("Ya existe una sede principal en esta institución.");
    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain('aria-describedby="isMain-error"');
  });
});
