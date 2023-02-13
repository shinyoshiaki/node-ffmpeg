/*jshint node:true*/
"use strict";
import async from "async";
import { ChildProcessWithoutNullStreams, spawn } from "child_process";

import { FfmpegCommand } from "./fluent-ffmpeg";
import utils from "./utils";

/*
 *! Processor methods
 */

/**
 * Run ffprobe asynchronously and store data in command
 *
 * @param {FfmpegCommand} command
 * @private
 */
function runFfprobe(command: any) {
  const inputProbeIndex = 0;
  if (command._inputs[inputProbeIndex].isStream) {
    // Don't probe input streams as this will consume them
    return;
  }
  command.ffprobe(inputProbeIndex, function (err: any, data: any) {
    command._ffprobeData = data;
  });
}

/**
 * Emitted just after ffmpeg has been spawned.
 *
 * @event FfmpegCommand#start
 * @param {String} command ffmpeg command line
 */

/**
 * Emitted when ffmpeg reports progress information
 *
 * @event FfmpegCommand#progress
 * @param {Object} progress progress object
 * @param {Number} progress.frames number of frames transcoded
 * @param {Number} progress.currentFps current processing speed in frames per second
 * @param {Number} progress.currentKbps current output generation speed in kilobytes per second
 * @param {Number} progress.targetSize current output file size
 * @param {String} progress.timemark current video timemark
 * @param {Number} [progress.percent] processing progress (may not be available depending on input)
 */

/**
 * Emitted when ffmpeg outputs to stderr
 *
 * @event FfmpegCommand#stderr
 * @param {String} line stderr output line
 */

/**
 * Emitted when ffmpeg reports input codec data
 *
 * @event FfmpegCommand#codecData
 * @param {Object} codecData codec data object
 * @param {String} codecData.format input format name
 * @param {String} codecData.audio input audio codec name
 * @param {String} codecData.audio_details input audio codec parameters
 * @param {String} codecData.video input video codec name
 * @param {String} codecData.video_details input video codec parameters
 */

/**
 * Emitted when an error happens when preparing or running a command
 *
 * @event FfmpegCommand#error
 * @param {Error} error error object, with optional properties 'inputStreamError' / 'outputStreamError' for errors on their respective streams
 * @param {String|null} stdout ffmpeg stdout, unless outputting to a stream
 * @param {String|null} stderr ffmpeg stderr
 */

/**
 * Emitted when a command finishes processing
 *
 * @event FfmpegCommand#end
 * @param {Array|String|null} [filenames|stdout] generated filenames when taking screenshots, ffmpeg stdout when not outputting to a stream, null otherwise
 * @param {String|null} stderr ffmpeg stderr
 */

/**
 * Spawn an ffmpeg process
 *
 * The 'options' argument may contain the following keys:
 * - 'niceness': specify process niceness, ignored on Windows (default: 0)
 * - `cwd`: change working directory
 * - 'captureStdout': capture stdout and pass it to 'endCB' as its 2nd argument (default: false)
 * - 'stdoutLines': override command limit (default: use command limit)
 *
 * The 'processCB' callback, if present, is called as soon as the process is created and
 * receives a nodejs ChildProcess object.  It may not be called at all if an error happens
 * before spawning the process.
 *
 * The 'endCB' callback is called either when an error occurs or when the ffmpeg process finishes.
 *
 * @method FfmpegCommand#_spawnFfmpeg
 * @param {Array} args ffmpeg command line argument list
 * @param {Object} [options] spawn options (see above)
 * @param {Function} [processCB] callback called with process object and stdout/stderr ring buffers when process has been created
 * @param {Function} endCB callback called with error (if applicable) and stdout/stderr ring buffers when process finished
 * @private
 */
export const _spawnFfmpeg =
  (self: FfmpegCommand) =>
  (
    args: any,
    options: any,
    processCB: (
      proc: ChildProcessWithoutNullStreams,
      stdout: any,
      stderr: any
    ) => any,
    endCB?: any
  ) => {
    // Enable omitting options
    if (typeof options === "function") {
      endCB = processCB;
      processCB = options;
      options = {};
    }

    // Enable omitting processCB
    if (typeof endCB === "undefined") {
      endCB = processCB;
      processCB = () => {};
    }

    const maxLines =
      "stdoutLines" in options ? options.stdoutLines : self.options.stdoutLines;

    // Find ffmpeg
    self._getFfmpegPath((err: any, command: any) => {
      if (err) {
        return endCB(err);
      } else if (!command || command.length === 0) {
        return endCB(new Error("Cannot find ffmpeg"));
      }

      // Apply niceness
      if (options.niceness && options.niceness !== 0 && !utils.isWindows) {
        args.unshift("-n", options.niceness, command);
        command = "nice";
      }

      const stdoutRing = utils.linesRing(maxLines);
      let stdoutClosed = false;

      const stderrRing = utils.linesRing(maxLines);
      let stderrClosed = false;
      self.logger.info(command, args, options, command + " " + args.join(" "));
      // Spawn process
      const ffmpegProc = spawn(command, args, options);

      if (ffmpegProc.stderr) {
        ffmpegProc.stderr.setEncoding("utf8");
      }

      ffmpegProc.on("error", (err: any) => {
        endCB(err);
      });

      // Ensure we wait for captured streams to end before calling endCB
      let exitError: any = null;
      const handleExit = (err?: any) => {
        if (err) {
          exitError = err;
        }

        if (
          processExited &&
          (stdoutClosed || !options.captureStdout) &&
          stderrClosed
        ) {
          endCB(exitError, stdoutRing, stderrRing);
        }
      };

      // Handle process exit
      let processExited = false;
      ffmpegProc.on("exit", (code: any, signal: any) => {
        processExited = true;

        if (signal) {
          handleExit(new Error("ffmpeg was killed with signal " + signal));
        } else if (code) {
          handleExit(new Error("ffmpeg exited with code " + code));
        } else {
          handleExit();
        }
      });

      // Capture stdout if specified
      if (options.captureStdout) {
        ffmpegProc.stdout.on("data", function (data: any) {
          stdoutRing.append(data);
        });

        ffmpegProc.stdout.on("close", function () {
          stdoutRing.close();
          stdoutClosed = true;

          handleExit();
        });
      }

      // Capture stderr if specified
      ffmpegProc.stderr.on("data", function (data: any) {
        stderrRing.append(data);
      });

      ffmpegProc.stderr.on("close", function () {
        stderrRing.close();
        stderrClosed = true;

        handleExit();
      });

      // Call process callback
      processCB(ffmpegProc, stdoutRing, stderrRing);
    });
  };

/**
 * Build the argument list for an ffmpeg command
 *
 * @method FfmpegCommand#_getArguments
 * @return argument list
 * @private
 */
export const _getArguments = (self: FfmpegCommand) => () => {
  const complexFilters = self._complexFilters.get();

  const fileOutput = self._outputs.some(function (output: any) {
    return output.isFile;
  });

  // Inputs and input options
  const inputsAndInputOptions = self._inputs.reduce((args: any, input) => {
    const source = typeof input.source === "string" ? input.source : "pipe:0";

    // For each input, add input options, then '-i <source>'
    const inputOptions = input.options.get();
    return args.concat(inputOptions, ["-i", source]);
  }, []);

  // Global options
  const globalOptions = self._global.get();

  // Outputs, filters and output options
  const OutputsAndFiltersAndOutputOptions = self._outputs.reduce(
    (args: any[], output) => {
      const sizeFilters = utils.makeFilterStrings(output.sizeFilters.get());
      const audioFilters = output.audioFilters.get();
      const videoFilters = output.videoFilters.get().concat(sizeFilters);
      let outputArg: any;

      if (!output.target) {
        outputArg = [];
      } else if (typeof output.target === "string") {
        outputArg = [output.target];
      } else {
        outputArg = ["pipe:1"];
      }

      const outputAudio = output.audio.get();
      const outputVideo = output.video.get();
      const outputOptions = output.options.get();

      const res = args.concat(
        outputAudio,
        audioFilters.length ? ["-filter:a", audioFilters.join(",")] : [],
        outputVideo,
        videoFilters.length ? ["-filter:v", videoFilters.join(",")] : [],
        outputOptions,
        outputArg
      );
      return res;
    },
    []
  );

  const args = [].concat(
    inputsAndInputOptions,
    globalOptions,
    // Overwrite if we have file outputs
    // @ts-expect-error TS(2769): No overload matches this call.
    fileOutput ? ["-y"] : [],
    // Complex filters
    complexFilters,
    OutputsAndFiltersAndOutputOptions
  );
  return args;
};

/**
 * Prepare execution of an ffmpeg command
 *
 * Checks prerequisites for the execution of the command (codec/format availability, flvtool...),
 * then builds the argument list for ffmpeg and pass them to 'callback'.
 *
 * @method FfmpegCommand#_prepare
 * @param {Function} callback callback with signature (err, args)
 * @param {Boolean} [readMetadata=false] read metadata before processing
 * @private
 */
export const _prepare =
  (self: FfmpegCommand) => (callback: any, readMetadata?: any) => {
    async.waterfall(
      [
        // Check codecs and formats
        function (cb: any) {
          self._checkCapabilities(cb);
        },

        // Read metadata if required
        function (cb: any) {
          if (!readMetadata) {
            return cb();
          }

          self.ffprobe(0, function (err: any, data: any) {
            if (!err) {
              self._ffprobeData = data;
            }

            cb();
          });
        },

        // Check for flvtool2/flvmeta if necessary
        function (cb: any) {
          const flvmeta = self._outputs.some(function (output: any) {
            // Remove flvmeta flag on non-file output
            if (output.flags.flvmeta && !output.isFile) {
              self.logger.warn(
                "Updating flv metadata is only supported for files"
              );
              output.flags.flvmeta = false;
            }

            return output.flags.flvmeta;
          });

          if (flvmeta) {
            self._getFlvtoolPath(function (err: any) {
              cb(err);
            });
          } else {
            cb();
          }
        },

        // Build argument list
        function (cb: any) {
          let args;
          try {
            args = self._getArguments();
          } catch (e) {
            return cb(e);
          }

          cb(null, args);
        },

        // Add "-strict experimental" option where needed
        function (args: any, cb: any) {
          self.availableEncoders(function (err: any, encoders: any) {
            for (let i = 0; i < args.length; i++) {
              if (args[i] === "-acodec" || args[i] === "-vcodec") {
                i++;

                if (args[i] in encoders && encoders[args[i]].experimental) {
                  args.splice(i + 1, 0, "-strict", "experimental");
                  i += 2;
                }
              }
            }

            cb(null, args);
          });
        },
      ],
      callback
    );

    if (!readMetadata) {
      // Read metadata as soon as 'progress' listeners are added

      if (self.listeners("progress").length > 0) {
        // Read metadata in parallel
        runFfprobe(this);
      } else {
        // Read metadata as soon as the first 'progress' listener is added
        self.once("newListener", function (this: any, event: any) {
          if (event === "progress") {
            runFfprobe(this);
          }
        });
      }
    }
  };

/**
 * Run ffmpeg command
 *
 * @method FfmpegCommand#run
 * @category Processing
 * @aliases exec,execute
 */
export const run = (self: FfmpegCommand) => () => {
  // Check if at least one output is present
  const outputPresent = self._outputs.some(function (output: any) {
    return "target" in output;
  });

  if (!outputPresent) {
    throw new Error("No output specified");
  }

  // Get output stream if any
  const outputStream = self._outputs.filter(function (output: any) {
    return typeof output.target !== "string";
  })[0];

  // Get input stream if any
  const inputStream = self._inputs.filter(function (input: any) {
    return typeof input.source !== "string";
  })[0];

  // Ensure we send 'end' or 'error' only once
  let ended = false;
  function emitEnd(err: any, stdout?: any, stderr?: any) {
    if (!ended) {
      ended = true;

      if (err) {
        self.emit("error", err, stdout, stderr);
      } else {
        self.emit("end", stdout, stderr);
      }
    }
  }

  self._prepare(function (err: any, args: any) {
    if (err) {
      return emitEnd(err);
    }

    // Run ffmpeg
    self._spawnFfmpeg(
      args,
      {
        captureStdout: !outputStream,
        niceness: self.options.niceness,
        cwd: self.options.cwd,
        windowsHide: true,
      },

      (ffmpegProc, stdoutRing: any, stderrRing: any) => {
        self.ffmpegProc = ffmpegProc;
        self.emit("start", "ffmpeg " + args.join(" "));

        // Pipe input stream if any
        if (inputStream) {
          inputStream.source.on("error", function (err: any) {
            const reportingErr = new Error(
              "Input stream error: " + err.message
            );
            // @ts-expect-error TS(2339): Property 'inputStreamError' does not exist on type... Remove this comment to see the full error message
            reportingErr.inputStreamError = err;

            emitEnd(reportingErr);
            ffmpegProc.kill();
          });

          inputStream.source.resume();
          inputStream.source.pipe(ffmpegProc.stdin);

          // Set stdin error handler on ffmpeg (prevents nodejs catching the error, but
          // ffmpeg will fail anyway, so no need to actually handle anything)
          ffmpegProc.stdin.on("error", function () {});
        }

        // Setup timeout if requested
        if (self.options.timeout) {
          self.processTimer = setTimeout(function () {
            const msg =
              "process ran into a timeout (" + self.options.timeout + "s)";

            emitEnd(new Error(msg), stdoutRing.get(), stderrRing.get());
            ffmpegProc.kill();
          }, self.options.timeout * 1000);
        }

        if (outputStream) {
          // Pipe ffmpeg stdout to output stream
          ffmpegProc.stdout.pipe(outputStream.target, outputStream.pipeopts);

          // Handle output stream events
          outputStream.target.on("close", function () {
            self.logger.debug(
              "Output stream closed, scheduling kill for ffmpeg process"
            );

            // Don't kill process yet, to give a chance to ffmpeg to
            // terminate successfully first  This is necessary because
            // under load, the process 'exit' event sometimes happens
            // after the output stream 'close' event.
            setTimeout(function () {
              emitEnd(new Error("Output stream closed"));
              ffmpegProc.kill();
            }, 20);
          });

          outputStream.target.on("error", function (err: any) {
            self.logger.debug("Output stream error, killing ffmpeg process");
            const reportingErr = new Error(
              "Output stream error: " + err.message
            );
            // @ts-expect-error TS(2339): Property 'outputStreamError' does not exist on typ... Remove this comment to see the full error message
            reportingErr.outputStreamError = err;
            emitEnd(reportingErr, stdoutRing.get(), stderrRing.get());
            ffmpegProc.kill("SIGKILL");
          });
        }

        // Setup stderr handling
        if (stderrRing) {
          // 'stderr' event
          if (self.listeners("stderr").length) {
            stderrRing.callback(function (line: any) {
              self.emit("stderr", line);
            });
          }

          // 'codecData' event
          if (self.listeners("codecData").length) {
            let codecDataSent = false;
            const codecObject = {};

            stderrRing.callback(function (line: any) {
              if (!codecDataSent)
                codecDataSent = utils.extractCodecData(self, line, codecObject);
            });
          }

          // 'progress' event
          if (self.listeners("progress").length) {
            stderrRing.callback(function (line: any) {
              utils.extractProgress(self, line);
            });
          }
        }
      },
      (err: any, stdoutRing: any, stderrRing: any) => {
        clearTimeout(self.processTimer);
        delete self.ffmpegProc;

        if (err) {
          if (err.message.match(/ffmpeg exited with code/)) {
            // Add ffmpeg error message
            err.message += ": " + utils.extractError(stderrRing.get());
          }

          emitEnd(err, stdoutRing.get(), stderrRing.get());
        } else {
          // Find out which outputs need flv metadata
          const flvmeta = self._outputs.filter((output: any) => {
            return output.flags.flvmeta;
          });

          if (flvmeta.length) {
            self._getFlvtoolPath((err: any, flvtool: any) => {
              if (err) {
                return emitEnd(err);
              }

              async.each(
                flvmeta,
                (output: any, cb: any) => {
                  spawn(flvtool, ["-U", output.target], {
                    windowsHide: true,
                  })
                    .on("error", (err: any) => {
                      cb(
                        new Error(
                          "Error running " +
                            flvtool +
                            " on " +
                            output.target +
                            ": " +
                            err.message
                        )
                      );
                    })
                    .on("exit", function (code: any, signal: any) {
                      if (code !== 0 || signal) {
                        cb(
                          new Error(
                            flvtool +
                              " " +
                              (signal
                                ? "received signal " + signal
                                : "exited with code " + code)
                          ) +
                            " when running on " +
                            output.target
                        );
                      } else {
                        cb();
                      }
                    });
                },
                function (err: any) {
                  if (err) {
                    emitEnd(err);
                  } else {
                    emitEnd(null, stdoutRing.get(), stderrRing.get());
                  }
                }
              );
            });
          } else {
            emitEnd(null, stdoutRing.get(), stderrRing.get());
          }
        }
      }
    );
  });

  return self;
};

/**
 * Renice current and/or future ffmpeg processes
 *
 * Ignored on Windows platforms.
 *
 * @method FfmpegCommand#renice
 * @category Processing
 *
 * @param {Number} [niceness=0] niceness value between -20 (highest priority) and 20 (lowest priority)
 * @return FfmpegCommand
 */
export const renice = (self: FfmpegCommand) => (niceness: any) => {
  if (!utils.isWindows) {
    niceness = niceness || 0;

    if (niceness < -20 || niceness > 20) {
      self.logger.warn(
        "Invalid niceness value: " + niceness + ", must be between -20 and 20"
      );
    }

    niceness = Math.min(20, Math.max(-20, niceness));
    self.options.niceness = niceness;

    if (self.ffmpegProc) {
      const logger = self.logger;
      const pid = self.ffmpegProc.pid;
      const renice = spawn("renice", [niceness, "-p", pid], {
        windowsHide: true,
      });

      renice.on("error", function (err: any) {
        logger.warn("could not renice process " + pid + ": " + err.message);
      });

      renice.on("exit", function (code: any, signal: any) {
        if (signal) {
          logger.warn(
            "could not renice process " +
              pid +
              ": renice was killed by signal " +
              signal
          );
        } else if (code) {
          logger.warn(
            "could not renice process " + pid + ": renice exited with " + code
          );
        } else {
          logger.info(
            "successfully reniced process " +
              pid +
              " to " +
              niceness +
              " niceness"
          );
        }
      });
    }
  }

  return self;
};

export const kill =
  (self: FfmpegCommand) =>
  /**
   * Kill current ffmpeg process, if any
   *
   * @method FfmpegCommand#kill
   * @category Processing
   *
   * @param {String} [signal=SIGKILL] signal name
   * @return FfmpegCommand
   */
  (signal?: any) => {
    if (!self.ffmpegProc) {
      self.logger.warn("No running ffmpeg process, cannot send signal");
    } else {
      self.ffmpegProc.kill(signal || "SIGKILL");
    }

    return self;
  };
