/*jshint node:true*/
"use strict";

import { FfmpegCommand } from "../fluent-ffmpeg";
import utils from "../utils";

/**
 * Add an input to command
 *
 * Also switches "current input", that is the input that will be affected
 * by subsequent input-related methods.
 *
 * Note: only one stream input is supported for now.
 *
 * @method FfmpegCommand#input
 * @category Input
 * @aliases mergeAdd,addInput
 *
 * @param {String|Readable} source input file path or readable stream
 * @return FfmpegCommand
 */
export const mergeAdd = (self: FfmpegCommand) => (source: any) => {
  let isFile = false;
  let isStream = false;

  if (typeof source !== "string") {
    if (!("readable" in source) || !source.readable) {
      throw new Error("Invalid input");
    }

    const hasInputStream = self._inputs.some((input: any) => {
      return input.isStream;
    });

    if (hasInputStream) {
      throw new Error("Only one input stream is supported");
    }

    isStream = true;
    source.pause();
  } else {
    const protocol = source.match(/^([a-z]{2,}):/i);
    isFile = !protocol || protocol[0] === "file";
  }

  self._inputs.push(
    (self._currentInput = {
      source: source,
      isFile: isFile,
      isStream: isStream,
      options: utils.args(),
    })
  );

  return self;
};

/**
 * Specify input format for the last specified input
 *
 * @method FfmpegCommand#inputFormat
 * @category Input
 * @aliases withInputFormat,fromFormat
 *
 * @param {String} format input format
 * @return FfmpegCommand
 */
export const withInputFormat = (self: FfmpegCommand) => (format: any) => {
  if (!self._currentInput) {
    throw new Error("No input specified");
  }

  self._currentInput.options("-f", format);
  return self;
};

/**
 * Specify input FPS for the last specified input
 * (only valid for raw video formats)
 *
 * @method FfmpegCommand#inputFps
 * @category Input
 * @aliases withInputFps,withInputFPS,withFpsInput,withFPSInput,inputFPS,inputFps,fpsInput
 *
 * @param {Number} fps input FPS
 * @return FfmpegCommand
 */
export const withInputFps = (self: FfmpegCommand) => (fps: any) => {
  if (!self._currentInput) {
    throw new Error("No input specified");
  }

  self._currentInput.options("-r", fps);
  return self;
};

/**
 * Use native framerate for the last specified input
 *
 * @method FfmpegCommand#native
 * @category Input
 * @aliases nativeFramerate,withNativeFramerate
 *
 * @return FfmmegCommand
 */
export const nativeFramerate = (self: FfmpegCommand) => () => {
  if (!self._currentInput) {
    throw new Error("No input specified");
  }

  self._currentInput.options("-re");
  return self;
};

/**
 * Specify input seek time for the last specified input
 *
 * @method FfmpegCommand#seekInput
 * @category Input
 * @aliases setStartTime,seekTo
 *
 * @param {String|Number} seek seek time in seconds or as a '[hh:[mm:]]ss[.xxx]' string
 * @return FfmpegCommand
 */
export const seekInput = (self: FfmpegCommand) => (seek: any) => {
  if (!self._currentInput) {
    throw new Error("No input specified");
  }

  self._currentInput.options("-ss", seek);

  return self;
};

/**
 * Loop over the last specified input
 *
 * @method FfmpegCommand#loop
 * @category Input
 *
 * @param {String|Number} [duration] loop duration in seconds or as a '[[hh:]mm:]ss[.xxx]' string
 * @return FfmpegCommand
 */
export const loop = (self: FfmpegCommand) => (duration: any) => {
  if (!self._currentInput) {
    throw new Error("No input specified");
  }

  self._currentInput.options("-loop", "1");

  if (typeof duration !== "undefined") {
    self.duration(duration);
  }

  return self;
};
