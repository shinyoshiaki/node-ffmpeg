/*jshint node:true*/
"use strict";

import { FfmpegCommand } from "../fluent-ffmpeg";
import utils from "../utils";

/*
 *! Video-related methods
 */

/**
 * Disable video in the output
 *
 * @method FfmpegCommand#noVideo
 * @category Video
 * @aliases withNoVideo
 *
 * @return FfmpegCommand
 */
export const noVideo = (self: FfmpegCommand) => () => {
  self._currentOutput.video.clear();
  self._currentOutput.videoFilters.clear();
  self._currentOutput.video("-vn");

  return self;
};

/**
 * Specify video codec
 *
 * @method FfmpegCommand#videoCodec
 * @category Video
 * @aliases withVideoCodec
 *
 * @param {String} codec video codec name
 * @return FfmpegCommand
 */
export const videoCodec = (self: FfmpegCommand) => (codec: any) => {
  self._currentOutput.video("-vcodec", codec);
  return self;
};

/**
 * Specify video bitrate
 *
 * @method FfmpegCommand#videoBitrate
 * @category Video
 * @aliases withVideoBitrate
 *
 * @param {String|Number} bitrate video bitrate in kbps (with an optional 'k' suffix)
 * @param {Boolean} [constant=false] enforce constant bitrate
 * @return FfmpegCommand
 */
export const videoBitrate =
  (self: FfmpegCommand) => (bitrate: any, constant: any) => {
    bitrate = ("" + bitrate).replace(/k?$/, "k");

    self._currentOutput.video("-b:v", bitrate);
    if (constant) {
      self._currentOutput.video(
        "-maxrate",
        bitrate,
        "-minrate",
        bitrate,
        "-bufsize",
        "3M"
      );
    }

    return self;
  };

/**
 * Specify custom video filter(s)
 *
 * Can be called both with one or many filters, or a filter array.
 *
 * @example
 * command.videoFilters('filter1');
 *
 * @example
 * command.videoFilters('filter1', 'filter2=param1=value1:param2=value2');
 *
 * @example
 * command.videoFilters(['filter1', 'filter2']);
 *
 * @example
 * command.videoFilters([
 *   {
 *     filter: 'filter1'
 *   },
 *   {
 *     filter: 'filter2',
 *     options: 'param=value:param=value'
 *   }
 * ]);
 *
 * @example
 * command.videoFilters(
 *   {
 *     filter: 'filter1',
 *     options: ['value1', 'value2']
 *   },
 *   {
 *     filter: 'filter2',
 *     options: { param1: 'value1', param2: 'value2' }
 *   }
 * );
 *
 * @method FfmpegCommand#videoFilters
 * @category Video
 * @aliases withVideoFilter,withVideoFilters,videoFilter
 *
 * @param {...String|String[]|Object[]} filters video filter strings, string array or
 *   filter specification array, each with the following properties:
 * @param {String} filters.filter filter name
 * @param {String|String[]|Object} [filters.options] filter option string, array, or object
 * @return FfmpegCommand
 */
export const videoFilters =
  (self: FfmpegCommand) =>
  (...argument: any[]) => {
    let [filters] = argument;

    if (argument.length > 1) {
      filters = [].slice.call(argument);
    }

    if (!Array.isArray(filters)) {
      filters = [filters];
    }

    self._currentOutput.videoFilters(utils.makeFilterStrings(filters));

    return self;
  };

/**
 * Specify output FPS
 *
 * @method FfmpegCommand#fps
 * @category Video
 * @aliases withOutputFps,withOutputFPS,withFpsOutput,withFPSOutput,withFps,withFPS,outputFPS,outputFps,fpsOutput,FPSOutput,FPS
 *
 * @param {Number} fps output FPS
 * @return FfmpegCommand
 */
export const FPS = (self: FfmpegCommand) => (fps: any) => {
  self._currentOutput.video("-r", fps);
  return self;
};

/**
 * Only transcode a certain number of frames
 *
 * @method FfmpegCommand#frames
 * @category Video
 * @aliases takeFrames,withFrames
 *
 * @param {Number} frames frame count
 * @return FfmpegCommand
 */
export const frames = (self: FfmpegCommand) => (frames: any) => {
  self._currentOutput.video("-vframes", frames);
  return self;
};
