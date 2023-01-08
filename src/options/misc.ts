/*jshint node:true*/
"use strict";

import path from "path";

/*
 *! Miscellaneous methods
 */

module.exports = function (proto: any) {
  /**
   * Use preset
   *
   * @method FfmpegCommand#preset
   * @category Miscellaneous
   * @aliases usingPreset
   *
   * @param {String|Function} preset preset name or preset function
   */
  proto.usingPreset = proto.preset = function (preset: any) {
    if (typeof preset === "function") {
      preset(this);
    } else {
      const modulePath = path.join(this.options.presets, preset);
      try {
        const module = require(modulePath);

        if (typeof module.load === "function") {
          module.load(this);
        } else {
          throw new Error("preset " + modulePath + " has no load() function");
        }
      } catch (err: any) {
        throw new Error(
          "preset " + modulePath + " could not be loaded: " + err.message
        );
      }
    }

    return this;
  };
};
