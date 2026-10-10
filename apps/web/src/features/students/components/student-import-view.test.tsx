import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import StudentImportFormatCard from "./student-import-format-card";

describe("StudentImportFormatCard", () => {
  test("marks the three required STU-R8 columns", () => {
    const html = renderToStaticMarkup(<StudentImportFormatCard />);
    expect(html.match(/aria-label="Sí"/g)).toHaveLength(3);
    expect(html.match(/aria-label="No"/g)).toHaveLength(13);
    expect(html).toContain("telefono_acudiente");
  });
});
