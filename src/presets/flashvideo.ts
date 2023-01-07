/*jshint node:true */
'use strict';

// @ts-expect-error TS(2304): Cannot find name 'exports'.
exports.load = function(ffmpeg: any) {
  ffmpeg
    .format('flv')
    .flvmeta()
    .size('320x?')
    .videoBitrate('512k')
    .videoCodec('libx264')
    .fps(24)
    .audioBitrate('96k')
    .audioCodec('aac')
    .audioFrequency(22050)
    .audioChannels(2);
};
