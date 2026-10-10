// Polyfill: ganti Unicode script property yang gak didukung ICU kecil
const Module = require('module');
const origCompile = Module.prototype._compile;

const MAP = [
  ['\\p{sc=Deva}', '\\u0900-\\u097F'],
  ['\\p{sc=Devanagari}', '\\u0900-\\u097F'],
  ['\\p{sc=Thai}', '\\u0E00-\\u0E7F'],
  ['\\p{Script=Deva}', '\\u0900-\\u097F'],
  ['\\p{Script=Thai}', '\\u0E00-\\u0E7F'],
];

Module.prototype._compile = function (content, filename) {
  if (content.indexOf('\\p{sc=') !== -1 || content.indexOf('\\p{Script=') !== -1) {
    for (const [from, to] of MAP) content = content.split(from).join(to);
  }
  return origCompile.call(this, content, filename);
};
