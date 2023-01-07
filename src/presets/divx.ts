/*jshint node:true */
'use strict';

// @ts-expect-error TS(2304): Cannot find name 'exports'.
exports.load = function(ffmpeg: any) {
  ffmpeg
    .format('avi')
    .videoBitrate('1024k')
    .videoCodec('mpeg4')
    .size('720x?')
    .audioBitrate('128k')
    .audioChannels(2)
    .audioCodec('libmp3lame')
    .outputOptions(['-vtag DIVX']);
};