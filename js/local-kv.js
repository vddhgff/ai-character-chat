// Browser-local persistence. Publish to storage before updating the memory cache,
// so quota/security failures reject instead of falsely reporting a successful save.
export function makeKV(storage) {
  const stores = new Map();
  const clone = value => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  function read(name) {
    if (!stores.has(name)) {
      let value = {};
      try { const parsed = JSON.parse(storage.getItem(`acc_kv_${name}`) || '{}'); if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) value = parsed; } catch { /* Same recovery behavior as the original adapter. */ }
      stores.set(name,value);
    }
    return stores.get(name);
  }
  function write(name, value) { storage.setItem(`acc_kv_${name}`,JSON.stringify(value)); stores.set(name,value); }
  return new Proxy({}, { get(_,name) {
    return {
      async get(key) { return clone(read(name)[key]); },
      async set(key,value) { write(name,{...read(name),[key]:clone(value)}); },
      async delete(key) { const next={...read(name)};delete next[key];write(name,next); },
      async entries() { return clone(Object.entries(read(name))); },
      async keys() { return Object.keys(read(name)); },
      async deleteMany(keys) { const next={...read(name)};for(const key of keys)delete next[key];write(name,next); },
    };
  } });
}
