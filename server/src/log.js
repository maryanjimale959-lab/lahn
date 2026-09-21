const C = { reset: '\x1b[0m', dim: '\x1b[2m', red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m', cyan: '\x1b[36m', magenta: '\x1b[35m' };

const stamp = () => new Date().toTimeString().slice(0, 8);

function emit(color, tag, args) {
  console.log(`${C.dim}${stamp()}${C.reset} ${color}${tag}${C.reset}`, ...args);
}

export const log = {
  info: (...a) => emit(C.cyan, 'lahn ', a),
  ok: (...a) => emit(C.green, 'ok   ', a),
  warn: (...a) => emit(C.yellow, 'warn ', a),
  error: (...a) => emit(C.red, 'error', a),
  brand: (...a) => emit(C.magenta, '♫    ', a),
};
