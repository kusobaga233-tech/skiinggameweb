import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const html = await fs.readFile(path.resolve("index.html"), "utf8");
const mainSource = await fs.readFile(path.resolve("src/main.ts"), "utf8");
const tutorialPath = path.resolve("src/ui/boostTutorialVideo.ts");
const tutorialSource = await fs.readFile(tutorialPath, "utf8");
const stylesSource = await fs.readFile(path.resolve("src/styles.css"), "utf8");

assert.ok(html.includes('id="boost-tutorial-shell"'), "expected tutorial shell in index.html");
assert.ok(html.includes('id="boost-tutorial-video"'), "expected tutorial video element in index.html");
assert.ok(html.includes('/tutorials/pump-demo.mp4'), "expected tutorial mp4 source in index.html");
assert.ok(mainSource.includes("new BoostTutorialVideo("), "expected boost tutorial controller to be instantiated in main.ts");
assert.ok(mainSource.includes("boostTutorialVideo.render(hudState.motion)"), "expected boost tutorial controller to render from motion state");
assert.ok(stylesSource.includes(".boost-tutorial-shell"), "expected tutorial shell styles");

const transpiled = ts.transpileModule(tutorialSource, {
  compilerOptions: {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022
  },
  fileName: tutorialPath
});

const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "skiiing-boost-tutorial-check-"));
const compiledPath = path.join(tempDir, "boostTutorialVideo.mjs");
await fs.writeFile(compiledPath, transpiled.outputText, "utf8");

const { BoostTutorialVideo } = await import(pathToFileURL(compiledPath).href);

function motion(overrides = {}) {
  return {
    steer: 0,
    snowplow: 0,
    tuck: 0,
    brake: 0,
    jumpTriggered: false,
    pumpTriggered: false,
    drive: 0,
    pumpActive: false,
    pumpHits: 0,
    boostLocked: false,
    boostRemainingMs: 0,
    confidence: 1,
    source: "pose",
    tracking: true,
    ...overrides
  };
}

class FakeClassList {
  hidden = false;

  toggle(name, force) {
    if (name === "is-hidden") {
      this.hidden = !!force;
    }
  }
}

class FakeVideo {
  currentTime = 0;
  paused = false;
  playCalls = 0;
  pauseCalls = 0;

  play() {
    this.paused = false;
    this.playCalls += 1;
    return Promise.resolve();
  }

  pause() {
    this.paused = true;
    this.pauseCalls += 1;
  }
}

const shell = { classList: new FakeClassList() };
const video = new FakeVideo();
const tutorial = new BoostTutorialVideo(shell, video);

tutorial.render(motion());
assert.equal(shell.classList.hidden, false, "expected tutorial to start visible while boost lock is inactive");

tutorial.render(motion({ pumpTriggered: true }));
assert.equal(shell.classList.hidden, false, "expected first pole plant during one tutorial cycle to keep tutorial visible");

tutorial.render(motion({ pumpTriggered: true }));
assert.equal(shell.classList.hidden, true, "expected second pole plant during one tutorial cycle to hide tutorial");

tutorial.render(motion({ pumpTriggered: true }));
assert.equal(shell.classList.hidden, true, "expected hidden-state pole plants not to accumulate into the next tutorial cycle");

tutorial.render(motion({ boostLocked: true }));
assert.equal(shell.classList.hidden, true, "expected tutorial to stay hidden while boost lock is active");

tutorial.render(motion({ boostLocked: false }));
assert.equal(shell.classList.hidden, false, "expected tutorial to reappear after boost lock ends");

tutorial.render(motion({ pumpTriggered: true }));
assert.equal(shell.classList.hidden, false, "expected new tutorial cycle to restart counting from zero");

tutorial.render(motion({ pumpTriggered: true }));
assert.equal(shell.classList.hidden, true, "expected second pole plant of the new cycle to hide tutorial again");

console.log("Boost tutorial overlay OK");
