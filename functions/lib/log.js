function write(method, level, event, fields) {
  console[method](JSON.stringify({ level, event, ...fields }));
}

export function info(event, fields = {}) {
  write('log', 'info', event, fields);
}

export function warn(event, fields = {}) {
  write('warn', 'warn', event, fields);
}
