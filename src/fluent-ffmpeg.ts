/*jshint node:true*/
"use strict";

import { ChildProcessWithoutNullStreams } from "child_process";
import { EventEmitter } from "events";
import path from "path";

import {
  _checkCapabilities,
  _forgetPaths,
  _getFfmpegPath,
  _getFfprobePath,
  _getFlvtoolPath,
  getAvailableCodecs,
  getAvailableEncoders,
  getAvailableFilters,
  getAvailableFormats,
  setFfmpegPath,
  setFfprobePath,
  setFlvtoolPath,
} from "./capabilities";
import { ffprobe } from "./ffprobe";
import {
  audioBitrate,
  audioChannels,
  audioCodec,
  audioFilters,
  audioFrequency,
  audioQuality,
  noAudio,
} from "./options/audio";
import { complexFilter, inputOptions, outputOptions } from "./options/custom";
import {
  loop,
  mergeAdd,
  nativeFramerate,
  seekInput,
  withInputFormat,
  withInputFps,
} from "./options/inputs";
import { preset } from "./options/misc";
import { duration, flvmeta, format, map, output, seek } from "./options/output";
import {
  FPS,
  frames,
  noVideo,
  videoBitrate,
  videoFilters,
} from "./options/video";
import { aspectRatio, autopad, keepDAR, size } from "./options/videosize";
import {
  _getArguments,
  _prepare,
  _spawnFfmpeg,
  kill,
  renice,
  run,
} from "./processor";
import { concat, save, screenshots, stream } from "./recipes";
import utils from "./utils";

export const ARGLISTS = [
  "_global",
  "_audio",
  "_audioFilters",
  "_video",
  "_videoFilters",
  "_sizeFilters",
  "_complexFilters",
];

export class FfmpegCommand extends EventEmitter {
  _inputs: any[];
  _currentInput: any;
  _outputs: any[];
  _currentOutput: any;
  options: any;
  logger: any;
  // Create argument lists
  _global = utils.args();
  // Create argument lists
  _complexFilters = utils.args();
  ffmpegProc?: ChildProcessWithoutNullStreams;
  processTimer: any;
  _ffprobeData: any;

  /* Add methods from options submodules */

  mergeAdd = mergeAdd(this);
  addInput = this.mergeAdd;
  input = this.mergeAdd;

  withInputFormat = withInputFormat(this);
  inputFormat = this.withInputFormat;
  fromFormat = this.withInputFormat;

  withInputFps = withInputFps(this);
  withInputFPS = this.withInputFps;
  withFpsInput = this.withInputFps;
  inputFPS = this.withInputFps;
  inputFps = this.withInputFps;
  fpsInput = this.withInputFps;
  FPSInput = this.withInputFps;

  nativeFramerate = nativeFramerate(this);
  withNativeFramerate = this.nativeFramerate;
  native = this.nativeFramerate;

  seekInput = seekInput(this);

  loop = loop(this);

  withNoAudio = noAudio(this);
  noAudio = this.withNoAudio;

  withAudioCodec = audioCodec(this);
  audioCodec = this.withAudioCodec;

  withAudioBitrate = audioBitrate(this);
  audioBitrate = this.withAudioBitrate;

  withAudioChannels = audioChannels(this);
  audioChannels = this.withAudioChannels;

  withAudioFrequency = audioFrequency(this);
  audioFrequency = this.withAudioFrequency;

  withAudioQuality = audioQuality(this);
  audioQuality = this.withAudioQuality;

  withAudioFilter = audioFilters(this);
  withAudioFilters = this.withAudioFilter;
  audioFilter = this.withAudioFilter;
  audioFilters = this.withAudioFilter;

  withNoVideo = noVideo(this);
  noVideo = this.withNoVideo;

  withVideoBitrate = videoBitrate(this);
  videoBitrate = this.withVideoBitrate;

  withVideoFilter = videoFilters(this);
  withVideoFilters = this.withAudioFilter;
  videoFilter = this.withAudioFilter;
  videoFilters = this.withAudioFilter;

  withOutputFps = FPS(this);
  withOutputFPS = this.withInputFps;
  withFpsOutput = this.withInputFps;
  withFPSOutput = this.withInputFps;
  withFps = this.withInputFps;
  withFPS = this.withInputFps;
  outputFPS = this.withInputFps;
  outputFps = this.withInputFps;
  fpsOutput = this.withInputFps;
  FPSOutput = this.withInputFps;
  fps = this.withInputFps;
  FPS = this.withInputFps;

  takeFrames = frames(this);
  withFrames = this.takeFrames;
  frames = this.takeFrames;

  keepPixelAspect = keepDAR(this);
  keepDisplayAspect = this.keepPixelAspect;
  keepDisplayAspectRatio = this.keepPixelAspect;
  keepDAR = this.keepPixelAspect;

  withSize = size(this);
  setSize = this.withSize;
  size = this.withSize;

  withAspect = aspectRatio(this);
  withAspectRatio = this.withAspect;
  setAspect = this.withAspect;
  setAspectRatio = this.withAspect;
  aspect = this.withAspect;
  aspectRatio = this.withAspect;

  applyAutopadding = autopad(this);
  applyAutoPadding = this.applyAutopadding;
  applyAutopad = this.applyAutopadding;
  applyAutoPad = this.applyAutopadding;
  withAutopadding = this.applyAutopadding;
  withAutoPadding = this.applyAutopadding;
  withAutopad = this.applyAutopadding;
  autoPad = this.applyAutopadding;
  autopad = this.applyAutopadding;

  addOutput = output(this);
  output = this.addOutput;

  seekOutput = seek(this);
  seek = this.seekOutput;

  withDuration = duration(this);
  setDuration = this.withDuration;
  duration = this.withDuration;

  toFormat = format(this);
  withOutputFormat = this.toFormat;
  outputFormat = this.toFormat;
  format = this.toFormat;

  map = map(this);

  updateFlvMetadata = flvmeta(this);
  flvmeta = this.updateFlvMetadata;

  addInputOption = inputOptions(this);
  addInputOptions = this.addInputOption;
  withInputOption = this.addInputOption;
  withInputOptions = this.addInputOption;
  inputOption = this.addInputOption;
  inputOptions = this.addInputOption;

  addOutputOption = outputOptions(this);
  addOutputOptions = this.addInputOption;
  addOption = this.addInputOption;
  addOptions = this.addInputOption;
  withOutputOption = this.addInputOption;
  withOutputOptions = this.addInputOption;
  withOption = this.addInputOption;
  withOptions = this.addInputOption;
  outputOption = this.addInputOption;
  outputOptions = this.addInputOption;

  filterGraph = complexFilter(this);
  complexFilter = this.filterGraph;

  usingPreset = preset(this);
  preset = this.usingPreset;

  /* Add processor methods */

  _spawnFfmpeg = _spawnFfmpeg(this);
  _getArguments = _getArguments(this);
  _prepare = _prepare(this);

  exec = run(this);
  execute = this.exec;
  run = this.exec;

  renice = renice(this);

  kill = kill(this);

  /* Add capabilities methods */

  setFfmpegPath = setFfmpegPath(this);
  setFfprobePath = setFfprobePath(this);
  setFlvtoolPath = setFlvtoolPath(this);
  _forgetPaths = _forgetPaths(this);
  _getFfmpegPath = _getFfmpegPath(this);
  _getFfprobePath = _getFfprobePath(this);
  _getFlvtoolPath = _getFlvtoolPath(this);

  availableFilters = getAvailableFilters(this);
  getAvailableFilters = this.availableFilters;

  availableCodecs = getAvailableCodecs(this);
  getAvailableCodecs = this.availableCodecs;

  availableEncoders = getAvailableEncoders(this);
  getAvailableEncoders = this.availableEncoders;

  availableFormats = getAvailableFormats(this);
  getAvailableFormats = this.availableFormats;

  _checkCapabilities = _checkCapabilities(this);

  /* Add ffprobe methods */
  ffprobe = ffprobe(this);

  /* Add processing recipes */
  saveToFile = save(this);
  save = this.saveToFile;

  writeToStream = stream(this);
  pipe = this.writeToStream;
  stream = this.writeToStream;

  takeScreenshots = screenshots(this);
  thumbnail = this.takeScreenshots;
  thumbnails = this.takeScreenshots;
  screenshot = this.takeScreenshots;
  screenshots = this.takeScreenshots;

  mergeToFile = concat(this);
  concatenate = this.mergeToFile;
  concat = this.mergeToFile;

  /**
   * Create an ffmpeg command
   *
   * Can be called with or without the 'new' operator, and the 'input' parameter
   * may be specified as 'options.source' instead (or passed later with the
   * addInput method).
   *
   * @constructor
   * @param {String|ReadableStream} [input] input file path or readable stream
   * @param {Object} [options] command options
   * @param {Object} [options.logger=<no logging>] logger object with 'error', 'warning', 'info' and 'debug' methods
   * @param {Number} [options.niceness=0] ffmpeg process niceness, ignored on Windows
   * @param {Number} [options.priority=0] alias for `niceness`
   * @param {String} [options.presets="fluent-ffmpeg/lib/presets"] directory to load presets from
   * @param {String} [options.preset="fluent-ffmpeg/lib/presets"] alias for `presets`
   * @param {String} [options.stdoutLines=100] maximum lines of ffmpeg output to keep in memory, use 0 for unlimited
   * @param {Number} [options.timeout=<no timeout>] ffmpeg processing timeout in seconds
   * @param {String|ReadableStream} [options.source=<no input>] alias for the `input` parameter
   */
  constructor(input?: any, options?: any) {
    super();

    EventEmitter.call(this);

    if (typeof input === "object" && !("readable" in input)) {
      // Options object passed directly
      options = input;
    } else {
      // Input passed first
      options = options || {};
      options.source = input;
    }

    // Add input if present
    this._inputs = [];
    if (options.source) {
      this.input(options.source);
    }

    // Add target-less output for backwards compatibility
    this._outputs = [];
    this.output();

    // // Create argument lists
    // ["_global", "_complexFilters"].forEach((prop) => {
    //   this[prop] = utils.args();
    // });

    // Set default option values
    options.stdoutLines = "stdoutLines" in options ? options.stdoutLines : 100;

    options.presets =
      options.presets || options.preset || path.join(__dirname, "presets");
    options.niceness = options.niceness || options.priority || 0;

    // Save options
    this.options = options;

    // Setup logger
    this.logger = options.logger || {
      debug: function () {},
      info: function () {},
      warn: function () {},
      error: function () {},
    };
  }

  /**
   * Clone an ffmpeg command
   *
   * This method is useful when you want to process the same input multiple times.
   * It returns a new FfmpegCommand instance with the exact same options.
   *
   * All options set _after_ the clone() call will only be applied to the instance
   * it has been called on.
   *
   * @example
   *   var command = ffmpeg('/path/to/source.avi')
   *     .audioCodec('libfaac')
   *     .videoCodec('libx264')
   *     .format('mp4');
   *
   *   command.clone()
   *     .size('320x200')
   *     .save('/path/to/output-small.mp4');
   *
   *   command.clone()
   *     .size('640x400')
   *     .save('/path/to/output-medium.mp4');
   *
   *   command.save('/path/to/output-original-size.mp4');
   *
   * @method FfmpegCommand#clone
   * @return FfmpegCommand
   */

  clone() {
    const clone = new FfmpegCommand();

    // Clone options and logger
    clone.options = this.options;
    clone.logger = this.logger;

    // Clone inputs
    clone._inputs = this._inputs.map(function (input: any) {
      return {
        source: input.source,
        options: input.options.clone(),
      };
    });

    // Create first output
    if ("target" in this._outputs[0]) {
      // We have outputs set, don't clone them and create first output
      clone._outputs = [];
      clone.output();
    } else {
      // No outputs set, clone first output options
      clone._outputs = [
        (clone._currentOutput = {
          flags: {},
        }),
      ];

      [
        "audio",
        "audioFilters",
        "video",
        "videoFilters",
        "sizeFilters",
        "options",
      ].forEach((key) => {
        clone._currentOutput[key] = this._currentOutput[key].clone();
      });

      if (this._currentOutput.sizeData) {
        clone._currentOutput.sizeData = {};
        utils.copy(this._currentOutput.sizeData, clone._currentOutput.sizeData);
      }

      utils.copy(this._currentOutput.flags, clone._currentOutput.flags);
    }

    // Clone argument lists
    ["_global", "_complexFilters"].forEach((prop) => {
      clone[prop] = this[prop].clone();
    });

    return clone;
  }

  static setFfmpegPath = (path: any) => {
    new FfmpegCommand().setFfmpegPath(path);
  };

  static setFfprobePath = function (path: any) {
    new FfmpegCommand().setFfprobePath(path);
  };

  static setFlvtoolPath = function (path: any) {
    new FfmpegCommand().setFlvtoolPath(path);
  };

  static getAvailableFilters = function (callback: any) {
    new FfmpegCommand().availableFilters(callback);
  };

  static getAvailableCodecs = function (callback: any) {
    new FfmpegCommand().availableCodecs(callback);
  };

  static availableCodecs = this.getAvailableCodecs;

  static getAvailableFormats = function (callback: any) {
    new FfmpegCommand().availableFormats(callback);
  };

  static availableFormats = this.getAvailableFormats;

  static getAvailableEncoders = function (callback: any) {
    new FfmpegCommand().availableEncoders(callback);
  };

  static availableEncoders = this.getAvailableEncoders;

  static ffprobe = function (file: any) {
    const instance = new FfmpegCommand(file);
    instance.ffprobe.apply(instance, Array.prototype.slice.call(arguments, 1));
  };
}

export default { FfmpegCommand };
