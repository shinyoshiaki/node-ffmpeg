/*jshint node:true*/
"use strict";

import async from "async";
import fs from "fs";
import path from "path";

import { FfmpegCommand } from "./fluent-ffmpeg";
import utils from "./utils";

/*
 *! Capability helpers
 */

const avCodecRegexp =
  /^\s*([D ])([E ])([VAS])([S ])([D ])([T ]) ([^ ]+) +(.*)$/;
const ffCodecRegexp =
  /^\s*([D\.])([E\.])([VAS])([I\.])([L\.])([S\.]) ([^ ]+) +(.*)$/;
const ffEncodersRegexp = /\(encoders:([^\)]+)\)/;
const ffDecodersRegexp = /\(decoders:([^\)]+)\)/;
const encodersRegexp =
  /^\s*([VAS\.])([F\.])([S\.])([X\.])([B\.])([D\.]) ([^ ]+) +(.*)$/;
const formatRegexp = /^\s*([D ])([E ]) ([^ ]+) +(.*)$/;
const lineBreakRegexp = /\r\n|\r|\n/;
const filterRegexp =
  /^(?: [T\.][S\.][C\.] )?([^ ]+) +(AA?|VV?|\|)->(AA?|VV?|\|) +(.*)$/;

const cache: any = {};

/**
 * Manually define the ffmpeg binary full path.
 *
 * @method FfmpegCommand#setFfmpegPath
 *
 * @param {String} ffmpegPath The full path to the ffmpeg binary.
 * @return FfmpegCommand
 */
export const setFfmpegPath = (self: FfmpegCommand) => (ffmpegPath: any) => {
  cache.ffmpegPath = ffmpegPath;
  return self;
};

/**
 * Manually define the ffprobe binary full path.
 *
 * @method FfmpegCommand#setFfprobePath
 *
 * @param {String} ffprobePath The full path to the ffprobe binary.
 * @return FfmpegCommand
 */
export const setFfprobePath = (self: FfmpegCommand) => (ffprobePath: any) => {
  cache.ffprobePath = ffprobePath;
  return self;
};

/**
 * Manually define the flvtool2/flvmeta binary full path.
 *
 * @method FfmpegCommand#setFlvtoolPath
 *
 * @param {String} flvtool The full path to the flvtool2 or flvmeta binary.
 * @return FfmpegCommand
 */
export const setFlvtoolPath = (self: FfmpegCommand) => (flvtool: any) => {
  cache.flvtoolPath = flvtool;
  return self;
};

/**
 * Forget executable paths
 *
 * (only used for testing purposes)
 *
 * @method FfmpegCommand#_forgetPaths
 * @private
 */
export const _forgetPaths = (self: FfmpegCommand) => () => {
  delete cache.ffmpegPath;

  delete cache.ffprobePath;

  delete cache.flvtoolPath;
};

/**
 * Check for ffmpeg availability
 *
 * If the FFMPEG_PATH environment variable is set, try to use it.
 * If it is unset or incorrect, try to find ffmpeg in the PATH instead.
 *
 * @method FfmpegCommand#_getFfmpegPath
 * @param {Function} callback callback with signature (err, path)
 * @private
 */
export const _getFfmpegPath = (self: FfmpegCommand) => (callback: any) => {
  if ("ffmpegPath" in cache) {
    return callback(null, cache.ffmpegPath);
  }

  async.waterfall(
    [
      // Try FFMPEG_PATH
      function (cb: any) {
        if (process.env.FFMPEG_PATH) {
          fs.exists(process.env.FFMPEG_PATH, function (exists: any) {
            if (exists) {
              cb(null, process.env.FFMPEG_PATH);
            } else {
              cb(null, "");
            }
          });
        } else {
          cb(null, "");
        }
      },

      // Search in the PATH
      function (ffmpeg: any, cb: any) {
        if (ffmpeg.length) {
          return cb(null, ffmpeg);
        }

        utils.which("ffmpeg", function (err: any, ffmpeg: any) {
          cb(err, ffmpeg);
        });
      },
    ],
    function (err: any, ffmpeg: any) {
      if (err) {
        callback(err);
      } else {
        callback(null, (cache.ffmpegPath = ffmpeg || ""));
      }
    }
  );
};

/**
 * Check for ffprobe availability
 *
 * If the FFPROBE_PATH environment variable is set, try to use it.
 * If it is unset or incorrect, try to find ffprobe in the PATH instead.
 * If this still fails, try to find ffprobe in the same directory as ffmpeg.
 *
 * @method FfmpegCommand#_getFfprobePath
 * @param {Function} callback callback with signature (err, path)
 * @private
 */
export const _getFfprobePath = (self: FfmpegCommand) => (callback: any) => {
  if ("ffprobePath" in cache) {
    return callback(null, cache.ffprobePath);
  }

  async.waterfall(
    [
      // Try FFPROBE_PATH
      function (cb: any) {
        if (process.env.FFPROBE_PATH) {
          fs.exists(process.env.FFPROBE_PATH, function (exists: any) {
            cb(null, exists ? process.env.FFPROBE_PATH : "");
          });
        } else {
          cb(null, "");
        }
      },

      // Search in the PATH
      function (ffprobe: any, cb: any) {
        if (ffprobe.length) {
          return cb(null, ffprobe);
        }

        utils.which("ffprobe", function (err: any, ffprobe: any) {
          cb(err, ffprobe);
        });
      },

      // Search in the same directory as ffmpeg
      function (ffprobe: any, cb: any) {
        if (ffprobe.length) {
          return cb(null, ffprobe);
        }

        self._getFfmpegPath(function (err: any, ffmpeg: any) {
          if (err) {
            cb(err);
          } else if (ffmpeg.length) {
            const name = utils.isWindows ? "ffprobe.exe" : "ffprobe";
            const ffprobe = path.join(path.dirname(ffmpeg), name);
            fs.exists(ffprobe, function (exists: any) {
              cb(null, exists ? ffprobe : "");
            });
          } else {
            cb(null, "");
          }
        });
      },
    ],
    function (err: any, ffprobe: any) {
      if (err) {
        callback(err);
      } else {
        callback(null, (cache.ffprobePath = ffprobe || ""));
      }
    }
  );
};

/**
 * Check for flvtool2/flvmeta availability
 *
 * If the FLVTOOL2_PATH or FLVMETA_PATH environment variable are set, try to use them.
 * If both are either unset or incorrect, try to find flvtool2 or flvmeta in the PATH instead.
 *
 * @method FfmpegCommand#_getFlvtoolPath
 * @param {Function} callback callback with signature (err, path)
 * @private
 */
export const _getFlvtoolPath = (self: FfmpegCommand) => (callback: any) => {
  if ("flvtoolPath" in cache) {
    return callback(null, cache.flvtoolPath);
  }

  async.waterfall(
    [
      // Try FLVMETA_PATH
      function (cb: any) {
        if (process.env.FLVMETA_PATH) {
          fs.exists(process.env.FLVMETA_PATH, function (exists: any) {
            cb(null, exists ? process.env.FLVMETA_PATH : "");
          });
        } else {
          cb(null, "");
        }
      },

      // Try FLVTOOL2_PATH
      function (flvtool: any, cb: any) {
        if (flvtool.length) {
          return cb(null, flvtool);
        }

        if (process.env.FLVTOOL2_PATH) {
          fs.exists(process.env.FLVTOOL2_PATH, function (exists: any) {
            cb(null, exists ? process.env.FLVTOOL2_PATH : "");
          });
        } else {
          cb(null, "");
        }
      },

      // Search for flvmeta in the PATH
      function (flvtool: any, cb: any) {
        if (flvtool.length) {
          return cb(null, flvtool);
        }

        utils.which("flvmeta", function (err: any, flvmeta: any) {
          cb(err, flvmeta);
        });
      },

      // Search for flvtool2 in the PATH
      function (flvtool: any, cb: any) {
        if (flvtool.length) {
          return cb(null, flvtool);
        }

        utils.which("flvtool2", function (err: any, flvtool2: any) {
          cb(err, flvtool2);
        });
      },
    ],
    function (err: any, flvtool: any) {
      if (err) {
        callback(err);
      } else {
        callback(null, (cache.flvtoolPath = flvtool || ""));
      }
    }
  );
};

/**
 * A callback passed to {@link FfmpegCommand#availableFilters}.
 *
 * @callback FfmpegCommand~filterCallback
 * @param {Error|null} err error object or null if no error happened
 * @param {Object} filters filter object with filter names as keys and the following
 *   properties for each filter:
 * @param {String} filters.description filter description
 * @param {String} filters.input input type, one of 'audio', 'video' and 'none'
 * @param {Boolean} filters.multipleInputs whether the filter supports multiple inputs
 * @param {String} filters.output output type, one of 'audio', 'video' and 'none'
 * @param {Boolean} filters.multipleOutputs whether the filter supports multiple outputs
 */

/**
 * Query ffmpeg for available filters
 *
 * @method FfmpegCommand#availableFilters
 * @category Capabilities
 * @aliases getAvailableFilters
 *
 * @param {FfmpegCommand~filterCallback} callback callback function
 */
export const getAvailableFilters = (self: FfmpegCommand) => (callback: any) => {
  if ("filters" in cache) {
    return callback(null, cache.filters);
  }

  self._spawnFfmpeg(
    ["-filters"],
    { captureStdout: true, stdoutLines: 0 },
    (err: any, stdoutRing: any) => {
      if (err) {
        return callback(err);
      }

      const stdout = stdoutRing.get();
      const lines = stdout.split("\n");
      const data = {};
      const types = { A: "audio", V: "video", "|": "none" };

      lines.forEach(function (line: any) {
        const match = line.match(filterRegexp);
        if (match) {
          data[match[1]] = {
            description: match[4],

            input: types[match[2].charAt(0)],
            multipleInputs: match[2].length > 1,

            output: types[match[3].charAt(0)],
            multipleOutputs: match[3].length > 1,
          };
        }
      });

      callback(null, (cache.filters = data));
    }
  );
};

/**
 * A callback passed to {@link FfmpegCommand#availableCodecs}.
 *
 * @callback FfmpegCommand~codecCallback
 * @param {Error|null} err error object or null if no error happened
 * @param {Object} codecs codec object with codec names as keys and the following
 *   properties for each codec (more properties may be available depending on the
 *   ffmpeg version used):
 * @param {String} codecs.description codec description
 * @param {Boolean} codecs.canDecode whether the codec is able to decode streams
 * @param {Boolean} codecs.canEncode whether the codec is able to encode streams
 */

/**
 * Query ffmpeg for available codecs
 *
 * @method FfmpegCommand#availableCodecs
 * @category Capabilities
 * @aliases getAvailableCodecs
 *
 * @param {FfmpegCommand~codecCallback} callback callback function
 */
export const getAvailableCodecs = (self: FfmpegCommand) => (callback: any) => {
  if ("codecs" in cache) {
    return callback(null, cache.codecs);
  }

  self._spawnFfmpeg(
    ["-codecs"],
    { captureStdout: true, stdoutLines: 0 },
    (err: any, stdoutRing: any) => {
      if (err) {
        return callback(err);
      }

      const stdout = stdoutRing.get();
      const lines = stdout.split(lineBreakRegexp);
      const data = {};

      lines.forEach(function (line: any) {
        let match = line.match(avCodecRegexp);
        if (match && match[7] !== "=") {
          data[match[7]] = {
            type: { V: "video", A: "audio", S: "subtitle" }[match[3]],
            description: match[8],
            canDecode: match[1] === "D",
            canEncode: match[2] === "E",
            drawHorizBand: match[4] === "S",
            directRendering: match[5] === "D",
            weirdFrameTruncation: match[6] === "T",
          };
        }

        match = line.match(ffCodecRegexp);
        if (match && match[7] !== "=") {
          const codecData = (data[match[7]] = {
            type: { V: "video", A: "audio", S: "subtitle" }[match[3]],
            description: match[8],
            canDecode: match[1] === "D",
            canEncode: match[2] === "E",
            intraFrameOnly: match[4] === "I",
            isLossy: match[5] === "L",
            isLossless: match[6] === "S",
          });

          let encoders = codecData.description.match(ffEncodersRegexp);
          encoders = encoders ? encoders[1].trim().split(" ") : [];

          let decoders = codecData.description.match(ffDecodersRegexp);
          decoders = decoders ? decoders[1].trim().split(" ") : [];

          if (encoders.length || decoders.length) {
            const coderData = {};
            utils.copy(codecData, coderData);
            // @ts-expect-error TS(2339): Property 'canEncode' does not exist on type '{}'.
            delete coderData.canEncode;
            // @ts-expect-error TS(2339): Property 'canDecode' does not exist on type '{}'.
            delete coderData.canDecode;

            encoders.forEach(function (name: any) {
              data[name] = {};

              utils.copy(coderData, data[name]);

              data[name].canEncode = true;
            });

            decoders.forEach(function (name: any) {
              if (name in data) {
                data[name].canDecode = true;
              } else {
                data[name] = {};

                utils.copy(coderData, data[name]);

                data[name].canDecode = true;
              }
            });
          }
        }
      });

      callback(null, (cache.codecs = data));
    }
  );
};

/**
 * A callback passed to {@link FfmpegCommand#availableEncoders}.
 *
 * @callback FfmpegCommand~encodersCallback
 * @param {Error|null} err error object or null if no error happened
 * @param {Object} encoders encoders object with encoder names as keys and the following
 *   properties for each encoder:
 * @param {String} encoders.description codec description
 * @param {Boolean} encoders.type "audio", "video" or "subtitle"
 * @param {Boolean} encoders.frameMT whether the encoder is able to do frame-level multithreading
 * @param {Boolean} encoders.sliceMT whether the encoder is able to do slice-level multithreading
 * @param {Boolean} encoders.experimental whether the encoder is experimental
 * @param {Boolean} encoders.drawHorizBand whether the encoder supports draw_horiz_band
 * @param {Boolean} encoders.directRendering whether the encoder supports direct encoding method 1
 */

/**
 * Query ffmpeg for available encoders
 *
 * @method FfmpegCommand#availableEncoders
 * @category Capabilities
 * @aliases getAvailableEncoders
 *
 * @param {FfmpegCommand~encodersCallback} callback callback function
 */
export const getAvailableEncoders =
  (self: FfmpegCommand) => (callback: any) => {
    if ("encoders" in cache) {
      return callback(null, cache.encoders);
    }

    self._spawnFfmpeg(
      ["-encoders"],
      { captureStdout: true, stdoutLines: 0 },
      (err: any, stdoutRing: any) => {
        if (err) {
          return callback(err);
        }

        const stdout = stdoutRing.get();
        const lines = stdout.split(lineBreakRegexp);
        const data = {};

        lines.forEach(function (line: any) {
          const match = line.match(encodersRegexp);
          if (match && match[7] !== "=") {
            data[match[7]] = {
              type: { V: "video", A: "audio", S: "subtitle" }[match[1]],
              description: match[8],
              frameMT: match[2] === "F",
              sliceMT: match[3] === "S",
              experimental: match[4] === "X",
              drawHorizBand: match[5] === "B",
              directRendering: match[6] === "D",
            };
          }
        });

        callback(null, (cache.encoders = data));
      }
    );
  };

/**
 * A callback passed to {@link FfmpegCommand#availableFormats}.
 *
 * @callback FfmpegCommand~formatCallback
 * @param {Error|null} err error object or null if no error happened
 * @param {Object} formats format object with format names as keys and the following
 *   properties for each format:
 * @param {String} formats.description format description
 * @param {Boolean} formats.canDemux whether the format is able to demux streams from an input file
 * @param {Boolean} formats.canMux whether the format is able to mux streams into an output file
 */

/**
 * Query ffmpeg for available formats
 *
 * @method FfmpegCommand#availableFormats
 * @category Capabilities
 * @aliases getAvailableFormats
 *
 * @param {FfmpegCommand~formatCallback} callback callback function
 */
export const getAvailableFormats = (self: FfmpegCommand) => (callback: any) => {
  if ("formats" in cache) {
    return callback(null, cache.formats);
  }

  // Run ffmpeg -formats
  self._spawnFfmpeg(
    ["-formats"],
    { captureStdout: true, stdoutLines: 0 },
    (err: any, stdoutRing: any) => {
      if (err) {
        return callback(err);
      }

      // Parse output
      const stdout = stdoutRing.get();
      const lines = stdout.split(lineBreakRegexp);
      const data = {};

      lines.forEach(function (line: any) {
        const match = line.match(formatRegexp);
        if (match) {
          match[3].split(",").forEach(function (format: any) {
            if (!(format in data)) {
              data[format] = {
                description: match[4],
                canDemux: false,
                canMux: false,
              };
            }

            if (match[1] === "D") {
              data[format].canDemux = true;
            }
            if (match[2] === "E") {
              data[format].canMux = true;
            }
          });
        }
      });

      callback(null, (cache.formats = data));
    }
  );
};

/**
 * Check capabilities before executing a command
 *
 * Checks whether all used codecs and formats are indeed available
 *
 * @method FfmpegCommand#_checkCapabilities
 * @param {Function} callback callback with signature (err)
 * @private
 */
export const _checkCapabilities = (self: FfmpegCommand) => (callback: any) => {
  async.waterfall(
    [
      // Get available formats
      function (cb: any) {
        self.availableFormats(cb);
      },

      // Check whether specified formats are available
      function (formats: any, cb: any) {
        let unavailable;

        // Output format(s)
        unavailable = self._outputs.reduce(function (fmts: any, output: any) {
          const format = output.options.find("-f", 1);
          if (format) {
            if (!(format[0] in formats) || !formats[format[0]].canMux) {
              fmts.push(format);
            }
          }

          return fmts;
        }, []);

        if (unavailable.length === 1) {
          return cb(
            new Error("Output format " + unavailable[0] + " is not available")
          );
        } else if (unavailable.length > 1) {
          return cb(
            new Error(
              "Output formats " + unavailable.join(", ") + " are not available"
            )
          );
        }

        // Input format(s)
        unavailable = self._inputs.reduce(function (fmts: any, input: any) {
          const format = input.options.find("-f", 1);
          if (format) {
            if (!(format[0] in formats) || !formats[format[0]].canDemux) {
              fmts.push(format[0]);
            }
          }

          return fmts;
        }, []);

        if (unavailable.length === 1) {
          return cb(
            new Error("Input format " + unavailable[0] + " is not available")
          );
        } else if (unavailable.length > 1) {
          return cb(
            new Error(
              "Input formats " + unavailable.join(", ") + " are not available"
            )
          );
        }

        cb();
      },

      // Get available codecs
      function (cb: any) {
        self.availableEncoders(cb);
      },

      // Check whether specified codecs are available and add strict experimental options if needed
      function (encoders: any, cb: any) {
        let unavailable;

        // Audio codec(s)
        unavailable = self._outputs.reduce(function (cdcs: any, output: any) {
          const acodec = output.audio.find("-acodec", 1);
          if (acodec && acodec[0] !== "copy") {
            if (
              !(acodec[0] in encoders) ||
              encoders[acodec[0]].type !== "audio"
            ) {
              cdcs.push(acodec[0]);
            }
          }

          return cdcs;
        }, []);

        if (unavailable.length === 1) {
          return cb(
            new Error("Audio codec " + unavailable[0] + " is not available")
          );
        } else if (unavailable.length > 1) {
          return cb(
            new Error(
              "Audio codecs " + unavailable.join(", ") + " are not available"
            )
          );
        }

        // Video codec(s)
        unavailable = self._outputs.reduce(function (cdcs: any, output: any) {
          const vcodec = output.video.find("-vcodec", 1);
          if (vcodec && vcodec[0] !== "copy") {
            if (
              !(vcodec[0] in encoders) ||
              encoders[vcodec[0]].type !== "video"
            ) {
              cdcs.push(vcodec[0]);
            }
          }

          return cdcs;
        }, []);

        if (unavailable.length === 1) {
          return cb(
            new Error("Video codec " + unavailable[0] + " is not available")
          );
        } else if (unavailable.length > 1) {
          return cb(
            new Error(
              "Video codecs " + unavailable.join(", ") + " are not available"
            )
          );
        }

        cb();
      },
    ],
    callback
  );
};
