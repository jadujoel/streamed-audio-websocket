if (Promise.withResolvers === undefined) {
  Promise.withResolvers = (() => {
    let resolve: any
    let reject: any
    const promise = new Promise((resolve_, reject_) => {
      resolve = resolve_
      reject = reject_
    })
    return { promise, resolve, reject }
  }) as any;
}
