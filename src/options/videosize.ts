/*jshint node:true*/
"use strict";

import { FfmpegCommand } from "../fluent-ffmpeg";

/*
 *! Size helpers
 */

/**
 * Return filters to pad video to width*height,
 *
 * @param {Number} width output width
 * @param {Number} height output height
 * @param {Number} aspect video aspect ratio (without padding)
 * @param {Number} color padding color
 * @return scale/pad filters
 * @private
 */
function getScalePadFilters(width: any, height: any, aspect: any, color: any) {
  /*
    let a be the input aspect ratio, A be the requested aspect ratio

    if a > A, padding is done on top and bottom
    if a < A, padding is done on left and right
   */

  return [
    /*
      In both cases, we first have to scale the input to match the requested size.
      When using computed width/height, we truncate them to multiples of 2
     */
    {
      filter: "scale",
      options: {
        w: "if(gt(a," + aspect + ")," + width + ",trunc(" + height + "*a/2)*2)",
        h: "if(lt(a," + aspect + ")," + height + ",trunc(" + width + "/a/2)*2)",
      },
    },

    /*
      Then we pad the scaled input to match the target size
      (here iw and ih refer to the padding input, i.e the scaled output)
     */

    {
      filter: "pad",
      options: {
        w: width,
        h: height,
        x: "if(gt(a," + aspect + "),0,(" + width + "-iw)/2)",
        y: "if(lt(a," + aspect + "),0,(" + height + "-ih)/2)",
        color: color,
      },
    },
  ];
}

/**
 * Recompute size filters
 *
 * @param {Object} output
 * @param {String} key newly-added parameter name ('size', 'aspect' or 'pad')
 * @param {String} value newly-added parameter value
 * @return filter string array
 * @private
 */
function createSizeFilters(output: any, key: any, value: any) {
  // Store parameters
  const data = (output.sizeData = output.sizeData || {});
  data[key] = value;

  if (!("size" in data)) {
    // No size requested, keep original size
    return [];
  }

  // Try to match the different size string formats
  const fixedSize = data.size.match(/([0-9]+)x([0-9]+)/);
  const fixedWidth = data.size.match(/([0-9]+)x\?/);
  const fixedHeight = data.size.match(/\?x([0-9]+)/);
  const percentRatio = data.size.match(/\b([0-9]{1,3})%/);
  let width, height, aspect;

  if (percentRatio) {
    const ratio = Number(percentRatio[1]) / 100;
    return [
      {
        filter: "scale",
        options: {
          w: "trunc(iw*" + ratio + "/2)*2",
          h: "trunc(ih*" + ratio + "/2)*2",
        },
      },
    ];
  } else if (fixedSize) {
    // Round target size to multiples of 2
    width = Math.round(Number(fixedSize[1]) / 2) * 2;
    height = Math.round(Number(fixedSize[2]) / 2) * 2;

    aspect = width / height;

    if (data.pad) {
      return getScalePadFilters(width, height, aspect, data.pad);
    } else {
      // No autopad requested, rescale to target size
      return [{ filter: "scale", options: { w: width, h: height } }];
    }
  } else if (fixedWidth || fixedHeight) {
    if ("aspect" in data) {
      // Specified aspect ratio
      width = fixedWidth
        ? fixedWidth[1]
        : Math.round(Number(fixedHeight[1]) * data.aspect);
      height = fixedHeight
        ? fixedHeight[1]
        : Math.round(Number(fixedWidth[1]) / data.aspect);

      // Round to multiples of 2
      width = Math.round(width / 2) * 2;
      height = Math.round(height / 2) * 2;

      if (data.pad) {
        return getScalePadFilters(width, height, data.aspect, data.pad);
      } else {
        // No autopad requested, rescale to target size
        return [{ filter: "scale", options: { w: width, h: height } }];
      }
    } else {
      // Keep input aspect ratio

      if (fixedWidth) {
        return [
          {
            filter: "scale",
            options: {
              w: Math.round(Number(fixedWidth[1]) / 2) * 2,
              h: "trunc(ow/a/2)*2",
            },
          },
        ];
      } else {
        return [
          {
            filter: "scale",
            options: {
              w: "trunc(oh*a/2)*2",
              h: Math.round(Number(fixedHeight[1]) / 2) * 2,
            },
          },
        ];
      }
    }
  } else {
    throw new Error("Invalid size specified: " + data.size);
  }
}

/*
 *! Video size-related methods
 */

/**
 * Keep display aspect ratio
 *
 * This method is useful when converting an input with non-square pixels to an output format
 * that does not support non-square pixels.  It rescales the input so that the display aspect
 * ratio is the same.
 *
 * @method FfmpegCommand#keepDAR
 * @category Video size
 * @aliases keepPixelAspect,keepDisplayAspect,keepDisplayAspectRatio
 *
 * @return FfmpegCommand
 */
export const keepDAR = (self: FfmpegCommand) => () => {
  return self.videoFilters([
    {
      filter: "scale",
      options: {
        w: "if(gt(sar,1),iw*sar,iw)",
        h: "if(lt(sar,1),ih/sar,ih)",
      },
    },
    {
      filter: "setsar",
      options: "1",
    },
  ]);
};

/**
 * Set output size
 *
 * The 'size' parameter can have one of 4 forms:
 * - 'X%': rescale to xx % of the original size
 * - 'WxH': specify width and height
 * - 'Wx?': specify width and compute height from input aspect ratio
 * - '?xH': specify height and compute width from input aspect ratio
 *
 * Note: both dimensions will be truncated to multiples of 2.
 *
 * @method FfmpegCommand#size
 * @category Video size
 * @aliases withSize,setSize
 *
 * @param {String} size size string, eg. '33%', '320x240', '320x?', '?x240'
 * @return FfmpegCommand
 */
export const size = (self: FfmpegCommand) => (size: any) => {
  const filters = createSizeFilters(self._currentOutput, "size", size);

  self._currentOutput.sizeFilters.clear();
  self._currentOutput.sizeFilters(filters);

  return self;
};

/**
 * Set output aspect ratio
 *
 * @method FfmpegCommand#aspect
 * @category Video size
 * @aliases withAspect,withAspectRatio,setAspect,setAspectRatio,aspectRatio
 *
 * @param {String|Number} aspect aspect ratio (number or 'X:Y' string)
 * @return FfmpegCommand
 */
export const aspectRatio = (self: FfmpegCommand) => (aspect: any) => {
  let a = Number(aspect);
  if (isNaN(a)) {
    const match = aspect.match(/^(\d+):(\d+)$/);
    if (match) {
      a = Number(match[1]) / Number(match[2]);
    } else {
      throw new Error("Invalid aspect ratio: " + aspect);
    }
  }

  const filters = createSizeFilters(self._currentOutput, "aspect", a);

  self._currentOutput.sizeFilters.clear();
  self._currentOutput.sizeFilters(filters);

  return self;
};

/**
 * Enable auto-padding the output
 *
 * @method FfmpegCommand#autopad
 * @category Video size
 * @aliases applyAutopadding,applyAutoPadding,applyAutopad,applyAutoPad,withAutopadding,withAutoPadding,withAutopad,withAutoPad,autoPad
 *
 * @param {Boolean} [pad=true] enable/disable auto-padding
 * @param {String} [color='black'] pad color
 */
export const autopad = (self: FfmpegCommand) => (pad: any, color: any) => {
  // Allow autopad(color)
  if (typeof pad === "string") {
    color = pad;
    pad = true;
  }

  // Allow autopad() and autopad(undefined, color)
  if (typeof pad === "undefined") {
    pad = true;
  }

  const filters = createSizeFilters(
    self._currentOutput,
    "pad",
    pad ? color || "black" : false
  );

  self._currentOutput.sizeFilters.clear();
  self._currentOutput.sizeFilters(filters);

  return self;
};
