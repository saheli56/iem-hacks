import type { BrowserContext } from "playwright";
import type { FormInfo, FormSubmissionResult } from "../types.js";

// ── Probe payloads ────────────────────────────────────────────────────────────

/**
 * XSS payloads: if any appear verbatim in the response the input is reflected
 * without encoding → confirmed reflected-XSS vector.
 */
const XSS_PAYLOADS: string[] = [
  `<script>alert('xss')</script>`,
  `"><img src=x onerror=alert(1)>`,
  `<svg/onload=alert(1)>`,
];

/**
 * SQL-injection probe strings. A reflection in the HTML body (e.g. an error
 * message echoing the input) is a strong indicator of unsanitised SQL input.
 */
const SQLI_PAYLOADS: string[] = [
  `' OR '1'='1`,
  `" OR "1"="1`,
  `1; DROP TABLE users--`,
];

type PayloadEntry = { payload: string; type: "xss" | "sqli" };

// Use one representative payload per category to keep probing fast
const ALL_PAYLOADS: PayloadEntry[] = [
  { payload: XSS_PAYLOADS[0], type: "xss" },
  { payload: SQLI_PAYLOADS[0], type: "sqli" },
];

// ── Input fill helpers ────────────────────────────────────────────────────────

/** Input types that accept free-form text and can carry injection payloads. */
const TEXT_TYPES = new Set([
  "text", "search", "email", "url", "tel", "number",
  "password", "textarea", "",
]);

/** Produce safe dummy fallback data so the server doesn't reject the form. */
function dummyValue(inputType: string, inputName: string): string {
  const n = inputName.toLowerCase();
  if (inputType === "email" || n.includes("email")) return "probe@example.com";
  if (inputType === "url"   || n.includes("url"))   return "http://example.com";
  if (inputType === "tel"   || n.includes("phone"))  return "5550001234";
  if (inputType === "number")                         return "1";
  if (n.includes("pass") || n.includes("pwd"))        return "ProbePass123!";
  if (n.includes("user") || n.includes("name"))       return "probeuser";
  return "probevalue";
}

// ── Core prober ───────────────────────────────────────────────────────────────

/**
 * For every form found on `pageUrl`, opens a fresh browser tab, fills inputs
 * with probe payloads, submits, and checks whether the payload is reflected
 * verbatim in the response body.
 *
 * Each form is tested with ONE XSS payload (for speed). If the response
 * reflects it the form is also tested with the first SQLi payload.
 *
 * @param context  Playwright BrowserContext — reused so cookies/session are shared.
 * @param pageUrl  The URL of the page that contained the form.
 * @param forms    FormInfo[] as extracted by extractor.ts.
 * @returns        Array of FormSubmissionResult (one entry per form tested).
 */
export async function submitFormsForProbing(
  context: BrowserContext,
  pageUrl: string,
  forms: FormInfo[]
): Promise<FormSubmissionResult[]> {
  const results: FormSubmissionResult[] = [];
  if (!forms.length) return results;

  // Cap forms per page to keep scan time predictable
  const MAX_FORMS = 3;
  const formsToProbe = forms.slice(0, MAX_FORMS);

  for (let formIndex = 0; formIndex < formsToProbe.length; formIndex++) {
    const form = formsToProbe[formIndex];

    // Skip forms that have no injectable text inputs
    const injectableInputs = form.inputs.filter(
      (inp) => TEXT_TYPES.has(inp.type) && inp.name
    );
    if (!injectableInputs.length) continue;

    // Probe with each payload category (stop after first confirmed reflection)
    for (const { payload, type } of ALL_PAYLOADS) {
      const result = await probeForm(
        context,
        pageUrl,
        form,
        formIndex,
        payload,
        type
      );
      if (result) {
        results.push(result);
        // If we already confirmed a reflection of this category, no need for
        // more payloads of the same type on this form.
        if (result.reflectedInResponse) break;
      }
    }
  }

  return results;
}

// ── Single form probe ─────────────────────────────────────────────────────────

async function probeForm(
  context: BrowserContext,
  pageUrl: string,
  form: FormInfo,
  formIndex: number,
  payload: string,
  payloadType: "xss" | "sqli"
): Promise<FormSubmissionResult | null> {
  const probePage = await context.newPage();

  try {
    // Navigate to the page in a fresh tab
    await probePage.goto(pageUrl, {
      waitUntil: "domcontentloaded",
      timeout: 8_000,
    });
    await probePage.waitForTimeout(300);

    // ── Fill inputs via page.evaluate to avoid CSS-selector escaping issues ──
    const filled: boolean = await probePage.evaluate(
      ({
        idx,
        probe,
        dummy,
        textTypes,
      }: {
        idx: number;
        probe: string;
        dummy: Record<string, string>;
        textTypes: string[];
      }) => {
        const formEl = document.querySelectorAll("form")[idx];
        if (!formEl) return false;

        const els = Array.from(
          formEl.querySelectorAll("input, textarea, select")
        ) as HTMLInputElement[];

        for (const el of els) {
          const t = (el.type || "").toLowerCase();
          // Skip non-injectable types
          if (
            ["hidden", "file", "submit", "button", "reset",
             "radio", "checkbox", "image"].includes(t)
          )
            continue;

          el.value = textTypes.includes(t)
            ? dummy[el.name] !== undefined
              ? dummy[el.name]   // use payload for named injectable fields
              : probe
            : "";
        }
        return true;
      },
      {
        idx: formIndex,
        probe: payload,
        dummy: buildDummyMap(form, payload),
        textTypes: Array.from(TEXT_TYPES),
      }
    );

    if (!filled) return null;

    // ── Submit and capture server response ──────────────────────────────────
    let responseBody = "";

    const responsePromise = probePage
      .waitForResponse(
        (resp) =>
          resp.request().resourceType() === "document" &&
          resp.url() !== "about:blank",
        { timeout: 4_000 }
      )
      .catch(() => null);

    // Click submit button or fall back to Enter
    try {
      const submitBtn = probePage.locator(
        `form >> nth=${formIndex} >> button[type="submit"], form >> nth=${formIndex} >> input[type="submit"]`
      ).first();

      if ((await submitBtn.count()) > 0) {
        await submitBtn.click({ timeout: 3_000 });
      } else {
        // Focus the first injectable input then submit via Enter
        const firstInput = probePage
          .locator(`form >> nth=${formIndex} >> input:not([type="hidden"])`)
          .first();
        if ((await firstInput.count()) > 0) {
          await firstInput.press("Enter");
        } else {
          // Last resort: JS form.submit()
          await probePage.evaluate((idx: number) => {
            const f = document.querySelectorAll("form")[idx] as HTMLFormElement | null;
            f?.submit();
          }, formIndex);
        }
      }
    } catch {
      // Ignore click errors — the response may still have been captured
    }

    const resp = await responsePromise;
    if (resp) {
      try {
        responseBody = await resp.text();
      } catch {
        /* ignore */
      }
    }

    // Also try the current page content (handles SPA navigation)
    if (!responseBody) {
      try {
        responseBody = await probePage.content();
      } catch {
        /* ignore */
      }
    }

    // ── Check for reflection ─────────────────────────────────────────────────
    const reflected = responseBody.includes(payload);

    // Extract a short snippet centred on the reflection point
    let responseSnippet: string | undefined;
    if (reflected) {
      const idx = responseBody.indexOf(payload);
      const start = Math.max(0, idx - 100);
      const end = Math.min(responseBody.length, idx + payload.length + 100);
      responseSnippet = responseBody.slice(start, end).replace(/\s+/g, " ").trim();
    }

    return {
      sourceUrl: pageUrl,
      formAction: form.action || pageUrl,
      method: form.method,
      payloadUsed: payload,
      payloadType,
      reflectedInResponse: reflected,
      responseSnippet,
    };
  } catch (err) {
    console.warn(
      `[FormProber] Error probing form[${formIndex}] on ${pageUrl}:`,
      (err as Error).message
    );
    return null;
  } finally {
    await probePage.close().catch(() => {});
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Build a name→value map for filling a form.
 * The FIRST injectable field gets the probe payload; the rest get safe dummy
 * values so the server doesn't reject the submission outright.
 */
function buildDummyMap(
  form: FormInfo,
  payload: string
): Record<string, string> {
  const map: Record<string, string> = {};
  let injected = false;

  for (const inp of form.inputs) {
    if (!inp.name) continue;
    if (!TEXT_TYPES.has(inp.type)) continue;

    if (!injected) {
      map[inp.name] = payload;
      injected = true;
    } else {
      map[inp.name] = dummyValue(inp.type, inp.name);
    }
  }
  return map;
}
