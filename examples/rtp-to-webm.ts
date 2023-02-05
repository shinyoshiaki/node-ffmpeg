import { randomPort } from "werift-rtp";

import { ffmpeg } from "../src";

(async () => {
  const port = await randomPort();
  const command = ffmpeg({
    logger: {
      debug: console.log,
      info: console.log,
      warn: console.log,
      error: console.log,
    },
  })
    .addInput("testsrc=size=640x480:rate=30")
    .inputFormat("lavfi")
    .videoCodec("libvpx")
    .outputOptions([
      "-cpu-used 5",
      "-deadline 1",
      "-g 10",
      "-error-resilient 1",
      "-auto-alt-ref 1",
    ])
    .outputFormat("rtp")
    .output(`rtp://127.0.0.1:${port}`)
    .run();

  setTimeout(() => {
    command.on("error", () => {
      console.log("Ffmpeg has been killed");
    });
    command.kill();
  }, 5000);
})();
