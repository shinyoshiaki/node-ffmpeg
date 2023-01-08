/*jshint node:true*/
"use strict";

import { FfmpegCommand } from "../fluent-ffmpeg";
import utils from "../utils";

/*
 *! Output-related methods
 */

/**
 * Add output
 *
 * @method FfmpegCommand#output
 * @category Output
 * @aliases addOutput
 *
 * @param {String|Writable} target target file path or writable stream
 * @param {Object} [pipeopts={}] pipe options (only applies to streams)
 * @return FfmpegCommand
 */
export const output =
  (self: FfmpegCommand) => (target?: any, pipeopts?: any) => {
    let isFile = false;

    if (!target && self._currentOutput) {
      // No target is only allowed when called from constructor
      throw new Error("Invalid output");
    }

    if (target && typeof target !== "string") {
      if (!("writable" in target) || !target.writable) {
        throw new Error("Invalid output");
      }
    } else if (typeof target === "string") {
      const protocol = target.match(/^([a-z]{2,}):/i);
      isFile = !protocol || protocol[0] === "file";
    }

    if (target && !("target" in self._currentOutput)) {
      // For backwards compatibility, set target for first output
      self._currentOutput.target = target;
      self._currentOutput.isFile = isFile;
      self._currentOutput.pipeopts = pipeopts || {};
    } else {
      if (target && typeof target !== "string") {
        const hasOutputStream = self._outputs.some(function (output: any) {
          return typeof output.target !== "string";
        });

        if (hasOutputStream) {
          throw new Error("Only one output stream is supported");
        }
      }

      const output = {
        target: target,
        isFile: isFile,
        flags: {},
        pipeopts: pipeopts || {},
      };
      self._outputs.push((self._currentOutput = output));

      [
        "audio",
        "audioFilters",
        "video",
        "videoFilters",
        "sizeFilters",
        "options",
      ].forEach((key) => {
        self._currentOutput[key] = utils.args();
      });

      if (!target) {
        // Call from constructor: remove target key
        delete self._currentOutput.target;
      }
    }

    return self;
  };

/**
 * Specify output seek time
 *
 * @method FfmpegCommand#seek
 * @category Input
 * @aliases seekOutput
 *
 * @param {String|Number} seek seek time in seconds or as a '[hh:[mm:]]ss[.xxx]' string
 * @return FfmpegCommand
 */
export const seek = (self: FfmpegCommand) => (seek: any) => {
  self._currentOutput.options("-ss", seek);
  return self;
};

/**
 * Set output duration
 *
 * @method FfmpegCommand#duration
 * @category Output
 * @aliases withDuration,setDuration
 *
 * @param {String|Number} duration duration in seconds or as a '[[hh:]mm:]ss[.xxx]' string
 * @return FfmpegCommand
 */
export const duration = (self: FfmpegCommand) => (duration: any) => {
  self._currentOutput.options("-t", duration);
  return self;
};

/**
 * Set output format
 *
 * @method FfmpegCommand#format
 * @category Output
 * @aliases toFormat,withOutputFormat,outputFormat
 *
 * @param {String} format output format name
 * @return FfmpegCommand
 */
export const format = (self: FfmpegCommand) => (format: string) => {
  self._currentOutput.options("-f", format);
  return self;
};

/**
 * Add stream mapping to output
 *
 * @method FfmpegCommand#map
 * @category Output
 *
 * @param {String} spec stream specification string, with optional square brackets
 * @return FfmpegCommand
 */
export const map = (self: FfmpegCommand) => (spec: any) => {
  self._currentOutput.options("-map", spec.replace(utils.streamRegexp, "[$1]"));
  return self;
};

/**
 * Run flvtool2/flvmeta on output
 *
 * @method FfmpegCommand#flvmeta
 * @category Output
 * @aliases updateFlvMetadata
 *
 * @return FfmpegCommand
 */
export const flvmeta = (self: FfmpegCommand) => () => {
  self._currentOutput.flags.flvmeta = true;
  return self;
};
