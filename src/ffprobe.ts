/*jshint node:true, laxcomma:true*/
"use strict";

import { spawn } from "child_process";

import { FfmpegCommand } from "./fluent-ffmpeg";

function legacyTag(key: any) {
  return key.match(/^TAG:/);
}
function legacyDisposition(key: any) {
  return key.match(/^DISPOSITION:/);
}

function parseFfprobeOutput(out: any) {
  let lines = out.split(/\r\n|\r|\n/);

  lines = lines.filter(function (line: any) {
    return line.length > 0;
  });

  const data = {
    streams: [],
    format: {},
    chapters: [],
  };

  function parseBlock(name: any) {
    const data = {};

    let line = lines.shift();
    while (typeof line !== "undefined") {
      if (line.toLowerCase() == "[/" + name + "]") {
        return data;
      } else if (line.match(/^\[/)) {
        line = lines.shift();
        continue;
      }

      const kv = line.match(/^([^=]+)=(.*)$/);
      if (kv) {
        if (!kv[1].match(/^TAG:/) && kv[2].match(/^[0-9]+(\.[0-9]+)?$/)) {
          data[kv[1]] = Number(kv[2]);
        } else {
          data[kv[1]] = kv[2];
        }
      }

      line = lines.shift();
    }

    return data;
  }

  let line = lines.shift();
  while (typeof line !== "undefined") {
    if (line.match(/^\[stream/i)) {
      const stream = parseBlock("stream");
      // @ts-expect-error TS(2345): Argument of type '{}' is not assignable to paramet... Remove this comment to see the full error message
      data.streams.push(stream);
    } else if (line.match(/^\[chapter/i)) {
      const chapter = parseBlock("chapter");
      // @ts-expect-error TS(2345): Argument of type '{}' is not assignable to paramet... Remove this comment to see the full error message
      data.chapters.push(chapter);
    } else if (line.toLowerCase() === "[format]") {
      data.format = parseBlock("format");
    }

    line = lines.shift();
  }

  return data;
}

/**
 * A callback passed to the {@link FfmpegCommand#ffprobe} method.
 *
 * @callback FfmpegCommand~ffprobeCallback
 *
 * @param {Error|null} err error object or null if no error happened
 * @param {Object} ffprobeData ffprobe output data; this object
 *   has the same format as what the following command returns:
 *
 *     `ffprobe -print_format json -show_streams -show_format INPUTFILE`
 * @param {Array} ffprobeData.streams stream information
 * @param {Object} ffprobeData.format format information
 */

/**
 * Run ffprobe on last specified input
 *
 * @method FfmpegCommand#ffprobe
 * @category Metadata
 *
 * @param {?Number} [index] 0-based index of input to probe (defaults to last input)
 * @param {?String[]} [options] array of output options to return
 * @param {FfmpegCommand~ffprobeCallback} callback callback function
 *
 */
export const ffprobe =
  (self: FfmpegCommand) =>
  (...argument: any[]) => {
    let input: any,
      index: number | null = null,
      options: any = [];

    // the last argument should be the callback
    const callback = argument[argument.length - 1];

    let ended = false;
    function handleCallback(err: any, data?: any) {
      if (!ended) {
        ended = true;
        callback(err, data);
      }
    }

    // map the arguments to the correct variable names
    switch (argument.length) {
      case 3:
        index = argument[0];
        options = argument[1];
        break;
      case 2:
        if (typeof argument[0] === "number") {
          index = argument[0];
        } else if (Array.isArray(argument[0])) {
          options = argument[0];
        }
        break;
    }

    if (index === null) {
      if (!self._currentInput) {
        return handleCallback(new Error("No input specified"));
      }

      input = self._currentInput;
    } else {
      input = self._inputs[index];

      if (!input) {
        return handleCallback(new Error("Invalid input index"));
      }
    }

    // Find ffprobe
    self._getFfprobePath(function (err: any, path: any) {
      if (err) {
        return handleCallback(err);
      } else if (!path) {
        return handleCallback(new Error("Cannot find ffprobe"));
      }

      let stdout = "";
      let stdoutClosed = false;
      let stderr = "";
      let stderrClosed = false;

      // Spawn ffprobe
      const src = input.isStream ? "pipe:0" : input.source;
      const ffprobe = spawn(
        path,
        ["-show_streams", "-show_format"].concat(options, src),
        { windowsHide: true }
      );

      if (input.isStream) {
        // Skip errors on stdin. These get thrown when ffprobe is complete and
        // there seems to be no way hook in and close stdin before it throws.
        ffprobe.stdin.on("error", function (err: any) {
          if (["ECONNRESET", "EPIPE", "EOF"].indexOf(err.code) >= 0) {
            return;
          }

          handleCallback(err);
        });

        // Once ffprobe's input stream closes, we need no more data from the
        // input
        ffprobe.stdin.on("close", function () {
          input.source.pause();
          input.source.unpipe(ffprobe.stdin);
        });

        input.source.pipe(ffprobe.stdin);
      }

      ffprobe.on("error", callback);

      // Ensure we wait for captured streams to end before calling callback
      let exitError: any = null;
      function handleExit(err?: any) {
        if (err) {
          exitError = err;
        }

        if (processExited && stdoutClosed && stderrClosed) {
          if (exitError) {
            if (stderr) {
              exitError.message += "\n" + stderr;
            }

            return handleCallback(exitError);
          }

          // Process output
          const data = parseFfprobeOutput(stdout);

          // Handle legacy output with "TAG:x" and "DISPOSITION:x" keys
          [data.format].concat(data.streams).forEach(function (target) {
            if (target) {
              const legacyTagKeys = Object.keys(target).filter(legacyTag);

              if (legacyTagKeys.length) {
                // @ts-expect-error TS(2339): Property 'tags' does not exist on type '{}'.
                target.tags = target.tags || {};

                legacyTagKeys.forEach(function (tagKey) {
                  // @ts-expect-error TS(2339): Property 'tags' does not exist on type '{}'.
                  target.tags[tagKey.substr(4)] = target[tagKey];

                  delete target[tagKey];
                });
              }

              const legacyDispositionKeys =
                Object.keys(target).filter(legacyDisposition);

              if (legacyDispositionKeys.length) {
                // @ts-expect-error TS(2339): Property 'disposition' does not exist on type '{}'... Remove this comment to see the full error message
                target.disposition = target.disposition || {};

                legacyDispositionKeys.forEach(function (dispositionKey) {
                  // @ts-expect-error TS(2339): Property 'disposition' does not exist on type '{}'... Remove this comment to see the full error message
                  target.disposition[dispositionKey.substr(12)] =
                    target[dispositionKey];

                  delete target[dispositionKey];
                });
              }
            }
          });

          handleCallback(null, data);
        }
      }

      // Handle ffprobe exit
      let processExited = false;
      ffprobe.on("exit", function (code: any, signal: any) {
        processExited = true;

        if (code) {
          handleExit(new Error("ffprobe exited with code " + code));
        } else if (signal) {
          handleExit(new Error("ffprobe was killed with signal " + signal));
        } else {
          handleExit();
        }
      });

      // Handle stdout/stderr streams
      ffprobe.stdout.on("data", function (data: any) {
        stdout += data;
      });

      ffprobe.stdout.on("close", function () {
        stdoutClosed = true;
        handleExit();
      });

      ffprobe.stderr.on("data", function (data: any) {
        stderr += data;
      });

      ffprobe.stderr.on("close", function () {
        stderrClosed = true;
        handleExit();
      });
    });
  };
