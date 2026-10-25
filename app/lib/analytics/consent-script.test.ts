// @vitest-environment jsdom
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

type ConsentScriptModule = typeof import('./consent-script');

/** What a script element carried at the moment it was inserted. */
type InsertedScript = {
  src: string;
  id: string;
  async: boolean;
  nonce: string | null;
};

const LOAD_FAILED_LOG =
  '[analytics] Unable to load the Customer Privacy API, so no analytics events are sent.';

let consentScript: ConsentScriptModule;
let inserted: InsertedScript[];

/** The script element that is in the document now, if any. */
function scriptInDocument(): HTMLScriptElement | null {
  return document.querySelector<HTMLScriptElement>(
    `script#${consentScript.CONSENT_SCRIPT_ID}`,
  );
}

beforeEach(async () => {
  // A fresh module per test: the script is a once-per-page singleton.
  vi.resetModules();
  consentScript = await import('./consent-script');
  document.body.replaceChildren();
  inserted = [];
  const appendChild = document.body.appendChild.bind(document.body);
  vi.spyOn(document.body, 'appendChild').mockImplementation(
    <T extends Node>(node: T): T => {
      if (node instanceof HTMLScriptElement) {
        inserted.push({
          src: node.src,
          id: node.id,
          async: node.async,
          nonce: node.getAttribute('nonce'),
        });
      }
      return appendChild(node);
    },
  );
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('loadConsentScript', () => {
  it("inserts one async script for Shopify's Customer Privacy API", () => {
    void consentScript.loadConsentScript('nonce-1');

    expect(inserted).toEqual([
      {
        src: consentScript.CONSENT_API_URL,
        id: 'customer-privacy-api',
        async: true,
        nonce: 'nonce-1',
      },
    ]);
    expect(scriptInDocument()).not.toBeNull();
  });

  it('sets the CSP nonce before the script is inserted, so the browser applies it', () => {
    // Arrange: hydrogen-react's loadScript set it only after appendChild.
    const {loadConsentScript} = consentScript;

    // Act
    void loadConsentScript('nonce-before-insertion');

    // Assert: the attribute is already there when the element is inserted.
    expect(inserted).toHaveLength(1);
    expect(inserted[0].nonce).toBe('nonce-before-insertion');
  });

  it('adds no nonce attribute without a nonce', () => {
    void consentScript.loadConsentScript(undefined);

    expect(inserted[0].nonce).toBeNull();
  });

  it('inserts the script once per page, however often it is asked for', async () => {
    // Arrange: a remounted loader asks again, possibly with another nonce.
    const first = consentScript.loadConsentScript('nonce-1');
    const second = consentScript.loadConsentScript('nonce-2');

    // Act
    scriptInDocument()?.dispatchEvent(new Event('load'));

    // Assert
    expect(inserted).toHaveLength(1);
    expect(document.querySelectorAll('script')).toHaveLength(1);
    await expect(first).resolves.toBe('loaded');
    await expect(second).resolves.toBe('loaded');
    await expect(consentScript.loadConsentScript('nonce-3')).resolves.toBe(
      'loaded',
    );
    expect(inserted).toHaveLength(1);
  });

  it('stays pending until the script has loaded', async () => {
    const outcome = vi.fn();

    void consentScript.loadConsentScript('nonce-1').then(outcome);
    await Promise.resolve();

    expect(outcome).not.toHaveBeenCalled();
  });

  it('resolves "failed" and logs once when the script cannot load, without retrying', async () => {
    // Arrange
    const outcome = consentScript.loadConsentScript('nonce-1');

    // Act
    scriptInDocument()?.dispatchEvent(new Event('error'));

    // Assert
    await expect(outcome).resolves.toBe('failed');
    await expect(consentScript.loadConsentScript('nonce-1')).resolves.toBe(
      'failed',
    );
    expect(inserted).toHaveLength(1);
    expect(vi.mocked(console.error).mock.calls).toEqual([[LOAD_FAILED_LOG]]);
  });

  it('ignores a load event after an error, and an error after the load', async () => {
    const outcome = consentScript.loadConsentScript('nonce-1');
    const script = scriptInDocument();

    script?.dispatchEvent(new Event('load'));
    script?.dispatchEvent(new Event('error'));

    await expect(outcome).resolves.toBe('loaded');
    expect(console.error).not.toHaveBeenCalled();
  });
});
