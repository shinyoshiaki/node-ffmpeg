/*jshint node:true*/
"use strict";

import { FfmpegCommand } from "../fluent-ffmpeg";
import utils from "../utils";

/*
 *! Custom options methods
 */

/**
 * Add custom input option(s)
 *
 * When passing a single string or an array, each string containing two
 * words is split (eg. inputOptions('-option value') is supported) for
 * compatibility reasons.  This is not the case when passing more than
 * one argument.
 *
 * @example
 * command.inputOptions('option1');
 *
 * @example
 * command.inputOptions('option1', 'option2');
 *
 * @example
 * command.inputOptions(['option1', 'option2']);
 *
 * @method FfmpegCommand#inputOptions
 * @category Custom options
 * @aliases addInputOption,addInputOptions,withInputOption,withInputOptions,inputOption
 *
 * @param {...String} options option string(s) or string array
 * @return FfmpegCommand
 */
export const inputOptions =
  (self: FfmpegCommand) =>
  (...argument: any[]) => {
    let [options] = argument;

    if (!self._currentInput) {
      throw new Error("No input specified");
    }

    let doSplit = true;

    if (argument.length > 1) {
      options = [].slice.call(argument);
      doSplit = false;
    }

    if (!Array.isArray(options)) {
      options = [options];
    }

    const formattedOption = options.reduce((options: any, option: any) => {
      const split = String(option).split(" ");

      if (doSplit && split.length === 2) {
        options.push(split[0], split[1]);
      } else {
        options.push(option);
      }

      return options;
    }, []);

    self._currentInput.options(formattedOption);
    return self;
  };

/**
 * Add custom output option(s)
 *
 * @example
 * command.outputOptions('option1');
 *
 * @example
 * command.outputOptions('option1', 'option2');
 *
 * @example
 * command.outputOptions(['option1', 'option2']);
 *
 * @method FfmpegCommand#outputOptions
 * @category Custom options
 * @aliases addOutputOption,addOutputOptions,addOption,addOptions,withOutputOption,withOutputOptions,withOption,withOptions,outputOption
 *
 * @param {...String} options option string(s) or string array
 * @return FfmpegCommand
 */
export const outputOptions =
  (self: FfmpegCommand) =>
  (...argument: any[]) => {
    let [options] = argument;
    let doSplit = true;

    //@ts-ignore
    if (argument.length > 1) {
      //@ts-ignore
      options = [].slice.call(argument);
      doSplit = false;
    }

    if (!Array.isArray(options)) {
      options = [options];
    }

    const formattedOption = options.reduce((options: any, option: any) => {
      const split = String(option).split(" ");

      if (doSplit && split.length === 2) {
        options.push(split[0], split[1]);
      } else {
        options.push(option);
      }

      return options;
    }, []);

    self._currentOutput.options(formattedOption);
    return self;
  };

export const complexFilter =
  (self: FfmpegCommand) =>
  /**
   * Specify a complex filtergraph
   *
   * Calling this method will override any previously set filtergraph, but you can set
   * as many filters as needed in one call.
   *
   * @example <caption>Overlay an image over a video (using a filtergraph string)</caption>
   *   ffmpeg()
   *     .input('video.avi')
   *     .input('image.png')
   *     .complexFilter('[0:v][1:v]overlay[out]', ['out']);
   *
   * @example <caption>Overlay an image over a video (using a filter array)</caption>
   *   ffmpeg()
   *     .input('video.avi')
   *     .input('image.png')
   *     .complexFilter([{
   *       filter: 'overlay',
   *       inputs: ['0:v', '1:v'],
   *       outputs: ['out']
   *     }], ['out']);
   *
   * @example <caption>Split video into RGB channels and output a 3x1 video with channels side to side</caption>
   *  ffmpeg()
   *    .input('video.avi')
   *    .complexFilter([
   *      // Duplicate video stream 3 times into streams a, b, and c
   *      { filter: 'split', options: '3', outputs: ['a', 'b', 'c'] },
   *
   *      // Create stream 'red' by cancelling green and blue channels from stream 'a'
   *      { filter: 'lutrgb', options: { g: 0, b: 0 }, inputs: 'a', outputs: 'red' },
   *
   *      // Create stream 'green' by cancelling red and blue channels from stream 'b'
   *      { filter: 'lutrgb', options: { r: 0, b: 0 }, inputs: 'b', outputs: 'green' },
   *
   *      // Create stream 'blue' by cancelling red and green channels from stream 'c'
   *      { filter: 'lutrgb', options: { r: 0, g: 0 }, inputs: 'c', outputs: 'blue' },
   *
   *      // Pad stream 'red' to 3x width, keeping the video on the left, and name output 'padded'
   *      { filter: 'pad', options: { w: 'iw*3', h: 'ih' }, inputs: 'red', outputs: 'padded' },
   *
   *      // Overlay 'green' onto 'padded', moving it to the center, and name output 'redgreen'
   *      { filter: 'overlay', options: { x: 'w', y: 0 }, inputs: ['padded', 'green'], outputs: 'redgreen'},
   *
   *      // Overlay 'blue' onto 'redgreen', moving it to the right
   *      { filter: 'overlay', options: { x: '2*w', y: 0 }, inputs: ['redgreen', 'blue']},
   *    ]);
   *
   * @method FfmpegCommand#complexFilter
   * @category Custom options
   * @aliases filterGraph
   *
   * @param {String|Array} spec filtergraph string or array of filter specification
   *   objects, each having the following properties:
   * @param {String} spec.filter filter name
   * @param {String|Array} [spec.inputs] (array of) input stream specifier(s) for the filter,
   *   defaults to ffmpeg automatically choosing the first unused matching streams
   * @param {String|Array} [spec.outputs] (array of) output stream specifier(s) for the filter,
   *   defaults to ffmpeg automatically assigning the output to the output file
   * @param {Object|String|Array} [spec.options] filter options, can be omitted to not set any options
   * @param {Array} [map] (array of) stream specifier(s) from the graph to include in
   *   ffmpeg output, defaults to ffmpeg automatically choosing the first matching streams.
   * @return FfmpegCommand
   */
  (spec: any, map?: any) => {
    self._complexFilters.clear();

    if (!Array.isArray(spec)) {
      spec = [spec];
    }

    self._complexFilters(
      //@ts-ignore
      "-filter_complex",
      //@ts-ignore
      utils.makeFilterStrings(spec).join(";")
    );

    if (Array.isArray(map)) {
      map.forEach((streamSpec) => {
        self._complexFilters(
          //@ts-ignore
          "-map",
          //@ts-ignore
          streamSpec.replace(utils.streamRegexp, "[$1]")
        );
      });
    } else if (typeof map === "string") {
      //@ts-ignore
      self._complexFilters("-map", map.replace(utils.streamRegexp, "[$1]"));
    }

    return self;
  };
