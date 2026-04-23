export async function withPatchedMethod(target, methodName, replacement, fn) {
  const original = target[methodName];
  target[methodName] = replacement;
  try {
    return await fn();
  } finally {
    target[methodName] = original;
  }
}

export async function withEnvVar(name, value, fn) {
  const previous = process.env[name];
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }

  try {
    return await fn();
  } finally {
    if (previous === undefined) {
      delete process.env[name];
    } else {
      process.env[name] = previous;
    }
  }
}
