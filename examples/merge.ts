import { ffmpeg } from "../src";

const numOfVideo = 4;

(async () => {
  const command = ffmpeg({
    logger: {
      debug: console.log,
      info: console.log,
      warn: console.log,
      error: console.log,
    },
  });

  [...Array(numOfVideo)].forEach(() => {
    command
      .addInput("testsrc=size=320x240:rate=30")
      .inputFormat("lavfi")
      .duration(5);
  });

  command.complexFilter(
    [
      "nullsrc=size=640x480 [base0]",
      ...[...Array(numOfVideo).keys()].map((i) => ({
        filter: "setpts=PTS-STARTPTS, scale",
        options: [320, 240],
        inputs: i + ":v",
        outputs: "block" + i,
      })),
      ...[
        { x: 0, y: 0 },
        { x: 320, y: 0 },
        { x: 0, y: 240 },
        { x: 320, y: 240 },
      ].map((options, i) => ({
        filter: "overlay",
        options,
        inputs: ["base" + i, "block" + i],
        outputs: "base" + (i + 1),
      })),
    ],
    "base" + numOfVideo
  );

  command.output("./aaaa.mp4").outputFormat("mp4");
  command.run();

  setTimeout(() => {
    command.on("progress", (progress) => {
      console.log("... frames: " + progress.frames);
    });
    command.on("error", () => {
      console.log("Ffmpeg has been killed");
    });
    command.kill();
  }, 5000);
})();
