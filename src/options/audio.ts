/*jshint node:true*/
"use strict";

import { FfmpegCommand } from "../fluent-ffmpeg";
import utils from "../utils";

/**
 * Disable audio in the output
 *
 * @method FfmpegCommand#noAudio
 * @category Audio
 * @aliases withNoAudio
 * @return FfmpegCommand
 */
export const noAudio = (self: FfmpegCommand) => () => {
  self._currentOutput.audio.clear();
  self._currentOutput.audioFilters.clear();
  self._currentOutput.audio("-an");

  return self;
};

/**
 * Specify audio codec
 *
 * @method FfmpegCommand#audioCodec
 * @category Audio
 * @aliases withAudioCodec
 *
 * @param {String} codec audio codec name
 * @return FfmpegCommand
 */
export const audioCodec = (self: FfmpegCommand) => (codec: any) => {
  self._currentOutput.audio("-acodec", codec);

  return self;
};

/**
 * Specify audio bitrate
 *
 * @method FfmpegCommand#audioBitrate
 * @category Audio
 * @aliases withAudioBitrate
 *
 * @param {String|Number} bitrate audio bitrate in kbps (with an optional 'k' suffix)
 * @return FfmpegCommand
 */
export const audioBitrate = (self: FfmpegCommand) => (bitrate: any) => {
  self._currentOutput.audio("-b:a", ("" + bitrate).replace(/k?$/, "k"));
  return self;
};

/**
 * Specify audio channel count
 *
 * @method FfmpegCommand#audioChannels
 * @category Audio
 * @aliases withAudioChannels
 *
 * @param {Number} channels channel count
 * @return FfmpegCommand
 */
export const audioChannels = (self: FfmpegCommand) => (channels: any) => {
  self._currentOutput.audio("-ac", channels);
  return self;
};

/**
 * Specify audio frequency
 *
 * @method FfmpegCommand#audioFrequency
 * @category Audio
 * @aliases withAudioFrequency
 *
 * @param {Number} freq audio frequency in Hz
 * @return FfmpegCommand
 */
export const audioFrequency = (self: FfmpegCommand) => (freq: any) => {
  self._currentOutput.audio("-ar", freq);
  return self;
};

/**
 * Specify audio quality
 *
 * @method FfmpegCommand#audioQuality
 * @category Audio
 * @aliases withAudioQuality
 *
 * @param {Number} quality audio quality factor
 * @return FfmpegCommand
 */
export const audioQuality = (self: FfmpegCommand) => (quality: any) => {
  self._currentOutput.audio("-aq", quality);
  return self;
};

/**
 * Specify custom audio filter(s)
 *
 * Can be called both with one or many filters, or a filter array.
 *
 * @example
 * command.audioFilters('filter1');
 *
 * @example
 * command.audioFilters('filter1', 'filter2=param1=value1:param2=value2');
 *
 * @example
 * command.audioFilters(['filter1', 'filter2']);
 *
 * @example
 * command.audioFilters([
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
 * command.audioFilters(
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
 * @method FfmpegCommand#audioFilters
 * @aliases withAudioFilter,withAudioFilters,audioFilter
 * @category Audio
 *
 * @param {...String|String[]|Object[]} filters audio filter strings, string array or
 *   filter specification array, each with the following properties:
 * @param {String} filters.filter filter name
 * @param {String|String[]|Object} [filters.options] filter option string, array, or object
 * @return FfmpegCommand
 */
export const audioFilters = (self: FfmpegCommand) => (filters: any) => {
  //@ts-ignore
  if (arguments.length > 1) {
    //@ts-ignore
    filters = [].slice.call(arguments);
  }

  if (!Array.isArray(filters)) {
    filters = [filters];
  }

  self._currentOutput.audioFilters(utils.makeFilterStrings(filters));
  return self;
};
