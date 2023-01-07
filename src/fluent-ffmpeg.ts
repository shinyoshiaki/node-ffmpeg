/*jshint node:true*/
'use strict';

// @ts-expect-error TS(2580): Cannot find name 'require'. Do you need to install... Remove this comment to see the full error message
var path = require('path');
// @ts-expect-error TS(2580): Cannot find name 'require'. Do you need to install... Remove this comment to see the full error message
var util = require('util');
// @ts-expect-error TS(2580): Cannot find name 'require'. Do you need to install... Remove this comment to see the full error message
var EventEmitter = require('events').EventEmitter;

// @ts-expect-error TS(2580): Cannot find name 'require'. Do you need to install... Remove this comment to see the full error message
var utils = require('./utils');
var ARGLISTS = ['_global', '_audio', '_audioFilters', '_video', '_videoFilters', '_sizeFilters', '_complexFilters'];


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
function FfmpegCommand(this: any, input: any, options: any) {
  // Make 'new' optional
  if (!(this instanceof FfmpegCommand)) {
    // @ts-expect-error TS(7009): 'new' expression, whose target lacks a construct s... Remove this comment to see the full error message
    return new FfmpegCommand(input, options);
  }

  EventEmitter.call(this);

  if (typeof input === 'object' && !('readable' in input)) {
    // Options object passed directly
    options = input;
  } else {
    // Input passed first
    options = options || {};
    options.source = input;
  }

  // Add input if present
  // @ts-expect-error TS(2339): Property '_inputs' does not exist on type '{}'.
  this._inputs = [];
  if (options.source) {
    // @ts-expect-error TS(2339): Property 'input' does not exist on type '{}'.
    this.input(options.source);
  }

  // Add target-less output for backwards compatibility
  // @ts-expect-error TS(2339): Property '_outputs' does not exist on type '{}'.
  this._outputs = [];
  // @ts-expect-error TS(2339): Property 'output' does not exist on type '{}'.
  this.output();

  // Create argument lists
  var self = this;
  ['_global', '_complexFilters'].forEach(function(prop) {
    // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
    self[prop] = utils.args();
  });

  // Set default option values
  options.stdoutLines = 'stdoutLines' in options ? options.stdoutLines : 100;
  // @ts-expect-error TS(2304): Cannot find name '__dirname'.
  options.presets = options.presets || options.preset || path.join(__dirname, 'presets');
  options.niceness = options.niceness || options.priority || 0;

  // Save options
  // @ts-expect-error TS(2339): Property 'options' does not exist on type '{}'.
  this.options = options;

  // Setup logger
  // @ts-expect-error TS(2339): Property 'logger' does not exist on type '{}'.
  this.logger = options.logger || {
    debug: function() {},
    info: function() {},
    warn: function() {},
    error: function() {}
  };
}
util.inherits(FfmpegCommand, EventEmitter);
// @ts-expect-error TS(2580): Cannot find name 'module'. Do you need to install ... Remove this comment to see the full error message
module.exports = FfmpegCommand;


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
FfmpegCommand.prototype.clone = function() {
  // @ts-expect-error TS(2554): Expected 2 arguments, but got 0.
  var clone = new FfmpegCommand();
  var self = this;

  // Clone options and logger
  clone.options = this.options;
  clone.logger = this.logger;

  // Clone inputs
  clone._inputs = this._inputs.map(function(input: any) {
    return {
      source: input.source,
      options: input.options.clone()
    };
  });

  // Create first output
  if ('target' in this._outputs[0]) {
    // We have outputs set, don't clone them and create first output
    clone._outputs = [];
    clone.output();
  } else {
    // No outputs set, clone first output options
    clone._outputs = [
      clone._currentOutput = {
        flags: {}
      }
    ];

    ['audio', 'audioFilters', 'video', 'videoFilters', 'sizeFilters', 'options'].forEach(function(key) {
      clone._currentOutput[key] = self._currentOutput[key].clone();
    });

    if (this._currentOutput.sizeData) {
      clone._currentOutput.sizeData = {};
      utils.copy(this._currentOutput.sizeData, clone._currentOutput.sizeData);
    }

    utils.copy(this._currentOutput.flags, clone._currentOutput.flags);
  }

  // Clone argument lists
  ['_global', '_complexFilters'].forEach(function(prop) {
    clone[prop] = self[prop].clone();
  });

  return clone;
};


/* Add methods from options submodules */

// @ts-expect-error TS(2580): Cannot find name 'require'. Do you need to install... Remove this comment to see the full error message
require('./options/inputs')(FfmpegCommand.prototype);
// @ts-expect-error TS(2580): Cannot find name 'require'. Do you need to install... Remove this comment to see the full error message
require('./options/audio')(FfmpegCommand.prototype);
// @ts-expect-error TS(2580): Cannot find name 'require'. Do you need to install... Remove this comment to see the full error message
require('./options/video')(FfmpegCommand.prototype);
// @ts-expect-error TS(2580): Cannot find name 'require'. Do you need to install... Remove this comment to see the full error message
require('./options/videosize')(FfmpegCommand.prototype);
// @ts-expect-error TS(2580): Cannot find name 'require'. Do you need to install... Remove this comment to see the full error message
require('./options/output')(FfmpegCommand.prototype);
// @ts-expect-error TS(2580): Cannot find name 'require'. Do you need to install... Remove this comment to see the full error message
require('./options/custom')(FfmpegCommand.prototype);
// @ts-expect-error TS(2580): Cannot find name 'require'. Do you need to install... Remove this comment to see the full error message
require('./options/misc')(FfmpegCommand.prototype);


/* Add processor methods */

// @ts-expect-error TS(2580): Cannot find name 'require'. Do you need to install... Remove this comment to see the full error message
require('./processor')(FfmpegCommand.prototype);


/* Add capabilities methods */

// @ts-expect-error TS(2580): Cannot find name 'require'. Do you need to install... Remove this comment to see the full error message
require('./capabilities')(FfmpegCommand.prototype);

FfmpegCommand.setFfmpegPath = function(path: any) {
  // @ts-expect-error TS(2554): Expected 2 arguments, but got 0.
  (new FfmpegCommand()).setFfmpegPath(path);
};

FfmpegCommand.setFfprobePath = function(path: any) {
  // @ts-expect-error TS(2554): Expected 2 arguments, but got 0.
  (new FfmpegCommand()).setFfprobePath(path);
};

FfmpegCommand.setFlvtoolPath = function(path: any) {
  // @ts-expect-error TS(2554): Expected 2 arguments, but got 0.
  (new FfmpegCommand()).setFlvtoolPath(path);
};

FfmpegCommand.availableFilters =
FfmpegCommand.getAvailableFilters = function(callback: any) {
  // @ts-expect-error TS(2554): Expected 2 arguments, but got 0.
  (new FfmpegCommand()).availableFilters(callback);
};

FfmpegCommand.availableCodecs =
FfmpegCommand.getAvailableCodecs = function(callback: any) {
  // @ts-expect-error TS(2554): Expected 2 arguments, but got 0.
  (new FfmpegCommand()).availableCodecs(callback);
};

FfmpegCommand.availableFormats =
FfmpegCommand.getAvailableFormats = function(callback: any) {
  // @ts-expect-error TS(2554): Expected 2 arguments, but got 0.
  (new FfmpegCommand()).availableFormats(callback);
};

FfmpegCommand.availableEncoders =
FfmpegCommand.getAvailableEncoders = function(callback: any) {
  // @ts-expect-error TS(2554): Expected 2 arguments, but got 0.
  (new FfmpegCommand()).availableEncoders(callback);
};


/* Add ffprobe methods */

// @ts-expect-error TS(2580): Cannot find name 'require'. Do you need to install... Remove this comment to see the full error message
require('./ffprobe')(FfmpegCommand.prototype);

FfmpegCommand.ffprobe = function(file: any) {
  // @ts-expect-error TS(2554): Expected 2 arguments, but got 1.
  var instance = new FfmpegCommand(file);
  instance.ffprobe.apply(instance, Array.prototype.slice.call(arguments, 1));
};

/* Add processing recipes */

// @ts-expect-error TS(2580): Cannot find name 'require'. Do you need to install... Remove this comment to see the full error message
require('./recipes')(FfmpegCommand.prototype);
