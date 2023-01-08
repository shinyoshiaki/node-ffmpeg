/*jshint node:true*/
"use strict";

import path from "path";

import { FfmpegCommand } from "../fluent-ffmpeg";

/*
 *! Miscellaneous methods
 */

/**
 * Use preset
 *
 * @method FfmpegCommand#preset
 * @category Miscellaneous
 * @aliases usingPreset
 *
 * @param {String|Function} preset preset name or preset function
 */
export const preset = (self: FfmpegCommand) => (preset: any) => {
  if (typeof preset === "function") {
    preset(self);
  } else {
    const modulePath = path.join(self.options.presets, preset);
    try {
      const module = require(modulePath);

      if (typeof module.load === "function") {
        module.load(self);
      } else {
        throw new Error("preset " + modulePath + " has no load() function");
      }
    } catch (err: any) {
      throw new Error(
        "preset " + modulePath + " could not be loaded: " + err.message
      );
    }
  }

  return self;
};
