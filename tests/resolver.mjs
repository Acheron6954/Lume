export async function resolve(specifier, context, next) {
  try {
    return await next(specifier, context);
  } catch (err) {
    if (err && err.code === "ERR_MODULE_NOT_FOUND" && specifier.startsWith(".") && !/\.[a-z]+$/.test(specifier)) {
      return next(`${specifier}.ts`, context);
    }
    throw err;
  }
}
