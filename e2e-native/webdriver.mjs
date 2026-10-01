/**
 * A minimal W3C WebDriver client for tauri-driver: just what the native
 * end-to-end tests need, so they add no dependencies.
 */
const DRIVER = process.env.TAURI_DRIVER_URL ?? "http://127.0.0.1:4444";
const ELEMENT = "element-6066-11e4-a52e-4f735466cecf";

async function request(method, path, body) {
  const res = await fetch(DRIVER + path, {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${method} ${path}: ${json.value?.message ?? res.status}`);
  return json.value;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Keys for sendKeys / keys(), as WebDriver code points. */
export const Key = { Control: "", Enter: "", End: "", Escape: "" };

export class Session {
  /** Starts the app (a new session) with optional command-line arguments. */
  static async start(application, args = []) {
    const value = await request("POST", "/session", {
      capabilities: { alwaysMatch: { "tauri:options": { application, args } } },
    });
    return new Session(value.sessionId);
  }

  constructor(id) {
    this.id = id;
  }

  cmd(method, path, body) {
    return request(method, `/session/${this.id}${path}`, body);
  }

  async quit() {
    await this.cmd("DELETE", "").catch(() => {});
  }

  /** Runs a script in the page and returns its result. */
  exec(script, ...args) {
    return this.cmd("POST", "/execute/sync", { script, args });
  }

  /** Waits until `fn` returns something truthy (retrying on errors), or fails after `timeout` ms. */
  async waitFor(fn, what, timeout = 15000) {
    const end = Date.now() + timeout;
    let last;
    while (Date.now() < end) {
      try {
        const v = await fn();
        if (v) return v;
      } catch (e) {
        last = e;
      }
      await sleep(200);
    }
    throw new Error(`Timed out waiting for ${what}${last ? `: ${last.message}` : ""}`);
  }

  /** The first element matching a CSS selector, waiting for it to appear. */
  async find(css, timeout) {
    const el = await this.waitFor(() => this.cmd("POST", "/element", { using: "css selector", value: css }), css, timeout);
    return el[ELEMENT];
  }

  /** The first element matching `css` whose text is exactly `text`, waiting for it to appear. */
  async findByText(css, text, timeout) {
    const el = await this.waitFor(
      () => this.exec("return [...document.querySelectorAll(arguments[0])].find((e) => e.textContent.trim() === arguments[1]) ?? null", css, text),
      `${css} "${text}"`,
      timeout,
    );
    return el[ELEMENT];
  }

  click(el) {
    return this.cmd("POST", `/element/${el}/click`, {});
  }

  type(el, text) {
    return this.cmd("POST", `/element/${el}/value`, { text });
  }

  text(el) {
    return this.cmd("GET", `/element/${el}/text`);
  }

  /** Presses a key chord such as Ctrl+S: modifiers held while `key` is pressed. */
  async chord(modifiers, key) {
    const down = modifiers.map((m) => ({ type: "keyDown", value: m }));
    const up = [...modifiers].reverse().map((m) => ({ type: "keyUp", value: m }));
    await this.cmd("POST", "/actions", {
      actions: [{ type: "key", id: "keyboard", actions: [...down, { type: "keyDown", value: key }, { type: "keyUp", value: key }, ...up] }],
    });
  }
}
