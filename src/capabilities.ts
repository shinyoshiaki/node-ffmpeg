/*jshint node:true*/
"use strict";

var fs = require("fs");

var path = require("path");

var async = require("async");

var utils = require("./utils");

/*
 *! Capability helpers
 */

var avCodecRegexp = /^\s*([D ])([E ])([VAS])([S ])([D ])([T ]) ([^ ]+) +(.*)$/;
var ffCodecRegexp =
  /^\s*([D\.])([E\.])([VAS])([I\.])([L\.])([S\.]) ([^ ]+) +(.*)$/;
var ffEncodersRegexp = /\(encoders:([^\)]+)\)/;
var ffDecodersRegexp = /\(decoders:([^\)]+)\)/;
var encodersRegexp =
  /^\s*([VAS\.])([F\.])([S\.])([X\.])([B\.])([D\.]) ([^ ]+) +(.*)$/;
var formatRegexp = /^\s*([D ])([E ]) ([^ ]+) +(.*)$/;
var lineBreakRegexp = /\r\n|\r|\n/;
var filterRegexp =
  /^(?: [T\.][S\.][C\.] )?([^ ]+) +(AA?|VV?|\|)->(AA?|VV?|\|) +(.*)$/;

var cache = {};

module.exports = function (proto: any) {
  /**
   * Manually define the ffmpeg binary full path.
   *
   * @method FfmpegCommand#setFfmpegPath
   *
   * @param {String} ffmpegPath The full path to the ffmpeg binary.
   * @return FfmpegCommand
   */
  proto.setFfmpegPath = function (ffmpegPath: any) {
    // @ts-expect-error TS(2339): Property 'ffmpegPath' does not exist on type '{}'.
    cache.ffmpegPath = ffmpegPath;
    return this;
  };

  /**
   * Manually define the ffprobe binary full path.
   *
   * @method FfmpegCommand#setFfprobePath
   *
   * @param {String} ffprobePath The full path to the ffprobe binary.
   * @return FfmpegCommand
   */
  proto.setFfprobePath = function (ffprobePath: any) {
    // @ts-expect-error TS(2339): Property 'ffprobePath' does not exist on type '{}'... Remove this comment to see the full error message
    cache.ffprobePath = ffprobePath;
    return this;
  };

  /**
   * Manually define the flvtool2/flvmeta binary full path.
   *
   * @method FfmpegCommand#setFlvtoolPath
   *
   * @param {String} flvtool The full path to the flvtool2 or flvmeta binary.
   * @return FfmpegCommand
   */
  proto.setFlvtoolPath = function (flvtool: any) {
    // @ts-expect-error TS(2339): Property 'flvtoolPath' does not exist on type '{}'... Remove this comment to see the full error message
    cache.flvtoolPath = flvtool;
    return this;
  };

  /**
   * Forget executable paths
   *
   * (only used for testing purposes)
   *
   * @method FfmpegCommand#_forgetPaths
   * @private
   */
  proto._forgetPaths = function () {
    // @ts-expect-error TS(2339): Property 'ffmpegPath' does not exist on type '{}'.
    delete cache.ffmpegPath;
    // @ts-expect-error TS(2339): Property 'ffprobePath' does not exist on type '{}'... Remove this comment to see the full error message
    delete cache.ffprobePath;
    // @ts-expect-error TS(2339): Property 'flvtoolPath' does not exist on type '{}'... Remove this comment to see the full error message
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
  proto._getFfmpegPath = function (callback: any) {
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
          // @ts-expect-error TS(2339): Property 'ffmpegPath' does not exist on type '{}'.
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
  proto._getFfprobePath = function (callback: any) {
    var self = this;

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
              var name = utils.isWindows ? "ffprobe.exe" : "ffprobe";
              var ffprobe = path.join(path.dirname(ffmpeg), name);
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
          // @ts-expect-error TS(2339): Property 'ffprobePath' does not exist on type '{}'... Remove this comment to see the full error message
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
  proto._getFlvtoolPath = function (callback: any) {
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
          // @ts-expect-error TS(2339): Property 'flvtoolPath' does not exist on type '{}'... Remove this comment to see the full error message
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
  proto.availableFilters = proto.getAvailableFilters = function (
    callback: any
  ) {
    if ("filters" in cache) {
      return callback(null, cache.filters);
    }

    this._spawnFfmpeg(
      ["-filters"],
      { captureStdout: true, stdoutLines: 0 },
      function (err: any, stdoutRing: any) {
        if (err) {
          return callback(err);
        }

        var stdout = stdoutRing.get();
        var lines = stdout.split("\n");
        var data = {};
        var types = { A: "audio", V: "video", "|": "none" };

        lines.forEach(function (line: any) {
          var match = line.match(filterRegexp);
          if (match) {
            // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
            data[match[1]] = {
              description: match[4],
              // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
              input: types[match[2].charAt(0)],
              multipleInputs: match[2].length > 1,
              // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
              output: types[match[3].charAt(0)],
              multipleOutputs: match[3].length > 1,
            };
          }
        });

        // @ts-expect-error TS(2339): Property 'filters' does not exist on type '{}'.
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
  proto.availableCodecs = proto.getAvailableCodecs = function (callback: any) {
    if ("codecs" in cache) {
      return callback(null, cache.codecs);
    }

    this._spawnFfmpeg(
      ["-codecs"],
      { captureStdout: true, stdoutLines: 0 },
      function (err: any, stdoutRing: any) {
        if (err) {
          return callback(err);
        }

        var stdout = stdoutRing.get();
        var lines = stdout.split(lineBreakRegexp);
        var data = {};

        lines.forEach(function (line: any) {
          var match = line.match(avCodecRegexp);
          if (match && match[7] !== "=") {
            // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
            data[match[7]] = {
              // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
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
            // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
            var codecData = (data[match[7]] = {
              // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
              type: { V: "video", A: "audio", S: "subtitle" }[match[3]],
              description: match[8],
              canDecode: match[1] === "D",
              canEncode: match[2] === "E",
              intraFrameOnly: match[4] === "I",
              isLossy: match[5] === "L",
              isLossless: match[6] === "S",
            });

            var encoders = codecData.description.match(ffEncodersRegexp);
            encoders = encoders ? encoders[1].trim().split(" ") : [];

            var decoders = codecData.description.match(ffDecodersRegexp);
            decoders = decoders ? decoders[1].trim().split(" ") : [];

            if (encoders.length || decoders.length) {
              var coderData = {};
              utils.copy(codecData, coderData);
              // @ts-expect-error TS(2339): Property 'canEncode' does not exist on type '{}'.
              delete coderData.canEncode;
              // @ts-expect-error TS(2339): Property 'canDecode' does not exist on type '{}'.
              delete coderData.canDecode;

              encoders.forEach(function (name: any) {
                // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
                data[name] = {};
                // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
                utils.copy(coderData, data[name]);
                // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
                data[name].canEncode = true;
              });

              decoders.forEach(function (name: any) {
                if (name in data) {
                  // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
                  data[name].canDecode = true;
                } else {
                  // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
                  data[name] = {};
                  // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
                  utils.copy(coderData, data[name]);
                  // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
                  data[name].canDecode = true;
                }
              });
            }
          }
        });

        // @ts-expect-error TS(2339): Property 'codecs' does not exist on type '{}'.
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
  proto.availableEncoders = proto.getAvailableEncoders = function (
    callback: any
  ) {
    if ("encoders" in cache) {
      return callback(null, cache.encoders);
    }

    this._spawnFfmpeg(
      ["-encoders"],
      { captureStdout: true, stdoutLines: 0 },
      function (err: any, stdoutRing: any) {
        if (err) {
          return callback(err);
        }

        var stdout = stdoutRing.get();
        var lines = stdout.split(lineBreakRegexp);
        var data = {};

        lines.forEach(function (line: any) {
          var match = line.match(encodersRegexp);
          if (match && match[7] !== "=") {
            // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
            data[match[7]] = {
              // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
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

        // @ts-expect-error TS(2339): Property 'encoders' does not exist on type '{}'.
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
  proto.availableFormats = proto.getAvailableFormats = function (
    callback: any
  ) {
    if ("formats" in cache) {
      return callback(null, cache.formats);
    }

    // Run ffmpeg -formats
    this._spawnFfmpeg(
      ["-formats"],
      { captureStdout: true, stdoutLines: 0 },
      function (err: any, stdoutRing: any) {
        if (err) {
          return callback(err);
        }

        // Parse output
        var stdout = stdoutRing.get();
        var lines = stdout.split(lineBreakRegexp);
        var data = {};

        lines.forEach(function (line: any) {
          var match = line.match(formatRegexp);
          if (match) {
            match[3].split(",").forEach(function (format: any) {
              if (!(format in data)) {
                // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
                data[format] = {
                  description: match[4],
                  canDemux: false,
                  canMux: false,
                };
              }

              if (match[1] === "D") {
                // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
                data[format].canDemux = true;
              }
              if (match[2] === "E") {
                // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
                data[format].canMux = true;
              }
            });
          }
        });

        // @ts-expect-error TS(2339): Property 'formats' does not exist on type '{}'.
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
  proto._checkCapabilities = function (callback: any) {
    var self = this;
    async.waterfall(
      [
        // Get available formats
        function (cb: any) {
          self.availableFormats(cb);
        },

        // Check whether specified formats are available
        function (formats: any, cb: any) {
          var unavailable;

          // Output format(s)
          unavailable = self._outputs.reduce(function (fmts: any, output: any) {
            var format = output.options.find("-f", 1);
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
                "Output formats " +
                  unavailable.join(", ") +
                  " are not available"
              )
            );
          }

          // Input format(s)
          unavailable = self._inputs.reduce(function (fmts: any, input: any) {
            var format = input.options.find("-f", 1);
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
          var unavailable;

          // Audio codec(s)
          unavailable = self._outputs.reduce(function (cdcs: any, output: any) {
            var acodec = output.audio.find("-acodec", 1);
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
            var vcodec = output.video.find("-vcodec", 1);
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
};
