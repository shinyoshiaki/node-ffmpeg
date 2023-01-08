/*jshint node:true*/
"use strict";

import fs from "fs";
import path from "path";

const PassThrough = require("stream").PassThrough;

import async from "async";

import utils from "./utils";

/*
 * Useful recipes for commands
 */

module.exports = function recipes(proto: any) {
  /**
   * Execute ffmpeg command and save output to a file
   *
   * @method FfmpegCommand#save
   * @category Processing
   * @aliases saveToFile
   *
   * @param {String} output file path
   * @return FfmpegCommand
   */
  proto.saveToFile = proto.save = function (output: any) {
    this.output(output).run();
    return this;
  };

  /**
   * Execute ffmpeg command and save output to a stream
   *
   * If 'stream' is not specified, a PassThrough stream is created and returned.
   * 'options' will be used when piping ffmpeg output to the output stream
   * (@see http://nodejs.org/api/stream.html#stream_readable_pipe_destination_options)
   *
   * @method FfmpegCommand#pipe
   * @category Processing
   * @aliases stream,writeToStream
   *
   * @param {stream.Writable} [stream] output stream
   * @param {Object} [options={}] pipe options
   * @return Output stream
   */
  proto.writeToStream =
    proto.pipe =
    proto.stream =
      function (stream: any, options: any) {
        if (stream && !("writable" in stream)) {
          options = stream;
          stream = undefined;
        }

        if (!stream) {
          if (process.version.match(/v0\.8\./)) {
            throw new Error("PassThrough stream is not supported on node v0.8");
          }

          stream = new PassThrough();
        }

        this.output(stream, options).run();
        return stream;
      };

  /**
   * Generate images from a video
   *
   * Note: this method makes the command emit a 'filenames' event with an array of
   * the generated image filenames.
   *
   * @method FfmpegCommand#screenshots
   * @category Processing
   * @aliases takeScreenshots,thumbnail,thumbnails,screenshot
   *
   * @param {Number|Object} [config=1] screenshot count or configuration object with
   *   the following keys:
   * @param {Number} [config.count] number of screenshots to take; using this option
   *   takes screenshots at regular intervals (eg. count=4 would take screens at 20%, 40%,
   *   60% and 80% of the video length).
   * @param {String} [config.folder='.'] output folder
   * @param {String} [config.filename='tn.png'] output filename pattern, may contain the following
   *   tokens:
   *   - '%s': offset in seconds
   *   - '%w': screenshot width
   *   - '%h': screenshot height
   *   - '%r': screenshot resolution (same as '%wx%h')
   *   - '%f': input filename
   *   - '%b': input basename (filename w/o extension)
   *   - '%i': index of screenshot in timemark array (can be zero-padded by using it like `%000i`)
   * @param {Number[]|String[]} [config.timemarks] array of timemarks to take screenshots
   *   at; each timemark may be a number of seconds, a '[[hh:]mm:]ss[.xxx]' string or a
   *   'XX%' string.  Overrides 'count' if present.
   * @param {Number[]|String[]} [config.timestamps] alias for 'timemarks'
   * @param {Boolean} [config.fastSeek] use fast seek (less accurate)
   * @param {String} [config.size] screenshot size, with the same syntax as {@link FfmpegCommand#size}
   * @param {String} [folder] output folder (legacy alias for 'config.folder')
   * @return FfmpegCommand
   */
  proto.takeScreenshots =
    proto.thumbnail =
    proto.thumbnails =
    proto.screenshot =
    proto.screenshots =
      function (config: any, folder: any) {
        const self = this;
        const source = this._currentInput.source;
        config = config || { count: 1 };

        // Accept a number of screenshots instead of a config object
        if (typeof config === "number") {
          config = {
            count: config,
          };
        }

        // Accept a second 'folder' parameter instead of config.folder
        if (!("folder" in config)) {
          config.folder = folder || ".";
        }

        // Accept 'timestamps' instead of 'timemarks'
        if ("timestamps" in config) {
          config.timemarks = config.timestamps;
        }

        // Compute timemarks from count if not present
        if (!("timemarks" in config)) {
          if (!config.count) {
            throw new Error(
              "Cannot take screenshots: neither a count nor a timemark list are specified"
            );
          }

          const interval = 100 / (1 + config.count);
          config.timemarks = [];
          for (let i = 0; i < config.count; i++) {
            config.timemarks.push(interval * (i + 1) + "%");
          }
        }

        // Parse size option
        if ("size" in config) {
          var fixedSize = config.size.match(/^(\d+)x(\d+)$/);
          var fixedWidth = config.size.match(/^(\d+)x\?$/);
          var fixedHeight = config.size.match(/^\?x(\d+)$/);
          var percentSize = config.size.match(/^(\d+)%$/);

          if (!fixedSize && !fixedWidth && !fixedHeight && !percentSize) {
            throw new Error("Invalid size parameter: " + config.size);
          }
        }

        // Metadata helper
        let metadata: any;
        function getMetadata(cb: any) {
          if (metadata) {
            cb(null, metadata);
          } else {
            self.ffprobe(function (err: any, meta: any) {
              metadata = meta;
              cb(err, meta);
            });
          }
        }

        async.waterfall(
          [
            // Compute percent timemarks if any
            function computeTimemarks(next: any) {
              if (
                config.timemarks.some(function (t: any) {
                  return ("" + t).match(/^[\d.]+%$/);
                })
              ) {
                if (typeof source !== "string") {
                  return next(
                    new Error(
                      "Cannot compute screenshot timemarks with an input stream, please specify fixed timemarks"
                    )
                  );
                }

                getMetadata(function (err: any, meta: any) {
                  if (err) {
                    next(err);
                  } else {
                    // Select video stream with the highest resolution
                    const vstream = meta.streams.reduce(
                      function (biggest: any, stream: any) {
                        if (
                          stream.codec_type === "video" &&
                          stream.width * stream.height >
                            biggest.width * biggest.height
                        ) {
                          return stream;
                        } else {
                          return biggest;
                        }
                      },
                      { width: 0, height: 0 }
                    );

                    if (vstream.width === 0) {
                      return next(
                        new Error(
                          "No video stream in input, cannot take screenshots"
                        )
                      );
                    }

                    let duration = Number(vstream.duration);
                    if (isNaN(duration)) {
                      duration = Number(meta.format.duration);
                    }

                    if (isNaN(duration)) {
                      return next(
                        new Error(
                          "Could not get input duration, please specify fixed timemarks"
                        )
                      );
                    }

                    config.timemarks = config.timemarks.map(function (
                      mark: any
                    ) {
                      if (("" + mark).match(/^([\d.]+)%$/)) {
                        return (duration * parseFloat(mark)) / 100;
                      } else {
                        return mark;
                      }
                    });

                    next();
                  }
                });
              } else {
                next();
              }
            },

            // Turn all timemarks into numbers and sort them
            function normalizeTimemarks(next: any) {
              config.timemarks = config.timemarks
                .map(function (mark: any) {
                  return utils.timemarkToSeconds(mark);
                })
                .sort(function (a: any, b: any) {
                  return a - b;
                });

              next();
            },

            // Add '_%i' to pattern when requesting multiple screenshots and no variable token is present
            function fixPattern(next: any) {
              let pattern = config.filename || "tn.png";

              if (pattern.indexOf(".") === -1) {
                pattern += ".png";
              }

              if (config.timemarks.length > 1 && !pattern.match(/%(s|0*i)/)) {
                const ext = path.extname(pattern);
                pattern = path.join(
                  path.dirname(pattern),
                  path.basename(pattern, ext) + "_%i" + ext
                );
              }

              next(null, pattern);
            },

            // Replace filename tokens (%f, %b) in pattern
            function replaceFilenameTokens(pattern: any, next: any) {
              if (pattern.match(/%[bf]/)) {
                if (typeof source !== "string") {
                  return next(
                    new Error(
                      "Cannot replace %f or %b when using an input stream"
                    )
                  );
                }

                pattern = pattern
                  .replace(/%f/g, path.basename(source))
                  .replace(/%b/g, path.basename(source, path.extname(source)));
              }

              next(null, pattern);
            },

            // Compute size if needed
            function getSize(pattern: any, next: any) {
              if (pattern.match(/%[whr]/)) {
                if (fixedSize) {
                  return next(null, pattern, fixedSize[1], fixedSize[2]);
                }

                getMetadata(function (err: any, meta: any) {
                  if (err) {
                    return next(
                      new Error(
                        "Could not determine video resolution to replace %w, %h or %r"
                      )
                    );
                  }

                  const vstream = meta.streams.reduce(
                    function (biggest: any, stream: any) {
                      if (
                        stream.codec_type === "video" &&
                        stream.width * stream.height >
                          biggest.width * biggest.height
                      ) {
                        return stream;
                      } else {
                        return biggest;
                      }
                    },
                    { width: 0, height: 0 }
                  );

                  if (vstream.width === 0) {
                    return next(
                      new Error(
                        "No video stream in input, cannot replace %w, %h or %r"
                      )
                    );
                  }

                  let width = vstream.width;
                  let height = vstream.height;

                  if (fixedWidth) {
                    height = (height * Number(fixedWidth[1])) / width;
                    width = Number(fixedWidth[1]);
                  } else if (fixedHeight) {
                    width = (width * Number(fixedHeight[1])) / height;
                    height = Number(fixedHeight[1]);
                  } else if (percentSize) {
                    width = (width * Number(percentSize[1])) / 100;
                    height = (height * Number(percentSize[1])) / 100;
                  }

                  next(
                    null,
                    pattern,
                    Math.round(width / 2) * 2,
                    Math.round(height / 2) * 2
                  );
                });
              } else {
                next(null, pattern, -1, -1);
              }
            },

            // Replace size tokens (%w, %h, %r) in pattern
            function replaceSizeTokens(
              pattern: any,
              width: any,
              height: any,
              next: any
            ) {
              pattern = pattern
                .replace(/%r/g, "%wx%h")
                .replace(/%w/g, width)
                .replace(/%h/g, height);

              next(null, pattern);
            },

            // Replace variable tokens in pattern (%s, %i) and generate filename list
            function replaceVariableTokens(pattern: any, next: any) {
              const filenames = config.timemarks.map(function (t: any, i: any) {
                return pattern
                  .replace(/%s/g, utils.timemarkToSeconds(t))
                  .replace(/%(0*)i/g, function (match: any, padding: any) {
                    const idx = "" + (i + 1);
                    return (
                      padding.substr(
                        0,
                        Math.max(0, padding.length + 1 - idx.length)
                      ) + idx
                    );
                  });
              });

              self.emit("filenames", filenames);
              next(null, filenames);
            },

            // Create output directory
            function createDirectory(filenames: any, next: any) {
              fs.exists(config.folder, function (exists: any) {
                if (!exists) {
                  fs.mkdir(config.folder, function (err: any) {
                    if (err) {
                      next(err);
                    } else {
                      next(null, filenames);
                    }
                  });
                } else {
                  next(null, filenames);
                }
              });
            },
          ],
          function runCommand(err: any, filenames: any) {
            if (err) {
              return self.emit("error", err);
            }

            const count = config.timemarks.length;
            let split;
            let filters = [
              (split = {
                filter: "split",
                options: count,
                outputs: [],
              }),
            ];

            if ("size" in config) {
              // Set size to generate size filters
              self.size(config.size);

              // Get size filters and chain them with 'sizeN' stream names
              const sizeFilters = self._currentOutput.sizeFilters
                .get()
                .map(function (f: any, i: any) {
                  if (i > 0) {
                    f.inputs = "size" + (i - 1);
                  }

                  f.outputs = "size" + i;

                  return f;
                });

              // Input last size filter output into split filter
              // @ts-expect-error TS(2339): Property 'inputs' does not exist on type '{ filter... Remove this comment to see the full error message
              split.inputs = "size" + (sizeFilters.length - 1);

              // Add size filters in front of split filter
              filters = sizeFilters.concat(filters);

              // Remove size filters
              self._currentOutput.sizeFilters.clear();
            }

            let first = 0;
            for (let i = 0; i < count; i++) {
              const stream = "screen" + i;
              // @ts-expect-error TS(2345): Argument of type 'string' is not assignable to par... Remove this comment to see the full error message
              split.outputs.push(stream);

              if (i === 0) {
                first = config.timemarks[i];
                self.seekInput(first);
              }

              self
                .output(path.join(config.folder, filenames[i]))
                .frames(1)
                .map(stream);

              if (i > 0) {
                self.seek(config.timemarks[i] - first);
              }
            }

            self.complexFilter(filters);
            self.run();
          }
        );

        return this;
      };

  /**
   * Merge (concatenate) inputs to a single file
   *
   * @method FfmpegCommand#concat
   * @category Processing
   * @aliases concatenate,mergeToFile
   *
   * @param {String|Writable} target output file or writable stream
   * @param {Object} [options] pipe options (only used when outputting to a writable stream)
   * @return FfmpegCommand
   */
  proto.mergeToFile =
    proto.concatenate =
    proto.concat =
      function (target: any, options: any) {
        // Find out which streams are present in the first non-stream input
        const fileInput = this._inputs.filter(function (input: any) {
          return !input.isStream;
        })[0];

        const self = this;
        this.ffprobe(
          this._inputs.indexOf(fileInput),
          function (err: any, data: any) {
            if (err) {
              return self.emit("error", err);
            }

            const hasAudioStreams = data.streams.some(function (stream: any) {
              return stream.codec_type === "audio";
            });

            const hasVideoStreams = data.streams.some(function (stream: any) {
              return stream.codec_type === "video";
            });

            // Setup concat filter and start processing
            self
              .output(target, options)
              .complexFilter({
                filter: "concat",
                options: {
                  n: self._inputs.length,
                  v: hasVideoStreams ? 1 : 0,
                  a: hasAudioStreams ? 1 : 0,
                },
              })
              .run();
          }
        );

        return this;
      };
};
