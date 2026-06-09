import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const sourcePath = path.resolve("src/game/inputFallback.ts");
const sourceText = await fs.readFile(sourcePath, "utf8");
const transpiled = ts.transpileModule(sourceText, {
  compilerOptions: {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022
  },
  fileName: sourcePath
});

const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "skiiing-keyboard-fallback-check-"));
const compiledPath = path.join(tempDir, "inputFallback.mjs");
await fs.writeFile(compiledPath, transpiled.outputText, "utf8");

const { KeyboardFallback } = await import(pathToFileURL(compiledPath).href);

class FakeWindow {
  listeners = new Map();

  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) ?? [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  dispatch(type, code) {
    for (const listener of this.listeners.get(type) ?? []) {
      listener({ code });
    }
  }
}

const target = new FakeWindow();
const keyboard = new KeyboardFallback(target);

target.dispatch("keydown", "KeyA");
assert.equal(keyboard.consumeState().steer, 1, "expected A to steer left");
target.dispatch("keyup", "KeyA");
assert.equal(keyboard.consumeState().steer, 0, "expected releasing A to clear steer");

target.dispatch("keydown", "KeyD");
assert.equal(keyboard.consumeState().steer, -1, "expected D to steer right");
target.dispatch("keyup", "KeyD");
assert.equal(keyboard.consumeState().steer, 0, "expected releasing D to clear steer");

target.dispatch("keydown", "KeyW");
let state = keyboard.consumeState();
assert.equal(state.drive, 1, "expected W to stay as forward double-pole drive");
assert.equal(state.snowplow, 0, "expected W drive alone not to inject scrape braking");

target.dispatch("keydown", "KeyJ");
state = keyboard.consumeState();
assert.equal(state.drive, 1, "expected adding J not to cancel W drive");
assert.equal(state.snowplow, 0, "expected J to no longer add scrape braking input");

target.dispatch("keydown", "KeyK");
state = keyboard.consumeState();
assert.equal(state.snowplow, 0, "expected J and K together to keep scrape braking disabled");

target.dispatch("keyup", "KeyJ");
state = keyboard.consumeState();
assert.equal(state.snowplow, 0, "expected releasing J to keep scrape braking disabled");

target.dispatch("keydown", "KeyS");
state = keyboard.consumeState();
assert.equal(state.tuck, 1, "expected S to tuck");

target.dispatch("keyup", "KeyK");
target.dispatch("keyup", "KeyW");
target.dispatch("keyup", "KeyS");
state = keyboard.consumeState();
assert.equal(state.drive, 0, "expected releasing W to clear forward drive");
assert.equal(state.snowplow, 0, "expected releasing J/K to keep scrape input disabled");
assert.equal(state.tuck, 0, "expected releasing S to clear tuck");

console.log("Keyboard fallback OK");
